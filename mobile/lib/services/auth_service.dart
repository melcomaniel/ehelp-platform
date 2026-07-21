import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/app_role.dart';
import '../models/profile.dart';

class AuthService {
  AuthService(this._client);

  final SupabaseClient _client;
  final _secure = const FlutterSecureStorage();

  static const _pinKeyPrefix = 'ehelp_pin_';

  Session? get currentSession => _client.auth.currentSession;
  User? get currentUser => _client.auth.currentUser;

  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;

  Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String fullName,
    required AppRole role,
    String? phone,
  }) {
    return _client.auth.signUp(
      email: email,
      password: password,
      data: {
        'full_name': fullName,
        'role': role.value,
        if (phone != null) 'phone': phone,
      },
    );
  }

  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) {
    return _client.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signInWithOtp({required String email}) {
    return _client.auth.signInWithOtp(email: email);
  }

  Future<AuthResponse> verifyOtp({
    required String email,
    required String token,
  }) {
    return _client.auth.verifyOTP(
      email: email,
      token: token,
      type: OtpType.email,
    );
  }

  Future<void> signOut() => _client.auth.signOut();

  Future<Profile?> fetchProfile([String? userId]) async {
    final id = userId ?? currentUser?.id;
    if (id == null) return null;

    final data =
        await _client.from('profiles').select().eq('id', id).maybeSingle();
    if (data == null) return null;
    return Profile.fromJson(data);
  }

  Future<Profile> updateProfile(Map<String, dynamic> updates) async {
    final id = currentUser?.id;
    if (id == null) throw Exception('Not authenticated');

    final data = await _client
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    return Profile.fromJson(data);
  }

  Future<void> saveLocalPin(String pin) async {
    final id = currentUser?.id;
    if (id == null) return;
    await _secure.write(key: '$_pinKeyPrefix$id', value: pin);

    final expires = DateTime.now().add(const Duration(days: 90)).toIso8601String();
    await _client.from('profiles').update({
      'pin_expires_at': expires,
    }).eq('id', id);
  }

  Future<bool> verifyLocalPin(String pin) async {
    final id = currentUser?.id;
    if (id == null) return false;
    final stored = await _secure.read(key: '$_pinKeyPrefix$id');
    return stored == pin;
  }

  Future<bool> hasLocalPin() async {
    final id = currentUser?.id;
    if (id == null) return false;
    final stored = await _secure.read(key: '$_pinKeyPrefix$id');
    return stored != null && stored.isNotEmpty;
  }
}
