// ============================================================
// SmartRoll — Biometric Service
// Wraps expo-local-authentication to provide device biometric
// availability checks and authentication prompts.
// Used during the final step of the attendance flow.
// ============================================================

import * as LocalAuthentication from 'expo-local-authentication';

/**
 * BiometricService
 * Static utility class for biometric authentication operations.
 */
export class BiometricService {
  /**
   * Checks whether the device has biometric hardware and enrolled credentials.
   * @returns true if biometrics are available and enrolled
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return compatible && enrolled;
    } catch {
      return false;
    }
  }

  /**
   * Prompts the user to authenticate using biometrics (fingerprint or Face ID).
   * @param reason - the message shown in the system authentication dialog
   * @returns true if authentication succeeded, false otherwise
   */
  static async authenticate(reason = 'Confirm your identity to sign attendance'): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Returns the list of supported biometric types on this device.
   * @returns array of human-readable type names (e.g. 'Fingerprint', 'Face ID')
   */
  static async getSupportedTypes(): Promise<string[]> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return types.map((t) => {
      if (t === LocalAuthentication.AuthenticationType.FINGERPRINT) return 'Fingerprint';
      if (t === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) return 'Face ID';
      return 'Biometric';
    });
  }
}
