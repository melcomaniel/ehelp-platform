import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../theme/app_theme.dart';

/// Scans a PhilSys National ID QR and returns the raw string value.
class NationalIdQrScanScreen extends StatefulWidget {
  const NationalIdQrScanScreen({super.key});

  static Future<String?> open(BuildContext context) {
    return Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const NationalIdQrScanScreen()),
    );
  }

  @override
  State<NationalIdQrScanScreen> createState() => _NationalIdQrScanScreenState();
}

class _NationalIdQrScanScreenState extends State<NationalIdQrScanScreen> {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
  );
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue?.trim();
      if (raw == null || raw.isEmpty) continue;
      _handled = true;
      Navigator.of(context).pop(raw);
      return;
    }
  }

  Widget _fallback(String message) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(message, textAlign: TextAlign.center, style: const TextStyle(height: 1.4)),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Back to paste'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan National ID QR'),
        actions: [
          IconButton(
            tooltip: 'Toggle torch',
            onPressed: () => _controller.toggleTorch(),
            icon: const Icon(Icons.flash_on),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error) {
              final text = error.toString();
              final missing = text.contains('MissingPlugin');
              return _fallback(
                missing
                    ? 'Scanner plugin not linked. Fully stop the app and run '
                        '`flutter run` again (hot reload is not enough). '
                        'Or paste the QR value on the previous screen.'
                    : 'Camera error: $error',
              );
            },
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              color: Colors.black54,
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              child: const Text(
                'Point at the QR on your physical PhilSys card or ePhilID. '
                'Use paste on the previous screen if the camera cannot read it.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, height: 1.35),
              ),
            ),
          ),
          IgnorePointer(
            child: Center(
              child: Container(
                width: 240,
                height: 240,
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.primary, width: 3),
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
