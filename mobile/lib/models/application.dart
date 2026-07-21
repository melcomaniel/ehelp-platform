enum ApplicationStatus {
  draft('draft', 'Draft'),
  submitted('submitted', 'Submitted'),
  underReview('under_review', 'Under Review'),
  recommended('recommended', 'Recommended'),
  approved('approved', 'Approved'),
  declined('declined', 'Declined'),
  disbursed('disbursed', 'Disbursed'),
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
    this.description,
    this.disbursementCooldownDays = 90,
  });

  final String id;
  final String name;
  final String? description;
  final int disbursementCooldownDays;

  factory ProgramTemplate.fromJson(Map<String, dynamic> json) {
    return ProgramTemplate(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      disbursementCooldownDays:
          json['disbursement_cooldown_days'] as int? ?? 90,
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

  factory Application.fromJson(Map<String, dynamic> json) {
    final customer = json['profiles'] as Map<String, dynamic>?;
    final template = json['program_templates'] as Map<String, dynamic>?;

    return Application(
      id: json['id'] as String,
      referenceNo: json['reference_no'] as String? ?? '',
      customerId: json['customer_id'] as String,
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
      customerName: customer?['full_name'] as String?,
      templateName: template?['name'] as String?,
      livenessStatus: json['liveness_status'] as String?,
      livenessConfidence: (json['liveness_confidence'] as num?)?.toDouble(),
      livenessVerifiedAt: json['liveness_verified_at'] != null
          ? DateTime.tryParse(json['liveness_verified_at'] as String)
          : null,
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
