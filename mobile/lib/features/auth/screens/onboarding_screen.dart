import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../providers/auth_provider.dart';
import '../../../services/liveness_service.dart';
import '../../../theme/app_theme.dart';
import '../../liveness/screens/face_liveness_screen.dart';
import 'national_id_qr_scan_screen.dart';

/// First-time citizen path after eGov SSO:
/// Face Liveness → National ID QR eVerify → home.
///
/// Hackathon SSO usually returns a test persona (e.g. Josie). PhilSys eVerify
/// therefore uses QR + face session instead of SSO name/DOB.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  int _step = 0; // 0 intro, 1 liveness done, 2 everify running/done
  bool _busy = false;
  String? _error;
  FaceLivenessOutcome? _liveness;
  final _qrController = TextEditingController();

  @override
  void dispose() {
    _qrController.dispose();
    super.dispose();
  }

  Future<void> _runLiveness() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final profile = await ref.read(currentProfileProvider.future);
      if (!mounted) return;
      final outcome = await FaceLivenessScreen.open(
        context,
        purpose: LivenessPurpose.registration,
        userId: profile?.id,
        title: 'Face verification',
        subtitle: 'Required once to register your PhilSys identity.',
      );
      if (!mounted) return;
      if (outcome == null || !outcome.passed) {
        setState(() {
          _busy = false;
          _error = outcome?.message ?? 'Face verification was not completed.';
        });
        return;
      }
      setState(() {
        _liveness = outcome;
        _step = 1;
        _busy = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _scanQr() async {
    setState(() => _error = null);
    try {
      final value = await NationalIdQrScanScreen.open(context);
      if (!mounted || value == null || value.isEmpty) return;
      setState(() => _qrController.text = value);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error =
            'Camera scanner unavailable ($e). Fully restart with `flutter run`, '
            'or paste the National ID QR string in the field above.';
      });
    }
  }

  Future<void> _runEverify() async {
    final liveness = _liveness;
    if (liveness == null) return;

    final qr = _qrController.text.trim();
    if (qr.isEmpty) {
      setState(() {
        _error =
            'Scan or paste your National ID QR value. Hackathon SSO names '
            '(e.g. Josie) will not match your face — QR bypasses that.';
      });
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _step = 2;
    });

    try {
      // Prefer PhilSys eVerify session_id; fall back to Nest correlation (server resolves).
      final faceSessionId =
          liveness.faceLivenessSessionId ?? liveness.sessionToken;
      await ref.read(authServiceProvider).completeFirstTimeEverify(
            faceLivenessSessionId: faceSessionId,
            qrValue: qr,
          );
      ref.invalidate(currentProfileProvider);
      if (!mounted) return;
      final updated = await ref.read(currentProfileProvider.future);
      if (!mounted) return;
      context.go(updated?.role.homeRoute ?? '/customer');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _signOut() async {
    await ref.read(authControllerProvider.notifier).signOut();
    if (!mounted) return;
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(currentProfileProvider).asData?.value;
    final livenessDone = _liveness?.passed == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Complete registration'),
        actions: [
          TextButton(onPressed: _busy ? null : _signOut, child: const Text('Sign out')),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                profile?.fullName.isNotEmpty == true
                    ? 'Welcome, ${profile!.fullName}'
                    : 'Welcome',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              const Text(
                'SSO signs you in. PhilSys eVerify uses your National ID QR + Face Liveness '
                '(not the SSO test name).',
                style: TextStyle(color: AppColors.muted, height: 1.4),
              ),
              const SizedBox(height: 16),
              Material(
                color: const Color(0xFFE8F0FE),
                borderRadius: BorderRadius.circular(12),
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text(
                    '1) Mint a fresh exchange code in the eGov SSO portal (not mock-exchange). '
                    '2) Face Liveness. '
                    '3) Scan your PhilSys / ePhilID QR — Nest calls POST /api/query/qr with that value + session_id.',
                    style: TextStyle(
                      color: Color(0xFF1A365D),
                      height: 1.35,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              _StepTile(
                index: 1,
                title: 'eGov SSO',
                subtitle: 'Signed in (minted exchange code)',
                done: true,
              ),
              _StepTile(
                index: 2,
                title: 'Face Liveness',
                subtitle: livenessDone
                    ? 'Passed (${_liveness!.confidenceScore.toStringAsFixed(1)}) — scan QR next'
                    : 'Complete camera check (same person as the ID)',
                done: livenessDone,
                active: _step == 0,
              ),
              _StepTile(
                index: 3,
                title: 'National ID QR eVerify',
                subtitle: _qrController.text.trim().isEmpty
                    ? 'Scan or paste PhilSys QR'
                    : 'QR ready (${_qrController.text.trim().length} chars)',
                done: false,
                active: livenessDone,
              ),
              if (livenessDone) ...[
                const SizedBox(height: 12),
                TextField(
                  controller: _qrController,
                  minLines: 2,
                  maxLines: 4,
                  enabled: !_busy,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'National ID QR value',
                    hintText: 'Paste raw QR string, or use Scan',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _scanQr,
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text('Scan National ID QR'),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const Spacer(),
              if (!livenessDone)
                FilledButton(
                  onPressed: _busy ? null : _runLiveness,
                  child: _busy && _step == 0
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Start face verification'),
                )
              else
                FilledButton(
                  onPressed: _busy ? null : _runEverify,
                  child: _busy
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Verify with QR & finish'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepTile extends StatelessWidget {
  const _StepTile({
    required this.index,
    required this.title,
    required this.subtitle,
    required this.done,
    this.active = false,
  });

  final int index;
  final String title;
  final String subtitle;
  final bool done;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final color = done
        ? AppColors.forest
        : active
            ? AppColors.primary
            : AppColors.muted;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: color.withValues(alpha: 0.15),
        foregroundColor: color,
        child: done ? const Icon(Icons.check) : Text('$index'),
      ),
      title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
      subtitle: Text(subtitle),
    );
  }
}
