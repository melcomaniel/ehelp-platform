import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../models/application.dart';
import '../../../providers/auth_provider.dart';
import '../../../theme/app_theme.dart';
import '../../customer/data/program_catalog.dart';
import '../../customer/screens/program_apply_screen.dart';
import '../../shared/widgets/common_widgets.dart';

class ApplicationDetailScreen extends ConsumerStatefulWidget {
  const ApplicationDetailScreen({super.key, required this.applicationId});

  final String applicationId;

  @override
  ConsumerState<ApplicationDetailScreen> createState() =>
      _ApplicationDetailScreenState();
}

class _ApplicationDetailScreenState
    extends ConsumerState<ApplicationDetailScreen> {
  Application? _app;
  String? _error;
  bool _loading = true;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    _poll = Timer.periodic(const Duration(seconds: 8), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) setState(() => _loading = true);
    try {
      final app = await ref
          .read(applicationServiceProvider)
          .getApplication(widget.applicationId);
      if (!mounted) return;
      setState(() {
        _app = app;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _app == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Application')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null && _app == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Application')),
        body: Center(child: Text(_error!)),
      );
    }
    final app = _app!;
    final stages = (app.stages ?? const <Map<String, dynamic>>[])
        .map(
          (s) => WorkflowStage(
            name: '${s['name'] ?? s['type'] ?? 'Step'}',
            type: '${s['type'] ?? 'form'}',
          ),
        )
        .toList();
    final effectiveStages = stages.isNotEmpty
        ? stages
        : const [
            WorkflowStage(name: 'Application Form', type: 'form'),
            WorkflowStage(name: 'Face Verification', type: 'verify'),
            WorkflowStage(name: 'Review', type: 'review'),
            WorkflowStage(name: 'Disbursement', type: 'disbursement'),
          ];
    final activeType = app.currentStageType ?? 'review';
    final fields = app.formFields ?? const <Map<String, dynamic>>[];
    final claim = app.disbursementClaim;
    final booking = app.disbursementBooking;
    final complete = app.isDisbursementComplete;

    return Scaffold(
      appBar: AppBar(
        title: Text(app.referenceNo),
        actions: [
          IconButton(
            onPressed: () => _load(),
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh status',
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            app.templateName ?? 'Program',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          StatusBadge(
            label: app.status.label,
            color: statusColor(app.status.value),
          ),
          const SizedBox(height: 16),
          JourneyTracker(
            stages: effectiveStages,
            activeType: activeType,
            completed: complete,
          ),
          const SizedBox(height: 8),
          Text(
            app.answersLocked
                ? 'Submitted answers are locked — they cannot be changed or discarded.'
                : 'Draft — you can still edit before submit.',
            style: const TextStyle(color: AppColors.muted, fontSize: 12, height: 1.35),
          ),
          if (app.status == ApplicationStatus.submitted ||
              app.status == ApplicationStatus.underReview ||
              app.status == ApplicationStatus.recommended)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text(
                'Waiting for staff review. Disbursement unlocks after approval.',
                style: TextStyle(color: AppColors.muted, height: 1.4),
              ),
            ),
          if (app.status == ApplicationStatus.approved && !complete) ...[
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => context.push('/customer/schedule'),
              icon: const Icon(Icons.event_available),
              label: const Text('Schedule disbursement'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => context.push(
                '/customer/programs/${app.templateId}/disbursement',
              ),
              icon: const Icon(Icons.qr_code_2),
              label: const Text('Open disbursement QR'),
            ),
          ],
          if (complete) ...[
            const SizedBox(height: 20),
            Text(
              'Disbursement completed',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.forest.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.forest.withValues(alpha: 0.25),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Your aid was claimed at the cash window. This application is complete.',
                    style: TextStyle(height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  _row(
                    'Claimed at',
                    claim?.claimedAt != null
                        ? DateFormat.yMMMd().add_jm().format(claim!.claimedAt!)
                        : booking?.validatedAt != null
                            ? DateFormat.yMMMd()
                                .add_jm()
                                .format(booking!.validatedAt!)
                            : '—',
                  ),
                  _row(
                    'Queue #',
                    '${claim?.queueNumber ?? booking?.queueNumber ?? '—'}',
                  ),
                  _row(
                    'Slot',
                    _formatSlotRange(
                      claim?.slotStartsAt ?? booking?.slotStartsAt,
                      claim?.slotEndsAt ?? booking?.slotEndsAt,
                    ),
                  ),
                  _row(
                    'Site',
                    [
                      claim?.siteName ?? booking?.siteName,
                      claim?.siteAddress ?? booking?.siteAddress,
                    ].where((s) => s != null && s.trim().isNotEmpty).join(' — ').ifEmpty('—'),
                  ),
                  _row(
                    'Face liveness',
                    claim?.faceLivenessPassed == true
                        ? 'Verified at cash window'
                        : 'Recorded',
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 24),
          Text('Your submission', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (fields.isEmpty && app.formData.isEmpty)
            const Text('No answers recorded.', style: TextStyle(color: AppColors.muted))
          else if (fields.isNotEmpty)
            ...fields.map((f) {
              final key = '${f['key']}';
              final label = '${f['label'] ?? key}';
              final raw = app.formData[key];
              return _row(label, raw == null || raw == '' ? '—' : '$raw');
            })
          else
            ...app.formData.entries.map(
              (e) => _row(e.key, e.value == null ? '—' : '${e.value}'),
            ),
          const SizedBox(height: 16),
          _row('Submitted', app.submittedAt != null
              ? DateFormat.yMMMd().add_jm().format(app.submittedAt!)
              : '—'),
          _row('Evaluator notes', app.evaluatorNotes ?? '—'),
          _row('Approver notes', app.approverNotes ?? '—'),
        ],
      ),
    );
  }

  String _formatSlotRange(DateTime? start, DateTime? end) {
    if (start == null && end == null) return '—';
    final fmt = DateFormat.yMMMd().add_jm();
    if (start != null && end != null) {
      return '${fmt.format(start)} → ${fmt.format(end)}';
    }
    return fmt.format(start ?? end!);
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
        ],
      ),
    );
  }
}

extension on String {
  String ifEmpty(String fallback) => trim().isEmpty ? fallback : this;
}
