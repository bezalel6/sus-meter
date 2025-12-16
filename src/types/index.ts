// Type definitions for the Sus Meter Chess Profile Analyzer

// Chess platforms
export type ChessPlatform = 'lichess' | 'chess.com';

// User profile data structure
export interface ChessProfile {
  username: string;
  platform: ChessPlatform;
  accountAge: number; // in days
  createdAt: string; // ISO date string
  ratings: {
    bullet?: number;
    blitz?: number;
    rapid?: number;
    classical?: number;
    puzzle?: number;
  };
  peakRatings?: {
    bullet?: number;
    blitz?: number;
    rapid?: number;
    classical?: number;
  };
  gameStats: {
    total: number;
    rated?: number;
    unrated?: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number; // percentage 0-100
  };
  recentActivity?: {
    gamesLast7Days: number;
    gamesLast30Days: number;
    ratingChange7Days?: number;
    ratingChange30Days?: number;
  };
  accountStatus: {
    isOnline: boolean;
    isStreaming?: boolean;
    isVerified?: boolean;
    isClosed?: boolean;
    isViolator?: boolean; // Lichess specific
    isFairPlay?: boolean; // Chess.com specific
  };
  suspicionScore: number; // 0-100
  suspicionLevel: SuspicionLevel;
  suspicionReasons: string[];
  lastUpdated: string; // ISO date string
}

// Suspicion levels with color codes
export enum SuspicionLevel {
  NONE = 'none', // Green - Established player
  LOW = 'low', // Light Yellow - Minor flags
  MEDIUM = 'medium', // Yellow - Caution advised
  HIGH = 'high', // Orange - Suspicious patterns
  CRITICAL = 'critical', // Red - Major red flags
}

// Extension configuration
export interface ExtensionSettings {
  enabled: boolean;
  features: {
    showBadges: boolean;
    showHoverCards: boolean;
    checkChatUsers: boolean;
    checkOpponents: boolean;
    checkTournamentPlayers: boolean;
    alertOnSuspicious: boolean;
  };
  thresholds: {
    // Age-based suspicion thresholds (tiered)
    criticalAccountDays: number; // Accounts younger than this are extremely suspicious - Default: 14 (2 weeks)
    highSuspicionAccountDays: number; // Accounts younger than this are very suspicious - Default: 30 (1 month)
    suspiciousAccountDays: number; // Accounts younger than this are somewhat suspicious - Default: 365 (1 year)

    // Performance thresholds
    highRatingThreshold: number; // Unusually high rating - Default: 2000
    rapidRatingGainDays: number; // Days to check for rapid rating gain - Default: 30
    rapidRatingGainAmount: number; // Rating gain threshold - Default: 300

    // Game thresholds
    minGamesRequired: number; // Minimum games for established player - Default: 50
    suspiciousWinRate: number; // Win rate % that's suspicious - Default: 75

    // Alert settings
    suspicionAlertLevel: SuspicionLevel;
  };
  appearance: {
    badgePosition: 'before' | 'after';
    badgeSize: 'small' | 'medium' | 'large';
    hoverDelay: number; // milliseconds
  };
  cache: {
    enabled: boolean;
    expiryHours: number;
    maxProfiles: number;
  };
  lists: {
    whitelisted: string[]; // Trusted players
    blacklisted: string[]; // Known bad actors
  };
}

// Message types for extension communication
export type MessageType =
  | 'ANALYZE_PROFILE'
  | 'GET_PROFILE_DATA'
  | 'UPDATE_BADGE'
  | 'CACHE_PROFILE'
  | 'GET_CACHED_PROFILE'
  | 'PROFILES_DETECTED'
  | 'TOGGLE_ENABLED'
  | 'SETTINGS_UPDATED'
  | 'BULK_ANALYZE'
  | 'PROFILE_HOVER'
  | 'ADD_TO_WHITELIST'
  | 'ADD_TO_BLACKLIST'
  | 'REMOVE_FROM_WHITELIST'
  | 'REMOVE_FROM_BLACKLIST'
  | 'GET_SETTINGS'
  | 'INJECT_PROFILE_BUTTONS'
  | 'INJECTION_COMPLETE'
  | 'PICKER_SELECTION'
  | 'PICKER_RESULT'
  | 'POPUP_CHECK'
  | 'CHECK_PICKER_MODE'
  | 'DISPLAY_PICKER_RESULT';

// Extension message structure
export interface ExtensionMessage<T = any> {
  type: MessageType;
  data?: T;
  platform?: ChessPlatform;
  username?: string;
  timestamp?: number;
  profile?: ChessProfile;
}

// Profile detection result
export interface ProfileDetection {
  element: HTMLElement;
  username: string;
  context: 'chat' | 'game' | 'tournament' | 'profile' | 'list';
  platform: ChessPlatform;
}

// Cached profile entry
export interface CachedProfile {
  profile: ChessProfile;
  cachedAt: string; // ISO date string
  expiresAt: string; // ISO date string
}

// Badge display configuration
export interface BadgeConfig {
  level: SuspicionLevel;
  tooltip: string;
  color: string;
  icon?: string;
}

// Storage keys
export const STORAGE_KEYS = {
  ENABLED: 'enabled',
  SETTINGS: 'settings',
  PROFILE_CACHE: 'profileCache',
  WHITELIST: 'whitelist',
  BLACKLIST: 'blacklist',
  STATISTICS: 'statistics',
} as const;

// Badge colors by suspicion level
export const BADGE_COLORS = {
  [SuspicionLevel.NONE]: '#22c55e', // Green
  [SuspicionLevel.LOW]: '#84cc16', // Light green
  [SuspicionLevel.MEDIUM]: '#facc15', // Yellow
  [SuspicionLevel.HIGH]: '#fb923c', // Orange
  [SuspicionLevel.CRITICAL]: '#ef4444', // Red
} as const;

// Default settings
export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  features: {
    showBadges: true,
    showHoverCards: true,
    checkChatUsers: true,
    checkOpponents: true,
    checkTournamentPlayers: true,
    alertOnSuspicious: true,
  },
  thresholds: {
    // Age-based suspicion thresholds (stricter defaults)
    criticalAccountDays: 14, // 2 weeks - extremely suspicious
    highSuspicionAccountDays: 30, // 1 month - very suspicious
    suspiciousAccountDays: 365, // 1 year - somewhat suspicious

    // Performance thresholds
    highRatingThreshold: 2000,
    rapidRatingGainDays: 30,
    rapidRatingGainAmount: 300,

    // Game thresholds
    minGamesRequired: 50,
    suspiciousWinRate: 75,

    // Alert settings
    suspicionAlertLevel: SuspicionLevel.HIGH,
  },
  appearance: {
    badgePosition: 'after',
    badgeSize: 'small',
    hoverDelay: 500,
  },
  cache: {
    enabled: true,
    expiryHours: 24,
    maxProfiles: 100,
  },
  lists: {
    whitelisted: [],
    blacklisted: [],
  },
};

// API endpoints
export const API_ENDPOINTS = {
  lichess: {
    user: (username: string) => `https://lichess.org/api/user/${username}`,
    games: (username: string) => `https://lichess.org/api/games/user/${username}`,
  },
  chesscom: {
    user: (username: string) => `https://api.chess.com/pub/player/${username}`,
    stats: (username: string) => `https://api.chess.com/pub/player/${username}/stats`,
  },
} as const;

// Tab information interface (for messaging utilities)
export interface TabInfo {
  id?: number;
  url?: string;
  title?: string;
  active: boolean;
}
