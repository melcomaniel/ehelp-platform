import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'auth_service.dart';

enum LivenessPurpose { registration, application }

class LivenessSession {
  const LivenessSession({
    required this.token,
    required this.url,
    this.sessionId,
    this.purpose,
    this.provider,
  });

  final String token;
  final String url;
  final String? sessionId;
  final String? purpose;
  final String? provider;

  bool get isEverifySdk =>
      provider == 'everify_sdk' ||
      url.contains('everify-face-liveness') ||
      url.contains('liveness.everify.gov.ph');

  factory LivenessSession.fromJson(Map<String, dynamic> json) {
    return LivenessSession(
      token: json['token'] as String,
      url: rewriteLocalApiUrl(json['url'] as String),
      sessionId: json['session_id'] as String?,
      purpose: json['purpose'] as String?,
      provider: json['provider'] as String?,
    );
  }
}

/// Physical devices cannot open 127.0.0.1 on the Mac — rewrite to [ApiConfig.baseUrl].
String rewriteLocalApiUrl(String url) {
  final parsed = Uri.tryParse(url);
  if (parsed == null) return url;
  if (parsed.host != '127.0.0.1' && parsed.host != 'localhost') return url;
  final base = Uri.parse(ApiConfig.baseUrl);
  return parsed
      .replace(
        scheme: base.scheme,
        host: base.host,
        port: base.hasPort ? base.port : null,
      )
      .toString();
}

class LivenessResult {
  const LivenessResult({
    required this.passed,
    required this.status,
    required this.confidenceScore,
    this.referenceImageUrl,
    this.mappedStatus,
    this.message,
    this.threshold = 95.0,
    this.faceLivenessSessionId,
  });

  final bool passed;
  final String status;
  final double confidenceScore;
  final String? referenceImageUrl;
  final String? mappedStatus;
  final String? message;
  final double threshold;
  /// PhilSys eVerify SDK session_id when provider is everify_sdk.
  final String? faceLivenessSessionId;

  factory LivenessResult.fromJson(Map<String, dynamic> json) {
    return LivenessResult(
      passed: json['passed'] as bool? ?? false,
      status: json['status'] as String? ?? '',
      confidenceScore: (json['confidence_score'] as num?)?.toDouble() ?? 0,
      referenceImageUrl: json['reference_image_url'] as String?,
      mappedStatus: json['mapped_status'] as String?,
      message: json['message'] as String?,
      threshold: (json['threshold'] as num?)?.toDouble() ?? 95.0,
      faceLivenessSessionId: json['face_liveness_session_id'] as String?,
    );
  }
}

class LivenessService {
  LivenessService(this._auth);

  final AuthService _auth;

  Future<LivenessSession> createSession({
    required LivenessPurpose purpose,
    String? userId,
    String? applicationId,
    String callbackUrl = 'ehelp://liveness-callback',
  }) async {
    final path = _auth.currentSession == null
        ? '/auth/liveness/session/public'
        : '/auth/liveness/session';
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (_auth.currentSession != null)
        'Authorization': 'Bearer ${_auth.currentSession!.accessToken}',
    };
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: headers,
      body: jsonEncode({
        'purpose': purpose == LivenessPurpose.application
            ? 'application'
            : 'registration',
        if (userId != null) 'user_id': userId,
        'action': 'close',
        'callback_url': callbackUrl,
      }),
    );
    final data = jsonDecode(res.body.isEmpty ? '{}' : res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(data is Map ? (data['message'] ?? res.body) : res.body);
    }
    return LivenessSession.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<LivenessResult> verifyResult({
    required String sessionToken,
    String? applicationId,
    bool markProfile = true,
  }) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (_auth.currentSession != null)
        'Authorization': 'Bearer ${_auth.currentSession!.accessToken}',
    };
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/auth/liveness/verify'),
      headers: headers,
      body: jsonEncode({'session_token': sessionToken}),
    );
    final data = jsonDecode(res.body.isEmpty ? '{}' : res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(data is Map ? (data['message'] ?? res.body) : res.body);
    }
    return LivenessResult.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<void> bindEverifySession({
    required String correlation,
    required String everifySessionId,
    String? referenceImageUrl,
  }) async {
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/auth/liveness/everify-bind'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'correlation': correlation,
        'everify_session_id': everifySessionId,
        if (referenceImageUrl != null) 'reference_image_url': referenceImageUrl,
      }),
    );
    final data = jsonDecode(res.body.isEmpty ? '{}' : res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(data is Map ? (data['message'] ?? res.body) : res.body);
    }
  }
}
