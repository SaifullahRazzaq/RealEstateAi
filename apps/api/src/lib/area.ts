/**
 * Area units for Pakistani property.
 *
 * Listings are quoted in marla and kanal, never square feet, so those are what
 * the UI collects. Everything is normalised to square feet on the way in
 * because that is the only form a range query can compare: "5 to 10 marla" and
 * "1 kanal" have to be orderable against each other, and they are not while
 * each carries its own unit.
 *
 * 1 marla = 225 sq ft is the Punjab standard used across DHA and Bahria Town.
 * (Some older records in parts of KP and rural Punjab use 272.25 sq ft — if a
 * deployment needs that, it is one constant, but mixing the two silently is
 * worse than picking one.)
 */
export type AreaUnit = 'marla' | 'kanal' | 'sqft' | 'sqyd';

export const AREA_UNITS: AreaUnit[] = ['marla', 'kanal', 'sqft', 'sqyd'];

const SQFT_PER: Record<AreaUnit, number> = {
  marla: 225,
  kanal: 4500, // 20 marla
  sqft: 1,
  sqyd: 9,
};

export function toSqft(value: number, unit: AreaUnit): number {
  return Math.round((Number(value) || 0) * SQFT_PER[unit]);
}

export function fromSqft(sqft: number, unit: AreaUnit): number {
  return (Number(sqft) || 0) / SQFT_PER[unit];
}

/** Drops trailing decimal zeros: 10.00 -> "10", 7.50 -> "7.5". */
function trim(n: number): string {
  const s = n.toFixed(2);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/**
 * How an agent would say it out loud. Anything that divides into whole kanal
 * is spoken as kanal — "1 kanal", not "20 marla".
 */
export function formatArea(sqft: number): string {
  const value = Number(sqft) || 0;
  if (value <= 0) return '—';

  if (value >= SQFT_PER.kanal && value % SQFT_PER.kanal === 0) {
    return `${trim(value / SQFT_PER.kanal)} kanal`;
  }
  if (value % SQFT_PER.marla === 0) {
    return `${trim(value / SQFT_PER.marla)} marla`;
  }
  return `${trim(value)} sq ft`;
}

/** Rate per marla — how price is actually compared between plots. */
export function pricePerMarla(price: number, sqft: number): number {
  if (!sqft) return 0;
  return Math.round((Number(price) || 0) / (sqft / SQFT_PER.marla));
}
