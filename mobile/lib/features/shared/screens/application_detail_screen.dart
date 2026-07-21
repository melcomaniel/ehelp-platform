import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../models/application.dart';
import '../../../providers/auth_provider.dart';
import '../../../theme/app_theme.dart';
import '../../shared/widgets/common_widgets.dart';

class ApplicationDetailScreen extends ConsumerWidget {
  const ApplicationDetailScreen({super.key, required this.applicationId});

  final String applicationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<Application>(
      future: ref.read(applicationServiceProvider).getApplication(applicationId),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return Scaffold(
            appBar: AppBar(title: const Text('Application')),
            body: const Center(child: CircularProgressIndicator()),
          );
        }
        final app = snapshot.data!;
        return Scaffold(
          appBar: AppBar(title: Text(app.referenceNo)),
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
              const SizedBox(height: 20),
              _row('Customer', app.customerName ?? app.customerId),
              _row(
                'Submitted',
                app.submittedAt != null
                    ? DateFormat.yMMMd().add_jm().format(app.submittedAt!)
                    : '—',
              ),
              _row('Amount requested', '${app.amountRequested ?? '—'}'),
              _row('Amount approved', '${app.amountApproved ?? '—'}'),
              _row('Priority', app.priority.label),
              _row('Reason', '${app.formData['reason'] ?? '—'}'),
              _row(
                'Face liveness',
                app.livenessStatus == null
                    ? '—'
                    : '${app.livenessStatus} (${app.livenessConfidence?.toStringAsFixed(1) ?? '—'})',
              ),
              _row('Evaluator notes', app.evaluatorNotes ?? '—'),
              _row('Approver notes', app.approverNotes ?? '—'),
              if (app.decidedAt != null)
                _row(
                  'Decided',
                  DateFormat.yMMMd().add_jm().format(app.decidedAt!),
                ),
            ],
          ),
        );
      },
    );
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
