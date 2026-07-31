import 'package:file_picker/file_picker.dart';
import 'package:flutter/services.dart';

/// Shared document picker for vault / proofs / apply uploads.
Future<PlatformFile?> pickDocumentFile() async {
  try {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const [
        'pdf',
        'jpg',
        'jpeg',
        'png',
        'webp',
        'doc',
        'docx',
      ],
      allowMultiple: false,
      withData: false,
    );
    if (result == null || result.files.isEmpty) return null;
    return result.files.first;
  } on MissingPluginException {
    throw StateError(
      'File picker plugin is not registered. Stop the app completely, then run '
      '`flutter run` again (hot restart is not enough after adding file_picker).',
    );
  } on PlatformException catch (e) {
    throw StateError(e.message ?? 'Could not open the file picker.');
  }
}
