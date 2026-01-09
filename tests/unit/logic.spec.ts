import { describe, it, expect } from 'vitest';
import {
  aggregatePositions,
  calculateNetOutcomes,
  solveMakerPrices,
  solveEqualizerStake,
  solveTargetStake,
  type Position,
  type AggregatedPositions,
} from '../../src/lib/logic';

describe('Maker Decision Engine', () => {
  describe('aggregatePositions', () => {
    it('aggregates single-sided positions correctly (side A only)', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 150 },
        { side: 1, stake: 50, profit: 75 },
      ];
      const result = aggregatePositions(positions);
      expect(result.totalStakeA).toBe(150);
      expect(result.totalProfitA).toBe(225);
      expect(result.totalStakeB).toBe(0);
      expect(result.totalProfitB).toBe(0);
    });

    it('aggregates single-sided positions correctly (side B only)', () => {
      const positions: Position[] = [
        { side: 2, stake: 200, profit: 100 },
      ];
      const result = aggregatePositions(positions);
      expect(result.totalStakeA).toBe(0);
      expect(result.totalProfitA).toBe(0);
      expect(result.totalStakeB).toBe(200);
      expect(result.totalProfitB).toBe(100);
    });

    it('aggregates mixed positions correctly', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 150 },
        { side: 2, stake: 80, profit: 80 },
        { side: 1, stake: 50, profit: 50 },
      ];
      const result = aggregatePositions(positions);
      expect(result.totalStakeA).toBe(150);
      expect(result.totalProfitA).toBe(200);
      expect(result.totalStakeB).toBe(80);
      expect(result.totalProfitB).toBe(80);
    });

    it('returns zeros for empty positions', () => {
      const result = aggregatePositions([]);
      expect(result.totalStakeA).toBe(0);
      expect(result.totalStakeB).toBe(0);
      expect(result.totalProfitA).toBe(0);
      expect(result.totalProfitB).toBe(0);
    });
  });

  describe('calculateNetOutcomes', () => {
    const agg: AggregatedPositions = {
      totalStakeA: 100,
      totalStakeB: 0,
      totalProfitA: 150,
      totalProfitB: 0,
    };

    it('calculates nets correctly for S=1 without fee', () => {
      const { netIfA, netIfB } = calculateNetOutcomes(agg, 1, 200, 2.0, false);
      expect(netIfA).toBeCloseTo(350, 2);
      expect(netIfB).toBeCloseTo(-300, 2);
    });

    it('calculates nets correctly for S=1 with 1% fee', () => {
      const { netIfA, netIfB } = calculateNetOutcomes(agg, 1, 200, 2.0, true);
      expect(netIfA).toBeCloseTo(348, 2);
      expect(netIfB).toBeCloseTo(-300, 2);
    });

    it('calculates nets correctly for S=2 without fee', () => {
      const { netIfA, netIfB } = calculateNetOutcomes(agg, 2, 200, 2.0, false);
      expect(netIfA).toBeCloseTo(-50, 2);
      expect(netIfB).toBeCloseTo(100, 2);
    });

    it('calculates nets correctly for S=2 with 1% fee', () => {
      const { netIfA, netIfB } = calculateNetOutcomes(agg, 2, 200, 2.0, true);
      expect(netIfA).toBeCloseTo(-50, 2);
      expect(netIfB).toBeCloseTo(98, 2);
    });
  });

  describe('Cover Price', () => {
    it('calculates cover price for S=2 with no fee', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveMakerPrices(positions, 2, 200, 0, false);
      expect(result.coverPrice.status).toBe('ok');
      expect(result.coverPrice.decimalOdds).toBeCloseTo(1.5, 4);
      expect(result.coverPrice.netIfB).toBeCloseTo(0, 2);
    });

    it('calculates cover price for S=2 with 1% ProphetX fee', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveMakerPrices(positions, 2, 200, 0, true);
      expect(result.coverPrice.status).toBe('ok');
      expect(result.coverPrice.decimalOdds).toBeCloseTo(1.505, 2);
      expect(result.coverPrice.netIfB).toBeCloseTo(0, 1);
    });

    it('returns invalid for impossible cover (d <= 1)', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 200 }];
      const result = solveMakerPrices(positions, 1, 50, 0, false);
      expect(result.coverPrice.status).toBe('invalid');
      expect(result.coverPrice.capReason).toBe('nonpositive_odds');
    });
  });

  describe('Equalizer Price', () => {
    it('equalizes simple position (Scenario 2 from plan)', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveMakerPrices(positions, 2, 200, 0, true);
      expect(result.equalizerPrice.status).toBe('ok');
      expect(result.equalizerPrice.decimalOdds).toBeCloseTo(1.2525, 3);
      expect(result.equalizerPrice.netIfA).toBeCloseTo(result.equalizerPrice.netIfB, 1);
      expect(result.equalizerPrice.netIfA).toBeCloseTo(-50, 1);
    });

    it('equalizes with S=1', () => {
      const positions: Position[] = [{ side: 2, stake: 100, profit: 100 }];
      const result = solveMakerPrices(positions, 1, 50, 0, false);
      expect(result.equalizerPrice.status).toBe('ok');
      expect(result.equalizerPrice.decimalOdds).toBeCloseTo(4.0, 4);
      expect(result.equalizerPrice.netIfA).toBeCloseTo(result.equalizerPrice.netIfB, 2);
    });

    it('returns invalid when equalization impossible', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveMakerPrices(positions, 1, 200, 0, false);
      expect(result.equalizerPrice.status).toBe('invalid');
      expect(result.equalizerPrice.capReason).toBe('nonpositive_odds');
    });

    it('handles already-equalized positions', () => {
      const positions: Position[] = [
        { side: 1, stake: 100, profit: 100 },
        { side: 2, stake: 100, profit: 100 },
      ];
      const result = solveMakerPrices(positions, 1, 100, 0, false);
      expect(result.equalizerPrice.status).toBe('invalid');
      expect(result.equalizerPrice.capReason).toBe('nonpositive_odds');
    });
  });

  describe('Target Floor Price', () => {
    it('achievable target returns ok', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 300 }];
      const result = solveMakerPrices(positions, 2, 100, 50, true);
      expect(result.targetFloorPrice.status).toBe('ok');
      expect(result.targetFloorPrice.decimalOdds).toBeCloseTo(2.515, 2);
      expect(result.targetFloorPrice.minNet).toBeCloseTo(50, 1);
    });

    it('capped target returns maxPossibleFloor', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveMakerPrices(positions, 2, 200, 100, false);
      expect(result.targetFloorPrice.status).toBe('capped');
      expect(result.targetFloorPrice.capReason).toBe('other_outcome_caps_floor');
      expect(result.targetFloorPrice.maxPossibleFloor).toBeCloseTo(-50, 2);
    });

    it('zero target (break-even) works', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 200 }];
      const result = solveMakerPrices(positions, 2, 100, 0, false);
      expect(result.targetFloorPrice.status).toBe('ok');
      expect(result.targetFloorPrice.minNet).toBeCloseTo(0, 2);
    });

    it('negative target profit works', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveMakerPrices(positions, 2, 200, -75, false);
      expect(result.targetFloorPrice.status).toBe('ok');
      expect(result.targetFloorPrice.minNet).toBeCloseTo(-75, 2);
    });
  });

  describe('solveEqualizerStake', () => {
    it('calculates equalizer stake for S=1', () => {
      const positions: Position[] = [{ side: 2, stake: 100, profit: 100 }];
      const result = solveEqualizerStake(positions, 1, 2.0, false);
      expect(result.status).toBe('ok');
      expect(result.requiredMakerStake).toBeCloseTo(100, 2);
      expect(result.netIfA).toBeCloseTo(result.netIfB, 2);
    });

    it('calculates equalizer stake for S=2', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveEqualizerStake(positions, 2, 2.0, false);
      expect(result.status).toBe('ok');
      expect(result.requiredMakerStake).toBeCloseTo(125, 2);
      expect(result.netIfA).toBeCloseTo(result.netIfB, 2);
    });

    it('calculates equalizer stake with 1% fee', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveEqualizerStake(positions, 2, 2.0, true);
      expect(result.status).toBe('ok');
      expect(result.requiredMakerStake).toBeCloseTo(125.63, 1);
    });

    it('returns invalid for impossible stake', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveEqualizerStake(positions, 1, 2.0, false);
      expect(result.status).toBe('invalid');
      expect(result.capReason).toBe('insufficient_stake');
    });

    it('returns invalid for d <= 1', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveEqualizerStake(positions, 2, 0.5, false);
      expect(result.status).toBe('invalid');
      expect(result.capReason).toBe('nonpositive_odds');
    });

    it('returns invalid for no positions', () => {
      const result = solveEqualizerStake([], 1, 2.0, false);
      expect(result.status).toBe('invalid');
      expect(result.capReason).toBe('no_positions');
    });
  });

  describe('solveTargetStake', () => {
    it('calculates target stake for achievable target', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 300 }];
      const result = solveTargetStake(positions, 2, 2.0, 50, false);
      expect(result.status).toBe('ok');
      expect(result.requiredMakerStake).toBeCloseTo(150, 2);
      expect(result.minNet).toBeGreaterThanOrEqual(49);
    });

    it('returns capped for impossible target', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveTargetStake(positions, 2, 2.0, 200, false);
      expect(result.status).toBe('capped');
      expect(result.capReason).toBe('other_outcome_caps_floor');
    });

    it('returns invalid for d <= 1', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveTargetStake(positions, 2, 0.8, 50, false);
      expect(result.status).toBe('invalid');
      expect(result.capReason).toBe('nonpositive_odds');
    });

    it('returns invalid for no positions', () => {
      const result = solveTargetStake([], 1, 2.0, 50, false);
      expect(result.status).toBe('invalid');
      expect(result.capReason).toBe('no_positions');
    });
  });

  describe('Fee Precision', () => {
    it('fee applies only to profit portion', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 200 }];
      const withFee = solveMakerPrices(positions, 2, 100, 0, true);
      const noFee = solveMakerPrices(positions, 2, 100, 0, false);
      expect(withFee.coverPrice.decimalOdds).toBeGreaterThan(noFee.coverPrice.decimalOdds);
    });

    it('no fee when toggle is off', () => {
      const agg: AggregatedPositions = {
        totalStakeA: 100,
        totalStakeB: 0,
        totalProfitA: 0,
        totalProfitB: 0,
      };
      const withFee = calculateNetOutcomes(agg, 2, 100, 2.0, true);
      const noFee = calculateNetOutcomes(agg, 2, 100, 2.0, false);
      expect(withFee.netIfB).toBeCloseTo(-1, 2);
      expect(noFee.netIfB).toBeCloseTo(0, 2);
    });
  });

  describe('Edge Cases', () => {
    it('zero stake returns invalid', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveMakerPrices(positions, 2, 0, 0, false);
      expect(result.coverPrice.status).toBe('invalid');
      expect(result.coverPrice.capReason).toBe('insufficient_stake');
    });

    it('negative stake returns invalid', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveMakerPrices(positions, 2, -50, 0, false);
      expect(result.coverPrice.status).toBe('invalid');
      expect(result.coverPrice.capReason).toBe('insufficient_stake');
    });

    it('no positions returns invalid', () => {
      const result = solveMakerPrices([], 1, 100, 0, false);
      expect(result.coverPrice.status).toBe('invalid');
      expect(result.coverPrice.capReason).toBe('no_positions');
    });

    it('very high odds handled correctly', () => {
      const positions: Position[] = [{ side: 2, stake: 100, profit: 100 }];
      const result = solveEqualizerStake(positions, 1, 10.0, false);
      expect(result.status).toBe('ok');
      expect(result.requiredMakerStake).toBeCloseTo(20, 2);
    });
  });

  describe('American Odds Conversion', () => {
    it('converts decimal 2.0 to American +100', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 100 }];
      const result = solveMakerPrices(positions, 2, 100, 0, false);
      expect(result.coverPrice.decimalOdds).toBeCloseTo(2.0, 4);
      expect(result.coverPrice.americanOdds).toBe(100);
    });

    it('converts underdog odds correctly', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 300 }];
      const result = solveMakerPrices(positions, 2, 100, 50, false);
      expect(result.targetFloorPrice.decimalOdds).toBeCloseTo(2.5, 2);
      expect(result.targetFloorPrice.americanOdds).toBe(150);
    });

    it('converts favorite odds correctly', () => {
      const positions: Position[] = [{ side: 1, stake: 100, profit: 150 }];
      const result = solveMakerPrices(positions, 2, 200, 0, true);
      expect(result.equalizerPrice.decimalOdds).toBeCloseTo(1.2525, 2);
      expect(result.equalizerPrice.americanOdds).toBeLessThan(-300);
    });
  });
});
