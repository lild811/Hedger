# Copilot Instructions for Hedger

## Project Overview
Hedger is a Sports Arbitrage Hedging Tool built with TypeScript and vanilla JavaScript. It helps users calculate optimal hedge bets across different sportsbooks to guarantee profit regardless of outcome.

## Project Structure
- `src/lib/` - Core library code (TypeScript)
  - `odds.ts` - Odds conversion utilities (American to Decimal)
- `tests/unit/` - Unit tests using vitest
- `tests/e2e/` - End-to-end tests using Playwright
- `index.html` - Main application interface (standalone HTML with inline JavaScript)

## Development Guidelines

### Code Style
- Use TypeScript for library code in `src/lib/`
- Write clear, focused functions with single responsibilities
- Include proper error handling for invalid inputs
- Use descriptive variable names (e.g., `americanOdds`, `decimalOdds`)

### Testing
- **Unit Tests**: Use vitest for testing library functions
  - Run with: `npm run test`
  - Place tests in `tests/unit/` with `.spec.ts` extension
  - Use `describe()` and `it()` blocks for test organization
  - Use `toBeCloseTo()` for floating-point comparisons
- **E2E Tests**: Use Playwright for UI testing
  - Run with: `npm run test:e2e`
  - Place tests in `tests/e2e/` with `.spec.ts` extension
  - Tests run against a local http-server on port 5173
- **CI**: Run both test suites with `npm run ci`

### Making Changes
1. **Before coding**: Run existing tests to understand current state
2. **Write tests first**: Add tests for new functionality before implementation
3. **Minimal changes**: Make the smallest possible changes to achieve the goal
4. **Test frequently**: Run tests after each change
5. **No unrelated fixes**: Don't fix unrelated bugs or tests

### Common Tasks
- Adding new odds conversion functions: Add to `src/lib/odds.ts` with unit tests
- Modifying UI calculations: Edit `index.html` (inline JavaScript section)
- Adding new test cases: Follow existing test patterns in `tests/unit/` or `tests/e2e/`

### Dependencies
- vitest: Unit testing framework
- @playwright/test: E2E testing framework
- No build step required - TypeScript is compiled on-the-fly for tests

### Important Notes
- This is a client-side only application (no backend)
- All calculations happen in the browser
- The application uses vanilla JavaScript in HTML for the UI
- Keep the application simple and focused on arbitrage calculations
