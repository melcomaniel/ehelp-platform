enum AppRole {
  platformAdmin('platform_admin', 'Platform Admin'),
  dswdAdmin('dswd_admin', 'Organization Admin'),
  satelliteAdmin('satellite_admin', 'Office Admin'),
  approver('approver', 'Approver'),
  evaluator('evaluator', 'Evaluator'),
  customer('customer', 'Beneficiary'),
  dependent('dependent', 'Dependent / Guarantor');

  const AppRole(this.value, this.label);
  final String value;
  final String label;

  static AppRole fromString(String? value) {
    return AppRole.values.firstWhere(
      (r) => r.value == value,
      orElse: () => AppRole.customer,
    );
  }

  bool get isStaff =>
      this == AppRole.platformAdmin ||
      this == AppRole.dswdAdmin ||
      this == AppRole.satelliteAdmin ||
      this == AppRole.approver ||
      this == AppRole.evaluator;

  /// Flutter is beneficiary-class only (PRD persona platform split).
  /// Dependent uses the same app; the principal link still needs staff approval.
  bool get isMobileRole =>
      this == AppRole.customer || this == AppRole.dependent;

  String get homeRoute {
    switch (this) {
      case AppRole.customer:
      case AppRole.dependent:
        return '/customer';
      default:
        // Staff/admin must use web — no mobile home.
        return '/login';
    }
  }
}
