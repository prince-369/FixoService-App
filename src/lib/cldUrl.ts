/**
 * Cloudinary delivery-URL transformation helper (CLIENT COPY).
 *
 * CANONICAL IMPLEMENTATION: FixoServer/src/utils/cloudinaryUrl.ts (+ its vitest suite).
 * Keep this file byte-for-byte equivalent to the canonical version; if you change the
 * transform/safety logic, update the server file and all client copies together.
 *
 * Rewrites a *stored* Cloudinary delivery URL to request an optimized, resized variant
 * at delivery time. It NEVER mutates the original asset — the transformation is applied
 * on the fly by Cloudinary from the URL. The value stored in the database stays as-is.
 *
 * Pure string manipulation, so it works identically in Node, browser and React Native.
 *
 * Safety rules:
 *   - Only rewrites genuine Cloudinary delivery URLs (res.cloudinary.com / *.cloudinary.com
 *     with an `/<resource>/upload/` segment). Everything else is returned unchanged:
 *     empty/nullish values, data: URLs, blob: URLs, local/relative paths, other hosts.
 *   - If the URL already carries a transformation right after `/upload/`, it is returned
 *     unchanged (we never stack a second transformation).
 *   - Signed delivery URLs (`/upload/s--<sig>--/...`) are returned unchanged.
 */

export interface CldTransform {
  width?: number;
  height?: number;
  /** Crop mode, e.g. 'fill' | 'fit' | 'thumb' | 'scale' | 'limit'. */
  crop?: string;
  /** Gravity, e.g. 'auto' | 'face' | 'center'. */
  gravity?: string;
  /** Quality; defaults to 'auto'. Pass null to omit. */
  quality?: string | number | null;
  /** Format; defaults to 'auto'. Pass null to omit. */
  format?: string | null;
  /** Device pixel ratio, e.g. 2 or 'auto'. */
  dpr?: string | number;
}

// Tokens that indicate a path segment is already a Cloudinary transformation.
const TRANSFORM_TOKEN = /(^|,)(w_|h_|c_|f_|q_|g_|e_|ar_|dpr_|b_|l_|u_|r_|o_|co_|fl_|x_|y_|z_|t_)/;

const isCloudinaryDeliveryUrl = (url: string): boolean => {
  // Host must be a cloudinary delivery host and contain an /<resource>/upload/ segment.
  return /^https?:\/\/[^/]*\bres\.cloudinary\.com\//i.test(url)
    ? /\/(image|video|raw)\/upload\//i.test(url)
    : /^https?:\/\/[^/]*\.cloudinary\.com\//i.test(url) && /\/(image|video|raw)\/upload\//i.test(url);
};

const buildTransform = (t: CldTransform): string => {
  const parts: string[] = [];

  // Format & quality first — 'auto' unless explicitly disabled with null.
  if (t.format !== null) parts.push(`f_${t.format ?? 'auto'}`);
  if (t.quality !== null) parts.push(`q_${t.quality ?? 'auto'}`);

  if (t.crop) parts.push(`c_${t.crop}`);
  if (t.gravity) parts.push(`g_${t.gravity}`);
  if (typeof t.width === 'number' && t.width > 0) parts.push(`w_${Math.round(t.width)}`);
  if (typeof t.height === 'number' && t.height > 0) parts.push(`h_${Math.round(t.height)}`);
  if (t.dpr !== undefined) parts.push(`dpr_${t.dpr}`);

  return parts.join(',');
};

/**
 * Return `url` rewritten to include the given delivery transformation. Any URL that is
 * not a transformable Cloudinary delivery URL (or is already transformed) is returned
 * exactly as received.
 */
export const cldUrl = (url: string | null | undefined, transform: CldTransform = {}): string => {
  if (!url || typeof url !== 'string') return url ?? '';

  const trimmed = url.trim();
  if (!trimmed) return url;

  // Never touch data/blob URIs, relative paths or non-cloudinary hosts.
  if (/^(data:|blob:)/i.test(trimmed)) return url;
  if (!/^https?:\/\//i.test(trimmed)) return url;
  if (!isCloudinaryDeliveryUrl(trimmed)) return url;

  const marker = trimmed.match(/\/(image|video|raw)\/upload\//i);
  if (!marker) return url;

  const uploadIdx = trimmed.indexOf(marker[0]);
  const head = trimmed.slice(0, uploadIdx + marker[0].length); // up to and incl. `/upload/`
  const tail = trimmed.slice(uploadIdx + marker[0].length);    // e.g. `v123/folder/id.jpg`

  // Already transformed? The first tail segment (before any version `v123`) carries
  // transformation tokens → leave the URL untouched.
  const firstSegment = tail.split('/')[0] || '';
  if (TRANSFORM_TOKEN.test(firstSegment)) return url;

  // Signed delivery URL (`/upload/s--<sig>--/...`): inserting a transform would invalidate
  // the signature, so return it untouched. (Authenticated/private URLs use `/authenticated/`
  // or `/private/` instead of `/upload/` and are already excluded by isCloudinaryDeliveryUrl.)
  if (/^s--/.test(firstSegment)) return url;

  const transformStr = buildTransform(transform);
  if (!transformStr) return url; // nothing meaningful to add

  return `${head}${transformStr}/${tail}`;
};

// Convenience presets for common render points.
export const cldPreset = {
  /** Square-ish category / service card image. */
  category: (url?: string | null) => cldUrl(url, { width: 400, height: 300, crop: 'fill', gravity: 'auto' }),
  /** Round profile / avatar image. Uses g_auto (safe for non-face profile pictures). */
  avatar: (url?: string | null, size = 200) => cldUrl(url, { width: size, height: size, crop: 'fill', gravity: 'auto' }),
  /** Small list thumbnail. */
  thumb: (url?: string | null, size = 96) => cldUrl(url, { width: size, height: size, crop: 'fill' }),
  /** Wide promotional banner. */
  banner: (url?: string | null, width = 1000) => cldUrl(url, { width, crop: 'limit' }),
};

export default cldUrl;
