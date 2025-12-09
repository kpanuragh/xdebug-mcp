/**
 * Step Filter
 * Manages step filtering to skip vendor/library code during debugging.
 */

import { logger } from '../utils/logger.js';

export interface StepFilterRule {
  id: string;
  pattern: string;
  type: 'include' | 'exclude';
  enabled: boolean;
  description?: string;
}

export interface FunctionCallEntry {
  timestamp: Date;
  name: string;
  file: string;
  line: number;
  depth: number;
  args?: string[];
}

export class StepFilter {
  private rules: Map<string, StepFilterRule> = new Map();
  private ruleIdCounter: number = 0;
  private functionHistory: FunctionCallEntry[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    // Add default rules for common vendor directories
    this.addRule('/vendor/', 'exclude', 'Skip Composer vendor directory');
    this.addRule('/node_modules/', 'exclude', 'Skip Node modules');
  }

  /**
   * Add a step filter rule
   */
  addRule(
    pattern: string,
    type: 'include' | 'exclude',
    description?: string
  ): StepFilterRule {
    const id = `filter_${++this.ruleIdCounter}`;
    const rule: StepFilterRule = {
      id,
      pattern,
      type,
      enabled: true,
      description,
    };
    this.rules.set(id, rule);
    logger.debug(`Step filter rule added: ${id} - ${type} ${pattern}`);
    return rule;
  }

  /**
   * Remove a rule
   */
  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(id: string, enabled: boolean): boolean {
    const rule = this.rules.get(id);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Get all rules
   */
  getAllRules(): StepFilterRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Check if a file should be skipped during stepping
   */
  shouldSkip(filePath: string): boolean {
    const enabledRules = Array.from(this.rules.values()).filter((r) => r.enabled);

    // Check exclude rules first
    for (const rule of enabledRules) {
      if (rule.type === 'exclude' && this.matchesPattern(filePath, rule.pattern)) {
        // Check if any include rule overrides
        const hasIncludeOverride = enabledRules.some(
          (r) => r.type === 'include' && this.matchesPattern(filePath, r.pattern)
        );
        if (!hasIncludeOverride) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a path matches a pattern
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Simple substring matching
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      // It's a regex pattern
      try {
        const regex = new RegExp(pattern.slice(1, -1));
        return regex.test(path);
      } catch {
        return path.includes(pattern);
      }
    }

    // Glob-like matching
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      return new RegExp(regexPattern).test(path);
    }

    // Simple substring match
    return path.includes(pattern);
  }

  /**
   * Record a function call in history
   */
  recordFunctionCall(entry: Omit<FunctionCallEntry, 'timestamp'>): void {
    this.functionHistory.push({
      ...entry,
      timestamp: new Date(),
    });

    // Trim history if too large
    if (this.functionHistory.length > this.maxHistorySize) {
      this.functionHistory = this.functionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get function call history
   */
  getFunctionHistory(limit?: number): FunctionCallEntry[] {
    if (limit) {
      return this.functionHistory.slice(-limit);
    }
    return [...this.functionHistory];
  }

  /**
   * Clear function history
   */
  clearHistory(): void {
    this.functionHistory = [];
  }

  /**
   * Search function history
   */
  searchHistory(query: string): FunctionCallEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.functionHistory.filter(
      (entry) =>
        entry.name.toLowerCase().includes(lowerQuery) ||
        entry.file.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get function call statistics
   */
  getCallStatistics(): Map<string, { count: number; lastCall: Date }> {
    const stats = new Map<string, { count: number; lastCall: Date }>();

    for (const entry of this.functionHistory) {
      const existing = stats.get(entry.name);
      if (existing) {
        existing.count++;
        if (entry.timestamp > existing.lastCall) {
          existing.lastCall = entry.timestamp;
        }
      } else {
        stats.set(entry.name, { count: 1, lastCall: entry.timestamp });
      }
    }

    return stats;
  }

  /**
   * Export filter configuration
   */
  exportConfig(): StepFilterRule[] {
    return this.getAllRules();
  }

  /**
   * Import filter configuration
   */
  importConfig(rules: Array<Omit<StepFilterRule, 'id'>>): void {
    this.rules.clear();
    this.ruleIdCounter = 0;
    for (const rule of rules) {
      this.addRule(rule.pattern, rule.type, rule.description);
      const added = this.rules.get(`filter_${this.ruleIdCounter}`);
      if (added) {
        added.enabled = rule.enabled;
      }
    }
  }
}
