/// Compile-time API config for NestJS Core.
///
/// Default points at a local Nest on the host machine. Override anytime:
/// - Android emulator → host: `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001`
/// - LAN phone: `http://<YOUR_MAC_LAN_IP>:3001`
/// - Hosted API: `flutter run --dart-define=API_BASE_URL=https://<your-api-host>`
class ApiConfig {
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:3001',
  );
}
