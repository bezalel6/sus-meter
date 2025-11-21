import type { ChessProfile, ChessPlatform } from '@/types';
import { ChessAPIClient, ProfileAnalyzer, CacheManager } from '@/utils';

/**
 * Profile Button Injector - Adds analysis buttons to profile links
 */
export class ProfileButtonInjector {
  private platform: ChessPlatform;
  private injectedElements: WeakSet<Element> = new WeakSet();
  private tooltipElement: HTMLDivElement | null = null;

  constructor(platform: ChessPlatform) {
    this.platform = platform;
    this.setupTooltip();
    this.setupStyles();
  }

  /**
   * Setup global styles for injected buttons and tooltips
   */
  private setupStyles() {
    if (document.getElementById('sus-meter-injector-styles')) return;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'sus-meter-injector-styles';
    styleSheet.textContent = `
      .sus-meter-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        margin-left: 4px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        vertical-align: middle;
        position: relative;
      }

      .sus-meter-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
      }

      .sus-meter-btn.loading {
        background: #94a3b8;
        animation: pulse 1s infinite;
      }

      .sus-meter-btn.analyzed {
        background: linear-gradient(135deg, #22c55e, #16a34a);
      }

      .sus-meter-btn.analyzed.new-account {
        background: linear-gradient(135deg, #ef4444, #dc2626);
      }

      .sus-meter-btn.analyzed.suspicious {
        background: linear-gradient(135deg, #fb923c, #ea580c);
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .sus-meter-tooltip {
        position: absolute;
        z-index: 999999;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        color: #1f2937;
        max-width: 280px;
        pointer-events: none;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.2s, transform 0.2s;
      }

      .sus-meter-tooltip.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .sus-meter-tooltip h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
        color: #111827;
      }

      .sus-meter-tooltip .age-display {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        padding: 8px;
        background: #f3f4f6;
        border-radius: 6px;
      }

      .sus-meter-tooltip .age-display.new {
        background: #fee2e2;
        color: #991b1b;
      }

      .sus-meter-tooltip .age-display.recent {
        background: #fed7aa;
        color: #9a3412;
      }

      .sus-meter-tooltip .age-display.established {
        background: #d1fae5;
        color: #065f46;
      }

      .sus-meter-tooltip .stat-row {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        border-bottom: 1px solid #f3f4f6;
      }

      .sus-meter-tooltip .stat-row:last-child {
        border-bottom: none;
      }

      .sus-meter-tooltip .stat-label {
        color: #6b7280;
        font-weight: 500;
      }

      .sus-meter-tooltip .stat-value {
        color: #111827;
        font-weight: 600;
      }

      .sus-meter-tooltip .suspicion-reasons {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #e5e7eb;
      }

      .sus-meter-tooltip .suspicion-reasons ul {
        margin: 4px 0 0 0;
        padding-left: 16px;
        list-style: none;
      }

      .sus-meter-tooltip .suspicion-reasons li {
        position: relative;
        padding-left: 12px;
        margin: 2px 0;
        color: #dc2626;
        font-size: 12px;
      }

      .sus-meter-tooltip .suspicion-reasons li:before {
        content: "⚠";
        position: absolute;
        left: 0;
      }
    `;

    document.head.appendChild(styleSheet);
  }

  /**
   * Setup tooltip element
   */
  private setupTooltip() {
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'sus-meter-tooltip';
    document.body.appendChild(this.tooltipElement);
  }

  /**
   * Inject buttons based on platform
   */
  public async injectButtons(): Promise<{ success: boolean; count: number }> {
    let count = 0;

    if (this.platform === 'lichess') {
      count = this.injectLichessButtons();
    } else {
      count = this.injectChessComButtons();
    }

    return { success: count > 0, count };
  }

  /**
   * Inject buttons on Lichess
   */
  private injectLichessButtons(): number {
    let count = 0;

    // Find all user links
    const userLinks = document.querySelectorAll('.user-link[data-href]');

    userLinks.forEach((link) => {
      if (this.injectedElements.has(link)) return;

      const href = link.getAttribute('data-href');
      if (!href) return;

      // Extract username from href (format: /@/username)
      const username = href.replace('/@/', '');
      if (!username) return;

      const button = this.createAnalysisButton(username);
      link.parentElement?.insertBefore(button, link.nextSibling);
      this.injectedElements.add(link);
      count++;
    });

    return count;
  }

  /**
   * Inject buttons on Chess.com
   */
  private injectChessComButtons(): number {
    let count = 0;

    // Find all username elements
    const userElements = document.querySelectorAll('.cc-user-username-component');

    userElements.forEach((element) => {
      if (this.injectedElements.has(element)) return;

      const username = element.textContent?.trim();
      if (!username) return;

      const button = this.createAnalysisButton(username);
      element.parentElement?.insertBefore(button, element.nextSibling);
      this.injectedElements.add(element);
      count++;
    });

    return count;
  }

  /**
   * Create analysis button for a username
   */
  private createAnalysisButton(username: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'sus-meter-btn';
    button.title = `Analyze ${username}`;
    button.textContent = '?';
    button.dataset['username'] = username;
    button.dataset['platform'] = this.platform;

    // Handle click
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.analyzeProfile(button, username);
    });

    // Handle hover for tooltip
    button.addEventListener('mouseenter', () => {
      if (button.dataset['profile']) {
        this.showTooltip(button);
      }
    });

    button.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });

    return button;
  }

  /**
   * Analyze a profile
   */
  private async analyzeProfile(button: HTMLButtonElement, username: string) {
    // Check if already analyzed
    if (button.dataset['profile']) {
      this.showTooltip(button);
      return;
    }

    // Show loading state
    button.classList.add('loading');
    button.textContent = '...';

    try {
      // Check cache first
      let profile = await CacheManager.getCachedProfile(username, this.platform);

      if (!profile) {
        // Fetch from API
        profile = await ChessAPIClient.fetchProfile(username, this.platform);

        if (profile) {
          // Analyze profile
          profile = ProfileAnalyzer.analyzeProfile(profile);
          // Cache it
          await CacheManager.cacheProfile(profile);
        }
      }

      if (profile) {
        // Store profile data
        button.dataset['profile'] = JSON.stringify(profile);

        // Update button appearance
        button.classList.remove('loading');
        button.classList.add('analyzed');

        // Set indicator based on account age
        if (profile.accountAge < 7) {
          button.classList.add('new-account');
          button.textContent = 'N';
        } else if (profile.suspicionScore > 50) {
          button.classList.add('suspicious');
          button.textContent = '!';
        } else {
          button.textContent = '✓';
        }

        // Show tooltip immediately
        this.showTooltip(button);
      } else {
        // Profile not found
        button.classList.remove('loading');
        button.textContent = '×';
        button.title = `Profile not found: ${username}`;
      }
    } catch (error) {
      console.error('Analysis error:', error);
      button.classList.remove('loading');
      button.textContent = '!';
      button.title = 'Analysis failed';
    }
  }

  /**
   * Show tooltip with profile details
   */
  private showTooltip(button: HTMLButtonElement) {
    if (!this.tooltipElement || !button.dataset['profile']) return;

    const profile: ChessProfile = JSON.parse(button.dataset['profile']);

    // Build tooltip content
    const ageClass =
      profile.accountAge < 7 ? 'new' : profile.accountAge < 30 ? 'recent' : 'established';

    const ageText = this.formatAge(profile.accountAge);

    let tooltipHTML = `
      <h4>${profile.username}</h4>
      <div class="age-display ${ageClass}">
        <strong>Account Age:</strong> ${ageText}
      </div>
      <div class="stat-row">
        <span class="stat-label">Rating:</span>
        <span class="stat-value">${profile.ratings.blitz || profile.ratings.rapid || 'Unrated'}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Total Games:</span>
        <span class="stat-value">${profile.gameStats.total.toLocaleString()}</span>
      </div>
      ${
        profile.gameStats.rated !== undefined
          ? `
        <div class="stat-row" style="padding-left: 12px;">
          <span class="stat-label" style="font-size: 11px;">Rated:</span>
          <span class="stat-value" style="font-size: 11px;">${profile.gameStats.rated.toLocaleString()}</span>
        </div>
      `
          : ''
      }
      ${
        profile.gameStats.unrated !== undefined
          ? `
        <div class="stat-row" style="padding-left: 12px;">
          <span class="stat-label" style="font-size: 11px;">Unrated:</span>
          <span class="stat-value" style="font-size: 11px;">${profile.gameStats.unrated.toLocaleString()}</span>
        </div>
      `
          : ''
      }
      <div class="stat-row">
        <span class="stat-label">Win Rate:</span>
        <span class="stat-value">${profile.gameStats.winRate}%</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Suspicion:</span>
        <span class="stat-value">${profile.suspicionLevel.toUpperCase()}</span>
      </div>
    `;

    // Add suspicion reasons if any
    if (profile.suspicionReasons.length > 0) {
      tooltipHTML += `
        <div class="suspicion-reasons">
          <strong>Flags:</strong>
          <ul>
            ${profile.suspicionReasons.map((r) => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    this.tooltipElement.innerHTML = tooltipHTML;

    // Position tooltip
    const rect = button.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();

    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

    // Adjust if going off screen
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top + tooltipRect.height > window.innerHeight - 10) {
      top = rect.top - tooltipRect.height - 8;
    }

    this.tooltipElement.style.top = `${top}px`;
    this.tooltipElement.style.left = `${left}px`;
    this.tooltipElement.classList.add('visible');
  }

  /**
   * Hide tooltip
   */
  private hideTooltip() {
    if (this.tooltipElement) {
      this.tooltipElement.classList.remove('visible');
    }
  }

  /**
   * Format age for display
   */
  private formatAge(days: number): string {
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

  /**
   * Inject indicator for picker mode result
   */
  public injectPickerIndicator(element: Element, username: string, profile: any): void {
    // Check if indicator already exists next to this element
    const nextSibling = element.nextElementSibling;
    if (nextSibling?.classList?.contains('sus-meter-picker-indicator')) {
      console.log('Indicator already exists for', username);
      return;
    }

    // Create indicator button
    const indicator = document.createElement('button');
    indicator.className = 'sus-meter-picker-indicator';
    indicator.setAttribute('data-username', username);

    // Set indicator based on account age
    if (profile.accountAge < 7) {
      indicator.textContent = '❌';
      indicator.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      indicator.title = `${username}: ${profile.accountAge}d old (NEW ACCOUNT)`;
    } else if (profile.accountAge < 30) {
      indicator.textContent = '⚠️';
      indicator.style.background = 'linear-gradient(135deg, #fb923c, #ea580c)';
      indicator.title = `${username}: ${profile.accountAge}d old (Recent)`;
    } else {
      indicator.textContent = '✓';
      indicator.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
      indicator.title = `${username}: ${profile.accountAge}d old (Established)`;
    }

    indicator.style.cssText += `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      margin-left: 4px;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      vertical-align: middle;
      position: relative;
      z-index: 10000;
    `;

    // Create info panel
    const infoPanel = document.createElement('div');
    infoPanel.className = 'sus-meter-info-panel';
    infoPanel.style.cssText = `
      position: absolute;
      display: none;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      font-size: 13px;
      color: #1f2937;
      min-width: 200px;
      max-width: 250px;
      z-index: 100002;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    infoPanel.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #111827;">
        ${username}
      </div>
      <div style="display: grid; gap: 6px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #6b7280;">Account Age:</span>
          <span style="font-weight: 500;">${this.formatAge(profile.accountAge)}</span>
        </div>
        ${
          profile.ratings
            ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Rating:</span>
            <span style="font-weight: 500;">${profile.ratings.blitz || profile.ratings.rapid || 'N/A'}</span>
          </div>
        `
            : ''
        }
        ${
          profile.gameStats
            ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Total Games:</span>
            <span style="font-weight: 500;">${profile.gameStats.total || 0}</span>
          </div>
          ${
            profile.gameStats.rated !== undefined
              ? `
            <div style="display: flex; justify-content: space-between; padding-left: 12px;">
              <span style="color: #9ca3af; font-size: 12px;">Rated:</span>
              <span style="font-weight: 500; font-size: 12px;">${profile.gameStats.rated || 0}</span>
            </div>
          `
              : ''
          }
          ${
            profile.gameStats.unrated !== undefined
              ? `
            <div style="display: flex; justify-content: space-between; padding-left: 12px;">
              <span style="color: #9ca3af; font-size: 12px;">Unrated:</span>
              <span style="font-weight: 500; font-size: 12px;">${profile.gameStats.unrated || 0}</span>
            </div>
          `
              : ''
          }
        `
            : ''
        }
        ${
          profile.suspicionLevel
            ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Status:</span>
            <span style="font-weight: 500; text-transform: capitalize;">${profile.suspicionLevel}</span>
          </div>
        `
            : ''
        }
      </div>
    `;

    // Add click handler to show/hide panel
    indicator.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isVisible = infoPanel.style.display === 'block';

      // Hide all other panels
      document.querySelectorAll('.sus-meter-info-panel').forEach((panel) => {
        (panel as HTMLElement).style.display = 'none';
      });

      if (!isVisible) {
        // Position panel near the button
        const rect = indicator.getBoundingClientRect();
        infoPanel.style.display = 'block';
        infoPanel.style.top = `${rect.bottom + window.scrollY + 5}px`;
        infoPanel.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 260)}px`;
      }
    });

    // Close panel on outside click
    const closeHandler = (e: MouseEvent) => {
      if (!indicator.contains(e.target as Node) && !infoPanel.contains(e.target as Node)) {
        infoPanel.style.display = 'none';
      }
    };
    document.addEventListener('click', closeHandler);

    // Insert indicator after the element
    element.insertAdjacentElement('afterend', indicator);
    document.body.appendChild(infoPanel);
  }

  /**
   * Cleanup
   */
  public destroy() {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
    }
  }
}
