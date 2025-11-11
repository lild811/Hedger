/**
 * Fee calculation library for Fast Hedger v2.3/v2.4
 * Supports ProphetX, Kalshi, and custom fee structures
 */

/**
 * Unified fee result returned by all fee adapters
 */
export interface FeeResult {
  payout: number;              // Total payout if win
  profitBeforeFees: number;    // Gross profit before any fees
  feesBreakdown: {
    openFee?: number;          // Fee at open (if applicable)
    settleFee?: number;        // Fee at settlement (if applicable)
    winFee?: number;           // Fee on winnings (if applicable)
    total: number;             // Total fees charged
  };
  netProfit: number;           // Net profit after all fees
}

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

/**
 * Unified fee adapters that return standardized FeeResult
 */

/**
 * No fees adapter (standard sportsbooks)
 */
export function applyNoFees(stake: number, profitBeforeFees: number): FeeResult {
  return {
    payout: r2(stake + profitBeforeFees),
    profitBeforeFees: r2(profitBeforeFees),
    feesBreakdown: {
      total: 0
    },
    netProfit: r2(profitBeforeFees)
  };
}

/**
 * ProphetX fee adapter
 * PX! = 1% fee on winnings only (if profitable)
 * PX = 0% fee (same as no fees)
 */
export function applyProphetXFee(
  stake: number,
  profitBeforeFees: number,
  sportsbook?: string
): FeeResult {
  if (!sportsbook) {
    return applyNoFees(stake, profitBeforeFees);
  }
  
  const book = sportsbook.trim().toUpperCase();
  
  if (book === 'PX!') {
    // 1% fee on winnings (only if profit > 0)
    if (profitBeforeFees > 0) {
      const winFee = r2(profitBeforeFees * 0.01);
      const netProfit = r2(profitBeforeFees - winFee);
      return {
        payout: r2(stake + netProfit),
        profitBeforeFees: r2(profitBeforeFees),
        feesBreakdown: {
          winFee,
          total: winFee
        },
        netProfit
      };
    }
  }
  
  // PX or other = no fees
  return applyNoFees(stake, profitBeforeFees);
}

/**
 * Kalshi fee adapter for YES contracts
 * Open fee on stake, settle fee on gross payout (contracts)
 */
export function applyKalshiYesFees(
  stake: number,
  price: number,
  fOpen: number = DEFAULT_KALSHI_FEES.openFee,
  fSettle: number = DEFAULT_KALSHI_FEES.settleFee
): FeeResult {
  const ledger = kalshiLedger(stake, price, fOpen, fSettle);
  
  return {
    payout: ledger.netPayout,
    profitBeforeFees: r2(ledger.contracts - ledger.cost),
    feesBreakdown: {
      openFee: ledger.openFee,
      settleFee: ledger.settleFee,
      total: r2(ledger.openFee + ledger.settleFee)
    },
    netProfit: ledger.profit
  };
}

/**
 * Kalshi fee adapter for NO contracts
 * Open fee on stake, settle fee on gross payout (price * contracts)
 */
export function applyKalshiNoFees(
  stake: number,
  price: number,
  fOpen: number = DEFAULT_KALSHI_FEES.openFee,
  fSettle: number = DEFAULT_KALSHI_FEES.settleFee
): FeeResult {
  // For NO contracts, the price represents the YES price
  // NO price = 1 - YES price
  const noPrice = 1 - price;
  
  // Calculate contracts and costs similar to YES
  const contracts = Math.floor(stake / noPrice);
  const cost = r2(contracts * noPrice);
  const openFee = r2(cost * fOpen);
  
  // Gross profit = price * contracts (what you get if NO wins)
  const grossProfit = r2(price * contracts);
  
  // Settlement fee on gross profit
  const settleFee = r2(grossProfit * fSettle);
  
  // Net payout = gross profit - settle fee
  const netPayout = r2(grossProfit - settleFee);
  
  // Net profit = net payout - (cost + open fee)
  const netProfit = r2(netPayout - (cost + openFee));
  
  return {
    payout: netPayout,
    profitBeforeFees: grossProfit,
    feesBreakdown: {
      openFee,
      settleFee,
      total: r2(openFee + settleFee)
    },
    netProfit
  };
}

/**
 * Custom fee adapter
 * Allows specifying openFeePct and winFeePct
 */
export function applyCustomFeesUnified(
  stake: number,
  profitBeforeFees: number,
  openFeePct: number,
  winFeePct: number
): FeeResult {
  const openFee = r2(stake * openFeePct);
  const winFee = profitBeforeFees > 0 ? r2(profitBeforeFees * winFeePct) : 0;
  const totalFees = r2(openFee + winFee);
  const netProfit = r2(profitBeforeFees - totalFees);
  
  return {
    payout: r2(stake + netProfit),
    profitBeforeFees: r2(profitBeforeFees),
    feesBreakdown: {
      openFee,
      winFee,
      total: totalFees
    },
    netProfit
  };
}
