import { ChessProfile, ChessPlatform, BADGE_COLORS, ExtensionSettings } from '@/types';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ProfileInjector');

/**
 * Injects visual indicators (badges and hover cards) for chess profiles
 */
export class ProfileInjector {
  private settings: Partial<ExtensionSettings> = {};
  private injectedElements = new WeakSet<HTMLElement>();
  private hoverCardElement: HTMLElement | null = null;
  private hoverTimeout: number | null = null;

  constructor(_platform: ChessPlatform) {
    // Platform passed in but not currently used
    this.injectStyles();
  }

  /**
   * Inject CSS styles for badges and hover cards
   */
  private injectStyles(): void {
    if (document.getElementById('sus-meter-styles')) {
      return; // Already injected
    }

    const style = document.createElement('style');
    style.id = 'sus-meter-styles';
    style.textContent = `
      /* Badge styles */
      .sus-meter-badge {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-left: 4px;
        margin-right: 2px;
        vertical-align: middle;
        cursor: help;
        position: relative;
        animation: sus-meter-fade-in 0.3s ease-in;
      }

      .sus-meter-badge.badge-small {
        width: 6px;
        height: 6px;
      }

      .sus-meter-badge.badge-medium {
        width: 8px;
        height: 8px;
      }

      .sus-meter-badge.badge-large {
        width: 10px;
        height: 10px;
      }

      .sus-meter-badge.badge-before {
        margin-left: 2px;
        margin-right: 4px;
      }

      /* Hover card styles */
      .sus-meter-hover-card {
        position: absolute;
        z-index: 10000;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 280px;
        max-width: 350px;
        font-size: 13px;
        line-height: 1.4;
        animation: sus-meter-slide-in 0.2s ease-out;
      }

      .sus-meter-hover-card.dark-mode {
        background: #2e2e2e;
        color: #e8e8e8;
        border-color: #444;
      }

      .sus-meter-hover-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid #eee;
      }

      .dark-mode .sus-meter-hover-card-header {
        border-bottom-color: #444;
      }

      .sus-meter-username {
        font-weight: 600;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .sus-meter-platform {
        font-size: 11px;
        color: #666;
        text-transform: uppercase;
      }

      .dark-mode .sus-meter-platform {
        color: #aaa;
      }

      .sus-meter-level {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: white;
      }

      .sus-meter-info-row {
        display: flex;
        justify-content: space-between;
        margin: 4px 0;
      }

      .sus-meter-info-label {
        color: #666;
        font-weight: 500;
      }

      .dark-mode .sus-meter-info-label {
        color: #aaa;
      }

      .sus-meter-info-value {
        font-weight: 600;
      }

      .sus-meter-info-value.highlight {
        color: #d32f2f;
      }

      .sus-meter-reasons {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #eee;
      }

      .dark-mode .sus-meter-reasons {
        border-top-color: #444;
      }

      .sus-meter-reason {
        display: flex;
        align-items: flex-start;
        margin: 4px 0;
        font-size: 12px;
        color: #d32f2f;
      }

      .sus-meter-reason::before {
        content: "⚠";
        margin-right: 6px;
        font-size: 14px;
      }

      /* Animations */
      @keyframes sus-meter-fade-in {
        from { opacity: 0; transform: scale(0); }
        to { opacity: 1; transform: scale(1); }
      }

      @keyframes sus-meter-slide-in {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Pulse animation for critical suspicion */
      .sus-meter-badge.level-critical {
        animation: sus-meter-pulse 2s infinite;
      }

      @keyframes sus-meter-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
    `;

    document.head.appendChild(style);
    logger.debug('Injected styles');
  }

  /**
   * Inject a badge and age indicator next to a username element
   */
  injectBadge(element: HTMLElement, profile: ChessProfile): void {
    // Don't inject twice
    if (this.injectedElements.has(element)) {
      return;
    }

    // Check if badge already exists
    const existingBadge = element.parentElement?.querySelector('.sus-meter-badge');
    const existingAge = element.parentElement?.querySelector('.sus-meter-age-text');
    if (existingBadge) {
      existingBadge.remove();
    }
    if (existingAge) {
      existingAge.remove();
    }

    // Create container for badge and optional age text
    const container = document.createElement('span');
    container.className = 'sus-meter-container';
    container.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;';

    // Create badge element
    const badge = document.createElement('span');
    badge.className = `sus-meter-badge badge-${this.settings.appearance?.badgeSize || 'small'} level-${profile.suspicionLevel}`;
    badge.style.backgroundColor = BADGE_COLORS[profile.suspicionLevel];
    badge.title = this.getBadgeTooltip(profile);

    // Create age text indicator for new accounts
    if (profile.accountAge < 30) {
      const ageText = document.createElement('span');
      ageText.className = 'sus-meter-age-text';

      // Format age text compactly
      let ageString: string;
      if (profile.accountAge === 0) {
        ageString = 'NEW';
      } else if (profile.accountAge === 1) {
        ageString = '1d';
      } else if (profile.accountAge < 7) {
        ageString = `${profile.accountAge}d`;
      } else if (profile.accountAge < 30) {
        ageString = `${Math.floor(profile.accountAge / 7)}w`;
      } else {
        ageString = `${Math.floor(profile.accountAge / 30)}mo`;
      }

      // Style the age text based on how new the account is
      const textColor = profile.accountAge < 7 ? '#d32f2f' : profile.accountAge < 14 ? '#f57c00' : '#795548';
      ageText.style.cssText = `
        font-size: 10px;
        font-weight: 600;
        color: ${textColor};
        background: ${profile.accountAge < 7 ? '#fee' : '#fff3cd'};
        padding: 1px 4px;
        border-radius: 3px;
        border: 1px solid ${profile.accountAge < 7 ? '#fcc' : '#ffc107'};
        vertical-align: middle;
        cursor: help;
      `;
      ageText.textContent = ageString;
      ageText.title = `Account: ${this.formatAccountAge(profile.accountAge)}`;

      container.appendChild(ageText);
    }

    container.appendChild(badge);

    // Add hover events for hover card
    if (this.settings.features?.showHoverCards !== false) {
      container.addEventListener('mouseenter', (e) => this.showHoverCard(e, profile));
      container.addEventListener('mouseleave', () => this.hideHoverCard());

      element.addEventListener('mouseenter', (e) => this.showHoverCard(e, profile));
      element.addEventListener('mouseleave', () => this.hideHoverCard());
    }

    // Insert container
    if (this.settings.appearance?.badgePosition === 'before') {
      element.parentElement?.insertBefore(container, element);
    } else {
      element.parentElement?.insertBefore(container, element.nextSibling);
    }

    this.injectedElements.add(element);
    logger.debug(`Injected badge for ${profile.username} (${profile.suspicionLevel}, ${profile.accountAge} days old)`);
  }

  /**
   * Get badge tooltip text - emphasizing account age
   */
  private getBadgeTooltip(profile: ChessProfile): string {
    const age = this.formatAccountAge(profile.accountAge);
    const mainRating = profile.ratings.blitz || profile.ratings.rapid || profile.ratings.bullet;

    // Put age first and make it prominent
    return `📅 Account: ${age}\n${profile.username} • ${mainRating || 'Unrated'} • ${profile.gameStats.total} games`;
  }

  /**
   * Format account age for display
   */
  private formatAccountAge(days: number): string {
    if (days === 0) {
      return 'Created today';
    } else if (days === 1) {
      return '1 day old';
    } else if (days < 7) {
      return `${days} days old`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return weeks === 1 ? '1 week old' : `${weeks} weeks old`;
    } else if (days < 365) {
      const months = Math.floor(days / 30);
      return months === 1 ? '1 month old' : `${months} months old`;
    } else {
      const years = Math.floor(days / 365);
      const remainingMonths = Math.floor((days % 365) / 30);
      if (remainingMonths > 0) {
        return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''} old`;
      }
      return years === 1 ? '1 year old' : `${years} years old`;
    }
  }

  /**
   * Show hover card with detailed profile information
   */
  private showHoverCard(event: MouseEvent, profile: ChessProfile): void {
    // Clear any existing timeout
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }

    // Delay showing to avoid flickering
    this.hoverTimeout = window.setTimeout(() => {
      this.createHoverCard(event, profile);
    }, this.settings.appearance?.hoverDelay || 500);
  }

  /**
   * Create and position hover card
   */
  private createHoverCard(event: MouseEvent, profile: ChessProfile): void {
    // Remove existing hover card
    this.removeHoverCard();

    // Create hover card element
    const card = document.createElement('div');
    card.className = 'sus-meter-hover-card';

    // Check for dark mode
    if (document.body.classList.contains('dark-mode') || document.body.classList.contains('theme-dark')) {
      card.classList.add('dark-mode');
    }

    // Build card content
    card.innerHTML = this.buildHoverCardContent(profile);

    // Add to body
    document.body.appendChild(card);
    this.hoverCardElement = card;

    // Position the card
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    // Position below the element by default
    let top = rect.bottom + window.scrollY + 5;
    let left = rect.left + window.scrollX;

    // Adjust if card goes off screen
    if (left + cardRect.width > window.innerWidth) {
      left = window.innerWidth - cardRect.width - 10;
    }

    if (top + cardRect.height > window.innerHeight + window.scrollY) {
      // Position above instead
      top = rect.top + window.scrollY - cardRect.height - 5;
    }

    card.style.top = `${top}px`;
    card.style.left = `${left}px`;

    // Keep card visible on hover
    card.addEventListener('mouseenter', () => {
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
      }
    });

    card.addEventListener('mouseleave', () => {
      this.hideHoverCard();
    });
  }

  /**
   * Build hover card HTML content - with prominent account age display
   */
  private buildHoverCardContent(profile: ChessProfile): string {
    const ageFormatted = this.formatAccountAge(profile.accountAge);
    const createdDate = new Date(profile.createdAt);
    const dateString = createdDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const levelColor = BADGE_COLORS[profile.suspicionLevel];
    const levelText = profile.suspicionLevel.replace('_', ' ');

    // Get main rating
    const mainRating = profile.ratings.blitz || profile.ratings.rapid || profile.ratings.bullet || 0;
    const peakRating = profile.peakRatings?.blitz || profile.peakRatings?.rapid || profile.peakRatings?.bullet || mainRating;

    // Highlight new accounts with special styling
    const isNewAccount = profile.accountAge < 30;
    const isVeryNew = profile.accountAge < 7;

    let html = `
      <div class="sus-meter-hover-card-header">
        <div>
          <div class="sus-meter-username">
            ${profile.username}
            ${profile.accountStatus.isVerified ? '✓' : ''}
          </div>
          <div class="sus-meter-platform">${profile.platform}</div>
        </div>
        <div class="sus-meter-level" style="background-color: ${levelColor}">
          ${levelText}
        </div>
      </div>

      <!-- Prominent account age display -->
      <div class="sus-meter-account-age-section" style="
        background: ${isVeryNew ? '#fee' : isNewAccount ? '#fff3cd' : '#f0f9ff'};
        padding: 8px;
        border-radius: 6px;
        margin: 8px 0;
        border: 1px solid ${isVeryNew ? '#fcc' : isNewAccount ? '#ffc107' : '#cce5ff'};
      ">
        <div style="font-size: 16px; font-weight: 600; color: ${isVeryNew ? '#d32f2f' : isNewAccount ? '#f57c00' : '#1976d2'};">
          📅 ${ageFormatted}
        </div>
        <div style="font-size: 12px; color: #666; margin-top: 2px;">
          Created: ${dateString}
        </div>
      </div>

      <div class="sus-meter-info-row">
        <span class="sus-meter-info-label">Rating:</span>
        <span class="sus-meter-info-value">${mainRating} ${peakRating > mainRating ? `(Peak: ${peakRating})` : ''}</span>
      </div>

      <div class="sus-meter-info-row">
        <span class="sus-meter-info-label">Games:</span>
        <span class="sus-meter-info-value">${profile.gameStats.total}</span>
      </div>

      <div class="sus-meter-info-row">
        <span class="sus-meter-info-label">Win Rate:</span>
        <span class="sus-meter-info-value ${profile.gameStats.winRate > 80 ? 'highlight' : ''}">${profile.gameStats.winRate}%</span>
      </div>
    `;

    // Add suspicion reasons if any
    if (profile.suspicionReasons.length > 0) {
      html += '<div class="sus-meter-reasons">';
      profile.suspicionReasons.forEach(reason => {
        html += `<div class="sus-meter-reason">${reason}</div>`;
      });
      html += '</div>';
    }

    // Add account status warnings
    if (profile.accountStatus.isClosed) {
      html += '<div class="sus-meter-reason">Account closed/banned</div>';
    }
    if (profile.accountStatus.isViolator) {
      html += '<div class="sus-meter-reason">ToS violations detected</div>';
    }

    return html;
  }

  /**
   * Hide hover card
   */
  private hideHoverCard(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }

    // Delay hiding to allow moving to the card
    this.hoverTimeout = window.setTimeout(() => {
      this.removeHoverCard();
    }, 200);
  }

  /**
   * Remove hover card from DOM
   */
  private removeHoverCard(): void {
    if (this.hoverCardElement) {
      this.hoverCardElement.remove();
      this.hoverCardElement = null;
    }
  }

  /**
   * Remove all injected badges and age indicators
   */
  removeAllBadges(): void {
    // Remove all sus-meter elements
    const elements = document.querySelectorAll('.sus-meter-badge, .sus-meter-age-text, .sus-meter-container');
    elements.forEach(element => element.remove());
    this.injectedElements = new WeakSet();
    this.removeHoverCard();
    logger.debug('Removed all badges and age indicators');
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<ExtensionSettings>): void {
    this.settings = settings;
    logger.debug('Updated injector settings');
  }
}