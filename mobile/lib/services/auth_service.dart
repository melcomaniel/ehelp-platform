import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../models/app_role.dart';
import '../models/profile.dart';

class AppSession {
  const AppSession({
    required this.accessToken,
    required this.userId,
  });

  final String accessToken;
  final String userId;
}

class AuthEvent {
  const AuthEvent({this.session});
  final AppSession? session;
}

class AuthService {
  AuthService();

  final _secure = const FlutterSecureStorage();
  final _controller = StreamController<AuthEvent>.broadcast();

  static const _tokenKey = 'ehelp_access_token';
  static const _userIdKey = 'ehelp_user_id';
  static const _pinKeyPrefix = 'ehelp_pin_';

  AppSession? _session;
  AppSession? get currentSession => _session;
  String? get currentUserId => _session?.userId;

  Stream<AuthEvent> get authStateChanges async* {
    yield AuthEvent(session: _session);
    yield* _controller.stream;
  }

  Future<void> restoreSession() async {
    final token = await _secure.read(key: _tokenKey);
    final userId = await _secure.read(key: _userIdKey);
    if (token != null && userId != null) {
      _session = AppSession(accessToken: token, userId: userId);
      _controller.add(AuthEvent(session: _session));
    }
  }

  Future<void> _persist(AppSession session) async {
    _session = session;
    await _secure.write(key: _tokenKey, value: session.accessToken);
    await _secure.write(key: _userIdKey, value: session.userId);
    _controller.add(AuthEvent(session: _session));
  }

  Future<void> _clear() async {
    _session = null;
    await _secure.delete(key: _tokenKey);
    await _secure.delete(key: _userIdKey);
    _controller.add(const AuthEvent(session: null));
  }

  Uri _uri(String path) => Uri.parse('${ApiConfig.baseUrl}$path');

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'X-Client-Platform': 'mobile',
        if (_session != null) 'Authorization': 'Bearer ${_session!.accessToken}',
      };

  Map<String, String> get _authHeaders => _headers;

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body, {
    bool auth = false,
  }) async {
    final res = await http.post(
      _uri(path),
      headers: auth
          ? _authHeaders
          : {
              'Content-Type': 'application/json',
              'X-Client-Platform': 'mobile',
            },
      body: jsonEncode({
        ...body,
        'client_platform': 'mobile',
      }),
    );
    final map = jsonDecode(res.body.isEmpty ? '{}' : res.body);
    if (res.statusCode == 403) {
      await _clear();
      final msg = map is Map
          ? (map['message'] ??
              'This account must use the web staff portal')
          : 'This account must use the web staff portal';
      throw Exception(msg.toString());
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = map is Map && map['message'] != null
          ? map['message'].toString()
          : 'Request failed (${res.statusCode})';
      throw Exception(msg);
    }
    return Map<String, dynamic>.from(map as Map);
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final res = await http.get(_uri(path), headers: _authHeaders);
    final map = jsonDecode(res.body.isEmpty ? '{}' : res.body);
    if (res.statusCode == 403) {
      await _clear();
      throw Exception(
        map is Map
            ? (map['message'] ?? 'Use the web staff portal').toString()
            : 'Use the web staff portal',
      );
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Request failed (${res.statusCode})');
    }
    return Map<String, dynamic>.from(map as Map);
  }

  Future<Map<String, dynamic>> exchangeSsoCode(String exchangeCode) async {
    final data = await _post('/auth/sso/exchange', {
      'exchange_code': exchangeCode,
    });
    await _persist(
      AppSession(
        accessToken: data['access_token'] as String,
        userId: (data['user'] as Map)['id'] as String,
      ),
    );
    return data;
  }

  /// Dev/mock login (AUTH_PROVIDER_MODE=mock on Nest).
  Future<void> signIn({
    required String email,
    required String password,
  }) async {
    final data = await _post('/auth/dev/login', {
      'email': email,
      'password': password,
    });
    await _persist(
      AppSession(
        accessToken: data['access_token'] as String,
        userId: (data['user'] as Map)['id'] as String,
      ),
    );
  }

  /// Kept for UI compatibility — SSO replaces real signup.
  Future<void> signUp({
    required String email,
    required String password,
    required String fullName,
    required AppRole role,
    String? phone,
  }) {
    return signIn(email: email, password: password);
  }

  Future<void> signInWithOtp({required String email}) async {
    throw Exception('OTP login removed — use eGov SSO');
  }

  Future<void> verifyOtp({
    required String email,
    required String token,
  }) async {
    throw Exception('OTP login removed — use eGov SSO');
  }

  Future<void> signOut() => _clear();

  Future<Profile?> fetchProfile([String? userId]) async {
    if (_session == null) return null;
    final data = await _get('/auth/me');
    return Profile.fromJson(data);
  }

  Future<Profile> updateProfile(Map<String, dynamic> updates) async {
    throw Exception('Profile is locked — update via eGovPH only');
  }

  Future<Map<String, dynamic>> completeFirstTimeEverify({
    required String faceLivenessSessionId,
    String? qrValue,
    String? firstName,
    String? middleName,
    String? lastName,
    String? suffix,
    String? birthDate,
  }) async {
    final data = await _post(
      '/auth/everify/first-time',
      {
        'face_liveness_session_id': faceLivenessSessionId,
        if (qrValue != null) 'qr_value': qrValue,
        if (firstName != null) 'first_name': firstName,
        if (middleName != null) 'middle_name': middleName,
        if (lastName != null) 'last_name': lastName,
        if (suffix != null) 'suffix': suffix,
        if (birthDate != null) 'birth_date': birthDate,
      },
      auth: true,
    );
    final token = data['access_token'] as String?;
    final user = data['user'] as Map?;
    if (token != null && user != null && user['id'] != null) {
      await _persist(
        AppSession(accessToken: token, userId: user['id'] as String),
      );
    }
    return data;
  }

  Future<void> saveLocalPin(String pin) async {
    final id = currentUserId;
    if (id == null) return;
    await _secure.write(key: '$_pinKeyPrefix$id', value: pin);
  }

  Future<bool> verifyLocalPin(String pin) async {
    final id = currentUserId;
    if (id == null) return false;
    final stored = await _secure.read(key: '$_pinKeyPrefix$id');
    return stored == pin;
  }

  Future<bool> hasLocalPin() async {
    final id = currentUserId;
    if (id == null) return false;
    final stored = await _secure.read(key: '$_pinKeyPrefix$id');
    return stored != null && stored.isNotEmpty;
  }

  void dispose() {
    _controller.close();
  }
}
