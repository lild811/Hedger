/**
 * State management for undo/redo and persistence
 */

export interface WagerRow {
  side: 1 | 2;
  sportsbook?: string;
  odds: string;
  stake: number;
  payout?: number;
  feeMarker?: string; // 'PX!' or 'PX' or empty
}

export interface AppState {
  rows: WagerRow[];
  kalshiMode: boolean;
  lineA?: string;
  lineB?: string;
  labelA?: string;
  labelB?: string;
}

export class StateManager {
  private history: AppState[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;

  constructor() {
    this.loadFromSession();
  }

  /**
   * Save current state to history
   */
  saveState(state: AppState): void {
    // Remove any states after current index (we're creating a new branch)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Add new state
    this.history.push(JSON.parse(JSON.stringify(state)));
    this.currentIndex++;
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
    
    // Save to session storage
    this.saveToSession(state);
  }

  /**
   * Undo to previous state
   */
  undo(): AppState | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
    }
    return null;
  }

  /**
   * Redo to next state
   */
  redo(): AppState | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
    }
    return null;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Save to session storage
   */
  private saveToSession(state: AppState): void {
    try {
      sessionStorage.setItem('hedger_state', JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save to session storage:', e);
    }
  }

  /**
   * Load from session storage
   */
  private loadFromSession(): void {
    try {
      const saved = sessionStorage.getItem('hedger_state');
      if (saved) {
        const state = JSON.parse(saved);
        this.history = [state];
        this.currentIndex = 0;
      }
    } catch (e) {
      console.error('Failed to load from session storage:', e);
    }
  }

  /**
   * Get current state
   */
  getCurrentState(): AppState | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
    }
    return null;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    sessionStorage.removeItem('hedger_state');
  }
}

/**
 * CSV Export/Import utilities
 */
export function exportToCSV(rows: WagerRow[]): string {
  const headers = ['side', 'sportsbook', 'oddsType', 'oddsValue', 'stake', 'payout', 'feeMarker'];
  const csvRows = [headers.join(',')];
  
  rows.forEach(row => {
    // Determine odds type from value
    let oddsType = 'american';
    const odds = row.odds.toLowerCase();
    if (odds.endsWith('c') || odds.endsWith('k')) {
      oddsType = 'kalshi';
    } else if (odds.includes('/')) {
      oddsType = 'fractional';
    } else if (odds.includes('.') && parseFloat(odds) >= 1) {
      oddsType = 'decimal';
    } else if (odds.endsWith('%')) {
      oddsType = 'percent';
    }
    
    const values = [
      row.side,
      row.sportsbook || '',
      oddsType,
      row.odds,
      row.stake,
      row.payout || '',
      row.feeMarker || ''
    ];
    
    csvRows.push(values.map(v => `"${v}"`).join(','));
  });
  
  return csvRows.join('\n');
}

/**
 * Import from CSV
 */
export function importFromCSV(csv: string): WagerRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  
  const rows: WagerRow[] = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple CSV parsing (handles quoted fields)
    const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
    const clean = values.map(v => v.replace(/^"|"$/g, '').trim());
    
    if (clean.length >= 4) {
      rows.push({
        side: parseInt(clean[0]) as 1 | 2,
        sportsbook: clean[1] || undefined,
        odds: clean[3], // oddsValue
        stake: parseFloat(clean[4]) || 0,
        payout: clean[5] ? parseFloat(clean[5]) : undefined,
        feeMarker: clean[6] || undefined
      });
    }
  }
  
  return rows;
}
