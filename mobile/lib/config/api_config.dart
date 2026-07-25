/// Compile-time API config for NestJS Core.
///
/// Examples:
/// - iOS Simulator / desktop: `http://127.0.0.1:3001`
/// - Android emulator: `http://10.0.2.2:3001`
/// - Physical phone (same Wi‑Fi as Mac): `http://<YOUR_MAC_LAN_IP>:3001`
///   e.g. `flutter run --dart-define=API_BASE_URL=http://192.168.1.23:3001`
class ApiConfig {
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:3001',
  );
}
