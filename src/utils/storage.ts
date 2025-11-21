import browser from 'webextension-polyfill';
import type { ExtensionSettings } from '../types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../types';
import { createLogger } from './logger';

const logger = createLogger('Storage');

/**
 * Get data from chrome storage
 */
export async function getStorageData<T = any>(key: string): Promise<T | null> {
  try {
    const result = await browser.storage.local.get(key);
    return (result[key] as T) || null;
  } catch (error) {
    logger.error('Error getting storage data:', error);
    return null;
  }
}

/**
 * Set data in chrome storage
 */
export async function setStorageData<T = any>(key: string, value: T): Promise<boolean> {
  try {
    await browser.storage.local.set({ [key]: value });
    return true;
  } catch (error) {
    logger.error('Error setting storage data:', error);
    return false;
  }
}

/**
 * Remove data from chrome storage
 */
export async function removeStorageData(key: string): Promise<boolean> {
  try {
    await browser.storage.local.remove(key);
    return true;
  } catch (error) {
    logger.error('Error removing storage data:', error);
    return false;
  }
}

/**
 * Clear all extension storage
 */
export async function clearAllStorage(): Promise<boolean> {
  try {
    await browser.storage.local.clear();
    logger.info('Cleared all storage');
    return true;
  } catch (error) {
    logger.error('Error clearing storage:', error);
    return false;
  }
}

/**
 * Get extension settings with proper defaults
 */
export async function getSettings(): Promise<ExtensionSettings> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.SETTINGS);
    const stored = result[STORAGE_KEYS.SETTINGS] as ExtensionSettings | undefined;

    if (!stored) {
      // First time - save and return defaults
      await saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }

    // Merge stored settings with defaults to handle new fields
    const merged: ExtensionSettings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      features: {
        ...DEFAULT_SETTINGS.features,
        ...(stored.features || {}),
      },
      thresholds: {
        ...DEFAULT_SETTINGS.thresholds,
        ...(stored.thresholds || {}),
      },
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        ...(stored.appearance || {}),
      },
      cache: {
        ...DEFAULT_SETTINGS.cache,
        ...(stored.cache || {}),
      },
      lists: {
        ...DEFAULT_SETTINGS.lists,
        ...(stored.lists || {}),
      },
    };

    return merged;
  } catch (error) {
    logger.error('Error getting settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save extension settings
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<boolean> {
  try {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await browser.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
    logger.debug('Settings saved');
    return true;
  } catch (error) {
    logger.error('Error saving settings:', error);
    return false;
  }
}

/**
 * Get whitelist
 */
export async function getWhitelist(): Promise<string[]> {
  try {
    const result = await getStorageData<string[]>(STORAGE_KEYS.WHITELIST);
    return result || [];
  } catch (error) {
    logger.error('Error getting whitelist:', error);
    return [];
  }
}

/**
 * Add username to whitelist
 */
export async function addToWhitelist(username: string): Promise<boolean> {
  try {
    const whitelist = await getWhitelist();
    const normalized = username.toLowerCase();

    if (!whitelist.includes(normalized)) {
      whitelist.push(normalized);
      await setStorageData(STORAGE_KEYS.WHITELIST, whitelist);
      logger.info(`Added ${username} to whitelist`);
    }
    return true;
  } catch (error) {
    logger.error('Error adding to whitelist:', error);
    return false;
  }
}

/**
 * Remove username from whitelist
 */
export async function removeFromWhitelist(username: string): Promise<boolean> {
  try {
    const whitelist = await getWhitelist();
    const normalized = username.toLowerCase();
    const index = whitelist.indexOf(normalized);

    if (index > -1) {
      whitelist.splice(index, 1);
      await setStorageData(STORAGE_KEYS.WHITELIST, whitelist);
      logger.info(`Removed ${username} from whitelist`);
    }
    return true;
  } catch (error) {
    logger.error('Error removing from whitelist:', error);
    return false;
  }
}

/**
 * Get blacklist
 */
export async function getBlacklist(): Promise<string[]> {
  try {
    const result = await getStorageData<string[]>(STORAGE_KEYS.BLACKLIST);
    return result || [];
  } catch (error) {
    logger.error('Error getting blacklist:', error);
    return [];
  }
}

/**
 * Add username to blacklist
 */
export async function addToBlacklist(username: string): Promise<boolean> {
  try {
    const blacklist = await getBlacklist();
    const normalized = username.toLowerCase();

    if (!blacklist.includes(normalized)) {
      blacklist.push(normalized);
      await setStorageData(STORAGE_KEYS.BLACKLIST, blacklist);
      logger.info(`Added ${username} to blacklist`);
    }
    return true;
  } catch (error) {
    logger.error('Error adding to blacklist:', error);
    return false;
  }
}

/**
 * Remove username from blacklist
 */
export async function removeFromBlacklist(username: string): Promise<boolean> {
  try {
    const blacklist = await getBlacklist();
    const normalized = username.toLowerCase();
    const index = blacklist.indexOf(normalized);

    if (index > -1) {
      blacklist.splice(index, 1);
      await setStorageData(STORAGE_KEYS.BLACKLIST, blacklist);
      logger.info(`Removed ${username} from blacklist`);
    }
    return true;
  } catch (error) {
    logger.error('Error removing from blacklist:', error);
    return false;
  }
}

/**
 * Check if username is whitelisted
 */
export async function isWhitelisted(username: string): Promise<boolean> {
  const whitelist = await getWhitelist();
  return whitelist.includes(username.toLowerCase());
}

/**
 * Check if username is blacklisted
 */
export async function isBlacklisted(username: string): Promise<boolean> {
  const blacklist = await getBlacklist();
  return blacklist.includes(username.toLowerCase());
}

/**
 * Listen for storage changes
 */
export function onStorageChange(
  callback: (changes: browser.Storage.StorageAreaOnChangedChangesType) => void,
): void {
  browser.storage.onChanged.addListener(
    (changes: browser.Storage.StorageAreaOnChangedChangesType, areaName: string) => {
      if (areaName === 'local') {
        callback(changes);
      }
    },
  );
}
