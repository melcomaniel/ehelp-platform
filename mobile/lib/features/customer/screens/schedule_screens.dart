import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../models/application.dart';
import '../../../providers/auth_provider.dart';
import '../../../theme/app_theme.dart';
import 'customer_screens.dart' show unreadMessagesCountProvider;

/// In-app messages (approval → schedule disbursement, profile change outcomes).
class CustomerNotificationsScreen extends ConsumerStatefulWidget {
  const CustomerNotificationsScreen({super.key});

  @override
  ConsumerState<CustomerNotificationsScreen> createState() =>
      _CustomerNotificationsScreenState();
}

class _CustomerNotificationsScreenState
    extends ConsumerState<CustomerNotificationsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;
  final Set<String> _expandedIds = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items =
          await ref.read(applicationServiceProvider).listMyNotifications();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
      ref.invalidate(unreadMessagesCountProvider);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _onExpansionChanged(
    Map<String, dynamic> n,
    bool expanded,
  ) async {
    final id = n['id']?.toString();
    if (id == null) return;
    setState(() {
      if (expanded) {
        _expandedIds.add(id);
      } else {
        _expandedIds.remove(id);
      }
    });
    // First collapse of an unread message marks it read.
    final unread = n['read_at'] == null;
    if (!expanded && unread) {
      await ref.read(applicationServiceProvider).markNotificationRead(id);
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _items.where((n) => n['read_at'] == null).length;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          unreadCount > 0 ? 'Messages ($unreadCount)' : 'Messages',
        ),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _items.isEmpty
                  ? const Center(
                      child: Text(
                        'No messages yet.',
                        style: TextStyle(color: AppColors.muted),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final n = _items[i];
                        final id = n['id']?.toString() ?? '$i';
                        final unread = n['read_at'] == null;
                        final payload = Map<String, dynamic>.from(
                          n['payload'] as Map? ?? {},
                        );
                        final action = payload['action'] as String?;
                        final created = n['created_at'] != null
                            ? DateTime.tryParse(n['created_at'].toString())
                            : null;
                        final title = n['title']?.toString() ?? 'Message';
                        final body = n['body']?.toString() ?? '';
                        final expanded = _expandedIds.contains(id);

                        return Card(
                          child: ExpansionTile(
                            key: PageStorageKey('msg-$id'),
                            initiallyExpanded: expanded,
                            onExpansionChanged: (v) =>
                                _onExpansionChanged(n, v),
                            tilePadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 4,
                            ),
                            childrenPadding: const EdgeInsets.fromLTRB(
                              16,
                              0,
                              16,
                              16,
                            ),
                            leading: unread
                                ? Container(
                                    width: 10,
                                    height: 10,
                                    decoration: const BoxDecoration(
                                      color: AppColors.danger,
                                      shape: BoxShape.circle,
                                    ),
                                  )
                                : const SizedBox(width: 10),
                            title: Text(
                              title,
                              style: TextStyle(
                                fontWeight: unread
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                              ),
                            ),
                            subtitle: Text(
                              expanded
                                  ? (created != null
                                      ? DateFormat.yMMMd()
                                          .add_jm()
                                          .format(created)
                                      : '')
                                  : (body.length > 72
                                      ? '${body.substring(0, 72).trimRight()}…'
                                      : body),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                              ),
                            ),
                            children: [
                              Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  body,
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    height: 1.35,
                                  ),
                                ),
                              ),
                              if (created != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      DateFormat.yMMMd()
                                          .add_jm()
                                          .format(created),
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.muted,
                                      ),
                                    ),
                                  ),
                                ),
                              if (action == 'schedule_disbursement')
                                Padding(
                                  padding: const EdgeInsets.only(top: 12),
                                  child: Align(
                                    alignment: Alignment.centerLeft,
                                    child: FilledButton(
                                      onPressed: () async {
                                        if (unread) {
                                          await ref
                                              .read(applicationServiceProvider)
                                              .markNotificationRead(id);
                                        }
                                        if (!context.mounted) return;
                                        context.push('/customer/schedule');
                                      },
                                      child: const Text(
                                        'Schedule disbursement',
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
    );
  }
}

/// Pick an office queue slot after application approval.
class ScheduleDisbursementScreen extends ConsumerStatefulWidget {
  const ScheduleDisbursementScreen({super.key});

  @override
  ConsumerState<ScheduleDisbursementScreen> createState() =>
      _ScheduleDisbursementScreenState();
}

class _ScheduleDisbursementScreenState
    extends ConsumerState<ScheduleDisbursementScreen> {
  List<Application> _approved = [];
  List<Map<String, dynamic>> _slots = [];
  List<Map<String, dynamic>> _bookings = [];
  String? _applicationId;
  bool _loading = true;
  bool _booking = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final profile = await ref.read(currentProfileProvider.future);
      if (profile == null) throw Exception('Sign in required');
      final svc = ref.read(applicationServiceProvider);
      final apps = await svc.listMyApplications(profile.id);
      final approved = apps
          .where((a) => a.status == ApplicationStatus.approved)
          .toList();
      final bookings = await svc.listMyBookings();
      String? appId = _applicationId;
      if (appId == null && approved.isNotEmpty) appId = approved.first.id;
      List<Map<String, dynamic>> slots = [];
      if (appId != null) {
        final app = approved.cast<Application?>().firstWhere(
              (a) => a?.id == appId,
              orElse: () => approved.isNotEmpty ? approved.first : null,
            );
        slots = await svc.listBookableSlots(
          officeId: app?.regionId,
          applicationId: appId,
        );
      }
      if (!mounted) return;
      setState(() {
        _approved = approved;
        _bookings = bookings;
        _applicationId = appId;
        _slots = slots;
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

  Future<void> _book(String slotId) async {
    final appId = _applicationId;
    if (appId == null) return;
    setState(() => _booking = true);
    try {
      final result = await ref.read(applicationServiceProvider).bookDisbursementSlot(
            slotId: slotId,
            applicationId: appId,
          );
      if (!mounted) return;
      final q = result['queue_number'];
      final replaced = result['replaced_previous'] == true;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            replaced
                ? 'Rescheduled — new queue number $q (previous booking replaced)'
                : 'Booked — queue number $q',
          ),
        ),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _booking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Schedule disbursement')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!, textAlign: TextAlign.center),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    const Text(
                      'One active booking per approved application. Booking again replaces your previous slot — until 2 days before that scheduled date, when rebooking locks. New slots must also be at least 2 days ahead.',
                      style: TextStyle(color: AppColors.muted, height: 1.4),
                    ),
                    const SizedBox(height: 16),
                    if (_approved.isEmpty)
                      const Text(
                        'No approved applications yet. Wait for staff approval.',
                        style: TextStyle(color: AppColors.muted),
                      )
                    else ...[
                      DropdownButtonFormField<String>(
                        initialValue: _applicationId,
                        decoration: const InputDecoration(
                          labelText: 'Approved application',
                        ),
                        items: _approved
                            .map(
                              (a) => DropdownMenuItem(
                                value: a.id,
                                child: Text(
                                  '${a.templateName ?? 'Program'} · ${a.referenceNo}',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (v) async {
                          setState(() => _applicationId = v);
                          await _load();
                        },
                      ),
                      if (() {
                        final app = _approved.cast<Application?>().firstWhere(
                              (a) => a?.id == _applicationId,
                              orElse: () => null,
                            );
                        final w = app?.periodWindows;
                        return w != null &&
                            (w['disbursement_start'] != null ||
                                w['disbursement_end'] != null);
                      }())
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Builder(
                            builder: (context) {
                              final app =
                                  _approved.cast<Application?>().firstWhere(
                                        (a) => a?.id == _applicationId,
                                        orElse: () => null,
                                      );
                              final w = app!.periodWindows!;
                              String fmt(dynamic v) {
                                final d = DateTime.tryParse('$v');
                                if (d == null) return '—';
                                return DateFormat.yMMMd().add_jm().format(d.toLocal());
                              }
                              return Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: AppColors.muted.withValues(alpha: 0.35),
                                  ),
                                ),
                                child: Text(
                                  'Disbursement window (your application is approved — claim/schedule in this period)\n'
                                  '${fmt(w['disbursement_start'])} → ${fmt(w['disbursement_end'])}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    height: 1.4,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      const SizedBox(height: 20),
                      Text(
                        'Available slots',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      if (_slots.isEmpty)
                        const Text(
                          'No open slots in this program’s disbursement window yet. Ask the office admin to publish a schedule.',
                          style: TextStyle(color: AppColors.muted),
                        )
                      else
                        ..._slots.map((s) {
                          final start = DateTime.tryParse('${s['starts_at']}');
                          final end = DateTime.tryParse('${s['ends_at']}');
                          final label = s['label']?.toString();
                          final remaining = s['remaining'] ?? 0;
                          final site = s['site_name']?.toString();
                          final addr = s['site_address']?.toString();
                          final maps = s['maps_url']?.toString();
                          final when = start != null && end != null
                              ? '${DateFormat.MMMd().add_jm().format(start.toLocal())} – ${DateFormat.jm().format(end.toLocal())}'
                              : '${s['starts_at']}';
                          return Card(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    label?.isNotEmpty == true
                                        ? label!
                                        : 'Disbursement slot',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '$when\n${site ?? s['office_name'] ?? 'Office'} · $remaining seats left'
                                    '${addr != null && addr.isNotEmpty ? '\n$addr' : ''}',
                                    style: const TextStyle(
                                      color: AppColors.muted,
                                      height: 1.35,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      if (maps != null && maps.isNotEmpty)
                                        TextButton(
                                          onPressed: () async {
                                            final uri = Uri.parse(maps);
                                            await launchUrl(
                                              uri,
                                              mode: LaunchMode.externalApplication,
                                            );
                                          },
                                          child: const Text('Map'),
                                        ),
                                      const Spacer(),
                                      FilledButton(
                                        style: FilledButton.styleFrom(
                                          // Theme may set min width to infinity; Row forbids that.
                                          minimumSize: const Size(64, 40),
                                          tapTargetSize:
                                              MaterialTapTargetSize.shrinkWrap,
                                        ),
                                        onPressed: _booking
                                            ? null
                                            : () => _book(s['id'] as String),
                                        child: const Text('Book'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),
                      if (_bookings.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        Text(
                          'Your bookings',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        ..._bookings.map((b) {
                          final slot =
                              Map<String, dynamic>.from(b['slot'] as Map? ?? {});
                          final starts = DateTime.tryParse(
                            '${slot['starts_at'] ?? ''}',
                          );
                          final locked = starts != null &&
                              DateTime.now().isAfter(
                                DateTime(
                                      starts.toLocal().year,
                                      starts.toLocal().month,
                                      starts.toLocal().day,
                                    ).subtract(const Duration(days: 2)),
                              );
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              'Queue #${b['queue_number']} · ${b['status']}',
                            ),
                            subtitle: Text(
                              '${slot['label'] ?? 'Slot'} · ${slot['starts_at'] ?? ''}'
                              '${locked && b['status'] == 'booked' ? '\nRebooking locked (within 2 days of this date).' : ''}'
                              '${b['status'] == 'booked' && !locked ? '\nBook another slot to replace this one.' : ''}',
                              style: const TextStyle(color: AppColors.muted),
                            ),
                          );
                        }),
                      ],
                    ],
                  ],
                ),
    );
  }
}
