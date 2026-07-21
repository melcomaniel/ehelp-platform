import 'app_role.dart';

enum AccountValidationStatus {
  pending('pending'),
  validated('validated'),
  rejected('rejected');

  const AccountValidationStatus(this.value);
  final String value;

  static AccountValidationStatus fromString(String? v) =>
      AccountValidationStatus.values.firstWhere(
        (e) => e.value == v,
        orElse: () => AccountValidationStatus.pending,
      );
}

enum DisbursementMethod {
  cash('cash', 'Cash'),
  bankTransfer('bank_transfer', 'Bank Transfer'),
  eWallet('e_wallet', 'E-Wallet'),
  check('check', 'Check');

  const DisbursementMethod(this.value, this.label);
  final String value;
  final String label;

  static DisbursementMethod? fromString(String? v) {
    if (v == null) return null;
    return DisbursementMethod.values.firstWhere(
      (e) => e.value == v,
      orElse: () => DisbursementMethod.cash,
    );
  }
}

class Profile {
  const Profile({
    required this.id,
    this.email,
    this.phone,
    required this.fullName,
    required this.role,
    this.regionId,
    this.idNumber,
    this.idType,
    this.faceScanVerified = false,
    this.faceScanUrl,
    this.pinExpiresAt,
    this.validationStatus = AccountValidationStatus.pending,
    this.disbursementPreference,
    this.disbursementDetails = const {},
    this.isActive = true,
  });

  final String id;
  final String? email;
  final String? phone;
  final String fullName;
  final AppRole role;
  final String? regionId;
  final String? idNumber;
  final String? idType;
  final bool faceScanVerified;
  final String? faceScanUrl;
  final DateTime? pinExpiresAt;
  final AccountValidationStatus validationStatus;
  final DisbursementMethod? disbursementPreference;
  final Map<String, dynamic> disbursementDetails;
  final bool isActive;

  bool get pinExpired {
    if (pinExpiresAt == null) return true;
    return pinExpiresAt!.isBefore(DateTime.now());
  }

  factory Profile.fromJson(Map<String, dynamic> json) {
    return Profile(
      id: json['id'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      fullName: (json['full_name'] as String?) ?? '',
      role: AppRole.fromString(json['role'] as String?),
      regionId: json['region_id'] as String?,
      idNumber: json['id_number'] as String?,
      idType: json['id_type'] as String?,
      faceScanVerified: json['face_scan_verified'] as bool? ?? false,
      faceScanUrl: json['face_scan_url'] as String?,
      pinExpiresAt: json['pin_expires_at'] != null
          ? DateTime.tryParse(json['pin_expires_at'] as String)
          : null,
      validationStatus:
          AccountValidationStatus.fromString(json['validation_status'] as String?),
      disbursementPreference:
          DisbursementMethod.fromString(json['disbursement_preference'] as String?),
      disbursementDetails:
          Map<String, dynamic>.from(json['disbursement_details'] as Map? ?? {}),
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'full_name': fullName,
        'phone': phone,
        'id_number': idNumber,
        'id_type': idType,
        'region_id': regionId,
        'disbursement_preference': disbursementPreference?.value,
        'disbursement_details': disbursementDetails,
      };

  Profile copyWith({
    String? fullName,
    String? phone,
    String? regionId,
    String? idNumber,
    String? idType,
    DisbursementMethod? disbursementPreference,
    Map<String, dynamic>? disbursementDetails,
    AccountValidationStatus? validationStatus,
    bool? faceScanVerified,
  }) {
    return Profile(
      id: id,
      email: email,
      phone: phone ?? this.phone,
      fullName: fullName ?? this.fullName,
      role: role,
      regionId: regionId ?? this.regionId,
      idNumber: idNumber ?? this.idNumber,
      idType: idType ?? this.idType,
      faceScanVerified: faceScanVerified ?? this.faceScanVerified,
      faceScanUrl: faceScanUrl,
      pinExpiresAt: pinExpiresAt,
      validationStatus: validationStatus ?? this.validationStatus,
      disbursementPreference:
          disbursementPreference ?? this.disbursementPreference,
      disbursementDetails: disbursementDetails ?? this.disbursementDetails,
      isActive: isActive,
    );
  }
}
