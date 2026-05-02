// ============================================================
// SmartRoll — Individual Session Report Screen
// Displays a detailed attendance report for a single session:
// attendance rate ring, present/absent counts, and a per-student
// breakdown. Supports CSV export via the native share sheet.
// ============================================================

import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Share, StatusBar,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Svg, { Polyline, Path, Line } from 'react-native-svg'
import { supabase } from '../../../src/services/supabase'

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

interface ReportRecord {
  id: string
  studentId: string
  studentName: string
  studentRegNo: string
  signedAt: string
  distanceMetres: number | null
  status: 'present' | 'absent' | 'late'
}

interface ReportData {
  sessionId: string
  className: string
  courseCode: string
  startedAt: string
  endedAt: string | null
  totalEnrolled: number
  presentCount: number
  absentCount: number
  records: ReportRecord[]
}

function BackIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  )
}

function ExportIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M7 10l5 5 5-5" />
      <Line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  )
}

function barColor(pct: number) {
  if (pct >= 80) return GREEN
  if (pct >= 75) return WARNING
  return DANGER
}

export default function AttendanceReportScreen() {
  const { id: sessionId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Watches: sessionId
  // Effect: fetches the report when the session ID is available
  useEffect(() => {
    if (!sessionId) return
    fetchReport()
  }, [sessionId])

  /**
   * Fetches session info, enrolled students, and attendance logs.
   * Queries: sessions JOIN classes, profiles (enrolled), attendance tables.
   * Builds a ReportData object with per-student records.
   */
  async function fetchReport() {
    setLoading(true)
    setError(null)
    try {
      // Load session + class info
      const { data: sessionData, error: sessionErr } = await supabase
        .from('sessions')
        .select('id, class_id, started_at, ended_at, classes(id, name, class_id)')
        .eq('id', sessionId)
        .single()

      if (sessionErr || !sessionData) throw new Error(sessionErr?.message ?? 'Session not found')

      const classInfo = (sessionData as any).classes
      const classId = sessionData.class_id

      // Load enrolled students
      const { data: enrolled } = await supabase
        .from('profiles')
        .select('id, full_name, student_id')
        .eq('class_id', classId)
        .eq('role', 'student')

      // Load attendance logs
      const { data: logs } = await supabase
        .from('attendance')
        .select('id, student_id, status, signed_at, distance_metres')
        .eq('session_id', sessionId)

      const logMap: Record<string, any> = {}
      ;(logs ?? []).forEach((l: any) => { logMap[l.student_id] = l })

      const records: ReportRecord[] = (enrolled ?? []).map((p: any) => {
        const log = logMap[p.id]
        return {
          id: p.id,
          studentId: p.id,
          studentName: p.full_name,
          studentRegNo: p.student_id ?? '—',
          signedAt: log?.signed_at ?? '',
          distanceMetres: log?.distance_metres ?? null,
          status: log ? (log.status ?? 'present') : 'absent',
        }
      })

      const presentCount = records.filter(r => r.status === 'present').length

      setReport({
        sessionId: sessionData.id,
        className: classInfo?.name ?? 'Class',
        courseCode: classInfo?.class_id ?? '—',
        startedAt: sessionData.started_at,
        endedAt: sessionData.ended_at,
        totalEnrolled: records.length,
        presentCount,
        absentCount: records.length - presentCount,
        records,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Builds a CSV string from the report records and triggers the native share sheet.
   */
  async function handleExport() {
    if (!report) return
    setExporting(true)
    try {
      const headers = 'Student Name,Reg No,Status,Signed At,Distance (m)'
      const rows = report.records.map(r =>
        [`"${r.studentName}"`, r.studentRegNo, r.status, r.signedAt ? new Date(r.signedAt).toLocaleString('en-GB') : '', r.distanceMetres ?? ''].join(',')
      )
      const csv = [
        `SmartRoll Attendance Report`,
        `Unit: ${report.className} (${report.courseCode})`,
        `Date: ${new Date(report.startedAt).toLocaleDateString('en-GB')}`,
        `Present: ${report.presentCount}/${report.totalEnrolled}`,
        '',
        headers,
        ...rows,
      ].join('\n')

      await Share.share({
        title: `Attendance_${report.courseCode}.csv`,
        message: csv,
      })
    } catch { /* cancelled */ } finally {
      setExporting(false)
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading report...</Text>
      </View>
    )
  }

  if (error || !report) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Text style={styles.errorTitle}>Report Unavailable</Text>
        <Text style={styles.errorText}>{error ?? 'Could not load the report.'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const rate = report.totalEnrolled > 0 ? Math.round((report.presentCount / report.totalEnrolled) * 100) : 0
  const rateColor = barColor(rate)

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
            <BackIcon /><Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerMeta}>
            <Text style={styles.headerCode}>{report.courseCode}</Text>
            <Text style={styles.headerName}>{report.className}</Text>
            <Text style={styles.headerDate}>{formatDate(report.startedAt)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
            onPress={handleExport}
            disabled={exporting}
            accessibilityRole="button"
          >
            {exporting ? <ActivityIndicator color={MUTED} size="small" /> : <ExportIcon />}
            <Text style={styles.exportBtnText}>CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Rate card */}
        <View style={styles.rateCard}>
          <View style={styles.rateLeft}>
            <Text style={styles.rateLabel}>ATTENDANCE RATE</Text>
            <Text style={[styles.rateNum, { color: rateColor }]}>{rate}%</Text>
            <Text style={styles.rateSub}>{report.presentCount} of {report.totalEnrolled} students</Text>
          </View>
          <View style={styles.rateRight}>
            <View style={styles.rateBarBg}>
              <View style={[styles.rateBarFill, { height: `${rate}%` as any, backgroundColor: rateColor }]} />
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'PRESENT', val: report.presentCount, color: GREEN },
            { label: 'ABSENT',  val: report.absentCount,  color: DANGER },
            { label: 'ENROLLED', val: report.totalEnrolled, color: ACCENT },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Student list */}
        <Text style={styles.sectionTitle}>STUDENT BREAKDOWN</Text>
        {report.records.map((r, i) => {
          const isPresent = r.status === 'present'
          return (
            <View key={r.id} style={[styles.studentRow, isPresent && styles.studentRowPresent]}>
              <View style={[styles.studentAvatar, { backgroundColor: isPresent ? '#E8F5EE' : '#F5E8E8' }]}>
                <Text style={[styles.studentAvatarText, { color: isPresent ? GREEN : DANGER }]}>
                  {r.studentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{r.studentName}</Text>
                <Text style={styles.studentId}>{r.studentRegNo}</Text>
                {isPresent && r.signedAt && (
                  <Text style={styles.studentTime}>
                    Signed {formatTime(r.signedAt)}{r.distanceMetres !== null ? `  ·  ${r.distanceMetres}m` : ''}
                  </Text>
                )}
              </View>
              <View style={[styles.statusPill, { backgroundColor: isPresent ? '#E8F5EE' : '#F5E8E8' }]}>
                <Text style={[styles.statusPillText, { color: isPresent ? GREEN : DANGER }]}>
                  {isPresent ? 'Present' : 'Absent'}
                </Text>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  loadingText: { color: MUTED, marginTop: 12, fontSize: 14 },
  errorTitle: { fontSize: 20, fontWeight: '600', color: TEXT, marginBottom: 8 },
  errorText: { color: MUTED, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  backButton: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  backButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 52, paddingBottom: 20, gap: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
  backText: { fontSize: 13, color: MUTED },
  headerMeta: { flex: 1 },
  headerCode: { fontSize: 11, letterSpacing: 1.5, color: MUTED, marginBottom: 3 },
  headerName: { fontSize: 20, fontWeight: '600', color: TEXT, marginBottom: 2 },
  headerDate: { fontSize: 13, color: MUTED },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  exportBtnText: { fontSize: 12, fontWeight: '500', color: MUTED },

  rateCard: { flexDirection: 'row', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, padding: 20, marginHorizontal: 24, marginBottom: 16, gap: 16 },
  rateLeft: { flex: 1 },
  rateLabel: { fontSize: 10, letterSpacing: 1.5, color: MUTED, marginBottom: 8 },
  rateNum: { fontSize: 48, fontWeight: '700', lineHeight: 52, marginBottom: 4 },
  rateSub: { fontSize: 13, color: MUTED },
  rateRight: { width: 24, alignItems: 'center', justifyContent: 'flex-end' },
  rateBarBg: { width: 8, height: 80, backgroundColor: SURFACE2, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  rateBarFill: { width: '100%', borderRadius: 4 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 14, padding: 14, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  statLbl: { fontSize: 9, color: MUTED, letterSpacing: 0.5 },

  sectionTitle: { fontSize: 11, color: MUTED, letterSpacing: 1.5, paddingHorizontal: 24, marginBottom: 12 },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, marginHorizontal: 24, marginBottom: 8, gap: 12 },
  studentRowPresent: { borderLeftWidth: 3, borderLeftColor: GREEN },
  studentAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  studentAvatarText: { fontSize: 13, fontWeight: '600' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '500', color: TEXT },
  studentId: { fontSize: 11, color: MUTED, marginTop: 1 },
  studentTime: { fontSize: 11, color: GREEN, marginTop: 2 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  statusPillText: { fontSize: 11, fontWeight: '600' },
})
