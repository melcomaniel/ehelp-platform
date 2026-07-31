import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/pick_document_file.dart';
import '../../../providers/auth_provider.dart';
import '../../../theme/app_theme.dart';

/// Early documents (marriage contract, licenses, etc.) reusable on apply.
class DocumentVaultScreen extends ConsumerStatefulWidget {
  const DocumentVaultScreen({super.key});

  @override
  ConsumerState<DocumentVaultScreen> createState() => _DocumentVaultScreenState();
}

class _DocumentVaultScreenState extends ConsumerState<DocumentVaultScreen> {
  List<Map<String, dynamic>> _docs = [];
  bool _loading = true;
  String? _error;

  static const _types = <(String, String)>[
    ('marriage_contract', 'Marriage contract'),
    ('marriage_license', 'Marriage license'),
    ('birth_certificate', 'Birth certificate'),
    ('valid_id', 'Valid ID'),
    ('proof_of_residency', 'Proof of residency'),
    ('barangay_certificate', 'Barangay certificate'),
    ('other', 'Other'),
  ];

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
      final docs =
          await ref.read(applicationServiceProvider).listVaultDocuments();
      if (!mounted) return;
      setState(() {
        _docs = docs;
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

  String _typeLabel(String code) {
    for (final t in _types) {
      if (t.$1 == code) return t.$2;
    }
    return code;
  }

  String _fileNameOf(Map<String, dynamic> d) {
    final uri = d['storage_uri']?.toString() ?? '';
    if (uri.isEmpty) return '—';
    final parts = uri.split('/');
    return parts.isNotEmpty ? parts.last : uri;
  }

  Future<void> _openEditor({Map<String, dynamic>? existing}) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => _VaultEditorSheet(
        types: _types,
        existing: existing,
        onSubmit: (payload) async {
          final svc = ref.read(applicationServiceProvider);
          if (existing != null) {
            // Replace = delete old + add new (keeps API simple).
            await svc.deleteVaultDocument(existing['id'] as String);
          }
          String storageUri = payload.storageUri;
          if (payload.localPath != null) {
            final uploaded = await svc.uploadFile(
              filePath: payload.localPath!,
              fileName: payload.fileName ?? 'document',
            );
            storageUri = uploaded['storage_uri']?.toString() ?? storageUri;
            if (storageUri.isEmpty) {
              throw Exception('Upload did not return a storage URI');
            }
          }
          if (storageUri.isEmpty) {
            throw Exception('Attach a file to save this document');
          }
          await svc.addVaultDocument(
            documentType: payload.documentType,
            storageUri: storageUri,
            label: payload.label,
            notes: payload.notes,
          );
        },
      ),
    );
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(existing == null ? 'Document added' : 'Document updated'),
        ),
      );
      await _load();
    }
  }

  Future<void> _confirmDelete(Map<String, dynamic> doc) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove document?'),
        content: Text(
          'Remove "${doc['label'] ?? doc['document_type']}" from your vault?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref
          .read(applicationServiceProvider)
          .deleteVaultDocument(doc['id'] as String);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Document removed')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Document vault'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(),
        icon: const Icon(Icons.add),
        label: const Text('Add document'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
                children: [
                  const Text(
                    'Store marriage contracts, licenses, IDs, and other proofs '
                    'here. You can reuse them when a program asks for the same document.',
                    style: TextStyle(color: AppColors.muted, height: 1.4),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        _error!,
                        style: const TextStyle(color: AppColors.danger),
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  Text(
                    'Your documents',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  if (_docs.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        vertical: 36,
                        horizontal: 16,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.secondary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          const Icon(
                            Icons.folder_open_outlined,
                            size: 40,
                            color: AppColors.muted,
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'No documents yet',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Tap Add document to attach a file.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AppColors.muted),
                          ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: () => _openEditor(),
                            icon: const Icon(Icons.add),
                            label: const Text('Add document'),
                          ),
                        ],
                      ),
                    )
                  else
                    ..._docs.map((d) {
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(12, 12, 4, 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Padding(
                                    padding: EdgeInsets.only(top: 2),
                                    child: Icon(
                                      Icons.insert_drive_file_outlined,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          d['label']?.toString() ??
                                              d['document_type'].toString(),
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          _typeLabel(
                                            '${d['document_type']}',
                                          ),
                                          style: const TextStyle(
                                            color: AppColors.muted,
                                            fontSize: 13,
                                          ),
                                        ),
                                        Text(
                                          _fileNameOf(d),
                                          style: const TextStyle(
                                            color: AppColors.muted,
                                            fontSize: 12,
                                          ),
                                        ),
                                        if ((d['notes']?.toString() ?? '')
                                            .isNotEmpty)
                                          Padding(
                                            padding:
                                                const EdgeInsets.only(top: 4),
                                            child: Text(
                                              '${d['notes']}',
                                              style: const TextStyle(
                                                fontSize: 12,
                                                height: 1.3,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  TextButton.icon(
                                    onPressed: () => _openEditor(existing: d),
                                    icon: const Icon(Icons.edit_outlined, size: 18),
                                    label: const Text('Edit'),
                                  ),
                                  TextButton.icon(
                                    onPressed: () => _confirmDelete(d),
                                    icon: const Icon(
                                      Icons.delete_outline,
                                      size: 18,
                                      color: AppColors.danger,
                                    ),
                                    label: const Text(
                                      'Remove',
                                      style: TextStyle(color: AppColors.danger),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}

class _VaultPayload {
  const _VaultPayload({
    required this.documentType,
    required this.label,
    required this.storageUri,
    this.notes,
    this.localPath,
    this.fileName,
  });

  final String documentType;
  final String label;
  final String storageUri;
  final String? notes;
  final String? localPath;
  final String? fileName;
}

class _VaultEditorSheet extends StatefulWidget {
  const _VaultEditorSheet({
    required this.types,
    required this.onSubmit,
    this.existing,
  });

  final List<(String, String)> types;
  final Map<String, dynamic>? existing;
  final Future<void> Function(_VaultPayload payload) onSubmit;

  @override
  State<_VaultEditorSheet> createState() => _VaultEditorSheetState();
}

class _VaultEditorSheetState extends State<_VaultEditorSheet> {
  late String _type;
  late final TextEditingController _label;
  late final TextEditingController _notes;
  PlatformFile? _picked;
  String? _existingUri;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _type = e?['document_type']?.toString() ?? 'marriage_contract';
    _label = TextEditingController(text: e?['label']?.toString() ?? '');
    _notes = TextEditingController(text: e?['notes']?.toString() ?? '');
    _existingUri = e?['storage_uri']?.toString();
  }

  @override
  void dispose() {
    _label.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    try {
      final file = await pickDocumentFile();
      if (file == null) return;
      if (file.path == null || file.path!.isEmpty) {
        setState(() => _error = 'Could not access the selected file path.');
        return;
      }
      setState(() {
        _picked = file;
        _error = null;
        if (_label.text.trim().isEmpty) _label.text = file.name;
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Bad state: ', ''));
    }
  }

  Future<void> _save() async {
    final label = _label.text.trim().isEmpty
        ? (_picked?.name ?? _type)
        : _label.text.trim();
    final hasNewFile = _picked?.path != null;
    final hasExisting = (_existingUri ?? '').isNotEmpty;
    if (!hasNewFile && !hasExisting) {
      setState(() => _error = 'Attach a file before saving.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onSubmit(
        _VaultPayload(
          documentType: _type,
          label: label,
          storageUri: _existingUri ?? '',
          notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
          localPath: _picked?.path,
          fileName: _picked?.name,
        ),
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final editing = widget.existing != null;
    final fileLabel = _picked?.name ??
        (_existingUri != null && _existingUri!.isNotEmpty
            ? _existingUri!.split('/').last
            : 'No file selected');

    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            Text(
              editing ? 'Edit document' : 'Add document',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: widget.types.any((t) => t.$1 == _type)
                  ? _type
                  : widget.types.last.$1,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Document type'),
              items: widget.types
                  .map(
                    (t) => DropdownMenuItem(value: t.$1, child: Text(t.$2)),
                  )
                  .toList(),
              onChanged: _busy
                  ? null
                  : (v) {
                      if (v != null) setState(() => _type = v);
                    },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _label,
              enabled: !_busy,
              decoration: const InputDecoration(
                labelText: 'Label',
                hintText: 'Marriage contract 2024',
              ),
            ),
            const SizedBox(height: 12),
            InputDecorator(
              decoration: const InputDecoration(
                labelText: 'File attachment',
                border: OutlineInputBorder(),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    fileLabel,
                    style: TextStyle(
                      color: (_picked != null ||
                              (_existingUri?.isNotEmpty ?? false))
                          ? AppColors.ink
                          : AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : _pickFile,
                      icon: const Icon(Icons.attach_file, size: 18),
                      label: Text(
                        _picked != null || (_existingUri?.isNotEmpty ?? false)
                            ? 'Replace file'
                            : 'Attach file',
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notes,
              enabled: !_busy,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Notes (optional)'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(editing ? 'Save changes' : 'Add to vault'),
            ),
            TextButton(
              onPressed: _busy ? null : () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
    );
  }
}
