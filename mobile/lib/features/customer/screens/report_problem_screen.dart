import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../providers/auth_provider.dart';
import '../../../services/ereport_service.dart';
import '../../../theme/app_theme.dart';

final ereportServiceProvider = Provider<EreportService>((ref) {
  return EreportService(ref.watch(authServiceProvider));
});

class ReportProblemScreen extends ConsumerStatefulWidget {
  const ReportProblemScreen({super.key});

  @override
  ConsumerState<ReportProblemScreen> createState() =>
      _ReportProblemScreenState();
}

class _ReportProblemScreenState extends ConsumerState<ReportProblemScreen> {
  final _subject = TextEditingController();
  final _message = TextEditingController();
  List<EreportCategory> _categories = const [];
  List<EreportCase> _cases = const [];
  String? _selectedCode;
  var _loading = true;
  var _submitting = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final svc = ref.read(ereportServiceProvider);
      final cats = await svc.categories();
      final cases = await svc.myCases();
      if (!mounted) return;
      setState(() {
        _categories = cats;
        _cases = cases;
        _selectedCode = cats.isNotEmpty ? cats.first.code : null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _submit() async {
    final code = _selectedCode;
    final subject = _subject.text.trim();
    final message = _message.text.trim();
    if (code == null || subject.isEmpty || message.isEmpty || _submitting) {
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });
    try {
      final result = await ref.read(ereportServiceProvider).submit(
            categoryCode: code,
            subject: subject,
            message: message,
          );
      if (!mounted) return;
      _subject.clear();
      _message.clear();
      setState(() {
        _success =
            '${result.message}\nCase number: ${result.caseNumber} (${result.mode})';
      });
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report a problem')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'File an eReport about EHelp only. Categories are limited to aid processes, account configuration, and mobile features.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.muted,
                      ),
                ),
                const SizedBox(height: 16),
                Text('Category', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                ..._categories.map((c) {
                  return RadioListTile<String>(
                    value: c.code,
                    groupValue: _selectedCode,
                    onChanged: (v) => setState(() => _selectedCode = v),
                    title: Text(c.label),
                    subtitle: Text(c.description),
                    contentPadding: EdgeInsets.zero,
                  );
                }),
                const SizedBox(height: 8),
                TextField(
                  controller: _subject,
                  decoration: const InputDecoration(
                    labelText: 'Subject',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _message,
                  minLines: 4,
                  maxLines: 8,
                  decoration: const InputDecoration(
                    labelText: 'Details',
                    border: OutlineInputBorder(),
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 16),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      _error!,
                      style: TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
                  ),
                if (_success != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      _success!,
                      style: const TextStyle(color: Colors.green),
                    ),
                  ),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: Text(_submitting ? 'Submitting…' : 'Submit report'),
                ),
                const SizedBox(height: 28),
                Text(
                  'Your recent reports',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                if (_cases.isEmpty)
                  const Text('No reports yet.')
                else
                  ..._cases.map(
                    (c) => Card(
                      child: ListTile(
                        title: Text(c.caseNumber),
                        subtitle: Text('${c.categoryCode}\n${c.subject}'),
                        isThreeLine: true,
                        trailing: Text(c.mode),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
