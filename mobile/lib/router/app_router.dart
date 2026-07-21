import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/approver/screens/approver_screens.dart';
import '../features/auth/screens/login_screen.dart';
import '../features/customer/screens/customer_screens.dart';
import '../features/evaluator/screens/evaluator_screens.dart';
import '../features/shared/screens/application_detail_screen.dart';
import '../models/app_role.dart';
import '../providers/auth_provider.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final profileAsync = ref.watch(currentProfileProvider);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: _RouterRefresh(ref),
    redirect: (context, state) {
      final loggingIn = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register' ||
          state.matchedLocation == '/otp';

      final session = authState.asData?.value.session ??
          ref.read(authServiceProvider).currentSession;
      final isLoggedIn = session != null;

      if (!isLoggedIn) {
        return loggingIn ? null : '/login';
      }

      final profile = profileAsync.asData?.value;
      if (profile == null) {
        // Still loading profile; stay put unless on auth screens
        return loggingIn ? '/customer' : null;
      }

      if (loggingIn) {
        return profile.role.homeRoute;
      }

      final loc = state.matchedLocation;
      final role = profile.role;

      if (loc.startsWith('/approver') && role != AppRole.approver) {
        return role.homeRoute;
      }
      if (loc.startsWith('/evaluator') && role != AppRole.evaluator) {
        return role.homeRoute;
      }
      if (loc.startsWith('/customer') && role != AppRole.customer) {
        return role.homeRoute;
      }
      if (loc.startsWith('/dependent') && role != AppRole.dependent) {
        return role.homeRoute;
      }

      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: '/otp',
        builder: (_, state) => OtpScreen(email: state.extra as String? ?? ''),
      ),

      // Customer
      GoRoute(path: '/customer', builder: (_, __) => const CustomerHomeScreen()),
      GoRoute(path: '/customer/apply', builder: (_, __) => const ApplyScreen()),
      GoRoute(
        path: '/customer/disbursement',
        builder: (_, __) => const DisbursementScreen(),
      ),
      GoRoute(
        path: '/customer/dependents',
        builder: (_, __) => const DependentsScreen(),
      ),
      GoRoute(
        path: '/customer/profile',
        builder: (_, __) => const CustomerProfileScreen(),
      ),
      GoRoute(
        path: '/dependent',
        builder: (_, __) => const DependentHomeScreen(),
      ),

      // Evaluator
      GoRoute(
        path: '/evaluator',
        builder: (_, __) => const EvaluatorHomeScreen(),
      ),
      GoRoute(
        path: '/evaluator/register-customer',
        builder: (_, __) => const RegisterCustomerScreen(),
      ),
      GoRoute(
        path: '/evaluator/apply-for-customer',
        builder: (_, __) => const ApplyForCustomerScreen(),
      ),
      GoRoute(
        path: '/evaluator/case/:id',
        builder: (_, state) => EvaluatorCaseScreen(
          applicationId: state.pathParameters['id']!,
        ),
      ),

      // Approver
      GoRoute(
        path: '/approver',
        builder: (_, __) => const ApproverHomeScreen(),
      ),
      GoRoute(
        path: '/approver/case/:id',
        builder: (_, state) => ApproverCaseScreen(
          applicationId: state.pathParameters['id']!,
          recommendationId: state.extra as String?,
        ),
      ),

      // Shared
      GoRoute(
        path: '/application/:id',
        builder: (_, state) => ApplicationDetailScreen(
          applicationId: state.pathParameters['id']!,
        ),
      ),
    ],
  );
});

class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(this._ref) {
    _ref.listen(authStateProvider, (_, __) => notifyListeners());
    _ref.listen(currentProfileProvider, (_, __) => notifyListeners());
  }

  final Ref _ref;
}
