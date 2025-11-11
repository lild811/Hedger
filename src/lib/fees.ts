/**
 * Fee calculation library for Fast Hedger v2.3
 * Supports Kalshi and custom fee structures
 */

export interface FeeStructure {
  openFee: number;    // As decimal (e.g., 0.01 = 1%)
  settleFee: number;  // As decimal (e.g., 0.02 = 2%)
}

export interface KalshiLedger {
  contracts: number;      // Number of contracts purchased
  cost: number;           // Amount debited for contracts
  openFee: number;        // Fee charged at open (debited)
  settleFee: number;      // Fee charged at settlement (deducted from payout)
  netPayout: number;      // Actual payout if win (after settle fee)
  profit: number;         // Net profit if win
}

/**
 * Default Kalshi fee structure: 1% open + 2% settle
 */
export const DEFAULT_KALSHI_FEES: FeeStructure = {
  openFee: 0.01,
  settleFee: 0.02
};

/**
 * Round to 2 decimal places
 */
function r2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Calculate Kalshi actual settlement model
 * 
 * @param stake - Total stake/investment amount ($)
 * @param price - Contract price (0.01 to 0.99, decimal)
 * @param fOpen - Open fee as decimal (default 0.01 = 1%)
 * @param fSettle - Settlement fee as decimal (default 0.02 = 2%)
 * @returns Complete ledger of transaction
 */
export function kalshiLedger(
  stake: number,
  price: number,
  fOpen: number = DEFAULT_KALSHI_FEES.openFee,
  fSettle: number = DEFAULT_KALSHI_FEES.settleFee
): KalshiLedger {
  // Validate price to avoid division by zero and out-of-range values
  if (price <= 0 || price >= 1) {
    throw new Error('Invalid Kalshi price: must be between 0.01 and 0.99');
  }
  
  // Number of contracts = floor(stake / price)
  const contracts = Math.floor(stake / price);
  
  // Cost = contracts * price (amount debited from account)
  const cost = r2(contracts * price);
  
  // Open fee = cost * openFeeRate (debited at purchase)
  const openFee = r2(cost * fOpen);
  
  // Settlement fee = contracts * settleFeeRate (deducted from payout if win)
  const settleFee = r2(contracts * fSettle);
  
  // Net payout = contracts - settleFee (what you actually receive if win)
  const netPayout = r2(contracts - settleFee);
  
  // Profit = netPayout - (cost + openFee)
  const profit = r2(netPayout - (cost + openFee));
  
  return {
    contracts,
    cost,
    openFee,
    settleFee,
    netPayout,
    profit
  };
}

/**
 * Calculate effective American odds after Kalshi fees
 * This shows what the true odds are after fees are accounted for
 */
export function kalshiEffectiveOdds(price: number, fees: FeeStructure = DEFAULT_KALSHI_FEES): number {
  // Use a standard stake to calculate effective odds
  const stake = 100;
  const ledger = kalshiLedger(stake, price, fees.openFee, fees.settleFee);
  
  // Calculate profit ratio
  const totalInvested = ledger.cost + ledger.openFee;
  const profitRatio = ledger.profit / totalInvested;
  
  // Validate profit ratio
  if (profitRatio <= 0) {
    throw new Error('Invalid profit ratio for odds calculation: must be positive');
  }
  
  // Convert to American odds
  if (profitRatio >= 1) {
    return Math.round(profitRatio * 100);
  } else {
    return Math.round(-100 / profitRatio);
  }
}

/**
 * Apply custom fee structure to a standard profit calculation
 */
export function applyCustomFees(
  stake: number,
  profit: number,
  fees: FeeStructure
): { netProfit: number; totalFees: number } {
  const openFee = r2(stake * fees.openFee);
  const payout = stake + profit;
  const settleFee = r2(payout * fees.settleFee);
  const totalFees = r2(openFee + settleFee);
  const netProfit = r2(profit - totalFees);
  
  return { netProfit, totalFees };
}
