/**
 * Tests for AttendanceModal component
 * Feature: student-attendance-flow, Property 11: GPS status label
 * Validates: Requirements 2.3, 2.4, 2.5, 4.1, 5.1, 10.1
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import * as fc from 'fast-check'
import { getGpsStatusLabel } from '../AttendanceModal'

// ── Mocks ─────────────────────────────────────────────────────

// Mock useAuth so AttendanceModal can render without a real AuthProvider
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', facePhotoUrl: undefined },
  }),
}))

// Mock useLocation to return controlled state
const mockUseLocation = jest.fn()
jest.mock('../../../hooks/useLocation', () => ({
  useLocation: () => mockUseLocation(),
}))

// Mock useAttendanceFlow to return controlled state
const mockUseAttendanceFlow = jest.fn()
jest.mock('../../../hooks/useAttendanceFlow', () => ({
  useAttendanceFlow: () => mockUseAttendanceFlow(),
}))

// Mock NotificationService
jest.mock('../../../services/notification.service', () => ({
  NotificationService: {
    notifyAttendanceSigned: jest.fn().mockResolvedValue(undefined),
  },
}))

// Mock SelfieCapture to avoid camera dependencies
jest.mock('../../SelfieCapture', () => {
  const React = require('react')
  const { View } = require('react-native')
  return function MockSelfieCapture() {
    return React.createElement(View, { testID: 'selfie-capture' })
  }
})

// Mock GPSRing to avoid Animated dependencies
jest.mock('../GPSRing', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    GPSRing: function MockGPSRing({ inside }: { inside: boolean }) {
      return React.createElement(View, { testID: `gps-ring-${inside ? 'inside' : 'outside'}` })
    },
  }
})

// Mock StepIndicator to simplify snapshot
jest.mock('../StepIndicator', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    StepIndicator: function MockStepIndicator() {
      return React.createElement(View, { testID: 'step-indicator' })
    },
  }
})

// ── Helpers ───────────────────────────────────────────────────

const mockSession = {
  id: 'session-1',
  sessionId: 'session-1',
  code: 'CS101',
  name: 'Computer Science',
  time: '09:00 – 10:00',
  room: '1.2345, 6.7890',
  status: 'pending' as const,
  latitude: 1.2345,
  longitude: 6.789,
  radiusMeters: 50,
}

const defaultFlowState = {
  step: 'gps' as const,
  gpsOk: false,
  selfieOk: false,
  selfieB64: null,
  distanceM: null,
  error: null,
}

const defaultFlowResult = {
  state: defaultFlowState,
  canSubmit: false,
  showCamera: false,
  setShowCamera: jest.fn(),
  openCamera: jest.fn(),
  onSelfieCapture: jest.fn(),
  submit: jest.fn(),
  reset: jest.fn(),
}

// ── Import component after mocks ──────────────────────────────
import { AttendanceModal } from '../AttendanceModal'

// ── Property 11: GPS status label contains rounded distance ───

// Feature: student-attendance-flow, Property 11: GPS status label
describe('getGpsStatusLabel — Property 11: GPS status label contains rounded distance', () => {
  /**
   * Validates: Requirements 2.3, 2.4
   *
   * For any non-negative distance d and radius r:
   * - When coords is null → "Getting location…"
   * - When d <= r (gpsOk=true) → label contains "Inside classroom" and Math.round(d)
   * - When d > r (gpsOk=false) → label contains "Outside geofence" and Math.round(d)
   */
  it('returns "Getting location…" when coords is null', () => {
    const result = getGpsStatusLabel(null, false, null)
    expect(result.text).toBe('Getting location…')
    expect(result.color).toBe('#6B6560')
  })

  it('P11: label contains rounded distance and correct prefix for inside/outside', () => {
    fc.assert(
      fc.property(
        // Non-negative distance in metres (0 to 10000)
        fc.float({ min: 0, max: 10000, noNaN: true }),
        // Non-negative radius in metres (0 to 1000)
        fc.float({ min: 0, max: 1000, noNaN: true }),
        (d, r) => {
          const coords = { latitude: 1.0, longitude: 1.0, accuracy: 10 }
          const gpsOk = d <= r
          const result = getGpsStatusLabel(coords, gpsOk, d)

          const rounded = Math.round(d)

          // The label must always contain the rounded distance
          expect(result.text).toContain(String(rounded))

          if (gpsOk) {
            // Inside classroom
            expect(result.text).toContain('Inside classroom')
            expect(result.color).toBe('#1A6641')
          } else {
            // Outside geofence
            expect(result.text).toContain('Outside geofence')
            expect(result.color).toBe('#8B1A1A')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('uses 0 when distanceM is null but coords is set', () => {
    const coords = { latitude: 1.0, longitude: 1.0, accuracy: 10 }
    const result = getGpsStatusLabel(coords, true, null)
    expect(result.text).toContain('0')
    expect(result.text).toContain('Inside classroom')
  })
})

// ── Snapshot tests ────────────────────────────────────────────

describe('AttendanceModal snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GPS-waiting state: coords=null', () => {
    mockUseLocation.mockReturnValue({ coords: null, error: null })
    mockUseAttendanceFlow.mockReturnValue({
      ...defaultFlowResult,
      state: { ...defaultFlowState, step: 'gps', gpsOk: false, distanceM: null },
    })

    const { toJSON } = render(
      <AttendanceModal
        visible={true}
        session={mockSession}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    expect(toJSON()).toMatchSnapshot()
  })

  it('GPS-ok state: coords set, gpsOk=true', () => {
    mockUseLocation.mockReturnValue({
      coords: { latitude: 1.2345, longitude: 6.789, accuracy: 5 },
      error: null,
    })
    mockUseAttendanceFlow.mockReturnValue({
      ...defaultFlowResult,
      state: {
        ...defaultFlowState,
        step: 'selfie',
        gpsOk: true,
        distanceM: 12.7,
      },
    })

    const { toJSON } = render(
      <AttendanceModal
        visible={true}
        session={mockSession}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    expect(toJSON()).toMatchSnapshot()
  })

  it('Selfie-pending state: gpsOk=true, selfieOk=false, step=selfie', () => {
    mockUseLocation.mockReturnValue({
      coords: { latitude: 1.2345, longitude: 6.789, accuracy: 5 },
      error: null,
    })
    mockUseAttendanceFlow.mockReturnValue({
      ...defaultFlowResult,
      state: {
        ...defaultFlowState,
        step: 'selfie',
        gpsOk: true,
        selfieOk: false,
        distanceM: 8,
      },
    })

    const { toJSON } = render(
      <AttendanceModal
        visible={true}
        session={mockSession}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    expect(toJSON()).toMatchSnapshot()
  })

  it('Done state: step=done', () => {
    mockUseLocation.mockReturnValue({
      coords: { latitude: 1.2345, longitude: 6.789, accuracy: 5 },
      error: null,
    })
    mockUseAttendanceFlow.mockReturnValue({
      ...defaultFlowResult,
      state: {
        ...defaultFlowState,
        step: 'done',
        gpsOk: true,
        selfieOk: true,
        distanceM: 5,
      },
      canSubmit: false,
    })

    const { toJSON } = render(
      <AttendanceModal
        visible={true}
        session={mockSession}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    )
    expect(toJSON()).toMatchSnapshot()
  })
})
