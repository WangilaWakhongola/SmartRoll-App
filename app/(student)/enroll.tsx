import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Circle, Line } from 'react-native-svg'
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
const DANGER = '#8B1A1A'

interface OpenClassroom {
  id: string
  name: string
  class_id: string | null
  building: string | null
  radius_meters: number
  instructor_name: string
  enrolled: boolean
  enrollment_open: boolean
}

function LocationIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="10" r="3" />
      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
    </Svg>
  )
}

function UserIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  )
}

/** Empty state icon for no open units */
function SearchEmptyIcon() {
  return (
    <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Path d="M21 21l-4.35-4.35" />
      <Path d="M8 11h6" />
      <Path d="M11 8v6" />
    </Svg>
  )
}

export default function EnrollScreen() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [classrooms, setClassrooms] = useState<OpenClassroom[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchOpenClassrooms = useCallback(async () => {
    if (!user) return
    try {
      // Get the student's current enrolled class_id from their profile
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('class_id')
        .eq('id', user.id)
        .maybeSingle()

      const enrolledClassId = myProfile?.class_id ?? null

      // Get open classrooms
      const { data: openRooms } = await supabase
        .from('classes')
        .select('id, name, class_id, building, radius_meters, instructor_id, enrollment_open')
        .eq('enrollment_open', true)

      // Also fetch the currently enrolled classroom if it exists (may be closed)
      let enrolledRoom: any = null
      if (enrolledClassId) {
        const { data } = await supabase
          .from('classes')
          .select('id, name, class_id, building, radius_meters, instructor_id, enrollment_open')
          .eq('id', enrolledClassId)
          .maybeSingle()
        enrolledRoom = data
      }

      // Merge — deduplicate by id
      const allRoomsMap: Record<string, any> = {}
      ;(openRooms ?? []).forEach((c: any) => { allRoomsMap[c.id] = c })
      if (enrolledRoom) allRoomsMap[enrolledRoom.id] = enrolledRoom
      const allRooms = Object.values(allRoomsMap)

      if (allRooms.length === 0) { setClassrooms([]); return }

      // Get instructor names
      const instructorIds = [...new Set(allRooms.map((c: any) => c.instructor_id).filter(Boolean))]
      const { data: instructors } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', instructorIds)

      const instructorMap: Record<string, string> = {}
      ;(instructors ?? []).forEach((p: any) => { instructorMap[p.id] = p.full_name })

      setClassrooms(allRooms.map((c: any) => ({
        id: c.id,
        name: c.name,
        class_id: c.class_id,
        building: c.building,
        radius_meters: c.radius_meters,
        instructor_name: instructorMap[c.instructor_id] ?? 'Instructor',
        enrolled: enrolledClassId === c.id,
        enrollment_open: c.enrollment_open,
      })))
    } catch (err: any) {
      console.error('fetchOpenClassrooms:', err)
      // Surface a user-friendly error — will be shown via Alert on next render
      Alert.alert(
        'Could not load units',
        err?.message ?? 'Check your connection and pull down to retry.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => { fetchOpenClassrooms() }, [fetchOpenClassrooms])

  async function handleToggleEnroll(classroom: OpenClassroom) {
    if (!user) return

    if (classroom.enrolled) {
      // Unenroll — set class_id to null on the student's profile
      setToggling(classroom.id)
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ class_id: null })
          .eq('id', user.id)
        if (error) throw error
        await fetchOpenClassrooms()
      } catch (err: any) {
        Alert.alert('Error', err?.message ?? 'Could not unenroll. Try again.')
      } finally {
        setToggling(null)
      }
    } else {
      // Enroll — update the student's profile with the class_id
      setToggling(classroom.id)
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ class_id: classroom.id })
          .eq('id', user.id)
        if (error) throw error
        await fetchOpenClassrooms()
      } catch (err: any) {
        Alert.alert('Error', err?.message ?? 'Could not enroll. Try again.')
      } finally {
        setToggling(null)
      }
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOpenClassrooms() }} tintColor={ACCENT} />}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.greeting}>Browse Units</Text>
          <Text style={styles.name}>Enroll in Classes</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Units below are open for enrollment. Tap <Text style={{ fontWeight: '700', color: ACCENT }}>Enroll</Text> to join. Once enrolled, you will see the unit on your Home tab.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>OPEN UNITS</Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={ACCENT} />
            <Text style={styles.loadingText}>Looking for open units...</Text>
          </View>
        ) : classrooms.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <SearchEmptyIcon />
            </View>
            <Text style={styles.emptyText}>No open units right now</Text>
            <Text style={styles.emptySubText}>Ask your instructor to open enrollment for their unit. Pull down to refresh.</Text>
          </View>
        ) : (
          classrooms.map(c => (
            <View key={c.id} style={[styles.card, c.enrolled && styles.cardEnrolled]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseCode}>{c.class_id ?? '—'}</Text>
                  <Text style={styles.unitName}>{c.name}</Text>
                  {c.enrolled && !c.enrollment_open && (
                    <Text style={styles.enrollmentClosedHint}>Enrollment closed by instructor</Text>
                  )}
                </View>
                {c.enrolled && (
                  <View style={styles.enrolledBadge}>
                    <Text style={styles.enrolledBadgeText}>Enrolled</Text>
                  </View>
                )}
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <UserIcon />
                  <Text style={styles.metaText}>{c.instructor_name}</Text>
                </View>
                {c.building && (
                  <View style={styles.metaItem}>
                    <LocationIcon />
                    <Text style={styles.metaText}>{c.building}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.enrollBtn, c.enrolled && styles.unenrollBtn, toggling === c.id && styles.btnDisabled]}
                onPress={() => handleToggleEnroll(c)}
                disabled={toggling === c.id}
                accessibilityRole="button"
                accessibilityLabel={
                  toggling === c.id
                    ? (c.enrolled ? `Unenrolling from ${c.name}` : `Enrolling in ${c.name}`)
                    : (c.enrolled ? `Unenroll from ${c.name}` : `Enroll in ${c.name}`)
                }
                accessibilityState={{ disabled: toggling === c.id, busy: toggling === c.id }}
              >
                {toggling === c.id ? (
                  <ActivityIndicator color={c.enrolled ? DANGER : '#fff'} size="small" />
                ) : (
                  <Text style={[styles.enrollBtnText, c.enrolled && styles.unenrollBtnText]}>
                    {c.enrolled ? 'Unenroll' : 'Enroll in this Unit'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
  greeting: { fontSize: 13, color: MUTED, marginBottom: 2 },
  name: { fontSize: 26, fontWeight: '600', color: TEXT },
  infoCard: { backgroundColor: '#E8EFF6', borderRadius: 14, marginHorizontal: 24, marginBottom: 24, padding: 14 },
  infoText: { fontSize: 13, color: MUTED, lineHeight: 20 },
  sectionTitle: { fontSize: 11, color: MUTED, letterSpacing: 1.5, paddingHorizontal: 24, marginBottom: 14 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 13, color: MUTED },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyIconWrap: { marginBottom: 16, opacity: 0.55 },
  emptyText: { fontSize: 16, fontWeight: '600', color: TEXT, marginBottom: 8, textAlign: 'center' },
  emptySubText: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, padding: 18, marginHorizontal: 24, marginBottom: 14 },
  cardEnrolled: { borderLeftWidth: 3, borderLeftColor: GREEN },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  courseCode: { fontSize: 11, color: MUTED, letterSpacing: 1, marginBottom: 3 },
  unitName: { fontSize: 16, fontWeight: '600', color: TEXT },
  enrolledBadge: { backgroundColor: '#E8F5EE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  enrolledBadgeText: { fontSize: 11, fontWeight: '600', color: GREEN },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: MUTED },
  // Enroll/unenroll buttons — compact centered like biometric button
  enrollBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  unenrollBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: 'rgba(139,26,26,0.3)' },
  btnDisabled: { opacity: 0.5 },
  enrollBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  unenrollBtnText: { color: DANGER },
  enrollmentClosedHint: { fontSize: 11, color: DANGER, marginTop: 3 },
})
