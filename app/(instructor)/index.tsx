// ============================================================
// SmartRoll — Instructor Home Dashboard
// Shows today's sessions (live, upcoming, ended) with attendance
// progress bars. Subscribes to real-time session and attendance
// changes. Includes an at-risk student count and a quick menu.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Modal,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Circle } from 'react-native-svg'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/services/supabase'

const BG = '#F0F4FF'
const SURFACE = '#FFFFFF'
const SURFACE2 = '#F0EDE8'
const BORDER = 'rgba(0,0,0,0.08)'
const BORDER2 = 'rgba(0,0,0,0.13)'
const TEXT = '#1A1714'
const MUTED = '#7A7268'
const ACCENT = '#1a237e'
const DANGER = '#8B1A1A'
const GREEN = '#1A6641'
const WARNING = '#7A4A00'

type SessionType = 'live' | 'upcoming' | 'ended'

interface SessionCard {
  id: string
  code: string
  name: string
  time: string
  room: string
  enrolled: number
  signed: number
  type: SessionType
}

const STATUS_CONFIG: Record<SessionType, { borderColor: string; badgeBg: string; badgeText: string; label: string }> = {
  live:     { borderColor: GREEN,   badgeBg: '#E8F5EE', badgeText: GREEN,   label: 'Live' },
  upcoming: { borderColor: ACCENT,  badgeBg: '#E8EFF6', badgeText: ACCENT,  label: 'Upcoming' },
  ended:    { borderColor: BORDER2, badgeBg: SURFACE2,  badgeText: MUTED,   label: 'Ended' },
}

function SessionIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
}

/**
 * InstructorHome
 * The main dashboard for instructors. Fetches today's sessions and
 * computes live/upcoming/ended groupings. Subscribes to real-time
 * changes on sessions and attendance tables.
 */
export default function InstructorHome() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [menuVisible, setMenuVisible] = useState(false)
  const [sessions, setSessions] = useState<SessionCard[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [atRisk, setAtRisk] = useState(0)

  const initials = user?.fullName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'AM'
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  function getGreeting() {
    const hour = currentTime.getHours()
    if (hour < 12) return 'Good morning,'
    if (hour < 17) return 'Good afternoon,'
    return 'Good evening,'
  }

  const today = currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const liveTime = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  /**
   * Fetches today's sessions for this instructor, enriches them with
   * classroom names, enrollment counts, and attendance counts.
   * Also computes the at-risk student count (below 75% attendance).
   * Queries: sessions, classes, profiles (enrollment), attendance tables.
   */
  const fetchSessions = useCallback(async () => {
    if (!user) return
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)

      // Get today's sessions for this instructor
      const { data: sessionData, error: sessionErr } = await supabase
        .from('sessions')
        .select('id, class_id, started_at, ended_at, status')
        .or(`instructor_id.eq.${user.id},lecturer_id.eq.${user.id}`)
        .gte('started_at', todayStart.toISOString())
        .lte('started_at', todayEnd.toISOString())
        .order('started_at', { ascending: true })

      if (sessionErr) {
        console.error('[SmartRoll] fetchSessions error:', sessionErr.message)
        setSessions([]); setLoading(false); setRefreshing(false); return
      }

      if (!sessionData || sessionData.length === 0) { setSessions([]); setLoading(false); setRefreshing(false); return }

      const classroomIds = [...new Set(sessionData.map((s: any) => s.class_id))]
      const sessionIds = sessionData.map((s: any) => s.id)

      // Get classroom names
      const { data: classrooms } = await supabase
        .from('classes')
        .select('id, name, building')
        .in('id', classroomIds)
      const classroomMap: Record<string, any> = {}
      ;(classrooms ?? []).forEach((c: any) => { classroomMap[c.id] = c })

      // Get enrollment counts
      const { data: enrollments } = await supabase
        .from('profiles')
        .select('class_id')
        .in('class_id', classroomIds)
      const enrollmentCount: Record<string, number> = {}
      ;(enrollments ?? []).forEach((e: any) => {
        enrollmentCount[e.class_id] = (enrollmentCount[e.class_id] ?? 0) + 1
      })

      // Get attendance counts per session
      const { data: logs } = await supabase
        .from('attendance')
        .select('session_id')
        .in('session_id', sessionIds)
      const signedCount: Record<string, number> = {}
      ;(logs ?? []).forEach((l: any) => {
        signedCount[l.session_id] = (signedCount[l.session_id] ?? 0) + 1
      })

      const now = new Date()
      const mapped: SessionCard[] = sessionData.map((s: any) => {
        const classroom = classroomMap[s.class_id]
        const enrolled = enrollmentCount[s.class_id] ?? 0
        const signed = signedCount[s.id] ?? 0
        const startTime = formatTime(s.started_at)
        const endTime = s.ended_at ? formatTime(s.ended_at) : '--:--'

        let type: SessionType = 'upcoming'
        if (s.status === 'open') type = 'live'
        else if (s.status === 'closed') type = 'ended'
        else if (new Date(s.started_at) > now) type = 'upcoming'

        return {
          id: s.id,
          code: s.class_id,
          name: classroom?.name ?? s.class_id,
          time: `${startTime} - ${endTime}`,
          room: classroom?.building ?? 'TBA',
          enrolled,
          signed,
          type,
        }
      })

      setSessions(mapped)

      // Calculate at-risk: students below 75% attendance across all sessions
      const { data: allLogs } = await supabase
        .from('attendance')
        .select('student_id, session_id')
        .in('session_id', sessionIds)
      const studentAttendance: Record<string, number> = {}
      ;(allLogs ?? []).forEach((l: any) => {
        studentAttendance[l.student_id] = (studentAttendance[l.student_id] ?? 0) + 1
      })
      const totalSessions = sessionData.length
      const atRiskCount = Object.values(studentAttendance).filter(count => (count / totalSessions) < 0.75).length
      setAtRisk(atRiskCount)

    } catch (err) {
      console.error('fetchSessions error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  // Watches: fetchSessions
  // Effect: loads sessions on mount and when the user changes
  useEffect(() => { fetchSessions() }, [fetchSessions])

  // Watches: fetchSessions
  // Effect: subscribes to real-time changes on sessions and attendance tables
  // so the dashboard updates automatically as students sign in
  useEffect(() => {
    const channel = supabase
      .channel('instructor-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => fetchSessions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchSessions())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchSessions])

  const liveSessions = sessions.filter(s => s.type === 'live')
  const upcomingSessions = sessions.filter(s => s.type === 'upcoming')
  const endedSessions = sessions.filter(s => s.type === 'ended')

  function renderSession(s: SessionCard) {
    const cfg = STATUS_CONFIG[s.type]
    const pct = s.enrolled > 0 ? (s.signed / s.enrolled) * 100 : 0
    const barColor = s.type === 'ended' ? WARNING : s.type === 'live' ? GREEN : ACCENT

    return (
      <TouchableOpacity
        key={s.id}
        style={[styles.unitCard, { borderLeftWidth: 3, borderLeftColor: cfg.borderColor }, s.type === 'ended' && styles.unitEnded]}
        onPress={() => s.type !== 'ended' && router.push(`/(instructor)/session/${s.id}`)}
        activeOpacity={s.type === 'ended' ? 1 : 0.7}
        accessibilityRole="button"
      >
        <View style={styles.unitIconWrap}><SessionIcon /></View>
        <View style={styles.unitInfo}>
          <Text style={styles.unitCode}>{s.code}</Text>
          <Text style={styles.unitName} numberOfLines={1}>{s.name}</Text>
          <Text style={styles.unitTime}>{s.time}  {s.room}</Text>
          {s.type !== 'upcoming' && (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
              </View>
              <Text style={styles.progressText}>{s.signed}/{s.enrolled}</Text>
            </View>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: cfg.badgeBg }]}>
          <Text style={[styles.badgeText, { color: cfg.badgeText }]}>{cfg.label}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSessions() }} tintColor={ACCENT} />}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.name}>Dr. {user?.fullName?.split(' ').slice(-1)[0] ?? 'Instructor'}</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => setMenuVisible(true)} accessibilityRole="button">
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>

        {/* Today card */}
        <View style={styles.todayCard}>
          <Text style={styles.todayLabel}>TODAY'S OVERVIEW</Text>
          <Text style={styles.todayDate}>{today}</Text>
          <Text style={styles.todayLiveTime}>{liveTime}</Text>
          <Text style={styles.todayMeta}>{user?.studentId ?? 'Lecturer'}  Semester 1  2025/2026</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{sessions.length}</Text>
              <Text style={styles.statLbl}>SESSIONS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: GREEN }]}>{liveSessions.length}</Text>
              <Text style={styles.statLbl}>LIVE NOW</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: DANGER }]}>{atRisk}</Text>
              <Text style={styles.statLbl}>AT RISK</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={ACCENT} />
            <Text style={styles.loadingText}>Loading sessions...</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No sessions today.</Text>
            <Text style={styles.emptySubText}>Create a session from the classroom management panel.</Text>
          </View>
        ) : (
          <>
            {liveSessions.length > 0 && (<><Text style={styles.sectionTitle}>LIVE NOW</Text>{liveSessions.map(renderSession)}</>)}
            {upcomingSessions.length > 0 && (<><Text style={styles.sectionTitle}>UPCOMING</Text>{upcomingSessions.map(renderSession)}</>)}
            {endedSessions.length > 0 && (<><Text style={styles.sectionTitle}>ENDED TODAY</Text>{endedSessions.map(renderSession)}</>)}
          </>
        )}
      </ScrollView>

      {/* Menu modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <View style={styles.menuHeader}>
              <Text style={styles.menuName}>{user?.fullName ?? 'Instructor'}</Text>
              <Text style={styles.menuId}>Lecturer  SmartRoll</Text>
            </View>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/(instructor)/profile') }} accessibilityRole="button">
              <Text style={styles.menuItemText}>Profile & Settings</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); signOut() }} accessibilityRole="button">
              <Text style={[styles.menuItemText, { color: DANGER }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  greeting: { fontSize: 13, color: MUTED, marginBottom: 2 },
  name: { fontSize: 26, fontWeight: '600', color: TEXT },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  todayCard: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, padding: 20, marginHorizontal: 24, marginBottom: 24 },
  todayLabel: { fontSize: 11, color: MUTED, letterSpacing: 1.5, marginBottom: 10 },
  todayDate: { fontSize: 16, fontWeight: '600', color: TEXT, marginBottom: 2 },
  todayLiveTime: { fontSize: 26, fontWeight: '700', color: ACCENT, letterSpacing: 1, marginBottom: 6 },
  todayMeta: { fontSize: 13, color: MUTED, marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: BORDER },
  statVal: { fontSize: 22, fontWeight: '600', color: TEXT, lineHeight: 24 },
  statLbl: { fontSize: 9, color: MUTED, letterSpacing: 0.5, marginTop: 3 },
  sectionTitle: { fontSize: 11, color: MUTED, letterSpacing: 1.5, paddingHorizontal: 24, marginBottom: 14 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 13, color: MUTED },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontWeight: '500', color: TEXT, marginBottom: 6 },
  emptySubText: { fontSize: 13, color: MUTED, textAlign: 'center' },
  unitCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 18, marginHorizontal: 24, marginBottom: 12, gap: 14 },
  unitEnded: { opacity: 0.65 },
  unitIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: SURFACE2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  unitInfo: { flex: 1, minWidth: 0 },
  unitCode: { fontSize: 12, color: MUTED, letterSpacing: 0.5, marginBottom: 2 },
  unitName: { fontSize: 15, fontWeight: '500', color: TEXT },
  unitTime: { fontSize: 12, color: MUTED, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  progressTrack: { flex: 1, height: 3, backgroundColor: SURFACE2, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 11, color: MUTED, flexShrink: 0 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  badgeText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  menuHandle: { width: 40, height: 4, backgroundColor: BORDER2, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  menuHeader: { paddingHorizontal: 20, paddingBottom: 16 },
  menuName: { fontSize: 16, fontWeight: '700', color: TEXT },
  menuId: { fontSize: 13, color: MUTED, marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)' },
  menuItem: { paddingHorizontal: 20, paddingVertical: 16 },
  menuItemText: { fontSize: 15, fontWeight: '500', color: TEXT },
})
