export function americanToDecimal(odds: number) {
  if (odds === 0 || !isFinite(odds)) throw new Error('bad odds');
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}
