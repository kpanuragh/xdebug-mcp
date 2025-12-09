/**
 * Debug Configuration Manager
 * Saves and restores debug configurations (breakpoints, watches, filters, etc.)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';

export interface BreakpointConfig {
  file: string;
  line: number;
  condition?: string;
  hitValue?: number;
  hitCondition?: string;
  enabled: boolean;
}

export interface DebugProfile {
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  breakpoints: BreakpointConfig[];
  watchExpressions: string[];
  logpoints: Array<{
    file: string;
    line: number;
    message: string;
    condition?: string;
  }>;
  stepFilters: Array<{
    pattern: string;
    type: 'include' | 'exclude';
    enabled: boolean;
  }>;
  settings: {
    maxDepth?: number;
    maxChildren?: number;
    skipVendor?: boolean;
  };
}

export class DebugConfigManager {
  private profiles: Map<string, DebugProfile> = new Map();
  private configDir: string;
  private activeProfileName: string | null = null;

  constructor(configDir?: string) {
    this.configDir = configDir || path.join(process.cwd(), '.xdebug-mcp');
  }

  /**
   * Create a new debug profile
   */
  createProfile(name: string, description?: string): DebugProfile {
    const profile: DebugProfile = {
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
      breakpoints: [],
      watchExpressions: [],
      logpoints: [],
      stepFilters: [],
      settings: {},
    };
    this.profiles.set(name, profile);
    logger.info(`Debug profile created: ${name}`);
    return profile;
  }

  /**
   * Get a profile by name
   */
  getProfile(name: string): DebugProfile | undefined {
    return this.profiles.get(name);
  }

  /**
   * Get all profile names
   */
  getProfileNames(): string[] {
    return Array.from(this.profiles.keys());
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): DebugProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Update a profile
   */
  updateProfile(name: string, updates: Partial<DebugProfile>): boolean {
    const profile = this.profiles.get(name);
    if (!profile) return false;

    Object.assign(profile, updates, { updatedAt: new Date() });
    return true;
  }

  /**
   * Delete a profile
   */
  deleteProfile(name: string): boolean {
    if (this.activeProfileName === name) {
      this.activeProfileName = null;
    }
    return this.profiles.delete(name);
  }

  /**
   * Set the active profile
   */
  setActiveProfile(name: string): boolean {
    if (this.profiles.has(name)) {
      this.activeProfileName = name;
      return true;
    }
    return false;
  }

  /**
   * Get the active profile
   */
  getActiveProfile(): DebugProfile | null {
    if (this.activeProfileName) {
      return this.profiles.get(this.activeProfileName) || null;
    }
    return null;
  }

  /**
   * Save all profiles to disk
   */
  async saveAllProfiles(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });

      const data = {
        activeProfile: this.activeProfileName,
        profiles: Array.from(this.profiles.entries()).map(([, profile]) => profile),
      };

      const filePath = path.join(this.configDir, 'profiles.json');
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      logger.info(`Saved ${this.profiles.size} profiles to ${filePath}`);
    } catch (error) {
      logger.error('Failed to save profiles:', error);
      throw error;
    }
  }

  /**
   * Load profiles from disk
   */
  async loadProfiles(): Promise<void> {
    try {
      const filePath = path.join(this.configDir, 'profiles.json');
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);

      this.profiles.clear();
      for (const profile of data.profiles || []) {
        this.profiles.set(profile.name, {
          ...profile,
          createdAt: new Date(profile.createdAt),
          updatedAt: new Date(profile.updatedAt),
        });
      }

      this.activeProfileName = data.activeProfile || null;
      logger.info(`Loaded ${this.profiles.size} profiles from ${filePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to load profiles:', error);
      }
    }
  }

  /**
   * Save a single profile to its own file
   */
  async saveProfile(name: string): Promise<void> {
    const profile = this.profiles.get(name);
    if (!profile) {
      throw new Error(`Profile not found: ${name}`);
    }

    await fs.mkdir(this.configDir, { recursive: true });
    const filePath = path.join(this.configDir, `${name}.profile.json`);
    await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf8');
    logger.info(`Saved profile to ${filePath}`);
  }

  /**
   * Load a profile from file
   */
  async loadProfile(filePath: string): Promise<DebugProfile> {
    const content = await fs.readFile(filePath, 'utf8');
    const profile = JSON.parse(content) as DebugProfile;
    profile.createdAt = new Date(profile.createdAt);
    profile.updatedAt = new Date(profile.updatedAt);
    this.profiles.set(profile.name, profile);
    return profile;
  }

  /**
   * Export profile as JSON string
   */
  exportProfile(name: string): string | null {
    const profile = this.profiles.get(name);
    if (!profile) return null;
    return JSON.stringify(profile, null, 2);
  }

  /**
   * Import profile from JSON string
   */
  importProfile(json: string): DebugProfile {
    const profile = JSON.parse(json) as DebugProfile;
    profile.createdAt = new Date(profile.createdAt);
    profile.updatedAt = new Date(profile.updatedAt);
    this.profiles.set(profile.name, profile);
    return profile;
  }

  /**
   * Clone a profile
   */
  cloneProfile(sourceName: string, newName: string): DebugProfile | null {
    const source = this.profiles.get(sourceName);
    if (!source) return null;

    const clone: DebugProfile = {
      ...JSON.parse(JSON.stringify(source)),
      name: newName,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.profiles.set(newName, clone);
    return clone;
  }
}
