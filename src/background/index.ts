import browser from 'webextension-polyfill';
import type { Runtime, Tabs } from 'webextension-polyfill';
import {
  ChessProfile,
  ChessPlatform,
  ExtensionMessage,
  DEFAULT_SETTINGS,
  BADGE_COLORS,
  SuspicionLevel,
} from '@/types';
import {
  createLogger,
  getSettings,
  saveSettings,
  isWhitelisted,
  isBlacklisted,
  addToWhitelist,
  addToBlacklist,
  removeFromWhitelist,
  removeFromBlacklist
} from '@/utils';
import { ChessAPIClient } from '@/utils/api-client';
import { ProfileAnalyzer } from '@/utils/profile-analyzer';
import { CacheManager } from '@/utils/cache-manager';

const logger = createLogger('Background');

// Initialize background service worker
logger.info('Sus Meter background service worker started');

/**
 * Handle extension installation and updates
 */
browser.runtime.onInstalled.addListener(async (details: Runtime.OnInstalledDetailsType) => {
  if (details.reason === 'install') {
    logger.info('Extension installed - initializing settings');

    // Save default settings
    await saveSettings(DEFAULT_SETTINGS);

    // Initialize cache manager
    await CacheManager.initialize();

    // Set default badge
    await browser.action.setBadgeBackgroundColor({ color: BADGE_COLORS[SuspicionLevel.NONE] });
    await browser.action.setBadgeText({ text: '' });

  } else if (details.reason === 'update') {
    logger.info(`Extension updated to version ${browser.runtime.getManifest().version}`);

    // Clean expired cache on update
    await CacheManager.clearExpiredProfiles();
  }
});

/**
 * Handle messages from content scripts and popup
 */
browser.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: Runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => {
    const request = message as ExtensionMessage;

    // Handle async responses
    handleMessage(request, sender).then(sendResponse).catch(error => {
      logger.error('Error handling message:', error);
      sendResponse({ error: error.message });
    });

    // Return true to indicate async response
    return true;
  },
);

/**
 * Process messages and return appropriate responses
 */
async function handleMessage(
  request: ExtensionMessage,
  sender: Runtime.MessageSender
): Promise<any> {
  logger.debug(`Received message: ${request.type}`);

  switch (request.type) {
    case 'GET_SETTINGS':
      const settings = await getSettings();
      return settings;

    case 'TOGGLE_ENABLED':
      const enabled = request.data?.enabled ?? false;
      await saveSettings({ enabled });

      // Update badge
      if (!enabled) {
        await browser.action.setBadgeText({ text: 'OFF', tabId: sender.tab?.id });
        await browser.action.setBadgeBackgroundColor({ color: '#666666' });
      } else {
        await browser.action.setBadgeText({ text: '', tabId: sender.tab?.id });
      }

      // Broadcast to all content scripts
      const tabs = await browser.tabs.query({});
      tabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, request).catch(() => {});
        }
      });

      return { success: true, enabled };

    case 'PROFILES_DETECTED':
      return await handleProfilesDetected(request.data, request.platform!);

    case 'ANALYZE_PROFILE':
      return await analyzeProfile(request.username!, request.platform!);

    case 'GET_CACHED_PROFILE':
      const cached = await CacheManager.getCachedProfile(request.username!, request.platform!);
      return { profile: cached };

    case 'ADD_TO_WHITELIST':
      await addToWhitelist(request.username!);
      return { success: true };

    case 'ADD_TO_BLACKLIST':
      await addToBlacklist(request.username!);
      return { success: true };

    case 'REMOVE_FROM_WHITELIST':
      await removeFromWhitelist(request.username!);
      return { success: true };

    case 'REMOVE_FROM_BLACKLIST':
      await removeFromBlacklist(request.username!);
      return { success: true };

    case 'UPDATE_BADGE':
      if (sender.tab?.id) {
        await browser.action.setBadgeText({
          text: request.data?.text || '',
          tabId: sender.tab.id,
        });
        await browser.action.setBadgeBackgroundColor({
          color: request.data?.color || BADGE_COLORS[SuspicionLevel.NONE],
          tabId: sender.tab.id,
        });
      }
      return { success: true };

    case 'SETTINGS_UPDATED':
      // Broadcast settings update to all content scripts
      const allTabs = await browser.tabs.query({});
      allTabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, request).catch(() => {});
        }
      });
      return { success: true };

    default:
      logger.warn(`Unknown message type: ${request.type}`);
      return { error: 'Unknown message type' };
  }
}

/**
 * Handle profiles detected by content scripts
 */
async function handleProfilesDetected(
  profiles: Array<{ username: string; context: string }>,
  platform: ChessPlatform
): Promise<any> {
  const settings = await getSettings();
  const analyzedProfiles: Record<string, ChessProfile> = {};

  // Filter based on context and settings
  const filteredProfiles = profiles.filter(p => {
    switch (p.context) {
      case 'chat':
        return settings.features.checkChatUsers;
      case 'game':
        return settings.features.checkOpponents;
      case 'tournament':
        return settings.features.checkTournamentPlayers;
      default:
        return true;
    }
  });

  // Analyze each profile
  for (const profileInfo of filteredProfiles) {
    const username = profileInfo.username.toLowerCase();

    // Check whitelist/blacklist first
    if (await isWhitelisted(username)) {
      analyzedProfiles[username] = createWhitelistedProfile(username, platform);
      continue;
    }

    if (await isBlacklisted(username)) {
      analyzedProfiles[username] = createBlacklistedProfile(username, platform);
      continue;
    }

    // Check cache
    const cached = await CacheManager.getCachedProfile(username, platform);
    if (cached) {
      analyzedProfiles[username] = cached;
      continue;
    }

    // Fetch and analyze profile
    const profile = await analyzeProfile(username, platform);
    if (profile) {
      analyzedProfiles[username] = profile;

      // Cache the result
      if (settings.cache.enabled) {
        await CacheManager.cacheProfile(profile, settings.cache.expiryHours);
      }

      // Check if alert is needed
      if (settings.features.alertOnSuspicious) {
        if (ProfileAnalyzer.shouldAlert(profile, settings.thresholds.suspicionAlertLevel)) {
          logger.warn(`Suspicious profile detected: ${username} (${profile.suspicionLevel})`);
        }
      }
    }
  }

  return { profiles: analyzedProfiles };
}

/**
 * Analyze a single profile
 */
async function analyzeProfile(
  username: string,
  platform: ChessPlatform
): Promise<ChessProfile | null> {
  try {
    // Fetch profile data from API
    const profile = await ChessAPIClient.fetchProfile(username, platform);

    if (!profile) {
      logger.warn(`Failed to fetch profile: ${username}@${platform}`);
      return null;
    }

    // Analyze the profile
    const analyzed = ProfileAnalyzer.analyzeProfile(profile);

    logger.debug(`Analyzed ${username}: Score ${analyzed.suspicionScore}, Level ${analyzed.suspicionLevel}`);

    return analyzed;
  } catch (error) {
    logger.error(`Error analyzing profile ${username}@${platform}:`, error);
    return null;
  }
}

/**
 * Create a whitelisted profile object
 */
function createWhitelistedProfile(username: string, platform: ChessPlatform): ChessProfile {
  return {
    username,
    platform,
    accountAge: 9999,
    createdAt: '',
    ratings: {},
    gameStats: { total: 0, wins: 0, losses: 0, draws: 0, winRate: 0 },
    accountStatus: { isOnline: false },
    suspicionScore: 0,
    suspicionLevel: SuspicionLevel.NONE,
    suspicionReasons: ['Whitelisted user'],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Create a blacklisted profile object
 */
function createBlacklistedProfile(username: string, platform: ChessPlatform): ChessProfile {
  return {
    username,
    platform,
    accountAge: 0,
    createdAt: '',
    ratings: {},
    gameStats: { total: 0, wins: 0, losses: 0, draws: 0, winRate: 0 },
    accountStatus: { isOnline: false },
    suspicionScore: 100,
    suspicionLevel: SuspicionLevel.CRITICAL,
    suspicionReasons: ['Blacklisted user'],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Handle tab updates to show/hide badge based on site
 */
browser.tabs.onUpdated.addListener(
  async (tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType, tab: Tabs.Tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      const settings = await getSettings();

      // Check if we're on a chess site
      const isChessSite = tab.url.includes('lichess.org') || tab.url.includes('chess.com');

      if (isChessSite && settings.enabled) {
        // Clear badge for fresh start on page load
        await browser.action.setBadgeText({ text: '', tabId });
        await browser.action.setBadgeBackgroundColor({
          color: BADGE_COLORS[SuspicionLevel.NONE],
          tabId
        });
      } else if (!isChessSite) {
        // Hide badge on non-chess sites
        await browser.action.setBadgeText({ text: '', tabId });
      }
    }
  },
);

// Set up periodic cache cleanup
browser.alarms.create('cache-cleanup', {
  periodInMinutes: 60,
});

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'cache-cleanup') {
    CacheManager.clearExpiredProfiles().catch(error => {
      logger.error('Error during cache cleanup:', error);
    });
  }
});

// Export for testing
export {};