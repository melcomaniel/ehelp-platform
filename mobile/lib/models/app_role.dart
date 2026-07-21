enum AppRole {
  dswdAdmin('dswd_admin', 'DSWD Admin'),
  satelliteAdmin('satellite_admin', 'Satellite Admin'),
  approver('approver', 'Approver'),
  evaluator('evaluator', 'Evaluator'),
  customer('customer', 'Customer'),
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
      this == AppRole.dswdAdmin ||
      this == AppRole.satelliteAdmin ||
      this == AppRole.approver ||
      this == AppRole.evaluator;

  bool get isMobileRole =>
      this == AppRole.approver ||
      this == AppRole.evaluator ||
      this == AppRole.customer ||
      this == AppRole.dependent;

  String get homeRoute {
    switch (this) {
      case AppRole.approver:
        return '/approver';
      case AppRole.evaluator:
        return '/evaluator';
      case AppRole.dependent:
        return '/dependent';
      case AppRole.customer:
      default:
        return '/customer';
    }
  }
}
