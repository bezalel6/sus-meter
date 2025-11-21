import browser from 'webextension-polyfill';
import type { ChessProfile, CachedProfile } from '@/types';
import { STORAGE_KEYS } from '@/types';
import { createLogger } from './logger';

const logger = createLogger('CacheManager');

/**
 * Manages caching of chess profiles to reduce API calls
 */
export class CacheManager {
  private static cacheKey = STORAGE_KEYS.PROFILE_CACHE;

  /**
   * Get a cached profile if it exists and hasn't expired
   */
  static async getCachedProfile(username: string, platform: string): Promise<ChessProfile | null> {
    try {
      const cache = await this.getAllCachedProfiles();
      const cacheKey = this.getCacheKey(username, platform);
      const cached = cache[cacheKey];

      if (!cached) {
        logger.debug(`No cached profile for ${username}@${platform}`);
        return null;
      }

      // Check if cache has expired
      const expiresAt = new Date(cached.expiresAt);
      if (expiresAt < new Date()) {
        logger.debug(`Cached profile expired for ${username}@${platform}`);
        await this.removeCachedProfile(username, platform);
        return null;
      }

      logger.debug(`Found valid cached profile for ${username}@${platform}`);
      return cached.profile;
    } catch (error) {
      logger.error('Error getting cached profile:', error);
      return null;
    }
  }

  /**
   * Cache a profile with expiration
   */
  static async cacheProfile(profile: ChessProfile, expiryHours: number = 24): Promise<void> {
    try {
      const cache = await this.getAllCachedProfiles();
      const cacheKey = this.getCacheKey(profile.username, profile.platform);

      const cachedProfile: CachedProfile = {
        profile,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString(),
      };

      cache[cacheKey] = cachedProfile;

      // Enforce max cache size
      await this.enforceCacheLimit(cache);

      await browser.storage.local.set({ [this.cacheKey]: cache });
      logger.debug(`Cached profile for ${profile.username}@${profile.platform}`);
    } catch (error) {
      logger.error('Error caching profile:', error);
    }
  }

  /**
   * Remove a specific cached profile
   */
  static async removeCachedProfile(username: string, platform: string): Promise<void> {
    try {
      const cache = await this.getAllCachedProfiles();
      const cacheKey = this.getCacheKey(username, platform);

      delete cache[cacheKey];

      await browser.storage.local.set({ [this.cacheKey]: cache });
      logger.debug(`Removed cached profile for ${username}@${platform}`);
    } catch (error) {
      logger.error('Error removing cached profile:', error);
    }
  }

  /**
   * Clear all cached profiles
   */
  static async clearCache(): Promise<void> {
    try {
      await browser.storage.local.set({ [this.cacheKey]: {} });
      logger.info('Cleared all cached profiles');
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Clear expired profiles from cache
   */
  static async clearExpiredProfiles(): Promise<number> {
    try {
      const cache = await this.getAllCachedProfiles();
      const now = new Date();
      let removedCount = 0;

      Object.keys(cache).forEach((key) => {
        const expiresAt = new Date(cache[key]!.expiresAt);
        if (expiresAt < now) {
          delete cache[key];
          removedCount++;
        }
      });

      if (removedCount > 0) {
        await browser.storage.local.set({ [this.cacheKey]: cache });
        logger.info(`Cleared ${removedCount} expired profiles from cache`);
      }

      return removedCount;
    } catch (error) {
      logger.error('Error clearing expired profiles:', error);
      return 0;
    }
  }

  /**
   * Get all cached profiles
   */
  private static async getAllCachedProfiles(): Promise<Record<string, CachedProfile>> {
    try {
      const result = await browser.storage.local.get(this.cacheKey);
      return (result[this.cacheKey] as Record<string, CachedProfile>) || {};
    } catch (error) {
      logger.error('Error getting all cached profiles:', error);
      return {};
    }
  }

  /**
   * Generate cache key for a profile
   */
  private static getCacheKey(username: string, platform: string): string {
    return `${platform}:${username.toLowerCase()}`;
  }

  /**
   * Enforce maximum cache size by removing oldest entries
   */
  private static async enforceCacheLimit(
    cache: Record<string, CachedProfile>,
    maxProfiles: number = 100,
  ): Promise<void> {
    const entries = Object.entries(cache);

    if (entries.length <= maxProfiles) {
      return;
    }

    // Sort by cached time (oldest first)
    entries.sort((a, b) => {
      const timeA = new Date(a[1].cachedAt).getTime();
      const timeB = new Date(b[1].cachedAt).getTime();
      return timeA - timeB;
    });

    // Remove oldest entries
    const toRemove = entries.length - maxProfiles;
    for (let i = 0; i < toRemove; i++) {
      delete cache[entries[i]![0]];
    }

    logger.debug(`Removed ${toRemove} profiles to enforce cache limit`);
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    totalProfiles: number;
    expiredProfiles: number;
    averageAge: number;
    platforms: Record<string, number>;
  }> {
    try {
      const cache = await this.getAllCachedProfiles();
      const now = new Date();
      const entries = Object.entries(cache);

      let expiredCount = 0;
      let totalAge = 0;
      const platformCounts: Record<string, number> = {
        lichess: 0,
        'chess.com': 0,
      };

      entries.forEach(([key, cached]) => {
        const expiresAt = new Date(cached.expiresAt);
        if (expiresAt < now) {
          expiredCount++;
        }

        const age = now.getTime() - new Date(cached.cachedAt).getTime();
        totalAge += age;

        const platform = key.split(':')[0];
        if (platform) {
          platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        }
      });

      return {
        totalProfiles: entries.length,
        expiredProfiles: expiredCount,
        averageAge: entries.length > 0 ? Math.floor(totalAge / entries.length / (1000 * 60)) : 0, // in minutes
        platforms: platformCounts,
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {
        totalProfiles: 0,
        expiredProfiles: 0,
        averageAge: 0,
        platforms: {},
      };
    }
  }

  /**
   * Initialize cache and set up periodic cleanup
   */
  static async initialize(): Promise<void> {
    try {
      // Clear expired profiles on startup
      await this.clearExpiredProfiles();

      // Set up periodic cleanup (every hour)
      browser.alarms.create('cache-cleanup', {
        periodInMinutes: 60,
      });

      browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'cache-cleanup') {
          this.clearExpiredProfiles();
        }
      });

      logger.info('Cache manager initialized');
    } catch (error) {
      logger.error('Error initializing cache manager:', error);
    }
  }

  /**
   * Check if profile should be re-fetched based on staleness
   */
  static async shouldRefetch(
    username: string,
    platform: string,
    staleThresholdHours: number = 12,
  ): Promise<boolean> {
    try {
      const cache = await this.getAllCachedProfiles();
      const cacheKey = this.getCacheKey(username, platform);
      const cached = cache[cacheKey];

      if (!cached) {
        return true;
      }

      const cachedAt = new Date(cached.cachedAt);
      const staleTime = new Date(Date.now() - staleThresholdHours * 60 * 60 * 1000);

      return cachedAt < staleTime;
    } catch (error) {
      logger.error('Error checking if should refetch:', error);
      return true;
    }
  }
}
