import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../models/application.dart';
import '../../../providers/auth_provider.dart';
import '../../../services/liveness_service.dart';
import '../../../theme/app_theme.dart';
import '../../liveness/screens/face_liveness_screen.dart';
import '../../shared/widgets/common_widgets.dart';

final evaluatorQueueProvider =
    FutureProvider.autoDispose<List<Application>>((ref) async {
  final profile = await ref.watch(currentProfileProvider.future);
  if (profile?.regionId == null) return [];
  return ref.watch(applicationServiceProvider).listRegionQueue(
        regionId: profile!.regionId!,
        statuses: ['submitted', 'under_review', 'draft', 'recommended'],
      );
});

class EvaluatorHomeScreen extends ConsumerWidget {
  const EvaluatorHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(currentProfileProvider);
    final queueAsync = ref.watch(evaluatorQueueProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Evaluator'),
        actions: [
          IconButton(
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/evaluator/register-customer'),
        backgroundColor: AppColors.clay,
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('Register customer'),
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (profile) {
          if (profile?.regionId == null) {
            return const EmptyState(
              icon: Icons.map_outlined,
              title: 'Region not assigned',
              subtitle:
                  'Ask Satellite Admin to assign your region before evaluating cases.',
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(evaluatorQueueProvider),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  'Case queue',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 6),
                const Text(
                  'Register customers, submit applications, and set recommendation priority.',
                  style: TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: () => context.push('/evaluator/apply-for-customer'),
                  icon: const Icon(Icons.note_add_outlined),
                  label: const Text('Apply for customer'),
                ),
                const SizedBox(height: 20),
                queueAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text('$e'),
                  data: (apps) {
                    if (apps.isEmpty) {
                      return const EmptyState(
                        icon: Icons.inbox_outlined,
                        title: 'No cases in region queue',
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
                                  '${app.referenceNo}\n${app.templateName ?? 'Program'}',
                                ),
                                isThreeLine: true,
                                trailing: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    StatusBadge(
                                      label: app.status.label,
                                      color: statusColor(app.status.value),
                                    ),
                                    const SizedBox(height: 4),
                                    StatusBadge(
                                      label: app.priority.label,
                                      color: priorityColor(app.priority.value),
                                    ),
                                  ],
                                ),
                                onTap: () =>
                                    context.push('/evaluator/case/${app.id}'),
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

class RegisterCustomerScreen extends ConsumerStatefulWidget {
  const RegisterCustomerScreen({super.key});

  @override
  ConsumerState<RegisterCustomerScreen> createState() =>
      _RegisterCustomerScreenState();
}

class _RegisterCustomerScreenState
    extends ConsumerState<RegisterCustomerScreen> {
  final _email = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _idType = TextEditingController(text: 'PhilSys');
  final _idNumber = TextEditingController();
  final _tempPassword = TextEditingController(text: 'TempPass123!');
  FaceLivenessOutcome? _liveness;
  bool _loading = false;

  @override
  void dispose() {
    _email.dispose();
    _name.dispose();
    _phone.dispose();
    _idType.dispose();
    _idNumber.dispose();
    _tempPassword.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(supabaseClientProvider);
      final response = await client.functions.invoke(
        'register-customer',
        body: {
          'email': _email.text.trim(),
          'password': _tempPassword.text,
          'full_name': _name.text.trim(),
          'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
          'id_type': _idType.text.trim(),
          'id_number': _idNumber.text.trim(),
          'face_scan_verified': false,
        },
      );

      final data = response.data;
      if (data is Map && data['error'] != null) {
        throw Exception(data['error']);
      }

      final userId = data is Map ? data['user_id'] as String? : null;
      if (userId == null) throw Exception('Customer created without user id');

      if (!mounted) return;
      final outcome = await FaceLivenessScreen.open(
        context,
        purpose: LivenessPurpose.registration,
        userId: userId,
        title: 'Customer face registration',
        subtitle:
            'Capture live face for this customer. Must be SUCCEEDED with confidence ≥ 95.',
      );

      if (outcome?.passed != true) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Customer created ($userId) but face verification is still pending.',
            ),
          ),
        );
        context.pop();
        return;
      }

      setState(() => _liveness = outcome);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Customer registered & face verified ($userId, ${outcome!.confidenceScore.toStringAsFixed(1)})',
          ),
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
    return Scaffold(
      appBar: AppBar(title: const Text('Register customer')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Capture ID records, then run Face Liveness. Customer gets a temporary password.',
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Full name'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _email,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phone,
            decoration: const InputDecoration(labelText: 'Phone'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _idType,
            decoration: const InputDecoration(labelText: 'ID type'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _idNumber,
            decoration: const InputDecoration(labelText: 'ID number'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _tempPassword,
            decoration: const InputDecoration(labelText: 'Temporary password'),
          ),
          if (_liveness?.passed == true) ...[
            const SizedBox(height: 12),
            StatusBadge(
              label:
                  'Face verified ${_liveness!.confidenceScore.toStringAsFixed(1)}',
              color: AppColors.forest,
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _loading ? null : _register,
            child: const Text('Create account + face verify'),
          ),
        ],
      ),
    );
  }
}

class ApplyForCustomerScreen extends ConsumerStatefulWidget {
  const ApplyForCustomerScreen({super.key});

  @override
  ConsumerState<ApplyForCustomerScreen> createState() =>
      _ApplyForCustomerScreenState();
}

class _ApplyForCustomerScreenState
    extends ConsumerState<ApplyForCustomerScreen> {
  final _customerId = TextEditingController();
  final _amount = TextEditingController();
  final _reason = TextEditingController();
  String? _templateId;
  List<ProgramTemplate> _templates = [];
  FaceLivenessOutcome? _liveness;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final templates =
        await ref.read(applicationServiceProvider).listTemplates();
    if (!mounted) return;
    setState(() {
      _templates = templates;
      _templateId = templates.isNotEmpty ? templates.first.id : null;
    });
  }

  @override
  void dispose() {
    _customerId.dispose();
    _amount.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _runLiveness() async {
    final customerId = _customerId.text.trim();
    if (customerId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter customer user ID first')),
      );
      return;
    }
    final outcome = await FaceLivenessScreen.open(
      context,
      purpose: LivenessPurpose.application,
      userId: customerId,
      title: 'Customer face check',
      subtitle:
          'Customer must complete face liveness for this application (SUCCEEDED ≥ 95).',
    );
    if (!mounted) return;
    if (outcome?.passed == true) {
      setState(() => _liveness = outcome);
    }
  }

  Future<void> _submit() async {
    final evaluator = await ref.read(currentProfileProvider.future);
    if (evaluator?.regionId == null || _templateId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Region and template required')),
      );
      return;
    }

    if (_liveness?.passed != true) {
      await _runLiveness();
      if (_liveness?.passed != true) return;
    }

    setState(() => _loading = true);
    try {
      await ref.read(applicationServiceProvider).createApplication(
            customerId: _customerId.text.trim(),
            regionId: evaluator!.regionId!,
            templateId: _templateId!,
            submittedBy: evaluator.id,
            amountRequested: double.tryParse(_amount.text.trim()),
            formData: {'reason': _reason.text.trim(), 'via': 'evaluator'},
            submit: true,
            livenessSessionToken: _liveness!.sessionToken,
            livenessStatus: 'succeeded',
            livenessConfidence: _liveness!.confidenceScore,
            livenessReferenceImageUrl: _liveness!.referenceImageUrl,
          );
      ref.invalidate(evaluatorQueueProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Application submitted for review')),
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
    return Scaffold(
      appBar: AppBar(title: const Text('Apply for customer')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(
            controller: _customerId,
            decoration: const InputDecoration(
              labelText: 'Customer user ID',
              helperText: 'UUID of registered customer',
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _templateId,
            decoration: const InputDecoration(labelText: 'Program'),
            items: _templates
                .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                .toList(),
            onChanged: (v) => setState(() => _templateId = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Amount'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reason,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Case notes'),
          ),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              leading: Icon(
                _liveness?.passed == true
                    ? Icons.verified_user
                    : Icons.face_retouching_natural,
                color: _liveness?.passed == true
                    ? AppColors.forest
                    : AppColors.clay,
              ),
              title: Text(
                _liveness?.passed == true
                    ? 'Face verified (${_liveness!.confidenceScore.toStringAsFixed(1)})'
                    : 'Face verification required',
              ),
              trailing: TextButton(
                onPressed: _loading ? null : _runLiveness,
                child: Text(_liveness?.passed == true ? 'Re-scan' : 'Verify'),
              ),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _loading ? null : _submit,
            child: const Text('Submit application'),
          ),
        ],
      ),
    );
  }
}

class EvaluatorCaseScreen extends ConsumerStatefulWidget {
  const EvaluatorCaseScreen({super.key, required this.applicationId});

  final String applicationId;

  @override
  ConsumerState<EvaluatorCaseScreen> createState() =>
      _EvaluatorCaseScreenState();
}

class _EvaluatorCaseScreenState extends ConsumerState<EvaluatorCaseScreen> {
  RecommendationPriority _priority = RecommendationPriority.medium;
  final _notes = TextEditingController();
  bool _loading = false;
  Application? _app;

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
      _priority = app.priority;
      _notes.text = app.evaluatorNotes ?? '';
    });
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _recommend() async {
    final profile = await ref.read(currentProfileProvider.future);
    if (profile == null) return;
    setState(() => _loading = true);
    try {
      await ref.read(applicationServiceProvider).addRecommendation(
            applicationId: widget.applicationId,
            recommendedBy: profile.id,
            priority: _priority,
            rationale: _notes.text.trim(),
          );
      ref.invalidate(evaluatorQueueProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Recommendation submitted to approver')),
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
      appBar: AppBar(title: Text(app?.referenceNo ?? 'Case')),
      body: app == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  app.customerName ?? 'Customer',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 4),
                Text(app.templateName ?? '', style: const TextStyle(color: AppColors.muted)),
                const SizedBox(height: 12),
                StatusBadge(
                  label: app.status.label,
                  color: statusColor(app.status.value),
                ),
                const SizedBox(height: 16),
                Text('Amount: ${app.amountRequested ?? '—'}'),
                Text('Reason: ${app.formData['reason'] ?? '—'}'),
                const SizedBox(height: 20),
                const Text(
                  'Recommendation priority',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                ...RecommendationPriority.values.map(
                  (p) => RadioListTile<RecommendationPriority>(
                    value: p,
                    groupValue: _priority,
                    title: Text(p.label),
                    onChanged: (v) => setState(() => _priority = v ?? _priority),
                  ),
                ),
                TextField(
                  controller: _notes,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Rationale'),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _loading ? null : _recommend,
                  child: const Text('Submit recommendation'),
                ),
              ],
            ),
    );
  }
}
