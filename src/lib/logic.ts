import { decimalToAmerican } from './odds';

export type Side = 1 | 2;
export type ThresholdStatus = 'ok' | 'capped' | 'invalid';
export type CapReason =
  | 'other_outcome_caps_floor'
  | 'nonpositive_odds'
  | 'insufficient_stake'
  | 'no_positions'
  | null;

export interface Position {
  side: Side;
  stake: number;
  profit: number;
}

export interface ThresholdResult {
  decimalOdds: number;
  americanOdds: number;
  netIfA: number;
  netIfB: number;
  minNet: number;
  status: ThresholdStatus;
  capReason: CapReason;
  maxPossibleFloor?: number;
}

export interface MakerDecisionSet {
  makerSide: Side;
  makerStake: number;
  prophetXFeeActive: boolean;
  coverPrice: ThresholdResult;
  equalizerPrice: ThresholdResult;
  targetFloorPrice: ThresholdResult;
  targetProfit: number;
}

export interface StakeSolverResult {
  makerSide: Side;
  decimalOdds: number;
  requiredMakerStake: number;
  netIfA: number;
  netIfB: number;
  minNet: number;
  status: ThresholdStatus;
  capReason: CapReason;
}

export interface AggregatedPositions {
  totalStakeA: number;
  totalStakeB: number;
  totalProfitA: number;
  totalProfitB: number;
}

export function aggregatePositions(positions: Position[]): AggregatedPositions {
  let totalStakeA = 0;
  let totalStakeB = 0;
  let totalProfitA = 0;
  let totalProfitB = 0;
  for (const pos of positions) {
    if (pos.side === 1) {
      totalStakeA += pos.stake;
      totalProfitA += pos.profit;
    } else {
      totalStakeB += pos.stake;
      totalProfitB += pos.profit;
    }
  }
  return { totalStakeA, totalStakeB, totalProfitA, totalProfitB };
}

export function calculateNetOutcomes(
  agg: AggregatedPositions,
  makerSide: Side,
  makerStake: number,
  decimalOdds: number,
  prophetXFeeActive: boolean
): { netIfA: number; netIfB: number } {
  const f = prophetXFeeActive ? 0.99 : 1.0;
  const { totalStakeA, totalStakeB, totalProfitA, totalProfitB } = agg;
  const makerLegWinnings = makerStake * (decimalOdds - 1) * f;
  let netIfA: number;
  let netIfB: number;
  if (makerSide === 1) {
    netIfA = totalProfitA + makerLegWinnings - totalStakeB;
    netIfB = totalProfitB - (totalStakeA + makerStake);
  } else {
    netIfA = totalProfitA - (totalStakeB + makerStake);
    netIfB = totalProfitB + makerLegWinnings - totalStakeA;
  }
  return { netIfA, netIfB };
}

function safeDecimalToAmerican(d: number): number {
  if (!isFinite(d) || d <= 1) return 0;
  try {
    return decimalToAmerican(d);
  } catch {
    return 0;
  }
}

function invalidThreshold(capReason: CapReason): ThresholdResult {
  return {
    decimalOdds: 0,
    americanOdds: 0,
    netIfA: 0,
    netIfB: 0,
    minNet: 0,
    status: 'invalid',
    capReason,
  };
}

function cappedThreshold(
  decimalOdds: number,
  netIfA: number,
  netIfB: number,
  maxPossibleFloor: number
): ThresholdResult {
  return {
    decimalOdds,
    americanOdds: safeDecimalToAmerican(decimalOdds),
    netIfA,
    netIfB,
    minNet: Math.min(netIfA, netIfB),
    status: 'capped',
    capReason: 'other_outcome_caps_floor',
    maxPossibleFloor,
  };
}

function solveCoverPrice(
  agg: AggregatedPositions,
  makerSide: Side,
  makerStake: number,
  f: number
): ThresholdResult {
  const { totalStakeA, totalStakeB, totalProfitA, totalProfitB } = agg;
  if (makerStake <= 0) return invalidThreshold('insufficient_stake');
  let d: number;
  if (makerSide === 1) {
    d = 1 + (totalStakeB - totalProfitA) / (makerStake * f);
  } else {
    d = 1 + (totalStakeA - totalProfitB) / (makerStake * f);
  }
  if (!isFinite(d) || d <= 1) return invalidThreshold('nonpositive_odds');
  const { netIfA, netIfB } = calculateNetOutcomes(agg, makerSide, makerStake, d, f < 1);
  return {
    decimalOdds: d,
    americanOdds: safeDecimalToAmerican(d),
    netIfA,
    netIfB,
    minNet: Math.min(netIfA, netIfB),
    status: 'ok',
    capReason: null,
  };
}

function solveEqualizerPrice(
  agg: AggregatedPositions,
  makerSide: Side,
  makerStake: number,
  f: number
): ThresholdResult {
  const { totalStakeA, totalStakeB, totalProfitA, totalProfitB } = agg;
  if (makerStake <= 0) return invalidThreshold('insufficient_stake');
  const diff = (totalProfitB - totalProfitA) + (totalStakeB - totalStakeA);
  let d: number;
  if (makerSide === 1) {
    d = 1 + (diff - makerStake) / (makerStake * f);
  } else {
    d = 1 + (-diff - makerStake) / (makerStake * f);
  }
  if (!isFinite(d) || d <= 1) return invalidThreshold('nonpositive_odds');
  const { netIfA, netIfB } = calculateNetOutcomes(agg, makerSide, makerStake, d, f < 1);
  return {
    decimalOdds: d,
    americanOdds: safeDecimalToAmerican(d),
    netIfA,
    netIfB,
    minNet: Math.min(netIfA, netIfB),
    status: 'ok',
    capReason: null,
  };
}

function solveTargetFloorPrice(
  agg: AggregatedPositions,
  makerSide: Side,
  makerStake: number,
  targetProfit: number,
  f: number
): ThresholdResult {
  const { totalStakeA, totalStakeB, totalProfitA, totalProfitB } = agg;
  if (makerStake <= 0) return invalidThreshold('insufficient_stake');
  let fixedSideNet: number;
  let d: number;
  if (makerSide === 1) {
    fixedSideNet = totalProfitB - totalStakeA - makerStake;
    if (targetProfit > fixedSideNet) {
      d = 1 + (fixedSideNet + totalStakeB - totalProfitA) / (makerStake * f);
      if (!isFinite(d) || d <= 1) return invalidThreshold('nonpositive_odds');
      const { netIfA, netIfB } = calculateNetOutcomes(agg, makerSide, makerStake, d, f < 1);
      return cappedThreshold(d, netIfA, netIfB, fixedSideNet);
    }
    d = 1 + (targetProfit + totalStakeB - totalProfitA) / (makerStake * f);
  } else {
    fixedSideNet = totalProfitA - totalStakeB - makerStake;
    if (targetProfit > fixedSideNet) {
      d = 1 + (fixedSideNet + totalStakeA - totalProfitB) / (makerStake * f);
      if (!isFinite(d) || d <= 1) return invalidThreshold('nonpositive_odds');
      const { netIfA, netIfB } = calculateNetOutcomes(agg, makerSide, makerStake, d, f < 1);
      return cappedThreshold(d, netIfA, netIfB, fixedSideNet);
    }
    d = 1 + (targetProfit + totalStakeA - totalProfitB) / (makerStake * f);
  }
  if (!isFinite(d) || d <= 1) return invalidThreshold('nonpositive_odds');
  const { netIfA, netIfB } = calculateNetOutcomes(agg, makerSide, makerStake, d, f < 1);
  return {
    decimalOdds: d,
    americanOdds: safeDecimalToAmerican(d),
    netIfA,
    netIfB,
    minNet: Math.min(netIfA, netIfB),
    status: 'ok',
    capReason: null,
  };
}

export function solveMakerPrices(
  positions: Position[],
  makerSide: Side,
  makerStake: number,
  targetProfit: number,
  prophetXFeeActive: boolean
): MakerDecisionSet {
  const f = prophetXFeeActive ? 0.99 : 1.0;
  const agg = aggregatePositions(positions);
  const hasPositions = positions.length > 0;
  let coverPrice: ThresholdResult;
  let equalizerPrice: ThresholdResult;
  let targetFloorPrice: ThresholdResult;
  if (!hasPositions) {
    coverPrice = invalidThreshold('no_positions');
    equalizerPrice = invalidThreshold('no_positions');
    targetFloorPrice = invalidThreshold('no_positions');
  } else {
    coverPrice = solveCoverPrice(agg, makerSide, makerStake, f);
    equalizerPrice = solveEqualizerPrice(agg, makerSide, makerStake, f);
    targetFloorPrice = solveTargetFloorPrice(agg, makerSide, makerStake, targetProfit, f);
  }
  return {
    makerSide,
    makerStake,
    prophetXFeeActive,
    coverPrice,
    equalizerPrice,
    targetFloorPrice,
    targetProfit,
  };
}

export function solveEqualizerStake(
  positions: Position[],
  makerSide: Side,
  decimalOdds: number,
  prophetXFeeActive: boolean
): StakeSolverResult {
  if (!isFinite(decimalOdds) || decimalOdds <= 1) {
    return {
      makerSide,
      decimalOdds,
      requiredMakerStake: 0,
      netIfA: 0,
      netIfB: 0,
      minNet: 0,
      status: 'invalid',
      capReason: 'nonpositive_odds',
    };
  }
  if (positions.length === 0) {
    return {
      makerSide,
      decimalOdds,
      requiredMakerStake: 0,
      netIfA: 0,
      netIfB: 0,
      minNet: 0,
      status: 'invalid',
      capReason: 'no_positions',
    };
  }
  const f = prophetXFeeActive ? 0.99 : 1.0;
  const agg = aggregatePositions(positions);
  const { totalStakeA, totalStakeB, totalProfitA, totalProfitB } = agg;
  const diff = (totalProfitB - totalProfitA) + (totalStakeB - totalStakeA);
  const denom = (decimalOdds - 1) * f + 1;
  let delta: number;
  if (makerSide === 1) {
    delta = diff / denom;
  } else {
    delta = -diff / denom;
  }
  if (!isFinite(delta) || delta <= 0) {
    return {
      makerSide,
      decimalOdds,
      requiredMakerStake: 0,
      netIfA: 0,
      netIfB: 0,
      minNet: 0,
      status: 'invalid',
      capReason: 'insufficient_stake',
    };
  }
  const { netIfA, netIfB } = calculateNetOutcomes(agg, makerSide, delta, decimalOdds, prophetXFeeActive);
  return {
    makerSide,
    decimalOdds,
    requiredMakerStake: delta,
    netIfA,
    netIfB,
    minNet: Math.min(netIfA, netIfB),
    status: 'ok',
    capReason: null,
  };
}

export function solveTargetStake(
  positions: Position[],
  makerSide: Side,
  decimalOdds: number,
  targetProfit: number,
  prophetXFeeActive: boolean
): StakeSolverResult {
  if (!isFinite(decimalOdds) || decimalOdds <= 1) {
    return {
      makerSide,
      decimalOdds,
      requiredMakerStake: 0,
      netIfA: 0,
      netIfB: 0,
      minNet: 0,
      status: 'invalid',
      capReason: 'nonpositive_odds',
    };
  }
  if (positions.length === 0) {
    return {
      makerSide,
      decimalOdds,
      requiredMakerStake: 0,
      netIfA: 0,
      netIfB: 0,
      minNet: 0,
      status: 'invalid',
      capReason: 'no_positions',
    };
  }
  const f = prophetXFeeActive ? 0.99 : 1.0;
  const agg = aggregatePositions(positions);
  const { totalStakeA, totalStakeB, totalProfitA, totalProfitB } = agg;
  const profitMultiplier = (decimalOdds - 1) * f;
  if (profitMultiplier <= 0) {
    return {
      makerSide,
      decimalOdds,
      requiredMakerStake: 0,
      netIfA: 0,
      netIfB: 0,
      minNet: 0,
      status: 'invalid',
      capReason: 'nonpositive_odds',
    };
  }
  let lowerBound: number;
  let upperBound: number;
  if (makerSide === 1) {
    lowerBound = (targetProfit + totalStakeB - totalProfitA) / profitMultiplier;
    upperBound = totalProfitB - totalStakeA - targetProfit;
  } else {
    lowerBound = (targetProfit + totalStakeA - totalProfitB) / profitMultiplier;
    upperBound = totalProfitA - totalStakeB - targetProfit;
  }
  if (lowerBound > upperBound) {
    // Target is impossible - return capped with best possible stake
    // The best we can do is use the upper bound (the max stake before fixed side goes negative)
    // But if upper bound is negative, there's no valid stake that helps at all
    const bestStake = upperBound > 0 ? upperBound : lowerBound > 0 ? lowerBound : 0;
    if (bestStake <= 0) {
      // No positive stake works - return capped with zero stake and explain
      return {
        makerSide,
        decimalOdds,
        requiredMakerStake: 0,
        netIfA: 0,
        netIfB: 0,
        minNet: upperBound, // The best the fixed side can achieve without any bet
        status: 'capped',
        capReason: 'other_outcome_caps_floor',
      };
    }
    const { netIfA, netIfB } = calculateNetOutcomes(agg, makerSide, bestStake, decimalOdds, prophetXFeeActive);
    return {
      makerSide,
      decimalOdds,
      requiredMakerStake: bestStake,
      netIfA,
      netIfB,
      minNet: Math.min(netIfA, netIfB),
      status: 'capped',
      capReason: 'other_outcome_caps_floor',
    };
  }
  const delta = Math.max(0, lowerBound);
  if (delta <= 0) {
    return {
      makerSide,
      decimalOdds,
      requiredMakerStake: 0,
      netIfA: 0,
      netIfB: 0,
      minNet: 0,
      status: 'invalid',
      capReason: 'insufficient_stake',
    };
  }
  const { netIfA, netIfB } = calculateNetOutcomes(agg, makerSide, delta, decimalOdds, prophetXFeeActive);
  return {
    makerSide,
    decimalOdds,
    requiredMakerStake: delta,
    netIfA,
    netIfB,
    minNet: Math.min(netIfA, netIfB),
    status: 'ok',
    capReason: null,
  };
}
