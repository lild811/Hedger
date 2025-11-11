import { describe, it, expect } from 'vitest';
import {
  americanToDecimal,
  decimalToAmerican,
  impliedProbability,
  profitPerDollar,
  parseOdds,
  parseOddsWithKalshi,
  formatFromAmerican,
  getOddsError
} from '../../src/lib/odds';

describe('americanToDecimal', () => {
  it('handles positive floats', () => {
    expect(americanToDecimal(104.3)).toBeCloseTo(2.043, 6);
  });
  
  it('handles negative floats', () => {
    expect(americanToDecimal(-118.5)).toBeCloseTo(1 + 100/118.5, 6);
  });
  
  it('handles even money', () => {
    expect(americanToDecimal(100)).toBe(2.0);
  });
  
  it('throws on invalid odds', () => {
    expect(() => americanToDecimal(0)).toThrow('bad odds');
    expect(() => americanToDecimal(NaN)).toThrow('bad odds');
  });
});

describe('decimalToAmerican', () => {
  it('converts decimal > 2 to positive American', () => {
    expect(decimalToAmerican(3.0)).toBe(200);
    expect(decimalToAmerican(2.5)).toBe(150);
  });
  
  it('converts decimal < 2 to negative American', () => {
    expect(decimalToAmerican(1.5)).toBe(-200);
    expect(decimalToAmerican(1.8)).toBe(-125);
  });
  
  it('handles even money', () => {
    expect(decimalToAmerican(2.0)).toBe(100);
  });
  
  it('throws on invalid decimal', () => {
    expect(() => decimalToAmerican(1.0)).toThrow('Invalid decimal odds');
    expect(() => decimalToAmerican(0.5)).toThrow('Invalid decimal odds');
  });
});

describe('impliedProbability', () => {
  it('calculates probability for positive odds', () => {
    expect(impliedProbability(100)).toBeCloseTo(0.5, 6);
    expect(impliedProbability(200)).toBeCloseTo(0.333, 3);
  });
  
  it('calculates probability for negative odds', () => {
    expect(impliedProbability(-200)).toBeCloseTo(0.667, 3);
    expect(impliedProbability(-150)).toBeCloseTo(0.6, 6);
  });
});

describe('profitPerDollar', () => {
  it('calculates profit for positive odds', () => {
    expect(profitPerDollar(100)).toBe(1);
    expect(profitPerDollar(200)).toBe(2);
  });
  
  it('calculates profit for negative odds', () => {
    expect(profitPerDollar(-200)).toBe(0.5);
    expect(profitPerDollar(-150)).toBeCloseTo(0.667, 3);
  });
});

describe('parseOdds', () => {
  describe('percent format', () => {
    it('parses valid percentages', () => {
      expect(parseOdds('25%')).toBe(300);
      expect(parseOdds('75%')).toBe(-300);
      expect(parseOdds('50%')).toBe(100); // even money
    });
    
    it('rejects invalid percentages', () => {
      expect(parseOdds('0%')).toBeNull();
      expect(parseOdds('100%')).toBeNull();
      expect(parseOdds('150%')).toBeNull();
    });
  });
  
  describe('Kalshi cents format', () => {
    it('parses valid Kalshi cents', () => {
      expect(parseOdds('25c')).toBe(300);
      expect(parseOdds('75k')).toBe(-300);
      expect(parseOdds('50c')).toBe(100); // even money
    });
    
    it('rejects invalid Kalshi cents', () => {
      expect(parseOdds('0c')).toBeNull();
      expect(parseOdds('100c')).toBeNull();
      expect(parseOdds('1.43c')).toBeNull(); // mixed format
    });
  });
  
  describe('fractional format', () => {
    it('parses valid fractions', () => {
      expect(parseOdds('1/1')).toBe(100); // even money
      expect(parseOdds('5/2')).toBe(250);
      expect(parseOdds('1/2')).toBe(-200);
    });
    
    it('rejects invalid fractions', () => {
      expect(parseOdds('0/1')).toBeNull();
      expect(parseOdds('1/0')).toBeNull();
      expect(parseOdds('1/2/3')).toBeNull();
    });
  });
  
  describe('decimal format', () => {
    it('parses valid decimals >= 1.01', () => {
      expect(parseOdds('2.0')).toBe(100); // even money
      expect(parseOdds('3.0')).toBe(200);
      expect(parseOdds('1.5')).toBe(-200);
    });
    
    it('parses Kalshi price (decimal < 1)', () => {
      expect(parseOdds('0.25')).toBe(300);
      expect(parseOdds('0.5')).toBe(100); // even money
      expect(parseOdds('0.75')).toBe(-300);
    });
    
    it('rejects invalid decimals', () => {
      expect(parseOdds('1.0')).toBeNull();
      expect(parseOdds('-1.5')).toBeNull();
    });
  });
  
  describe('American format', () => {
    it('parses explicit American odds', () => {
      expect(parseOdds('+150')).toBe(150);
      expect(parseOdds('-200')).toBe(-200);
      expect(parseOdds('+100')).toBe(100);
    });
    
    it('rejects invalid American range', () => {
      expect(parseOdds('+50')).toBeNull();
      expect(parseOdds('-99')).toBeNull();
      expect(parseOdds('+99')).toBeNull();
    });
  });
  
  describe('integer format', () => {
    it('parses Kalshi integers 1-99', () => {
      expect(parseOdds('25')).toBe(300);
      expect(parseOdds('50')).toBe(100);
      expect(parseOdds('75')).toBe(-300);
    });
    
    it('parses 100 as even money', () => {
      expect(parseOdds('100')).toBe(100);
    });
    
    it('uses sign toggle for integers >= 101', () => {
      expect(parseOdds('150', '+')).toBe(150);
      expect(parseOdds('150', '-')).toBe(-150);
    });
  });
  
  describe('special cases', () => {
    it('handles "even" and "ev"', () => {
      expect(parseOdds('even')).toBe(100);
      expect(parseOdds('ev')).toBe(100);
    });
    
    it('handles Unicode dashes', () => {
      expect(parseOdds('−150')).toBe(-150); // Unicode minus
      expect(parseOdds('–150')).toBe(-150); // en dash
      expect(parseOdds('—150')).toBe(-150); // em dash
    });
  });
  
  describe('mixed format rejection', () => {
    it('rejects mixed format tokens', () => {
      expect(parseOdds('70%c')).toBeNull();
      expect(parseOdds('1.43c')).toBeNull();
    });
  });
});

describe('parseOddsWithKalshi', () => {
  it('detects Kalshi format correctly', () => {
    expect(parseOddsWithKalshi('25c')).toEqual({ american: 300, isKalshi: true });
    expect(parseOddsWithKalshi('0.25')).toEqual({ american: 300, isKalshi: true });
    expect(parseOddsWithKalshi('25')).toEqual({ american: 300, isKalshi: true });
  });
  
  it('detects non-Kalshi format correctly', () => {
    expect(parseOddsWithKalshi('+150')).toEqual({ american: 150, isKalshi: false });
    expect(parseOddsWithKalshi('2.5')).toEqual({ american: 150, isKalshi: false });
    expect(parseOddsWithKalshi('25%')).toEqual({ american: 300, isKalshi: false });
  });
});

describe('formatFromAmerican', () => {
  it('formats to American', () => {
    expect(formatFromAmerican(150, 'american')).toBe('+150');
    expect(formatFromAmerican(-200, 'american')).toBe('-200');
  });
  
  it('formats to Decimal', () => {
    expect(formatFromAmerican(100, 'decimal')).toBe('2.00');
    expect(formatFromAmerican(200, 'decimal')).toBe('3.00');
  });
  
  it('formats to Kalshi', () => {
    expect(formatFromAmerican(100, 'kalshi')).toBe('50c');
    expect(formatFromAmerican(300, 'kalshi')).toBe('25c');
  });
  
  it('formats to Percent', () => {
    expect(formatFromAmerican(100, 'percent')).toBe('50.0%');
    expect(formatFromAmerican(300, 'percent')).toBe('25.0%');
  });
  
  it('returns empty string for null', () => {
    expect(formatFromAmerican(null, 'american')).toBe('');
  });
});

describe('getOddsError', () => {
  it('returns null for valid odds', () => {
    expect(getOddsError('+150')).toBeNull();
    expect(getOddsError('25c')).toBeNull();
    expect(getOddsError('2.5')).toBeNull();
  });
  
  it('returns error for mixed formats', () => {
    expect(getOddsError('1.43c')).toBe('Invalid format: mixed tokens');
  });
  
  it('returns error for invalid American range', () => {
    expect(getOddsError('+50')).toBe('American odds must be ≤-100 or ≥+100');
  });
  
  it('returns error for decimal 1.00', () => {
    expect(getOddsError('1.00')).toBe('Decimal 1.00 is invalid');
  });
  
  it('returns error for Kalshi bounds', () => {
    expect(getOddsError('0c')).toBe('0c is invalid');
    expect(getOddsError('100c')).toBe('100c is invalid');
  });
  
  it('returns null for empty input', () => {
    expect(getOddsError('')).toBeNull();
    expect(getOddsError(null)).toBeNull();
  });
});
