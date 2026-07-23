import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../models/application.dart';
import '../../../models/profile.dart';
import '../../../providers/auth_provider.dart';
import '../../../theme/app_theme.dart';
import '../../liveness/screens/face_liveness_screen.dart';
import '../../shared/widgets/app_confirm_dialog.dart';
import '../../shared/widgets/common_widgets.dart';
import '../../../services/liveness_service.dart';
import '../data/program_catalog.dart';

final myApplicationsProvider = FutureProvider.autoDispose<List<Application>>((ref) async {
  final profile = await ref.watch(currentProfileProvider.future);
  if (profile == null) return [];
  return ref
      .watch(applicationServiceProvider)
      .listMyApplications(profile.id);
});

final myDependentsProvider = FutureProvider.autoDispose<List<DependentLink>>((ref) async {
  final profile = await ref.watch(currentProfileProvider.future);
  if (profile == null) return [];
  return ref.watch(applicationServiceProvider).listDependents(profile.id);
});

class CustomerHomeScreen extends ConsumerWidget {
  const CustomerHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(currentProfileProvider);
    final appsAsync = ref.watch(myApplicationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Image.asset(
          'lib/assets/heart-egov-letter.png',
          height: 30,
          fit: BoxFit.contain,
          color: AppColors.primary,
          colorBlendMode: BlendMode.srcIn,
        ),
        actions: [
          IconButton(
            tooltip: 'Profile',
            onPressed: () => context.push('/customer/profile'),
            icon: const Icon(Icons.person_outline),
          ),
          IconButton(
            tooltip: 'Sign out',
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
          if (profile == null) {
            return const EmptyState(
              icon: Icons.person_off_outlined,
              title: 'No profile found',
            );
          }
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(myApplicationsProvider);
              ref.invalidate(currentProfileProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  // Demo: greet the AKAP applicant persona regardless of the
                  // signed-in profile name.
                  'Hello, Mario',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 6),
                const Text(
                  'Choose a program to apply, or track your existing applications.',
                  style: TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 24),
                const SectionHeader(title: 'Programs'),
                const SizedBox(height: 12),
                ...kPrograms.map(
                  (p) => _ProgramCard(
                    program: p,
                    onTap: () => context.push('/customer/programs/${p.id}'),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: _QuickTile(
                        icon: Icons.account_balance_wallet_outlined,
                        label: 'Disbursement',
                        onTap: () => context.push('/customer/disbursement'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _QuickTile(
                        icon: Icons.family_restroom_outlined,
                        label: 'Dependents',
                        onTap: () => context.push('/customer/dependents'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 28),
                const SectionHeader(title: 'My applications'),
                const SizedBox(height: 12),
                appsAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (e, _) => Text('$e'),
                  data: (apps) {
                    if (apps.isEmpty) {
                      return const EmptyState(
                        icon: Icons.description_outlined,
                        title: 'No applications yet',
                        subtitle: 'Tap Apply to start a new request.',
                      );
                    }
                    return Column(
                      children: apps
                          .map((app) => _ApplicationCard(app: app))
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

class _QuickTile extends StatelessWidget {
  const _QuickTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.line),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Icon(icon, color: AppColors.ocean),
              const SizedBox(height: 8),
              Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProgramCard extends StatelessWidget {
  const _ProgramCard({required this.program, required this.onTap});

  final Program program;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: program.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(program.icon, color: program.color),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            program.code,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      program.name,
                      style: const TextStyle(
                        color: AppColors.ink,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      program.tagline,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

class _ApplicationCard extends StatelessWidget {
  const _ApplicationCard({required this.app});

  final Application app;

  @override
  Widget build(BuildContext context) {
    final date = app.createdAt != null
        ? DateFormat.yMMMd().format(app.createdAt!)
        : '—';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        title: Text(
          app.templateName ?? 'Application',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(app.referenceNo, style: const TextStyle(color: AppColors.muted)),
              Text(date, style: const TextStyle(color: AppColors.muted)),
            ],
          ),
        ),
        trailing: StatusBadge(
          label: app.status.label,
          color: statusColor(app.status.value),
        ),
        onTap: () => context.push('/application/${app.id}'),
      ),
    );
  }
}

class ApplyScreen extends ConsumerStatefulWidget {
  const ApplyScreen({super.key});

  @override
  ConsumerState<ApplyScreen> createState() => _ApplyScreenState();
}

class _ApplyScreenState extends ConsumerState<ApplyScreen> {
  String? _templateId;
  String? _regionId;
  final _amount = TextEditingController();
  final _reason = TextEditingController();
  bool _loading = false;
  List<ProgramTemplate> _templates = [];
  List<Region> _regions = [];

  FaceLivenessOutcome? _liveness;

  @override
  void initState() {
    super.initState();
    _loadLookups();
  }

  Future<void> _loadLookups() async {
    final svc = ref.read(applicationServiceProvider);
    final templates = await svc.listTemplates();
    final regions = await svc.listRegions();
    if (!mounted) return;
    setState(() {
      _templates = templates;
      _regions = regions;
      _templateId = templates.isNotEmpty ? templates.first.id : null;
      _regionId = regions.isNotEmpty ? regions.first.id : null;
    });
  }

  @override
  void dispose() {
    _amount.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _runLiveness() async {
    final outcome = await FaceLivenessScreen.open(
      context,
      purpose: LivenessPurpose.application,
      title: 'Verify face for application',
      subtitle:
          'Each application requires a fresh face liveness check (SUCCEEDED, confidence ≥ 95).',
    );
    if (!mounted) return;
    if (outcome?.passed == true) {
      setState(() => _liveness = outcome);
    }
  }

  Future<void> _submit({required bool asDraft}) async {
    final profile = await ref.read(currentProfileProvider.future);
    if (profile == null || _templateId == null || _regionId == null) return;

    if (!asDraft && _liveness?.passed != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Complete face verification before submitting.'),
        ),
      );
      await _runLiveness();
      if (_liveness?.passed != true) return;
    }

    setState(() => _loading = true);
    try {
      final amount = double.tryParse(_amount.text.trim());
      await ref.read(applicationServiceProvider).createApplication(
            customerId: profile.id,
            regionId: _regionId!,
            templateId: _templateId!,
            amountRequested: amount,
            formData: {'reason': _reason.text.trim()},
            submit: !asDraft,
            livenessSessionToken: _liveness?.sessionToken,
            livenessStatus:
                _liveness?.passed == true ? 'succeeded' : null,
            livenessConfidence: _liveness?.confidenceScore,
            livenessReferenceImageUrl: _liveness?.referenceImageUrl,
          );
      ref.invalidate(myApplicationsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(asDraft ? 'Draft saved' : 'Application submitted'),
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
      appBar: AppBar(title: const Text('New application')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          DropdownButtonFormField<String>(
            initialValue: _templateId,
            decoration: const InputDecoration(labelText: 'Program'),
            items: _templates
                .map(
                  (t) => DropdownMenuItem(value: t.id, child: Text(t.name)),
                )
                .toList(),
            onChanged: (v) => setState(() => _templateId = v),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _regionId,
            decoration: const InputDecoration(labelText: 'Region'),
            items: _regions
                .map(
                  (r) => DropdownMenuItem(
                    value: r.id,
                    child: Text('${r.code} — ${r.name}'),
                  ),
                )
                .toList(),
            onChanged: (v) => setState(() => _regionId = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Amount requested'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reason,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Reason / narrative'),
          ),
          const SizedBox(height: 16),
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
              subtitle: const Text(
                'Required for every application submission',
              ),
              trailing: TextButton(
                onPressed: _loading ? null : _runLiveness,
                child: Text(_liveness?.passed == true ? 'Re-scan' : 'Verify'),
              ),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _loading ? null : () => _submit(asDraft: false),
            child: const Text('Submit for review'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: _loading ? null : () => _submit(asDraft: true),
            child: const Text('Save as draft'),
          ),
        ],
      ),
    );
  }
}

class DisbursementScreen extends ConsumerStatefulWidget {
  const DisbursementScreen({super.key});

  @override
  ConsumerState<DisbursementScreen> createState() => _DisbursementScreenState();
}

class _DisbursementScreenState extends ConsumerState<DisbursementScreen> {
  DisbursementMethod? _method;
  final _details = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _details.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(currentProfileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Disbursement preference')),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (profile) {
          _method ??= profile?.disbursementPreference ?? DisbursementMethod.cash;
          if (_details.text.isEmpty &&
              profile?.disbursementDetails['account'] != null) {
            _details.text = profile!.disbursementDetails['account'].toString();
          }

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const Text(
                'Choose how you prefer to receive assistance. Cooldown rules apply per program template.',
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 16),
              ...DisbursementMethod.values.map(
                (m) => RadioListTile<DisbursementMethod>(
                  value: m,
                  groupValue: _method,
                  title: Text(m.label),
                  onChanged: (v) => setState(() => _method = v),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _details,
                decoration: const InputDecoration(
                  labelText: 'Account / wallet details',
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading
                    ? null
                    : () async {
                        setState(() => _loading = true);
                        try {
                          await ref.read(authServiceProvider).updateProfile({
                            'disbursement_preference': _method?.value,
                            'disbursement_details': {
                              'account': _details.text.trim(),
                            },
                          });
                          ref.invalidate(currentProfileProvider);
                          if (!mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Preference saved')),
                          );
                          context.pop();
                        } catch (e) {
                          if (!mounted) return;
                          ScaffoldMessenger.of(context)
                              .showSnackBar(SnackBar(content: Text('$e')));
                        } finally {
                          if (mounted) setState(() => _loading = false);
                        }
                      },
                child: const Text('Save preference'),
              ),
            ],
          );
        },
      ),
    );
  }
}

class DependentsScreen extends ConsumerStatefulWidget {
  const DependentsScreen({super.key});

  @override
  ConsumerState<DependentsScreen> createState() => _DependentsScreenState();
}

class _DependentsScreenState extends ConsumerState<DependentsScreen> {
  final _dependentId = TextEditingController();
  String _relationship = 'child';
  bool _notarized = false;
  bool _saving = false;

  @override
  void dispose() {
    _dependentId.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final profile = await ref.read(currentProfileProvider.future);
    if (profile == null) return;
    final depId = _dependentId.text.trim();
    if (depId.isEmpty) return;

    setState(() => _saving = true);
    try {
      await ref.read(applicationServiceProvider).registerDependent(
            principalId: profile.id,
            dependentId: depId,
            relationship: _relationship,
            isNotarized: _notarized,
            notes: 'Pending account validation before activation',
          );
      ref.invalidate(myDependentsProvider);
      _dependentId.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Dependent linked. Must be validated before activation.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final depsAsync = ref.watch(myDependentsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Dependents / Guarantors')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Register a dependent or guarantor. Access requires a notarized authorization letter and validated account.',
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _dependentId,
            decoration: const InputDecoration(
              labelText: 'Dependent user ID (UUID)',
              helperText: 'User must already have an EHELP account',
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _relationship,
            decoration: const InputDecoration(labelText: 'Relationship'),
            items: const [
              DropdownMenuItem(value: 'spouse', child: Text('Spouse')),
              DropdownMenuItem(value: 'child', child: Text('Child')),
              DropdownMenuItem(value: 'parent', child: Text('Parent')),
              DropdownMenuItem(value: 'sibling', child: Text('Sibling')),
              DropdownMenuItem(value: 'guardian', child: Text('Guardian')),
              DropdownMenuItem(value: 'guarantor', child: Text('Guarantor')),
              DropdownMenuItem(value: 'other', child: Text('Other')),
            ],
            onChanged: (v) => setState(() => _relationship = v ?? _relationship),
          ),
          SwitchListTile(
            title: const Text('Notarized authorization letter on file'),
            value: _notarized,
            onChanged: (v) => setState(() => _notarized = v),
          ),
          FilledButton(
            onPressed: _saving ? null : _add,
            child: const Text('Link dependent'),
          ),
          const SizedBox(height: 28),
          const SectionHeader(title: 'Linked people'),
          const SizedBox(height: 12),
          depsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text('$e'),
            data: (deps) {
              if (deps.isEmpty) {
                return const EmptyState(
                  icon: Icons.group_off_outlined,
                  title: 'No dependents linked',
                );
              }
              return Column(
                children: deps
                    .map(
                      (d) => Card(
                        child: ListTile(
                          title: Text(d.dependentName ?? d.dependentId),
                          subtitle: Text(
                            '${d.relationship} · ${d.isValidated ? 'Validated' : 'Pending validation'}',
                          ),
                          trailing: StatusBadge(
                            label: d.isValidated ? 'Active' : 'Pending',
                            color: d.isValidated
                                ? AppColors.forest
                                : AppColors.clay,
                          ),
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
  }
}

class CustomerProfileScreen extends ConsumerStatefulWidget {
  const CustomerProfileScreen({super.key});

  @override
  ConsumerState<CustomerProfileScreen> createState() =>
      _CustomerProfileScreenState();
}

class _CustomerProfileScreenState extends ConsumerState<CustomerProfileScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _idType = TextEditingController();
  final _idNumber = TextEditingController();
  bool _loading = false;
  bool _seeded = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _idType.dispose();
    _idNumber.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _loading = true);
    try {
      await ref.read(authServiceProvider).updateProfile({
        'full_name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'id_type': _idType.text.trim(),
        'id_number': _idNumber.text.trim(),
      });
      ref.invalidate(currentProfileProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(currentProfileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My records')),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (profile) {
          if (profile != null && !_seeded) {
            _name.text = profile.fullName;
            _phone.text = profile.phone ?? '';
            _idType.text = profile.idType ?? '';
            _idNumber.text = profile.idNumber ?? '';
            _seeded = true;
          }
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Full name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _phone,
                decoration: const InputDecoration(labelText: 'Phone'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _idType,
                decoration: const InputDecoration(
                  labelText: 'ID type (e.g. PhilSys, Passport)',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _idNumber,
                decoration: const InputDecoration(labelText: 'ID number'),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Face scan'),
                subtitle: Text(
                  profile?.faceScanVerified == true
                      ? 'Verified'
                      : 'Not verified — complete Face Liveness',
                ),
                trailing: Icon(
                  profile?.faceScanVerified == true
                      ? Icons.verified_user
                      : Icons.face_retouching_natural,
                  color: profile?.faceScanVerified == true
                      ? AppColors.forest
                      : AppColors.muted,
                ),
              ),
              OutlinedButton.icon(
                onPressed: _loading
                    ? null
                    : () async {
                        final outcome = await FaceLivenessScreen.open(
                          context,
                          purpose: LivenessPurpose.registration,
                          title: 'Register face',
                          subtitle:
                              'Complete Face Liveness for account verification (SUCCEEDED ≥ 95).',
                        );
                        if (outcome?.passed == true) {
                          ref.invalidate(currentProfileProvider);
                          if (!mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'Face verified (${outcome!.confidenceScore.toStringAsFixed(1)})',
                              ),
                            ),
                          );
                        }
                      },
                icon: const Icon(Icons.face_retouching_natural),
                label: Text(
                  profile?.faceScanVerified == true
                      ? 'Re-verify face'
                      : 'Start face verification',
                ),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _loading ? null : _save,
                child: const Text('Save records'),
              ),
            ],
          );
        },
      ),
    );
  }
}

class DependentHomeScreen extends ConsumerWidget {
  const DependentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(currentProfileProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dependent / Guarantor'),
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
          return FutureBuilder(
            future: profile == null
                ? Future.value(<DependentLink>[])
                : ref
                    .read(applicationServiceProvider)
                    .listLinkedPrincipals(profile.id),
            builder: (context, snapshot) {
              final links = snapshot.data ?? [];
              return ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Text(
                    profile?.fullName.isNotEmpty == true
                        ? profile!.fullName
                        : 'Linked account',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'You have no independent application rights. Access is gated by a notarized authorization letter and account validation.',
                    style: TextStyle(color: AppColors.muted),
                  ),
                  const SizedBox(height: 20),
                  StatusBadge(
                    label: profile?.validationStatus.value.toUpperCase() ??
                        'PENDING',
                    color: profile?.validationStatus ==
                            AccountValidationStatus.validated
                        ? AppColors.forest
                        : AppColors.clay,
                  ),
                  const SizedBox(height: 24),
                  const SectionHeader(title: 'Linked principals'),
                  const SizedBox(height: 12),
                  if (links.isEmpty)
                    const EmptyState(
                      icon: Icons.link_off,
                      title: 'Not linked yet',
                      subtitle:
                          'Ask the principal customer to register you as dependent/guarantor.',
                    )
                  else
                    ...links.map(
                      (l) => Card(
                        child: ListTile(
                          title: Text(l.principalName ?? l.principalId),
                          subtitle: Text(
                            '${l.relationship} · ${l.isValidated ? 'Validated' : 'Awaiting validation'}',
                          ),
                          trailing: Icon(
                            l.isValidated
                                ? Icons.check_circle
                                : Icons.hourglass_bottom,
                            color: l.isValidated
                                ? AppColors.forest
                                : AppColors.clay,
                          ),
                        ),
                      ),
                    ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
