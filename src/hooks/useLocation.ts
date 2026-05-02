// ============================================================
// SmartRoll — useLocation Hook
// Watches the device's GPS position and exposes the latest
// coordinates. Handles both web (navigator.geolocation) and
// native (expo-location) platforms.
// ============================================================

import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { GPS_POLL_INTERVAL_MS, GPS_DISTANCE_INTERVAL_M } from '../constants/attendance';
import { logger } from '../utils/logger';

/** GPS coordinate with accuracy metadata */
interface Coords {
  latitude: number;
  longitude: number;
  /** Accuracy radius in metres; null on web if not provided */
  accuracy: number | null;
}

/**
 * useLocation
 * Subscribes to continuous GPS position updates and returns the latest
 * coordinates. On web it uses the browser's Geolocation API; on native
 * it uses expo-location with high accuracy.
 *
 * @returns {{ coords: Coords | null, error: string | null }}
 *   - `coords` is null until the first position is received
 *   - `error` is set if permission is denied or the API is unavailable
 */
export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Watches: [] (runs once on mount)
  // Effect: starts GPS watching on mount and cleans up on unmount
  useEffect(() => {
    // ── Web platform: use navigator.geolocation ──────────────
    if (Platform.OS === 'web') {
      if (!navigator.geolocation) {
        setError('Geolocation not supported on this browser');
        return;
      }
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setCoords({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  pos.coords.accuracy ?? null,
        }),
        (err) => setError(err.message),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }

    // ── Native platform: use expo-location ───────────────────
    let subscription: Location.LocationSubscription | null = null;
    let mounted = true;

    const start = async () => {
      try {
        // Request foreground location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (mounted) {
            logger.warn('useLocation', 'Location permission denied');
            setError('Location permission denied');
          }
          return;
        }

        // Get an immediate position fix
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (mounted) {
          setCoords({
            latitude:  loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy:  loc.coords.accuracy ?? null,
          });
        }

        // Subscribe to continuous position updates
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: GPS_POLL_INTERVAL_MS,
            distanceInterval: GPS_DISTANCE_INTERVAL_M,
          },
          (l) => {
            if (mounted) {
              setCoords({
                latitude:  l.coords.latitude,
                longitude: l.coords.longitude,
                accuracy:  l.coords.accuracy ?? null,
              });
            }
          }
        );
      } catch (e: any) {
        if (mounted) {
          logger.error('useLocation', 'Failed to start GPS', e);
          setError(e.message ?? 'Failed to get location');
        }
      }
    };

    start();

    return () => {
      mounted = false;
      if (subscription) {
        try { subscription.remove(); } catch { /* ignore cleanup errors */ }
      }
    };
  }, []);

  return { coords, error };
}
