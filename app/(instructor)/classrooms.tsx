// ============================================================
// SmartRoll — Classroom Management Screen
// Allows instructors to create, delete, and manage classrooms
// (units). Supports GPS-based geofence setup, enrollment
// open/close toggling, student enrollment management, and
// starting live attendance sessions.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  Modal, TextInput, ActivityIndicator, Alert, RefreshControl, Switch, Animated,
} from 'react-native'
import Svg, { Path, Circle, Line, Polyline, Rect } from 'react-native-svg'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/services/supabase'
import { NotificationService } from '../../src/services/notification.service'
import * as SecureStore from 'expo-secure-store'

const FAB_TOOLTIP_KEY = 'smartroll_fab_tooltip_shown'

const BG = '#F0F4FF'
const SURFACE = '#FFFFFF'
const SURFACE2 = '#F0EDE8'
const BORDER = 'rgba(0,0,0,0.08)'
const BORDER2 = 'rgba(0,0,0,0.13)'
const TEXT = '#1A1714'
const MUTED = '#7A7268'
const MUTED2 = '#B0A99F'
const ACCENT = '#1a237e'
const DANGER = '#8B1A1A'
const GREEN = '#1A6641'

interface Classroom {
  id: string
  name: string
  building: string | null
  class_id: string | null
  latitude: number
  longitude: number
  radius_meters: number
  enrolled: number
  enrollment_open: boolean
}

interface Student {
  id: string
  full_name: string
  student_id: string | null
  enrolled: boolean
}

function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
      <Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  )
}
function LocationIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="10" r="3" />
      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
    </Svg>
  )
}
function UsersIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" /><Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}
function TrashIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={DANGER} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="3 6 5 6 21 6" /><Path d="M19 6l-1 14H6L5 6" /><Path d="M10 11v6" /><Path d="M14 11v6" /><Path d="M9 6V4h6v2" />
    </Svg>
  )
}
/** Empty state illustration for no classrooms */
function ClassroomEmptyIcon() {
  return (
    <Svg width={72} height={72} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <Line x1="8" y1="21" x2="16" y2="21" />
      <Line x1="12" y1="17" x2="12" y2="21" />
    </Svg>
  )
}

// ─── Add Classroom Modal ──────────────────────────────────────────────────────
function AddClassroomModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [building, setBuilding] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState('50')
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() { setName(''); setCode(''); setBuilding(''); setLat(''); setLng(''); setRadius('50'); setError(null) }

  async function useCurrentLocation() {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { setError('Location permission denied.'); return }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setLat(pos.coords.latitude.toFixed(6))
      setLng(pos.coords.longitude.toFixed(6))
    } catch {
      setError('Could not get location. Enter coordinates manually.')
    } finally {
      setLocating(false)
    }
  }

  async function handleSave() {
    setError(null)
    if (!name.trim()) { setError('Unit name is required.'); return }
    if (!code.trim()) { setError('Course code is required (e.g. CS201).'); return }
    if (!lat || !lng) { setError('GPS coordinates are required. Use "Use My Location" or enter manually.'); return }
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum)) { setError('Invalid coordinates.'); return }
    if (!user) { setError('Not authenticated. Please sign in again.'); return }
    const radiusNum = parseInt(radius) || 50

    setSaving(true)
    try {
      const { data, error: err } = await supabase.from('classes').insert({
        name: name.trim(),
        class_id: code.trim().toUpperCase(),
        building: building.trim() || null,
        latitude: latNum,
        longitude: lngNum,
        radius_meters: radiusNum,
        instructor_id: user.id,
        lecturer_id: user.id,
      }).select().single()

      if (err) {
        console.error('[AddClassroom] insert error:', JSON.stringify(err))
        throw new Error(err.message || err.details || err.hint || 'Failed to save unit.')
      }
      if (!data) throw new Error('No data returned after insert. Check RLS policies.')

      reset()
      onSaved()
      onClose()
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to save classroom.'
      setError(msg)
      // Also show an Alert so the error is visible even if modal state is stale
      Alert.alert('Could not save unit', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose() }}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />
          <Text style={mStyles.title}>Add Unit / Classroom</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={mStyles.label}>UNIT NAME</Text>
            <TextInput style={mStyles.input} placeholder="e.g. Data Structures & Algorithms" placeholderTextColor={MUTED2} value={name} onChangeText={t => { setName(t); setError(null) }} />

            <Text style={mStyles.label}>COURSE CODE</Text>
            <TextInput style={mStyles.input} placeholder="e.g. CS201" placeholderTextColor={MUTED2} value={code} onChangeText={t => { setCode(t); setError(null) }} autoCapitalize="characters" />

            <Text style={mStyles.label}>BUILDING / ROOM (optional)</Text>
            <TextInput style={mStyles.input} placeholder="e.g. Block A, Room 101" placeholderTextColor={MUTED2} value={building} onChangeText={setBuilding} />

            <Text style={mStyles.label}>CLASSROOM GPS LOCATION</Text>
            <TouchableOpacity style={mStyles.locationBtn} onPress={useCurrentLocation} disabled={locating} accessibilityRole="button">
              {locating ? <ActivityIndicator color={ACCENT} size="small" /> : <LocationIcon />}
              <Text style={mStyles.locationBtnText}>{locating ? 'Getting location...' : 'Use My Current Location'}</Text>
            </TouchableOpacity>

            <View style={mStyles.coordRow}>
              <View style={{ flex: 1 }}>
                <Text style={mStyles.label}>LATITUDE</Text>
                <TextInput style={mStyles.input} placeholder="-1.2921" placeholderTextColor={MUTED2} value={lat} onChangeText={t => { setLat(t); setError(null) }} keyboardType="numeric" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={mStyles.label}>LONGITUDE</Text>
                <TextInput style={mStyles.input} placeholder="36.8219" placeholderTextColor={MUTED2} value={lng} onChangeText={t => { setLng(t); setError(null) }} keyboardType="numeric" />
              </View>
            </View>

            <Text style={mStyles.label}>GEOFENCE RADIUS (metres)</Text>
            <View style={mStyles.radiusRow}>
              {['20', '30', '50', '100'].map(r => (
                <TouchableOpacity key={r} style={[mStyles.radiusChip, radius === r && mStyles.radiusChipActive]} onPress={() => setRadius(r)} accessibilityRole="button">
                  <Text style={[mStyles.radiusChipText, radius === r && mStyles.radiusChipTextActive]}>{r}m</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!!error && <View style={mStyles.errorBox}><Text style={mStyles.errorText}>{error}</Text></View>}

            <View style={mStyles.btnRow}>
              <TouchableOpacity style={mStyles.cancelBtn} onPress={() => { reset(); onClose() }} accessibilityRole="button">
                <Text style={mStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[mStyles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving} accessibilityRole="button">
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.saveBtnText}>Save Unit</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

// ─── Enroll Students Modal ────────────────────────────────────────────────────
function EnrollModal({ visible, classroom, onClose }: { visible: boolean; classroom: Classroom | null; onClose: () => void }) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !classroom) return
    setLoading(true)
    Promise.all([
      supabase.from('profiles').select('id, full_name, student_id').eq('role', 'student'),
      supabase.from('profiles').select('id').eq('class_id', classroom.id).eq('role', 'student'),
    ]).then(([{ data: allStudents }, { data: enrolled }]) => {
      const enrolledIds = new Set((enrolled ?? []).map((e: any) => e.id))
      setStudents((allStudents ?? []).map((s: any) => ({ ...s, enrolled: enrolledIds.has(s.id) })))
      setLoading(false)
    })
  }, [visible, classroom])

  async function toggleEnroll(student: Student) {
    if (!classroom) return
    setSaving(student.id)
    try {
      if (student.enrolled) {
        // Remove from class — set class_id to null
        await supabase.from('profiles').update({ class_id: null }).eq('id', student.id)
      } else {
        // Enroll — set class_id
        await supabase.from('profiles').update({ class_id: classroom.id }).eq('id', student.id)
      }
      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, enrolled: !s.enrolled } : s))
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update enrollment.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={[mStyles.sheet, { maxHeight: '80%' }]}>
          <View style={mStyles.handle} />
          <Text style={mStyles.title}>Enroll Students</Text>
          <Text style={mStyles.subtitle}>{classroom?.class_id} — {classroom?.name}</Text>

          {loading ? (
            <View style={{ padding: 32, alignItems: 'center' }}><ActivityIndicator color={ACCENT} /></View>
          ) : students.length === 0 ? (
            <Text style={{ color: MUTED, textAlign: 'center', padding: 24 }}>No students registered yet.</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {students.map(s => (
                <View key={s.id} style={mStyles.studentRow}>
                  <View style={mStyles.studentAvatar}>
                    <Text style={mStyles.studentAvatarText}>{s.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={mStyles.studentName}>{s.full_name}</Text>
                    <Text style={mStyles.studentId}>{s.student_id ?? 'No ID'}</Text>
                  </View>
                  {saving === s.id ? (
                    <ActivityIndicator color={ACCENT} size="small" />
                  ) : (
                    <Switch
                      value={s.enrolled}
                      onValueChange={() => toggleEnroll(s)}
                      trackColor={{ false: '#D0C8C0', true: GREEN }}
                      thumbColor="#fff"
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={[mStyles.saveBtn, { marginTop: 16 }]} onPress={onClose} accessibilityRole="button">
            <Text style={mStyles.saveBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: SURFACE, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48, maxHeight: '92%' },
  handle: { width: 40, height: 4, backgroundColor: BORDER2, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: TEXT, marginBottom: 4 },
  subtitle: { fontSize: 13, color: MUTED, marginBottom: 16 },
  label: { fontSize: 11, letterSpacing: 1.2, color: MUTED, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: SURFACE2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: TEXT, marginBottom: 14, borderWidth: 1, borderColor: BORDER },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E8EFF6', borderRadius: 12, padding: 13, marginBottom: 14 },
  locationBtnText: { fontSize: 14, color: ACCENT, fontWeight: '500' },
  coordRow: { flexDirection: 'row' },
  radiusRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  radiusChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: BORDER2, alignItems: 'center', backgroundColor: SURFACE },
  radiusChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  radiusChipText: { fontSize: 13, color: MUTED, fontWeight: '500' },
  radiusChipTextActive: { color: '#fff' },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(139,26,26,0.2)' },
  errorText: { color: DANGER, fontSize: 13 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER2, alignItems: 'center' },
  cancelText: { fontSize: 14, color: MUTED },
  saveBtn: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: ACCENT, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  studentAvatar: { width: 38, height: 38, borderRadius: 10, backgroundColor: SURFACE2, alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { fontSize: 12, fontWeight: '600', color: MUTED },
  studentName: { fontSize: 14, fontWeight: '500', color: TEXT },
  studentId: { fontSize: 12, color: MUTED, marginTop: 1 },
})

/**
 * ClassroomsScreen
 * The main classroom management screen. Fetches the instructor's classes
 * with enrollment counts and provides actions to add, delete, manage
 * students, toggle enrollment, and start sessions.
 */
export default function ClassroomsScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [addModal, setAddModal] = useState(false)
  const [enrollModal, setEnrollModal] = useState(false)
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null)
  const [startingSession, setStartingSession] = useState<string | null>(null)
  const [fabTooltipVisible, setFabTooltipVisible] = useState(false)
  const fabTooltipOpacity = useRef(new Animated.Value(0)).current

  // Show FAB tooltip on first use
  useEffect(() => {
    SecureStore.getItemAsync(FAB_TOOLTIP_KEY).then(shown => {
      if (!shown) {
        setTimeout(() => {
          setFabTooltipVisible(true)
          Animated.sequence([
            Animated.timing(fabTooltipOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(3000),
            Animated.timing(fabTooltipOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]).start(() => {
            setFabTooltipVisible(false)
            SecureStore.setItemAsync(FAB_TOOLTIP_KEY, 'true').catch(() => {})
          })
        }, 800)
      }
    }).catch(() => {})
  }, [])

  /**
   * Fetches all classes for this instructor with enrollment counts.
   * Queries: classes WHERE instructor_id OR lecturer_id = user.id,
   * then profiles to count enrolled students per class.
   */
  const fetchClassrooms = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from('classes')
        .select('id, name, building, class_id, latitude, longitude, radius_meters, enrollment_open')
        .or(`instructor_id.eq.${user.id},lecturer_id.eq.${user.id}`)
        .order('class_id', { ascending: true })

      if (!data) { setClassrooms([]); return }

      // Get enrollment counts
      const ids = data.map((c: any) => c.id)
      const { data: enrollments } = await supabase
        .from('profiles')
        .select('class_id')
        .in('class_id', ids)

      const countMap: Record<string, number> = {}
      ;(enrollments ?? []).forEach((e: any) => {
        countMap[e.class_id] = (countMap[e.class_id] ?? 0) + 1
      })

      setClassrooms(data.map((c: any) => ({ ...c, enrolled: countMap[c.id] ?? 0, enrollment_open: c.enrollment_open ?? false })))
    } catch (err) {
      console.error('fetchClassrooms:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  // Watches: fetchClassrooms
  // Effect: loads classrooms on mount and when the user changes
  useEffect(() => { fetchClassrooms() }, [fetchClassrooms])

  /**
   * Toggles the enrollment_open flag for a classroom.
   * Updates the classes table and refreshes the list.
   * @param classroom - the classroom to toggle
   */
  async function toggleEnrollment(classroom: Classroom) {
    const newState = !classroom.enrollment_open
    try {
      const { error } = await supabase
        .from('classes')
        .update({ enrollment_open: newState })
        .eq('id', classroom.id)

      if (error) {
        console.error('[toggleEnrollment] error:', error)
        Alert.alert('Error', `Could not ${newState ? 'open' : 'close'} enrollment: ${error.message}`)
        return
      }

      fetchClassrooms()
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update enrollment status.')
    }
  }

  /**
   * Checks for an existing open session and navigates to it, or creates
   * a new session row in the sessions table and navigates to the live view.
   * Also triggers a local push notification to enrolled students.
   * @param classroom - the classroom to start a session for
   */
  async function startSession(classroom: Classroom) {
    if (!user) return
    setStartingSession(classroom.id)
    try {
      // Check for existing open session first
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('class_id', classroom.id)
        .eq('status', 'open')
        .maybeSingle()

      if (existing?.id) {
        setStartingSession(null)
        // Warn the instructor there's already an active session
        Alert.alert(
          'Active Session Exists',
          `There is already an open session for "${classroom.name}". Would you like to resume it or start a new one?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Resume Existing',
              onPress: () => router.push(`/(instructor)/session/${existing.id}`),
            },
            {
              text: 'Start New',
              style: 'destructive',
              onPress: () => createNewSession(classroom),
            },
          ]
        )
        return
      }

      await createNewSession(classroom)
    } catch (err: any) {
      console.error('[startSession]', err)
      Alert.alert('Error', err?.message ?? 'Could not start session.')
      setStartingSession(null)
    }
  }

  async function createNewSession(classroom: Classroom) {
    if (!user) return
    setStartingSession(classroom.id)
    try {
      const { data: session, error } = await supabase
        .from('sessions')
        .insert({
          class_id: classroom.id,
          instructor_id: user.id,
          lecturer_id: user.id,
          room_lat: classroom.latitude ?? 0,
          room_lng: classroom.longitude ?? 0,
          radius_metres: classroom.radius_meters ?? 50,
          status: 'open',
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error
      if (!session?.id) throw new Error('Session created but no ID returned.')

      // ── Notify enrolled students that session is live ─────────────
      NotificationService.notifySessionStarted(
        classroom.name,
        classroom.class_id ?? classroom.name
      ).catch(() => {})

      router.push(`/(instructor)/session/${session.id}`)
    } catch (err: any) {
      console.error('[createNewSession]', err)
      Alert.alert('Error', err?.message ?? 'Could not start session.')
    } finally {
      setStartingSession(null)
    }
  }

  /**
   * Shows a confirmation alert and deletes the classroom along with all
   * associated sessions and attendance records.
   * @param classroom - the classroom to delete
   */
  async function handleDelete(classroom: Classroom) {
    Alert.alert(
      'Delete Unit',
      `Delete "${classroom.name}"? This will also remove all sessions and attendance records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('classes').delete().eq('id', classroom.id)
            if (error) {
              Alert.alert('Error', `Could not delete unit: ${error.message}`)
              return
            }
            fetchClassrooms()
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchClassrooms() }} tintColor={ACCENT} />}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.greeting}>Units</Text>
          <Text style={styles.name}>Manage Classrooms</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{classrooms.length}</Text>
            <Text style={styles.statLbl}>UNITS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{classrooms.reduce((a, c) => a + c.enrolled, 0)}</Text>
            <Text style={styles.statLbl}>ENROLLMENTS</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>YOUR UNITS</Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={ACCENT} size="large" />
            <Text style={styles.loadingText}>Loading your units…</Text>
          </View>
        ) : classrooms.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <ClassroomEmptyIcon />
            </View>
            <Text style={styles.emptyText}>No units yet</Text>
            <Text style={styles.emptySubText}>Tap the + button below to create your first unit and start tracking attendance.</Text>
          </View>
        ) : (
          classrooms.map(c => (
            <View key={c.id} style={styles.classroomCard}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseCode}>{c.class_id ?? 'NO CODE'}</Text>
                  <Text style={styles.unitName}>{c.name ?? 'Unnamed Unit'}</Text>
                  {c.building ? <Text style={styles.building}>{c.building}</Text> : null}
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(c)} accessibilityRole="button" accessibilityLabel={`Delete ${c.name}`}>
                  <TrashIcon />
                </TouchableOpacity>
              </View>

              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <LocationIcon />
                  <Text style={styles.metaText}>{c.radius_meters}m radius</Text>
                </View>
                <View style={styles.metaItem}>
                  <UsersIcon />
                  <Text style={styles.metaText}>{c.enrolled} enrolled</Text>
                </View>
              </View>

              {/* Enrollment open/close toggle */}
              <TouchableOpacity
                style={[styles.enrollToggleBtn, c.enrollment_open ? styles.enrollToggleOpen : styles.enrollToggleClosed]}
                onPress={() => toggleEnrollment(c)}
                accessibilityRole="button"
                accessibilityLabel={c.enrollment_open ? `Close enrollment for ${c.name}` : `Open enrollment for ${c.name}`}
                accessibilityState={{ checked: c.enrollment_open }}
              >
                <View style={styles.enrollToggleInner}>
                  <View style={[styles.enrollToggleDot, c.enrollment_open ? styles.enrollToggleDotOpen : styles.enrollToggleDotClosed]} />
                  <Text style={[styles.enrollToggleText, c.enrollment_open ? styles.enrollToggleTextOpen : styles.enrollToggleTextClosed]}>
                    {c.enrollment_open ? 'Enrollment OPEN' : 'Enrollment CLOSED'}
                  </Text>
                </View>
                <Text style={[styles.enrollToggleAction, c.enrollment_open ? styles.enrollToggleTextOpen : styles.enrollToggleTextClosed]}>
                  {c.enrollment_open ? 'Tap to close ›' : 'Tap to open ›'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.enrollBtn}
                onPress={() => { setSelectedClassroom(c); setEnrollModal(true) }}
                accessibilityRole="button"
                accessibilityLabel={`Manage students for ${c.name}`}
              >
                <Text style={styles.enrollBtnText}>Manage Students</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.startSessionBtn, startingSession === c.id && { opacity: 0.6 }]}
                onPress={() => startSession(c)}
                disabled={startingSession === c.id}
                accessibilityRole="button"
                accessibilityLabel={startingSession === c.id ? `Starting session for ${c.name}` : `Start attendance session for ${c.name}`}
                accessibilityState={{ disabled: startingSession === c.id, busy: startingSession === c.id }}
              >
                {startingSession === c.id
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.startSessionBtnText}>Start Session</Text>
                }
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <View style={styles.fabWrap}>
        {fabTooltipVisible && (
          <Animated.View style={[styles.fabTooltip, { opacity: fabTooltipOpacity }]}>
            <Text style={styles.fabTooltipText}>Add a new unit / classroom</Text>
            <View style={styles.fabTooltipArrow} />
          </Animated.View>
        )}
        <TouchableOpacity style={styles.fab} onPress={() => setAddModal(true)} accessibilityRole="button" accessibilityLabel="Add unit">
          <PlusIcon />
        </TouchableOpacity>
      </View>

      <AddClassroomModal visible={addModal} onClose={() => setAddModal(false)} onSaved={fetchClassrooms} />
      <EnrollModal visible={enrollModal} classroom={selectedClassroom} onClose={() => { setEnrollModal(false); fetchClassrooms() }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  greeting: { fontSize: 13, color: MUTED, marginBottom: 2 },
  name: { fontSize: 26, fontWeight: '600', color: TEXT },
  statsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, padding: 16, marginHorizontal: 24, marginBottom: 24 },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: BORDER },
  statVal: { fontSize: 26, fontWeight: '700', color: TEXT },
  statLbl: { fontSize: 9, color: MUTED, letterSpacing: 0.5, marginTop: 3 },
  sectionTitle: { fontSize: 11, color: MUTED, letterSpacing: 1.5, paddingHorizontal: 24, marginBottom: 14 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 13, color: MUTED },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyIconWrap: { marginBottom: 16, opacity: 0.5 },
  emptyText: { fontSize: 17, fontWeight: '600', color: TEXT, marginBottom: 8 },
  emptySubText: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },
  classroomCard: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, padding: 18, marginHorizontal: 24, marginBottom: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  courseCode: { fontSize: 11, color: MUTED, letterSpacing: 1, marginBottom: 3 },
  unitName: { fontSize: 16, fontWeight: '600', color: TEXT, marginBottom: 2 },
  building: { fontSize: 12, color: MUTED },
  // Delete button — min 44×44pt touch target
  deleteBtn: { minWidth: 44, minHeight: 44, padding: 10, marginLeft: 8, backgroundColor: '#FEF2F2', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(139,26,26,0.2)', alignItems: 'center', justifyContent: 'center' },
  cardMeta: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: MUTED },
  // Enrollment toggle — full-width prominent style
  enrollToggleBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1.5, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  enrollToggleOpen: { backgroundColor: '#E8F5EE', borderColor: '#1A6641' },
  enrollToggleClosed: { backgroundColor: '#F5E8E8', borderColor: '#8B1A1A' },
  enrollToggleInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enrollToggleDot: { width: 10, height: 10, borderRadius: 5 },
  enrollToggleDotOpen: { backgroundColor: '#1A6641' },
  enrollToggleDotClosed: { backgroundColor: '#8B1A1A' },
  enrollToggleText: { fontSize: 13, fontWeight: '700' },
  enrollToggleTextOpen: { color: '#1A6641' },
  enrollToggleTextClosed: { color: '#8B1A1A' },
  enrollToggleAction: { fontSize: 11, fontWeight: '500' },
  // Manage students button — compact centered
  enrollBtn: { backgroundColor: SURFACE2, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER2, marginBottom: 8, alignSelf: 'center' },
  enrollBtnText: { fontSize: 13, fontWeight: '500', color: ACCENT },
  // Start session button — full width
  startSessionBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  startSessionBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  // FAB with tooltip
  fabWrap: { position: 'absolute', bottom: 88, right: 24, alignItems: 'flex-end' },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  fabTooltip: { backgroundColor: TEXT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, maxWidth: 200 },
  fabTooltipText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  fabTooltipArrow: { position: 'absolute', bottom: -6, right: 20, width: 12, height: 12, backgroundColor: TEXT, transform: [{ rotate: '45deg' }] },
})
