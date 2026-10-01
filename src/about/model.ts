// The landing page's two small decisions: whose sky to show, and which moment the scroll has reached.

const ALIAS: Record<string, string> = { Calcutta: 'Kolkata', Saigon: 'Ho Chi Minh City', Kiev: 'Kyiv', Rangoon: 'Yangon', Katmandu: 'Kathmandu' };

/** The city a time zone is named after ("America/New_York" → "New York"); none for "UTC" or "Etc/…". */
export function zoneCity(zone: string | undefined): string | undefined {
  if (!zone || !zone.includes('/') || zone.startsWith('Etc/')) return undefined;
  const city = zone.slice(zone.lastIndexOf('/') + 1).replace(/_/g, ' ');
  return ALIAS[city] ?? city;
}

/** The wheel holds still for the first stretch of the act, then turns evenly to its last hour. */
export const HOLD = 0.12;
const END = 0.92;

/** Hours ahead of now (0..span) the wheel shows at act progress p. */
export const hoursAt = (p: number, span = 23): number => Math.min(span, Math.max(0, ((p - HOLD) / (END - HOLD)) * span));
