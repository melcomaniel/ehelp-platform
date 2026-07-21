import 'package:supabase_flutter/supabase_flutter.dart';

enum LivenessPurpose { registration, application }

class LivenessSession {
  const LivenessSession({
    required this.token,
    required this.url,
    this.sessionId,
    this.purpose,
  });

  final String token;
  final String url;
  final String? sessionId;
  final String? purpose;

  factory LivenessSession.fromJson(Map<String, dynamic> json) {
    return LivenessSession(
      token: json['token'] as String,
      url: json['url'] as String,
      sessionId: json['session_id'] as String?,
      purpose: json['purpose'] as String?,
    );
  }
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
  });

  final bool passed;
  final String status;
  final double confidenceScore;
  final String? referenceImageUrl;
  final String? mappedStatus;
  final String? message;
  final double threshold;

  factory LivenessResult.fromJson(Map<String, dynamic> json) {
    return LivenessResult(
      passed: json['passed'] as bool? ?? false,
      status: json['status'] as String? ?? '',
      confidenceScore: (json['confidence_score'] as num?)?.toDouble() ?? 0,
      referenceImageUrl: json['reference_image_url'] as String?,
      mappedStatus: json['mapped_status'] as String?,
      message: json['message'] as String?,
      threshold: (json['threshold'] as num?)?.toDouble() ?? 95.0,
    );
  }
}

class LivenessService {
  LivenessService(this._client);

  final SupabaseClient _client;

  Future<LivenessSession> createSession({
    required LivenessPurpose purpose,
    String? userId,
    String? applicationId,
    String callbackUrl = 'ehelp://liveness-callback',
  }) async {
    final response = await _client.functions.invoke(
      'liveness-create-session',
      body: {
        'purpose': purpose == LivenessPurpose.application
            ? 'application'
            : 'registration',
        if (userId != null) 'user_id': userId,
        if (applicationId != null) 'application_id': applicationId,
        'action': 'close',
        'callback_url': callbackUrl,
        'delay': 2000,
      },
    );

    final data = _asMap(response.data);
    if (data['error'] != null) {
      _throwFrom(data);
    }
    return LivenessSession.fromJson(data);
  }

  Future<LivenessResult> verifyResult({
    required String sessionToken,
    String? applicationId,
    bool markProfile = true,
  }) async {
    final response = await _client.functions.invoke(
      'liveness-verify-result',
      body: {
        'session_token': sessionToken,
        if (applicationId != null) 'application_id': applicationId,
        'mark_profile': markProfile,
      },
    );

    final data = _asMap(response.data);
    if (data['error'] != null) {
      _throwFrom(data);
    }
    return LivenessResult.fromJson(data);
  }

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    throw Exception('Unexpected response: $data');
  }

  Never _throwFrom(Map<String, dynamic> data) {
    final error = data['error']?.toString() ?? 'Liveness request failed';
    final hint = data['hint']?.toString();
    final upstream = data['upstream_status'];
    final details = data['details'];
    final parts = <String>[error];
    if (hint != null) parts.add(hint);
    if (upstream != null) parts.add('Upstream HTTP $upstream');
    if (details != null) parts.add('Details: $details');
    throw Exception(parts.join(' — '));
  }
}
