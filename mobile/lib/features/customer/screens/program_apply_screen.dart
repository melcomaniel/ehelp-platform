import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/utils/pick_document_file.dart';
import '../../../models/application.dart';
import '../../../providers/auth_provider.dart';
import '../../../services/liveness_service.dart';
import '../../../theme/app_theme.dart';
import '../../liveness/screens/face_liveness_screen.dart';
import '../data/program_catalog.dart';

FieldType _fieldTypeFromNest(ProgramDetailField f) {
  final t = f.type.toLowerCase();
  if (t == 'textarea' || f.multiline) return FieldType.multiline;
  if (t == 'number') return FieldType.number;
  if (t == 'date') return FieldType.date;
  if (t == 'dropdown' || t == 'select' || t == 'radio') {
    return FieldType.dropdown;
  }
  if (t == 'checkbox') return FieldType.toggle;
  if (t == 'file') return FieldType.file;
  if (t == 'consent') return FieldType.consent;
  return FieldType.text;
}

Program programFromNestDetail(ProgramDetail d) {
  final stages = d.stages.isNotEmpty
      ? d.stages
          .map((s) => WorkflowStage(name: s.name, type: s.type))
          .toList()
      : const [
          WorkflowStage(name: 'Application Form', type: 'form'),
          WorkflowStage(name: 'Identity Verification', type: 'verify'),
          WorkflowStage(name: 'Social Worker Review', type: 'review'),
          WorkflowStage(name: 'Cash Grant Disbursement', type: 'disbursement'),
        ];

  final fields = d.fields.isNotEmpty
      ? d.fields
          .map(
            (f) => ProgramField(
              key: f.key,
              label: f.label,
              type: _fieldTypeFromNest(f),
              helper: f.helpText.isNotEmpty ? f.helpText : null,
              required: f.required,
              options: f.options,
            ),
          )
          .toList()
      : [
          ProgramField(
            key: 'reason',
            label: 'Reason for applying',
            type: FieldType.multiline,
            helper: 'Briefly describe why you need this assistance',
          ),
          const ProgramField(
            key: 'consent',
            label: 'I confirm the information I provide is true and complete',
            type: FieldType.consent,
          ),
        ];

  final tagline = d.isOnCooldown && d.eligibleAgainAt != null
      ? 'Available again ${_formatEligibleDate(d.eligibleAgainAt!)}'
      : 'Cooldown ${d.disbursementCooldownDays} days';

  return Program(
    id: d.id,
    code: d.code ?? d.name,
    name: d.name,
    tagline: tagline,
    description: d.description?.isNotEmpty == true
        ? d.description!
        : 'Apply for ${d.name}.',
    icon: Icons.volunteer_activism_outlined,
    color: const Color(0xFF0040E7),
    stages: stages,
    steps: [
      ProgramStep(
        title: d.formTitle?.isNotEmpty == true
            ? d.formTitle!
            : '${d.name} Application',
        subtitle: d.formSubtitle,
        fields: fields,
      ),
    ],
  );
}

String _formatEligibleDate(DateTime dt) {
  final local = dt.toLocal();
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${months[local.month - 1]} ${local.day}, ${local.year}';
}

/// Application flow for a [Program]: form → liveness → Nest submit → review.
class ProgramApplyScreen extends ConsumerStatefulWidget {
  const ProgramApplyScreen({super.key, required this.programId});

  final String programId;

  @override
  ConsumerState<ProgramApplyScreen> createState() => _ProgramApplyScreenState();
}

class _ProgramApplyScreenState extends ConsumerState<ProgramApplyScreen> {
  Program? _program;
  ProgramDetail? _detail;
  bool _loading = true;
  final _formKey = GlobalKey<FormState>();
  bool _submitting = false;

  /// Existing Nest application for this program, if any.
  /// Used to block re-apply / later stages while waiting for staff review.
  Application? _existingApp;

  /// key -> current value (String for most, bool for toggles/consent).
  final Map<String, dynamic> _values = {};
  final Map<String, TextEditingController> _controllers = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_bootstrap());
    });
  }

  Future<void> _bootstrap() async {
    final catalog = programById(widget.programId);
    if (catalog != null) {
      _bindProgram(catalog);
    } else {
      await _loadNestProgram();
    }
    await _loadExistingApplication();
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadExistingApplication() async {
    try {
      final profile = await ref.read(currentProfileProvider.future);
      if (profile == null) return;
      final apps = await ref
          .read(applicationServiceProvider)
          .listMyApplications(profile.id);
      final forProgram =
          apps.where((a) => a.templateId == widget.programId).toList();
      if (forProgram.isEmpty) return;
      // Prefer an in-flight or approved case. Claimed/disbursed are handled
      // by the program cooldown gate (re-apply after cooldown).
      Application? pick;
      for (final a in forProgram) {
        if (a.status == ApplicationStatus.declined ||
            a.status == ApplicationStatus.cancelled ||
            a.status == ApplicationStatus.claimed ||
            a.status == ApplicationStatus.disbursed) {
          continue;
        }
        pick = a;
        break;
      }
      _existingApp = pick;
    } catch (_) {
      // Non-fatal — still allow apply form if status lookup fails.
    }
  }

  bool get _isWaitingForReview {
    final s = _existingApp?.status;
    return s == ApplicationStatus.submitted ||
        s == ApplicationStatus.underReview ||
        s == ApplicationStatus.recommended;
  }

  bool get _isApprovedForDisbursement {
    final s = _existingApp?.status;
    return s == ApplicationStatus.approved;
  }

  bool get _isOnCooldown =>
      _detail != null && !_detail!.canApply && _detail!.isOnCooldown;

  void _bindProgram(Program program) {
    _program = program;
    for (final c in _controllers.values) {
      c.dispose();
    }
    _controllers.clear();
    _values.clear();
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

  Future<void> _loadNestProgram() async {
    try {
      final detail = await ref
          .read(applicationServiceProvider)
          .getProgram(widget.programId);
      if (!mounted) return;
      _detail = detail;
      _bindProgram(programFromNestDetail(detail));
    } catch (e) {
      // Fallback to list summary if detail endpoint fails.
      try {
        final templates =
            await ref.read(applicationServiceProvider).listTemplates();
        final match = templates.where((t) => t.id == widget.programId);
        if (!mounted) return;
        if (match.isNotEmpty) {
          final t = match.first;
          _detail = ProgramDetail(
            id: t.id,
            name: t.name,
            code: t.code,
            description: t.description,
            disbursementCooldownDays: t.disbursementCooldownDays,
            canApply: t.canApply,
            applyBlockReason: t.applyBlockReason,
            applyBlockMessage: t.applyBlockMessage,
            cooldownRemainingDays: t.cooldownRemainingDays,
            eligibleAgainAt: t.eligibleAgainAt,
            lastClaimedAt: t.lastClaimedAt,
          );
          _bindProgram(programFromNestDetail(_detail!));
        }
      } catch (_) {}
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
      final offices = await svc.listRegions();
      if (offices.isEmpty) {
        throw Exception('No offices available — check Nest bootstrap seed');
      }
      // Prefer NCR regional office when present; else first office.
      final office = offices.firstWhere(
        (o) => o.name.toLowerCase().contains('ncr'),
        orElse: () => offices.first,
      );

      // Collect form values (controllers override map for text fields).
      final formData = <String, dynamic>{..._values};
      for (final e in _controllers.entries) {
        formData[e.key] = e.value.text;
      }

      await svc.createApplication(
        customerId: profile.id,
        regionId: office.id,
        templateId: program.id,
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
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Program')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final program = _program;
    if (program == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Program')),
        body: const Center(child: Text('Program not found')),
      );
    }

    // Block further steps while staff review is in progress.
    if (_isWaitingForReview) {
      return _ReviewPendingScreen(program: program);
    }

    // After approval, send beneficiary to the disbursement QR (gated there too).
    if (_isApprovedForDisbursement) {
      return _StageScaffold(
        program: program,
        activeType: 'disbursement',
        buttonLabel: 'Open disbursement QR',
        onButton: () =>
            context.push('/customer/programs/${program.id}/disbursement'),
        content: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_outline,
                  size: 48, color: AppColors.primary),
              const SizedBox(height: 16),
              Text(
                'Application approved',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              const Text(
                'Your application was approved. Open the disbursement QR '
                'to claim your grant with the social worker.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted, height: 1.4),
              ),
            ],
          ),
        ),
      );
    }

    // After claim: reinstate only when the program cooldown elapses.
    if (_isOnCooldown) {
      final detail = _detail!;
      final again = detail.eligibleAgainAt;
      final remaining = detail.cooldownRemainingDays;
      return Scaffold(
        appBar: AppBar(title: Text(program.code)),
        body: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            JourneyTracker(
              stages: program.stages,
              activeType: 'disbursement',
              completed: true,
            ),
            const SizedBox(height: 28),
            const Icon(Icons.hourglass_top_rounded,
                size: 52, color: AppColors.primary),
            const SizedBox(height: 16),
            Text(
              'Aid already claimed',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(
              detail.applyBlockMessage ??
                  'You claimed aid for this program. Apply again after the '
                      '${detail.disbursementCooldownDays}-day cooldown.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, height: 1.45),
            ),
            const SizedBox(height: 20),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.18),
                ),
              ),
              child: Column(
                children: [
                  Text(
                    again != null
                        ? 'Available again on ${_formatEligibleDate(again)}'
                        : 'Cooldown active',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                  if (remaining != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      '$remaining of ${detail.disbursementCooldownDays} days remaining',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (detail.lastClaimApplicationId != null) ...[
              const SizedBox(height: 20),
              OutlinedButton(
                onPressed: () => context.push(
                  '/application/${detail.lastClaimApplicationId}',
                ),
                child: const Text('View claimed application'),
              ),
            ],
          ],
        ),
      );
    }

    final step = program.steps.first;

    return Scaffold(
      appBar: AppBar(title: Text('Apply — ${program.code}')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
            child: JourneyTracker(stages: program.stages, activeType: 'form'),
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
class JourneyTracker extends StatelessWidget {
  const JourneyTracker({
    super.key,
    required this.stages,
    required this.activeType,
    this.completed = false,
  });

  final List<WorkflowStage> stages;
  final String activeType;
  /// When true (e.g. claimed), mark every stage as done.
  final bool completed;

  @override
  Widget build(BuildContext context) {
    final activeIndex = completed
        ? stages.length
        : stages.indexWhere((s) => s.type == activeType).clamp(0, stages.length);
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
              child: JourneyTracker(
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

/// Stage 3 — application submitted, waiting for staff review/approval.
class _ReviewPendingScreen extends StatelessWidget {
  const _ReviewPendingScreen({required this.program});

  final Program program;

  @override
  Widget build(BuildContext context) {
    return _StageScaffold(
      program: program,
      activeType: 'review',
      buttonLabel: 'Back to home',
      onButton: () => _goHome(context),
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
              'Your ${program.code} application is pending evaluation and '
              'approval. You cannot continue to disbursement until a staff '
              'approver marks it approved. Check My applications on Home for status.',
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
class DisbursementQrScreen extends ConsumerStatefulWidget {
  const DisbursementQrScreen({super.key, required this.programId});

  final String programId;

  @override
  ConsumerState<DisbursementQrScreen> createState() =>
      _DisbursementQrScreenState();
}

class _DisbursementQrScreenState extends ConsumerState<DisbursementQrScreen> {
  Program? _program;
  bool _loading = true;
  bool _approved = false;
  String? _blockReason;
  String? _claimPayload;
  String? _claimToken;
  String? _referenceNo;
  int? _queueNumber;
  bool _alreadyValidated = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_load());
    });
  }

  Future<void> _load() async {
    try {
      final catalog = programById(widget.programId);
      if (catalog != null) {
        _program = catalog;
      } else {
        final detail = await ref
            .read(applicationServiceProvider)
            .getProgram(widget.programId);
        _program = programFromNestDetail(detail);
      }

      final profile = await ref.read(currentProfileProvider.future);
      if (profile != null) {
        final svc = ref.read(applicationServiceProvider);
        final apps = await svc.listMyApplications(profile.id);
        final forProgram =
            apps.where((a) => a.templateId == widget.programId).toList();
        final approved = forProgram.where(
          (a) =>
              a.status == ApplicationStatus.approved,
        );
        _approved = approved.isNotEmpty;
        if (!_approved) {
          final latest = forProgram.isNotEmpty ? forProgram.first : null;
          _blockReason = latest == null
              ? 'No application found for this program yet.'
              : 'Your application is ${latest.status.label.toLowerCase()}. '
                  'Disbursement unlocks only after staff approval.';
        } else {
          final bookings = await svc.listMyBookings();
          final appIds = approved.map((a) => a.id).toSet();
          Map<String, dynamic>? match;
          for (final b in bookings) {
            final appId = b['application_id']?.toString();
            final status = b['status']?.toString();
            if (appId != null &&
                appIds.contains(appId) &&
                (status == 'booked' || status == 'completed')) {
              match = b;
              break;
            }
          }
          if (match == null) {
            _blockReason =
                'Schedule a disbursement slot first (Schedule), then return here for your unique claim QR.';
            _approved = false;
          } else {
            _claimPayload = match['claim_qr_payload']?.toString();
            _claimToken = match['claim_token']?.toString();
            _queueNumber = (match['queue_number'] as num?)?.toInt();
            _alreadyValidated = match['validated_at'] != null ||
                match['status']?.toString() == 'completed';
            final app = approved.firstWhere(
              (a) => a.id == match!['application_id']?.toString(),
              orElse: () => approved.first,
            );
            _referenceNo = app.referenceNo;
            if (_claimPayload == null || _claimPayload!.isEmpty) {
              _blockReason =
                  'Claim QR is not ready yet. Pull to refresh after booking.';
              _approved = false;
            }
          }
        }
      } else {
        _blockReason = 'Sign in required.';
      }
    } catch (e) {
      _blockReason = '$e';
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Disbursement')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    final program = _program;
    if (program == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Disbursement')),
        body: const Center(child: Text('Program not found')),
      );
    }

    if (!_approved) {
      return _StageScaffold(
        program: program,
        activeType: 'review',
        buttonLabel: 'Back to home',
        onButton: () => _goHome(context),
        content: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline, size: 48, color: AppColors.muted),
              const SizedBox(height: 16),
              Text(
                'Disbursement not available yet',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                _blockReason ??
                    'Wait until your application is approved by staff.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, height: 1.4),
              ),
            ],
          ),
        ),
      );
    }

    final payload = _claimPayload!;
    final shortToken = _claimToken != null && _claimToken!.length > 10
        ? '${_claimToken!.substring(0, 8)}…'
        : (_claimToken ?? '');

    return _StageScaffold(
      program: program,
      activeType: 'disbursement',
      buttonLabel: 'Back to home',
      onButton: () => _goHome(context),
      content: SingleChildScrollView(
        child: Column(
          children: [
            const SizedBox(height: 8),
            Text(
              _alreadyValidated
                  ? 'Claim already validated'
                  : 'Show this to the Office Admin',
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              _alreadyValidated
                  ? 'This unique claim QR was already scanned at the cash window.'
                  : 'Only the Office Admin at your scheduled cash window should scan this unique QR to confirm you are the rightful recipient.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, height: 1.4),
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
                  const Text(
                    'Application / queue',
                    style: TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (_referenceNo != null) _referenceNo!,
                      if (_queueNumber != null) 'Queue #$_queueNumber',
                    ].join(' · '),
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                      letterSpacing: 0.5,
                    ),
                  ),
                  if (shortToken.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Claim $shortToken',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
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
                    'This QR is unique to your booking. Do not share screenshots outside the cash window.',
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ),
              ],
            ),
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

/// File attachment field — opens the system picker and uploads to Nest.
class _FileUploadField extends ConsumerWidget {
  const _FileUploadField({
    required this.field,
    required this.fileName,
    required this.onPicked,
  });

  final ProgramField field;
  final String? fileName;
  final void Function(dynamic) onPicked;

  Future<String?> _pickAndUpload(BuildContext context, WidgetRef ref) async {
    PlatformFile? file;
    try {
      file = await pickDocumentFile();
    } catch (e) {
      if (!context.mounted) return null;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Bad state: ', ''))),
      );
      return null;
    }
    if (file == null) return null;
    if (file.path == null) {
      if (!context.mounted) return null;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not read the selected file.')),
      );
      return null;
    }
    try {
      final uploaded = await ref.read(applicationServiceProvider).uploadFile(
            filePath: file.path!,
            fileName: file.name,
          );
      final uri = uploaded['storage_uri']?.toString() ?? file.name;
      if (!context.mounted) return uri;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Uploaded ${file.name}')),
      );
      return uri;
    } catch (e) {
      if (!context.mounted) return null;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      return null;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final picked = fileName != null && fileName!.isNotEmpty;
    final displayName = picked
        ? (fileName!.contains('/') ? fileName!.split('/').last : fileName!)
        : null;
    return FormField<String>(
      key: ValueKey(fileName ?? field.key),
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
                      displayName ?? 'No file selected',
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
                    onPressed: () async {
                      final uri = await _pickAndUpload(context, ref);
                      if (uri == null) return;
                      onPicked(uri);
                      formState.didChange(uri);
                    },
                    icon: Icon(
                      picked ? Icons.check : Icons.attach_file,
                      size: 18,
                    ),
                    label: Text(picked ? 'Replace' : 'Attach'),
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
