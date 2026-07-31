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
    this.needsEverify = false,
    this.firstName,
    this.middleName,
    this.lastName,
    this.birthDate,
    this.address,
    this.municipality,
    this.barangay,
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
  final bool needsEverify;
  final String? firstName;
  final String? middleName;
  final String? lastName;
  final String? birthDate;
  final String? address;
  final String? municipality;
  final String? barangay;

  /// e.g. "NCR · Caloocan City" for home/profile.
  String get registeredLocationLabel {
    final muni = municipality?.trim();
    final parts = <String>[
      if (muni != null && muni.isNotEmpty) ...[
        if (_looksLikeNcr(muni, address)) 'NCR',
        _titleCase(muni),
      ] else if (address != null && address!.trim().isNotEmpty)
        address!.trim(),
    ];
    return parts.join(' · ');
  }

  static bool _looksLikeNcr(String municipality, String? address) {
    final hay = '$municipality ${address ?? ''}'.toUpperCase();
    const hints = [
      'NCR',
      'CALOOCAN',
      'QUEZON CITY',
      'MANILA',
      'MAKATI',
      'PASIG',
      'TAGUIG',
      'PASAY',
      'MANDALUYONG',
      'PARANAQUE',
      'PARAÑAQUE',
      'MUNTINLUPA',
      'LAS PINAS',
      'LAS PIÑAS',
      'MARIKINA',
      'VALENZUELA',
      'MALABON',
      'NAVOTAS',
      'SAN JUAN',
      'PATEROS',
    ];
    return hints.any(hay.contains);
  }

  static String _titleCase(String value) {
    return value
        .toLowerCase()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }

  bool get pinExpired {
    if (pinExpiresAt == null) return true;
    return pinExpiresAt!.isBefore(DateTime.now());
  }

  /// Citizens must finish Face Liveness + eVerify before using the app.
  bool get needsOnboarding =>
      role == AppRole.customer && needsEverify;

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
      needsEverify: json['needs_everify'] as bool? ??
          (json['egov_uniqid'] != null && json['everify_verified_at'] == null),
      firstName: json['first_name'] as String?,
      middleName: json['middle_name'] as String?,
      lastName: json['last_name'] as String?,
      birthDate: json['birth_date'] as String?,
      address: json['address'] as String?,
      municipality: json['municipality'] as String?,
      barangay: json['barangay'] as String?,
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
    bool? needsEverify,
    String? address,
    String? municipality,
    String? barangay,
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
      needsEverify: needsEverify ?? this.needsEverify,
      firstName: firstName,
      middleName: middleName,
      lastName: lastName,
      birthDate: birthDate,
      address: address ?? this.address,
      municipality: municipality ?? this.municipality,
      barangay: barangay ?? this.barangay,
    );
  }
}
