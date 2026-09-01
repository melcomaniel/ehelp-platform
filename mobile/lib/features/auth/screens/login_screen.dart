import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../providers/auth_provider.dart';
import '../../../services/liveness_service.dart';
import '../../../theme/app_theme.dart';
import '../../liveness/screens/face_liveness_screen.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  Future<void> _sso() async {
    final code = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final c = TextEditingController();
        return AlertDialog(
          title: const Text('eGov SSO'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Paste beneficiary (or beneficiary2 / dependent) for local '
                'mobile test accounts. Or paste a live eGov exchange code. '
                'Next: face liveness check.',
                style: TextStyle(fontSize: 13, height: 1.35),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: c,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'exchange_code',
                  hintText: 'Paste from SSO portal',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, c.text.trim()),
              child: const Text('Continue'),
            ),
          ],
        );
      },
    );
    if (code == null || code.isEmpty) return;

    final pendingData =
        await ref.read(authControllerProvider.notifier).exchangeSso(code);
    if (!mounted) return;
    final err = ref.read(authControllerProvider).error;
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err.toString())),
      );
      return;
    }
    final pending = pendingData?['pending_login_token'] as String?;
    if (pending == null || pending.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SSO did not return a pending login token')),
      );
      return;
    }

    final outcome = await FaceLivenessScreen.open(
      context,
      purpose: LivenessPurpose.login,
      pendingLoginToken: pending,
      title: 'Sign-in face check',
      subtitle: 'Confirm you are present — not PhilSys identity match.',
    );
    if (!mounted) return;
    if (outcome == null || !outcome.passed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Face liveness required to finish sign-in')),
      );
      return;
    }

    await ref.read(authControllerProvider.notifier).completeLogin(
          pendingLoginToken: pending,
          livenessSessionToken: outcome.sessionToken,
        );
    if (!mounted) return;
    final completeErr = ref.read(authControllerProvider).error;
    if (completeErr != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(completeErr.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final loading = ref.watch(authControllerProvider).isLoading;

    return Scaffold(
      body: Container(
        color: AppColors.surface,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Image.asset(
                      'lib/assets/heart-egov-letter.png',
                      height: 96,
                      fit: BoxFit.contain,
                      color: AppColors.primary,
                      colorBlendMode: BlendMode.srcIn,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'eGov SSO · Face Liveness · PhilSys (first time)',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.muted, fontSize: 14),
                    ),
                    const SizedBox(height: 28),
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Sign in',
                            textAlign: TextAlign.center,
                            style: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.copyWith(fontSize: 24),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Continue with eGov SSO, then a face liveness check. '
                            'First-time beneficiaries complete PhilSys eVerify after sign-in.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppColors.muted,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 24),
                          FilledButton(
                            onPressed: loading ? null : _sso,
                            child: loading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text('Continue with eGov SSO'),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'In the app, paste beneficiary, beneficiary2, or '
                            'dependent as the exchange code (local mock '
                            'identities). Staff use the web portal with eGov '
                            'SSO sample accounts.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create account')),
      body: const Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Self-registration with password is removed. Use eGov SSO on the '
          'sign-in screen. Nest POST /auth/dev/login remains for automated tests only.',
        ),
      ),
    );
  }
}

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('OTP')),
      body: const Padding(
        padding: EdgeInsets.all(24),
        child: Text('OTP login removed — use eGov SSO.'),
      ),
    );
  }
}
