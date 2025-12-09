/**
 * Code Coverage Tracker
 * Tracks which lines were executed during debugging.
 */

import { logger } from '../utils/logger.js';

export interface FileCoverage {
  file: string;
  executedLines: Set<number>;
  totalLines?: number;
  coveragePercent?: number;
  firstHitAt: Date;
  lastHitAt: Date;
  hitCounts: Map<number, number>;
}

export interface CoverageReport {
  startedAt: Date;
  endedAt?: Date;
  files: Map<string, FileCoverage>;
  totalFiles: number;
  totalLinesExecuted: number;
  uniqueLinesExecuted: number;
}

export class CodeCoverageTracker {
  private currentReport: CoverageReport | null = null;
  private isTracking: boolean = false;

  /**
   * Start tracking code coverage
   */
  startTracking(): CoverageReport {
    this.currentReport = {
      startedAt: new Date(),
      files: new Map(),
      totalFiles: 0,
      totalLinesExecuted: 0,
      uniqueLinesExecuted: 0,
    };
    this.isTracking = true;
    logger.info('Code coverage tracking started');
    return this.currentReport;
  }

  /**
   * Stop tracking code coverage
   */
  stopTracking(): CoverageReport | null {
    if (!this.currentReport) return null;

    this.currentReport.endedAt = new Date();
    this.isTracking = false;

    // Calculate final statistics
    this.updateStatistics();

    logger.info('Code coverage tracking stopped');
    return this.currentReport;
  }

  /**
   * Record a line execution
   */
  recordLineExecution(file: string, line: number): void {
    if (!this.currentReport || !this.isTracking) return;

    let fileCoverage = this.currentReport.files.get(file);

    if (!fileCoverage) {
      fileCoverage = {
        file,
        executedLines: new Set(),
        firstHitAt: new Date(),
        lastHitAt: new Date(),
        hitCounts: new Map(),
      };
      this.currentReport.files.set(file, fileCoverage);
      this.currentReport.totalFiles++;
    }

    const wasNew = !fileCoverage.executedLines.has(line);
    fileCoverage.executedLines.add(line);
    fileCoverage.lastHitAt = new Date();

    // Update hit count
    const currentCount = fileCoverage.hitCounts.get(line) || 0;
    fileCoverage.hitCounts.set(line, currentCount + 1);

    this.currentReport.totalLinesExecuted++;
    if (wasNew) {
      this.currentReport.uniqueLinesExecuted++;
    }
  }

  /**
   * Update statistics for all files
   */
  private updateStatistics(): void {
    if (!this.currentReport) return;

    for (const coverage of this.currentReport.files.values()) {
      if (coverage.totalLines && coverage.totalLines > 0) {
        coverage.coveragePercent =
          (coverage.executedLines.size / coverage.totalLines) * 100;
      }
    }
  }

  /**
   * Set total lines for a file (for percentage calculation)
   */
  setFileTotalLines(file: string, totalLines: number): void {
    if (!this.currentReport) return;

    const coverage = this.currentReport.files.get(file);
    if (coverage) {
      coverage.totalLines = totalLines;
      coverage.coveragePercent =
        (coverage.executedLines.size / totalLines) * 100;
    }
  }

  /**
   * Get coverage for a specific file
   */
  getFileCoverage(file: string): FileCoverage | undefined {
    return this.currentReport?.files.get(file);
  }

  /**
   * Get all file coverages
   */
  getAllFileCoverages(): FileCoverage[] {
    if (!this.currentReport) return [];
    return Array.from(this.currentReport.files.values());
  }

  /**
   * Get uncovered lines for a file
   */
  getUncoveredLines(file: string, totalLines: number): number[] {
    const coverage = this.currentReport?.files.get(file);
    if (!coverage) {
      return Array.from({ length: totalLines }, (_, i) => i + 1);
    }

    const uncovered: number[] = [];
    for (let i = 1; i <= totalLines; i++) {
      if (!coverage.executedLines.has(i)) {
        uncovered.push(i);
      }
    }
    return uncovered;
  }

  /**
   * Get hot spots (most executed lines)
   */
  getHotSpots(limit: number = 10): Array<{ file: string; line: number; hitCount: number }> {
    if (!this.currentReport) return [];

    const hotSpots: Array<{ file: string; line: number; hitCount: number }> = [];

    for (const [file, coverage] of this.currentReport.files) {
      for (const [line, hitCount] of coverage.hitCounts) {
        hotSpots.push({ file, line, hitCount });
      }
    }

    return hotSpots
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit);
  }

  /**
   * Generate coverage summary
   */
  getSummary(): {
    isTracking: boolean;
    duration?: number;
    totalFiles: number;
    totalLinesExecuted: number;
    uniqueLinesExecuted: number;
    filesSummary: Array<{
      file: string;
      executedLines: number;
      totalLines?: number;
      coveragePercent?: number;
    }>;
  } {
    if (!this.currentReport) {
      return {
        isTracking: false,
        totalFiles: 0,
        totalLinesExecuted: 0,
        uniqueLinesExecuted: 0,
        filesSummary: [],
      };
    }

    const duration = this.currentReport.endedAt
      ? this.currentReport.endedAt.getTime() - this.currentReport.startedAt.getTime()
      : Date.now() - this.currentReport.startedAt.getTime();

    const filesSummary = Array.from(this.currentReport.files.values()).map((f) => ({
      file: f.file,
      executedLines: f.executedLines.size,
      totalLines: f.totalLines,
      coveragePercent: f.coveragePercent,
    }));

    return {
      isTracking: this.isTracking,
      duration,
      totalFiles: this.currentReport.totalFiles,
      totalLinesExecuted: this.currentReport.totalLinesExecuted,
      uniqueLinesExecuted: this.currentReport.uniqueLinesExecuted,
      filesSummary,
    };
  }

  /**
   * Generate text report
   */
  generateReport(): string {
    const summary = this.getSummary();
    const lines: string[] = [];

    lines.push('=== Code Coverage Report ===');
    lines.push(`Status: ${summary.isTracking ? 'Active' : 'Stopped'}`);
    if (summary.duration) {
      lines.push(`Duration: ${(summary.duration / 1000).toFixed(2)}s`);
    }
    lines.push(`Total files: ${summary.totalFiles}`);
    lines.push(`Unique lines executed: ${summary.uniqueLinesExecuted}`);
    lines.push(`Total line executions: ${summary.totalLinesExecuted}`);
    lines.push('');
    lines.push('--- Per-File Coverage ---');

    for (const file of summary.filesSummary) {
      let coverageStr = `${file.executedLines} lines`;
      if (file.totalLines) {
        coverageStr += ` / ${file.totalLines} (${file.coveragePercent?.toFixed(1)}%)`;
      }
      lines.push(`  ${file.file}: ${coverageStr}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset coverage data
   */
  reset(): void {
    this.currentReport = null;
    this.isTracking = false;
  }

  /**
   * Export coverage data as JSON
   */
  exportData(): object | null {
    if (!this.currentReport) return null;

    return {
      startedAt: this.currentReport.startedAt.toISOString(),
      endedAt: this.currentReport.endedAt?.toISOString(),
      totalFiles: this.currentReport.totalFiles,
      totalLinesExecuted: this.currentReport.totalLinesExecuted,
      uniqueLinesExecuted: this.currentReport.uniqueLinesExecuted,
      files: Array.from(this.currentReport.files.entries()).map(([file, coverage]) => ({
        file,
        executedLines: Array.from(coverage.executedLines),
        totalLines: coverage.totalLines,
        coveragePercent: coverage.coveragePercent,
        hitCounts: Object.fromEntries(coverage.hitCounts),
      })),
    };
  }

  get tracking(): boolean {
    return this.isTracking;
  }
}
