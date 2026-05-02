/**
 * Tests for UnitCard component
 *
 * Includes:
 *  - Property test P10: UnitCard status badge is a total function of session state
 *  - Snapshot tests for each of the four status values
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 */

// Feature: student-attendance-flow, Property 10: UnitCard status badge total function

import React from 'react'
import { render } from '@testing-library/react-native'
import * as fc from 'fast-check'
import { UnitCard } from '../UnitCard'
import type { SessionItem } from '../../../hooks/useStudentSessions'

// ── Helpers ───────────────────────────────────────────────────

const VALID_STATUSES = ['pending', 'signed', 'missed', 'upcoming'] as const
type ValidStatus = typeof VALID_STATUSES[number]

/** Expected badge label for each status */
const EXPECTED_LABEL: Record<ValidStatus, string> = {
  pending:  'Sign Now',
  signed:   'Signed ✓',
  missed:   'Missed',
  upcoming: 'Upcoming',
}

/** Build a minimal SessionItem for a given status */
function makeSession(status: ValidStatus, overrides: Partial<SessionItem> = {}): SessionItem {
  return {
    id:           'session-1',
    sessionId:    'session-1',
    code:         'CSC101',
    name:         'Computer Science',
    time:         '09:00 – 10:00',
    room:         '1.2345, 6.7890',
    status,
    latitude:     0,
    longitude:    0,
    radiusMeters: 50,
    ...overrides,
  }
}

// ── Property test — P10 ───────────────────────────────────────

describe('P10: UnitCard status badge is a total function of session state', () => {
  it('renders exactly one badge with the correct label for every valid status', () => {
    // Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_STATUSES),
        (status) => {
          const session = makeSession(status)
          const { getAllByText, queryByText } = render(
            <UnitCard session={session} onPress={() => {}} />,
          )

          const expectedLabel = EXPECTED_LABEL[status]

          // Exactly one badge with the correct label must be present
          const badges = getAllByText(expectedLabel)
          expect(badges).toHaveLength(1)

          // "Mark Attendance" button visible iff status === 'pending'
          const markBtn = queryByText('Mark Attendance')
          if (status === 'pending') {
            expect(markBtn).not.toBeNull()
          } else {
            expect(markBtn).toBeNull()
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Snapshot tests ────────────────────────────────────────────

describe('UnitCard snapshots', () => {
  const noop = () => {}

  it('pending — shows "Sign Now" badge and "Mark Attendance" button', () => {
    const { toJSON, getByText, queryByText } = render(
      <UnitCard session={makeSession('pending')} onPress={noop} />,
    )
    expect(getByText('Sign Now')).toBeTruthy()
    expect(getByText('Mark Attendance')).toBeTruthy()
    expect(toJSON()).toMatchSnapshot()
  })

  it('signed — shows "Signed ✓" badge, no button, green left border', () => {
    const { toJSON, getByText, queryByText } = render(
      <UnitCard session={makeSession('signed')} onPress={noop} />,
    )
    expect(getByText('Signed ✓')).toBeTruthy()
    expect(queryByText('Mark Attendance')).toBeNull()
    expect(toJSON()).toMatchSnapshot()
  })

  it('missed — shows "Missed" badge, no button', () => {
    const { toJSON, getByText, queryByText } = render(
      <UnitCard session={makeSession('missed')} onPress={noop} />,
    )
    expect(getByText('Missed')).toBeTruthy()
    expect(queryByText('Mark Attendance')).toBeNull()
    expect(toJSON()).toMatchSnapshot()
  })

  it('upcoming — shows "Upcoming" badge, no button', () => {
    const { toJSON, getByText, queryByText } = render(
      <UnitCard session={makeSession('upcoming')} onPress={noop} />,
    )
    expect(getByText('Upcoming')).toBeTruthy()
    expect(queryByText('Mark Attendance')).toBeNull()
    expect(toJSON()).toMatchSnapshot()
  })
})
