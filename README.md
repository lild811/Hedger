# Hedger
Sports Arbitrage Hedging Tool

Fast Hedger v2.3+ with integrated ProphetX fee handling and optional Kalshi support.

## Features

- **Multi-format odds parsing**: American (±100+), Decimal (1.01+), Kalshi (0.01-0.99, 1-99c), Percent (1-99%), Fractional (e.g., 5/2)
- **ProphetX fee handling**: Manual fee marker system via sportsbook field
- **Kalshi integration**: Optional per-row Kalshi fee calculation with accurate settlement modeling
- **Smart equalization**: Auto-calculate balanced hedges across multiple wagers
- **Cover calculations**: Break-even scenarios for each side
- **Unified analytics**: Real-time profit/loss analysis per outcome

## ProphetX Fee System

ProphetX fees are applied via the **sportsbook field marker system**:

### Fee Markers

- **`PX!`** = 1% fee on **winnings only** (profit, not stake)
  - Example: $100 profit → $99 net profit after fee
  - Fee only applies to positive profits (no fee on losses)
  - Case-insensitive: `px!`, `Px!`, `PX!` all work

- **`PX`** or any other value = 0% fee (standard payout)
  - Example: $100 profit → $100 net profit
  - Default behavior for all non-PX! sportsbooks

### Examples

```
Sportsbook: PX!
Stake: $100
Odds: +200 (3.00 decimal)
Gross Profit: $200
ProphetX Fee (1%): $2
Net Profit: $198
```

```
Sportsbook: PX (or DraftKings, FanDuel, etc.)
Stake: $100
Odds: +200
Gross Profit: $200
Fee: $0
Net Profit: $200
```

### Important Notes

- Fee is calculated **after** base profit calculation
- Fee applies to the **final profit amount**, not the stake
- Negative profits (losses) are **not** subject to fees
- ProphetX fee is **independent** of Kalshi fees (they don't stack on the same wager)

## Kalshi Integration

Kalshi support is **optional** and enabled **per-row** via the Type dropdown. Default is **Normal** mode, which rejects Kalshi-specific formats to prevent accidental errors.

### Row Types

1. **Normal** (default)
   - Standard American/Decimal/Percent/Fractional odds
   - Rejects Kalshi formats (cents notation, 0.xx prices, 1-99 integers)
   - No Kalshi fees applied
   - Best for traditional sportsbooks

2. **Kalshi YES**
   - Accepts Kalshi-specific formats (1-99c, 0.01-0.99, 1-99 integers)
   - Applies Kalshi fee structure: 1% open + 2% settle
   - Uses Kalshi contract settlement model
   - Bet wins if event happens (YES outcome)

3. **Kalshi NO**
   - Same as Kalshi YES but for NO side bets
   - Accepts Kalshi formats
   - Applies Kalshi fees
   - Bet wins if event doesn't happen (NO outcome)

### Kalshi Fee Model

Kalshi uses a unique fee structure different from traditional sportsbooks:

- **Open Fee**: 1% of cost (debited at purchase)
- **Settlement Fee**: 2% of contracts (deducted from payout if win)

#### Fee Calculation Example

```
Price: 50c ($0.50)
Stake: $100
Contracts: floor(100 / 0.50) = 200

Cost: 200 × $0.50 = $100.00
Open Fee: $100 × 1% = $1.00 (debited immediately)
Total Debited: $101.00

If Win:
  Gross Payout: 200 contracts × $1.00 = $200.00
  Settlement Fee: 200 × 2% = $4.00 (deducted from payout)
  Net Payout: $200 - $4 = $196.00
  Total Profit: $196 - $101 = $95.00
  
Effective Odds: Less favorable than nominal odds due to fees
```

### Kalshi Format Examples

All of these are equivalent to 50c (even money):
- `50c` or `50k` (cents notation)
- `0.50` or `.50` or `.5` (price notation)
- `50` (integer 1-99, interpreted as Kalshi cents)

These formats are **only accepted** in Kalshi YES/NO rows.

### Default Behavior

- **New rows default to Normal type**
- Kalshi formats will show error in Normal rows
- Prevents accidental Kalshi entry in standard wagers
- Explicit opt-in required via Type dropdown

### When to Use Each Type

**Use Normal for:**
- Traditional sportsbooks (DraftKings, FanDuel, Bet365, etc.)
- ProphetX bets
- Any non-Kalshi market

**Use Kalshi YES/NO for:**
- Kalshi prediction market contracts
- When you need accurate Kalshi fee modeling
- Binary outcome events on Kalshi platform

## Usage

1. **Add Wagers**: Click "+ Add Wager" or press Ctrl+Enter
2. **Enter Details**:
   - Side: 1 or 2 (or A/B)
   - Type: Normal (default), Kalshi YES, or Kalshi NO
   - Sportsbook: Enter `PX!` for 1% ProphetX fee, or leave blank/enter other name
   - Odds: Any supported format (American, Decimal, Kalshi, etc.)
   - Stake: Amount wagered
3. **Analyze**: View unified analytics showing net outcome for each side
4. **Equalize**: Ghost row auto-suggests hedge to balance outcomes

## Testing

```bash
npm install
npm test        # Run unit tests
npm run test:e2e  # Run end-to-end tests
```

## Technical Implementation

### ProphetX Fee Function

```javascript
function applyProphetXFee(profit, sportsbook) {
  if (!sportsbook) return profit;
  const book = sportsbook.trim().toUpperCase();
  if (book === 'PX!') {
    return profit > 0 ? profit * 0.99 : profit;
  }
  return profit;
}
```

### Kalshi Ledger Function

```javascript
function kalshiLedger(stake, price, fOpen=0.01, fSettle=0.02) {
  const contracts = Math.floor(stake / price);
  const cost = contracts * price;
  const openFee = cost * fOpen;
  const settleFee = contracts * fSettle;
  const netPayout = contracts - settleFee;
  const profit = netPayout - (cost + openFee);
  return { contracts, cost, openFee, settleFee, netPayout, profit };
}
```

## Version History

- **v2.3+**: Integrated ProphetX fee markers and Kalshi per-row support
- **v2.2**: Unified analytics edition
- **v2.1**: Cover & equalize features
