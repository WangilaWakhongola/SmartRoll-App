// ============================================================
// SmartRoll — Student Analytics Screen
// Displays per-unit and overall attendance statistics for the
// logged-in student. Includes a circular progress ring, summary
// grid, per-unit bar chart, and a share/export action.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  Share, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'
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
const GREEN = '#1A6641'
const RED = '#8B1A1A'
const AMBER = '#7A4A00'

/** Per-unit attendance statistics */
interface UnitStat {
  classroomId: string
  name: string
  code: string
  attended: number
  total: number
  pct: number
}

/**
 * Returns a colour for a given attendance percentage.
 * Green ≥ 80%, Amber ≥ 75%, Red < 75%.
 * @param pct - attendance percentage (0–100)
 */
function barColor(pct: number) {
  if (pct >= 80) return GREEN
  if (pct >= 75) return AMBER
  return RED
}

// SVG ring constants
const R = 68
const CIRC = 2 * Math.PI * R

/**
 * AnalyticsScreen
 * Fetches the student's enrolled class, all sessions for that class,
 * and their personal attendance logs. Derives per-unit stats and
 * renders them as a ring chart, summary cards, and a bar breakdown.
 */
export default function AnalyticsScreen() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [units, setUnits] = useState<UnitStat[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>(null)

  /**
   * Fetches analytics data for the current student.
   * Queries the profiles table for enrolled class, then sessions and
   * attendance tables to compute per-unit attendance percentages.
   */
  const fetchAnalytics = useCallback(async () => {
    if (!user) return
    try {
      // Fetch the student's enrolled class and its details from the classes table
      const { data: enrollments } = await supabase
        .from('profiles')
        .select('class_id, classes(id, name, class_id)')
        .eq('id', user.id)

      if (!enrollments || enrollments.length === 0) {
        setUnits([]); return
      }

      const classroomIds = enrollments.map((e: any) => e.class_id).filter(Boolean)

      // Fetch all sessions for the enrolled classes
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, class_id, status')
        .in('class_id', classroomIds)

      // Fetch the student's own attendance logs for those sessions
      const sessionIds = (sessions ?? []).map((s: any) => s.id)
      let myLogs: string[] = []
      if (sessionIds.length > 0) {
        const { data: logs } = await supabase
          .from('attendance')
          .select('session_id')
          .eq('student_id', user.id)
          .in('session_id', sessionIds)
        myLogs = (logs ?? []).map((l: any) => l.session_id)
      }

      // Build per-unit stats from the enrollment + session + attendance data
      const stats: UnitStat[] = enrollments
        .filter((e: any) => e.class_id && e.classes)
        .map((e: any) => {
          const classroom = e.classes
          const unitSessions = (sessions ?? []).filter((s: any) => s.class_id === e.class_id)
          const attended = unitSessions.filter((s: any) => myLogs.includes(s.id)).length
          const total = unitSessions.length
          const pct = total > 0 ? Math.round((attended / total) * 100) : 0
          return {
            classroomId: e.class_id,
            name: classroom?.name ?? 'Unknown',
            code: classroom?.class_id ?? '—',
            attended,
            total,
            pct,
          }
        })

      setUnits(stats)
      if (stats.length > 0 && !activeTab) setActiveTab(stats[0].classroomId)
    } catch (err) {
      console.error('fetchAnalytics:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  // Watches: user
  // Effect: fetches analytics data on mount and when user changes
  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  // Derived overall stats
  const overall = units.length > 0
    ? Math.round(units.reduce((a, u) => a + u.pct, 0) / units.length)
    : 0
  const totalAttended = units.reduce((a, u) => a + u.attended, 0)
  const totalSessions = units.reduce((a, u) => a + u.total, 0)
  const atRiskCount = units.filter(u => u.pct < 75).length
  const offset = CIRC * (1 - overall / 100)

  /**
   * Builds a plain-text attendance report and triggers the native share sheet.
   */
  async function handleExport() {
    if (units.length === 0) {
      await Share.share({ title: 'No data', message: 'No attendance data to export yet.' })
      return
    }
    const lines = [
      'SmartRoll Attendance Report',
      `Student: ${user?.fullName ?? ''}  (${user?.studentId ?? ''})`,
      `Generated: ${new Date().toLocaleDateString('en-GB')}`,
      '',
      'UNIT BREAKDOWN',
      ...units.map(u => `${u.code} — ${u.name}: ${u.attended}/${u.total} sessions (${u.pct}%)`),
      '',
      `OVERALL: ${overall}%  (${totalAttended}/${totalSessions} sessions)`,
    ].join('\n')
    await Share.share({ title: 'SmartRoll_Report.txt', message: lines })
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={SURFACE} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAnalytics() }} tintColor={ACCENT} />}
      >
        {/* Page header */}
        <View style={[styles.topbar, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.sub}>Your attendance overview</Text>
        </View>

        {units.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No attendance data yet.</Text>
            <Text style={styles.emptySubText}>Enroll in units and mark attendance to see your analytics.</Text>
          </View>
        ) : (
          <>
            {/* Unit selector tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
              {units.map(u => (
                <TouchableOpacity
                  key={u.classroomId}
                  style={[styles.tab, activeTab === u.classroomId && styles.tabActive]}
                  onPress={() => setActiveTab(u.classroomId)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.tabText, activeTab === u.classroomId && styles.tabTextActive]}>{u.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Overall attendance ring */}
            <View style={styles.ringWrap}>
              <Svg width={160} height={160} viewBox="0 0 160 160" style={{ transform: [{ rotate: '-90deg' }] }}>
                {/* Track ring */}
                <Circle cx={80} cy={80} r={R} fill="none" stroke="#E8E4DE" strokeWidth={10} />
                {/* Progress arc */}
                <Circle cx={80} cy={80} r={R} fill="none" stroke={barColor(overall)} strokeWidth={10}
                  strokeDasharray={CIRC} strokeDashoffset={offset} strokeLinecap="round" />
              </Svg>
              <View style={styles.ringCenter}>
                <Text style={styles.ringPct}>{overall}%</Text>
                <Text style={styles.ringLbl}>Overall</Text>
              </View>
            </View>

            {/* Summary stat cards */}
            <View style={styles.summaryGrid}>
              {[
                { label: 'Classes Attended', val: `${totalAttended}`, sub: `out of ${totalSessions} total`, color: GREEN },
                { label: 'Absences', val: `${totalSessions - totalAttended}`, sub: 'need 75% to pass', color: RED },
                { label: 'Units Enrolled', val: `${units.length}`, sub: 'this semester', color: ACCENT },
                { label: 'At Risk', val: `${atRiskCount}`, sub: 'units below 75%', color: AMBER },
              ].map(card => (
                <View key={card.label} style={styles.repCard}>
                  <Text style={styles.repCardLabel}>{card.label.toUpperCase()}</Text>
                  <Text style={[styles.repCardVal, { color: card.color }]}>{card.val}</Text>
                  <Text style={styles.repCardSub}>{card.sub}</Text>
                </View>
              ))}
            </View>

            {/* Per-unit horizontal bar breakdown */}
            <View style={styles.unitSection}>
              <Text style={styles.sectionLabel}>PER UNIT BREAKDOWN</Text>
              {units.map(u => (
                <View key={u.classroomId} style={styles.unitRow}>
                  <View style={styles.unitInfo}>
                    <Text style={styles.unitName}>{u.name}</Text>
                    <Text style={styles.unitCode}>{u.code}  {u.attended}/{u.total} sessions</Text>
                  </View>
                  <View style={styles.barWrap}>
                    <View style={styles.barBg}>
                      <View style={[styles.barFillH, { width: `${u.pct}%` as any, backgroundColor: barColor(u.pct) }]} />
                    </View>
                    <Text style={[styles.barPct, { color: barColor(u.pct) }]}>{u.pct}%</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Export report button */}
            <View style={styles.exportRow}>
              <TouchableOpacity style={styles.expBtn} onPress={handleExport} accessibilityRole="button">
                <Text style={styles.expBtnText}>Export Report</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  topbar: { backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER, padding: 22, paddingTop: 16 },
  title: { fontSize: 26, fontWeight: '600', color: TEXT, marginBottom: 2 },
  sub: { fontSize: 13, color: MUTED },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontWeight: '500', color: TEXT, marginBottom: 6 },
  emptySubText: { fontSize: 13, color: MUTED, textAlign: 'center' },
  tabsScroll: { backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabsContent: { paddingHorizontal: 22, paddingVertical: 14, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: BORDER2, backgroundColor: SURFACE },
  tabActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabText: { fontSize: 12, fontWeight: '500', color: MUTED },
  tabTextActive: { color: '#fff' },
  ringWrap: { alignItems: 'center', paddingVertical: 24, position: 'relative' },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontSize: 32, fontWeight: '600', color: TEXT },
  ringLbl: { fontSize: 12, color: MUTED },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 18, gap: 10, marginBottom: 8 },
  repCard: { width: '47%', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 16 },
  repCardLabel: { fontSize: 10, color: MUTED, letterSpacing: 1, marginBottom: 8 },
  repCardVal: { fontSize: 30, fontWeight: '700', lineHeight: 32, marginBottom: 4 },
  repCardSub: { fontSize: 11, color: MUTED },
  unitSection: { paddingHorizontal: 22, paddingBottom: 8 },
  sectionLabel: { fontSize: 10, letterSpacing: 2, color: MUTED, marginBottom: 12 },
  unitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 14, marginBottom: 8, gap: 14 },
  unitInfo: { flex: 1 },
  unitName: { fontSize: 14, fontWeight: '500', color: TEXT },
  unitCode: { fontSize: 12, color: MUTED, marginTop: 1 },
  barWrap: { width: 80 },
  barBg: { height: 4, backgroundColor: SURFACE2, borderRadius: 2, overflow: 'hidden' },
  barFillH: { height: '100%', borderRadius: 2 },
  barPct: { fontSize: 12, marginTop: 4, textAlign: 'right' },
  exportRow: { paddingHorizontal: 22, paddingBottom: 16 },
  expBtn: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: BORDER2, backgroundColor: SURFACE, alignItems: 'center' },
  expBtnText: { fontSize: 13, fontWeight: '500', color: TEXT },
})
