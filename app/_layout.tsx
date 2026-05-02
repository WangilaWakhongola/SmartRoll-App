// ============================================================
// SmartRoll — Root Layout
// The top-level Expo Router layout. Wraps the entire app in
// SafeAreaProvider, AuthProvider, and AttendanceProvider.
// RootNavigator handles role-based routing once auth is ready.
// ============================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { AttendanceProvider } from '../src/contexts/AttendanceContext';

/**
 * RootNavigator
 * Reads auth state and redirects to the correct section of the app:
 *  - No session → /(auth)/login
 *  - Lecturer/instructor role → /(instructor)
 *  - Student role → /(student)
 * Shows a loading spinner while auth initialises.
 */
function RootNavigator() {
  const { session, user, loading } = useAuth();
  const router   = useRouter();
  const segments = useSegments();
  const [routerReady, setRouterReady] = useState(false);

  // Watches: []
  // Effect: delays routing until the Expo Router is mounted and ready
  useEffect(() => {
    const t = setTimeout(() => setRouterReady(true), Platform.OS === 'web' ? 300 : 100);
    return () => clearTimeout(t);
  }, []);

  // Watches: loading, routerReady, session, user, segments
  // Effect: performs role-based navigation once auth and router are both ready
  useEffect(() => {
    // Wait until both the router and auth are ready before navigating
    if (loading || !routerReady) return;

    const inAuth       = segments[0] === '(auth)';
    const inInstructor = segments[0] === '(instructor)';
    const inStudent    = segments[0] === '(student)';

    try {
      // No session → must be on auth screens
      if (!session) {
        if (!inAuth) router.replace('/(auth)/login');
        return;
      }

      // Session exists but profile not loaded yet — stay put to avoid
      // a flash back to login while the profile is being fetched
      if (!user) return;

      // Route by role
      if (user.role === 'lecturer' || (user.role as string) === 'instructor') {
        if (!inInstructor) router.replace('/(instructor)');
      } else if (user.role === 'student') {
        if (!inStudent) router.replace('/(student)');
      } else {
        router.replace('/(auth)/login');
      }
    } catch {
      // Router not mounted yet — safe to ignore
    }
  }, [loading, routerReady, session, user, segments]);

  // Show a spinner while auth initialises
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#1a237e" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4FF' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#1a237e',
    fontWeight: '500',
  },
});

/**
 * RootLayout
 * The default export required by Expo Router for the root _layout.
 * Wraps the navigator in all required providers.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AttendanceProvider>
          <RootNavigator />
        </AttendanceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
