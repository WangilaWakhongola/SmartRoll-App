// ============================================================
// SmartRoll — Instructor Profile Screen
// Displays the instructor's profile information and settings:
// change password, notification toggle, biometric toggle, and
// GPS radius info. Includes a sign-out button.
// ============================================================

import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  Modal, TextInput, ActivityIndicator, Switch, Alert,
} from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../src/contexts/AuthContext'
import { useRouter } from 'expo-router'
import { supabase } from '../../src/services/supabase'
import { BiometricService } from '../../src/services/biometric.service'
import { validatePassword, PASSWORD_RULES, getStrength, STRENGTH_COLORS, STRENGTH_LABELS } from '../../src/utils/passwordRules'

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

function ShowIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={MUTED2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><Circle cx="12" cy="12" r="3" />
    </Svg>
  )
}
function HideIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={MUTED2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <Path d="M1 1l22 22" />
    </Svg>
  )
}

// ─── Change Password Modal (shared logic) ─────────────────────────────────────
function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function reset() { setCurrent(''); setNext(''); setConfirm(''); setError(null); setDone(false) }

  async function handleChange() {
    setError(null)
    if (!current) { setError('Enter your current password.'); return }
    const { failed } = validatePassword(next)
    if (failed.length > 0) { setError('Password does not meet requirements.'); return }
    if (next !== confirm) { setError('New passwords do not match.'); return }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('Session error. Please sign in again.')
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current })
      if (signInErr) { setError('Current password is incorrect.'); return }
      const { error: updateErr } = await supabase.auth.updateUser({ password: next })
      if (updateErr) throw updateErr
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  const strength = next.length > 0 ? getStrength(next) : null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose() }}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />
          <Text style={mStyles.title}>{done ? 'Password Updated' : 'Change Password'}</Text>

          {done ? (
            <>
              <Text style={mStyles.successText}>Your password has been changed successfully.</Text>
              <TouchableOpacity style={mStyles.primaryBtn} onPress={() => { reset(); onClose() }} accessibilityRole="button">
                <Text style={mStyles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={mStyles.label}>CURRENT PASSWORD</Text>
              <View style={mStyles.inputRow}>
                <TextInput style={mStyles.input} placeholder="Enter current password" placeholderTextColor={MUTED2} value={current} onChangeText={t => { setCurrent(t); setError(null) }} secureTextEntry={!showCurrent} />
                <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={mStyles.eyeBtn}>{showCurrent ? <HideIcon /> : <ShowIcon />}</TouchableOpacity>
              </View>

              <Text style={mStyles.label}>NEW PASSWORD</Text>
              <View style={mStyles.inputRow}>
                <TextInput style={mStyles.input} placeholder="Min. 8 chars, uppercase, number, symbol" placeholderTextColor={MUTED2} value={next} onChangeText={t => { setNext(t); setError(null) }} secureTextEntry={!showNext} />
                <TouchableOpacity onPress={() => setShowNext(v => !v)} style={mStyles.eyeBtn}>{showNext ? <HideIcon /> : <ShowIcon />}</TouchableOpacity>
              </View>

              {strength && next.length > 0 && (
                <View style={mStyles.rulesWrap}>
                  <View style={mStyles.strengthRow}>
                    <View style={mStyles.strengthTrack}>
                      {(['weak','fair','strong','very-strong'] as const).map((level, i) => (
                        <View key={level} style={[mStyles.strengthSeg, { backgroundColor: (['weak','fair','strong','very-strong'].indexOf(strength) >= i) ? STRENGTH_COLORS[strength] : '#E8E4DE' }]} />
                      ))}
                    </View>
                    <Text style={[mStyles.strengthLabel, { color: STRENGTH_COLORS[strength] }]}>{STRENGTH_LABELS[strength]}</Text>
                  </View>
                  {PASSWORD_RULES.map(rule => {
                    const ok = rule.test(next)
                    return (
                      <View key={rule.id} style={mStyles.ruleRow}>
                        <View style={[mStyles.ruleDot, { backgroundColor: ok ? GREEN : '#D0C8C0' }]} />
                        <Text style={[mStyles.ruleText, { color: ok ? GREEN : MUTED }]}>{rule.label}</Text>
                      </View>
                    )
                  })}
                </View>
              )}

              <Text style={mStyles.label}>CONFIRM NEW PASSWORD</Text>
              <View style={mStyles.inputRow}>
                <TextInput style={mStyles.input} placeholder="Re-enter new password" placeholderTextColor={MUTED2} value={confirm} onChangeText={t => { setConfirm(t); setError(null) }} secureTextEntry={!showNext} />
              </View>

              {!!error && <View style={mStyles.errorBox}><Text style={mStyles.errorText}>{error}</Text></View>}

              <View style={mStyles.btnRow}>
                <TouchableOpacity style={mStyles.cancelBtn} onPress={() => { reset(); onClose() }} accessibilityRole="button">
                  <Text style={mStyles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[mStyles.primaryBtn, { flex: 2 }, loading && { opacity: 0.5 }]} onPress={handleChange} disabled={loading} accessibilityRole="button">
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.primaryBtnText}>Update Password</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: SURFACE, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  handle: { width: 40, height: 4, backgroundColor: BORDER2, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: TEXT, marginBottom: 20 },
  label: { fontSize: 11, letterSpacing: 1.2, color: MUTED, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE2, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16, minHeight: 48, borderWidth: 1, borderColor: BORDER },
  input: { flex: 1, fontSize: 14, color: TEXT, paddingVertical: 12 },
  eyeBtn: { padding: 6 },
  rulesWrap: { backgroundColor: SURFACE2, borderRadius: 10, padding: 12, marginBottom: 16, marginTop: -8 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  strengthTrack: { flex: 1, flexDirection: 'row', gap: 3 },
  strengthSeg: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 55, textAlign: 'right' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  ruleDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  ruleText: { fontSize: 12 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(139,26,26,0.2)' },
  errorText: { color: DANGER, fontSize: 13 },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER2, alignItems: 'center' },
  cancelText: { fontSize: 14, color: MUTED },
  primaryBtn: { padding: 14, borderRadius: 12, backgroundColor: ACCENT, alignItems: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  successText: { fontSize: 14, color: MUTED, lineHeight: 22, marginBottom: 24 },
})

/**
 * InstructorProfile
 * Renders the instructor's profile card, information rows, and settings.
 * Checks biometric availability on mount and shows the toggle only if
 * the device supports it.
 */
export default function InstructorProfile() {
  const { user, signOut } = useAuth()
  const insets = useSafeAreaInsets()
  const initials = user?.fullName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'AM'

  const [pwModal, setPwModal] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(true)

  // Watches: []
  // Effect: checks biometric hardware availability on mount
  useEffect(() => {
    BiometricService.isAvailable().then(setBiometricAvailable)
  }, [])

  async function handleBiometricToggle(val: boolean) {
    if (val) {
      const ok = await BiometricService.authenticate('Confirm identity to enable biometric login')
      if (!ok) { Alert.alert('Failed', 'Biometric verification failed. Try again.'); return }
    }
    setBiometricEnabled(val)
    Alert.alert(val ? 'Biometrics Enabled' : 'Biometrics Disabled', val ? 'Fingerprint / Face ID is now active.' : 'Biometric login has been turned off.')
  }

  const infoRows = [
    { label: 'Staff ID',        value: user?.studentId ?? 'STF/2019/042' },
    { label: 'Email',           value: user?.email ?? 'instructor@campus.edu' },
    { label: 'Department',      value: 'Computer Science & Engineering' },
    { label: 'Units Teaching',  value: '4 this semester' },
  ]

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.greeting}>Profile</Text>
          <Text style={styles.name}>Dr. {user?.fullName?.split(' ').slice(-1)[0] ?? 'Instructor'}</Text>
        </View>

        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fullName}>{user?.fullName ?? 'Dr. Instructor'}</Text>
            <Text style={styles.roleText}>Lecturer  SmartRoll</Text>
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>
        </View>

        {/* Info */}
        <Text style={styles.sectionTitle}>INFORMATION</Text>
        <View style={styles.section}>
          {infoRows.map((row, i) => (
            <View key={row.label} style={[styles.row, i < infoRows.length - 1 && styles.rowBorder]}>
              <View style={styles.rowIconWrap}><View style={styles.rowIconDot} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Settings */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>SETTINGS</Text>
        <View style={styles.section}>

          {/* Change Password */}
          <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={() => setPwModal(true)} accessibilityRole="button">
            <View style={styles.rowIconWrap}><View style={styles.rowIconDot} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Security</Text>
              <Text style={styles.rowValue}>Change Password</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>

          {/* Notifications */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowIconWrap}><View style={styles.rowIconDot} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Notifications</Text>
              <Text style={styles.rowValue}>{notifEnabled ? 'Email + Push Enabled' : 'Notifications Disabled'}</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={val => {
                setNotifEnabled(val)
                Alert.alert(val ? 'Notifications On' : 'Notifications Off', val ? 'You will receive session and attendance alerts.' : 'Notifications have been turned off.')
              }}
              trackColor={{ false: '#D0C8C0', true: GREEN }}
              thumbColor="#fff"
            />
          </View>

          {/* Biometrics */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowIconWrap}><View style={styles.rowIconDot} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Biometrics</Text>
              <Text style={styles.rowValue}>
                {!biometricAvailable ? 'Not available on this device' : biometricEnabled ? 'Fingerprint / Face ID Enabled' : 'Biometrics Disabled'}
              </Text>
            </View>
            {biometricAvailable && (
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: '#D0C8C0', true: ACCENT }}
                thumbColor="#fff"
              />
            )}
          </View>

          {/* GPS Radius */}
          <View style={styles.row}>
            <View style={styles.rowIconWrap}><View style={styles.rowIconDot} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>GPS Radius Default</Text>
              <Text style={styles.rowValue}>50 metres per classroom</Text>
            </View>
          </View>

        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} accessibilityRole="button">
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>

      <ChangePasswordModal visible={pwModal} onClose={() => setPwModal(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  greeting: { fontSize: 13, color: MUTED, marginBottom: 2 },
  name: { fontSize: 26, fontWeight: '600', color: TEXT },
  avatarCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, padding: 20, marginHorizontal: 24, marginBottom: 24, gap: 16 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  fullName: { fontSize: 16, fontWeight: '600', color: TEXT, marginBottom: 2 },
  roleText: { fontSize: 13, color: MUTED, marginBottom: 8 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E8F5EE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  activeBadgeText: { fontSize: 11, fontWeight: '600', color: GREEN },
  sectionTitle: { fontSize: 11, color: MUTED, letterSpacing: 1.5, paddingHorizontal: 24, marginBottom: 12 },
  section: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER2, borderRadius: 18, marginHorizontal: 24, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 18, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  rowIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: SURFACE2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowIconDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: MUTED },
  rowLabel: { fontSize: 12, color: MUTED, marginBottom: 2 },
  rowValue: { fontSize: 14, fontWeight: '500', color: TEXT },
  rowArrow: { fontSize: 20, color: MUTED },
  signOutBtn: { marginHorizontal: 24, marginTop: 20, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(139,26,26,0.2)', backgroundColor: 'rgba(139,26,26,0.05)', alignItems: 'center' },
  signOutText: { fontSize: 14, fontWeight: '500', color: DANGER },
})
