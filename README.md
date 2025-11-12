# Hedger

**Sports Arbitrage Hedging Tool** – Session Summary Edition

Fast Hedger v2.4 with integrated ProphetX fee handling and optional Kalshi support.

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]() [![Version](https://img.shields.io/badge/version-2.4-blue)]()

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [ProphetX Fee System](#prophetx-fee-system)
- [Kalshi Integration](#kalshi-integration)
- [Testing](#testing)
- [Technical Implementation](#technical-implementation)
- [Version History](#version-history)

## Features

- **Multi-format odds parsing**: American (±100+), Decimal (1.01+), Kalshi (0.01-0.99, 1-99c), Percent (1-99%), Fractional (e.g., 5/2)
- **ProphetX fee handling**: Manual fee marker system via sportsbook field (`PX!` for 1% fee on winnings)
- **Kalshi integration**: Optional per-row Kalshi fee calculation with accurate settlement modeling (1% open + 2% settle)
- **Smart equalization**: Auto-calculate balanced hedges across multiple wagers with ghost row suggestions
- **Cover calculations**: Break-even scenarios for each side (Cover A = 0, Cover B = 0)
- **Unified analytics**: Real-time profit/loss analysis per outcome with effective odds and breakeven percentages
- **Session summary**: Quick overview of total stake, net outcomes, exposure, books count, and hold percentage
- **Row copying**: Duplicate existing wagers with a single click
- **Undo/Redo**: Full history tracking with Ctrl+Z/Ctrl+Y support
- **CSV Import/Export**: Save and load your wagers for later analysis

## ProphetX Fee System

ProphetX fees are automatically applied using the **sportsbook field marker** system. Simply enter the marker in the sportsbook field when adding a wager.

### Fee Markers

| Marker | Fee | Applied To | Example |
|--------|-----|------------|---------|
| **`PX!`** | 1% | Winnings only (profit, not stake) | $100 profit → $99 net profit |
| `PX` or other | 0% | None | $100 profit → $100 net profit |

**Note**: The marker is case-insensitive (`px!`, `Px!`, `PX!` all work)

### Example Calculation

**With ProphetX Fee (PX!):**
```
Sportsbook: PX!
Stake: $100
Odds: +200 (3.00 decimal)
Gross Profit: $200
ProphetX Fee (1%): $2
Net Profit: $198
```

**Without Fee (PX or other):**
```
Sportsbook: DraftKings (or PX, FanDuel, etc.)
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

Kalshi support is **optional** and enabled **per-row** via the Type dropdown. This prevents accidental entry of Kalshi-specific formats on traditional sportsbook wagers.

### Row Types

| Type | Use Case | Accepts Kalshi Formats | Fees Applied |
|------|----------|------------------------|--------------|
| **Normal** (default) | Traditional sportsbooks | ❌ No | None (unless PX!) |
| **Kalshi YES** | Kalshi prediction markets (YES side) | ✅ Yes | 1% open + 2% settle |
| **Kalshi NO** | Kalshi prediction markets (NO side) | ✅ Yes | 1% open + 2% settle |
| **Custom** | Custom fee structure | ✅ Yes | User-defined % |

**Default behavior**: New rows default to Normal type, which rejects Kalshi formats to prevent errors.

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

Kalshi uses cents notation. All of these are equivalent to 50¢ (even money):

- `50c` or `50k` (cents notation with suffix)
- `0.50` or `.50` or `.5` (decimal price notation)
- `50` (integer 1-99, interpreted as Kalshi cents)

**Note**: These formats are only accepted in Kalshi YES/NO rows. Normal rows will reject them to prevent errors.

### When to Use Each Type

**Use Normal for:**
- DraftKings, FanDuel, Bet365, Caesars
- ProphetX bets (use `PX!` marker)
- Any traditional sportsbook

**Use Kalshi YES/NO for:**
- Kalshi prediction market contracts
- When you need accurate Kalshi fee modeling (1% open + 2% settle)
- Binary outcome events on the Kalshi platform

## Usage

### Quick Start

1. **Add Wagers**: Click "+ Add Wager" or press Ctrl+Enter
2. **Enter Details**:
   - **Side**: Enter `1` or `2` (also accepts A/B)
   - **Type**: Choose row type:
     - `Normal` (default) - for traditional sportsbooks
     - `Kalshi YES` - for Kalshi prediction markets (YES side)
     - `Kalshi NO` - for Kalshi prediction markets (NO side)
     - `Custom...` - set your own open/win fee percentages
   - **Sportsbook**: Enter book name
     - Use `PX!` for ProphetX with 1% fee on winnings
     - Any other value = 0% fee
   - **Odds**: Enter in any supported format
   - **Stake**: Amount you're wagering
   - **Payout** (optional): Auto-calculated from odds, or enter manually to derive implied odds
3. **Analyze**: View unified analytics showing net outcome for each side
4. **Equalize**: Ghost row auto-suggests hedge to balance outcomes
5. **Copy Rows**: Use the ⧉ button to duplicate any wager

### Keyboard Shortcuts

- **Ctrl+Enter** - Add new wager row
- **Ctrl+Z** - Undo last change
- **Ctrl+Y** - Redo
- **Enter** - Navigate to next field (Side → Odds → Stake → Payout → Next row)
- **1/2** - Quick side selection when focused on Side field

## Getting Started

### Installation

No installation required! Open `index.html` in your web browser to start using Hedger.

For development and testing:

```bash
npm install
npm test        # Run unit tests
npm run test:e2e  # Run end-to-end tests
```

### First Steps

1. Open `index.html` in a modern web browser (Chrome, Firefox, Safari, Edge)
2. Add your first wager by clicking "+ Add Wager" or pressing Ctrl+Enter
3. Fill in the wager details (side, odds, stake)
4. Add more wagers to see real-time analytics and equalization suggestions
5. Use the ghost row (blue border) to quickly add a balancing wager

## Testing

Run the test suite to verify functionality:

```bash
npm install       # Install dependencies
npm test          # Run unit tests with Vitest
npm run test:e2e  # Run end-to-end browser tests with Playwright
npm run ci        # Run all tests (CI pipeline)
```

## Technical Implementation

### Key Functions

#### ProphetX Fee Function

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

- **v2.4** (2024): Session Summary Edition
  - Added session summary strip with total stake, net outcomes, exposure, books, and hold %
  - Added row copy functionality (⧉ button)
  - Enhanced tooltips with formulas for equalize and cover calculations
  - Improved mobile/compact mode responsiveness
  - Better effective odds and breakeven probability displays
- **v2.3**: Integrated ProphetX fee markers and Kalshi per-row support
  - Per-row type selection (Normal, Kalshi YES/NO, Custom)
  - ProphetX fee handling via `PX!` sportsbook marker
  - Kalshi fee calculation with accurate settlement modeling
- **v2.2**: Unified analytics edition
  - Combined position analysis with totals
  - Real-time profit/loss per outcome
- **v2.1**: Cover & equalize features
  - Ghost row equalization suggestions
  - Break-even cover calculations
