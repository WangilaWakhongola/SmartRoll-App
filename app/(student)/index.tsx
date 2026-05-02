// ============================================================
// SmartRoll — Student Dashboard
// The main home screen for students. Shows today's sessions
// with their attendance status (pending/signed/missed/upcoming).
// Tapping a pending session opens the AttendanceModal flow.
// ============================================================

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path, Line, Circle } from 'react-native-svg'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/services/supabase'
import { useStudentSessions, SessionItem } from '../../src/hooks/useStudentSessions'
import { AttendanceModal } from '../../src/components/attendance/AttendanceModal'
import { UnitCard } from '../../src/components/attendance/UnitCard'

// ── Colour constants ──────────────────────────────────────────
const BG = '#F0F4FF'
const SURFACE = '#FFFFFF'
const NAVY = '#1a237e'
const MUTED = '#6B6560'
const TEXT = '#1A1714'
const GREEN = '#1A6641'

/** Calendar icon for empty state */
function CalendarIcon() {
  return (
    <Svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  )
}

/**
 * StudentDashboard
 * Fetches the student's enrolled class ID from their profile, then uses
 * useStudentSessions to load today's sessions. Renders UnitCard items
 * and opens AttendanceModal when a pending session is tapped.
 */
export default function StudentDashboard() {
  const { user, signOut } = useAuth()

  // Live clock — updates every second
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch classId from the user's profile
  const [classId, setClassId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('class_id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setClassId(data?.class_id ?? null))
  }, [user?.id])

  const { sessions, loading, refreshing, refresh } = useStudentSessions(
    user?.id ?? null,
    classId,
  )

  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  // Track seconds since last refresh
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceRefresh(Math.floor((Date.now() - lastRefreshed.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [lastRefreshed])

  function handleRefresh() {
    refresh()
    setLastRefreshed(new Date())
    setSecondsSinceRefresh(0)
  }

  const lastUpdatedLabel = secondsSinceRefresh < 5
    ? 'Just updated'
    : secondsSinceRefresh < 60
    ? `Updated ${secondsSinceRefresh}s ago`
    : `Updated ${Math.floor(secondsSinceRefresh / 60)}m ago`

  const today = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const liveTime = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  })
  const greeting = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'
  const pending = sessions.filter(s => s.status === 'pending').length
  const signed  = sessions.filter(s => s.status === 'signed').length

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {greeting},</Text>
            <Text style={styles.name}>{user?.fullName ?? 'Student'}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() =>
              Alert.alert('Sign Out?', 'You will be returned to the login screen.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut },
              ])
            }
            accessibilityRole="button"
            accessibilityLabel="Account options — sign out"
          >
            <Text style={styles.avatarText}>
              {(user?.fullName ?? 'S')
                .split(' ')
                .map(w => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date card */}
        <View style={styles.dateCard}>
          <View style={styles.dateCardTop}>
            <Text style={styles.dateSub}>Today's Schedule</Text>
            {/* Live indicator */}
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>
          <Text style={styles.dateText}>{today}</Text>
          <Text style={styles.liveTime}>{liveTime}</Text>
          <View style={styles.dateMetaRow}>
            <Text style={styles.dateMeta}>
              {user?.studentId ?? ''} · {pending > 0 ? `${pending} pending` : `${signed} signed today`}
            </Text>
            <Text style={styles.lastUpdated}>{lastUpdatedLabel}</Text>
          </View>
        </View>

        {/* Sessions */}
        <Text style={styles.sectionTitle}>Units Today</Text>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={NAVY} size="large" />
            <Text style={styles.loadingText}>Loading today's sessions…</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <CalendarIcon />
            </View>
            <Text style={styles.emptyText}>No sessions today</Text>
            <Text style={styles.emptySub}>
              {classId
                ? 'Your instructor hasn\'t started a session yet. Pull down to refresh.'
                : 'You\'re not enrolled in a unit yet. Go to the Enroll tab to join a class.'}
            </Text>
          </View>
        ) : (
          sessions.map(session => (
            <UnitCard
              key={session.id}
              session={session}
              onPress={() => {
                setSelectedSession(session)
                setModalVisible(true)
              }}
            />
          ))
        )}
      </ScrollView>

      <AttendanceModal
        visible={modalVisible}
        session={selectedSession}
        onClose={() => {
          setModalVisible(false)
          setSelectedSession(null)
        }}
        onSuccess={() => {
          setModalVisible(false)
          setSelectedSession(null)
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG },
  scroll:       { padding: 20, paddingBottom: 48 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting:     { fontSize: 12, color: MUTED, marginBottom: 2 },
  name:         { fontSize: 20, fontWeight: '500', color: TEXT },
  // Avatar — min 44×44pt touch target
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: '#fff', fontSize: 13, fontWeight: '500' },
  dateCard:     { backgroundColor: NAVY, borderRadius: 18, padding: 18, marginBottom: 20 },
  dateCardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dateSub:      { fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, textTransform: 'uppercase' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
  liveText:     { fontSize: 10, color: '#fff', fontWeight: '600' },
  dateText:     { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  liveTime:     { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: 1, marginBottom: 6 },
  dateMetaRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  dateMeta:     { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  lastUpdated:  { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' },
  sectionTitle: { fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  // Loading state
  loadingWrap:  { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText:  { fontSize: 13, color: MUTED },
  // Empty state
  empty:        { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIconWrap: { marginBottom: 16, opacity: 0.6 },
  emptyText:    { fontSize: 16, fontWeight: '600', color: TEXT, marginBottom: 8, textAlign: 'center' },
  emptySub:     { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },
})
