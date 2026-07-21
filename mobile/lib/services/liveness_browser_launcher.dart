import 'dart:io';

import 'package:android_intent_plus/android_intent.dart';
import 'package:android_intent_plus/flag.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens Face Liveness in a WebRTC-capable browser.
///
/// Default Android browsers like Opera often hang on "Connecting…" because
/// AWS Rekognition Face Liveness needs solid WebRTC support (Chrome works best).
class LivenessBrowserLauncher {
  static const _chromePackages = <String>[
    'com.android.chrome',
    'com.chrome.beta',
    'com.chrome.dev',
    'com.chrome.canary',
    'com.google.android.apps.chrome',
  ];

  /// Returns which browser package was used, or null if generic launcher.
  static Future<String?> open(String url) async {
    if (Platform.isAndroid) {
      for (final package in _chromePackages) {
        try {
          final intent = AndroidIntent(
            action: 'action_view',
            data: url,
            package: package,
            flags: <int>[Flag.FLAG_ACTIVITY_NEW_TASK],
          );
          await intent.launch();
          return package;
        } catch (_) {
          // Try next Chrome package.
        }
      }
    }

    final uri = Uri.parse(url);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) {
      throw Exception('Could not open a browser for Face Liveness');
    }
    return null;
  }
}
