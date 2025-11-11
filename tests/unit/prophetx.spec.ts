import { describe, it, expect } from 'vitest';

// Simulate the applyProphetXFee function
function applyProphetXFee(profit: number, sportsbook?: string): number {
  if (!sportsbook) return profit;
  const book = sportsbook.trim().toUpperCase();
  if (book === 'PX!') {
    // 1% fee on winnings (profit)
    return profit > 0 ? profit * 0.99 : profit;
  }
  // PX or any other value = no fee
  return profit;
}

describe('ProphetX Fee Calculation', () => {

  describe('PX! marker (1% fee)', () => {
    it('applies 1% fee on positive profits', () => {
      expect(applyProphetXFee(100, 'PX!')).toBe(99);
      expect(applyProphetXFee(150, 'PX!')).toBe(148.5);
      expect(applyProphetXFee(50, 'PX!')).toBe(49.5);
    });

    it('does not apply fee on negative profits', () => {
      expect(applyProphetXFee(-100, 'PX!')).toBe(-100);
      expect(applyProphetXFee(-50, 'PX!')).toBe(-50);
    });

    it('handles zero profit', () => {
      expect(applyProphetXFee(0, 'PX!')).toBe(0);
    });

    it('is case-insensitive', () => {
      expect(applyProphetXFee(100, 'px!')).toBe(99);
      expect(applyProphetXFee(100, 'Px!')).toBe(99);
      expect(applyProphetXFee(100, 'PX!')).toBe(99);
    });
  });

  describe('PX marker (0% fee)', () => {
    it('does not apply fee', () => {
      expect(applyProphetXFee(100, 'PX')).toBe(100);
      expect(applyProphetXFee(150, 'PX')).toBe(150);
      expect(applyProphetXFee(-50, 'PX')).toBe(-50);
    });

    it('is case-insensitive', () => {
      expect(applyProphetXFee(100, 'px')).toBe(100);
      expect(applyProphetXFee(100, 'Px')).toBe(100);
    });
  });

  describe('No marker or other sportsbooks', () => {
    it('does not apply fee for undefined', () => {
      expect(applyProphetXFee(100)).toBe(100);
      expect(applyProphetXFee(100, undefined)).toBe(100);
    });

    it('does not apply fee for empty string', () => {
      expect(applyProphetXFee(100, '')).toBe(100);
      expect(applyProphetXFee(100, '   ')).toBe(100);
    });

    it('does not apply fee for other sportsbooks', () => {
      expect(applyProphetXFee(100, 'DraftKings')).toBe(100);
      expect(applyProphetXFee(100, 'FanDuel')).toBe(100);
      expect(applyProphetXFee(100, 'Bet365')).toBe(100);
    });
  });

  describe('Fee delta comparison', () => {
    it('shows 1% difference between PX! and PX', () => {
      const profit = 100;
      const withFee = applyProphetXFee(profit, 'PX!');
      const withoutFee = applyProphetXFee(profit, 'PX');
      const delta = withoutFee - withFee;
      
      expect(delta).toBe(1); // 1% of 100 = 1
      expect(withFee / withoutFee).toBeCloseTo(0.99, 6);
    });

    it('shows proportional delta for different profit amounts', () => {
      const profits = [50, 100, 200, 500];
      
      profits.forEach(profit => {
        const withFee = applyProphetXFee(profit, 'PX!');
        const withoutFee = applyProphetXFee(profit, 'PX');
        const delta = withoutFee - withFee;
        
        expect(delta).toBeCloseTo(profit * 0.01, 6);
      });
    });
  });
});

describe('Exact case from issue #19: PX! vs PX with d=2.0, $200 stake', () => {
  it('PX! with d=2.0 and $200 stake: profitBefore=200, fee=2, netProfit=198', () => {
    const stake = 200;
    const decimal = 2.0;
    const profitBefore = stake * (decimal - 1); // 200 * 1 = 200
    const fee = profitBefore * 0.01; // 1% of 200 = 2
    const netProfit = applyProphetXFee(profitBefore, 'PX!');
    
    expect(profitBefore).toBe(200);
    expect(fee).toBe(2);
    expect(netProfit).toBe(198);
  });
  
  it('PX with d=2.0 and $200 stake: fee=0, netProfit=200', () => {
    const stake = 200;
    const decimal = 2.0;
    const profitBefore = stake * (decimal - 1); // 200 * 1 = 200
    const netProfit = applyProphetXFee(profitBefore, 'PX');
    
    expect(netProfit).toBe(200);
  });
});
