// ============================================================
// SmartRoll — Auth Stack Layout
// Stack navigator for the authentication screens (login, signup,
// forgot-password, reset-password). Redirects already-authenticated
// users to their role-appropriate section of the app.
// ============================================================

import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

/**
 * AuthLayout
 * Renders the auth stack if the user is not authenticated.
 * If a session already exists, redirects to the appropriate
 * role-based section (instructor or student).
 */
export default function AuthLayout() {
  const { session, user, loading } = useAuth();

  // Wait for auth to initialise before redirecting
  if (loading) return null;

  // Already authenticated — redirect to the correct section
  if (session && user?.role) {
    if (user.role === 'lecturer') return <Redirect href="/(instructor)" />;
    return <Redirect href="/(student)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
