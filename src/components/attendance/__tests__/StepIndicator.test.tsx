/**
 * Snapshot tests for StepIndicator component
 * Validates: Requirements 4.2, 4.3, 5.1, 6.1
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import { StepIndicator } from '../StepIndicator'

const noop = () => {}

describe('StepIndicator', () => {
  it('renders correctly in gps-active state', () => {
    // Step 1 active (navy dot), Steps 2 & 3 inactive (grey dots)
    const { toJSON } = render(
      <StepIndicator
        gpsOk={false}
        selfieOk={false}
        biometricDone={false}
        currentStep="gps"
        onTakeSelfie={noop}
        onRetakeSelfie={noop}
      />,
    )
    expect(toJSON()).toMatchSnapshot()
  })

  it('renders correctly in selfie-active state', () => {
    // Step 1 done (green dot), Step 2 active (navy dot + Take Selfie button), Step 3 inactive
    const { toJSON } = render(
      <StepIndicator
        gpsOk={true}
        selfieOk={false}
        biometricDone={false}
        currentStep="selfie"
        onTakeSelfie={noop}
        onRetakeSelfie={noop}
      />,
    )
    expect(toJSON()).toMatchSnapshot()
  })

  it('renders correctly in biometric-active state', () => {
    // Steps 1 & 2 done (green dots), Step 3 active (navy dot)
    const { toJSON } = render(
      <StepIndicator
        gpsOk={true}
        selfieOk={true}
        biometricDone={false}
        currentStep="biometric"
        onTakeSelfie={noop}
        onRetakeSelfie={noop}
      />,
    )
    expect(toJSON()).toMatchSnapshot()
  })

  it('renders correctly in done state', () => {
    // All three steps done (green dots), Retake button visible
    const { toJSON } = render(
      <StepIndicator
        gpsOk={true}
        selfieOk={true}
        biometricDone={true}
        currentStep="done"
        onTakeSelfie={noop}
        onRetakeSelfie={noop}
      />,
    )
    expect(toJSON()).toMatchSnapshot()
  })
})
