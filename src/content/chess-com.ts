import browser from 'webextension-polyfill';
import { ProfileDetection, ChessPlatform, ExtensionMessage } from '@/types';
import { createLogger } from '@/utils/logger';
import { ProfileInjector } from './profile-injector';

const logger = createLogger('ChessComContent');
const platform: ChessPlatform = 'chess.com';

/**
 * Chess.com-specific profile detector
 */
export class ChessComProfileDetector {
  private observer: MutationObserver | null = null;
  private injector: ProfileInjector;
  private detectedProfiles = new Set<string>();
  private isEnabled = true;

  constructor() {
    this.injector = new ProfileInjector(platform);
  }

  /**
   * Initialize the detector
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Chess.com profile detector');

    // Check if extension is enabled
    try {
      const response = await browser.runtime.sendMessage({
        type: 'GET_SETTINGS',
      }) as any;

      this.isEnabled = response?.enabled ?? true;
    } catch (error) {
      logger.error('Failed to get settings:', error);
      this.isEnabled = true;
    }

    if (this.isEnabled) {
      this.startDetection();
    }

    // Listen for enable/disable messages
    browser.runtime.onMessage.addListener((message: unknown, sender: any, sendResponse: any): true => {
      this.handleMessage(message as ExtensionMessage, sender, sendResponse);
      return true; // Always return true for async response
    });
  }

  /**
   * Start detecting profiles on the page
   */
  private startDetection(): void {
    // Initial scan
    this.scanForProfiles();

    // Set up mutation observer for dynamic content
    this.observer = new MutationObserver((mutations) => {
      // Batch mutations to avoid excessive scanning
      const hasRelevantChanges = mutations.some(mutation =>
        mutation.type === 'childList' && mutation.addedNodes.length > 0
      );

      if (hasRelevantChanges) {
        this.scanForProfiles();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    logger.debug('Started profile detection');
  }

  /**
   * Stop detecting profiles
   */
  private stopDetection(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Clean up injected badges
    this.injector.removeAllBadges();
    this.detectedProfiles.clear();

    logger.debug('Stopped profile detection');
  }

  /**
   * Scan the page for user profiles
   */
  private scanForProfiles(): void {
    if (!this.isEnabled) return;

    const profiles = this.findProfileElements();
    const newProfiles: ProfileDetection[] = [];

    profiles.forEach(profile => {
      const key = `${profile.username}:${profile.element.tagName}:${profile.context}`;

      if (!this.detectedProfiles.has(key)) {
        this.detectedProfiles.add(key);
        newProfiles.push(profile);
      }
    });

    if (newProfiles.length > 0) {
      this.processProfiles(newProfiles);
    }
  }

  /**
   * Find all profile elements on the page
   */
  private findProfileElements(): ProfileDetection[] {
    const profiles: ProfileDetection[] = [];

    // Chat messages - usernames in live chat
    const chatUsers = document.querySelectorAll(
      '.chat-message-component .username-component, ' +
      '.live-chat-message .username, ' +
      '.chat-message .user-username-component'
    );
    chatUsers.forEach(element => {
      const username = this.extractUsername(element as HTMLElement);
      if (username) {
        profiles.push({
          element: element as HTMLElement,
          username,
          context: 'chat',
          platform,
        });
      }
    });

    // Game pages - player names in live and daily games
    const gamePlayers = document.querySelectorAll(
      '.player-component .user-username-component, ' +
      '.player-tagline .user-username-component, ' +
      '.game-player-name .username, ' +
      '.board-player-userinfo .user-username-link'
    );
    gamePlayers.forEach(element => {
      const username = this.extractUsername(element as HTMLElement);
      if (username) {
        profiles.push({
          element: element as HTMLElement,
          username,
          context: 'game',
          platform,
        });
      }
    });

    // Tournament pages and arenas
    const tournamentPlayers = document.querySelectorAll(
      '.tournament-players-table .user-username-component, ' +
      '.arena-leaderboard .user-username-component, ' +
      '.tournament-player-row .username'
    );
    tournamentPlayers.forEach(element => {
      const username = this.extractUsername(element as HTMLElement);
      if (username) {
        profiles.push({
          element: element as HTMLElement,
          username,
          context: 'tournament',
          platform,
        });
      }
    });

    // Profile pages
    const profileHeaders = document.querySelectorAll(
      '.profile-header-username, ' +
      '.profile-card-username .user-username-component, ' +
      '.member-header-username'
    );
    profileHeaders.forEach(element => {
      const username = this.extractUsername(element as HTMLElement);
      if (username) {
        profiles.push({
          element: element as HTMLElement,
          username,
          context: 'profile',
          platform,
        });
      }
    });

    // Friends list and clubs
    const friendsList = document.querySelectorAll(
      '.friends-list .user-username-component, ' +
      '.club-members .user-username-component, ' +
      '.connections-user-item .username'
    );
    friendsList.forEach(element => {
      const username = this.extractUsername(element as HTMLElement);
      if (username) {
        profiles.push({
          element: element as HTMLElement,
          username,
          context: 'list',
          platform,
        });
      }
    });

    // Live chess lobby and game lists
    const lobbyPlayers = document.querySelectorAll(
      '.seekers-table .user-username-component, ' +
      '.games-list-item .user-username-component, ' +
      '.live-game-item .username'
    );
    lobbyPlayers.forEach(element => {
      const username = this.extractUsername(element as HTMLElement);
      if (username) {
        profiles.push({
          element: element as HTMLElement,
          username,
          context: 'list',
          platform,
        });
      }
    });

    // Analysis board and game review
    const analysisPlayers = document.querySelectorAll(
      '.analysis-player-info .user-username-component, ' +
      '.game-review-player .username'
    );
    analysisPlayers.forEach(element => {
      const username = this.extractUsername(element as HTMLElement);
      if (username) {
        profiles.push({
          element: element as HTMLElement,
          username,
          context: 'game',
          platform,
        });
      }
    });

    logger.debug(`Found ${profiles.length} profile elements`);
    return profiles;
  }

  /**
   * Extract username from a Chess.com user element
   */
  private extractUsername(element: HTMLElement): string | null {
    // Try data attributes first
    const dataUsername = element.getAttribute('data-username');
    if (dataUsername) {
      return dataUsername;
    }

    // Try href attribute for links
    const href = element.getAttribute('href');
    if (href) {
      // Chess.com profile URLs: /member/username or /players/username
      const match = href.match(/\/(member|players|profile)\/([^\/\?]+)/);
      if (match && match[2]) {
        return match[2];
      }
    }

    // Check parent elements for links
    const parentLink = element.closest('a[href*="/member/"], a[href*="/players/"], a[href*="/profile/"]');
    if (parentLink) {
      const parentHref = parentLink.getAttribute('href');
      if (parentHref) {
        const match = parentHref.match(/\/(member|players|profile)\/([^\/\?]+)/);
        if (match && match[2]) {
          return match[2] || null;
        }
      }
    }

    // Try text content as last resort
    const text = element.textContent?.trim();
    if (text && !text.includes(' ') && text.length > 0 && text.length < 30) {
      // Validate it looks like a username
      if (/^[a-zA-Z0-9_-]+$/.test(text)) {
        return text;
      }
    }

    return null;
  }

  /**
   * Process detected profiles
   */
  private async processProfiles(profiles: ProfileDetection[]): Promise<void> {
    logger.debug(`Processing ${profiles.length} new profiles`);

    // Send profiles to background script for analysis
    const message: ExtensionMessage = {
      type: 'PROFILES_DETECTED',
      data: profiles.map(p => ({
        username: p.username,
        context: p.context,
      })),
      platform,
    };

    try {
      const response = await browser.runtime.sendMessage(message) as any;

      if (response && response.profiles) {
        // Inject badges for analyzed profiles
        profiles.forEach(detection => {
          const profileData = response.profiles[detection.username];
          if (profileData) {
            this.injector.injectBadge(detection.element, profileData);
          }
        });
      }
    } catch (error) {
      logger.error('Error processing profiles:', error);
    }
  }

  /**
   * Handle messages from background script
   */
  private handleMessage(
    request: ExtensionMessage,
    _sender: browser.Runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean {
    switch (request.type) {
      case 'TOGGLE_ENABLED':
        this.isEnabled = request.data?.enabled ?? false;
        if (this.isEnabled) {
          this.startDetection();
        } else {
          this.stopDetection();
        }
        sendResponse({ success: true });
        break;

      case 'SETTINGS_UPDATED':
        // Re-scan with new settings
        this.injector.updateSettings(request.data);
        this.detectedProfiles.clear();
        this.scanForProfiles();
        sendResponse({ success: true });
        break;
    }

    return true;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopDetection();
    logger.info('Chess.com profile detector destroyed');
  }
}

// Initialize detector when content script loads
const detector = new ChessComProfileDetector();
detector.initialize().catch(error => {
  logger.error('Failed to initialize Chess.com detector:', error);
});

// Clean up on unload
window.addEventListener('unload', () => {
  detector.destroy();
});