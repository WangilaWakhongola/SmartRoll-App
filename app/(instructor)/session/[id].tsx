// ============================================================
// SmartRoll — Live Session Management Screen
// Real-time view of a live attendance session. Shows enrolled
// students, their sign-in status, GPS verification, and suspicious
// flags. Supports geofence toggle, student search/filter, session
// close, and note-taking.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  TextInput, Modal, Switch, ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Svg, { Polyline, Path, Circle } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../../src/contexts/AuthContext'
import { supabase } from '../../../src/services/supabase'

const BG = '#F0F4FF'
const SURFACE = '#FFFFFF'
const SURFACE2 = '#F0EDE8'
const SURFACE3 = '#E8E4DE'
const BORDER = 'rgba(0,0,0,0.08)'
const BORDER2 = 'rgba(0,0,0,0.13)'
const TEXT = '#1A1714'
const MUTED = '#7A7268'
const MUTED2 = '#B0A99F'
const ACCENT = '#1a237e'
const DANGER = '#8B1A1A'
const GREEN = '#1A6641'
const WARNING = '#7A4A00'
const GREEN_BG = '#E8F5EE'
const RED_BG = '#F5E8E8'
const AMBER_BG = '#FDF3E0'

type Status = 'P' | 'A' | 'L' | null

interface Student {
  id: string
  name: string
  studentId: string
  init: string
  gps: boolean
  status: Status
  suspicious: boolean
}

function BackIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  )
}

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()

  const [session, setSession] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'P' | 'A' | 'L'>('all')
  const [geoLock, setGeoLock] = useState(true)
  const [noteModal, setNoteModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [toast, setToast] = useState('')
  const [closing, setClosing] = useState(false)

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

  /**
   * Fetches the session details, enrolled students, and attendance logs.
   * Queries: sessions JOIN classes, profiles (enrolled), attendance tables.
   * Maps the data into a Student[] array with derived status fields.
   */
  const fetchSession = useCallback(async () => {
    if (!id) return
    try {
      // Load session
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*, classes(*)')
        .eq('id', id)
        .single()
      setSession(sessionData)
      // Sync geofence toggle from DB
      setGeoLock(sessionData?.is_active ?? true)

      if (!sessionData) return

      // Load enrolled students
      const { data: enrollments } = await supabase
        .from('profiles')
        .select('id, full_name, student_id')
        .eq('class_id', sessionData.class_id)
        .eq('role', 'student')

      // Load attendance logs for this session
      const { data: logs } = await supabase
        .from('attendance')
        .select('student_id, suspicious_flag')
        .eq('session_id', id)

      const signedMap: Record<string, boolean> = {}
      const suspiciousMap: Record<string, boolean> = {}
      ;(logs ?? []).forEach((l: any) => {
        signedMap[l.student_id] = true
        suspiciousMap[l.student_id] = l.suspicious_flag
      })

      const mapped: Student[] = (enrollments ?? []).map((e: any) => {
        const name = e.full_name ?? 'Unknown'
        const init = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
        return {
          id: e.id,
          name,
          studentId: e.student_id ?? '',
          init,
          gps: signedMap[e.id] ?? false,
          status: signedMap[e.id] ? 'P' : null,
          suspicious: suspiciousMap[e.id] ?? false,
        }
      })

      setStudents(mapped)
    } catch (err) {
      console.error('fetchSession error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  // Watches: fetchSession
  // Effect: loads session data on mount and when the session ID changes
  useEffect(() => { fetchSession() }, [fetchSession])

  // Watches: id, fetchSession
  // Effect: subscribes to real-time INSERT events on the attendance table
  //         so the student list updates as students sign in
  useEffect(() => {
    const channel = supabase
      .channel(`session-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance', filter: `session_id=eq.${id}` }, () => fetchSession())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, fetchSession])

  /**
   * Closes the session by setting status='closed' and ended_at to now.
   * Shows a confirmation dialog with attendance summary before closing.
   * Navigates back after a short delay.
   */
  async function handleCloseSession() {
    const presentCount = students.filter(s => s.status === 'P').length
    const absentCount = students.filter(s => s.status === 'A' || s.status === null).length
    const suspiciousCount = students.filter(s => s.suspicious).length
    const total = students.length

    Alert.alert(
      'Close & Save Session?',
      `Attendance Summary:\n\n` +
      `✓ Present: ${presentCount} of ${total}\n` +
      `✗ Absent: ${absentCount} of ${total}\n` +
      (suspiciousCount > 0 ? `⚠ Flagged: ${suspiciousCount}\n` : '') +
      `\nThis will end the session and lock attendance records. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Session',
          style: 'destructive',
          onPress: async () => {
            setClosing(true)
            try {
              const { error } = await supabase
                .from('sessions')
                .update({ status: 'closed', ended_at: new Date().toISOString() })
                .eq('id', id)

              if (error) throw error
              showToast('Session closed successfully')
              setTimeout(() => router.back(), 1200)
            } catch (err: any) {
              showToast(err?.message ?? 'Failed to close session')
            } finally {
              setClosing(false)
            }
          },
        },
      ]
    )
  }

  const present = students.filter(s => s.status === 'P').length
  const absent = students.filter(s => s.status === 'A' || s.status === null).length
  const suspicious = students.filter(s => s.suspicious).length

  const unsignedStudents = students.filter(s => s.status !== 'P')

  /**
   * Marks all unsigned students as absent in the attendance table.
   */
  async function handleMarkAllAbsent() {
    if (unsignedStudents.length === 0) {
      showToast('All students have already signed in.')
      return
    }
    Alert.alert(
      'Mark All Absent?',
      `This will mark ${unsignedStudents.length} unsigned student${unsignedStudents.length !== 1 ? 's' : ''} as absent. You can still update individual records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Mark ${unsignedStudents.length} Absent`,
          style: 'destructive',
          onPress: async () => {
            try {
              const inserts = unsignedStudents.map(s => ({
                session_id: id,
                student_id: s.id,
                suspicious_flag: false,
              }))
              // Upsert so we don't duplicate existing records
              await supabase.from('attendance').upsert(inserts, { onConflict: 'session_id,student_id' })
              showToast(`${unsignedStudents.length} students marked absent`)
              fetchSession()
            } catch (err: any) {
              showToast(err?.message ?? 'Failed to mark absent')
            }
          },
        },
      ]
    )
  }

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.studentId.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || s.status === filter
    return matchSearch && matchFilter
  })

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    )
  }

  const classroom = session?.classes
  const isLive = session?.status === 'open'

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {!!toast && (
        <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSession() }} tintColor={ACCENT} />}
      >
        {/* Header */}
        <View style={[styles.sessionHeader, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
            <BackIcon /><Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.sessionMeta}>
            <Text style={styles.unitCode}>{session?.class_id}</Text>
            <Text style={styles.unitName}>{classroom?.name ?? 'Session'}</Text>
            <Text style={styles.unitTime}>{classroom?.building ?? 'TBA'}</Text>
          </View>
          <View style={styles.badgeRow}>
            {isLive ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>Live</Text>
              </View>
            ) : (
              <View style={styles.endedBadge}>
                <Text style={styles.endedBadgeText}>Ended</Text>
              </View>
            )}
            <View style={styles.gpsBadge}>
              <Text style={styles.gpsBadgeText}>GPS  {classroom?.radius_meters ?? 50}m</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: GREEN }]}>{present}</Text>
            <Text style={styles.statLbl}>PRESENT</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: DANGER }]}>{absent}</Text>
            <Text style={styles.statLbl}>ABSENT</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{students.length}</Text>
            <Text style={styles.statLbl}>TOTAL</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: suspicious > 0 ? WARNING : MUTED }]}>{suspicious}</Text>
            <Text style={styles.statLbl}>FLAGGED</Text>
          </View>
        </View>

        {/* Geo toggle */}
        {isLive && (
          <View style={styles.geoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.geoLabel}>GPS Geofence Lock</Text>
              <Text style={styles.geoSub}>Only allow sign-in within {classroom?.radius_meters ?? 50}m</Text>
            </View>
            <Switch value={geoLock} onValueChange={async (v) => {
              setGeoLock(v)
              await supabase.from('sessions').update({ is_active: v }).eq('id', id)
              showToast(v ? 'Geofence enabled — students must be inside classroom' : 'Geofence disabled — students can sign from anywhere')
            }} trackColor={{ false: SURFACE3, true: GREEN }} thumbColor="#fff" />
          </View>
        )}

        {/* Search */}
        <View style={styles.searchWrap}>
          <TextInput style={styles.searchInput} placeholder="Search students..." placeholderTextColor={MUTED2} value={search} onChangeText={setSearch} />
          {search.length > 0 && (
            <TouchableOpacity
              style={styles.searchClear}
              onPress={() => setSearch('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
          {(['all', 'P', 'A'] as const).map(f => (
            <TouchableOpacity key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)} accessibilityRole="button">
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'all' ? 'All' : f === 'P' ? 'Present' : 'Absent'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Student list */}
        <View style={styles.studentList}>
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No students enrolled yet.</Text>
            </View>
          ) : filtered.map(s => {
            const borderColor = s.suspicious ? WARNING : s.status === 'P' ? GREEN : BORDER
            return (
              <View key={s.id} style={[
                styles.studentCard,
                { borderLeftWidth: (s.status === 'P' || s.suspicious) ? 3 : 1, borderLeftColor: borderColor },
                s.suspicious && styles.studentCardSuspicious,
              ]}>
                <View style={[styles.studentAvatar, { backgroundColor: s.suspicious ? AMBER_BG : s.status === 'P' ? GREEN_BG : SURFACE2 }]}>
                  <Text style={[styles.studentAvatarText, { color: s.suspicious ? WARNING : s.status === 'P' ? GREEN : MUTED }]}>{s.init}</Text>
                </View>
                <View style={styles.studentInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.studentName}>{s.name}</Text>
                    {s.suspicious && (
                      <View style={styles.flagBadge}><Text style={styles.flagText}>⚠ Flagged</Text></View>
                    )}
                  </View>
                  <Text style={styles.studentId}>{s.studentId}</Text>
                  {s.suspicious && (
                    <Text style={styles.suspiciousNote}>Possible proxy attendance detected</Text>
                  )}
                  <Text style={[styles.gpsStatus, s.gps ? styles.gpsOk : styles.gpsNo]}>
                    {s.gps ? 'GPS verified & signed' : 'Not yet signed'}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: s.status === 'P' ? GREEN_BG : RED_BG }]}>
                  <Text style={[styles.statusPillText, { color: s.status === 'P' ? GREEN : DANGER }]}>
                    {s.status === 'P' ? 'Present' : 'Absent'}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      {isLive && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnOutline} onPress={() => setNoteModal(true)} accessibilityRole="button">
            <Text style={styles.btnOutlineText}>+ Note</Text>
          </TouchableOpacity>
          {unsignedStudents.length > 0 && (
            <TouchableOpacity style={styles.btnAbsent} onPress={handleMarkAllAbsent} accessibilityRole="button">
              <Text style={styles.btnAbsentText}>Mark All Absent</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btnSolid, closing && { opacity: 0.5 }]} onPress={handleCloseSession} disabled={closing} accessibilityRole="button">
            {closing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSolidText}>Close & Save</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Note modal */}
      <Modal visible={noteModal} transparent animationType="slide" onRequestClose={() => setNoteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add Note</Text>
            <TextInput style={styles.sheetTextarea} placeholder="E.g. Student requested excuse..." placeholderTextColor={MUTED2} value={noteText} onChangeText={setNoteText} multiline numberOfLines={4} textAlignVertical="top" />
            <View style={styles.sheetBtns}>
              <TouchableOpacity style={styles.sheetCancel} onPress={() => setNoteModal(false)} accessibilityRole="button">
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetSave} onPress={() => { setNoteModal(false); showToast('Note saved') }} accessibilityRole="button">
                <Text style={styles.sheetSaveText}>Save Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  toast: { position: 'absolute', top: 24, alignSelf: 'center', backgroundColor: ACCENT, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 100, zIndex: 999 },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sessionHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText: { fontSize: 13, color: MUTED },
  sessionMeta: { marginBottom: 14 },
  unitCode: { fontSize: 11, letterSpacing: 1.5, color: MUTED, marginBottom: 4 },
  unitName: { fontSize: 24, fontWeight: '600', color: TEXT, marginBottom: 4 },
  unitTime: { fontSize: 13, color: MUTED },
  badgeRow: { flexDirection: 'row', gap: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: GREEN_BG, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  liveBadgeText: { fontSize: 12, color: GREEN, fontWeight: '600' },
  endedBadge: { backgroundColor: SURFACE2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  endedBadgeText: { fontSize: 12, color: MUTED, fontWeight: '500' },
  gpsBadge: { backgroundColor: '#E8EFF6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  gpsBadgeText: { fontSize: 12, color: ACCENT, fontWeight: '500' },
  statsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, padding: 16, marginHorizontal: 24, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: BORDER },
  statVal: { fontSize: 20, fontWeight: '600', color: TEXT, lineHeight: 22 },
  statLbl: { fontSize: 9, color: MUTED, letterSpacing: 0.5, marginTop: 3 },
  geoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, padding: 16, paddingHorizontal: 18, marginHorizontal: 24, marginBottom: 16 },
  geoLabel: { fontSize: 14, fontWeight: '500', color: TEXT, marginBottom: 2 },
  geoSub: { fontSize: 12, color: MUTED },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 24, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: TEXT },
  searchClear: { padding: 4 },
  searchClearText: { fontSize: 14, color: MUTED, fontWeight: '600' },
  chipsScroll: { marginHorizontal: 24, marginBottom: 16 },
  chipsContent: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: BORDER2, backgroundColor: SURFACE },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { fontSize: 12, color: MUTED, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  studentList: { paddingHorizontal: 24, gap: 10 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: MUTED },
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 14, gap: 12 },
  studentCardSuspicious: { backgroundColor: '#FFFBF0', borderColor: 'rgba(122,74,0,0.25)' },
  studentAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  studentAvatarText: { fontSize: 13, fontWeight: '600' },
  studentInfo: { flex: 1, minWidth: 0 },
  studentName: { fontSize: 14, fontWeight: '500', color: TEXT },
  studentId: { fontSize: 11, color: MUTED, marginTop: 1 },
  gpsStatus: { fontSize: 11, marginTop: 2 },
  gpsOk: { color: GREEN },
  gpsNo: { color: MUTED },
  flagBadge: { backgroundColor: AMBER_BG, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(122,74,0,0.3)' },
  flagText: { fontSize: 9, fontWeight: '700', color: WARNING, letterSpacing: 0.3 },
  suspiciousNote: { fontSize: 10, color: WARNING, marginTop: 1, fontStyle: 'italic' },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  statusPillText: { fontSize: 11, fontWeight: '600' },
  actions: { position: 'absolute', bottom: 68, left: 0, right: 0, flexDirection: 'row', gap: 8, padding: 14, paddingHorizontal: 24, backgroundColor: BG, borderTopWidth: 1, borderTopColor: BORDER },
  btnOutline: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: BORDER2, backgroundColor: SURFACE, alignItems: 'center' },
  btnOutlineText: { fontSize: 13, fontWeight: '500', color: TEXT },
  btnAbsent: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: AMBER_BG, borderWidth: 1, borderColor: 'rgba(122,74,0,0.3)', alignItems: 'center' },
  btnAbsentText: { fontSize: 12, fontWeight: '600', color: WARNING },
  btnSolid: { flex: 2, padding: 14, borderRadius: 14, backgroundColor: DANGER, alignItems: 'center' },
  btnSolidText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: SURFACE, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 48 },
  sheetHandle: { width: 40, height: 4, backgroundColor: BORDER2, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 22, fontWeight: '600', color: TEXT, marginBottom: 16 },
  sheetTextarea: { backgroundColor: SURFACE2, borderWidth: 1, borderColor: BORDER2, borderRadius: 14, fontSize: 14, color: TEXT, padding: 14, height: 110, marginBottom: 16 },
  sheetBtns: { flexDirection: 'row', gap: 10 },
  sheetCancel: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: BORDER2, backgroundColor: SURFACE, alignItems: 'center' },
  sheetCancelText: { fontSize: 14, color: MUTED },
  sheetSave: { flex: 2, padding: 14, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center' },
  sheetSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
})
