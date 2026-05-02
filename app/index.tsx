// ============================================================
// SmartRoll — Splash Screen
// Animated splash screen shown on app launch. Plays a sequence
// of entrance, pulse, and loading animations, then navigates to
// the login screen after 4 seconds with a fade-out transition.
// ============================================================

import React, { useEffect, useRef } from 'react';
import {
  View, Text, Animated, StyleSheet, Easing, Dimensions, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Polygon, Path, Line, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// Colour palette for the splash screen
const BG       = '#0A0E2E';   // deep navy background
const NAVY     = '#1A237E';
const BLUE     = '#3F51B5';
const BLUE_LT  = '#7986CB';
const ACCENT   = '#536DFE';
const WHITE    = '#FFFFFF';
const GLOW     = 'rgba(83,109,254,0.35)';

/**
 * Particle
 * A single floating dot that fades in, drifts upward, then resets.
 * @param x - horizontal position in pixels
 * @param y - vertical position in pixels
 * @param delay - animation start delay in milliseconds
 * @param size - dot diameter in pixels
 */
function Particle({ x, y, delay, size }: { x: number; y: number; delay: number; size: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Watches: [] (runs once on mount)
  // Effect: starts an infinite float-and-fade loop for this particle
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -18, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -32, duration: 800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ACCENT,
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

/** Static particle positions distributed across the screen */
const PARTICLES = [
  { x: width * 0.12, y: height * 0.22, delay: 0,    size: 3 },
  { x: width * 0.82, y: height * 0.18, delay: 400,  size: 2 },
  { x: width * 0.25, y: height * 0.72, delay: 800,  size: 4 },
  { x: width * 0.75, y: height * 0.68, delay: 200,  size: 2 },
  { x: width * 0.05, y: height * 0.45, delay: 600,  size: 3 },
  { x: width * 0.90, y: height * 0.42, delay: 1000, size: 2 },
  { x: width * 0.45, y: height * 0.12, delay: 300,  size: 3 },
  { x: width * 0.60, y: height * 0.82, delay: 700,  size: 2 },
  { x: width * 0.35, y: height * 0.88, delay: 500,  size: 4 },
  { x: width * 0.68, y: height * 0.08, delay: 900,  size: 2 },
];

/**
 * SmartRollSplash
 * The animated splash screen component. Orchestrates all entrance and
 * loop animations, then navigates to /(auth)/login after 4 seconds.
 */
export default function SmartRollSplash() {
  // ── Cap entrance animation values ────────────────────────────
  const capY       = useRef(new Animated.Value(-60)).current;
  const capOpacity = useRef(new Animated.Value(0)).current;
  const capScale   = useRef(new Animated.Value(0.6)).current;

  // ── Glow pulse animation values ───────────────────────────────
  const glowScale   = useRef(new Animated.Value(0.8)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  // ── Outer ring pulse animation values ─────────────────────────
  const ring1Scale   = useRef(new Animated.Value(0.9)).current;
  const ring1Opacity = useRef(new Animated.Value(0.5)).current;
  const ring2Scale   = useRef(new Animated.Value(0.9)).current;
  const ring2Opacity = useRef(new Animated.Value(0.3)).current;
  const ring3Scale   = useRef(new Animated.Value(0.9)).current;
  const ring3Opacity = useRef(new Animated.Value(0.2)).current;

  // ── Dual spinner animation values ─────────────────────────────
  const spin1 = useRef(new Animated.Value(0)).current;
  const spin2 = useRef(new Animated.Value(0)).current;

  // ── Float animation value ─────────────────────────────────────
  const floatY = useRef(new Animated.Value(0)).current;

  // ── Brand text animation values ───────────────────────────────
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandScale   = useRef(new Animated.Value(0.85)).current;
  const tagOpacity   = useRef(new Animated.Value(0)).current;

  // ── Progress bar animation values ─────────────────────────────
  const barOpacity = useRef(new Animated.Value(0)).current;
  const barWidth   = useRef(new Animated.Value(0)).current;
  const shimmerX   = useRef(new Animated.Value(-60)).current;

  // ── Loading text animation value ──────────────────────────────
  const loadOpacity = useRef(new Animated.Value(0)).current;

  // ── Bouncing dots animation values ────────────────────────────
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  // ── Exit fade animation value ─────────────────────────────────
  const exitOpacity = useRef(new Animated.Value(1)).current;

  // Watches: []
  // Effect: starts all animations and schedules navigation to login after 4 s
  useEffect(() => {
    startAnimations();
    const timer = setTimeout(() => {
      // Fade out the splash before navigating
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        router.replace('/(auth)/login');
      });
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Starts all splash screen animations in the correct sequence.
   * Each animation group is independent and runs in parallel.
   */
  const startAnimations = () => {
    // Cap dramatic drop-in
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(capY,     { toValue: 0, friction: 5, tension: 90, useNativeDriver: true }),
        Animated.spring(capScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
        Animated.timing(capOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
    ]).start();

    // Glow halo appear
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(glowScale,   { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    // Glow breathe loop
    Animated.loop(
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(glowScale, { toValue: 1.15, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1.0,  duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Pulse rings — three staggered expanding rings
    Animated.loop(
      Animated.parallel([
        Animated.timing(ring1Scale,   { toValue: 2.4, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(ring1Opacity, { toValue: 0,   duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(ring2Scale,   { toValue: 2.0, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ring2Opacity, { toValue: 0,   duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring2Scale,   { toValue: 0.9, duration: 0, useNativeDriver: true }),
          Animated.timing(ring2Opacity, { toValue: 0.3, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(1100),
        Animated.parallel([
          Animated.timing(ring3Scale,   { toValue: 1.7, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ring3Opacity, { toValue: 0,   duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring3Scale,   { toValue: 0.9, duration: 0, useNativeDriver: true }),
          Animated.timing(ring3Opacity, { toValue: 0.2, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Dual counter-rotating spinners
    Animated.loop(
      Animated.timing(spin1, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(spin2, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Gentle float loop for the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -7, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0,  duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Brand name pop-in
    Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        Animated.spring(brandScale,   { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
        Animated.timing(brandOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();

    // Tagline fade-in
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(tagOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();

    // Progress bar fill
    Animated.sequence([
      Animated.delay(700),
      Animated.timing(barOpacity, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(barWidth, {
        toValue: width * 0.55,
        duration: 3000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
    ]).start();

    // Shimmer sweep loop on the progress bar
    Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(shimmerX, {
          toValue: width * 0.55 + 60,
          duration: 1200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerX, { toValue: -60, duration: 0, useNativeDriver: true }),
      ])
    ).start();

    // Loading text fade-in
    Animated.sequence([
      Animated.delay(800),
      Animated.timing(loadOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Bouncing dots — staggered by 180 ms each
    const bounceDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
          Animated.delay(350),
        ])
      );
    bounceDot(dot1, 0).start();
    bounceDot(dot2, 180).start();
    bounceDot(dot3, 360).start();
  };

  const rot1 = spin1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rot2 = spin2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  /**
   * Returns animated style props for a bouncing dot.
   * @param dot - the Animated.Value driving this dot
   */
  const dotAnim = (dot: Animated.Value) => ({
    opacity:   dot.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
    transform: [
      { translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
      { scale:      dot.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] }) },
    ],
  });

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Background glow blob */}
      <View style={styles.bgGlow} />

      {/* Floating ambient particles */}
      {PARTICLES.map((p, i) => (
        <Particle key={i} {...p} />
      ))}

      {/* ── Icon area ── */}
      <View style={styles.iconArea}>

        {/* Expanding pulse rings */}
        <Animated.View style={[styles.pulseRing, { transform: [{ scale: ring1Scale }], opacity: ring1Opacity }]} />
        <Animated.View style={[styles.pulseRing, styles.pulseRing2, { transform: [{ scale: ring2Scale }], opacity: ring2Opacity }]} />
        <Animated.View style={[styles.pulseRing, styles.pulseRing3, { transform: [{ scale: ring3Scale }], opacity: ring3Opacity }]} />

        {/* Outer slow clockwise spinner */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ rotate: rot1 }] }]}>
          <Svg width={140} height={140} viewBox="0 0 140 140">
            <Circle cx="70" cy="70" r="60" stroke="rgba(83,109,254,0.12)" strokeWidth="1.5" fill="none" />
            <Circle cx="70" cy="70" r="60" stroke={ACCENT} strokeWidth="2" fill="none"
              strokeLinecap="round" strokeDasharray="40 340" />
          </Svg>
        </Animated.View>

        {/* Inner fast counter-clockwise spinner */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ rotate: rot2 }] }]}>
          <Svg width={140} height={140} viewBox="0 0 140 140">
            <Circle cx="70" cy="70" r="46" stroke="rgba(83,109,254,0.08)" strokeWidth="1" fill="none" />
            <Circle cx="70" cy="70" r="46" stroke={BLUE_LT} strokeWidth="1.5" fill="none"
              strokeLinecap="round" strokeDasharray="20 270" />
          </Svg>
        </Animated.View>

        {/* Glow halo behind the icon */}
        <Animated.View style={[styles.glowHalo, { transform: [{ scale: glowScale }], opacity: glowOpacity }]} />

        {/* Centre icon circle with graduation cap SVG */}
        <Animated.View style={[styles.iconCircle, { transform: [{ translateY: floatY }] }]}>
          <Animated.View style={{ opacity: capOpacity, transform: [{ translateY: capY }, { scale: capScale }] }}>
            <Svg width={38} height={38} viewBox="0 0 48 48" fill="none">
              <Polygon points="24,6 46,17 24,28 2,17" fill={WHITE} />
              <Path d="M36 22v10c0 4.5-6 8-12 8s-12-3.5-12-8V22"
                stroke={WHITE} strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <Line x1="46" y1="17" x2="46" y2="32" stroke={WHITE} strokeWidth="2.5" strokeLinecap="round" />
              <Circle cx="46" cy="33" r="2.5" fill={WHITE} />
            </Svg>
          </Animated.View>
        </Animated.View>
      </View>

      {/* ── Brand name ── */}
      <Animated.View style={[styles.brandRow, { opacity: brandOpacity, transform: [{ scale: brandScale }] }]}>
        <Text style={styles.brandSmart}>Smart</Text>
        <Text style={styles.brandRoll}>Roll</Text>
      </Animated.View>

      {/* ── Tagline ── */}
      <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
        SMART ATTENDANCE SYSTEM
      </Animated.Text>

      {/* ── Progress bar ── */}
      <Animated.View style={[styles.barTrack, { opacity: barOpacity }]}>
        <Animated.View style={[styles.barFill, { width: barWidth }]}>
          {/* Shimmer overlay sweeping across the bar */}
          <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerX }] }]} />
        </Animated.View>
      </Animated.View>

      {/* ── Loading text + bouncing dots ── */}
      <Animated.View style={[styles.loadRow, { opacity: loadOpacity }]}>
        <Text style={styles.loadText}>Initialising</Text>
        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View key={i} style={[styles.dot, dotAnim(dot)]} />
          ))}
        </View>
      </Animated.View>

      {/* ── Version label ── */}
      <Text style={styles.version}>v1.0.0</Text>
    </Animated.View>
  );
}

const ICON_SIZE = 140;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bgGlow: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: 'rgba(26,35,126,0.35)',
    top: height * 0.15,
    alignSelf: 'center',
  },

  iconArea: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },

  pulseRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  pulseRing2: {
    borderColor: BLUE_LT,
    borderWidth: 1,
  },
  pulseRing3: {
    borderColor: BLUE,
    borderWidth: 1,
  },

  glowHalo: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GLOW,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: NAVY,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  brandSmart: {
    fontSize: 36,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -1,
  },
  brandRoll: {
    fontSize: 36,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -1,
  },

  tagline: {
    fontSize: 11,
    color: BLUE_LT,
    letterSpacing: 3,
    marginBottom: 44,
  },

  barTrack: {
    width: width * 0.55,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 14,
  },
  barFill: {
    height: 3,
    backgroundColor: ACCENT,
    borderRadius: 2,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    width: 60,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 2,
  },

  loadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
  },

  version: {
    position: 'absolute',
    bottom: 40,
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 1,
  },
});
