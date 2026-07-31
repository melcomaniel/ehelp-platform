enum ApplicationStatus {
  draft('draft', 'Draft'),
  submitted('submitted', 'Submitted'),
  underReview('under_review', 'Under Review'),
  recommended('recommended', 'Recommended'),
  approved('approved', 'Approved'),
  declined('declined', 'Declined'),
  disbursed('disbursed', 'Disbursed'),
  claimed('claimed', 'Claimed'),
  cancelled('cancelled', 'Cancelled');

  const ApplicationStatus(this.value, this.label);
  final String value;
  final String label;

  static ApplicationStatus fromString(String? v) =>
      ApplicationStatus.values.firstWhere(
        (e) => e.value == v,
        orElse: () => ApplicationStatus.draft,
      );

  bool get isTerminal =>
      this == ApplicationStatus.approved ||
      this == ApplicationStatus.declined ||
      this == ApplicationStatus.disbursed ||
      this == ApplicationStatus.claimed ||
      this == ApplicationStatus.cancelled;
}

enum RecommendationPriority {
  low('low', 'Low'),
  medium('medium', 'Medium'),
  high('high', 'High'),
  urgent('urgent', 'Urgent');

  const RecommendationPriority(this.value, this.label);
  final String value;
  final String label;

  static RecommendationPriority fromString(String? v) =>
      RecommendationPriority.values.firstWhere(
        (e) => e.value == v,
        orElse: () => RecommendationPriority.medium,
      );
}

class ProgramTemplate {
  const ProgramTemplate({
    required this.id,
    required this.name,
    this.code,
    this.description,
    this.disbursementCooldownDays = 90,
    this.eligibilityRules = const {},
    this.canApply = true,
    this.applyBlockReason,
    this.applyBlockMessage,
    this.cooldownRemainingDays,
    this.eligibleAgainAt,
    this.lastClaimedAt,
  });

  final String id;
  final String name;
  final String? code;
  final String? description;
  final int disbursementCooldownDays;
  final Map<String, dynamic> eligibilityRules;
  final bool canApply;
  final String? applyBlockReason;
  final String? applyBlockMessage;
  final int? cooldownRemainingDays;
  final DateTime? eligibleAgainAt;
  final DateTime? lastClaimedAt;

  bool get isOnCooldown => applyBlockReason == 'cooldown';

  factory ProgramTemplate.fromJson(Map<String, dynamic> json) {
    return ProgramTemplate(
      id: json['id'] as String,
      name: json['name'] as String,
      code: json['code'] as String?,
      description: json['description'] as String?,
      disbursementCooldownDays:
          (json['disbursement_cooldown_days'] as num?)?.toInt() ?? 90,
      eligibilityRules: Map<String, dynamic>.from(
        json['eligibility_rules'] as Map? ?? {},
      ),
      canApply: json['can_apply'] as bool? ?? true,
      applyBlockReason: json['apply_block_reason'] as String?,
      applyBlockMessage: json['apply_block_message'] as String?,
      cooldownRemainingDays:
          (json['cooldown_remaining_days'] as num?)?.toInt(),
      eligibleAgainAt: json['eligible_again_at'] != null
          ? DateTime.tryParse(json['eligible_again_at'] as String)
          : null,
      lastClaimedAt: json['last_claimed_at'] != null
          ? DateTime.tryParse(json['last_claimed_at'] as String)
          : null,
    );
  }
}

class ProgramDetailField {
  const ProgramDetailField({
    required this.key,
    required this.type,
    required this.label,
    this.helpText = '',
    this.required = false,
    this.options = const [],
    this.multiline = false,
  });

  final String key;
  final String type;
  final String label;
  final String helpText;
  final bool required;
  final List<String> options;
  final bool multiline;

  factory ProgramDetailField.fromJson(Map<String, dynamic> json) {
    return ProgramDetailField(
      key: json['key'] as String? ?? json['id'] as String? ?? 'field',
      type: json['type'] as String? ?? 'text',
      label: json['label'] as String? ?? json['key'] as String? ?? 'Field',
      helpText: json['help_text'] as String? ?? '',
      required: json['required'] as bool? ?? false,
      options: (json['options'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      multiline: json['multiline'] as bool? ?? false,
    );
  }
}

class ProgramDetailStage {
  const ProgramDetailStage({required this.name, required this.type});

  final String name;
  final String type;

  factory ProgramDetailStage.fromJson(Map<String, dynamic> json) {
    return ProgramDetailStage(
      name: json['name'] as String? ?? 'Step',
      type: json['type'] as String? ?? 'form',
    );
  }
}

/// Nest GET /templates/:id — stages + form fields from the attached builder workflow.
class ProgramDetail {
  const ProgramDetail({
    required this.id,
    required this.name,
    this.code,
    this.description,
    this.disbursementCooldownDays = 90,
    this.formTitle,
    this.formSubtitle,
    this.stages = const [],
    this.fields = const [],
    this.canApply = true,
    this.applyBlockReason,
    this.applyBlockMessage,
    this.cooldownRemainingDays,
    this.eligibleAgainAt,
    this.lastClaimedAt,
    this.activeApplicationId,
    this.lastClaimApplicationId,
  });

  final String id;
  final String name;
  final String? code;
  final String? description;
  final int disbursementCooldownDays;
  final String? formTitle;
  final String? formSubtitle;
  final List<ProgramDetailStage> stages;
  final List<ProgramDetailField> fields;
  final bool canApply;
  final String? applyBlockReason;
  final String? applyBlockMessage;
  final int? cooldownRemainingDays;
  final DateTime? eligibleAgainAt;
  final DateTime? lastClaimedAt;
  final String? activeApplicationId;
  final String? lastClaimApplicationId;

  bool get isOnCooldown => applyBlockReason == 'cooldown';

  factory ProgramDetail.fromJson(Map<String, dynamic> json) {
    return ProgramDetail(
      id: json['id'] as String,
      name: json['name'] as String,
      code: json['code'] as String?,
      description: json['description'] as String?,
      disbursementCooldownDays:
          (json['disbursement_cooldown_days'] as num?)?.toInt() ?? 90,
      formTitle: json['form_title'] as String?,
      formSubtitle: json['form_subtitle'] as String?,
      stages: (json['stages'] as List? ?? [])
          .map((e) => ProgramDetailStage.fromJson(
                Map<String, dynamic>.from(e as Map),
              ))
          .toList(),
      fields: (json['fields'] as List? ?? [])
          .map((e) => ProgramDetailField.fromJson(
                Map<String, dynamic>.from(e as Map),
              ))
          .toList(),
      canApply: json['can_apply'] as bool? ?? true,
      applyBlockReason: json['apply_block_reason'] as String?,
      applyBlockMessage: json['apply_block_message'] as String?,
      cooldownRemainingDays:
          (json['cooldown_remaining_days'] as num?)?.toInt(),
      eligibleAgainAt: json['eligible_again_at'] != null
          ? DateTime.tryParse(json['eligible_again_at'] as String)
          : null,
      lastClaimedAt: json['last_claimed_at'] != null
          ? DateTime.tryParse(json['last_claimed_at'] as String)
          : null,
      activeApplicationId: json['active_application_id'] as String?,
      lastClaimApplicationId: json['last_claim_application_id'] as String?,
    );
  }
}

class Region {
  const Region({required this.id, required this.code, required this.name});

  final String id;
  final String code;
  final String name;

  factory Region.fromJson(Map<String, dynamic> json) {
    return Region(
      id: json['id'] as String,
      code: json['code'] as String,
      name: json['name'] as String,
    );
  }
}

class Application {
  const Application({
    required this.id,
    required this.referenceNo,
    required this.customerId,
    this.submittedBy,
    required this.regionId,
    required this.templateId,
    required this.status,
    this.formData = const {},
    this.amountRequested,
    this.amountApproved,
    this.priority = RecommendationPriority.medium,
    this.evaluatorNotes,
    this.approverNotes,
    this.submittedAt,
    this.decidedAt,
    this.createdAt,
    this.customerName,
    this.templateName,
    this.livenessStatus,
    this.livenessConfidence,
    this.livenessVerifiedAt,
    this.stages,
    this.currentStageType,
    this.formFields,
    this.answersLocked = false,
    this.periodWindows,
    this.disbursementClaim,
    this.disbursementBooking,
  });

  final String id;
  final String referenceNo;
  final String customerId;
  final String? submittedBy;
  final String regionId;
  final String templateId;
  final ApplicationStatus status;
  final Map<String, dynamic> formData;
  final double? amountRequested;
  final double? amountApproved;
  final RecommendationPriority priority;
  final String? evaluatorNotes;
  final String? approverNotes;
  final DateTime? submittedAt;
  final DateTime? decidedAt;
  final DateTime? createdAt;
  final String? customerName;
  final String? templateName;
  final String? livenessStatus;
  final double? livenessConfidence;
  final DateTime? livenessVerifiedAt;
  final List<Map<String, dynamic>>? stages;
  final String? currentStageType;
  final List<Map<String, dynamic>>? formFields;
  final bool answersLocked;
  final Map<String, dynamic>? periodWindows;
  final DisbursementClaimInfo? disbursementClaim;
  final DisbursementBookingInfo? disbursementBooking;

  bool get isDisbursementComplete =>
      status == ApplicationStatus.claimed ||
      status == ApplicationStatus.disbursed ||
      disbursementClaim != null;

  factory Application.fromJson(Map<String, dynamic> json) {
    final customer = json['profiles'] as Map<String, dynamic>?;
    final template = json['program_templates'] as Map<String, dynamic>?;
    final stagesRaw = json['stages'];
    final fieldsRaw = json['form_fields'];

    return Application(
      id: json['id'] as String,
      referenceNo: json['reference_no'] as String? ?? '',
      customerId: (json['customer_id'] ?? customer?['id']) as String,
      submittedBy: json['submitted_by'] as String?,
      regionId: json['region_id'] as String,
      templateId: json['template_id'] as String,
      status: ApplicationStatus.fromString(json['status'] as String?),
      formData: Map<String, dynamic>.from(json['form_data'] as Map? ?? {}),
      amountRequested: (json['amount_requested'] as num?)?.toDouble(),
      amountApproved: (json['amount_approved'] as num?)?.toDouble(),
      priority:
          RecommendationPriority.fromString(json['priority'] as String?),
      evaluatorNotes: json['evaluator_notes'] as String?,
      approverNotes: json['approver_notes'] as String?,
      submittedAt: json['submitted_at'] != null
          ? DateTime.tryParse(json['submitted_at'] as String)
          : null,
      decidedAt: json['decided_at'] != null
          ? DateTime.tryParse(json['decided_at'] as String)
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
      customerName:
          json['customer_name'] as String? ?? customer?['full_name'] as String?,
      templateName:
          json['template_name'] as String? ?? template?['name'] as String?,
      livenessStatus: json['liveness_status'] as String?,
      livenessConfidence: (json['liveness_confidence'] as num?)?.toDouble(),
      livenessVerifiedAt: json['liveness_verified_at'] != null
          ? DateTime.tryParse(json['liveness_verified_at'] as String)
          : null,
      stages: stagesRaw is List
          ? stagesRaw
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList()
          : null,
      currentStageType: json['current_stage_type'] as String?,
      formFields: fieldsRaw is List
          ? fieldsRaw
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList()
          : null,
      answersLocked: json['answers_locked'] == true,
      periodWindows: json['period_windows'] is Map
          ? Map<String, dynamic>.from(json['period_windows'] as Map)
          : null,
      disbursementClaim: json['disbursement_claim'] is Map
          ? DisbursementClaimInfo.fromJson(
              Map<String, dynamic>.from(json['disbursement_claim'] as Map),
            )
          : null,
      disbursementBooking: json['disbursement_booking'] is Map
          ? DisbursementBookingInfo.fromJson(
              Map<String, dynamic>.from(json['disbursement_booking'] as Map),
            )
          : null,
    );
  }
}

class DisbursementClaimInfo {
  const DisbursementClaimInfo({
    required this.id,
    this.claimedAt,
    this.queueNumber,
    this.slotStartsAt,
    this.slotEndsAt,
    this.siteName,
    this.siteAddress,
    this.faceLivenessPassed = false,
    this.status,
  });

  final String id;
  final DateTime? claimedAt;
  final int? queueNumber;
  final DateTime? slotStartsAt;
  final DateTime? slotEndsAt;
  final String? siteName;
  final String? siteAddress;
  final bool faceLivenessPassed;
  final String? status;

  factory DisbursementClaimInfo.fromJson(Map<String, dynamic> json) {
    return DisbursementClaimInfo(
      id: json['id'] as String? ?? '',
      claimedAt: json['claimed_at'] != null
          ? DateTime.tryParse(json['claimed_at'] as String)
          : null,
      queueNumber: (json['queue_number'] as num?)?.toInt(),
      slotStartsAt: json['slot_starts_at'] != null
          ? DateTime.tryParse(json['slot_starts_at'] as String)
          : null,
      slotEndsAt: json['slot_ends_at'] != null
          ? DateTime.tryParse(json['slot_ends_at'] as String)
          : null,
      siteName: json['site_name'] as String?,
      siteAddress: json['site_address'] as String?,
      faceLivenessPassed: json['face_liveness_passed'] == true,
      status: json['status'] as String?,
    );
  }
}

class DisbursementBookingInfo {
  const DisbursementBookingInfo({
    required this.id,
    this.status,
    this.queueNumber,
    this.validatedAt,
    this.slotStartsAt,
    this.slotEndsAt,
    this.siteName,
    this.siteAddress,
  });

  final String id;
  final String? status;
  final int? queueNumber;
  final DateTime? validatedAt;
  final DateTime? slotStartsAt;
  final DateTime? slotEndsAt;
  final String? siteName;
  final String? siteAddress;

  factory DisbursementBookingInfo.fromJson(Map<String, dynamic> json) {
    return DisbursementBookingInfo(
      id: json['id'] as String? ?? '',
      status: json['status'] as String?,
      queueNumber: (json['queue_number'] as num?)?.toInt(),
      validatedAt: json['validated_at'] != null
          ? DateTime.tryParse(json['validated_at'] as String)
          : null,
      slotStartsAt: json['slot_starts_at'] != null
          ? DateTime.tryParse(json['slot_starts_at'] as String)
          : null,
      slotEndsAt: json['slot_ends_at'] != null
          ? DateTime.tryParse(json['slot_ends_at'] as String)
          : null,
      siteName: json['site_name'] as String?,
      siteAddress: json['site_address'] as String?,
    );
  }
}

class Recommendation {
  const Recommendation({
    required this.id,
    required this.applicationId,
    required this.recommendedBy,
    required this.priority,
    this.rationale,
    this.isActedOn = false,
    this.createdAt,
    this.application,
  });

  final String id;
  final String applicationId;
  final String recommendedBy;
  final RecommendationPriority priority;
  final String? rationale;
  final bool isActedOn;
  final DateTime? createdAt;
  final Application? application;

  factory Recommendation.fromJson(Map<String, dynamic> json) {
    final app = json['applications'] as Map<String, dynamic>?;
    return Recommendation(
      id: json['id'] as String,
      applicationId: json['application_id'] as String,
      recommendedBy: json['recommended_by'] as String,
      priority:
          RecommendationPriority.fromString(json['priority'] as String?),
      rationale: json['rationale'] as String?,
      isActedOn: json['is_acted_on'] as bool? ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
      application: app != null ? Application.fromJson(app) : null,
    );
  }
}

class DependentLink {
  const DependentLink({
    required this.id,
    required this.principalId,
    required this.dependentId,
    required this.relationship,
    this.authorizationLetterUrl,
    this.isNotarized = false,
    this.isValidated = false,
    this.notes,
    this.dependentName,
    this.principalName,
  });

  final String id;
  final String principalId;
  final String dependentId;
  final String relationship;
  final String? authorizationLetterUrl;
  final bool isNotarized;
  final bool isValidated;
  final String? notes;
  final String? dependentName;
  final String? principalName;

  factory DependentLink.fromJson(Map<String, dynamic> json) {
    final dep = json['dependent'] as Map<String, dynamic>?;
    final principal = json['principal'] as Map<String, dynamic>?;
    return DependentLink(
      id: json['id'] as String,
      principalId: json['principal_id'] as String,
      dependentId: json['dependent_id'] as String,
      relationship: json['relationship'] as String? ?? 'other',
      authorizationLetterUrl: json['authorization_letter_url'] as String?,
      isNotarized: json['is_notarized'] as bool? ?? false,
      isValidated: json['is_validated'] as bool? ?? false,
      notes: json['notes'] as String?,
      dependentName: dep?['full_name'] as String?,
      principalName: principal?['full_name'] as String?,
    );
  }
}
