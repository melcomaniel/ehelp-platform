import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../models/application.dart';
import '../../../providers/auth_provider.dart';
import '../../../theme/app_theme.dart';
import '../../shared/widgets/app_confirm_dialog.dart';
import '../../shared/widgets/common_widgets.dart';

final approverQueueProvider =
    FutureProvider.autoDispose<List<Application>>((ref) async {
  final profile = await ref.watch(currentProfileProvider.future);
  if (profile?.regionId == null) return [];
  return ref.watch(applicationServiceProvider).listRegionQueue(
        regionId: profile!.regionId!,
        statuses: ['submitted', 'under_review', 'recommended'],
      );
});

final approverRecommendationsProvider =
    FutureProvider.autoDispose<List<Recommendation>>((ref) async {
  final profile = await ref.watch(currentProfileProvider.future);
  if (profile?.regionId == null) return [];
  return ref
      .watch(applicationServiceProvider)
      .listPendingRecommendations(profile!.regionId!);
});

class ApproverHomeScreen extends ConsumerWidget {
  const ApproverHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(currentProfileProvider);
    final queueAsync = ref.watch(approverQueueProvider);
    final recsAsync = ref.watch(approverRecommendationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Approver'),
        actions: [
          IconButton(
            onPressed: () async {
              if (await confirmSignOut(context)) {
                ref.read(authControllerProvider.notifier).signOut();
              }
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (profile) {
          if (profile?.regionId == null) {
            return const EmptyState(
              icon: Icons.map_outlined,
              title: 'Region not assigned',
              subtitle: 'Ask Satellite Admin to assign your region.',
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(approverQueueProvider);
              ref.invalidate(approverRecommendationsProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  'Approval desk',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 6),
                const Text(
                  'Approve or decline applications and act on evaluator recommendations. No template or RBAC editing rights.',
                  style: TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 24),
                const SectionHeader(title: 'Priority recommendations'),
                const SizedBox(height: 12),
                recsAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text('$e'),
                  data: (recs) {
                    if (recs.isEmpty) {
                      return const Text(
                        'No pending recommendations.',
                        style: TextStyle(color: AppColors.muted),
                      );
                    }
                    return Column(
                      children: recs
                          .map(
                            (r) => Card(
                              margin: const EdgeInsets.only(bottom: 10),
                              child: ListTile(
                                title: Text(
                                  r.application?.customerName ??
                                      r.applicationId,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                subtitle: Text(r.rationale ?? 'No rationale'),
                                trailing: StatusBadge(
                                  label: r.priority.label,
                                  color: priorityColor(r.priority.value),
                                ),
                                onTap: () => context.push(
                                  '/approver/case/${r.applicationId}',
                                  extra: r.id,
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    );
                  },
                ),
                const SizedBox(height: 28),
                const SectionHeader(title: 'Approval queue'),
                const SizedBox(height: 12),
                queueAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text('$e'),
                  data: (apps) {
                    if (apps.isEmpty) {
                      return const EmptyState(
                        icon: Icons.task_alt,
                        title: 'Queue is clear',
                      );
                    }
                    return Column(
                      children: apps
                          .map(
                            (app) => Card(
                              margin: const EdgeInsets.only(bottom: 10),
                              child: ListTile(
                                title: Text(
                                  app.customerName ?? 'Customer',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                subtitle: Text(
                                  '${app.referenceNo}\n${app.templateName ?? ''}',
                                ),
                                isThreeLine: true,
                                trailing: StatusBadge(
                                  label: app.status.label,
                                  color: statusColor(app.status.value),
                                ),
                                onTap: () =>
                                    context.push('/approver/case/${app.id}'),
                              ),
                            ),
                          )
                          .toList(),
                    );
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class ApproverCaseScreen extends ConsumerStatefulWidget {
  const ApproverCaseScreen({
    super.key,
    required this.applicationId,
    this.recommendationId,
  });

  final String applicationId;
  final String? recommendationId;

  @override
  ConsumerState<ApproverCaseScreen> createState() => _ApproverCaseScreenState();
}

class _ApproverCaseScreenState extends ConsumerState<ApproverCaseScreen> {
  final _notes = TextEditingController();
  final _amount = TextEditingController();
  Application? _app;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final app = await ref
        .read(applicationServiceProvider)
        .getApplication(widget.applicationId);
    if (!mounted) return;
    setState(() {
      _app = app;
      _amount.text = (app.amountRequested ?? '').toString();
    });
  }

  @override
  void dispose() {
    _notes.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _decide(bool approve) async {
    final confirmed = await showAppConfirm(
      context,
      title: approve ? 'Approve application?' : 'Decline application?',
      description: approve
          ? 'The customer will be notified and the approved amount moves forward for disbursement.'
          : 'This decision is final. The customer will be notified that their application was declined.',
      confirmLabel: approve ? 'Approve' : 'Decline',
      destructive: !approve,
    );
    if (!confirmed || !mounted) return;

    final profile = await ref.read(currentProfileProvider.future);
    if (profile == null) return;
    setState(() => _loading = true);
    try {
      final svc = ref.read(applicationServiceProvider);
      await svc.decideApplication(
        id: widget.applicationId,
        approverId: profile.id,
        approve: approve,
        notes: _notes.text.trim(),
        amountApproved:
            approve ? double.tryParse(_amount.text.trim()) : null,
      );
      if (widget.recommendationId != null) {
        await svc.markRecommendationActedOn(
          recommendationId: widget.recommendationId!,
          actorId: profile.id,
        );
      }
      ref.invalidate(approverQueueProvider);
      ref.invalidate(approverRecommendationsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(approve ? 'Application approved' : 'Application declined'),
        ),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = _app;
    return Scaffold(
      appBar: AppBar(title: Text(app?.referenceNo ?? 'Review')),
      body: app == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  app.customerName ?? 'Customer',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                Text(app.templateName ?? '', style: const TextStyle(color: AppColors.muted)),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  children: [
                    StatusBadge(
                      label: app.status.label,
                      color: statusColor(app.status.value),
                    ),
                    StatusBadge(
                      label: app.priority.label,
                      color: priorityColor(app.priority.value),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text('Requested: ${app.amountRequested ?? '—'}'),
                Text('Evaluator notes: ${app.evaluatorNotes ?? '—'}'),
                Text('Reason: ${app.formData['reason'] ?? '—'}'),
                const SizedBox(height: 16),
                TextField(
                  controller: _amount,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Amount to approve'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _notes,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Approver notes'),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _loading || app.status.isTerminal
                      ? null
                      : () => _decide(true),
                  child: const Text('Approve'),
                ),
                const SizedBox(height: 10),
                OutlinedButton(
                  onPressed: _loading || app.status.isTerminal
                      ? null
                      : () => _decide(false),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: const BorderSide(color: AppColors.danger),
                  ),
                  child: const Text('Decline'),
                ),
              ],
            ),
    );
  }
}
