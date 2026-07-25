import 'dart:convert';
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

class FaceLivenessOutcome {
  const FaceLivenessOutcome({
    required this.passed,
    required this.sessionToken,
    required this.confidenceScore,
    this.referenceImageUrl,
    this.message,
    this.faceLivenessSessionId,
  });

  final bool passed;
  /// Nest correlation token (for verify/bind lookups).
  final String sessionToken;
  final double confidenceScore;
  final String? referenceImageUrl;
  final String? message;
  /// PhilSys eVerify SDK session_id — required by /api/query and /api/query/qr.
  final String? faceLivenessSessionId;
}

/// Hosted Face Liveness.
///
/// eVerify PhilSys path opens the official HTTPS liveness app in WebView
/// (camera requires a secure top-level page) and captures session_id via JS.
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
  bool _bridgeHandled = false;
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
    _bootstrap();
  }

  Future<void> _bootstrap({bool? preferWebView}) async {
    setState(() {
      _loading = true;
      _error = null;
      _lastRejectMessage = null;
      _controller = null;
      _bridgeHandled = false;
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

    try {
      final session = await ref.read(livenessServiceProvider).createSession(
            purpose: widget.purpose,
            userId: widget.userId,
            applicationId: widget.applicationId,
          );
      if (!mounted) return;

      // eVerify HTTPS app must run top-level in WebView so we can capture session_id.
      final useWebView = preferWebView ?? session.isEverifySdk;

      setState(() {
        _session = session;
        _useWebView = useWebView;
        _loading = false;
      });

      if (useWebView) {
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

  Future<bool> _ensureCameraPermission() async {
    final cam = await Permission.camera.request();
    await Permission.microphone.request();
    if (cam.isGranted) return true;
    if (cam.isPermanentlyDenied) await openAppSettings();
    return false;
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
      ..addJavaScriptChannel(
        'EhelpLiveness',
        onMessageReceived: (message) {
          _onEverifyBridgeMessage(message.message);
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            if (request.url.startsWith('ehelp://')) {
              _verify();
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
          onPageFinished: (_) => _injectEverifyBridge(),
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

  Future<void> _injectEverifyBridge() async {
    final controller = _controller;
    if (controller == null) return;
    // SPA navigates to /?mode=aws — re-inject after each page load.
    // Only forward a COMPLETED capture (photo + session_id). Creating a session
    // alone must not bind — eVerify /api/query rejects unfinished sessions with
    // face_liveness_error_exception.
    await controller.runJavaScript(r'''
      (function () {
        if (window.__ehelpLivenessHooked) return;
        window.__ehelpLivenessHooked = true;
        function forward(payload) {
          try {
            if (!payload) return;
            var p = payload;
            if (typeof p === 'string') {
              try { p = JSON.parse(p); } catch (e) { return; }
            }
            if (typeof p !== 'object') return;
            var result = p.result || {};
            var sid = p.session_id || result.session_id || null;
            var photo = p.photo_url || result.photo_url || result.photo || p.face_url || result.face_url || null;
            var status = String(p.status || result.status || '').toUpperCase();
            var done = status === 'COMPLETED' || status === 'SUCCEEDED' || !!photo;
            if (!sid || !done || !window.EhelpLiveness) return;
            if (window.__ehelpForwardedSid === sid) return;
            window.__ehelpForwardedSid = sid;
            EhelpLiveness.postMessage(JSON.stringify({
              session_id: sid,
              photo_url: typeof photo === 'string' && photo.indexOf('data:') === 0 ? null : photo,
              status: status || 'COMPLETED'
            }));
          } catch (e) {}
        }
        window.addEventListener('message', function (ev) { forward(ev.data); });
        var origFetch = window.fetch;
        window.fetch = function () {
          var args = arguments;
          return origFetch.apply(this, args).then(function (res) {
            try {
              var url = String(args[0] && args[0].url ? args[0].url : args[0] || '');
              if (url.indexOf('/api/face_liveness_session') >= 0) {
                res.clone().json().then(function (json) {
                  var d = json && json.data ? json.data : json;
                  if (!d) return;
                  if (d.session_id) window.__ehelpSessionId = d.session_id;
                  var photo = d.face_url || d.photo_url || d.image_url || null;
                  if (photo || d.reference) {
                    forward({
                      session_id: d.session_id || window.__ehelpSessionId,
                      photo_url: photo,
                      status: 'COMPLETED',
                      result: d
                    });
                  }
                }).catch(function () {});
              }
            } catch (e) {}
            return res;
          });
        };
      })();
    ''');
  }

  Future<void> _onEverifyBridgeMessage(String raw) async {
    if (_bridgeHandled || _verifying) return;
    final session = _session;
    if (session == null) return;

    Map<String, dynamic> payload;
    try {
      payload = Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      return;
    }
    final everifySessionId = payload['session_id'] as String?;
    if (everifySessionId == null || everifySessionId.isEmpty) return;

    _bridgeHandled = true;
    setState(() => _verifying = true);
    try {
      await ref.read(livenessServiceProvider).bindEverifySession(
            correlation: session.token,
            everifySessionId: everifySessionId,
            referenceImageUrl: payload['photo_url'] as String?,
          );
      final result = await ref.read(livenessServiceProvider).verifyResult(
            sessionToken: session.token,
            applicationId: widget.applicationId,
            markProfile: widget.purpose == LivenessPurpose.registration,
          );
      if (!mounted) return;
      if (!result.passed) {
        setState(() {
          _verifying = false;
          _bridgeHandled = false;
          _lastRejectMessage = result.message;
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
          faceLivenessSessionId:
              result.faceLivenessSessionId ?? everifySessionId,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _verifying = false;
        _bridgeHandled = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
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
              'Chrome not found — opened default browser. For National ID eVerify use in-app WebView.',
            ),
            duration: Duration(seconds: 5),
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
          faceLivenessSessionId: result.faceLivenessSessionId,
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
    final everify = _session?.isEverifySdk == true;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title ?? 'Face verification'),
        actions: [
          if (_session != null && !everify)
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
                everify
                    ? 'National ID eVerify: complete “Start Liveness” in this screen (HTTPS). When finished, the app captures session_id automatically — then continue to National ID verify.'
                    : Platform.isAndroid
                        ? 'Face Liveness opens in Chrome. Allow camera, then return and tap Verify.'
                        : 'After verification completes, return and tap Verify.',
                style: const TextStyle(color: Color(0xFF412402), height: 1.35),
              ),
            ),
          ),
          if (_lastRejectMessage != null)
            Material(
              color: const Color(0xFFFAECE7),
              child: ListTile(
                title: Text(
                  'Last: ${_lastStatus ?? '—'} · ${_lastConfidence?.toStringAsFixed(1) ?? '—'}',
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
                  if (!everify) ...[
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
                  ] else if (_verifying) ...[
                    const Padding(
                      padding: EdgeInsets.all(8),
                      child: CircularProgressIndicator(),
                    ),
                    const Text('Saving eVerify session…'),
                    const SizedBox(height: 8),
                  ],
                  OutlinedButton(
                    onPressed: _verifying ? null : () => _bootstrap(),
                    child: const Text('Retry'),
                  ),
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
              onPressed: () => _bootstrap(),
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
          const Icon(Icons.face_retouching_natural,
              size: 56, color: AppColors.forest),
          const SizedBox(height: 16),
          Text(
            _openedBrowser != null && _openedBrowser!.contains('chrome')
                ? 'Complete Face Liveness in Google Chrome, then return and tap Verify.'
                : 'Complete Face Liveness in the browser, then return and tap Verify.',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
