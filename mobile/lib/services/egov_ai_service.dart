import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'auth_service.dart';

class EgovAiService {
  EgovAiService(this._auth);

  final AuthService _auth;

  Map<String, String> get _headers {
    final token = _auth.currentSession?.accessToken;
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Platform': 'mobile',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<({String answer, String sessionId, String mode})> ask({
    required String prompt,
    String category = 'PH',
  }) async {
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/integrations/egov-ai/assistant'),
      headers: _headers,
      body: jsonEncode({'prompt': prompt, 'category': category}),
    );
    final body = jsonDecode(res.body.isEmpty ? '{}' : res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      String msg = 'AI assistant failed (${res.statusCode})';
      if (body is Map) {
        final m = body['message'];
        if (m is List && m.isNotEmpty) {
          msg = m.map((e) => e.toString()).join('; ');
        } else if (m != null) {
          msg = m.toString();
        }
      }
      throw Exception(msg);
    }
    final map = Map<String, dynamic>.from(body as Map);
    return (
      answer: (map['data'] ?? '').toString(),
      sessionId: (map['session_id'] ?? '').toString(),
      mode: (map['mode'] ?? 'mock').toString(),
    );
  }
}
