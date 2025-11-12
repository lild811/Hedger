/**
 * Cover calculation library for Fast Hedger v2.3
 * Provides accurate math for equalizing bets and covering positions
 * Implements exact formulas with fee support
 */

import { profitPerDollar, americanToDecimal } from './odds';

export interface Position {
  side: 1 | 2;
  stake: number;
  profit: number;
  odds: number | null;
  fees?: number; // Total fees for this position
}

/**
 * Fee structure for calculating new bets
 */
export interface FeeAdapter {
  openFeeRate: number;      // Fee on stake (e.g., 0.01 = 1%)
  settleFeeRate: number;    // Fee on winnings/profit (e.g., 0.02 = 2%)
}

/**
 * Default no-fee structure
 */
export const NO_FEES: FeeAdapter = {
  openFeeRate: 0,
  settleFeeRate: 0
};

export interface CoverResult {
  side: 1 | 2;
  stake: number;
  odds: number;
  netAfterCover: {
    sideA: number;
    sideB: number;
  };
}

export interface EqualizationResult {
  side: 1 | 2;
  stake: number;
  targetTotal: number;
  odds: number;
}

export interface TargetProfitResult {
  side: 1 | 2;
  stake: number;
  targetProfit: number;
  odds: number;
}

export interface CoverageResult {
  side: 1 | 2;
  stake: number;
  coveragePercent: number;
  odds: number;
}

/**
 * Calculate stake needed to cover a position to zero on one side
 * "Cover A = 0" means: bet on A so that if A wins, net = 0
 * "Cover B = 0" means: bet on B so that if B wins, net = 0
 * 
 * Exact formula with fees:
 * Δ ≈ |netX| / ((dX-1) - fee_rate_on_winnings)
 * 
 * @param positions - Array of current positions
 * @param coverSide - Which side to add a bet on (1 or 2)
 * @param odds - Odds for the cover bet
 * @param feeAdapter - Fee structure for the new bet (optional)
 * @returns Stake needed to make net = 0 if that side wins
 */
export function calculateCover(
  positions: Position[],
  coverSide: 1 | 2,
  odds: number,
  feeAdapter: FeeAdapter = NO_FEES
): CoverResult | null {
  if (!odds || !isFinite(odds)) return null;
  
  // Calculate current totals
  const stakeA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.stake, 0);
  const stakeB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.stake, 0);
  const profitA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.profit, 0);
  const profitB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.profit, 0);
  const feesA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + (p.fees || 0), 0);
  const feesB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + (p.fees || 0), 0);
  
  const netA = profitA - stakeB - feesA;
  const netB = profitB - stakeA - feesB;
  
  // Convert to decimal odds
  const decimalOdds = americanToDecimal(odds);
  const profitMultiplier = decimalOdds - 1;
  
  // Calculate denominator: (dX-1) - fee_rate_on_winnings
  // fee_rate_on_winnings applies to the profit portion
  const denominator = profitMultiplier - feeAdapter.settleFeeRate;
  
  if (denominator <= 0) return null; // Fees too high
  
  let coverStake: number;
  
  if (coverSide === 1) {
    // Cover A = 0
    // netA' = profitA + Δ*(dA-1) - stakeB - feesA - fee_on_delta
    // fee_on_delta = Δ * openFeeRate + Δ*(dA-1) * settleFeeRate
    // Set netA' = 0 and solve for Δ
    // Δ ≈ |netA| / ((dA-1) - settleFeeRate) when accounting for settle fee on winnings
    // But we also need to account for open fee on the stake itself
    if (netA < 0) {
      // Need to add profit to cover the loss
      // Including open fee: actual cost is Δ * (1 + openFeeRate)
      // So we need: Δ * denominator ≥ |netA| + Δ * openFeeRate
      // Δ * (denominator - openFeeRate) = |netA|
      const effectiveDenom = denominator - feeAdapter.openFeeRate;
      coverStake = effectiveDenom > 0 ? Math.abs(netA) / effectiveDenom : 0;
    } else {
      coverStake = 0;
    }
  } else {
    // Cover B = 0
    if (netB < 0) {
      const effectiveDenom = denominator - feeAdapter.openFeeRate;
      coverStake = effectiveDenom > 0 ? Math.abs(netB) / effectiveDenom : 0;
    } else {
      coverStake = 0;
    }
  }
  
  // Calculate nets after cover including fees
  const coverProfit = coverStake * profitMultiplier;
  const openFee = coverStake * feeAdapter.openFeeRate;
  const settleFee = coverProfit * feeAdapter.settleFeeRate;
  const netCoverProfit = coverProfit - settleFee;
  
  let netAAfter: number, netBAfter: number;
  
  if (coverSide === 1) {
    netAAfter = (profitA + netCoverProfit) - stakeB - feesA - openFee;
    netBAfter = profitB - (stakeA + coverStake) - feesB;
  } else {
    netAAfter = profitA - (stakeB + coverStake) - feesA;
    netBAfter = (profitB + netCoverProfit) - stakeA - feesB - openFee;
  }
  
  return {
    side: coverSide,
    stake: coverStake,
    odds,
    netAfterCover: {
      sideA: netAAfter,
      sideB: netBAfter
    }
  };
}

/**
 * Calculate stake needed to equalize nets on both sides
 * 
 * Exact formula with fees:
 * If adding to B:
 * Δ = (profitA - stakeB - feesA - profitB + stakeA + feesB) / (dB-1 - fee_rate_on_winnings)
 * 
 * @param positions - Array of current positions
 * @param equalizeSide - Which side to add a bet on (1 or 2)
 * @param odds - Odds for the equalization bet (American)
 * @param feeAdapter - Fee structure for the new bet (optional)
 * @returns Stake needed to equalize both sides
 */
export function calculateEqualization(
  positions: Position[],
  equalizeSide: 1 | 2,
  odds: number,
  feeAdapter: FeeAdapter = NO_FEES
): EqualizationResult | null {
  if (!odds || !isFinite(odds)) return null;
  
  // Calculate current totals
  const stakeA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.stake, 0);
  const stakeB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.stake, 0);
  const profitA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.profit, 0);
  const profitB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.profit, 0);
  const feesA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + (p.fees || 0), 0);
  const feesB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + (p.fees || 0), 0);
  
  const netA = profitA - stakeB - feesA;
  const netB = profitB - stakeA - feesB;
  
  // Already balanced
  if (Math.abs(netA - netB) < 0.01) {
    return null;
  }
  
  // Convert American to decimal odds
  const decimalOdds = americanToDecimal(odds);
  const profitMultiplier = decimalOdds - 1;
  
  let equalizeStake: number;
  let currentTotal: number;
  
  if (equalizeSide === 1) {
    // Betting on side A to equalize
    // netA' = profitA + Δ*(dA-1)*(1-settleFeeRate) - Δ*openFeeRate - stakeB - feesA
    // netB' = profitB - (stakeA + Δ) - feesB
    // Set netA' = netB' and solve for Δ
    // Δ[1 + (dA-1)*(1-settleFeeRate) - openFeeRate] = profitB - stakeA - feesB - profitA + stakeB + feesA
    const numerator = profitB - stakeA - feesB - profitA + stakeB + feesA;
    const effectiveDenom = 1 + profitMultiplier * (1 - feeAdapter.settleFeeRate) - feeAdapter.openFeeRate;
    equalizeStake = effectiveDenom > 0 ? numerator / effectiveDenom : 0;
    currentTotal = stakeA;
  } else {
    // Betting on side B to equalize
    // netA' = profitA - (stakeB + Δ) - feesA
    // netB' = profitB + Δ*(dB-1)*(1-settleFeeRate) - Δ*openFeeRate - stakeA - feesB
    // Set netA' = netB' and solve for Δ
    // Δ[1 + (dB-1)*(1-settleFeeRate) - openFeeRate] = profitA - stakeB - feesA - profitB + stakeA + feesB
    const numerator = profitA - stakeB - feesA - profitB + stakeA + feesB;
    const effectiveDenom = 1 + profitMultiplier * (1 - feeAdapter.settleFeeRate) - feeAdapter.openFeeRate;
    equalizeStake = effectiveDenom > 0 ? numerator / effectiveDenom : 0;
    currentTotal = stakeB;
  }
  
  equalizeStake = Math.max(0, equalizeStake);
  
  return {
    side: equalizeSide,
    stake: equalizeStake,
    targetTotal: currentTotal + equalizeStake,
    odds
  };
}

/**
 * Determine which side needs a bet to equalize and calculate the required stake
 */
export function autoEqualize(
  positions: Position[],
  oddsA: number | null,
  oddsB: number | null,
  feeAdapter: FeeAdapter = NO_FEES
): EqualizationResult | null {
  // Calculate current totals
  const stakeA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.stake, 0);
  const stakeB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.stake, 0);
  const profitA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.profit, 0);
  const profitB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.profit, 0);
  const feesA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + (p.fees || 0), 0);
  const feesB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + (p.fees || 0), 0);
  
  const netA = profitA - stakeB - feesA;
  const netB = profitB - stakeA - feesB;
  
  // Already balanced
  if (Math.abs(netA - netB) < 0.01) {
    return null;
  }
  
  // Determine which side to bet on
  let betSide: 1 | 2;
  let betOdds: number | null;
  
  if (stakeA > 0 && stakeB === 0) {
    // Only have position on A, need to bet on B
    betSide = 2;
    betOdds = oddsB;
  } else if (stakeB > 0 && stakeA === 0) {
    // Only have position on B, need to bet on A
    betSide = 1;
    betOdds = oddsA;
  } else if (netA > netB) {
    // Net A is higher, need to increase net B by betting on B
    betSide = 2;
    betOdds = oddsB;
  } else {
    // Net B is higher, need to increase net A by betting on A
    betSide = 1;
    betOdds = oddsA;
  }
  
  if (!betOdds) return null;
  
  return calculateEqualization(positions, betSide, betOdds, feeAdapter);
}

/**
 * Calculate stake needed to reach a target profit on both sides
 * 
 * Exact formula with fees:
 * For side X: Δ = (T - netX_current) / ((dX-1) - fee_rate_on_winnings)
 * 
 * @param positions - Array of current positions
 * @param targetProfit - Target profit for both sides
 * @param oddsA - Odds for side A
 * @param oddsB - Odds for side B
 * @param feeAdapter - Fee structure for the new bet (optional)
 * @returns Stake needed on the weaker side to reach target profit
 */
export function calculateTargetProfit(
  positions: Position[],
  targetProfit: number,
  oddsA: number | null,
  oddsB: number | null,
  feeAdapter: FeeAdapter = NO_FEES
): TargetProfitResult | null {
  // Calculate current totals
  const stakeA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.stake, 0);
  const stakeB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.stake, 0);
  const profitA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.profit, 0);
  const profitB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.profit, 0);
  const feesA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + (p.fees || 0), 0);
  const feesB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + (p.fees || 0), 0);
  
  const netA = profitA - stakeB - feesA;
  const netB = profitB - stakeA - feesB;
  
  // Determine weaker side (side with lower net)
  let targetSide: 1 | 2;
  let targetOdds: number | null;
  let currentNet: number;
  
  if (netA < netB) {
    targetSide = 1;
    targetOdds = oddsA;
    currentNet = netA;
  } else {
    targetSide = 2;
    targetOdds = oddsB;
    currentNet = netB;
  }
  
  if (!targetOdds || !isFinite(targetOdds)) return null;
  
  // Convert to decimal odds
  const decimalOdds = americanToDecimal(targetOdds);
  const profitMultiplier = decimalOdds - 1;
  
  // Calculate denominator: (dX-1) - fee_rate_on_winnings - openFeeRate
  const denominator = profitMultiplier - feeAdapter.settleFeeRate - feeAdapter.openFeeRate;
  
  if (denominator <= 0) return null; // Fees too high
  
  // Δ = (T - netX_current) / denominator
  const targetStake = (targetProfit - currentNet) / denominator;
  
  if (targetStake < 0) return null; // Target already exceeded
  
  return {
    side: targetSide,
    stake: targetStake,
    targetProfit,
    odds: targetOdds
  };
}

/**
 * Calculate stake needed to achieve a specific coverage percentage
 * 
 * Coverage % sets the losing side net to: −(stake_on_that_side) * (1 - coveragePct)
 * Example: 80% coverage → the "losing" outcome net shall be ≥ −0.20 * stake_losing_side
 * 
 * @param positions - Array of current positions
 * @param coveragePercent - Coverage percentage (0-1, e.g., 0.8 for 80%)
 * @param oddsA - Odds for side A
 * @param oddsB - Odds for side B
 * @param feeAdapter - Fee structure for the new bet (optional)
 * @returns Stake needed on the weaker side to achieve coverage
 */
export function calculateCoverage(
  positions: Position[],
  coveragePercent: number,
  oddsA: number | null,
  oddsB: number | null,
  feeAdapter: FeeAdapter = NO_FEES
): CoverageResult | null {
  if (coveragePercent < 0 || coveragePercent > 1) return null;
  
  // Calculate current totals
  const stakeA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.stake, 0);
  const stakeB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.stake, 0);
  const profitA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.profit, 0);
  const profitB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.profit, 0);
  const feesA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + (p.fees || 0), 0);
  const feesB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + (p.fees || 0), 0);
  
  const netA = profitA - stakeB - feesA;
  const netB = profitB - stakeA - feesB;
  
  // Determine weaker side (side with lower net, the "losing" side)
  let targetSide: 1 | 2;
  let targetOdds: number | null;
  let losingSideStake: number;
  let targetNet: number;
  
  if (netA < netB) {
    // Side A is losing, bet on A to improve it
    targetSide = 1;
    targetOdds = oddsA;
    losingSideStake = stakeB; // Total stake we'd lose if A wins
    // Target: netA = -(stakeB) * (1 - coveragePercent)
    targetNet = -losingSideStake * (1 - coveragePercent);
  } else {
    // Side B is losing, bet on B to improve it
    targetSide = 2;
    targetOdds = oddsB;
    losingSideStake = stakeA; // Total stake we'd lose if B wins
    // Target: netB = -(stakeA) * (1 - coveragePercent)
    targetNet = -losingSideStake * (1 - coveragePercent);
  }
  
  if (!targetOdds || !isFinite(targetOdds)) return null;
  
  // Convert to decimal odds
  const decimalOdds = americanToDecimal(targetOdds);
  const profitMultiplier = decimalOdds - 1;
  
  // Calculate denominator: (dX-1) - fee_rate_on_winnings - openFeeRate
  const denominator = profitMultiplier - feeAdapter.settleFeeRate - feeAdapter.openFeeRate;
  
  if (denominator <= 0) return null; // Fees too high
  
  // Current net of the losing side
  const currentNet = targetSide === 1 ? netA : netB;
  
  // Δ = (targetNet - currentNet) / denominator
  const coverageStake = (targetNet - currentNet) / denominator;
  
  if (coverageStake < 0) return null; // Target already exceeded
  
  return {
    side: targetSide,
    stake: coverageStake,
    coveragePercent,
    odds: targetOdds
  };
}
