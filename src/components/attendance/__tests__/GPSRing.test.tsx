/**
 * Snapshot tests for GPSRing component
 * Validates: Requirements 2.1, 2.2
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import { GPSRing } from '../GPSRing'

// Suppress Animated loop/timing in tests by mocking the animation methods
// that would otherwise run indefinitely. We mock only the Animated module
// methods that GPSRing uses, leaving the rest of react-native intact.
jest.mock('react-native/Libraries/Animated/Animated', () => {
  const ActualAnimated = jest.requireActual(
    'react-native/Libraries/Animated/Animated',
  )
  return {
    ...ActualAnimated,
    loop: jest.fn(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() })),
    sequence: jest.fn(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() })),
    parallel: jest.fn(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() })),
    delay: jest.fn(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() })),
    timing: jest.fn(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() })),
  }
})

describe('GPSRing', () => {
  it('renders correctly when inside=true (green pulsing state)', () => {
    const { toJSON } = render(<GPSRing inside={true} />)
    expect(toJSON()).toMatchSnapshot()
  })

  it('renders correctly when inside=false (red static state)', () => {
    const { toJSON } = render(<GPSRing inside={false} />)
    expect(toJSON()).toMatchSnapshot()
  })

  it('renders correctly with custom size when inside=true', () => {
    const { toJSON } = render(<GPSRing inside={true} size={120} />)
    expect(toJSON()).toMatchSnapshot()
  })

  it('renders correctly with custom size when inside=false', () => {
    const { toJSON } = render(<GPSRing inside={false} size={60} />)
    expect(toJSON()).toMatchSnapshot()
  })
})
