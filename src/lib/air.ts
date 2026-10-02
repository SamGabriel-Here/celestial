const band = (bands: [number, string][]) => (v: number | null): string =>
  v === null ? 'Unknown' : (bands.find(([max]) => v <= max)?.[1] ?? (bands.at(-1)?.[1] as string));

/** European AQI (EEA): 0–20 good … 100+ extremely poor. */
export const euBand = band([[20, 'Good'], [40, 'Fair'], [60, 'Moderate'], [80, 'Poor'], [100, 'Very poor'], [Infinity, 'Extremely poor']]);

/** US AQI (EPA): 0–50 good … 301+ hazardous. */
export const usBand = band([[50, 'Good'], [100, 'Moderate'], [150, 'Unhealthy for sensitive groups'], [200, 'Unhealthy'], [300, 'Very unhealthy'], [Infinity, 'Hazardous']]);
