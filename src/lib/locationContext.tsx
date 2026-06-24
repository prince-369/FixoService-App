import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { reverseGeocode } from './locationBridge';

export interface CustomerLocation {
  lat: number;
  lng: number;
  address: string;
}

interface Ctx {
  location: CustomerLocation | null;
  setLocation: (l: CustomerLocation) => void;
  ready: boolean;
}

const LocationContext = createContext<Ctx>({ location: null, setLocation: () => {}, ready: false });
const KEY = 'fixo_customer_location';

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLoc] = useState<CustomerLocation | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(KEY);
        if (stored) {
          setLoc(JSON.parse(stored));
          setReady(true);
          return;
        }
        // First launch: try to grab the device location automatically.
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (granted) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          const l: CustomerLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: address || 'Current location' };
          setLoc(l);
          await AsyncStorage.setItem(KEY, JSON.stringify(l));
        }
      } catch {
        // ignore — user can set it manually from the header
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLocation = (l: CustomerLocation) => {
    setLoc(l);
    void AsyncStorage.setItem(KEY, JSON.stringify(l));
  };

  return <LocationContext.Provider value={{ location, setLocation, ready }}>{children}</LocationContext.Provider>;
}

export const useCustomerLocation = () => useContext(LocationContext);
