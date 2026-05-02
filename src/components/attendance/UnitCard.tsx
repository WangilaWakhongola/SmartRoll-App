/**
 * UnitCard component
 * Displays a session card with status badge and optional "Mark Attendance" button.
 * Status badge config is derived from session.status via a lookup map.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SessionItem } from '../../hooks/useStudentSessions'

// ── Colour constants ──────────────────────────────────────────
const SURFACE = '#FFFFFF'
const SURFACE2 = '#E8EDF8'
const NAVY = '#1a237e'
const MUTED = '#6B6560'
const TEXT = '#1A1714'
const GREEN = '#1A6641'
const DANGER = '#8B1A1A'
const BORDER2 = 'rgba(0,0,0,0.08)'

// ── Status badge lookup map ───────────────────────────────────
const STATUS_CONFIG = {
  pending:  { dot: NAVY,   badge: '#E0E8F0', badgeText: NAVY,   label: 'Sign Now',  showBtn: true  },
  signed:   { dot: GREEN,  badge: '#E8F5EE', badgeText: GREEN,  label: 'Signed ✓',  showBtn: false },
  missed:   { dot: DANGER, badge: '#F5E8E8', badgeText: DANGER, label: 'Missed',    showBtn: false },
  upcoming: { dot: MUTED,  badge: SURFACE2,  badgeText: MUTED,  label: 'Upcoming',  showBtn: false },
} as const

// ── Props ─────────────────────────────────────────────────────
export interface UnitCardProps {
  session: SessionItem
  onPress: () => void
}

/**
 * PendingTimer
 * Shows a live "open X min ago" counter for pending sessions.
 * Counts up every second from when the component mounts.
 */
function PendingTimer() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const label = mins > 0
    ? `Session open ${mins}m ${secs}s ago`
    : `Session open ${secs}s ago`

  return <Text style={ucStyles.pendingTimer}>{label}</Text>
}

// ── Component ─────────────────────────────────────────────────
export function UnitCard({ session, onPress }: UnitCardProps) {
  const statusConfig = STATUS_CONFIG[session.status]

  return (
    <View style={[ucStyles.card, session.status === 'signed' && ucStyles.cardSigned, session.status === 'pending' && ucStyles.cardPending]}>
      <View style={ucStyles.top}>
        <View style={ucStyles.iconBox}>
          <Text style={ucStyles.codeText}>{session.code.slice(0, 3)}</Text>
        </View>
        <View style={ucStyles.info}>
          <Text style={ucStyles.code}>{session.code}</Text>
          <Text style={ucStyles.name}>{session.name}</Text>
          <Text style={ucStyles.meta}>{session.time} · {session.room}</Text>
          {session.status === 'pending' && <PendingTimer />}
        </View>
        <View style={[ucStyles.badge, { backgroundColor: statusConfig.badge }]}>
          <Text style={[ucStyles.badgeText, { color: statusConfig.badgeText }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>
      {statusConfig.showBtn && (
        <TouchableOpacity style={ucStyles.markBtn} onPress={onPress}>
          <Text style={ucStyles.markBtnText}>Mark Attendance</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────
const ucStyles = StyleSheet.create({
  card:         { backgroundColor: SURFACE, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER2 },
  cardSigned:   { borderLeftWidth: 3, borderLeftColor: GREEN },
  cardPending:  { borderLeftWidth: 3, borderLeftColor: NAVY },
  top:          { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  iconBox:      { width: 40, height: 40, borderRadius: 12, backgroundColor: SURFACE2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  codeText:     { fontSize: 11, fontWeight: '500', color: MUTED },
  info:         { flex: 1 },
  code:         { fontSize: 10, color: MUTED, letterSpacing: 0.5 },
  name:         { fontSize: 13, fontWeight: '500', color: TEXT, marginTop: 1 },
  meta:         { fontSize: 10, color: MUTED, marginTop: 2 },
  pendingTimer: { fontSize: 10, color: NAVY, fontWeight: '500', marginTop: 3 },
  badge:        { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeText:    { fontSize: 10, fontWeight: '500' },
  markBtn:      { backgroundColor: NAVY, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 12, alignSelf: 'center' },
  markBtnText:  { color: '#fff', fontSize: 13, fontWeight: '700' },
})
