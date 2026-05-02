// ============================================================
// SmartRoll — Instructor Tab Layout
// Bottom-tab navigator for the instructor (lecturer) section.
// Redirects unauthenticated users or wrong-role users to login.
// ============================================================

import { Tabs, Redirect } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import Svg, { Path, Polyline, Line, Circle } from 'react-native-svg'
import { Platform } from 'react-native'

const ACCENT = '#1a237e'
const INACTIVE = '#6B7280'

/**
 * Home tab icon.
 * @param focused - whether this tab is currently active
 */
function HomeIcon({ focused }: { focused: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={focused ? ACCENT : INACTIVE} strokeWidth={focused ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  )
}

/**
 * Classrooms/Units tab icon.
 * @param focused - whether this tab is currently active
 */
function ClassroomsIcon({ focused }: { focused: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={focused ? ACCENT : INACTIVE} strokeWidth={focused ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <Line x1="9" y1="7" x2="15" y2="7" />
      <Line x1="9" y1="11" x2="15" y2="11" />
    </Svg>
  )
}

/**
 * Reports tab icon.
 * @param focused - whether this tab is currently active
 */
function ReportsIcon({ focused }: { focused: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={focused ? ACCENT : INACTIVE} strokeWidth={focused ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="20" x2="18" y2="10" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
    </Svg>
  )
}

/**
 * Profile tab icon.
 * @param focused - whether this tab is currently active
 */
function ProfileIcon({ focused }: { focused: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={focused ? ACCENT : INACTIVE} strokeWidth={focused ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  )
}

/**
 * InstructorLayout
 * Renders the bottom-tab navigator for authenticated instructors/lecturers.
 * Accepts both 'lecturer' and 'instructor' role values for backward compatibility.
 * Dynamic routes (session/[id] and report/[id]) are hidden from the tab bar.
 */
export default function InstructorLayout() {
  const { session, user, loading } = useAuth()
  if (loading) return null
  if (!session || !user) return <Redirect href="/(auth)/login" />
  // Accept both 'lecturer' and 'instructor' as valid roles for this layout
  if (user.role !== 'lecturer' && (user.role as string) !== 'instructor') return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: 'rgba(0,0,0,0.1)',
          height: Platform.OS === 'android' ? 64 : 72,
          paddingBottom: Platform.OS === 'android' ? 8 : 14,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', letterSpacing: 0.2 },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: INACTIVE,
      }}
    >
      <Tabs.Screen name="index"      options={{ title: 'Home',    tabBarIcon: ({ focused }) => <HomeIcon focused={focused} /> }} />
      <Tabs.Screen name="classrooms" options={{ title: 'Units',   tabBarIcon: ({ focused }) => <ClassroomsIcon focused={focused} /> }} />
      <Tabs.Screen name="reports"    options={{ title: 'Reports', tabBarIcon: ({ focused }) => <ReportsIcon focused={focused} /> }} />
      <Tabs.Screen name="profile"    options={{ title: 'Profile', tabBarIcon: ({ focused }) => <ProfileIcon focused={focused} /> }} />
      {/* Dynamic routes — hidden from tab bar */}
      <Tabs.Screen name="session/[id]" options={{ href: null }} />
      <Tabs.Screen name="report/[id]"  options={{ href: null }} />
    </Tabs>
  )
}
