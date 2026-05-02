// Feature: student-attendance-flow
import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { GPS_RING_PULSE_DURATION_MS, GPS_RING_PULSE_STAGGER_MS } from '../../constants/attendance'

const GREEN = '#1A6641'
const DANGER = '#8B1A1A'
const SURFACE = '#FFFFFF'

export interface GPSRingProps {
  inside: boolean
  size?: number // default 90
}

export function GPSRing({ inside, size = 90 }: GPSRingProps) {
  const ring1 = useRef(new Animated.Value(0.8)).current
  const op1 = useRef(new Animated.Value(0.8)).current
  const ring2 = useRef(new Animated.Value(0.8)).current
  const op2 = useRef(new Animated.Value(0.6)).current

  useEffect(() => {
    if (!inside) return

    const pulse = (
      scale: Animated.Value,
      opacity: Animated.Value,
      delay: number,
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 2.2,
              duration: GPS_RING_PULSE_DURATION_MS,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: GPS_RING_PULSE_DURATION_MS,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 0.8,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.7,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ]),
      )

    const a1 = pulse(ring1, op1, 0)
    const a2 = pulse(ring2, op2, GPS_RING_PULSE_STAGGER_MS)
    a1.start()
    a2.start()

    return () => {
      a1.stop()
      a2.stop()
    }
  }, [inside])

  // Proportional sizing based on the size prop (base size is 90)
  const scale = size / 90
  const ringSize = Math.round(76 * scale)
  const ringRadius = Math.round(38 * scale)
  const coreSize = Math.round(58 * scale)
  const coreRadius = Math.round(29 * scale)
  const pinWidth = Math.round(32 * scale)
  const pinHeight = Math.round(40 * scale)
  const pinRadius = Math.round(16 * scale)
  const dotSize = Math.round(10 * scale)
  const dotRadius = Math.round(5 * scale)

  const color = inside ? GREEN : DANGER

  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size },
      ]}
    >
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringRadius,
            transform: [{ scale: ring1 }],
            opacity: op1,
            borderColor: color,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringRadius,
            transform: [{ scale: ring2 }],
            opacity: op2,
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.core,
          {
            width: coreSize,
            height: coreSize,
            borderRadius: coreRadius,
            borderColor: color,
          },
        ]}
      >
        <View
          style={[
            styles.pin,
            {
              width: pinWidth,
              height: pinHeight,
              borderRadius: pinRadius,
              backgroundColor: color,
            },
          ]}
        >
          <View
            style={[
              styles.pinDot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotRadius,
              },
            ]}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  core: {
    borderWidth: 1.5,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  pinDot: {
    backgroundColor: SURFACE,
  },
})

export default GPSRing
