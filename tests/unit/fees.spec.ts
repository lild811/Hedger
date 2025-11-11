import { describe, it, expect } from 'vitest';
import {
  kalshiLedger,
  kalshiEffectiveOdds,
  applyCustomFees,
  applyNoFees,
  applyProphetXFee,
  applyKalshiYesFees,
  applyKalshiNoFees,
  applyCustomFeesUnified,
  DEFAULT_KALSHI_FEES,
  type FeeStructure,
  type FeeResult
} from '../../src/lib/fees';

describe('kalshiLedger', () => {
  it('calculates correct ledger for typical stake', () => {
    // Stake $100 at 50c (even money)
    const result = kalshiLedger(100, 0.50);
    
    expect(result.contracts).toBe(200); // floor(100 / 0.50)
    expect(result.cost).toBe(100); // 200 * 0.50
    expect(result.openFee).toBe(1); // 100 * 0.01
    expect(result.settleFee).toBe(4); // 200 * 0.02
    expect(result.netPayout).toBe(196); // 200 - 4
    expect(result.profit).toBe(95); // 196 - (100 + 1)
  });
  
  it('calculates correct ledger for 25c (3:1 odds)', () => {
    const result = kalshiLedger(100, 0.25);
    
    expect(result.contracts).toBe(400); // floor(100 / 0.25)
    expect(result.cost).toBe(100);
    expect(result.openFee).toBe(1);
    expect(result.settleFee).toBe(8); // 400 * 0.02
    expect(result.netPayout).toBe(392); // 400 - 8
    expect(result.profit).toBe(291); // 392 - 101
  });
  
  it('calculates correct ledger for 75c (1:3 odds)', () => {
    const result = kalshiLedger(100, 0.75);
    
    expect(result.contracts).toBe(133); // floor(100 / 0.75)
    expect(result.cost).toBe(99.75);
    expect(result.openFee).toBe(1); // rounded
    expect(result.settleFee).toBe(2.66);
    expect(result.netPayout).toBe(130.34);
    expect(result.profit).toBe(29.59); // 130.34 - 100.75
  });
  
  it('handles fractional contracts correctly', () => {
    // Stake $50 at 0.33c should give floor(50/0.33) = 151 contracts
    const result = kalshiLedger(50, 0.33);
    
    expect(result.contracts).toBe(151);
    expect(result.cost).toBe(49.83); // 151 * 0.33
  });
  
  it('respects custom fee structure', () => {
    const customFees: FeeStructure = { openFee: 0.02, settleFee: 0.03 };
    const result = kalshiLedger(100, 0.50, customFees.openFee, customFees.settleFee);
    
    expect(result.openFee).toBe(2); // 100 * 0.02
    expect(result.settleFee).toBe(6); // 200 * 0.03
    expect(result.netPayout).toBe(194); // 200 - 6
    expect(result.profit).toBe(92); // 194 - (100 + 2)
  });
});

describe('kalshiEffectiveOdds', () => {
  it('calculates effective odds after fees', () => {
    // 50c (even money, +100 American) should have worse effective odds due to fees
    // With 1% open + 2% settle fees, profit is reduced
    const effective = kalshiEffectiveOdds(0.50);
    // The effective odds will be negative because fees eat into the 1:1 profit
    expect(Math.abs(effective)).toBeGreaterThan(100);
  });
  
  it('calculates effective odds for 25c', () => {
    // 25c = +300 American, but fees reduce it
    const effective = kalshiEffectiveOdds(0.25);
    expect(effective).toBeLessThan(300);
    expect(effective).toBeGreaterThan(280);
  });
  
  it('uses custom fees correctly', () => {
    const noFees: FeeStructure = { openFee: 0, settleFee: 0 };
    const effective = kalshiEffectiveOdds(0.50, noFees);
    expect(effective).toBe(100); // Should be exactly even money with no fees
  });
});

describe('applyCustomFees', () => {
  it('applies fees to profit correctly', () => {
    const stake = 100;
    const profit = 100; // Even money payout
    const fees: FeeStructure = { openFee: 0.01, settleFee: 0.02 };
    
    const result = applyCustomFees(stake, profit, fees);
    
    expect(result.totalFees).toBe(5); // 1 (open) + 4 (settle on 200 payout)
    expect(result.netProfit).toBe(95); // 100 - 5
  });
  
  it('handles zero fees', () => {
    const noFees: FeeStructure = { openFee: 0, settleFee: 0 };
    const result = applyCustomFees(100, 100, noFees);
    
    expect(result.totalFees).toBe(0);
    expect(result.netProfit).toBe(100);
  });
  
  it('handles high fees', () => {
    const highFees: FeeStructure = { openFee: 0.05, settleFee: 0.05 };
    const result = applyCustomFees(100, 100, highFees);
    
    expect(result.totalFees).toBe(15); // 5 (open on 100) + 10 (settle on 200)
    expect(result.netProfit).toBe(85);
  });
});

describe('DEFAULT_KALSHI_FEES', () => {
  it('has correct default values', () => {
    expect(DEFAULT_KALSHI_FEES.openFee).toBe(0.01);
    expect(DEFAULT_KALSHI_FEES.settleFee).toBe(0.02);
  });
});

describe('Unified Fee Adapters', () => {
  describe('applyNoFees', () => {
    it('returns profit with no fees', () => {
      const result = applyNoFees(100, 100);
      
      expect(result.payout).toBe(200);
      expect(result.profitBeforeFees).toBe(100);
      expect(result.feesBreakdown.total).toBe(0);
      expect(result.netProfit).toBe(100);
    });
    
    it('handles negative profit (loss)', () => {
      const result = applyNoFees(100, -50);
      
      expect(result.payout).toBe(50);
      expect(result.profitBeforeFees).toBe(-50);
      expect(result.feesBreakdown.total).toBe(0);
      expect(result.netProfit).toBe(-50);
    });
  });
  
  describe('applyProphetXFee', () => {
    it('applies 1% fee for PX! on positive profit', () => {
      const result = applyProphetXFee(100, 100, 'PX!');
      
      expect(result.profitBeforeFees).toBe(100);
      expect(result.feesBreakdown.winFee).toBe(1);
      expect(result.feesBreakdown.total).toBe(1);
      expect(result.netProfit).toBe(99);
      expect(result.payout).toBe(199);
    });
    
    it('does not apply fee for PX! on negative profit', () => {
      const result = applyProphetXFee(100, -50, 'PX!');
      
      expect(result.profitBeforeFees).toBe(-50);
      expect(result.feesBreakdown.total).toBe(0);
      expect(result.netProfit).toBe(-50);
    });
    
    it('does not apply fee for PX (without !)', () => {
      const result = applyProphetXFee(100, 100, 'PX');
      
      expect(result.profitBeforeFees).toBe(100);
      expect(result.feesBreakdown.total).toBe(0);
      expect(result.netProfit).toBe(100);
    });
    
    it('is case-insensitive', () => {
      const result1 = applyProphetXFee(100, 100, 'px!');
      const result2 = applyProphetXFee(100, 100, 'Px!');
      
      expect(result1.netProfit).toBe(99);
      expect(result2.netProfit).toBe(99);
    });
    
    it('does not apply fee for other sportsbooks', () => {
      const result = applyProphetXFee(100, 100, 'DraftKings');
      
      expect(result.netProfit).toBe(100);
      expect(result.feesBreakdown.total).toBe(0);
    });
    
    it('does not apply fee when sportsbook is undefined', () => {
      const result = applyProphetXFee(100, 100);
      
      expect(result.netProfit).toBe(100);
      expect(result.feesBreakdown.total).toBe(0);
    });
  });
  
  describe('applyKalshiYesFees', () => {
    it('calculates YES contract fees correctly', () => {
      // Stake $100 at 50c (even money)
      const result = applyKalshiYesFees(100, 0.50);
      
      expect(result.profitBeforeFees).toBe(100); // 200 contracts - 100 cost
      expect(result.feesBreakdown.openFee).toBe(1); // 1% of 100
      expect(result.feesBreakdown.settleFee).toBe(4); // 2% of 200 contracts
      expect(result.feesBreakdown.total).toBe(5);
      expect(result.netProfit).toBe(95);
      expect(result.payout).toBe(196); // 200 - 4 settle fee
    });
    
    it('calculates YES contract fees for 25c (3:1 odds)', () => {
      const result = applyKalshiYesFees(100, 0.25);
      
      expect(result.profitBeforeFees).toBe(300); // 400 contracts - 100 cost
      expect(result.feesBreakdown.openFee).toBe(1);
      expect(result.feesBreakdown.settleFee).toBe(8); // 2% of 400
      expect(result.feesBreakdown.total).toBe(9);
      expect(result.netProfit).toBe(291);
    });
    
    it('uses custom fee structure', () => {
      const result = applyKalshiYesFees(100, 0.50, 0.02, 0.03);
      
      expect(result.feesBreakdown.openFee).toBe(2); // 2% of 100
      expect(result.feesBreakdown.settleFee).toBe(6); // 3% of 200
      expect(result.netProfit).toBe(92);
    });
  });
  
  describe('applyKalshiNoFees', () => {
    it('calculates NO contract fees correctly', () => {
      // Stake $100 at 50c YES price (means 50c NO price)
      // NO price = 1 - 0.50 = 0.50
      const result = applyKalshiNoFees(100, 0.50);
      
      // Contracts = floor(100 / 0.50) = 200
      // Cost = 200 * 0.50 = 100
      // Gross profit = 0.50 * 200 = 100 (what you get if NO wins)
      // Open fee = 100 * 0.01 = 1
      // Settle fee = 100 * 0.02 = 2
      // Net payout = 100 - 2 = 98
      // Net profit = 98 - 101 = -3
      
      expect(result.profitBeforeFees).toBe(100);
      expect(result.feesBreakdown.openFee).toBe(1);
      expect(result.feesBreakdown.settleFee).toBe(2);
      expect(result.feesBreakdown.total).toBe(3);
      expect(result.netProfit).toBe(-3);
    });
    
    it('calculates NO contract fees for 75c YES price', () => {
      // NO price = 1 - 0.75 = 0.25
      // Contracts = floor(100 / 0.25) = 400
      // Cost = 400 * 0.25 = 100
      // Gross profit = 0.75 * 400 = 300
      const result = applyKalshiNoFees(100, 0.75);
      
      expect(result.profitBeforeFees).toBe(300);
      expect(result.feesBreakdown.openFee).toBe(1);
      expect(result.feesBreakdown.settleFee).toBe(6); // 2% of 300
      expect(result.netProfit).toBe(193); // 300 - 6 - 101
    });
    
    it('uses custom fee structure', () => {
      const result = applyKalshiNoFees(100, 0.50, 0.02, 0.03);
      
      expect(result.feesBreakdown.openFee).toBe(2); // 2% of 100
      expect(result.feesBreakdown.settleFee).toBe(3); // 3% of 100
      expect(result.netProfit).toBe(-5);
    });
  });
  
  describe('applyCustomFeesUnified', () => {
    it('applies custom openFee and winFee', () => {
      // 2% open fee, 3% win fee
      const result = applyCustomFeesUnified(100, 100, 0.02, 0.03);
      
      expect(result.profitBeforeFees).toBe(100);
      expect(result.feesBreakdown.openFee).toBe(2); // 2% of stake
      expect(result.feesBreakdown.winFee).toBe(3); // 3% of profit
      expect(result.feesBreakdown.total).toBe(5);
      expect(result.netProfit).toBe(95);
      expect(result.payout).toBe(195);
    });
    
    it('does not apply winFee on negative profit', () => {
      const result = applyCustomFeesUnified(100, -50, 0.02, 0.03);
      
      expect(result.feesBreakdown.openFee).toBe(2);
      expect(result.feesBreakdown.winFee).toBe(0);
      expect(result.feesBreakdown.total).toBe(2);
      expect(result.netProfit).toBe(-52);
    });
    
    it('handles zero fees', () => {
      const result = applyCustomFeesUnified(100, 100, 0, 0);
      
      expect(result.feesBreakdown.total).toBe(0);
      expect(result.netProfit).toBe(100);
    });
    
    it('handles high fees', () => {
      const result = applyCustomFeesUnified(100, 100, 0.05, 0.10);
      
      expect(result.feesBreakdown.openFee).toBe(5);
      expect(result.feesBreakdown.winFee).toBe(10);
      expect(result.feesBreakdown.total).toBe(15);
      expect(result.netProfit).toBe(85);
    });
  });
});
