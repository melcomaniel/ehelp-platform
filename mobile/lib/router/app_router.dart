import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/screens/login_screen.dart';
import '../features/auth/screens/onboarding_screen.dart';
import '../features/customer/screens/customer_screens.dart';
import '../features/customer/screens/program_apply_screen.dart';
import '../features/shared/screens/application_detail_screen.dart';
import '../providers/auth_provider.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final profileAsync = ref.watch(currentProfileProvider);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: _RouterRefresh(ref),
    redirect: (context, state) {
      final loc = state.matchedLocation;
      final loggingIn = loc == '/login' ||
          loc == '/register' ||
          loc == '/otp';
      final onboarding = loc == '/onboarding';

      final session = authState.asData?.value.session ??
          ref.read(authServiceProvider).currentSession;
      final isLoggedIn = session != null;

      if (!isLoggedIn) {
        return loggingIn ? null : '/login';
      }

      final profile = profileAsync.asData?.value;
      if (profile == null) {
        return loggingIn ? '/customer' : null;
      }

      // Staff/admin accounts are web-only.
      if (!profile.role.isMobileRole) {
        // Sign-out is handled by auth layer on 403; keep user on login.
        return loggingIn ? null : '/login';
      }

      if (profile.needsOnboarding) {
        return onboarding ? null : '/onboarding';
      }

      if (loggingIn || onboarding) {
        return '/customer';
      }

      if (loc.startsWith('/customer') || loc.startsWith('/application/')) {
        return null;
      }

      // Legacy staff routes → customer home (or login if somehow non-beneficiary).
      if (loc.startsWith('/evaluator') ||
          loc.startsWith('/approver') ||
          loc.startsWith('/dependent')) {
        return '/customer';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(
        path: '/onboarding',
        builder: (_, __) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/otp',
        builder: (_, state) => OtpScreen(email: state.extra as String? ?? ''),
      ),

      // Beneficiary only
      GoRoute(path: '/customer', builder: (_, __) => const CustomerHomeScreen()),
      GoRoute(path: '/customer/apply', builder: (_, __) => const ApplyScreen()),
      GoRoute(
        path: '/customer/programs/:id',
        builder: (_, state) => ProgramApplyScreen(
          programId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/customer/programs/:id/disbursement',
        builder: (_, state) => DisbursementQrScreen(
          programId: state.pathParameters['id']!,
        ),
      ),
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
