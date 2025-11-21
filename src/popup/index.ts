import browser from 'webextension-polyfill';
import type { ChessProfile, ChessPlatform, ExtensionMessage } from '@/types';
import { ChessAPIClient, ProfileAnalyzer, CacheManager } from '@/utils';
import './popup.css';

// Types
interface SearchHistoryItem {
  username: string;
  platform: ChessPlatform;
  accountAge: number;
  timestamp: number;
}

// DOM Elements
const elements = {
  // Input
  usernameInput: document.getElementById('username-input') as HTMLInputElement,
  searchBtn: document.getElementById('search-btn') as HTMLButtonElement,

  // States
  loading: document.getElementById('loading') as HTMLDivElement,
  error: document.getElementById('error') as HTMLDivElement,
  errorText: document.getElementById('error-text') as HTMLSpanElement,
  results: document.getElementById('results') as HTMLDivElement,

  // Age Card
  ageCard: document.getElementById('age-card') as HTMLDivElement,
  ageValue: document.getElementById('age-value') as HTMLDivElement,
  ageDate: document.getElementById('age-date') as HTMLDivElement,

  // Profile Info
  username: document.getElementById('username') as HTMLSpanElement,
  platformTag: document.getElementById('platform-tag') as HTMLSpanElement,

  // Stats
  rating: document.getElementById('rating') as HTMLSpanElement,
  games: document.getElementById('games') as HTMLSpanElement,
  winrate: document.getElementById('winrate') as HTMLSpanElement,

  // Suspicion
  suspicionLevel: document.getElementById('suspicion-level') as HTMLSpanElement,
  suspicionFill: document.getElementById('suspicion-fill') as HTMLDivElement,
  suspicionReasons: document.getElementById('suspicion-reasons') as HTMLUListElement,

  // History
  historyList: document.getElementById('history-list') as HTMLDivElement,
  clearHistory: document.getElementById('clear-history') as HTMLButtonElement,

  // Inject & Picker
  injectBtn: document.getElementById('inject-btn') as HTMLButtonElement,
  pickerBtn: document.getElementById('picker-btn') as HTMLButtonElement,
  injectStatus: document.getElementById('inject-status') as HTMLDivElement,

  // Settings
  settingsBtn: document.getElementById('settings-btn') as HTMLButtonElement,
  settingsPanel: document.getElementById('settings-panel') as HTMLDivElement,
  closeSettings: document.getElementById('close-settings') as HTMLButtonElement,
  saveSettings: document.getElementById('save-settings') as HTMLButtonElement,
  resetSettings: document.getElementById('reset-settings') as HTMLButtonElement,

  // Settings inputs
  criticalDays: document.getElementById('critical-days') as HTMLInputElement,
  highSuspicionDays: document.getElementById('high-suspicion-days') as HTMLInputElement,
  suspiciousDays: document.getElementById('suspicious-days') as HTMLInputElement,
  highRating: document.getElementById('high-rating') as HTMLInputElement,
  minGames: document.getElementById('min-games') as HTMLInputElement,
  winRate: document.getElementById('win-rate') as HTMLInputElement,
  cssDetectionCheck: document.getElementById('css-detection-check') as HTMLInputElement,
};

// State
let searchHistory: SearchHistoryItem[] = [];
const currentSettings = {
  thresholds: {
    criticalAccountDays: 14,
    highSuspicionAccountDays: 30,
    suspiciousAccountDays: 365,
  },
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadHistory();
  await loadSettings();
  setupListeners();
  setupPickerListener();
  await checkForPendingPickerResult();
  elements.usernameInput.focus();
});

// Check for pending picker result
async function checkForPendingPickerResult() {
  const result = await browser.storage.local.get(['lastPickerResult']);
  const lastResult = result['lastPickerResult'] as
    | {
        username: string;
        platform: ChessPlatform;
        profile: ChessProfile;
        timestamp: number;
      }
    | undefined;

  if (lastResult && lastResult.timestamp) {
    // Check if result is less than 30 seconds old
    const age = Date.now() - lastResult.timestamp;
    if (age < 30000) {
      // Clear the stored result
      await browser.storage.local.remove(['lastPickerResult']);

      // Clear badge
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await browser.action.setBadgeText({ text: '', tabId: tab.id });
      }

      // Handle the result
      await handlePickerResult({
        type: 'PICKER_RESULT',
        username: lastResult.username,
        platform: lastResult.platform,
        data: { profile: lastResult.profile },
      } as ExtensionMessage);
    }
  }
}

// Setup picker result listener
function setupPickerListener() {
  browser.runtime.onMessage.addListener(((
    message: unknown,
    _sender: any,
    sendResponse: (response?: any) => void,
  ) => {
    const msg = message as ExtensionMessage;
    if (msg.type === 'PICKER_RESULT') {
      // Handle async with promise
      handlePickerResult(msg).catch(console.error);
      return undefined; // No async response needed
    }
    if (msg.type === 'POPUP_CHECK') {
      sendResponse({ active: true });
      return undefined; // Sync response sent
    }
    return undefined; // Don't handle other messages
  }) as any);
}

// Handle picker result from background
async function handlePickerResult(message: ExtensionMessage) {
  const username = message.username || '';
  const platform = message.platform || ('lichess' as ChessPlatform);
  const profile = message.data?.profile as ChessProfile | undefined;

  // Disable picker mode UI
  elements.pickerBtn.classList.remove('active');
  elements.pickerBtn.querySelector('span:last-child')!.textContent = 'Pick Profile';

  // Set the username and platform
  elements.usernameInput.value = username;
  const radio = document.querySelector(`input[value="${platform}"]`) as HTMLInputElement;
  if (radio) radio.checked = true;

  if (profile) {
    // Show success status briefly
    showInjectStatus(`Found ${username}`, 'success');

    // Display the results
    setTimeout(() => {
      displayResults(profile);
      addToHistory(profile).catch(console.error);
    }, 300);
  } else {
    // Show error
    showInjectStatus(`User "${username}" not found`, 'error');
  }
}

// Cleanup on popup close
window.addEventListener('unload', () => {
  // Disable picker mode if active
  const pickerBtn = elements.pickerBtn;
  if (pickerBtn?.classList.contains('active')) {
    disablePickerMode().catch(console.error);
  }
});

// Setup event listeners
function setupListeners() {
  // Track if search is in progress
  let isSearching = false;

  // Search with debouncing and duplicate prevention
  const handleSearch = async () => {
    if (isSearching) return; // Prevent duplicate searches
    isSearching = true;
    await performSearch();
    isSearching = false;
  };

  elements.searchBtn.addEventListener('click', handleSearch);
  elements.usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  });

  // Add input validation and trimming
  elements.usernameInput.addEventListener('input', () => {
    // Remove leading/trailing spaces as user types
    const value = elements.usernameInput.value;
    if (value.startsWith(' ') || value.endsWith('  ')) {
      elements.usernameInput.value = value.trim();
    }
  });

  // Clear history with confirmation for large history
  elements.clearHistory.addEventListener('click', async () => {
    if (searchHistory.length > 5) {
      if (!confirm('Clear all search history?')) return;
    }
    searchHistory = [];
    await saveHistory();
    displayHistory();
  });

  // Inject profiles with better state management
  let isInjecting = false;
  elements.injectBtn.addEventListener('click', async () => {
    if (isInjecting) return;
    isInjecting = true;
    await injectProfileButtons();
    isInjecting = false;
  });

  // Settings panel event listeners
  elements.settingsBtn.addEventListener('click', () => {
    elements.settingsPanel.classList.remove('hidden');
  });

  elements.closeSettings.addEventListener('click', () => {
    elements.settingsPanel.classList.add('hidden');
  });

  elements.saveSettings.addEventListener('click', async () => {
    await saveSettings();
    showInjectStatus('Settings saved', 'success');
    elements.settingsPanel.classList.add('hidden');
  });

  elements.resetSettings.addEventListener('click', async () => {
    if (confirm('Reset all settings to defaults?')) {
      await resetSettings();
      await loadSettings();
      showInjectStatus('Settings reset to defaults', 'success');
    }
  });

  // Profile picker mode
  let isPickerActive = false;

  // Check if picker is already active (from previous popup open)
  browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab?.id) {
      browser.tabs
        .sendMessage(tab.id, { type: 'CHECK_PICKER_MODE' })
        .then((response: any) => {
          if (response?.active) {
            elements.pickerBtn.classList.add('active');
            elements.pickerBtn.querySelector('span:last-child')!.textContent = 'Cancel';
            elements.injectStatus.textContent = '🎯 Click on any username to analyze';
            elements.injectStatus.className = 'inject-status picker-active';
            elements.injectStatus.classList.remove('hidden');
            isPickerActive = true;
          }
        })
        .catch(() => {
          // No response means picker not active
        });
    }
  });

  elements.pickerBtn.addEventListener('click', async () => {
    if (isPickerActive) {
      await disablePickerMode();
    } else {
      await enablePickerMode();
    }
    isPickerActive = !isPickerActive;
  });
}

// Get selected platform
function getSelectedPlatform(): ChessPlatform {
  const checked = document.querySelector('input[name="platform"]:checked') as HTMLInputElement;
  return (checked?.value as ChessPlatform) || 'lichess';
}

// Perform search
async function performSearch() {
  const username = elements.usernameInput.value.trim().toLowerCase();
  const platform = getSelectedPlatform();

  if (!username) {
    showError('Please enter a username');
    elements.usernameInput.focus();
    return;
  }

  // Validate username format
  if (username.length < 2) {
    showError('Username must be at least 2 characters');
    return;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    showError('Username contains invalid characters');
    return;
  }

  // Smooth transition
  hideAll();
  setTimeout(() => {
    elements.loading.classList.remove('hidden');
  }, 50);

  try {
    // Check cache first
    let profile = await CacheManager.getCachedProfile(username, platform);

    if (!profile) {
      // Add slight delay for better UX
      const fetchPromise = ChessAPIClient.fetchProfile(username, platform);
      const minDelay = new Promise((resolve) => setTimeout(resolve, 300));

      [profile] = await Promise.all([fetchPromise, minDelay]);

      if (profile) {
        // Analyze profile with current settings
        const result = await browser.storage.local.get(['settings']);
        const settings = result['settings'] || {};
        profile = ProfileAnalyzer.analyzeProfile(profile, settings);
        // Cache it
        await CacheManager.cacheProfile(profile);
      }
    }

    if (profile) {
      // Smooth transition to results
      elements.loading.classList.add('hidden');
      setTimeout(() => {
        displayResults(profile);
        addToHistory(profile).catch(console.error);
      }, 100);
    } else {
      showError(`User "${username}" not found on ${platform}`);
      elements.usernameInput.select();
    }
  } catch (err: any) {
    console.error('Search error:', err);

    // More helpful error messages
    if (err.message?.includes('fetch')) {
      showError('Network error. Check your internet connection.');
    } else if (err.message?.includes('timeout')) {
      showError('Request timed out. Please try again.');
    } else {
      showError('Failed to fetch profile. Please try again.');
    }

    elements.usernameInput.select();
  }
}

// Display results
function displayResults(profile: ChessProfile) {
  hideAll();
  elements.results.classList.remove('hidden');

  // Age card styling
  elements.ageCard.className = 'age-card';
  if (profile.accountAge < currentSettings.thresholds.suspiciousAccountDays) {
    elements.ageCard.classList.add('new');
  } else {
    elements.ageCard.classList.add('established');
  }

  // Age display
  elements.ageValue.textContent = formatAge(profile.accountAge);
  const created = new Date(profile.createdAt);
  elements.ageDate.textContent = `Created ${created.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  // Profile info
  elements.username.textContent = profile.username;
  elements.platformTag.textContent = profile.platform.toUpperCase();

  // Stats
  const mainRating = profile.ratings.blitz || profile.ratings.rapid || profile.ratings.bullet || 0;
  elements.rating.textContent = mainRating ? mainRating.toString() : 'Unrated';

  // Display games with rated/unrated breakdown if available
  if (profile.gameStats.rated !== undefined && profile.gameStats.unrated !== undefined) {
    elements.games.innerHTML = `
      <div style="line-height: 1.2;">
        <div style="font-size: 18px; font-weight: 600;">${profile.gameStats.total.toLocaleString()}</div>
        <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">
          ${profile.gameStats.rated.toLocaleString()} rated<br/>
          ${profile.gameStats.unrated.toLocaleString()} unrated
        </div>
      </div>
    `;
  } else {
    elements.games.textContent = profile.gameStats.total.toLocaleString();
  }

  elements.winrate.textContent = `${profile.gameStats.winRate}%`;

  // Suspicion
  elements.suspicionLevel.textContent = profile.suspicionLevel.replace('_', ' ').toUpperCase();
  elements.suspicionLevel.className = `suspicion-level ${profile.suspicionLevel}`;
  elements.suspicionFill.style.width = `${profile.suspicionScore}%`;

  // Suspicion reasons
  elements.suspicionReasons.innerHTML = '';
  if (profile.suspicionReasons.length > 0) {
    profile.suspicionReasons.forEach((reason) => {
      const li = document.createElement('li');
      li.textContent = reason;
      elements.suspicionReasons.appendChild(li);
    });
  }
}

// Format age for display
function formatAge(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? '1 month' : `${months} months`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year' : `${years} years`;
}

// Add to history
async function addToHistory(profile: ChessProfile) {
  const item: SearchHistoryItem = {
    username: profile.username,
    platform: profile.platform,
    accountAge: profile.accountAge,
    timestamp: Date.now(),
  };

  // Remove if exists
  searchHistory = searchHistory.filter(
    (h) => !(h.username === item.username && h.platform === item.platform),
  );

  // Add to front
  searchHistory.unshift(item);

  // Keep only 10
  searchHistory = searchHistory.slice(0, 10);

  await saveHistory();
  displayHistory();
}

// Display history
function displayHistory() {
  elements.historyList.innerHTML = '';

  if (searchHistory.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'history-empty';
    emptyMsg.textContent = 'No recent searches';
    emptyMsg.style.cssText = 'text-align: center; color: #9ca3af; font-size: 12px; padding: 12px;';
    elements.historyList.appendChild(emptyMsg);
    return;
  }

  searchHistory.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'history-item';

    const userDiv = document.createElement('div');
    userDiv.className = 'history-user';

    const username = document.createElement('span');
    username.className = 'history-username';
    username.textContent = item.username;

    const platform = document.createElement('span');
    platform.className = 'history-platform';
    platform.textContent = item.platform;

    userDiv.appendChild(username);
    userDiv.appendChild(platform);

    const age = document.createElement('span');
    age.className = 'history-age';
    if (item.accountAge < currentSettings.thresholds.suspiciousAccountDays)
      age.classList.add('new');
    age.textContent =
      item.accountAge < currentSettings.thresholds.suspiciousAccountDays
        ? 'SUS'
        : `${formatAge(item.accountAge)}`;

    div.appendChild(userDiv);
    div.appendChild(age);

    div.style.cursor = 'pointer';
    div.style.transition = 'background-color 0.15s';

    // Better click handling with visual feedback
    div.addEventListener('mousedown', () => {
      div.style.backgroundColor = '#f3f4f6';
    });

    div.addEventListener('mouseup', () => {
      div.style.backgroundColor = '';
    });

    div.addEventListener('mouseleave', () => {
      div.style.backgroundColor = '';
    });

    div.addEventListener('click', async (e) => {
      e.preventDefault();

      // Set the values
      elements.usernameInput.value = item.username;
      const radio = document.querySelector(`input[value="${item.platform}"]`) as HTMLInputElement;
      if (radio) radio.checked = true;

      // Visual feedback
      div.style.backgroundColor = '#e5e7eb';

      // Small delay for better UX
      setTimeout(() => {
        performSearch();
      }, 100);
    });

    elements.historyList.appendChild(div);
  });
}

// Load history
async function loadHistory() {
  const result = await browser.storage.local.get(['searchHistory']);
  searchHistory = (result['searchHistory'] as SearchHistoryItem[]) || [];
  displayHistory();
}

// Save history
async function saveHistory() {
  await browser.storage.local.set({ searchHistory });
}

// Load settings
async function loadSettings() {
  const result = await browser.storage.local.get(['settings']);
  const settings = result['settings'] as { thresholds?: any; features?: any } | undefined;

  // Store settings in memory
  currentSettings.thresholds.criticalAccountDays =
    settings?.thresholds?.criticalAccountDays || 14;
  currentSettings.thresholds.highSuspicionAccountDays =
    settings?.thresholds?.highSuspicionAccountDays || 30;
  currentSettings.thresholds.suspiciousAccountDays =
    settings?.thresholds?.suspiciousAccountDays || 365;

  // Apply settings to inputs
  elements.criticalDays.value = String(currentSettings.thresholds.criticalAccountDays);
  elements.highSuspicionDays.value = String(currentSettings.thresholds.highSuspicionAccountDays);
  elements.suspiciousDays.value = String(currentSettings.thresholds.suspiciousAccountDays);
  elements.highRating.value = String(settings?.thresholds?.highRatingThreshold || 2000);
  elements.minGames.value = String(settings?.thresholds?.minGamesRequired || 50);
  elements.winRate.value = String(settings?.thresholds?.suspiciousWinRate || 75);
  elements.cssDetectionCheck.checked = settings?.features?.useCssDetection || false;
}

// Save settings
async function saveSettings() {
  const settings = {
    thresholds: {
      criticalAccountDays: parseInt(elements.criticalDays.value) || 14,
      highSuspicionAccountDays: parseInt(elements.highSuspicionDays.value) || 30,
      suspiciousAccountDays: parseInt(elements.suspiciousDays.value) || 365,
      highRatingThreshold: parseInt(elements.highRating.value) || 2000,
      rapidRatingGainDays: 30, // Keep default for now
      rapidRatingGainAmount: 300, // Keep default for now
      minGamesRequired: parseInt(elements.minGames.value) || 50,
      suspiciousWinRate: parseInt(elements.winRate.value) || 75,
      suspicionAlertLevel: 'high', // Keep default for now
    },
    features: {
      useCssDetection: elements.cssDetectionCheck.checked,
    },
  };

  await browser.storage.local.set({ settings });

  // Notify background and content scripts of settings update
  await browser.runtime.sendMessage({ type: 'SETTINGS_UPDATED', data: settings });
}

// Reset settings
async function resetSettings() {
  await browser.storage.local.remove(['settings']);
  // Notify background and content scripts
  await browser.runtime.sendMessage({ type: 'SETTINGS_UPDATED', data: null });
}

// Show error
function showError(message: string) {
  hideAll();
  elements.error.classList.remove('hidden');
  elements.errorText.textContent = message;
}

// Hide all sections
function hideAll() {
  elements.loading.classList.add('hidden');
  elements.error.classList.add('hidden');
  elements.results.classList.add('hidden');
}

// Simple injection function that runs directly in the page context
function injectSimpleButtons(platform: string, suspiciousAccountDays: number) {
  let count = 0;
  const uniqueUsernames = new Set<string>();
  console.log('Injecting buttons for platform:', platform);

  // Helper function to format age in a human-friendly way
  function formatFriendlyAge(days: number): string {
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return weeks === 1 ? '1 week' : `${weeks} weeks`;
    }
    if (days < 365) {
      const months = Math.floor(days / 30);
      return months === 1 ? '1 month' : `${months} months`;
    }
    const years = Math.floor(days / 365);
    return years === 1 ? '1 year' : `${years} years`;
  }

  // Add basic styles if not already present
  if (!document.getElementById('sus-meter-simple-styles')) {
    const style = document.createElement('style');
    style.id = 'sus-meter-simple-styles';
    style.textContent = `
      .sus-meter-quick-btn {
        display: inline-block;
        width: 18px;
        height: 18px;
        margin-left: 4px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        cursor: pointer;
        vertical-align: middle;
        line-height: 18px;
        text-align: center;
      }
      .sus-meter-quick-btn:hover {
        background: #5a67d8;
        transform: scale(1.1);
      }
      .sus-meter-info-panel {
        position: absolute;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 11px;
        color: #374151;
        min-width: 120px;
        display: none;
      }
      .sus-meter-info-panel.show {
        display: block;
      }
      .sus-meter-info-row {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
      }
      .sus-meter-info-label {
        font-weight: 600;
        color: #6b7280;
      }
      .sus-meter-info-value {
        font-weight: bold;
      }
      .sus-meter-info-value.new {
        color: #dc2626;
      }
      .sus-meter-info-value.recent {
        color: #ea580c;
      }
      .sus-meter-info-value.established {
        color: #16a34a;
      }
    `;
    document.head.appendChild(style);
  }

  // Find user links based on platform
  const userElements: Element[] = [];

  if (platform === 'lichess') {
    // Multiple selectors for Lichess usernames
    const selectors = [
      '.user-link[data-href]', // Standard user links
      'a.user-link[href*="/@/"]', // User links with href
      'span.user-link[data-href]', // Span user links
      '.text[data-href*="/@/"]', // Text elements with user links
      'a[href^="/@/"]', // Direct user profile links
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (!el.classList.contains('sus-meter-injected')) {
          userElements.push(el);
        }
      });
    });
  } else {
    // Multiple selectors for Chess.com usernames
    const selectors = [
      '.cc-user-username-component', // Standard username component
      '.user-username-component', // Alternative username component
      'a[href*="/member/"]', // Links to member profiles
      '.user-tagline-username', // Username in taglines
      'a.username', // Username links
      '[data-test-element*="username"]', // Elements with username test attributes
      '.player-name', // Player names in games
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (!el.classList.contains('sus-meter-injected')) {
          userElements.push(el);
        }
      });
    });
  }

  console.log(`Found ${userElements.length} potential user elements`);

  // Track all buttons and info panels for the same username
  const usernameButtons: { [key: string]: HTMLButtonElement[] } = {};
  const usernamePanels: { [key: string]: HTMLDivElement[] } = {};

  userElements.forEach((element) => {
    let username: string | null = null;

    if (platform === 'lichess') {
      // Try data-href first
      const dataHref = element.getAttribute('data-href');
      if (dataHref) {
        const match = dataHref.match(/\/@\/([^\/\?]+)/);
        if (match) username = match[1] || null;
      }

      // Try href attribute
      if (!username) {
        const href = element.getAttribute('href');
        if (href) {
          const match = href.match(/\/@\/([^\/\?]+)/);
          if (match) username = match[1] || null;
        }
      }

      // Fallback to text content
      if (!username && element.textContent) {
        const text = element.textContent.trim();
        if (text && !text.includes(' ') && text.length > 0 && text.length < 30) {
          username = text;
        }
      }
    } else {
      // For Chess.com, try href first
      const href = element.getAttribute('href');
      if (href) {
        const match = href.match(/\/member\/([^\/\?]+)/);
        if (match) username = match[1] || null;
      }

      // Fallback to text content
      if (!username && element.textContent) {
        const text = element.textContent.trim();
        if (text && !text.includes(' ') && text.length > 0 && text.length < 30) {
          username = text;
        }
      }
    }

    if (username) {
      // Track unique usernames
      const wasNewUser = !uniqueUsernames.has(username);
      uniqueUsernames.add(username);

      console.log(
        `Adding button for username: ${username} (${wasNewUser ? 'first occurrence' : 'duplicate'})`,
      );

      const button = document.createElement('button');
      button.className = 'sus-meter-quick-btn';
      button.textContent = '?';
      button.title = `Click to analyze ${username}`;

      // Store username in dataset
      button.dataset['username'] = username;

      // Track all buttons for this username
      if (!usernameButtons[username]) {
        usernameButtons[username] = [];
      }
      usernameButtons[username]!.push(button);

      // Create info panel (always shown)
      const infoPanel = document.createElement('div');
      infoPanel.className = 'sus-meter-info-panel';
      infoPanel.innerHTML = `
        <div class="sus-meter-info-row">
          <span class="sus-meter-info-label">Loading...</span>
        </div>
      `;
      document.body.appendChild(infoPanel);

      // Track all info panels for this username
      if (!usernamePanels[username]) {
        usernamePanels[username] = [];
      }
      usernamePanels[username]!.push(infoPanel);

      // Store the current button index for this username
      const buttonIndex = usernameButtons[username]!.length - 1;

      // Add hover handlers to show panel when hovering over analyzed button
      button.onmouseenter = () => {
        // Only show on hover if button has been analyzed (has data stored)
        if (button.dataset['analyzed'] === 'true') {
          const panel = usernamePanels[username!]?.[buttonIndex];
          if (panel) {
            // Rebuild panel content from stored data
            const age = button.dataset['age'];
            const games = button.dataset['games'];
            const rating = button.dataset['rating'];
            const ageClass = button.dataset['ageClass'];

            panel.innerHTML = `
              <div class="sus-meter-info-row">
                <span class="sus-meter-info-label">User:</span>
                <span class="sus-meter-info-value">${username}</span>
              </div>
              <div class="sus-meter-info-row">
                <span class="sus-meter-info-label">Age:</span>
                <span class="sus-meter-info-value ${ageClass}">${formatFriendlyAge(parseInt(age || '0'))}</span>
              </div>
              <div class="sus-meter-info-row">
                <span class="sus-meter-info-label">Games:</span>
                <span class="sus-meter-info-value">${games}</span>
              </div>
              <div class="sus-meter-info-row">
                <span class="sus-meter-info-label">Rating:</span>
                <span class="sus-meter-info-value">${rating}</span>
              </div>
            `;

            const rect = button.getBoundingClientRect();
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.bottom + 5}px`;
            panel.classList.add('show');
          }
        }
      };

      button.onmouseleave = () => {
        // Hide panel when mouse leaves
        const panel = usernamePanels[username!]?.[buttonIndex];
        if (panel) {
          panel.classList.remove('show');
        }
      };

      button.onclick = () => {
        // Update all buttons and panels for this username
        const allButtons = usernameButtons[username!] || [button];
        const allPanels = usernamePanels[username!] || [infoPanel];

        allButtons.forEach((btn) => {
          btn.textContent = '...';
          btn.disabled = true;
        });

        // Fetch real data from the extension's background script
        chrome.runtime.sendMessage(
          {
            type: 'ANALYZE_PROFILE',
            username: username,
            platform: platform,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error fetching profile:', chrome.runtime.lastError);
              // Fallback to error state
              allButtons.forEach((btn) => {
                btn.textContent = '!';
                btn.style.background = '#ef4444';
                btn.title = 'Failed to analyze';
                btn.disabled = false;
              });
              return;
            }

            if (response && response.profile) {
              const profile = response.profile;
              const isSuspicious = profile.accountAge < suspiciousAccountDays;
              const ageClass = isSuspicious ? 'new' : 'established';

              // Get main rating
              const mainRating =
                profile.ratings?.blitz || profile.ratings?.rapid || profile.ratings?.bullet || 0;

              // Update all buttons and their corresponding panels
              allButtons.forEach((btn, index) => {
                btn.textContent = isSuspicious ? '!' : '✓';
                btn.style.background = isSuspicious ? '#fb923c' : '#48bb78';
                btn.title = `${username} - ${formatFriendlyAge(profile.accountAge)}`;
                btn.disabled = false;
                // Mark button as analyzed so hover will work
                btn.dataset['analyzed'] = 'true';
                // Store the data for future hover events
                btn.dataset['age'] = String(profile.accountAge);
                btn.dataset['games'] = String(profile.gameStats?.total || 0);
                btn.dataset['rating'] = String(mainRating);
                btn.dataset['ageClass'] = ageClass;

                // Get the corresponding panel
                const panel = allPanels[index];
                if (panel) {
                  // Update info panel content
                  panel.innerHTML = `
                  <div class="sus-meter-info-row">
                    <span class="sus-meter-info-label">User:</span>
                    <span class="sus-meter-info-value">${username}</span>
                  </div>
                  <div class="sus-meter-info-row">
                    <span class="sus-meter-info-label">Age:</span>
                    <span class="sus-meter-info-value ${ageClass}">${formatFriendlyAge(profile.accountAge)}</span>
                  </div>
                  <div class="sus-meter-info-row">
                    <span class="sus-meter-info-label">Games:</span>
                    <span class="sus-meter-info-value">${profile.gameStats?.total || 0}</span>
                  </div>
                  ${
                    profile.gameStats?.rated !== undefined
                      ? `
                    <div class="sus-meter-info-row" style="padding-left: 8px; font-size: 11px;">
                      <span class="sus-meter-info-label">Rated:</span>
                      <span class="sus-meter-info-value">${profile.gameStats.rated}</span>
                    </div>
                    <div class="sus-meter-info-row" style="padding-left: 8px; font-size: 11px;">
                      <span class="sus-meter-info-label">Unrated:</span>
                      <span class="sus-meter-info-value">${profile.gameStats.unrated || 0}</span>
                    </div>
                  `
                      : ''
                  }
                  <div class="sus-meter-info-row">
                    <span class="sus-meter-info-label">Rating:</span>
                    <span class="sus-meter-info-value">${mainRating || 'Unrated'}</span>
                  </div>
                `;

                  // Position the info panel near the button
                  const rect = btn.getBoundingClientRect();
                  panel.style.left = `${rect.left}px`;
                  panel.style.top = `${rect.bottom + 5}px`;
                  panel.classList.add('show');

                  // Hide after 3 seconds
                  setTimeout(() => {
                    panel.classList.remove('show');
                  }, 3000);
                }
              });
            } else {
              // No profile found
              allButtons.forEach((btn) => {
                btn.textContent = '×';
                btn.style.background = '#6b7280';
                btn.title = `Profile not found: ${username}`;
                btn.disabled = false;
              });
            }
          },
        );
      };

      element.classList.add('sus-meter-injected');

      // Try to insert the button in the best position
      if (element.parentElement) {
        element.parentElement.insertBefore(button, element.nextSibling);
      } else {
        element.appendChild(button);
      }

      count++;
    }
  });

  console.log(
    `Successfully injected ${count} buttons for ${uniqueUsernames.size} unique usernames`,
  );
  return { count, uniqueUsers: uniqueUsernames.size };
}

// Inject profile buttons
async function injectProfileButtons() {
  try {
    // Get the active tab
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      showInjectStatus('No active tab found', 'error');
      return;
    }

    // Check if tab URL is on a supported platform
    const url = tab.url || '';
    const isLichess = url.includes('lichess.org');
    const isChesscom = url.includes('chess.com');

    if (!isLichess && !isChesscom) {
      showInjectStatus('Please navigate to Lichess or Chess.com first', 'error');
      return;
    }

    // Disable button while processing
    elements.injectBtn.disabled = true;
    showInjectStatus('Injecting analysis buttons...', 'loading');

    try {
      console.log('Injecting buttons for:', isLichess ? 'lichess' : 'chess.com');

      // Directly inject the simple script - this always works
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectSimpleButtons,
        args: [
          isLichess ? 'lichess' : 'chess.com',
          currentSettings.thresholds.suspiciousAccountDays,
        ],
      });

      console.log('Script execution results:', results);

      if (results && results[0]) {
        const result = results[0].result as { count: number; uniqueUsers?: number } | undefined;
        if (result && typeof result.count === 'number') {
          if (result.count > 0) {
            const uniqueMsg = result.uniqueUsers ? ` for ${result.uniqueUsers} unique users` : '';
            showInjectStatus(`Injected ${result.count} analysis buttons${uniqueMsg}`, 'success');
          } else {
            showInjectStatus(
              'No usernames found on this page. Try navigating to a page with player profiles, chat, or game lists.',
              'error',
            );
          }
        } else {
          // If we get here, the injection ran but returned undefined/null
          // This is actually OK - it means the script ran successfully
          showInjectStatus('Injection completed. Check page for buttons.', 'success');
        }
      } else {
        showInjectStatus(
          'Could not inject buttons. Make sure you are on a Lichess or Chess.com page.',
          'error',
        );
      }
    } catch (error: any) {
      console.error('Failed to inject script:', error);

      // Provide more helpful error messages
      if (error.message?.includes('Cannot access')) {
        showInjectStatus(
          'Cannot access this page. Try refreshing or navigating to a different page.',
          'error',
        );
      } else if (error.message?.includes('chrome://') || error.message?.includes('edge://')) {
        showInjectStatus(
          'Cannot inject on browser pages. Please navigate to Lichess or Chess.com.',
          'error',
        );
      } else {
        showInjectStatus('Injection failed. Please check the console for details.', 'error');
      }
    }
  } catch (error) {
    console.error('Injection error:', error);
    showInjectStatus('An unexpected error occurred. Please check the console.', 'error');
  } finally {
    elements.injectBtn.disabled = false;
  }
}

// Show injection status
function showInjectStatus(message: string, type: 'success' | 'error' | 'loading') {
  elements.injectStatus.textContent = message;
  elements.injectStatus.className = `inject-status ${type}`;
  elements.injectStatus.classList.remove('hidden');

  // Auto-hide success/error messages after 3 seconds
  if (type !== 'loading') {
    setTimeout(() => {
      elements.injectStatus.classList.add('hidden');
    }, 3000);
  }
}

// Enable profile picker mode
async function enablePickerMode() {
  try {
    // Get active tab
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      showInjectStatus('No active tab found', 'error');
      return;
    }

    // Check if on supported platform
    const url = tab.url || '';
    const isLichess = url.includes('lichess.org');
    const isChesscom = url.includes('chess.com');

    if (!isLichess && !isChesscom) {
      showInjectStatus('Please navigate to Lichess or Chess.com first', 'error');
      return;
    }

    // Update UI
    elements.pickerBtn.classList.add('active');
    elements.pickerBtn.querySelector('span:last-child')!.textContent = 'Cancel';

    // Show picker status
    elements.injectStatus.textContent = '🎯 Click on any username to analyze';
    elements.injectStatus.className = 'inject-status picker-active';
    elements.injectStatus.classList.remove('hidden');

    // Inject the picker script
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectPickerMode,
      args: [isLichess ? 'lichess' : 'chess.com'],
    });
  } catch (error) {
    console.error('Failed to enable picker mode:', error);
    showInjectStatus('Failed to enable picker mode', 'error');
    elements.pickerBtn.classList.remove('active');
  }
}

// Disable profile picker mode
async function disablePickerMode() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (tab?.id) {
      // Remove picker mode from page
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: removePickerMode,
      });
    }

    // Update UI
    elements.pickerBtn.classList.remove('active');
    elements.pickerBtn.querySelector('span:last-child')!.textContent = 'Pick Profile';
    elements.injectStatus.classList.add('hidden');
  } catch (error) {
    console.error('Failed to disable picker mode:', error);
  }
}

// Inject picker mode script
function injectPickerMode(platform: string) {
  console.log('Activating picker mode for platform:', platform);

  // Clean up any existing picker mode first
  if ((window as any).__susPickerCleanup) {
    (window as any).__susPickerCleanup();
  }

  // Mark picker as active
  (window as any).__susPickerActive = true;

  // Add picker styles
  const style = document.createElement('style');
  style.id = 'sus-meter-picker-styles';
  style.textContent = `
    .sus-meter-hover-highlight {
      outline: 2px solid #667eea !important;
      outline-offset: 2px !important;
      background-color: rgba(102, 126, 234, 0.1) !important;
      position: relative !important;
      cursor: pointer !important;
    }
    .sus-meter-hover-highlight::after {
      content: '🎯 Click to analyze' !important;
      position: absolute !important;
      top: -25px !important;
      left: 0 !important;
      background: #667eea !important;
      color: white !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      font-size: 11px !important;
      font-weight: bold !important;
      white-space: nowrap !important;
      z-index: 100000 !important;
      pointer-events: none !important;
    }
    .sus-meter-picker-active-indicator {
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      background: #667eea !important;
      color: white !important;
      padding: 10px 15px !important;
      border-radius: 8px !important;
      font-size: 13px !important;
      font-weight: bold !important;
      z-index: 100000 !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
      animation: pulse 2s infinite !important;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.7; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Add picker mode indicator
  const indicator = document.createElement('div');
  indicator.className = 'sus-meter-picker-active-indicator';
  indicator.textContent = '🎯 Picker Mode Active - ESC to exit';
  document.body.appendChild(indicator);

  // Add picker mode class to body
  document.body.classList.add('sus-meter-picker-mode');

  // Username extraction patterns
  const patterns =
    platform === 'lichess'
      ? {
          selectors: [
            'a[href*="/@/"]',
            '.user-link[data-href]',
            'span.user-link',
            '.text[data-href*="/@/"]',
          ],
          extract: (el: Element) => {
            const href = el.getAttribute('href') || el.getAttribute('data-href');
            if (href) {
              const match = href.match(/\/@\/([^\/\?]+)/);
              if (match) return match[1];
            }
            return el.textContent?.trim();
          },
        }
      : {
          selectors: [
            'a[href*="/member/"]',
            '.user-username-component',
            '.username',
            '[data-username]',
          ],
          extract: (el: Element) => {
            const href = el.getAttribute('href');
            if (href) {
              const match = href.match(/\/member\/([^\/\?]+)/);
              if (match) return match[1];
            }
            const dataUsername = el.getAttribute('data-username');
            if (dataUsername) return dataUsername;
            return el.textContent?.trim();
          },
        };

  let hoveredElement: Element | null = null;

  // Mouse move handler
  const handleMouseMove = (e: MouseEvent) => {
    // Skip if picker is not active
    if (!(window as any).__susPickerActive) return;

    const target = e.target as Element;

    // Remove previous highlight
    if (hoveredElement && hoveredElement !== target) {
      hoveredElement.classList.remove('sus-meter-hover-highlight');
    }

    // Check if element contains username
    let usernameElement: Element | null = null;
    for (const selector of patterns.selectors) {
      if (target.matches(selector)) {
        usernameElement = target;
        break;
      }
      const parent = target.closest(selector);
      if (parent) {
        usernameElement = parent;
        break;
      }
    }

    if (usernameElement) {
      usernameElement.classList.add('sus-meter-hover-highlight');
      hoveredElement = usernameElement;
      console.log('Hovering over username element:', patterns.extract(usernameElement));
    } else {
      hoveredElement = null;
    }
  };

  // Click handler - only prevent default for username elements
  const handleClick = (e: MouseEvent) => {
    // Skip if picker is not active
    if (!(window as any).__susPickerActive) return;

    // Check if we're clicking on a username element
    const target = e.target as Element;
    let isUsernameElement = false;

    // Check if target or its parent is a username element
    for (const selector of patterns.selectors) {
      if (target.matches(selector) || target.closest(selector)) {
        isUsernameElement = true;
        break;
      }
    }

    // Only process if we have a hovered element AND clicked on a username element
    if (hoveredElement && isUsernameElement) {
      // Only prevent default for the username element we're clicking
      e.preventDefault();
      e.stopPropagation();

      const username = patterns.extract(hoveredElement);
      console.log('Picker clicked on username:', username);

      if (username && username.length >= 2) {
        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'sus-meter-picker-loading';
        loadingDiv.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #667eea;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: bold;
          z-index: 100001;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        loadingDiv.textContent = `Analyzing ${username}...`;
        document.body.appendChild(loadingDiv);

        // Send message to background script
        chrome.runtime
          .sendMessage({
            type: 'PICKER_SELECTION',
            username: username.toLowerCase(),
            platform: platform,
          })
          .then((response) => {
            console.log('Picker selection sent, response:', response);

            if (response && response.success && response.profile) {
              // Profile analyzed successfully
              loadingDiv.textContent = '✓ Analysis complete';
              loadingDiv.style.background = '#48bb78';

              // Check if popup is still open
              chrome.runtime
                .sendMessage({ type: 'POPUP_CHECK' })
                .then(() => {
                  // Popup is open, it will handle the display
                  setTimeout(() => {
                    loadingDiv.remove();
                    if ((window as any).__susPickerCleanup) {
                      (window as any).__susPickerCleanup();
                    }
                  }, 1000);
                })
                .catch(() => {
                  // Popup is closed
                  setTimeout(() => {
                    loadingDiv.remove();
                    if ((window as any).__susPickerCleanup) {
                      (window as any).__susPickerCleanup();
                    }
                  }, 1500);
                });
            } else {
              loadingDiv.textContent = 'Analysis failed';
              loadingDiv.style.background = '#ef4444';
              setTimeout(() => {
                loadingDiv.remove();
                if ((window as any).__susPickerCleanup) {
                  (window as any).__susPickerCleanup();
                }
              }, 2000);
            }
          })
          .catch((error) => {
            console.error('Failed to send picker selection:', error);
            loadingDiv.textContent = 'Failed to analyze';
            loadingDiv.style.background = '#ef4444';
            setTimeout(() => {
              loadingDiv.remove();
              if ((window as any).__susPickerCleanup) {
                (window as any).__susPickerCleanup();
              }
            }, 2000);
          });
      }
    }
  };

  // Escape key handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (window as any).__susPickerActive) {
      if ((window as any).__susPickerCleanup) {
        (window as any).__susPickerCleanup();
      }
    }
  };

  // Store event handlers globally for proper cleanup
  (window as any).__susPickerHandlers = {
    mouseMove: handleMouseMove,
    click: handleClick,
    keyDown: handleKeyDown,
  };

  // Store cleanup function
  (window as any).__susPickerCleanup = () => {
    // Remove event listeners using the stored references
    if ((window as any).__susPickerHandlers) {
      document.removeEventListener('mousemove', (window as any).__susPickerHandlers.mouseMove);
      document.removeEventListener('click', (window as any).__susPickerHandlers.click, true);
      document.removeEventListener('keydown', (window as any).__susPickerHandlers.keyDown);
    }

    // Remove highlights
    document.querySelectorAll('.sus-meter-hover-highlight').forEach((el) => {
      el.classList.remove('sus-meter-hover-highlight');
    });

    // Remove picker mode class and styles
    document.body.classList.remove('sus-meter-picker-mode');
    document.getElementById('sus-meter-picker-styles')?.remove();
    document.getElementById('sus-meter-picker-loading')?.remove();
    document.querySelector('.sus-meter-picker-active-indicator')?.remove();

    // Clean up global references
    delete (window as any).__susPickerCleanup;
    delete (window as any).__susPickerActive;
    delete (window as any).__susPickerHandlers;
  };

  // Add event listeners
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown);

  // Listen for status check messages
  const messageHandler = (request: any, _sender: any, sendResponse: any) => {
    if (request.type === 'CHECK_PICKER_MODE') {
      sendResponse({ active: (window as any).__susPickerActive === true });
    }
    return false;
  };
  chrome.runtime.onMessage.addListener(messageHandler);
}

// Remove picker mode
function removePickerMode() {
  // Use the global cleanup function if it exists
  if ((window as any).__susPickerCleanup) {
    (window as any).__susPickerCleanup();
  } else {
    // Fallback cleanup
    document.body.classList.remove('sus-meter-picker-mode');
    document.getElementById('sus-meter-picker-overlay')?.remove();
    document.getElementById('sus-meter-picker-styles')?.remove();
    document.getElementById('sus-meter-picker-loading')?.remove();
    document.querySelector('.sus-meter-picker-active-indicator')?.remove();

    // Remove any highlights
    document.querySelectorAll('.sus-meter-hover-highlight').forEach((el) => {
      el.classList.remove('sus-meter-hover-highlight');
    });
  }
}

export {};
