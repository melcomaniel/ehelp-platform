/// Compile-time API config for NestJS Core.
///
/// Default points at the Render demo API. Override anytime:
/// - Local Nest: `flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3001`
/// - Android emulator → host: `http://10.0.2.2:3001`
/// - LAN phone: `http://<YOUR_MAC_LAN_IP>:3001`
class ApiConfig {
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://<your-api-host>',
  );
}
