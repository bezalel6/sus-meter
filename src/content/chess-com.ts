import browser from 'webextension-polyfill';
import type { ProfileDetection, ChessPlatform, ExtensionMessage } from '@/types';
import { createLogger } from '@/utils/logger';
import { ProfileInjector } from './profile-injector';
import { ProfileButtonInjector } from './profile-button-injector';

const logger = createLogger('ChessComContent');
const platform: ChessPlatform = 'chess.com';

/**
 * Chess.com-specific profile detector
 */
export class ChessComProfileDetector {
  private observer: MutationObserver | null = null;
  private animationHandler: ((e: AnimationEvent) => void) | null = null;
  private injector: ProfileInjector;
  private buttonInjector: ProfileButtonInjector;
  private detectedProfiles = new Set<string>();
  private isEnabled = true;
  private useCssDetection = false;

  constructor() {
    this.injector = new ProfileInjector(platform);
    this.buttonInjector = new ProfileButtonInjector(platform);
  }

  /**
   * Initialize the detector
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Chess.com profile detector');

    // Check if extension is enabled and get settings
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'GET_SETTINGS',
      })) as any;

      this.isEnabled = response?.enabled ?? true;
      this.useCssDetection = response?.features?.useCssDetection ?? false;
    } catch (error) {
      logger.error('Failed to get settings:', error);
      this.isEnabled = true;
      this.useCssDetection = false;
    }

    if (this.isEnabled) {
      this.startDetection();
    }

    // Listen for enable/disable messages
    browser.runtime.onMessage.addListener(((message: unknown, sender: any, sendResponse: any) => {
      return this.handleMessage(message as ExtensionMessage, sender, sendResponse);
    }) as any);
  }

  /**
   * Start detecting profiles on the page
   */
  private startDetection(): void {
    // Initial scan for already-present elements
    this.scanForProfiles();

    if (this.useCssDetection) {
      // Use CSS animation detection (more efficient)
      this.startCssDetection();
    } else {
      // Use MutationObserver (fallback)
      this.startMutationObserver();
    }

    logger.debug(
      `Started profile detection (${this.useCssDetection ? 'CSS animation' : 'MutationObserver'})`,
    );
  }

  /**
   * Start CSS animation-based detection
   */
  private startCssDetection(): void {
    this.animationHandler = (event: AnimationEvent) => {
      if (event.animationName === 'sus-meter-detect') {
        this.handleNewElement(event.target as HTMLElement);
      }
    };

    document.addEventListener('animationstart', this.animationHandler, true);
    logger.debug('CSS animation detection active');
  }

  /**
   * Start MutationObserver-based detection (fallback)
   */
  private startMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      // Batch mutations to avoid excessive scanning
      const hasRelevantChanges = mutations.some(
        (mutation) => mutation.type === 'childList' && mutation.addedNodes.length > 0,
      );

      if (hasRelevantChanges) {
        this.scanForProfiles();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    logger.debug('MutationObserver detection active');
  }

  /**
   * Handle a newly detected element (CSS detection)
   */
  private handleNewElement(element: HTMLElement): void {
    if (!this.isEnabled) return;

    const username = this.extractUsername(element);
    if (!username) return;

    const context = this.determineContext(element);
    const key = `${username}:${element.tagName}:${context}`;

    if (this.detectedProfiles.has(key)) return;

    this.detectedProfiles.add(key);
    this.processProfiles([
      {
        element,
        username,
        context,
        platform,
      },
    ]);
  }

  /**
   * Determine context from element location in DOM
   */
  private determineContext(
    element: HTMLElement,
  ): 'chat' | 'game' | 'tournament' | 'profile' | 'list' {
    // Use closest() for efficient context detection
    if (element.closest('.chat-message-component, .live-chat-message, .chat-message'))
      return 'chat';
    if (
      element.closest(
        '.player-component, .player-tagline, .game-player-name, .board-player-userinfo',
      )
    )
      return 'game';
    if (element.closest('.tournament-players-table, .arena-leaderboard, .tournament-player-row'))
      return 'tournament';
    if (
      element.closest('.profile-header-username, .profile-card-username, .member-header-username')
    )
      return 'profile';
    if (element.closest('.analysis-player-info, .game-review-player')) return 'game';
    if (element.closest('.friends-list, .club-members, .connections-user-item')) return 'list';
    if (element.closest('.seekers-table, .games-list-item, .live-game-item')) return 'list';

    return 'list'; // Default
  }

  /**
   * Stop detecting profiles
   */
  private stopDetection(): void {
    // Clean up MutationObserver
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Clean up CSS animation listener
    if (this.animationHandler) {
      document.removeEventListener('animationstart', this.animationHandler, true);
      this.animationHandler = null;
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

    profiles.forEach((profile) => {
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

    // Comprehensive selector matching CSS detection selectors
    const selector = [
      '.user-username-component',
      '.username-component',
      '[class*="username"]',
      '[data-username]',
      '[data-user]',
      'a[href*="/member/"]',
      'a[href*="/players/"]',
      'a[href*="/profile/"]',
      'a[href^="/member/"]',
      'a[href^="/players/"]',
      '.chat-message-component a',
      '.live-chat-message a',
      '.chat-message a',
      '.player-component a',
      '.player-tagline a',
      '.game-player-name a',
      '.board-player-userinfo a',
      '.tournament-players-table a',
      '.arena-leaderboard a',
      '.tournament-player-row a',
      '.profile-header-username',
      '.profile-card-username a',
      '.member-header-username',
      '.friends-list a',
      '.club-members a',
      '.connections-user-item a',
      '.seekers-table a',
      '.games-list-item a',
      '.live-game-item a',
      '.analysis-player-info a',
      '.game-review-player a',
      '[class*="player"] a[href]',
      '[class*="tournament"] a[href*="/member/"]',
      '[class*="game-item"] a[href]',
    ].join(', ');

    const allElements = document.querySelectorAll(selector);

    allElements.forEach((element) => {
      const username = this.extractUsername(element as HTMLElement);
      if (username) {
        const context = this.determineContext(element as HTMLElement);
        profiles.push({
          element: element as HTMLElement,
          username,
          context,
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
    const parentLink = element.closest(
      'a[href*="/member/"], a[href*="/players/"], a[href*="/profile/"]',
    );
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
      data: profiles.map((p) => ({
        username: p.username,
        context: p.context,
      })),
      platform,
    };

    try {
      const response = (await browser.runtime.sendMessage(message)) as any;

      if (response && response.profiles) {
        // Inject badges for analyzed profiles
        profiles.forEach((detection) => {
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
    sendResponse: (response?: any) => void,
  ): true | void {
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
        // Update settings and restart detection if detection method changed
        const newUseCssDetection = request.data?.features?.useCssDetection ?? false;
        const detectionMethodChanged = newUseCssDetection !== this.useCssDetection;

        this.injector.updateSettings(request.data);
        this.useCssDetection = newUseCssDetection;
        this.detectedProfiles.clear();

        if (detectionMethodChanged && this.isEnabled) {
          // Restart detection with new method
          this.stopDetection();
          this.startDetection();
        } else {
          // Just re-scan
          this.scanForProfiles();
        }

        sendResponse({ success: true });
        break;

      case 'INJECT_PROFILE_BUTTONS':
        // Inject analysis buttons for all profiles on page
        this.buttonInjector.injectButtons().then((result) => {
          sendResponse(result);
        });
        return true; // Keep message channel open for async response

      case 'DISPLAY_PICKER_RESULT':
        // Display picker analysis result
        const { username, profile } = request;
        if (username && profile) {
          this.displayPickerResult(username, profile);
        }
        sendResponse({ success: true });
        break;
    }
  }

  /**
   * Find all elements containing a specific username
   */
  private findUserElements(username: string): HTMLElement[] {
    const elements: HTMLElement[] = [];
    const usernameLC = username.toLowerCase();

    // All user link selectors for chess.com
    const selectors = [
      'a[href*="/member/"]',
      'a[href*="/players/"]',
      'a[href*="/profile/"]',
      '.username',
      '.user-username',
      '.user-username-component',
      '.user-tagline-username',
      '[data-username]',
      '.game-username',
      '.player-username',
      '.chat-message-component a',
      '.tournament-players-name',
      '.leaderboard-row-username',
    ];

    const allUserElements = document.querySelectorAll(selectors.join(','));
    allUserElements.forEach((element) => {
      const extractedUsername = this.extractUsername(element as HTMLElement);
      if (extractedUsername?.toLowerCase() === usernameLC) {
        elements.push(element as HTMLElement);
      }
    });

    return elements;
  }

  /**
   * Display picker result next to the username
   */
  private displayPickerResult(username: string, profile: any): void {
    logger.info(`Displaying picker result for ${username}`);

    // Find all elements with this username
    const userElements = this.findUserElements(username);

    userElements.forEach((element: HTMLElement) => {
      // Skip if already has an indicator (check next sibling)
      const nextSibling = element.nextElementSibling;
      if (nextSibling?.classList?.contains('sus-meter-picker-indicator')) {
        return;
      }

      // Also check if parent has an indicator for this username
      const existingIndicator = element.parentElement?.querySelector(
        `.sus-meter-picker-indicator[data-username="${username}"]`,
      );
      if (existingIndicator) {
        return;
      }

      // Use the button injector's styles and create indicator
      this.buttonInjector.injectPickerIndicator(element, username, profile);
    });
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
detector.initialize().catch((error) => {
  logger.error('Failed to initialize Chess.com detector:', error);
});

// Clean up on unload
window.addEventListener('unload', () => {
  detector.destroy();
});
