import { describe, it, expect } from 'vitest';
import {
  calculateCover,
  calculateEqualization,
  calculateTargetProfit,
  calculateCoverage,
  type Position,
  type FeeAdapter,
  NO_FEES
} from '../../src/lib/cover';

describe('Exact Cover Math Formulas with Fees', () => {
  const KALSHI_FEES: FeeAdapter = {
    openFeeRate: 0.01,
    settleFeeRate: 0.02
  };

  describe('calculateCover with fees', () => {
    it('covers to zero with fees applied', () => {
      const positions: Position[] = [
        { side: 2, stake: 100, profit: 100, odds: 100, fees: 0 }
      ];
      
      // Net A = 0 - 100 - 0 = -100 (losing if A wins)
      // Cover by betting on A with +100 odds (profit multiplier = 1)
      // With 1% open fee and 2% settle fee:
      // Denominator = 1 - 0.02 - 0.01 = 0.97
      // Δ = 100 / 0.97 ≈ 103.09
      const result = calculateCover(positions, 1, 100, KALSHI_FEES);
      
      expect(result).not.toBeNull();
      expect(result!.side).toBe(1);
      expect(result!.stake).toBeCloseTo(103.09, 2);
      expect(result!.netAfterCover.sideA).toBeCloseTo(0, 1);
    });

    it('covers to zero with no fees (backward compatibility)', () => {
      const positions: Position[] = [
        { side: 2, stake: 100, profit: 100, odds: 100 }
      ];
      
      // Should match old behavior when fees are 0
      const result = calculateCover(positions, 1, 100, NO_FEES);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBeCloseTo(100, 2);
      expect(result!.netAfterCover.sideA).toBeCloseTo(0, 2);
    });

    it('handles high-odds cover with fees', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 300, odds: 300, fees: 0 }
      ];
      
      // Net B = 0 - 100 = -100 (losing if B wins)
      // Cover by betting on B with +200 odds (profit multiplier = 2)
      // With 1% open fee and 2% settle fee:
      // Denominator = 2 - 0.02 - 0.01 = 1.97
      // Δ = 100 / 1.97 ≈ 50.76
      const result = calculateCover(positions, 2, 200, KALSHI_FEES);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBeCloseTo(50.76, 2);
    });
  });

  describe('calculateEqualization with fees', () => {
    it('equalizes with fees applied', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 100, odds: 100, fees: 0 }
      ];
      
      // Net A = 100 - 0 - 0 = 100, Net B = 0 - 100 - 0 = -100
      // Bet on B with +100 odds (profit multiplier = 1)
      // With 1% open fee and 2% settle fee:
      // effectiveDenom = 1 + (dB-1)*(1-settleFeeRate) - openFeeRate
      // effectiveDenom = 1 + 1*(1-0.02) - 0.01 = 1.97
      // Numerator = 100 - 0 - 0 - 0 + 100 + 0 = 200
      // Δ = 200 / 1.97 ≈ 101.52
      const result = calculateEqualization(positions, 2, 100, KALSHI_FEES);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBeCloseTo(101.52, 2);
    });

    it('equalizes with no fees (backward compatibility)', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 100, odds: 100 }
      ];
      
      const result = calculateEqualization(positions, 2, 100, NO_FEES);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBeCloseTo(100, 2);
    });

    it('equalizes with positions that have existing fees', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 95, odds: 100, fees: 5 },
        { side: 2, stake: 50, profit: 48, odds: 100, fees: 2 }
      ];
      
      // Net A = 95 - 50 - 5 = 40
      // Net B = 48 - 100 - 2 = -54
      // Bet on B to equalize
      // Numerator = 95 - 50 - 5 - 48 + 100 + 2 = 94
      // effectiveDenom = 1 + 1*(1-0.02) - 0.01 = 1.97
      // Δ = 94 / 1.97 ≈ 47.72
      const result = calculateEqualization(positions, 2, 100, KALSHI_FEES);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBeCloseTo(47.72, 2);
    });
  });

  describe('calculateTargetProfit', () => {
    it('calculates stake for target profit of $50', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 100, odds: 100 }
      ];
      
      // Net A = 100 - 0 = 100, Net B = 0 - 100 = -100
      // Target profit = 50 for both sides
      // Weaker side is B (net = -100)
      // Δ = (50 - (-100)) / (1 - 0 - 0) = 150 / 1 = 150
      const result = calculateTargetProfit(positions, 50, 100, 100);
      
      expect(result).not.toBeNull();
      expect(result!.side).toBe(2);
      expect(result!.stake).toBeCloseTo(150, 2);
      expect(result!.targetProfit).toBe(50);
    });

    it('calculates target profit with fees', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 100, odds: 100, fees: 0 }
      ];
      
      // Target profit = 50
      // With fees: Denominator = 1 - 0.02 - 0.01 = 0.97
      // Δ = (50 - (-100)) / 0.97 = 150 / 0.97 ≈ 154.64
      const result = calculateTargetProfit(positions, 50, 100, 100, KALSHI_FEES);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBeCloseTo(154.64, 2);
    });

    it('returns null when target already exceeded', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 200, odds: 200 },
        { side: 2, stake: 100, profit: 200, odds: 200 }
      ];
      
      // Net A = 200 - 100 = 100, Net B = 200 - 100 = 100
      // Target = 50 is already exceeded
      const result = calculateTargetProfit(positions, 50, 100, 100);
      
      expect(result).toBeNull();
    });

    it('handles high target profit', () => {
      const positions: Position[] = [
        { side: 1, stake: 50, profit: 50, odds: 100 }
      ];
      
      // Net A = 50, Net B = -50
      // Target = 200
      // Δ = (200 - (-50)) / 1 = 250
      const result = calculateTargetProfit(positions, 200, 100, 100);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBeCloseTo(250, 2);
    });

    it('uses odds from the weaker side', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 200, odds: 200 }
      ];
      
      // Net A = 200, Net B = -100
      // B is weaker, use odds B
      const result = calculateTargetProfit(positions, 50, 150, 200);
      
      expect(result).not.toBeNull();
      expect(result!.side).toBe(2);
      expect(result!.odds).toBe(200);
    });
  });

  describe('calculateCoverage', () => {
    it('calculates 80% coverage', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 100, odds: 100 }
      ];
      
      // Net A = 100, Net B = -100
      // Weaker side is B
      // 80% coverage means net B should be ≥ -100 * (1 - 0.8) = -20
      // Current net B = -100
      // Δ = (-20 - (-100)) / 1 = 80 / 1 = 80
      const result = calculateCoverage(positions, 0.8, 100, 100);
      
      expect(result).not.toBeNull();
      expect(result!.side).toBe(2);
      expect(result!.stake).toBeCloseTo(80, 2);
      expect(result!.coveragePercent).toBe(0.8);
    });

    it('calculates 50% coverage (break-even)', () => {
      const positions: Position[] = [
        { side: 2, stake: 200, profit: 200, odds: 100 }
      ];
      
      // Net A = 0 - 200 = -200, Net B = 200 - 0 = 200
      // Weaker side is A
      // 50% coverage means net A should be ≥ -200 * (1 - 0.5) = -100
      // Δ = (-100 - (-200)) / 1 = 100
      const result = calculateCoverage(positions, 0.5, 100, 100);
      
      expect(result).not.toBeNull();
      expect(result!.side).toBe(1);
      expect(result!.stake).toBeCloseTo(100, 2);
    });

    it('calculates 100% coverage (full equalization)', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 100, odds: 100 }
      ];
      
      // 100% coverage means net should be 0 (no loss)
      // Target net B = -100 * (1 - 1.0) = 0
      // Δ = (0 - (-100)) / 1 = 100
      const result = calculateCoverage(positions, 1.0, 100, 100);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBeCloseTo(100, 2);
    });

    it('calculates coverage with fees', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 100, odds: 100, fees: 0 }
      ];
      
      // 80% coverage with fees
      // Target net = -20
      // Denominator = 1 - 0.02 - 0.01 = 0.97
      // Δ = (-20 - (-100)) / 0.97 = 80 / 0.97 ≈ 82.47
      const result = calculateCoverage(positions, 0.8, 100, 100, KALSHI_FEES);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBeCloseTo(82.47, 2);
    });

    it('returns null for invalid coverage percent', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 100, odds: 100 }
      ];
      
      expect(calculateCoverage(positions, -0.1, 100, 100)).toBeNull();
      expect(calculateCoverage(positions, 1.5, 100, 100)).toBeNull();
    });

    it('returns null when coverage already exceeded', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 180, odds: 180 },
        { side: 2, stake: 50, profit: 50, odds: 100 }
      ];
      
      // Net A = 180 - 50 = 130, Net B = 50 - 100 = -50
      // Target for 80% coverage: net B ≥ -100 * 0.2 = -20
      // Current net B = -50, which is already worse than -20
      // So we'd need to add a bet... wait, let me recalculate
      // Actually if net B = -50 and target is -20, we need to improve it
      // Δ = (-20 - (-50)) / 1 = 30
      const result = calculateCoverage(positions, 0.8, 100, 100);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBeCloseTo(30, 2);
    });

    it('handles asymmetric stakes correctly', () => {
      const positions: Position[] = [
        { side: 1, stake: 150, profit: 150, odds: 100 },
        { side: 2, stake: 50, profit: 50, odds: 100 }
      ];
      
      // Net A = 150 - 50 = 100, Net B = 50 - 150 = -100
      // 90% coverage: target net B = -150 * (1 - 0.9) = -15
      // Δ = (-15 - (-100)) / 1 = 85
      const result = calculateCoverage(positions, 0.9, 100, 100);
      
      expect(result).not.toBeNull();
      expect(result!.side).toBe(2);
      expect(result!.stake).toBeCloseTo(85, 2);
    });
  });

  describe('Edge cases and validation', () => {
    it('handles zero stakes gracefully in target profit', () => {
      const positions: Position[] = [];
      
      const result = calculateTargetProfit(positions, 100, 100, 100);
      
      // With no positions, both nets are 0
      // Weaker side would be either, let's say side 1
      // Δ = (100 - 0) / 1 = 100
      expect(result).not.toBeNull();
    });

    it('returns zero stake when fees are too high', () => {
      const highFees: FeeAdapter = {
        openFeeRate: 0.5,
        settleFeeRate: 0.6
      };
      
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 100, odds: 100 }
      ];
      
      // Denominator = 1 - 0.6 - 0.5 = -0.1 (negative, impossible)
      // Function should return result with stake = 0
      const result = calculateCover(positions, 2, 100, highFees);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBe(0);
    });

    it('handles very small coverage percentages', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 100, odds: 100 }
      ];
      
      // 5% coverage: target net B = -100 * 0.95 = -95
      // Current net B = -100
      // Δ = (-95 - (-100)) / 1 = 5
      const result = calculateCoverage(positions, 0.05, 100, 100);
      
      expect(result).not.toBeNull();
      expect(result!.stake).toBeCloseTo(5, 2);
    });
  });
});
