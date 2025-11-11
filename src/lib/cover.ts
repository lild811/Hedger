/**
 * Cover calculation library for Fast Hedger v2.3
 * Provides accurate math for equalizing bets and covering positions
 */

import { profitPerDollar, americanToDecimal } from './odds';

export interface Position {
  side: 1 | 2;
  stake: number;
  profit: number;
  odds: number | null;
}

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

/**
 * Calculate stake needed to cover a position to zero on one side
 * "Cover A = 0" means: bet on A so that if A wins, net = 0
 * "Cover B = 0" means: bet on B so that if B wins, net = 0
 * 
 * @param positions - Array of current positions
 * @param coverSide - Which side to add a bet on (1 or 2)
 * @param odds - Odds for the cover bet
 * @returns Stake needed to make net = 0 if that side wins
 */
export function calculateCover(
  positions: Position[],
  coverSide: 1 | 2,
  odds: number
): CoverResult | null {
  if (!odds || !isFinite(odds)) return null;
  
  // Calculate current totals
  const stakeA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.stake, 0);
  const stakeB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.stake, 0);
  const profitA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.profit, 0);
  const profitB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.profit, 0);
  
  const netA = profitA - stakeB;
  const netB = profitB - stakeA;
  
  const p = profitPerDollar(odds);
  if (p === null || p <= 0) return null;
  
  let coverStake: number;
  
  if (coverSide === 1) {
    // Covering by betting on side A
    // Goal: Make netA = 0 after adding this bet (if A wins)
    // netA is currently profitA - stakeB
    // After bet: netA_new = (profitA + coverStake * p) - stakeB = 0
    // coverStake = (stakeB - profitA) / p = -netA / p
    // Only cover if netA < 0 (we're currently losing if A wins)
    coverStake = netA < 0 ? Math.abs(netA) / p : 0;
  } else {
    // Covering by betting on side B
    // Goal: Make netB = 0 after adding this bet (if B wins)
    // netB is currently profitB - stakeA
    // After bet: netB_new = (profitB + coverStake * p) - stakeA = 0
    // coverStake = (stakeA - profitB) / p = -netB / p
    // Only cover if netB < 0 (we're currently losing if B wins)
    coverStake = netB < 0 ? Math.abs(netB) / p : 0;
  }
  
  // Calculate nets after cover
  const coverProfit = coverStake * p;
  let netAAfter: number, netBAfter: number;
  
  if (coverSide === 1) {
    netAAfter = (profitA + coverProfit) - stakeB;
    netBAfter = profitB - (stakeA + coverStake);
  } else {
    netAAfter = profitA - (stakeB + coverStake);
    netBAfter = (profitB + coverProfit) - stakeA;
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
 * Uses the correct formula that handles mixed odds:
 * Δ = (Profit_opposing + Stake_opposing - Profit_current - Stake_current) / decimal_odds
 * 
 * @param positions - Array of current positions
 * @param equalizeSide - Which side to add a bet on (1 or 2)
 * @param odds - Odds for the equalization bet (American)
 * @returns Stake needed to equalize both sides
 */
export function calculateEqualization(
  positions: Position[],
  equalizeSide: 1 | 2,
  odds: number
): EqualizationResult | null {
  if (!odds || !isFinite(odds)) return null;
  
  // Calculate current totals
  const stakeA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.stake, 0);
  const stakeB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.stake, 0);
  const profitA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.profit, 0);
  const profitB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.profit, 0);
  
  const netA = profitA - stakeB;
  const netB = profitB - stakeA;
  
  // Already balanced
  if (Math.abs(netA - netB) < 0.01) {
    return null;
  }
  
  // Convert American to decimal odds
  const decimalOdds = americanToDecimal(odds);
  
  let equalizeStake: number;
  let currentTotal: number;
  
  if (equalizeSide === 1) {
    // Betting on side A to equalize
    // Formula: Δ = (Profit_B + Stake_B - Profit_A - Stake_A) / decimal_odds
    equalizeStake = (profitB + stakeB - profitA - stakeA) / decimalOdds;
    currentTotal = stakeA;
  } else {
    // Betting on side B to equalize
    // Formula: Δ = (Profit_A + Stake_A - Profit_B - Stake_B) / decimal_odds
    equalizeStake = (profitA + stakeA - profitB - stakeB) / decimalOdds;
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
  oddsB: number | null
): EqualizationResult | null {
  // Calculate current totals
  const stakeA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.stake, 0);
  const stakeB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.stake, 0);
  const profitA = positions.filter(p => p.side === 1).reduce((sum, p) => sum + p.profit, 0);
  const profitB = positions.filter(p => p.side === 2).reduce((sum, p) => sum + p.profit, 0);
  
  const netA = profitA - stakeB;
  const netB = profitB - stakeA;
  
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
  
  return calculateEqualization(positions, betSide, betOdds);
}
