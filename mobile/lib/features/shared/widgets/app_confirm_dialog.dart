import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../theme/app_theme.dart';


/// Minimal confirm dialog matching the web workflow prompt:
/// blurred barrier, rounded card, heart badge, title, description,
/// cancel / confirm pair. Resolves to true only on confirm.
Future<bool> showAppConfirm(
  BuildContext context, {
  required String title,
  required String description,
  String confirmLabel = 'Confirm',
  bool destructive = false,
}) async {
  final result = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Dismiss',
    barrierColor: Colors.black.withValues(alpha: 0.30),
    transitionDuration: const Duration(milliseconds: 150),
    pageBuilder: (context, _, __) => _AppConfirmDialog(
      title: title,
      description: description,
      confirmLabel: confirmLabel,
      destructive: destructive,
    ),
    transitionBuilder: (context, animation, _, child) {
      final curved =
          CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
      return BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: 4 * curved.value,
          sigmaY: 4 * curved.value,
        ),
        child: FadeTransition(
          opacity: curved,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.95, end: 1).animate(curved),
            child: child,
          ),
        ),
      );
    },
  );
  return result ?? false;
}

Future<bool> confirmSignOut(BuildContext context) => showAppConfirm(
      context,
      title: 'Sign out?',
      description: 'You can sign back in anytime with your email.',
      confirmLabel: 'Sign out',
      destructive: true,
    );

class _AppConfirmDialog extends StatelessWidget {
  const _AppConfirmDialog({
    required this.title,
    required this.description,
    required this.confirmLabel,
    required this.destructive,
  });

  final String title;
  final String description;
  final String confirmLabel;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppColors.card,
      elevation: 24,
      shadowColor: Colors.black45,
      insetPadding: const EdgeInsets.symmetric(horizontal: 28),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: AppColors.line),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                height: 52,
                width: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: destructive
                      ? const Color(0xFFFEF2F2)
                      : AppColors.secondary,
                  shape: BoxShape.circle,
                ),
                child: _HeartMark(grayscale: destructive),
              ),
              const SizedBox(height: 16),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontSize: 18),
              ),
              const SizedBox(height: 6),
              Text(
                description,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 14,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      style: destructive
                          ? FilledButton.styleFrom(
                              backgroundColor: AppColors.danger,
                            )
                          : null,
                      child: Text(confirmLabel),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeartMark extends StatelessWidget {
  const _HeartMark({required this.grayscale});

  final bool grayscale;

  @override
  Widget build(BuildContext context) {
    final image = Image.asset(
      'lib/assets/heart-egov.png',
      height: 26,
      fit: BoxFit.contain,
    );
    if (!grayscale) return image;
    return ColorFiltered(
      colorFilter: const ColorFilter.matrix(<double>[
        0.2126, 0.7152, 0.0722, 0, 0,
        0.2126, 0.7152, 0.0722, 0, 0,
        0.2126, 0.7152, 0.0722, 0, 0,
        0, 0, 0, 1, 0,
      ]),
      child: image,
    );
  }
}
