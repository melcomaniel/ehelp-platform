import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../models/application.dart';
import 'auth_service.dart';

/// NestJS domain API client (programs, offices, applications, relationships).
class ApplicationService {
  ApplicationService(this._auth);

  final AuthService _auth;

  Uri _uri(String path, [Map<String, String>? query]) => Uri.parse(
        '${ApiConfig.baseUrl}$path',
      ).replace(queryParameters: query);

  Map<String, String> get _headers {
    final token = _auth.currentSession?.accessToken;
    return {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'mobile',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<Map<String, dynamic>> _json(
    http.Response res, {
    String fallback = 'Request failed',
  }) async {
    final body = res.body.isEmpty ? {} : jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (body is Map<String, dynamic>) return body;
      throw StateError('Expected object response');
    }
    final msg = body is Map ? (body['message'] ?? fallback) : fallback;
    throw Exception(msg is List ? msg.join(', ') : msg.toString());
  }

  Future<List<dynamic>> _jsonList(http.Response res) async {
    final body = res.body.isEmpty ? [] : jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (body is List) return body;
      throw StateError('Expected list response');
    }
    final msg = body is Map ? body['message'] : 'Request failed';
    throw Exception(msg is List ? msg.join(', ') : msg.toString());
  }

  Future<List<ProgramTemplate>> listTemplates() async {
    final res = await http.get(_uri('/templates'), headers: _headers);
    final list = await _jsonList(res);
    return list
        .map((e) => ProgramTemplate.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<List<Region>> listRegions() async {
    final res = await http.get(_uri('/regions'), headers: _headers);
    final list = await _jsonList(res);
    return list
        .map((e) => Region.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<List<Application>> listMyApplications(String customerId) async {
    final res = await http.get(_uri('/applications/me'), headers: _headers);
    final list = await _jsonList(res);
    return list
        .map((e) => Application.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<List<Application>> listRegionQueue({
    required String regionId,
    List<String>? statuses,
  }) async {
    final res = await http.get(
      _uri('/applications/queue', {
        if (statuses != null && statuses.isNotEmpty)
          'statuses': statuses.join(','),
      }),
      headers: _headers,
    );
    final list = await _jsonList(res);
    // Client-side office filter when staff profile office differs
    return list
        .map((e) => Application.fromJson(Map<String, dynamic>.from(e as Map)))
        .where((a) => regionId.isEmpty || a.regionId == regionId)
        .toList();
  }

  Future<Application> getApplication(String id) async {
    final res = await http.get(_uri('/applications/$id'), headers: _headers);
    final json = await _json(res);
    return Application.fromJson(json);
  }

  Future<Application> createApplication({
    required String customerId,
    required String regionId,
    required String templateId,
    String? submittedBy,
    Map<String, dynamic> formData = const {},
    double? amountRequested,
    bool submit = false,
    String? livenessSessionToken,
    String? livenessStatus,
    double? livenessConfidence,
    String? livenessReferenceImageUrl,
    String? livenessImageUrl,
  }) async {
    final res = await http.post(
      _uri('/applications'),
      headers: _headers,
      body: jsonEncode({
        'office_id': regionId,
        'template_id': templateId,
        'customer_user_id': customerId,
        'form_data': formData,
        if (amountRequested != null) 'amount_requested': amountRequested,
        'submit': submit,
      }),
    );
    final json = await _json(res, fallback: 'Create application failed');
    return Application.fromJson(json);
  }

  Future<Application> submitApplication(String id, String actorId) async {
    final res = await http.post(
      _uri('/applications/$id/submit'),
      headers: _headers,
      body: '{}',
    );
    final json = await _json(res, fallback: 'Submit failed');
    return Application.fromJson(json);
  }

  Future<Application> updateApplication(
    String id,
    Map<String, dynamic> updates,
  ) async {
    final res = await http.patch(
      _uri('/applications/$id'),
      headers: _headers,
      body: jsonEncode({
        if (updates.containsKey('form_data')) 'form_data': updates['form_data'],
        if (updates.containsKey('amount_requested'))
          'amount_requested': updates['amount_requested'],
        if (updates.containsKey('status')) 'status': updates['status'],
      }),
    );
    final json = await _json(res, fallback: 'Update failed');
    return Application.fromJson(json);
  }

  Future<Application> decideApplication({
    required String id,
    required String approverId,
    required bool approve,
    String? notes,
    double? amountApproved,
  }) async {
    final res = await http.post(
      _uri('/applications/$id/decide'),
      headers: _headers,
      body: jsonEncode({
        'approve': approve,
        if (notes != null) 'notes': notes,
        if (amountApproved != null) 'amount_approved': amountApproved,
      }),
    );
    final json = await _json(res, fallback: 'Decision failed');
    return Application.fromJson(json);
  }

  Future<Recommendation> addRecommendation({
    required String applicationId,
    required String recommendedBy,
    required RecommendationPriority priority,
    String? rationale,
  }) async {
    final res = await http.post(
      _uri('/applications/$applicationId/recommend'),
      headers: _headers,
      body: jsonEncode({
        'notes': rationale,
        'priority': priority.value,
      }),
    );
    final json = await _json(res, fallback: 'Recommend failed');
    return Recommendation.fromJson(json);
  }

  Future<List<Recommendation>> listPendingRecommendations(
    String regionId,
  ) async {
    final res = await http.get(
      _uri('/recommendations/pending'),
      headers: _headers,
    );
    final list = await _jsonList(res);
    return list
        .map(
          (e) => Recommendation.fromJson(Map<String, dynamic>.from(e as Map)),
        )
        .toList();
  }

  Future<List<Recommendation>> listRecommendations({
    String? regionId,
  }) async {
    return listPendingRecommendations(regionId ?? '');
  }

  Future<void> markRecommendationActedOn({
    required String recommendationId,
    required String actorId,
  }) async {
    // Acted-on is implied by decide(); no-op for Nest MVP.
  }

  Future<Recommendation> createRecommendation({
    required String applicationId,
    required String evaluatorId,
    required String regionId,
    String? notes,
    int? priority,
  }) {
    return addRecommendation(
      applicationId: applicationId,
      recommendedBy: evaluatorId,
      priority: RecommendationPriority.medium,
      rationale: notes,
    );
  }

  Future<List<DependentLink>> listDependents(String principalId) async {
    final res = await http.get(
      _uri('/relationships/dependents'),
      headers: _headers,
    );
    final list = await _jsonList(res);
    return list
        .map((e) => DependentLink.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<List<DependentLink>> listLinkedPrincipals(String dependentId) async {
    final res = await http.get(
      _uri('/relationships/principals'),
      headers: _headers,
    );
    final list = await _jsonList(res);
    return list
        .map((e) => DependentLink.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<DependentLink> registerDependent({
    required String principalId,
    required String dependentId,
    required String relationship,
    bool isNotarized = false,
    String? notes,
  }) async {
    final res = await http.post(
      _uri('/relationships'),
      headers: _headers,
      body: jsonEncode({
        'principal_user_id': principalId,
        'dependent_user_id': dependentId,
        'relationship': relationship,
        if (notes != null) 'notes': notes,
      }),
    );
    final json = await _json(res, fallback: 'Register dependent failed');
    return DependentLink.fromJson(json);
  }

  Future<void> createDependentLink({
    required String principalId,
    required String dependentId,
    required String relationship,
  }) async {
    await registerDependent(
      principalId: principalId,
      dependentId: dependentId,
      relationship: relationship,
    );
  }
}
