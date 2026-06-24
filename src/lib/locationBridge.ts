// Lightweight bridge to pass a picked location from the map screen back to
// the create-booking screen (Expo Router doesn't return data via back()).
export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

let pending: PickedLocation | null = null;

export const setPickedLocation = (loc: PickedLocation) => { pending = loc; };

export const consumePickedLocation = (): PickedLocation | null => {
  const l = pending;
  pending = null;
  return l;
};

// Nominatim (OpenStreetMap) helpers — same free geocoder the web app uses.
const NOMINATIM = 'https://nominatim.openstreetmap.org';

export const searchPlaces = async (query: string): Promise<{ lat: number; lng: number; label: string }[]> => {
  try {
    const res = await fetch(`${NOMINATIM}/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`, {
      headers: { 'User-Agent': 'FixoServiceApp/1.0' },
    });
    const data = await res.json();
    return (data || []).map((d: any) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), label: d.display_name }));
  } catch {
    return [];
  }
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': 'FixoServiceApp/1.0' },
    });
    const data = await res.json();
    return data?.display_name || '';
  } catch {
    return '';
  }
};
