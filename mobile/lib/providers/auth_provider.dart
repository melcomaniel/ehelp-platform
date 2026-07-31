import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../models/app_role.dart';
import '../models/profile.dart';
import '../services/application_service.dart';
import '../services/auth_service.dart';
import '../services/liveness_service.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  final service = AuthService();
  ref.onDispose(service.dispose);
  return service;
});

final applicationServiceProvider = Provider<ApplicationService>(
  (ref) => ApplicationService(ref.watch(authServiceProvider)),
);

final authStateProvider = StreamProvider<AuthEvent>((ref) {
  return ref.watch(authServiceProvider).authStateChanges;
});

final currentProfileProvider = FutureProvider<Profile?>((ref) async {
  ref.watch(authStateProvider);
  final auth = ref.watch(authServiceProvider);
  if (auth.currentSession == null) return null;
  return auth.fetchProfile();
});

final livenessServiceProvider = Provider<LivenessService>((ref) {
  return LivenessService(ref.watch(authServiceProvider));
});

class AuthController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  AuthService get _auth => ref.read(authServiceProvider);

  Future<void> signIn(String email, String password) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await _auth.signIn(email: email, password: password);
      ref.invalidate(currentProfileProvider);
    });
  }

  /// SSO only — returns pending_login_token; does not open a session.
  Future<Map<String, dynamic>?> exchangeSso(String exchangeCode) async {
    state = const AsyncValue.loading();
    Map<String, dynamic>? result;
    state = await AsyncValue.guard(() async {
      result = await _auth.exchangeSsoCode(exchangeCode);
    });
    return result;
  }

  Future<void> completeLogin({
    required String pendingLoginToken,
    required String livenessSessionToken,
  }) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await _auth.completeLogin(
        pendingLoginToken: pendingLoginToken,
        livenessSessionToken: livenessSessionToken,
      );
      ref.invalidate(currentProfileProvider);
    });
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String fullName,
    required String roleValue,
    String? phone,
  }) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await _auth.signUp(
        email: email,
        password: password,
        fullName: fullName,
        role: AppRole.fromString(roleValue),
        phone: phone,
      );
      ref.invalidate(currentProfileProvider);
    });
  }

  Future<void> sendOtp(String email) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _auth.signInWithOtp(email: email));
  }

  Future<void> verifyOtp(String email, String token) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      await _auth.verifyOtp(email: email, token: token);
      ref.invalidate(currentProfileProvider);
    });
  }

  Future<void> signOut() async {
    await _auth.signOut();
    ref.invalidate(currentProfileProvider);
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AsyncValue<void>>(AuthController.new);

/// Health ping helper for diagnostics.
final apiHealthProvider = FutureProvider<bool>((ref) async {
  try {
    final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/auth/me'));
    return res.statusCode == 401 || res.statusCode == 200;
  } catch (_) {
    return false;
  }
});
