import type { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Maps a category name to an outline Ionicon.
 *
 * Kept in step with the web app's `lib/serviceCatalog.ts` so both clients show the same glyph
 * and the same filter buckets for a given category. Categories are admin-managed, so this only
 * affects presentation — no data is invented here.
 */

export const SERVICE_GROUPS = [
  'Home Repair',
  'Home Care',
  'Vehicle Care',
  'Design & Security',
  'Tech Repair',
] as const;

export type ServiceGroup = (typeof SERVICE_GROUPS)[number];

const ICON_RULES: { match: RegExp; icon: IoniconName }[] = [
  { match: /electric|wiring|switch|\bfan\b|\blight/i, icon: 'flash-outline' },
  { match: /plumb|\btap\b|leak|pipe|clog|faucet/i, icon: 'water-outline' },
  { match: /carpent|furnitur|wood|\bdoor/i, icon: 'hammer-outline' },
  { match: /\bac\b|air.?condition|cooling/i, icon: 'snow-outline' },
  { match: /paint/i, icon: 'brush-outline' },
  { match: /clean|sweep|sanitis|sanitiz/i, icon: 'sparkles-outline' },
  { match: /\bro\b|water.?purif|filter/i, icon: 'funnel-outline' },
  { match: /cctv|camera|surveill|security/i, icon: 'videocam-outline' },
  { match: /bike|scooter|two.?wheel|2.?wheel/i, icon: 'bicycle-outline' },
  { match: /three.?wheel|3.?wheel|rickshaw|auto\b/i, icon: 'car-outline' },
  { match: /\bcar\b|four.?wheel|4.?wheel|vehicle/i, icon: 'car-sport-outline' },
  { match: /interior|decor|design/i, icon: 'color-palette-outline' },
  { match: /weld|fabricat|grill|metal/i, icon: 'flame-outline' },
  { match: /computer|laptop|desktop|\bpc\b/i, icon: 'laptop-outline' },
  { match: /mobile|phone|tablet/i, icon: 'phone-portrait-outline' },
  { match: /food|cook|chef|tiffin|kitchen/i, icon: 'restaurant-outline' },
  { match: /plant|garden|lawn|nursery/i, icon: 'leaf-outline' },
  { match: /pest|termite|cockroach/i, icon: 'bug-outline' },
  { match: /wash|laundry|iron/i, icon: 'shirt-outline' },
  { match: /applianc|electronic|install/i, icon: 'build-outline' },
  { match: /house|home|repair/i, icon: 'home-outline' },
];

const GROUP_RULES: { match: RegExp; group: ServiceGroup }[] = [
  { match: /computer|laptop|desktop|\bpc\b|mobile|phone|tablet|electronic/i, group: 'Tech Repair' },
  { match: /cctv|camera|surveill|security|interior|decor|design/i, group: 'Design & Security' },
  { match: /bike|scooter|two.?wheel|2.?wheel|three.?wheel|3.?wheel|rickshaw|\bcar\b|four.?wheel|4.?wheel|vehicle/i, group: 'Vehicle Care' },
  { match: /clean|sweep|sanitis|sanitiz|wash|laundry|iron|\bro\b|water.?purif|pest|plant|garden|lawn|food|cook|chef|tiffin/i, group: 'Home Care' },
  { match: /electric|plumb|carpent|\bac\b|air.?condition|paint|weld|fabricat|applianc|house|home|repair|install|wiring|leak|wood/i, group: 'Home Repair' },
];

export const serviceIconFor = (name?: string | null): IoniconName => {
  const value = (name || '').trim();
  if (!value) return 'construct-outline';
  return ICON_RULES.find((rule) => rule.match.test(value))?.icon ?? 'construct-outline';
};

export const serviceGroupFor = (name?: string | null): ServiceGroup => {
  const value = (name || '').trim();
  if (!value) return 'Home Repair';
  return GROUP_RULES.find((rule) => rule.match.test(value))?.group ?? 'Home Repair';
};

export const serviceBlurbFor = (name?: string | null): string => {
  const value = (name || '').trim();
  return value ? `Verified professionals for ${value.toLowerCase()}` : 'Verified professionals, upfront pricing';
};
