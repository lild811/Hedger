/**
 * Odds library for Fast Hedger v2.3
 * Supports American, Decimal, Fractional, Kalshi, and Percent formats
 */

export interface ParsedOdds {
  american: number | null;
  isKalshi: boolean;
}

/**
 * Convert American odds to Decimal odds
 */
export function americanToDecimal(odds: number): number {
  if (odds === 0 || !isFinite(odds)) throw new Error('bad odds');
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

/**
 * Convert Decimal odds to American odds
 */
export function decimalToAmerican(decimal: number): number {
  if (!isFinite(decimal) || decimal <= 1) throw new Error('Invalid decimal odds');
  if (Math.abs(decimal - 2.0) < 0.000001) return 100; // Even money
  if (decimal > 2) {
    return Math.round((decimal - 1) * 100);
  } else {
    return Math.round(-100 / (decimal - 1));
  }
}

/**
 * Calculate implied probability from American odds
 */
export function impliedProbability(american: number): number {
  if (!isFinite(american)) throw new Error('Invalid American odds');
  if (american >= 100) {
    return 100 / (american + 100);
  } else {
    return Math.abs(american) / (Math.abs(american) + 100);
  }
}

/**
 * Calculate profit per dollar from American odds
 */
export function profitPerDollar(american: number): number {
  if (!isFinite(american)) throw new Error('Invalid American odds');
  return american > 0 ? american / 100 : 100 / Math.abs(american);
}

/**
 * Parse odds from various formats into canonical American format
 * Detection order: %, c/k, /, ., +/-, integer
 * 
 * @param raw - Raw odds string input
 * @param signToggleValue - Sign to use for integers >= 101 ('+' or '-')
 * @returns Canonical American odds (null if invalid)
 */
export function parseOdds(raw: any, signToggleValue: string = "+"): number | null {
  if (raw == null) return null;
  let t = String(raw).trim().toLowerCase();
  
  // Handle Unicode minus, en/em dashes -> ASCII minus
  t = t.replace(/[\u2212\u2013\u2014]/g, '-');
  t = t.replace(/\s+/g, "");
  
  if (!t || t === '' || t === '-') return null;
  
  // Check for mixed tokens FIRST before any parsing
  // Reject any combination of different format markers
  const hasPercent = t.includes('%');
  const hasCents = /[ck]$/.test(t);
  const hasFraction = t.includes('/');
  const formatCount = [hasPercent, hasCents, hasFraction].filter(Boolean).length;
  if (formatCount > 1) return null; // Mixed formats
  
  // Also reject specific problematic patterns
  if (/\d+\.\d+[ck]/.test(t)) return null; // e.g., 1.43c
  if (/\d+%[ck]/.test(t)) return null; // e.g., 70%c
  
  // 1. Ends with % → percent (0–100)
  if (t.endsWith('%')) {
    const percent = parseFloat(t.slice(0, -1));
    if (!isFinite(percent) || percent <= 0 || percent >= 100) return null;
    
    // Special case: 50% = even money = +100
    if (percent === 50) return 100;
    
    const p = percent / 100;
    // Convert to American using round (not floor)
    if (p > 0.5) {
      return Math.round(-(p / (1 - p)) * 100);
    } else {
      return Math.round(((1 - p) / p) * 100);
    }
  }
  
  // 2. Ends with c or k → Kalshi cents (1–99 only)
  if (t.endsWith('c') || t.endsWith('k')) {
    const cents = parseFloat(t.slice(0, -1));
    if (!isFinite(cents) || cents <= 0 || cents >= 100) return null;
    
    // Special case: 50c = even money = +100
    if (cents === 50) return 100;
    
    const p = cents / 100;
    if (p > 0.5) {
      return Math.round(-(p / (1 - p)) * 100);
    } else {
      return Math.round(((1 - p) / p) * 100);
    }
  }
  
  // 3. Contains / → fractional
  if (t.includes('/')) {
    const parts = t.split('/');
    if (parts.length !== 2) return null;
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (!isFinite(num) || !isFinite(den) || num <= 0 || den <= 0) return null;
    const decimal = 1 + (num / den);
    if (decimal === 2) return 100;
    if (decimal > 2) {
      return Math.round((decimal - 1) * 100);
    } else {
      return Math.round(-100 / (decimal - 1));
    }
  }
  
  // 4. Contains . → check if Kalshi price or decimal
  if (t.includes('.')) {
    // Don't allow negative decimals
    if (t.startsWith('-')) return null;
    
    const value = parseFloat(t);
    if (!isFinite(value) || value <= 0) return null;
    
    if (value < 1) {
      // Kalshi price (0.01 to 0.99)
      // Special case: 0.50, .50, .5 = even money = +100
      if (Math.abs(value - 0.5) < 0.000001) return 100;
      
      if (value > 0.5) {
        return Math.round(-(value / (1 - value)) * 100);
      } else {
        return Math.round(((1 - value) / value) * 100);
      }
    } else if (value === 1.00) {
      // Invalid decimal
      return null;
    } else {
      // Decimal odds (≥1.01)
      // Special case: 2.0, 2.00 = even money = +100
      if (Math.abs(value - 2.0) < 0.000001) return 100;
      
      if (value > 2) {
        return Math.round((value - 1) * 100);
      } else {
        return Math.round(-100 / (value - 1));
      }
    }
  }
  
  // 5. Special text cases (before numeric parsing)
  if (t === 'ev' || t === 'even') return 100;
  
  // 6. Explicit +/− → American
  if (t.startsWith('+') || t.startsWith('-')) {
    const american = parseInt(t);
    if (!isFinite(american)) return null;
    
    // Must be ≤ −100 or ≥ +100, with special case for exactly +100
    if (american === 100) return 100;
    if (american > -100 && american < 100) return null; // Reject -99 to +99
    return american;
  }
  
  // 7. Plain integer
  const num = parseInt(t);
  if (!isFinite(num) || num <= 0) return null;
  
  if (num >= 1 && num <= 99) {
    // Kalshi cents - special case: 50 = even money = +100
    if (num === 50) return 100;
    
    const p = num / 100;
    if (p > 0.5) {
      return Math.round(-(p / (1 - p)) * 100);
    } else {
      return Math.round(((1 - p) / p) * 100);
    }
  } else if (num === 100) {
    return 100;
  } else if (num >= 101) {
    // American with sign toggle
    return signToggleValue === "-" ? -num : num;
  }
  
  return null;
}

/**
 * Parse odds with Kalshi format detection
 */
export function parseOddsWithKalshi(raw: any, signToggleValue: string = "+"): ParsedOdds {
  const american = parseOdds(raw, signToggleValue);
  
  // Determine if input is Kalshi format
  let isKalshi = false;
  if (raw && american !== null) {
    const t = String(raw).trim().toLowerCase();
    
    // Check for Kalshi indicators
    if (t.endsWith('c') || t.endsWith('k')) {
      isKalshi = true;
    } else if (t.includes('.')) {
      const val = parseFloat(t);
      if (!isNaN(val) && val < 1) {
        isKalshi = true;
      }
    } else if (/^\d{1,2}$/.test(t) && parseInt(t) >= 1 && parseInt(t) <= 99) {
      isKalshi = true;
    }
  }
  
  return { american, isKalshi };
}

/**
 * Format American odds to various display formats
 */
export function formatFromAmerican(american: number | null, format: 'american' | 'decimal' | 'kalshi' | 'percent'): string {
  if (american == null || !isFinite(american)) return '';
  
  if (format === "american") {
    return american > 0 ? ("+" + american) : String(american);
  }
  
  if (format === "decimal") {
    return americanToDecimal(american).toFixed(2);
  }
  
  if (format === "kalshi") {
    const p = impliedProbability(american);
    return Math.round(p * 100) + "c";
  }
  
  if (format === "percent") {
    const p = impliedProbability(american);
    return (p * 100).toFixed(1) + "%";
  }
  
  return '';
}

/**
 * Validate odds input and return error message if invalid
 */
export function getOddsError(raw: any, signToggleValue: string = "+"): string | null {
  if (!raw || String(raw).trim() === '') return null;
  
  const t = String(raw).trim().toLowerCase();
  
  // Check for mixed tokens
  if (/\d+\.\d+[ck]/.test(t)) return "Invalid format: mixed tokens";
  if (/\d+%[ck]/.test(t)) return "Invalid format: mixed tokens";
  
  // Check for invalid American range
  if (/^[+-]?\d+$/.test(t)) {
    const val = parseInt(t);
    if (val > -100 && val < 100 && val !== 0) {
      return "American odds must be ≤-100 or ≥+100";
    }
  }
  
  // Check for decimal 1.00
  if (t === '1.00' || t === '1.0') {
    return "Decimal 1.00 is invalid";
  }
  
  // Check Kalshi bounds
  if (t.endsWith('c') || t.endsWith('k')) {
    const cents = parseFloat(t.slice(0, -1));
    if (cents === 0) return "0c is invalid";
    if (cents === 100) return "100c is invalid";
  }
  
  // Check for negative decimals
  if (t.startsWith('-') && t.includes('.')) {
    const val = parseFloat(t);
    if (val < 0) return "Negative decimal is invalid";
  }
  
  // Check if parseOdds returns null
  const parsed = parseOdds(raw, signToggleValue);
  if (parsed === null && String(raw).trim() !== '') {
    return "Invalid odds format";
  }
  
  return null;
}
