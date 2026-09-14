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

// Nominatim (OpenStreetMap) — used only for reverse geocoding (pin → address),
// which needs one precise match and works fine there.
const NOMINATIM = 'https://nominatim.openstreetmap.org';

// Photon (Komoot's OSM-based geocoder) — unlike Nominatim's `/search`, it's
// built for autocomplete: typing a partial word like "luck" matches "Lucknow"
// by prefix, the way Google's place search does. `lat`/`lon` bias results
// toward Lucknow, the only city Fixo serves.
const PHOTON = 'https://photon.komoot.io/api';
const LUCKNOW = { lat: 26.8467, lon: 80.9462 };

const photonLabel = (p: Record<string, any>): string => {
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(' ');
  const parts = [p.name, streetLine || undefined, p.district || p.locality, p.city || p.county, p.state, p.postcode];
  return parts.filter((v, i, arr) => v && arr.indexOf(v) === i).join(', ');
};

export const searchPlaces = async (query: string): Promise<{ lat: number; lng: number; label: string }[]> => {
  try {
    const url = `${PHOTON}/?q=${encodeURIComponent(query)}&limit=8&lat=${LUCKNOW.lat}&lon=${LUCKNOW.lon}&lang=en`;
    const res = await fetch(url, { headers: { 'User-Agent': 'FixoServiceApp/1.0' } });
    const data = await res.json();
    return (data?.features || [])
      .map((f: any) => {
        const [lng, lat] = f.geometry?.coordinates || [];
        return { lat, lng, label: photonLabel(f.properties || {}) };
      })
      .filter((r: any) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.label);
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
