import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'auth_service.dart';

class EreportCategory {
  EreportCategory({
    required this.code,
    required this.label,
    required this.description,
  });

  final String code;
  final String label;
  final String description;

  factory EreportCategory.fromJson(Map<String, dynamic> json) {
    return EreportCategory(
      code: (json['code'] ?? '').toString(),
      label: (json['label'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
    );
  }
}

class EreportCase {
  EreportCase({
    required this.caseNumber,
    required this.categoryCode,
    required this.subject,
    required this.message,
    required this.mode,
    this.createdAt,
  });

  final String caseNumber;
  final String categoryCode;
  final String subject;
  final String message;
  final String mode;
  final String? createdAt;

  factory EreportCase.fromJson(Map<String, dynamic> json) {
    return EreportCase(
      caseNumber: (json['case_number'] ?? '').toString(),
      categoryCode: (json['category_code'] ?? '').toString(),
      subject: (json['subject'] ?? '').toString(),
      message: (json['message'] ?? '').toString(),
      mode: (json['mode'] ?? '').toString(),
      createdAt: json['created_at']?.toString(),
    );
  }
}

class EreportService {
  EreportService(this._auth);

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

  Future<List<EreportCategory>> categories() async {
    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/integrations/ereport/categories'),
      headers: _headers,
    );
    final body = jsonDecode(res.body.isEmpty ? '[]' : res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(_errorMessage(body, res.statusCode));
    }
    final list = body is List ? body : <dynamic>[];
    return list
        .whereType<Map>()
        .map((e) => EreportCategory.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<({String caseNumber, String mode, String message})> submit({
    required String categoryCode,
    required String subject,
    required String message,
  }) async {
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/integrations/ereport/complaints'),
      headers: _headers,
      body: jsonEncode({
        'category_code': categoryCode,
        'subject': subject,
        'message': message,
      }),
    );
    final body = jsonDecode(res.body.isEmpty ? '{}' : res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(_errorMessage(body, res.statusCode));
    }
    final map = Map<String, dynamic>.from(body as Map);
    return (
      caseNumber: (map['case_number'] ?? '').toString(),
      mode: (map['mode'] ?? '').toString(),
      message: (map['message'] ?? 'Report submitted').toString(),
    );
  }

  Future<List<EreportCase>> myCases() async {
    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/integrations/ereport/my-cases'),
      headers: _headers,
    );
    final body = jsonDecode(res.body.isEmpty ? '[]' : res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(_errorMessage(body, res.statusCode));
    }
    final list = body is List ? body : <dynamic>[];
    return list
        .whereType<Map>()
        .map((e) => EreportCase.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  String _errorMessage(dynamic body, int status) {
    if (body is Map) {
      final m = body['message'];
      if (m is List && m.isNotEmpty) {
        return m.map((e) => e.toString()).join('; ');
      }
      if (m != null) return m.toString();
    }
    return 'eReport request failed ($status)';
  }
}
