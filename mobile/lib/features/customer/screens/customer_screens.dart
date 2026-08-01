import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/utils/pick_document_file.dart';
import '../../../models/application.dart';
import '../../../models/profile.dart';
import '../../../providers/auth_provider.dart';
import '../../../theme/app_theme.dart';
import '../../liveness/screens/face_liveness_screen.dart';
import '../../shared/widgets/app_confirm_dialog.dart';
import '../../shared/widgets/common_widgets.dart';
import '../../../services/liveness_service.dart';

final myApplicationsProvider = FutureProvider.autoDispose<List<Application>>((ref) async {
  final profile = await ref.watch(currentProfileProvider.future);
  if (profile == null) return [];
  return ref
      .watch(applicationServiceProvider)
      .listMyApplications(profile.id);
});

/// Nest published programs filtered by age/location for this beneficiary.
final availableProgramsProvider =
    FutureProvider.autoDispose<List<ProgramTemplate>>((ref) async {
  ref.watch(authStateProvider);
  if (ref.read(authServiceProvider).currentSession == null) return [];
  return ref.watch(applicationServiceProvider).listTemplates();
});

final myDependentsProvider = FutureProvider.autoDispose<List<DependentLink>>((ref) async {
  final profile = await ref.watch(currentProfileProvider.future);
  if (profile == null) return [];
  return ref.watch(applicationServiceProvider).listDependents(profile.id);
});

final unreadMessagesCountProvider = FutureProvider.autoDispose<int>((ref) async {
  ref.watch(authStateProvider);
  if (ref.read(authServiceProvider).currentSession == null) return 0;
  final items =
      await ref.watch(applicationServiceProvider).listMyNotifications();
  return items.where((n) => n['read_at'] == null).length;
});

class CustomerHomeScreen extends ConsumerWidget {
  const CustomerHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(currentProfileProvider);
    final appsAsync = ref.watch(myApplicationsProvider);
    final programsAsync = ref.watch(availableProgramsProvider);
    final unreadMessages =
        ref.watch(unreadMessagesCountProvider).asData?.value ?? 0;

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
              ref.invalidate(availableProgramsProvider);
              ref.invalidate(currentProfileProvider);
              ref.invalidate(unreadMessagesCountProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  profile.fullName.isNotEmpty
                      ? 'Hello, ${profile.fullName}'
                      : 'Hello',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 6),
                if (profile.registeredLocationLabel.isNotEmpty) ...[
                  Row(
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        size: 16,
                        color: AppColors.muted,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          profile.registeredLocationLabel,
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                ],
                const Text(
                  'Programs for your age and location. Pull to refresh.',
                  style: TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 24),
                const SectionHeader(title: 'Programs'),
                const SizedBox(height: 12),
                programsAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (e, _) => Text('$e'),
                  data: (programs) {
                    if (programs.isEmpty) {
                      return const EmptyState(
                        icon: Icons.folder_off_outlined,
                        title: 'No matching programs',
                        subtitle:
                            'None published for your age/location yet.',
                      );
                    }
                    return Column(
                      children: programs
                          .map(
                            (p) => _NestProgramCard(
                              program: p,
                              onTap: () =>
                                  context.push('/customer/programs/${p.id}'),
                            ),
                          )
                          .toList(),
                    );
                  },
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: _QuickTile(
                        icon: Icons.notifications_outlined,
                        label: 'Messages',
                        badgeCount: unreadMessages,
                        onTap: () => context.push('/customer/messages'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _QuickTile(
                        icon: Icons.event_available_outlined,
                        label: 'Schedule',
                        onTap: () => context.push('/customer/schedule'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
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
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _QuickTile(
                        icon: Icons.folder_outlined,
                        label: 'Documents',
                        onTap: () => context.push('/customer/documents'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _QuickTile(
                        icon: Icons.smart_toy_outlined,
                        label: 'Ask eGov AI',
                        onTap: () => context.push('/customer/assistant'),
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
                        subtitle: 'Tap a program above to apply.',
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
    this.badgeCount = 0,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int badgeCount;

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
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(icon, color: AppColors.ocean),
                  if (badgeCount > 0)
                    Positioned(
                      right: -10,
                      top: -8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.danger,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        constraints: const BoxConstraints(minWidth: 18),
                        child: Text(
                          badgeCount > 99 ? '99+' : '$badgeCount',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }
}

class _NestProgramCard extends StatefulWidget {
  const _NestProgramCard({required this.program, required this.onTap});

  final ProgramTemplate program;
  final VoidCallback onTap;

  @override
  State<_NestProgramCard> createState() => _NestProgramCardState();
}

class _NestProgramCardState extends State<_NestProgramCard> {
  var _descExpanded = false;

  @override
  Widget build(BuildContext context) {
    final program = widget.program;
    final onCooldown = program.isOnCooldown;
    final rawSubtitle = onCooldown && program.eligibleAgainAt != null
        ? 'Available again ${DateFormat.yMMMd().format(program.eligibleAgainAt!.toLocal())}'
        : program.applyBlockReason == 'in_progress'
            ? (program.applyBlockMessage ?? 'Application already in progress')
            : program.description?.isNotEmpty == true
                ? program.description!
                : 'Cooldown ${program.disbursementCooldownDays} days';
    final isLongDesc = !onCooldown &&
        program.applyBlockReason != 'in_progress' &&
        (program.description?.length ?? 0) > 90;
    final subtitle = isLongDesc && !_descExpanded
        ? '${rawSubtitle.substring(0, 90).trimRight()}…'
        : rawSubtitle;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: widget.onTap,
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
                  color: (onCooldown ? AppColors.clay : AppColors.primary)
                      .withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  onCooldown
                      ? Icons.hourglass_top_rounded
                      : Icons.volunteer_activism_outlined,
                  color: onCooldown ? AppColors.clay : AppColors.primary,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      program.code ?? program.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
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
                      subtitle,
                      style: TextStyle(
                        color: onCooldown ? AppColors.clay : AppColors.muted,
                        fontSize: 12,
                        height: 1.3,
                        fontWeight:
                            onCooldown ? FontWeight.w600 : FontWeight.w400,
                      ),
                    ),
                    if (isLongDesc)
                      TextButton(
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(0, 28),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: () {
                          setState(() => _descExpanded = !_descExpanded);
                        },
                        child: Text(
                          _descExpanded ? 'Show less' : 'Show more',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    if (onCooldown && program.cooldownRemainingDays != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        '${program.cooldownRemainingDays} of ${program.disbursementCooldownDays} days left',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                        ),
                      ),
                    ],
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
    final date = app.submittedAt ?? app.createdAt;
    final dateLabel = date != null ? DateFormat.yMMMd().format(date) : '—';
    final claim = app.disbursementClaim;
    String subtitleExtra = dateLabel;
    if (app.isDisbursementComplete) {
      final claimed = claim?.claimedAt;
      subtitleExtra = claimed != null
          ? 'Claimed ${DateFormat.yMMMd().format(claimed)}'
          : 'Disbursement completed';
    }
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
              Text(subtitleExtra, style: const TextStyle(color: AppColors.muted)),
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
  String _relationship = 'dependent';
  bool _saving = false;
  PlatformFile? _proofFile;
  String? _proofUri;

  @override
  void dispose() {
    _dependentId.dispose();
    super.dispose();
  }

  Future<void> _pickProof() async {
    try {
      final file = await pickDocumentFile();
      if (file == null) return;
      if (file.path == null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not read the selected file.')),
        );
        return;
      }
      setState(() {
        _proofFile = file;
        _proofUri = null;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Bad state: ', ''))),
      );
    }
  }

  Future<void> _add() async {
    final profile = await ref.read(currentProfileProvider.future);
    if (profile == null) return;
    final depId = _dependentId.text.trim();
    if (depId.isEmpty) return;
    if (_proofFile?.path == null && (_proofUri == null || _proofUri!.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Attach a notarized authorization proof file first.'),
        ),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final svc = ref.read(applicationServiceProvider);
      var uri = _proofUri;
      if (_proofFile?.path != null) {
        final uploaded = await svc.uploadFile(
          filePath: _proofFile!.path!,
          fileName: _proofFile!.name,
        );
        uri = uploaded['storage_uri']?.toString();
        if (uri == null || uri.isEmpty) {
          throw Exception('Proof upload failed');
        }
      }
      await svc.registerDependent(
        principalId: profile.id,
        dependentId: depId,
        relationship: _relationship,
        isNotarized: true,
        proofDocumentType: 'authorization_letter',
        proofStorageUri: uri,
        notes: 'Awaiting Office Admin approval of proof documents',
      );
      ref.invalidate(myDependentsProvider);
      _dependentId.clear();
      setState(() {
        _proofFile = null;
        _proofUri = null;
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Link requested. Office Admin must approve the proof before activation.',
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
            'Link another beneficiary (one-to-many or mutual). Proof must be approved by the Office Admin.',
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _dependentId,
            decoration: const InputDecoration(
              labelText: 'Beneficiary user ID (UUID)',
              helperText: 'Must already have an EHELP beneficiary account',
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _relationship,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Relationship'),
            items: const [
              DropdownMenuItem(value: 'dependent', child: Text('Dependent')),
              DropdownMenuItem(value: 'child', child: Text('Child')),
              DropdownMenuItem(value: 'parent', child: Text('Parent')),
              DropdownMenuItem(value: 'guardian', child: Text('Guardian')),
              DropdownMenuItem(value: 'guarantor', child: Text('Guarantor')),
              DropdownMenuItem(
                value: 'authorized_representative',
                child: Text('Authorized representative'),
              ),
            ],
            onChanged: (v) => setState(() => _relationship = v ?? _relationship),
          ),
          const SizedBox(height: 12),
          InputDecorator(
            decoration: const InputDecoration(
              labelText: 'Proof document',
              border: OutlineInputBorder(),
              helperText: 'Notarized authorization letter (PDF/JPG/PNG)',
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _proofFile?.name ?? 'No file selected',
                  style: TextStyle(
                    color: _proofFile != null ? AppColors.ink : AppColors.muted,
                  ),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _saving ? null : _pickProof,
                  icon: const Icon(Icons.attach_file, size: 18),
                  label: Text(
                    _proofFile != null ? 'Replace file' : 'Attach proof',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _add,
            child: Text(_saving ? 'Submitting…' : 'Request link'),
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
  final _address = TextEditingController();
  final _municipality = TextEditingController();
  final _barangay = TextEditingController();
  final _description = TextEditingController();
  bool _loading = false;
  bool _seeded = false;
  bool _requestMode = false;
  List<Map<String, dynamic>> _requests = [];
  PlatformFile? _proofFile;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _municipality.dispose();
    _barangay.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _loadRequests() async {
    try {
      final rows =
          await ref.read(applicationServiceProvider).listMyProfileChangeRequests();
      if (mounted) setState(() => _requests = rows);
    } catch (_) {}
  }

  Future<void> _pickProof() async {
    try {
      final file = await pickDocumentFile();
      if (file == null) return;
      if (file.path == null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not read the selected file.')),
        );
        return;
      }
      setState(() => _proofFile = file);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Bad state: ', ''))),
      );
    }
  }

  Future<void> _submitRequest() async {
    final description = _description.text.trim();
    if (description.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Describe why you need the change (at least 10 characters).'),
        ),
      );
      return;
    }
    if (_proofFile?.path == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attach a proof document file first.')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      final svc = ref.read(applicationServiceProvider);
      final uploaded = await svc.uploadFile(
        filePath: _proofFile!.path!,
        fileName: _proofFile!.name,
      );
      final storageUri = uploaded['storage_uri']?.toString();
      if (storageUri == null || storageUri.isEmpty) {
        throw Exception('Proof upload failed');
      }
      await svc.requestProfileChange(
        description: description,
        proposedChanges: {
          'full_name': _name.text.trim(),
          'phone': _phone.text.trim(),
          'address': _address.text.trim(),
          'municipality': _municipality.text.trim(),
          'barangay': _barangay.text.trim(),
        },
        proofDocumentType: 'identity_proof',
        proofStorageUri: storageUri,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Request sent to Office Admin for review.'),
        ),
      );
      setState(() {
        _requestMode = false;
        _proofFile = null;
      });
      _description.clear();
      await _loadRequests();
      ref.invalidate(currentProfileProvider);
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
            _address.text = profile.address ?? '';
            _municipality.text = profile.municipality ?? '';
            _barangay.text = profile.barangay ?? '';
            _seeded = true;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              unawaited(_loadRequests());
            });
          }
          final locked = !_requestMode;
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.secondary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'Personal details are locked after eGov verification. '
                  'To change them, request an update with proof — Office Admin must approve.',
                  style: TextStyle(height: 1.4, fontSize: 13),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _name,
                readOnly: locked,
                decoration: const InputDecoration(labelText: 'Full name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _phone,
                readOnly: locked,
                decoration: const InputDecoration(labelText: 'Phone'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _address,
                readOnly: locked,
                decoration: const InputDecoration(labelText: 'Address'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _municipality,
                readOnly: locked,
                decoration: const InputDecoration(labelText: 'Municipality / City'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _barangay,
                readOnly: locked,
                decoration: const InputDecoration(labelText: 'Barangay'),
              ),
              if (_requestMode) ...[
                const SizedBox(height: 16),
                TextField(
                  controller: _description,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Why do you need this change?',
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 12),
                InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Proof document',
                    border: OutlineInputBorder(),
                    helperText: 'PhilSys correction slip, barangay cert, etc.',
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _proofFile?.name ?? 'No file selected',
                        style: TextStyle(
                          color: _proofFile != null
                              ? AppColors.ink
                              : AppColors.muted,
                        ),
                      ),
                      const SizedBox(height: 10),
                      OutlinedButton.icon(
                        onPressed: _loading ? null : _pickProof,
                        icon: const Icon(Icons.attach_file, size: 18),
                        label: Text(
                          _proofFile != null ? 'Replace file' : 'Attach proof',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _loading ? null : _submitRequest,
                  child: Text(_loading ? 'Submitting…' : 'Submit to Office Admin'),
                ),
                TextButton(
                  onPressed: _loading
                      ? null
                      : () => setState(() {
                            _requestMode = false;
                            _proofFile = null;
                          }),
                  child: const Text('Cancel'),
                ),
              ] else ...[
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: () => setState(() => _requestMode = true),
                  icon: const Icon(Icons.edit_note),
                  label: const Text('Request detail change'),
                ),
              ],
              if (_requests.isNotEmpty) ...[
                const SizedBox(height: 28),
                Text(
                  'Change requests',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                ..._requests.map((r) {
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('${r['status']}'.toUpperCase()),
                    subtitle: Text(
                      '${r['description'] ?? ''}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.muted),
                    ),
                  );
                }),
              ],
              const SizedBox(height: 20),
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
