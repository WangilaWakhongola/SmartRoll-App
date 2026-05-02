import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/services/supabase'

const BG = '#F0F4FF'
const SURFACE = '#FFFFFF'
const NAVY = '#1a237e'
const MUTED = '#7A7268'
const TEXT = '#1A1714'
const GREEN = '#1A6641'
const DANGER = '#8B1A1A'
const AMBER = '#7A4A00'
const BORDER = 'rgba(0,0,0,0.08)'

interface HistoryRecord {
  id: string
  sessionId: string
  markedAt: string
  courseCode: string
  status: 'present' | 'absent'
}

// ── Circular progress ring ────────────────────────────────────
function RateRing({ rate, attended, total }: { rate: number; attended: number; total: number }) {
  const R = 54
  const CIRC = 2 * Math.PI * R
  const offset = CIRC * (1 - rate / 100)
  const color = rate >= 75 ? GREEN : rate >= 50 ? AMBER : DANGER

  return (
    <View style={ringStyles.wrap}>
      <Svg width={130} height={130} viewBox="0 0 130 130" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={65} cy={65} r={R} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={10} />
        <Circle
          cx={65} cy={65} r={R} fill="none"
          stroke="#fff"
          strokeWidth={10}
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={ringStyles.center}>
        <Text style={ringStyles.pct}>{rate}%</Text>
        <Text style={ringStyles.label}>Attended</Text>
      </View>
      <View style={ringStyles.meta}>
        <Text style={ringStyles.metaText}>{attended} attended</Text>
        <Text style={ringStyles.metaText}>out of {total} sessions</Text>
      </View>
    </View>
  )
}

const ringStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 20, position: 'relative' },
  center: { position: 'absolute', top: 20, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pct: { fontSize: 28, fontWeight: '700', color: '#fff' },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  meta: { alignItems: 'center', marginTop: 4 },
  metaText: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
})

export default function HistoryScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [totalSessions, setTotalSessions] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!user) return
    setLoading(true); setError(null)
    try {
      // Get student's attendance logs
      const { data: logs, error: logsError } = await supabase
        .from('attendance')
        .select('id, session_id, signed_at, status')
        .eq('student_id', user.id)
        .order('signed_at', { ascending: false })
      if (logsError) throw logsError

      // Get student's enrolled class to count total sessions
      const { data: profile } = await supabase
        .from('profiles').select('class_id').eq('id', user.id).single()

      let total = 0
      if (profile?.class_id) {
        const { count } = await supabase
          .from('sessions').select('id', { count: 'exact', head: true })
          .eq('class_id', profile.class_id)
        total = count ?? 0
      }
      setTotalSessions(total)

      if (!logs || logs.length === 0) { setRecords([]); return }

      const sessionIds = [...new Set(logs.map((l: any) => l.session_id as string))]
      const { data: sessions } = await supabase
        .from('sessions').select('id, classes(name)').in('id', sessionIds)
      const sessionMap: Record<string, string> = {}
      ;(sessions ?? []).forEach((s: any) => { sessionMap[s.id] = s.classes?.name ?? 'Class' })

      setRecords(logs.map((row: any) => ({
        id: row.id,
        sessionId: row.session_id,
        markedAt: row.signed_at,
        courseCode: sessionMap[row.session_id] ?? 'Unknown Class',
        status: row.status ?? 'present',
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const presentCount = records.filter(r => r.status === 'present').length
  const rate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={NAVY} />

      {/* Navy header with ring */}
      <View style={styles.topSection}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Attendance History</Text>
          <View style={{ width: 32 }} />
        </View>
        <RateRing rate={rate} attended={presentCount} total={totalSessions} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={NAVY} size="large" /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No attendance records yet.</Text>
              <Text style={styles.emptySub}>Records will appear after your first signed session.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPresent = item.status === 'present'
            return (
              <View style={styles.row}>
                <View style={[styles.dot, { backgroundColor: isPresent ? GREEN : DANGER }]} />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{item.courseCode}</Text>
                  <Text style={styles.rowTime}>{formatDate(item.markedAt)}  ·  {formatTime(item.markedAt)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: isPresent ? '#E8F5EE' : '#F5E8E8' }]}>
                  <Text style={[styles.badgeText, { color: isPresent ? GREEN : DANGER }]}>
                    {isPresent ? 'Present' : 'Absent'}
                  </Text>
                </View>
              </View>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  topSection: {
    backgroundColor: NAVY,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: '#fff' },
  pageTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: DANGER, fontSize: 14, textAlign: 'center', padding: 24 },

  list: { padding: 20, paddingTop: 16, paddingBottom: 48 },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontWeight: '500', color: TEXT, marginBottom: 6 },
  emptySub: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '500', color: TEXT },
  rowTime: { fontSize: 11, color: MUTED, marginTop: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
})
