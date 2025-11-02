import browser from 'webextension-polyfill';
import { ChessProfile, ChessPlatform } from '@/types';
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
};

// State
let searchHistory: SearchHistoryItem[] = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadHistory();
  setupListeners();
  elements.usernameInput.focus();
});

// Setup event listeners
function setupListeners() {
  // Search
  elements.searchBtn.addEventListener('click', performSearch);
  elements.usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  // Clear history
  elements.clearHistory.addEventListener('click', async () => {
    searchHistory = [];
    await saveHistory();
    displayHistory();
  });
}

// Get selected platform
function getSelectedPlatform(): ChessPlatform {
  const checked = document.querySelector('input[name="platform"]:checked') as HTMLInputElement;
  return (checked?.value as ChessPlatform) || 'lichess';
}

// Perform search
async function performSearch() {
  const username = elements.usernameInput.value.trim();
  const platform = getSelectedPlatform();

  if (!username) {
    showError('Please enter a username');
    return;
  }

  hideAll();
  elements.loading.classList.remove('hidden');

  try {
    // Check cache first
    let profile = await CacheManager.getCachedProfile(username, platform);

    if (!profile) {
      // Fetch from API
      profile = await ChessAPIClient.fetchProfile(username, platform);

      if (profile) {
        // Analyze profile
        profile = ProfileAnalyzer.analyzeProfile(profile);
        // Cache it
        await CacheManager.cacheProfile(profile);
      }
    }

    if (profile) {
      displayResults(profile);
      await addToHistory(profile);
    } else {
      showError(`User "${username}" not found on ${platform}`);
    }
  } catch (err) {
    console.error('Search error:', err);
    showError('Failed to fetch profile. Please try again.');
  }
}

// Display results
function displayResults(profile: ChessProfile) {
  hideAll();
  elements.results.classList.remove('hidden');

  // Age card styling
  elements.ageCard.className = 'age-card';
  if (profile.accountAge < 7) {
    elements.ageCard.classList.add('new');
  } else if (profile.accountAge < 30) {
    elements.ageCard.classList.add('recent');
  } else {
    elements.ageCard.classList.add('established');
  }

  // Age display
  elements.ageValue.textContent = formatAge(profile.accountAge);
  const created = new Date(profile.createdAt);
  elements.ageDate.textContent = `Created ${created.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })}`;

  // Profile info
  elements.username.textContent = profile.username;
  elements.platformTag.textContent = profile.platform.toUpperCase();

  // Stats
  const mainRating = profile.ratings.blitz || profile.ratings.rapid || profile.ratings.bullet || 0;
  elements.rating.textContent = mainRating ? mainRating.toString() : 'Unrated';
  elements.games.textContent = profile.gameStats.total.toLocaleString();
  elements.winrate.textContent = `${profile.gameStats.winRate}%`;

  // Suspicion
  elements.suspicionLevel.textContent = profile.suspicionLevel.replace('_', ' ').toUpperCase();
  elements.suspicionLevel.className = `suspicion-level ${profile.suspicionLevel}`;
  elements.suspicionFill.style.width = `${profile.suspicionScore}%`;

  // Suspicion reasons
  elements.suspicionReasons.innerHTML = '';
  if (profile.suspicionReasons.length > 0) {
    profile.suspicionReasons.forEach(reason => {
      const li = document.createElement('li');
      li.textContent = reason;
      elements.suspicionReasons.appendChild(li);
    });
  }
}

// Format age for display
function formatAge(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return '1 Day';
  if (days < 7) return `${days} Days`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 Week' : `${weeks} Weeks`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? '1 Month' : `${months} Months`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? '1 Year' : `${years} Years`;
}

// Add to history
async function addToHistory(profile: ChessProfile) {
  const item: SearchHistoryItem = {
    username: profile.username,
    platform: profile.platform,
    accountAge: profile.accountAge,
    timestamp: Date.now()
  };

  // Remove if exists
  searchHistory = searchHistory.filter(h =>
    !(h.username === item.username && h.platform === item.platform)
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

  searchHistory.forEach(item => {
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
    if (item.accountAge < 7) age.classList.add('new');
    age.textContent = item.accountAge < 7 ? 'NEW' : `${item.accountAge}d`;

    div.appendChild(userDiv);
    div.appendChild(age);

    div.addEventListener('click', () => {
      elements.usernameInput.value = item.username;
      const radio = document.querySelector(`input[value="${item.platform}"]`) as HTMLInputElement;
      if (radio) radio.checked = true;
      performSearch();
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

export {};