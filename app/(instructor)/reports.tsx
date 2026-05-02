// ============================================================
// SmartRoll — Instructor Reports Screen
// Displays per-classroom attendance analytics: average attendance,
// at-risk students, weekly trend bars, and CSV/PDF export.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Share,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import Svg, { Path, Line, Circle, Rect } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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

/** A classroom tab entry */
interface ClassroomTab { id: string; code: string; name: string }
/** A student flagged as at-risk (below 75% attendance) */
interface AtRiskStudent { id: string; name: string; studentId: string; absences: number; pct: number }
/** A single bar in the weekly trend chart */
interface WeekBar { week: string; pct: number }

/**
 * Returns a colour for a given attendance percentage.
 * Green ≥ 80%, Warning ≥ 75%, Danger < 75%.
 * @param pct - attendance percentage (0–100)
 */
function barColor(pct: number) {
  if (pct >= 80) return GREEN
  if (pct >= 75) return WARNING
  return DANGER
}

/** Download/export icon rendered via SVG */
function ExportIcon({ color = MUTED }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M7 10l5 5 5-5" />
      <Line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  )
}

/** Chart/analytics icon for empty state */
function ChartEmptyIcon() {
  return (
    <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="20" x2="18" y2="10" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
      <Line x1="2" y1="20" x2="22" y2="20" />
    </Svg>
  )
}

/** Calendar/no-sessions icon for empty stats state */
function CalendarEmptyIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  )
}

/**
 * ReportsScreen
 * Loads the instructor's classrooms, then fetches session and attendance
 * data for the selected classroom to compute summary statistics.
 * Supports exporting the full attendance matrix as CSV or a text summary.
 */
export default function ReportsScreen() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [classrooms, setClassrooms] = useState<ClassroomTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Stats for the currently selected classroom
  const [avgAttendance, setAvgAttendance] = useState(0)
  const [atRisk, setAtRisk] = useState<AtRiskStudent[]>([])
  const [sessionsHeld, setSessionsHeld] = useState(0)
  const [perfectCount, setPerfectCount] = useState(0)
  const [weekBars, setWeekBars] = useState<WeekBar[]>([])
  const [enrolledCount, setEnrolledCount] = useState(0)

  // Watches: user
  // Effect: loads the instructor's classrooms from the classes table on mount
  useEffect(() => {
    if (!user) return
    setFetchError(null)
    // Fetch all classes belonging to this instructor
    supabase
      .from('classes')
      .select('id, name, class_id')
      .or(`instructor_id.eq.${user.id},lecturer_id.eq.${user.id}`)
      .then(({ data, error }) => {
        if (error) {
          setFetchError('Could not load your classrooms. Pull down to retry.')
          setLoading(false)
          return
        }
        const tabs: ClassroomTab[] = (data ?? []).map((c: any) => ({ id: c.id, code: c.class_id ?? c.name, name: c.name }))
        setClassrooms(tabs)
        if (tabs.length > 0) setActiveId(tabs[0].id)
        setLoading(false)
      })
  }, [user])

  /**
   * Fetches detailed statistics for the currently selected classroom.
   * Queries sessions, profiles (enrollment count), and attendance tables.
   */
  const fetchStats = useCallback(async () => {
    if (!activeId) return
    setStatsLoading(true)
    try {
      // Fetch all sessions for this classroom ordered by date
      const { data: sessions, error: sessErr } = await supabase
        .from('sessions')
        .select('id, started_at, status')
        .eq('class_id', activeId)
        .order('started_at', { ascending: true })

      if (sessErr) throw sessErr

      const sessionIds = (sessions ?? []).map((s: any) => s.id)
      setSessionsHeld(sessionIds.length)

      // Count enrolled students for this classroom
      const { count: enrolled, error: enrollErr } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', activeId)
      if (enrollErr) throw enrollErr
      setEnrolledCount(enrolled ?? 0)

      if (sessionIds.length === 0) {
        setAvgAttendance(0); setAtRisk([]); setPerfectCount(0); setWeekBars([]); setRefreshing(false); setStatsLoading(false); return
      }

      // Fetch all attendance logs for these sessions
      const { data: logs, error: logsErr } = await supabase
        .from('attendance')
        .select('session_id, student_id')
        .in('session_id', sessionIds)

      if (logsErr) throw logsErr

      // Build per-session attendance count map
      const perSession: Record<string, number> = {}
      ;(logs ?? []).forEach((l: any) => {
        perSession[l.session_id] = (perSession[l.session_id] ?? 0) + 1
      })

      // Compute average attendance percentage across all sessions
      const total = enrolled ?? 1
      const pcts = sessionIds.map((id: string) => ((perSession[id] ?? 0) / total) * 100)
      const avg = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0
      setAvgAttendance(Math.round(avg))

      // Build weekly trend bars from the last 7 sessions
      const last7 = (sessions ?? []).slice(-7)
      setWeekBars(last7.map((s: any, i: number) => ({
        week: `W${i + 1}`,
        pct: Math.round(((perSession[s.id] ?? 0) / total) * 100),
      })))

      // Build per-student attendance count map
      const studentSessions: Record<string, number> = {}
      ;(logs ?? []).forEach((l: any) => {
        studentSessions[l.student_id] = (studentSessions[l.student_id] ?? 0) + 1
      })

      // Count students with perfect attendance
      const perfect = Object.values(studentSessions).filter(c => c === sessionIds.length).length
      setPerfectCount(perfect)

      // Identify at-risk students (below 75% attendance)
      const atRiskIds = Object.entries(studentSessions)
        .filter(([, count]) => (count / sessionIds.length) < 0.75)
        .map(([id]) => id)

      if (atRiskIds.length > 0) {
        // Fetch profile details for at-risk students
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, student_id')
          .in('id', atRiskIds)

        const atRiskList: AtRiskStudent[] = (profiles ?? []).map((p: any) => {
          const attended = studentSessions[p.id] ?? 0
          const absences = sessionIds.length - attended
          const pct = Math.round((attended / sessionIds.length) * 100)
          return { id: p.id, name: p.full_name, studentId: p.student_id ?? p.id, absences, pct }
        })
        setAtRisk(atRiskList)
      } else {
        setAtRisk([])
      }
    } catch (err: any) {
      console.error('fetchStats error:', err)
      Alert.alert('Could not load stats', err?.message ?? 'Check your connection and try again.')
    } finally {
      setRefreshing(false)
      setStatsLoading(false)
    }
  }, [activeId])

  // Watches: activeId (via fetchStats dependency)
  // Effect: re-fetches stats whenever the selected classroom changes
  useEffect(() => { fetchStats() }, [fetchStats])

  /**
   * Builds the full attendance matrix (one row per student per session)
   * for the currently selected classroom. Used by handleExport.
   * @returns array of row objects ready for CSV/text formatting
   */
  async function fetchExportData() {
    if (!activeId) return []
    const classroom = classrooms.find(c => c.id === activeId)

    // Fetch all sessions for this classroom
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, class_id, started_at, status')
      .eq('class_id', activeId)
      .order('started_at', { ascending: true })

    if (!sessions?.length) return []

    const sessionIds = sessions.map((s: any) => s.id)

    // Fetch enrolled students
    const { data: enrollments } = await supabase
      .from('profiles')
      .select('id, full_name, student_id')
      .eq('class_id', activeId)

    // Fetch all attendance logs for these sessions
    const { data: logs } = await supabase
      .from('attendance')
      .select('session_id, student_id, signed_at, suspicious_flag')
      .in('session_id', sessionIds)

    // Build lookup: session_id + student_id → log
    const logMap: Record<string, any> = {}
    ;(logs ?? []).forEach((l: any) => {
      logMap[`${l.session_id}_${l.student_id}`] = l
    })

    // Build rows: one per student per session
    const rows: any[] = []
    for (const session of sessions) {
      for (const profile of (enrollments ?? [])) {
        const log = logMap[`${session.id}_${(profile as any).id}`]
        rows.push({
          unit: classroom?.name ?? '',
          class_id: session.class_id,
          session_date: new Date(session.started_at).toLocaleDateString('en-GB'),
          session_time: new Date(session.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          student_name: (profile as any).full_name ?? '',
          student_id: (profile as any).student_id ?? '',
          status: log ? 'Present' : 'Absent',
          signed_at: log ? new Date(log.signed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '',
          flagged: log?.suspicious_flag ? 'Yes' : 'No',
        })
      }
    }
    return rows
  }

  /**
   * Exports attendance data as CSV or a plain-text summary via the native share sheet.
   * @param type - 'csv' for spreadsheet format, 'pdf' for text summary
   */
  async function handleExport(type: string) {
    const classroom = classrooms.find(c => c.id === activeId)
    if (type === 'csv') {
      setExportingCsv(true)
    } else {
      setExportingPdf(true)
    }
    try {
      const rows = await fetchExportData()

      if (type === 'csv') {
        if (rows.length === 0) {
          Alert.alert('No data', 'No attendance data to export yet. Run some sessions first.')
          return
        }
        // Build CSV string with headers
        const headers = ['Unit', 'Course Code', 'Date', 'Time', 'Student Name', 'Student ID', 'Status', 'Signed At', 'Flagged']
        const csvRows = rows.map(r => [
          `"${r.unit}"`,
          r.class_id,
          r.session_date,
          r.session_time,
          `"${r.student_name}"`,
          r.student_id,
          r.status,
          r.signed_at,
          r.flagged,
        ].join(','))
        const csv = [headers.join(','), ...csvRows].join('\n')

        await Share.share({
          title: `SmartRoll_${classroom?.code ?? 'Report'}.csv`,
          message: csv,
        })
      } else {
        // Text summary for PDF-style export
        const present = rows.filter(r => r.status === 'Present').length
        const absent = rows.filter(r => r.status === 'Absent').length
        const total = rows.length
        const pct = total > 0 ? Math.round((present / total) * 100) : 0

        const summary = [
          `SmartRoll Attendance Report`,
          `Unit: ${classroom?.name ?? ''}  (${classroom?.code ?? ''})`,
          `Generated: ${new Date().toLocaleDateString('en-GB')}`,
          ``,
          `SUMMARY`,
          `Total Records: ${total}`,
          `Present: ${present}  (${pct}%)`,
          `Absent: ${absent}`,
          `Sessions: ${sessionsHeld}`,
          `At Risk: ${atRisk.length}`,
          ``,
          `ATTENDANCE DETAIL`,
          ...rows.map(r => `${r.session_date} | ${r.student_name} (${r.student_id}) | ${r.status}${r.flagged === 'Yes' ? ' [FLAGGED]' : ''}`),
        ].join('\n')

        await Share.share({
          title: `SmartRoll_${classroom?.code ?? 'Report'}.txt`,
          message: summary,
        })
      }
    } catch (err: any) {
      Alert.alert('Export failed', err?.message ?? 'Could not export data. Please try again.')
    } finally {
      setExportingCsv(false)
      setExportingPdf(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={[styles.emptySubText, { marginTop: 12 }]}>Loading your classrooms…</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStats() }} tintColor={ACCENT} />}
      >
        {/* Page header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.greeting}>Reports</Text>
          <Text style={styles.name}>Semester 1  2025/2026</Text>
        </View>

        {/* Network / fetch error banner */}
        {fetchError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{fetchError}</Text>
          </View>
        )}

        {classrooms.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <ChartEmptyIcon />
            </View>
            <Text style={styles.emptyText}>No classrooms yet</Text>
            <Text style={styles.emptySubText}>Create a classroom in the Classrooms tab to start tracking attendance and viewing reports.</Text>
          </View>
        ) : (
          <>
            {/* Classroom selector tabs — min height 44pt for touch target */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsScroll}
              contentContainerStyle={styles.tabsContent}
              accessibilityRole="tablist"
            >
              {classrooms.map(tab => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tab, activeId === tab.id && styles.tabActive]}
                  onPress={() => setActiveId(tab.id)}
                  accessibilityRole="tab"
                  accessibilityLabel={`${tab.code} classroom tab`}
                  accessibilityState={{ selected: activeId === tab.id }}
                >
                  <Text style={[styles.tabText, activeId === tab.id && styles.tabTextActive]}>{tab.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Stats loading overlay */}
            {statsLoading ? (
              <View style={styles.statsLoadingWrap}>
                <ActivityIndicator color={ACCENT} size="large" />
                <Text style={styles.statsLoadingText}>Loading stats…</Text>
              </View>
            ) : (
              <>
                {/* Summary stat cards */}
                <View style={styles.summaryGrid}>
                  {[
                    { label: 'Avg Attendance', val: `${avgAttendance}%`, sub: classrooms.find(c => c.id === activeId)?.name ?? '', color: avgAttendance >= 75 ? GREEN : DANGER },
                    { label: 'At Risk',        val: `${atRisk.length}`,  sub: 'below 75%',    color: DANGER },
                    { label: 'Sessions Held',  val: `${sessionsHeld}`,   sub: `${enrolledCount} enrolled`, color: ACCENT },
                    { label: 'Perfect Attend.', val: `${perfectCount}`,  sub: 'students',     color: WARNING },
                  ].map(card => (
                    <View key={card.label} style={styles.summaryCard} accessibilityRole="text">
                      <Text style={styles.summaryLabel}>{card.label.toUpperCase()}</Text>
                      <Text style={[styles.summaryVal, { color: card.color }]}>{card.val}</Text>
                      <Text style={styles.summarySub}>{card.sub}</Text>
                    </View>
                  ))}
                </View>

                {/* No sessions yet — empty state for stats */}
                {sessionsHeld === 0 && (
                  <View style={styles.noSessionsWrap}>
                    <CalendarEmptyIcon />
                    <Text style={styles.noSessionsText}>No sessions yet</Text>
                    <Text style={styles.noSessionsSub}>Start a session from the Classrooms tab to begin collecting attendance data.</Text>
                  </View>
                )}

                {/* Weekly attendance trend bar chart */}
                {weekBars.length > 0 && (
                  <View style={styles.trendCard}>
                    <Text style={styles.sectionTitle}>WEEKLY TREND — LAST {weekBars.length} SESSIONS</Text>
                    <View style={styles.barChart}>
                      {weekBars.map(({ week, pct }) => (
                        <View key={week} style={styles.barCol} accessibilityRole="text" accessibilityLabel={`${week}: ${pct}% attendance`}>
                          <Text style={styles.barPctLbl}>{pct}%</Text>
                          <View style={[styles.barFill, { height: Math.max(Math.round(pct * 0.55), 2), backgroundColor: barColor(pct) }]} />
                          <Text style={styles.barDay}>{week}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* At-risk student list */}
                {atRisk.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>AT-RISK STUDENTS</Text>
                    {atRisk.map(s => {
                      const init = s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                      const color = s.pct < 65 ? DANGER : WARNING
                      return (
                        <View key={s.id} style={styles.atRiskCard} accessibilityRole="text" accessibilityLabel={`${s.name}, ${s.pct}% attendance, ${s.absences} absences`}>
                          <View style={[styles.atRiskAvatar, { backgroundColor: color === DANGER ? '#F5E8E8' : '#FDF3E0' }]}>
                            <Text style={[styles.atRiskAvatarText, { color }]}>{init}</Text>
                          </View>
                          <View style={styles.atRiskInfo}>
                            <Text style={styles.atRiskName}>{s.name}</Text>
                            <Text style={styles.atRiskDetail}>{s.studentId}  {s.absences} absences</Text>
                          </View>
                          <Text style={[styles.atRiskPct, { color }]}>{s.pct}%</Text>
                        </View>
                      )
                    })}
                  </>
                )}

                {/* Export buttons — with loading states */}
                <View style={styles.exportRow}>
                  <TouchableOpacity
                    style={[styles.exportBtn, exportingPdf && styles.exportBtnDisabled]}
                    onPress={() => handleExport('pdf')}
                    disabled={exportingPdf || exportingCsv}
                    accessibilityRole="button"
                    accessibilityLabel="Export attendance summary as text"
                    accessibilityState={{ disabled: exportingPdf || exportingCsv, busy: exportingPdf }}
                  >
                    {exportingPdf
                      ? <ActivityIndicator color={ACCENT} size="small" />
                      : <ExportIcon />
                    }
                    <Text style={styles.exportBtnText}>{exportingPdf ? 'Exporting…' : 'Export Summary'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.exportBtn, exportingCsv && styles.exportBtnDisabled]}
                    onPress={() => handleExport('csv')}
                    disabled={exportingPdf || exportingCsv}
                    accessibilityRole="button"
                    accessibilityLabel="Export attendance data as CSV spreadsheet"
                    accessibilityState={{ disabled: exportingPdf || exportingCsv, busy: exportingCsv }}
                  >
                    {exportingCsv
                      ? <ActivityIndicator color={ACCENT} size="small" />
                      : <ExportIcon />
                    }
                    <Text style={styles.exportBtnText}>{exportingCsv ? 'Exporting…' : 'Export CSV'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  greeting: { fontSize: 13, color: MUTED, marginBottom: 2 },
  name: { fontSize: 26, fontWeight: '600', color: TEXT },
  // Error banner
  errorBanner: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: 'rgba(139,26,26,0.25)', borderRadius: 12, marginHorizontal: 24, marginBottom: 16, padding: 12 },
  errorBannerText: { fontSize: 13, color: DANGER, textAlign: 'center' },
  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIconWrap: { marginBottom: 16, opacity: 0.5 },
  emptyText: { fontSize: 17, fontWeight: '600', color: TEXT, marginBottom: 8 },
  emptySubText: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },
  // No sessions empty state
  noSessionsWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
  noSessionsText: { fontSize: 15, fontWeight: '500', color: TEXT, marginTop: 12, marginBottom: 6 },
  noSessionsSub: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },
  // Stats loading
  statsLoadingWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  statsLoadingText: { fontSize: 13, color: MUTED },
  // Tabs — min height 44pt for touch target compliance
  tabsScroll: { marginHorizontal: 24, marginBottom: 20 },
  tabsContent: { gap: 8, paddingVertical: 2 },
  tab: { paddingHorizontal: 16, paddingVertical: 11, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: BORDER2, backgroundColor: SURFACE, justifyContent: 'center', alignItems: 'center' },
  tabActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabText: { fontSize: 13, fontWeight: '500', color: MUTED },
  tabTextActive: { color: '#fff' },
  // Summary cards
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24, gap: 12, marginBottom: 20 },
  summaryCard: { width: '47%', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, padding: 16 },
  summaryLabel: { fontSize: 10, color: MUTED, letterSpacing: 1, marginBottom: 8 },
  summaryVal: { fontSize: 30, fontWeight: '700', lineHeight: 32, marginBottom: 4 },
  summarySub: { fontSize: 11, color: MUTED },
  // Trend chart
  trendCard: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, padding: 20, marginHorizontal: 24, marginBottom: 24 },
  sectionTitle: { fontSize: 11, color: MUTED, letterSpacing: 1.5, paddingHorizontal: 24, marginBottom: 14 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4 },
  barDay: { fontSize: 9, color: MUTED, letterSpacing: 0.3 },
  barPctLbl: { fontSize: 9, color: MUTED },
  // At-risk cards
  atRiskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderLeftWidth: 3, borderLeftColor: DANGER, borderRadius: 18, padding: 16, marginHorizontal: 24, marginBottom: 10, gap: 12 },
  atRiskAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  atRiskAvatarText: { fontSize: 13, fontWeight: '600' },
  atRiskInfo: { flex: 1 },
  atRiskName: { fontSize: 14, fontWeight: '500', color: TEXT },
  atRiskDetail: { fontSize: 12, color: MUTED, marginTop: 2 },
  atRiskPct: { fontSize: 16, fontWeight: '700', flexShrink: 0 },
  // Export buttons — min height 44pt
  exportRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginTop: 8, marginBottom: 16 },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: BORDER2, backgroundColor: SURFACE },
  exportBtnDisabled: { opacity: 0.55 },
  exportBtnText: { fontSize: 13, fontWeight: '500', color: TEXT },
})
