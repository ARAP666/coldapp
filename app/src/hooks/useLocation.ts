import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  lat: number | null;
  lng: number | null;
  error: string | null;
  granted: boolean;
}

export function useLocation(onUpdate?: (lat: number, lng: number) => void) {
  const [state, setState] = useState<LocationState>({
    lat: null,
    lng: null,
    error: null,
    granted: false,
  });

  // Hold the latest onUpdate callback in a ref so the effect below can stay
  // dependency-free. Otherwise every parent re-render that passes a new
  // callback identity would re-run permission + watcher setup.
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Hold the active watcher subscription so we can clean it up on unmount
  // and avoid leaking location listeners across screen transitions.
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);

  const requestAndWatch = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState((s) => ({ ...s, error: 'Permiso de ubicación denegado', granted: false }));
        return;
      }

      setState((s) => ({ ...s, granted: true }));

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setState((s) => ({ ...s, lat: latitude, lng: longitude }));
      onUpdateRef.current?.(latitude, longitude);

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 20 },
        (loc) => {
          const { latitude: lat2, longitude: lng2 } = loc.coords;
          setState((s) => ({ ...s, lat: lat2, lng: lng2 }));
          onUpdateRef.current?.(lat2, lng2);
        }
      );
      subscriptionRef.current = sub;
    } catch (e) {
      setState((s) => ({ ...s, error: 'Error obteniendo ubicación' }));
    }
  }, []);

  useEffect(() => {
    requestAndWatch();
    return () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [requestAndWatch]);

  return state;
}
