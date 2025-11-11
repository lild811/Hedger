import { describe, it, expect } from 'vitest';
import {
  calculateCover,
  calculateEqualization,
  autoEqualize,
  type Position
} from '../../src/lib/cover';

describe('calculateCover', () => {
  it('calculates cover to zero net on side A', () => {
    // Position on B: if A wins, net = -100
    const positions: Position[] = [
      { side: 2, stake: 100, profit: 100, odds: 100 }
    ];
    
    // Net A = 0 - 100 = -100 (losing if A wins)
    // Cover by betting on A to make net A = 0
    // Need profit of 100, with +100 odds (1:1), need stake 100
    const result = calculateCover(positions, 1, 100);
    
    expect(result).not.toBeNull();
    expect(result!.side).toBe(1);
    expect(result!.stake).toBeCloseTo(100, 2);
    expect(result!.netAfterCover.sideA).toBeCloseTo(0, 2);
  });
  
  it('calculates cover to zero net on side B', () => {
    // Position on A: if B wins, net = -100
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 100, odds: 100 }
    ];
    
    // Net B = 0 - 100 = -100 (losing if B wins)
    // Cover by betting on B to make net B = 0
    const result = calculateCover(positions, 2, 100);
    
    expect(result).not.toBeNull();
    expect(result!.side).toBe(2);
    expect(result!.stake).toBeCloseTo(100, 2);
    expect(result!.netAfterCover.sideB).toBeCloseTo(0, 2);
  });
  
  it('handles positions with mixed odds', () => {
    const positions: Position[] = [
      { side: 2, stake: 100, profit: 50, odds: -200 },
      { side: 2, stake: 50, profit: 100, odds: 200 }
    ];
    
    // Total on B: stake 150, profit 150
    // Net A = 0 - 150 = -150 (losing if A wins)
    // To cover A to 0, need profit of 150 on A
    // With +100 odds (1:1), need stake 150
    const result = calculateCover(positions, 1, 100);
    
    expect(result).not.toBeNull();
    expect(result!.side).toBe(1);
    expect(result!.stake).toBeCloseTo(150, 2);
    expect(result!.netAfterCover.sideA).toBeCloseTo(0, 2);
  });
  
  it('returns null for invalid odds', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 100, odds: 100 }
    ];
    
    expect(calculateCover(positions, 1, NaN)).toBeNull();
    expect(calculateCover(positions, 1, 0)).toBeNull();
  });
  
  it('returns zero stake when side is already winning', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 200, odds: 200 },
      { side: 2, stake: 50, profit: 50, odds: 100 }
    ];
    
    // Net A = 200 - 50 = 150 (winning if A wins, no need to cover)
    const result = calculateCover(positions, 1, 100);
    
    expect(result).not.toBeNull();
    expect(result!.stake).toBe(0);
  });
});

describe('calculateEqualization', () => {
  it('equalizes simple position with even money odds', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 100, odds: 100 }
    ];
    
    // Net A = 100, Net B = -100
    // To equalize, bet on B
    const result = calculateEqualization(positions, 2, 100);
    
    expect(result).not.toBeNull();
    expect(result!.side).toBe(2);
    // With decimal odds 2.0: Δ = (100 + 100 - 0 - 0) / 2 = 100
    expect(result!.stake).toBeCloseTo(100, 2);
    expect(result!.targetTotal).toBeCloseTo(100, 2);
  });
  
  it('equalizes with positive American odds', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 100, odds: 100 }
    ];
    
    // Bet on B with +200 odds (3.0 decimal)
    const result = calculateEqualization(positions, 2, 200);
    
    expect(result).not.toBeNull();
    expect(result!.side).toBe(2);
    // Δ = (100 + 100 - 0 - 0) / 3 = 66.67
    expect(result!.stake).toBeCloseTo(66.67, 2);
  });
  
  it('equalizes with negative American odds', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 100, odds: 100 }
    ];
    
    // Bet on B with -200 odds (1.5 decimal)
    const result = calculateEqualization(positions, 2, -200);
    
    expect(result).not.toBeNull();
    expect(result!.side).toBe(2);
    // Δ = (100 + 100 - 0 - 0) / 1.5 = 133.33
    expect(result!.stake).toBeCloseTo(133.33, 2);
  });
  
  it('handles mixed odds correctly', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 50, odds: -200 },
      { side: 2, stake: 50, profit: 100, odds: 200 }
    ];
    
    // Net A = 50 - 50 = 0, Net B = 100 - 100 = 0
    // Already equalized
    const result = calculateEqualization(positions, 1, 100);
    
    expect(result).toBeNull();
  });
  
  it('returns null when already balanced', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 100, odds: 100 },
      { side: 2, stake: 100, profit: 100, odds: 100 }
    ];
    
    const result = calculateEqualization(positions, 1, 100);
    expect(result).toBeNull();
  });
  
  it('returns null for invalid odds', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 100, odds: 100 }
    ];
    
    expect(calculateEqualization(positions, 2, NaN)).toBeNull();
  });
});

describe('autoEqualize', () => {
  it('chooses side B when only position on A', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 100, odds: 100 }
    ];
    
    const result = autoEqualize(positions, 100, 100);
    
    expect(result).not.toBeNull();
    expect(result!.side).toBe(2);
    expect(result!.stake).toBeCloseTo(100, 2);
  });
  
  it('chooses side A when only position on B', () => {
    const positions: Position[] = [
      { side: 2, stake: 100, profit: 100, odds: 100 }
    ];
    
    const result = autoEqualize(positions, 100, 100);
    
    expect(result).not.toBeNull();
    expect(result!.side).toBe(1);
    expect(result!.stake).toBeCloseTo(100, 2);
  });
  
  it('chooses side with lower net when both have positions', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 200, odds: 200 },
      { side: 2, stake: 50, profit: 50, odds: 100 }
    ];
    
    // Net A = 200 - 50 = 150
    // Net B = 50 - 100 = -50
    // Need to bet on B to raise net B
    const result = autoEqualize(positions, 100, 100);
    
    expect(result).not.toBeNull();
    expect(result!.side).toBe(2);
  });
  
  it('returns null when no odds available', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 100, odds: 100 }
    ];
    
    const result = autoEqualize(positions, 100, null);
    expect(result).toBeNull();
  });
  
  it('returns null when already balanced', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 100, odds: 100 },
      { side: 2, stake: 100, profit: 100, odds: 100 }
    ];
    
    const result = autoEqualize(positions, 100, 100);
    expect(result).toBeNull();
  });
  
  it('uses available odds for the determined side', () => {
    const positions: Position[] = [
      { side: 1, stake: 100, profit: 100, odds: 100 }
    ];
    
    // Only have odds for side B
    const result = autoEqualize(positions, null, 200);
    
    expect(result).not.toBeNull();
    expect(result!.side).toBe(2);
    expect(result!.odds).toBe(200);
  });
});
