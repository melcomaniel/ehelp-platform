import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../providers/auth_provider.dart';
import '../../../services/liveness_service.dart';
import '../../../theme/app_theme.dart';
import '../../liveness/screens/face_liveness_screen.dart';
import '../data/program_catalog.dart';

/// Application flow for a [Program]: form → liveness → Nest submit → review.
class ProgramApplyScreen extends ConsumerStatefulWidget {
  const ProgramApplyScreen({super.key, required this.programId});

  final String programId;

  @override
  ConsumerState<ProgramApplyScreen> createState() => _ProgramApplyScreenState();
}

class _ProgramApplyScreenState extends ConsumerState<ProgramApplyScreen> {
  late final Program? _program;
  final _formKey = GlobalKey<FormState>();
  bool _submitting = false;

  /// key -> current value (String for most, bool for toggles/consent).
  final Map<String, dynamic> _values = {};
  final Map<String, TextEditingController> _controllers = {};

  @override
  void initState() {
    super.initState();
    _program = programById(widget.programId);
    final program = _program;
    if (program == null) return;

    for (final step in program.steps) {
      for (final f in step.fields) {
        if (f.defaultValue != null) _values[f.key] = f.defaultValue;
        if (f.type == FieldType.toggle || f.type == FieldType.consent) {
          _values[f.key] ??= false;
        }
        if (_isTextLike(f.type)) {
          _controllers[f.key] =
              TextEditingController(text: f.defaultValue ?? '');
        }
      }
    }
  }

  bool _isTextLike(FieldType t) =>
      t == FieldType.text ||
      t == FieldType.multiline ||
      t == FieldType.number ||
      t == FieldType.date;

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final program = _program!;
    if (!(_formKey.currentState?.validate() ?? false)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Complete all required fields.')),
      );
      return;
    }

    final outcome = await FaceLivenessScreen.open(
      context,
      purpose: LivenessPurpose.application,
      title: 'Identity verification',
      subtitle:
          'Complete the face liveness check to submit your ${program.code} application.',
    );
    if (!mounted || outcome == null || !outcome.passed) return;

    final profile = await ref.read(currentProfileProvider.future);
    if (profile == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in required to submit.')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final svc = ref.read(applicationServiceProvider);
      final templates = await svc.listTemplates();
      if (templates.isEmpty) {
        throw Exception(
          'No published programs in the database yet. Auth works; program apply will be enabled when programs are seeded.',
        );
      }
      final offices = await svc.listRegions();
      if (offices.isEmpty) {
        throw Exception('No offices available — check Nest bootstrap seed');
      }
      // Prefer NCR regional office when present; else first office.
      final office = offices.firstWhere(
        (o) => o.name.toLowerCase().contains('ncr'),
        orElse: () => offices.first,
      );

      final matched = templates.where(
        (t) =>
            t.id == program.id ||
            (t.code?.toLowerCase() == program.code.toLowerCase()),
      );
      final templateId =
          matched.isNotEmpty ? matched.first.id : templates.first.id;

      // Collect form values (controllers override map for text fields).
      final formData = <String, dynamic>{..._values};
      for (final e in _controllers.entries) {
        formData[e.key] = e.value.text;
      }

      await svc.createApplication(
        customerId: profile.id,
        regionId: office.id,
        templateId: templateId,
        formData: formData,
        submit: true,
        livenessConfidence: outcome.confidenceScore,
        livenessSessionToken: outcome.sessionToken,
      );

      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => _ReviewPendingScreen(program: program),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Submit failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final program = _program;
    if (program == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Program')),
        body: const Center(child: Text('Program not found')),
      );
    }

    final step = program.steps.first;

    return Scaffold(
      appBar: AppBar(title: Text('Apply — ${program.code}')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
            child: _JourneyTracker(stages: program.stages, activeType: 'form'),
          ),
          const Divider(height: 24),
          Expanded(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                children: [
                  Text(step.title,
                      style: Theme.of(context).textTheme.titleLarge),
                  if (step.subtitle != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      step.subtitle!,
                      style: const TextStyle(
                        color: AppColors.muted,
                        height: 1.4,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  for (final field in step.fields) ...[
                    _FieldWidget(
                      field: field,
                      controller: _controllers[field.key],
                      value: _values[field.key],
                      onChanged: (v) => setState(() => _values[field.key] = v),
                    ),
                    const SizedBox(height: 16),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
      // Buttons live in bottomNavigationBar so the system nav / gesture bar is
      // laid out beneath them and can never overlap.
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => context.pop(),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Submit'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Horizontal tracker of the program's workflow stages. The stage whose type
/// matches [activeType] is highlighted; earlier stages read as complete.
class _JourneyTracker extends StatelessWidget {
  const _JourneyTracker({required this.stages, required this.activeType});

  final List<WorkflowStage> stages;
  final String activeType;

  @override
  Widget build(BuildContext context) {
    final activeIndex =
        stages.indexWhere((s) => s.type == activeType).clamp(0, stages.length);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(stages.length, (i) {
        final done = i < activeIndex;
        final isActive = i == activeIndex;
        final circleColor = done
            ? AppColors.forest
            : (isActive ? AppColors.primary : AppColors.line);
        final textColor = (done || isActive) ? AppColors.ink : AppColors.muted;

        final node = Column(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: circleColor.withValues(
                    alpha: done || isActive ? 1 : 0.4),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: done
                    ? const Icon(Icons.check, color: Colors.white, size: 17)
                    : Text(
                        '${i + 1}',
                        style: TextStyle(
                          color: isActive ? Colors.white : AppColors.muted,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 5),
            Text(
              stages[i].name,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: textColor,
                fontSize: 10.5,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                height: 1.15,
              ),
            ),
          ],
        );

        if (i == stages.length - 1) return Expanded(child: node);
        return Expanded(
          child: Row(
            children: [
              Expanded(child: node),
              Padding(
                padding: const EdgeInsets.only(top: 15),
                child: SizedBox(
                  width: 16,
                  child: Divider(
                    color: i < activeIndex ? AppColors.forest : AppColors.line,
                    thickness: 2,
                  ),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}

/// Shared chrome for the verify / review stage screens: app bar titled by the
/// active stage, the stage tracker up top, [content] in the middle, and a
/// pinned bottom button. The button lives in the Scaffold's
/// bottomNavigationBar — that slot is laid out above the system nav bar, so
/// the phone's back/home gesture bar can never overlap it.
class _StageScaffold extends StatelessWidget {
  const _StageScaffold({
    required this.program,
    required this.activeType,
    required this.content,
    required this.buttonLabel,
    required this.onButton,
  });

  final Program program;
  final String activeType;
  final Widget content;
  final String buttonLabel;

  /// null disables the button (e.g. while verification is still processing).
  final VoidCallback? onButton;

  @override
  Widget build(BuildContext context) {
    final title = program.stages
        .firstWhere((s) => s.type == activeType,
            orElse: () => program.stages.first)
        .name;
    return PopScope(
      canPop: false,
      child: Scaffold(
        appBar: AppBar(
          title: Text(title),
          automaticallyImplyLeading: false,
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
              child: _JourneyTracker(
                stages: program.stages,
                activeType: activeType,
              ),
            ),
            const Divider(height: 24),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 0),
                child: content,
              ),
            ),
          ],
        ),
        bottomNavigationBar: SafeArea(
          minimum: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 8),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onButton,
                child: Text(buttonLabel),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Pops any imperative stage routes (verify/review) stacked on top of the
/// go_router page, then navigates home via go_router. Mixing an imperative
/// push with context.go otherwise leaves the pushed route covering the screen,
/// which is why "Back to home" appeared to do nothing.
void _goHome(BuildContext context) {
  final nav = Navigator.of(context);
  while (nav.canPop()) {
    nav.pop();
  }
  context.go('/customer');
}

/// Stage 3 — application submitted, waiting for social worker review.
class _ReviewPendingScreen extends StatelessWidget {
  const _ReviewPendingScreen({required this.program});

  final Program program;

  @override
  Widget build(BuildContext context) {
    return _StageScaffold(
      program: program,
      activeType: 'review',
      buttonLabel: 'Proceed to disbursement',
      onButton: () => context.push('/customer/programs/${program.id}/disbursement'),
      content: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.hourglass_top_rounded,
                color: AppColors.primary,
                size: 46,
              ),
            ),
            const SizedBox(height: 28),
            Text('Waiting for review',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              'Your ${program.code} application has been submitted and is now '
              'pending review by a social worker. Once approved, proceed to '
              'disbursement to receive your cash grant.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}

/// Stage 4 — Cash Grant Disbursement. Shows a QR code the social worker scans
/// to release the grant. Mock payload (reference code); no real disbursement.
///
/// Public + go_router-addressable (`/customer/programs/:id/disbursement`) so a
/// hot reload can land straight here while iterating on the QR UI.
class DisbursementQrScreen extends StatelessWidget {
  const DisbursementQrScreen({super.key, required this.programId});

  final String programId;

  /// Deterministic mock reference so the QR is stable across rebuilds.
  String _referenceFor(Program p) => '${p.code}-CG-2026-000482';

  @override
  Widget build(BuildContext context) {
    final program = programById(programId);
    if (program == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Disbursement')),
        body: const Center(child: Text('Program not found')),
      );
    }
    final reference = _referenceFor(program);
    // Payload the social worker's scanner would read.
    final payload =
        'EHELP|program=${program.code}|ref=$reference|action=disburse';

    return _StageScaffold(
      program: program,
      activeType: 'disbursement',
      buttonLabel: 'Back to home',
      onButton: () => _goHome(context),
      content: SingleChildScrollView(
        child: Column(
          children: [
            const SizedBox(height: 8),
            Text('Show this to the social worker',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center),
            const SizedBox(height: 8),
            const Text(
              'The social worker scans this QR code to release your cash grant.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, height: 1.4),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.line),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.06),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: QrImageView(
                data: payload,
                version: QrVersions.auto,
                size: 220,
                eyeStyle: const QrEyeStyle(
                  eyeShape: QrEyeShape.square,
                  color: AppColors.ink,
                ),
                dataModuleStyle: const QrDataModuleStyle(
                  dataModuleShape: QrDataModuleShape.square,
                  color: AppColors.ink,
                ),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.secondary,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  const Text('Reference number',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      )),
                  const SizedBox(height: 4),
                  Text(
                    reference,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.info_outline, size: 16, color: AppColors.muted),
                SizedBox(width: 6),
                Flexible(
                  child: Text(
                    'Keep this screen open until the grant is released.',
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _FieldWidget extends StatelessWidget {
  const _FieldWidget({
    required this.field,
    required this.controller,
    required this.value,
    required this.onChanged,
  });

  final ProgramField field;
  final TextEditingController? controller;
  final dynamic value;
  final void Function(dynamic) onChanged;

  String? _validate(String? v) {
    if (!field.required) return null;
    if (v == null || v.trim().isEmpty) return '${field.label} is required';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    switch (field.type) {
      case FieldType.dropdown:
        return DropdownButtonFormField<String>(
          initialValue: (value as String?) ??
              (field.options.isNotEmpty ? field.options.first : null),
          decoration: InputDecoration(
            labelText: field.label,
            helperText: field.helper,
          ),
          items: field.options
              .map((o) => DropdownMenuItem(value: o, child: Text(o)))
              .toList(),
          onChanged: (v) => onChanged(v),
        );

      case FieldType.toggle:
        return SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(field.label),
          subtitle: field.helper != null ? Text(field.helper!) : null,
          value: (value as bool?) ?? false,
          onChanged: onChanged,
        );

      case FieldType.multiline:
        return TextFormField(
          controller: controller,
          maxLines: 4,
          decoration: InputDecoration(
            labelText: field.label,
            hintText: field.hint,
            helperText: field.helper,
            alignLabelWithHint: true,
          ),
          validator: _validate,
          onChanged: onChanged,
        );

      case FieldType.number:
        return TextFormField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
          ],
          decoration: InputDecoration(
            labelText: field.label,
            hintText: field.hint,
            helperText: field.helper,
          ),
          validator: _validate,
          onChanged: onChanged,
        );

      case FieldType.date:
        return TextFormField(
          controller: controller,
          readOnly: true,
          decoration: InputDecoration(
            labelText: field.label,
            hintText: field.hint ?? 'YYYY-MM-DD',
            helperText: field.helper,
            suffixIcon: const Icon(Icons.calendar_today_outlined, size: 18),
          ),
          validator: _validate,
          onTap: () async {
            final now = DateTime.now();
            final picked = await showDatePicker(
              context: context,
              initialDate: DateTime(now.year - 20),
              firstDate: DateTime(1900),
              lastDate: now,
            );
            if (picked != null) {
              final s =
                  '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
              controller?.text = s;
              onChanged(s);
            }
          },
        );

      case FieldType.file:
        return _FileUploadField(
          field: field,
          fileName: value as String?,
          onPicked: onChanged,
        );

      case FieldType.consent:
        return FormField<bool>(
          initialValue: (value as bool?) ?? false,
          validator: (v) {
            if (field.required && v != true) {
              return 'You must certify and consent to continue';
            }
            return null;
          },
          builder: (formState) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  value: (value as bool?) ?? false,
                  title: Text(field.label,
                      style: const TextStyle(fontSize: 14)),
                  onChanged: (v) {
                    onChanged(v ?? false);
                    formState.didChange(v ?? false);
                  },
                ),
                if (formState.hasError)
                  Padding(
                    padding: const EdgeInsets.only(left: 12, top: 2),
                    child: Text(
                      formState.errorText!,
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontSize: 12,
                      ),
                    ),
                  ),
              ],
            );
          },
        );

      case FieldType.text:
        return TextFormField(
          controller: controller,
          decoration: InputDecoration(
            labelText: field.label,
            hintText: field.hint,
            helperText: field.helper,
          ),
          validator: _validate,
          onChanged: onChanged,
        );
    }
  }
}

/// Mock document upload. Tapping "Upload" fakes a file pick (no real storage)
/// and stores a filename in form values so the requirement reads as satisfied.
class _FileUploadField extends StatelessWidget {
  const _FileUploadField({
    required this.field,
    required this.fileName,
    required this.onPicked,
  });

  final ProgramField field;
  final String? fileName;
  final void Function(dynamic) onPicked;

  String _mockName() {
    // Deterministic mock filename per field, matching the web seed fixtures.
    switch (field.key) {
      case 'valid_id_card':
        return 'valid-id.jpg';
      case 'supporting_document':
        return 'supporting-document.pdf';
      case 'barangay_indigency':
        return 'barangay-indigency.pdf';
      default:
        return '${field.key}.pdf';
    }
  }

  @override
  Widget build(BuildContext context) {
    final picked = fileName != null && fileName!.isNotEmpty;
    return FormField<String>(
      initialValue: fileName,
      validator: (v) {
        if (field.required && (v == null || v.isEmpty)) {
          return '${field.label} is required';
        }
        return null;
      },
      builder: (formState) {
        return Container(
          decoration: BoxDecoration(
            color: AppColors.secondary,
            borderRadius: BorderRadius.circular(10),
            border: formState.hasError
                ? Border.all(color: AppColors.danger)
                : null,
          ),
          padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(field.label,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  )),
              if (field.helper != null) ...[
                const SizedBox(height: 2),
                Text(
                  field.helper!,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 11,
                    height: 1.3,
                  ),
                ),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(
                    picked
                        ? Icons.description_outlined
                        : Icons.upload_file_outlined,
                    size: 20,
                    color: picked ? AppColors.forest : AppColors.muted,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      picked ? fileName! : 'No file selected',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        color: picked ? AppColors.ink : AppColors.muted,
                      ),
                    ),
                  ),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 40),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                    ),
                    onPressed: () {
                      final name = _mockName();
                      onPicked(name);
                      formState.didChange(name);
                    },
                    icon: Icon(picked ? Icons.check : Icons.add, size: 18),
                    label: Text(picked ? 'Replace' : 'Upload'),
                  ),
                ],
              ),
              if (formState.hasError)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    formState.errorText!,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontSize: 12,
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
