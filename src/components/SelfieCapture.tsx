import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { SELFIE_JPEG_QUALITY, SELFIE_COUNTDOWN_S } from '../constants/attendance';
import { logger } from '../utils/logger';

const ACCENT = '#1A3A5C';
const BG = '#0d1b2a';
const GREEN = '#1A6641';
const RED = '#8B1A1A';
const WHITE = '#FFFFFF';

interface Props {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onCapture: (base64: string) => void;
  onCancel: () => void;
}

export default function SelfieCapture({
  visible,
  title = 'Take Selfie',
  subtitle = 'Position your face in the frame',
  onCapture,
  onCancel,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>('front');
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible]);

  const startCountdown = () => {
    setCountdown(SELFIE_COUNTDOWN_S);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(interval);
          takePicture();
          return null;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);
  };

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: SELFIE_JPEG_QUALITY,
        skipProcessing: Platform.OS === 'android',
      });
      if (photo?.base64) {
        onCapture(photo.base64);
      }
    } catch (err) {
      logger.error('SelfieCapture', 'takePicture failed', err);
    } finally {
      setCapturing(false);
    }
  };

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.center}>
          <Text style={styles.permText}>Camera permission is required for selfie verification.</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          {/* Overlay */}
          <View style={styles.overlay}>
            {/* Top bar */}
            <View style={styles.topBar}>
              <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
              <View style={styles.topCenter}>
                <Text style={styles.titleText}>{title}</Text>
                <Text style={styles.subtitleText}>{subtitle}</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            {/* Face frame */}
            <View style={styles.faceFrame}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Countdown */}
              {countdown !== null && (
                <View style={styles.countdownCircle}>
                  <Text style={styles.countdownText}>{countdown}</Text>
                </View>
              )}
            </View>

            {/* Bottom controls */}
            <View style={styles.bottomBar}>
              {capturing ? (
                <ActivityIndicator color={WHITE} size="large" />
              ) : (
                <TouchableOpacity
                  style={styles.captureBtn}
                  onPress={startCountdown}
                  disabled={countdown !== null}
                >
                  <View style={styles.captureBtnInner} />
                </TouchableOpacity>
              )}
              <Text style={styles.hintText}>Tap to capture selfie</Text>
            </View>
          </View>
        </CameraView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG, padding: 32 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: WHITE, fontSize: 18, fontWeight: '600' },
  topCenter: { flex: 1, alignItems: 'center' },
  titleText: { color: WHITE, fontSize: 17, fontWeight: '600', marginBottom: 4 },
  subtitleText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center' },
  faceFrame: {
    width: 240,
    height: 300,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: WHITE,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 6 },
  countdownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(26,58,92,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: { color: WHITE, fontSize: 40, fontWeight: '700' },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 52,
    paddingTop: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 12,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: WHITE },
  hintText: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  permText: { color: WHITE, fontSize: 15, textAlign: 'center', marginBottom: 24 },
  permBtn: { backgroundColor: ACCENT, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, marginBottom: 12 },
  permBtnText: { color: WHITE, fontSize: 15, fontWeight: '600' },
  cancelLink: { padding: 12 },
  cancelLinkText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
});
