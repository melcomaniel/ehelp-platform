import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/application.dart';

class ApplicationService {
  ApplicationService(this._client);

  final SupabaseClient _client;

  Future<List<ProgramTemplate>> listTemplates() async {
    final data = await _client
        .from('program_templates')
        .select()
        .eq('is_active', true)
        .order('name');
    return (data as List)
        .map((e) => ProgramTemplate.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<Region>> listRegions() async {
    final data =
        await _client.from('regions').select().eq('is_active', true).order('code');
    return (data as List)
        .map((e) => Region.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<Application>> listMyApplications(String customerId) async {
    final data = await _client
        .from('applications')
        .select('*, program_templates(name), profiles!applications_customer_id_fkey(full_name)')
        .eq('customer_id', customerId)
        .order('created_at', ascending: false);
    return (data as List)
        .map((e) => Application.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<Application>> listRegionQueue({
    required String regionId,
    List<String>? statuses,
  }) async {
    var query = _client
        .from('applications')
        .select(
          '*, program_templates(name), profiles!applications_customer_id_fkey(full_name)',
        )
        .eq('region_id', regionId);

    if (statuses != null && statuses.isNotEmpty) {
      query = query.inFilter('status', statuses);
    }

    final data = await query.order('created_at', ascending: false);
    return (data as List)
        .map((e) => Application.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Application> getApplication(String id) async {
    final data = await _client
        .from('applications')
        .select(
          '*, program_templates(name), profiles!applications_customer_id_fkey(full_name)',
        )
        .eq('id', id)
        .single();
    return Application.fromJson(data);
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
  }) async {
    if (submit) {
      if (livenessSessionToken == null ||
          livenessStatus != 'succeeded' ||
          (livenessConfidence ?? 0) < 80) {
        throw Exception(
          'Face liveness required before submit (SUCCEEDED with confidence ≥ 80).',
        );
      }
    }

    final payload = {
      'customer_id': customerId,
      'region_id': regionId,
      'template_id': templateId,
      'submitted_by': submittedBy ?? customerId,
      'form_data': formData,
      'amount_requested': amountRequested,
      'status': submit ? 'submitted' : 'draft',
      if (submit) 'submitted_at': DateTime.now().toIso8601String(),
      'reference_no': '',
      if (livenessSessionToken != null)
        'liveness_session_token': livenessSessionToken,
      if (livenessStatus != null) 'liveness_status': livenessStatus,
      if (livenessConfidence != null)
        'liveness_confidence': livenessConfidence,
      if (livenessReferenceImageUrl != null)
        'liveness_reference_image_url': livenessReferenceImageUrl,
      if (livenessStatus == 'succeeded')
        'liveness_verified_at': DateTime.now().toIso8601String(),
    };

    final data =
        await _client.from('applications').insert(payload).select().single();

    final app = Application.fromJson(data);
    await _logEvent(
      applicationId: app.id,
      actorId: submittedBy ?? customerId,
      toStatus: submit ? 'submitted' : 'draft',
      note: submit
          ? 'Application submitted with face liveness'
          : 'Draft created',
    );
    return app;
  }

  Future<Application> submitApplication(String id, String actorId) async {
    final data = await _client
        .from('applications')
        .update({
          'status': 'submitted',
          'submitted_at': DateTime.now().toIso8601String(),
        })
        .eq('id', id)
        .select()
        .single();

    await _logEvent(
      applicationId: id,
      actorId: actorId,
      fromStatus: 'draft',
      toStatus: 'submitted',
      note: 'Submitted for review',
    );
    return Application.fromJson(data);
  }

  Future<Application> decideApplication({
    required String id,
    required String approverId,
    required bool approve,
    String? notes,
    double? amountApproved,
  }) async {
    final status = approve ? 'approved' : 'declined';
    final data = await _client
        .from('applications')
        .update({
          'status': status,
          'approver_notes': notes,
          'approved_by': approverId,
          'amount_approved': amountApproved,
          'decided_at': DateTime.now().toIso8601String(),
        })
        .eq('id', id)
        .select()
        .single();

    await _logEvent(
      applicationId: id,
      actorId: approverId,
      toStatus: status,
      note: notes,
    );
    return Application.fromJson(data);
  }

  Future<Recommendation> addRecommendation({
    required String applicationId,
    required String recommendedBy,
    required RecommendationPriority priority,
    String? rationale,
  }) async {
    await _client.from('applications').update({
      'priority': priority.value,
      'status': 'recommended',
      'evaluator_notes': rationale,
      'reviewed_by': recommendedBy,
    }).eq('id', applicationId);

    final data = await _client
        .from('recommendations')
        .insert({
          'application_id': applicationId,
          'recommended_by': recommendedBy,
          'priority': priority.value,
          'rationale': rationale,
        })
        .select()
        .single();

    await _logEvent(
      applicationId: applicationId,
      actorId: recommendedBy,
      toStatus: 'recommended',
      note: 'Priority: ${priority.label}. ${rationale ?? ''}',
    );

    return Recommendation.fromJson(data);
  }

  Future<List<Recommendation>> listPendingRecommendations(String regionId) async {
    final data = await _client
        .from('recommendations')
        .select(
          '*, applications!inner(*, program_templates(name), profiles!applications_customer_id_fkey(full_name))',
        )
        .eq('is_acted_on', false)
        .eq('applications.region_id', regionId)
        .order('created_at', ascending: false);

    return (data as List)
        .map((e) => Recommendation.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> markRecommendationActedOn({
    required String recommendationId,
    required String actorId,
  }) async {
    await _client.from('recommendations').update({
      'is_acted_on': true,
      'acted_on_by': actorId,
      'acted_on_at': DateTime.now().toIso8601String(),
    }).eq('id', recommendationId);
  }

  Future<List<DependentLink>> listDependents(String principalId) async {
    final data = await _client
        .from('dependent_links')
        .select(
          '*, dependent:profiles!dependent_links_dependent_id_fkey(full_name), principal:profiles!dependent_links_principal_id_fkey(full_name)',
        )
        .eq('principal_id', principalId)
        .order('created_at', ascending: false);

    return (data as List)
        .map((e) => DependentLink.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<DependentLink>> listLinkedPrincipals(String dependentId) async {
    final data = await _client
        .from('dependent_links')
        .select(
          '*, dependent:profiles!dependent_links_dependent_id_fkey(full_name), principal:profiles!dependent_links_principal_id_fkey(full_name)',
        )
        .eq('dependent_id', dependentId)
        .order('created_at', ascending: false);

    return (data as List)
        .map((e) => DependentLink.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<DependentLink> registerDependent({
    required String principalId,
    required String dependentId,
    required String relationship,
    bool isNotarized = false,
    String? notes,
  }) async {
    final data = await _client
        .from('dependent_links')
        .insert({
          'principal_id': principalId,
          'dependent_id': dependentId,
          'relationship': relationship,
          'is_notarized': isNotarized,
          'notes': notes,
        })
        .select()
        .single();
    return DependentLink.fromJson(data);
  }

  Future<void> _logEvent({
    required String applicationId,
    required String actorId,
    String? fromStatus,
    required String toStatus,
    String? note,
  }) async {
    await _client.from('application_events').insert({
      'application_id': applicationId,
      'actor_id': actorId,
      'from_status': fromStatus,
      'to_status': toStatus,
      'note': note,
    });
  }
}
