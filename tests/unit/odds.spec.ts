import { describe, it, expect } from 'vitest';
import { americanToDecimal } from '../../src/lib/odds';

describe('americanToDecimal', () => {
  it('handles positive floats', () => {
    expect(americanToDecimal(104.3)).toBeCloseTo(2.043, 6);
  });
  it('handles negative floats', () => {
    expect(americanToDecimal(-118.5)).toBeCloseTo(1 + 100/118.5, 6);
  });
});
