import browser from 'webextension-polyfill';
import { ProfileDetection, ChessPlatform, ExtensionMessage } from '@/types';
import { createLogger } from '@/utils/logger';
import { ProfileInjector } from './profile-injector';

const logger = createLogger('LichessContent');
const platform: ChessPlatform = 'lichess';

/**
 * Lichess-specific profile detector
 */
export class LichessProfileDetector {
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
    logger.info('Initializing Lichess profile detector');

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

    // Chat messages - usernames in chat
    const chatUsers = document.querySelectorAll('.mchat__messages .user-link, .chat__messages .user-link');
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

    // Game pages - player names
    const gamePlayers = document.querySelectorAll('.game__meta .user-link, .ruser-top .user-link');
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

    // Tournament pages
    const tournamentPlayers = document.querySelectorAll('.tournament__standings .user-link, .standing .user-link');
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
    const profileHeaders = document.querySelectorAll('.user-show__header .user-link, h1.user-link');
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

    // TV games and featured games
    const tvPlayers = document.querySelectorAll('.mini-game__user .user-link, .featured-game .user-link');
    tvPlayers.forEach(element => {
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

    // Arena/Swiss tournament lobbies
    const lobbyPlayers = document.querySelectorAll('.lobby__spotlights .user-link, .swiss__player-info .user-link');
    lobbyPlayers.forEach(element => {
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

    // Friend list and follows
    const friendsList = document.querySelectorAll('.friend-list .user-link, .relation .user-link');
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

    logger.debug(`Found ${profiles.length} profile elements`);
    return profiles;
  }

  /**
   * Extract username from a Lichess user link element
   */
  private extractUsername(element: HTMLElement): string | null {
    // Try href attribute first (most reliable)
    const href = element.getAttribute('href');
    if (href) {
      const match = href.match(/^\/@\/([^\/\?]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Try data-href attribute (some elements use this)
    const dataHref = element.getAttribute('data-href');
    if (dataHref) {
      const match = dataHref.match(/^\/@\/([^\/\?]+)/);
      if (match && match[1]) {
        return match[1] || null;
      }
    }

    // Fall back to text content (less reliable)
    const text = element.textContent?.trim();
    if (text && !text.includes(' ') && text.length > 0 && text.length < 30) {
      return text;
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
    logger.info('Lichess profile detector destroyed');
  }
}

// Initialize detector when content script loads
const detector = new LichessProfileDetector();
detector.initialize().catch(error => {
  logger.error('Failed to initialize Lichess detector:', error);
});

// Clean up on unload
window.addEventListener('unload', () => {
  detector.destroy();
});