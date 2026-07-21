import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import '../../../providers/auth_provider.dart';
import '../../../services/liveness_browser_launcher.dart';
import '../../../services/liveness_service.dart';
import '../../../theme/app_theme.dart';

final livenessServiceProvider = Provider<LivenessService>(
  (ref) => LivenessService(ref.watch(supabaseClientProvider)),
);

class FaceLivenessOutcome {
  const FaceLivenessOutcome({
    required this.passed,
    required this.sessionToken,
    required this.confidenceScore,
    this.referenceImageUrl,
    this.message,
  });

  final bool passed;
  final String sessionToken;
  final double confidenceScore;
  final String? referenceImageUrl;
  final String? message;
}

/// Hosted Face Liveness — Chrome/external first (better scores), WebView optional.
class FaceLivenessScreen extends ConsumerStatefulWidget {
  const FaceLivenessScreen({
    super.key,
    required this.purpose,
    this.userId,
    this.applicationId,
    this.title,
    this.subtitle,
  });

  final LivenessPurpose purpose;
  final String? userId;
  final String? applicationId;
  final String? title;
  final String? subtitle;

  static Future<FaceLivenessOutcome?> open(
    BuildContext context, {
    required LivenessPurpose purpose,
    String? userId,
    String? applicationId,
    String? title,
    String? subtitle,
  }) {
    return Navigator.of(context).push<FaceLivenessOutcome>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => FaceLivenessScreen(
          purpose: purpose,
          userId: userId,
          applicationId: applicationId,
          title: title,
          subtitle: subtitle,
        ),
      ),
    );
  }

  @override
  ConsumerState<FaceLivenessScreen> createState() => _FaceLivenessScreenState();
}

class _FaceLivenessScreenState extends ConsumerState<FaceLivenessScreen> {
  bool _loading = true;
  bool _verifying = false;
  bool _useWebView = false;
  String? _error;
  String? _lastRejectMessage;
  double? _lastConfidence;
  String? _lastStatus;
  LivenessSession? _session;
  WebViewController? _controller;
  String? _openedBrowser;

  @override
  void initState() {
    super.initState();
    // Force Chrome when possible — Opera hangs on Face Liveness "Connecting…".
    _bootstrap(preferWebView: false);
  }

  Future<void> _bootstrap({required bool preferWebView}) async {
    setState(() {
      _loading = true;
      _error = null;
      _lastRejectMessage = null;
      _useWebView = preferWebView;
      _controller = null;
    });

    final permitted = await _ensureCameraPermission();
    if (!permitted) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error =
            'Camera permission is required. Enable it in Settings, then retry.';
      });
      return;
    }

    await _startSession(loadInWebView: preferWebView);
  }

  Future<bool> _ensureCameraPermission() async {
    final cam = await Permission.camera.request();
    await Permission.microphone.request();
    if (cam.isGranted) return true;
    if (cam.isPermanentlyDenied) await openAppSettings();
    return false;
  }

  Future<void> _startSession({required bool loadInWebView}) async {
    setState(() {
      _loading = true;
      _error = null;
      _useWebView = loadInWebView;
      _controller = null;
    });

    try {
      final session = await ref.read(livenessServiceProvider).createSession(
            purpose: widget.purpose,
            userId: widget.userId,
            applicationId: widget.applicationId,
          );
      if (!mounted) return;
      setState(() {
        _session = session;
        _loading = false;
      });

      if (loadInWebView) {
        await _loadWebView(session.url);
      } else {
        await _openExternal(session.url);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadWebView(String url) async {
    late final PlatformWebViewControllerCreationParams params;
    if (WebViewPlatform.instance is WebKitWebViewPlatform) {
      params = WebKitWebViewControllerCreationParams(
        allowsInlineMediaPlayback: true,
        mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
      );
    } else {
      params = const PlatformWebViewControllerCreationParams();
    }

    final controller = WebViewController.fromPlatformCreationParams(params)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            if (request.url.startsWith('ehelp://')) {
              _verify();
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      );

    if (controller.platform is AndroidWebViewController) {
      final android = controller.platform as AndroidWebViewController;
      await android.setMediaPlaybackRequiresUserGesture(false);
      await android.setOnPlatformPermissionRequest((request) async {
        request.grant();
      });
    }

    await controller.loadRequest(Uri.parse(url));
    if (!mounted) return;
    setState(() => _controller = controller);
  }

  Future<void> _openExternal(String url) async {
    try {
      final package = await LivenessBrowserLauncher.open(url);
      if (!mounted) return;
      setState(() => _openedBrowser = package ?? 'default');
      if (package == null && Platform.isAndroid) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Chrome not found — opened default browser. Install Chrome if Connecting… hangs (Opera often fails).',
            ),
            duration: Duration(seconds: 5),
          ),
        );
      } else if (package != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Opened in Chrome ($package). Allow camera when asked.'),
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open browser: $e')),
      );
    }
  }

  Future<void> _verify() async {
    final session = _session;
    if (session == null || _verifying) return;

    setState(() => _verifying = true);
    try {
      final result = await ref.read(livenessServiceProvider).verifyResult(
            sessionToken: session.token,
            applicationId: widget.applicationId,
            markProfile: widget.purpose == LivenessPurpose.registration,
          );
      if (!mounted) return;

      if (!result.passed) {
        setState(() {
          _verifying = false;
          _lastRejectMessage = result.message ??
              'Status ${result.status}, score ${result.confidenceScore.toStringAsFixed(1)}';
          _lastConfidence = result.confidenceScore;
          _lastStatus = result.status;
        });
        return;
      }

      Navigator.of(context).pop(
        FaceLivenessOutcome(
          passed: true,
          sessionToken: session.token,
          confidenceScore: result.confidenceScore,
          referenceImageUrl: result.referenceImageUrl,
          message: result.message,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _verifying = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title ?? 'Face verification'),
        actions: [
          if (_session != null)
            IconButton(
              tooltip: _useWebView ? 'Open in Chrome' : 'Use in-app WebView',
              onPressed: () => _bootstrap(preferWebView: !_useWebView),
              icon: Icon(_useWebView ? Icons.open_in_browser : Icons.web),
            ),
        ],
      ),
      body: Column(
        children: [
          Material(
            color: const Color(0xFFFAEEDA),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Text(
                Platform.isAndroid
                    ? 'Face Liveness requires Google Chrome (not Opera). If Connecting… hangs, install/open Chrome and allow camera. Physical phone works best.'
                    : 'After the page says Verification complete, wait 2–3 seconds, then tap Verify.',
                style: const TextStyle(color: Color(0xFF412402), height: 1.35),
              ),
            ),
          ),
          if (_lastRejectMessage != null)
            Material(
              color: const Color(0xFFFAECE7),
              child: ListTile(
                title: Text(
                  'Last: ${_lastStatus ?? '—'} · ${_lastConfidence != null && _lastConfidence! < 1 ? _lastConfidence!.toStringAsFixed(4) : _lastConfidence?.toStringAsFixed(1) ?? '—'}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(_lastRejectMessage!),
              ),
            ),
          Expanded(child: _buildBody()),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Column(
                children: [
                  if (_lastRejectMessage != null) ...[
                    FilledButton.icon(
                      onPressed: _verifying
                          ? null
                          : () => _bootstrap(preferWebView: false),
                      icon: const Icon(Icons.open_in_browser),
                      label: const Text('Retry in Chrome'),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed:
                          (_session == null || _verifying) ? null : _verify,
                      child: const Text('Check result again'),
                    ),
                  ] else ...[
                    FilledButton(
                      onPressed:
                          (_session == null || _verifying) ? null : _verify,
                      child: _verifying
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('I finished — verify result'),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: _verifying
                          ? null
                          : () => _bootstrap(preferWebView: true),
                      child: const Text('Try in-app WebView instead'),
                    ),
                  ],
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Cancel'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => _bootstrap(preferWebView: false),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }
    if (_useWebView && _controller != null) {
      return WebViewWidget(controller: _controller!);
    }
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.face_retouching_natural, size: 56, color: AppColors.forest),
          const SizedBox(height: 16),
          Text(
            _openedBrowser != null && _openedBrowser!.contains('chrome')
                ? 'Complete Face Liveness in Google Chrome, then return and tap Verify.'
                : 'Complete Face Liveness in the browser, then return and tap Verify.\n\nDo not use Opera — it usually sticks on Connecting…',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
