// ============================================================
// SmartRoll — Notification Service
// Handles push notification registration and local notification
// scheduling for session-started and attendance-signed events.
// ============================================================

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications are presented when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * NotificationService
 * Static utility class for push token registration and local notification scheduling.
 */
export class NotificationService {
  /**
   * Requests push notification permissions and returns the Expo push token.
   * Returns null on simulators or if permission is denied.
   * @returns Expo push token string, or null if unavailable
   */
  static async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    // Create a default notification channel on Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'SmartRoll',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  }

  /**
   * Persists the user's push token to the profiles table so the server
   * can send targeted push notifications.
   * @param userId - the authenticated user's UUID
   * @param token - the Expo push token string
   */
  static async savePushToken(userId: string, token: string): Promise<void> {
    try {
      // Update push_token column in the profiles table for this user
      await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', userId);
    } catch {
      // Non-critical — ignore failures silently
    }
  }

  /**
   * Schedules an immediate local notification informing the student that
   * a class session has started and is open for attendance.
   * @param className - the full name of the class
   * @param courseCode - the course code (e.g. "CS201")
   */
  static async notifySessionStarted(className: string, courseCode: string): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Class session is live!',
        body: `${courseCode} — ${className} is now open for attendance`,
        sound: true,
      },
      trigger: null, // immediate
    });
  }

  /**
   * Schedules an immediate local notification confirming that the student
   * has successfully signed attendance for a class.
   * @param className - the name of the class that was signed
   */
  static async notifyAttendanceSigned(className: string): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Attendance Confirmed',
        body: `You have successfully signed attendance for ${className}`,
        sound: true,
      },
      trigger: null, // immediate
    });
  }
}
