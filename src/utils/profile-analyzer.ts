import { ChessProfile, SuspicionLevel } from '@/types';
import { createLogger } from './logger';

const logger = createLogger('ProfileAnalyzer');

/**
 * Analyzes a chess profile and calculates suspicion metrics
 */
export class ProfileAnalyzer {
  /**
   * Calculate overall suspicion score (0-100) - with primary focus on account age
   */
  static calculateSuspicionScore(profile: ChessProfile): number {
    let score = 0;
    const reasons: string[] = [];

    // Account age factor (0-45 points) - PRIMARY INDICATOR
    const ageScore = this.calculateAccountAgeScore(profile);
    // Multiply age score by 1.5 to give it more weight
    score += Math.min(45, ageScore.score * 1.5);
    if (ageScore.reason) reasons.push(ageScore.reason);

    // Rating vs games played factor (0-20 points)
    const ratingScore = this.calculateRatingVsGamesScore(profile);
    score += Math.min(20, ratingScore.score * 0.8);
    if (ratingScore.reason) reasons.push(ratingScore.reason);

    // Win rate factor (0-15 points)
    const winRateScore = this.calculateWinRateScore(profile);
    score += Math.min(15, winRateScore.score * 0.75);
    if (winRateScore.reason) reasons.push(winRateScore.reason);

    // Rapid improvement factor (0-10 points)
    const improvementScore = this.calculateRapidImprovementScore(profile);
    score += Math.min(10, improvementScore.score * 0.67);
    if (improvementScore.reason) reasons.push(improvementScore.reason);

    // Account status factors (0-10 points)
    const statusScore = this.calculateAccountStatusScore(profile);
    score += statusScore.score;
    if (statusScore.reason) reasons.push(statusScore.reason);

    // Store the reasons in the profile
    profile.suspicionReasons = reasons;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Determine suspicion level based on score
   */
  static getSuspicionLevel(score: number): SuspicionLevel {
    if (score >= 70) return SuspicionLevel.CRITICAL;
    if (score >= 50) return SuspicionLevel.HIGH;
    if (score >= 30) return SuspicionLevel.MEDIUM;
    if (score >= 15) return SuspicionLevel.LOW;
    return SuspicionLevel.NONE;
  }

  /**
   * Calculate suspicion based on account age
   */
  private static calculateAccountAgeScore(profile: ChessProfile): { score: number; reason?: string } {
    const { accountAge } = profile;

    // Brand new account with high rating
    if (accountAge <= 3) {
      const highestRating = Math.max(
        profile.ratings.bullet || 0,
        profile.ratings.blitz || 0,
        profile.ratings.rapid || 0,
        profile.ratings.classical || 0
      );

      if (highestRating > 2200) {
        return { score: 30, reason: `Very new account (${accountAge} days) with ${highestRating} rating` };
      } else if (highestRating > 1800) {
        return { score: 20, reason: `New account (${accountAge} days) with ${highestRating} rating` };
      }
    }

    // Week old account
    if (accountAge <= 7) {
      const highestRating = Math.max(
        profile.ratings.blitz || 0,
        profile.ratings.rapid || 0
      );

      if (highestRating > 2000) {
        return { score: 25, reason: `Week-old account with ${highestRating} rating` };
      } else if (highestRating > 1700) {
        return { score: 15, reason: `Recent account with strong rating` };
      }
    }

    // Month old account
    if (accountAge <= 30) {
      const highestRating = Math.max(
        profile.ratings.blitz || 0,
        profile.ratings.rapid || 0
      );

      if (highestRating > 2400) {
        return { score: 15, reason: `Young account (${accountAge} days) with master-level rating` };
      } else if (highestRating > 2200) {
        return { score: 10, reason: `Month-old account with expert rating` };
      }
    }

    // Established account
    if (accountAge > 180) {
      return { score: 0 };
    }

    return { score: 0 };
  }

  /**
   * Calculate suspicion based on rating vs games played
   */
  private static calculateRatingVsGamesScore(profile: ChessProfile): { score: number; reason?: string } {
    const totalGames = profile.gameStats.total;
    const highestRating = Math.max(
      profile.ratings.bullet || 0,
      profile.ratings.blitz || 0,
      profile.ratings.rapid || 0,
      profile.ratings.classical || 0
    );

    // Very few games with high rating
    if (totalGames < 30 && highestRating > 2000) {
      return { score: 25, reason: `Only ${totalGames} games with ${highestRating} rating` };
    }

    if (totalGames < 50 && highestRating > 1800) {
      return { score: 20, reason: `Few games (${totalGames}) for ${highestRating} rating` };
    }

    if (totalGames < 100 && highestRating > 2200) {
      return { score: 15, reason: `Low game count for master-level rating` };
    }

    // Expected progression
    const expectedGamesForRating = this.getExpectedGamesForRating(highestRating);
    if (totalGames < expectedGamesForRating * 0.3) {
      return { score: 10, reason: `Unusually fast rating progression` };
    }

    return { score: 0 };
  }

  /**
   * Calculate suspicion based on win rate
   */
  private static calculateWinRateScore(profile: ChessProfile): { score: number; reason?: string } {
    const winRate = profile.gameStats.winRate;
    const totalGames = profile.gameStats.total;

    // Extremely high win rate with significant games
    if (winRate > 85 && totalGames > 20) {
      return { score: 20, reason: `${winRate}% win rate over ${totalGames} games` };
    }

    if (winRate > 80 && totalGames > 50) {
      return { score: 15, reason: `Very high win rate: ${winRate}%` };
    }

    if (winRate > 75 && totalGames > 100) {
      return { score: 10, reason: `Unusually high win rate: ${winRate}%` };
    }

    // Also suspicious: very low win rate (might be farming)
    if (winRate < 15 && totalGames > 50) {
      return { score: 10, reason: `Suspiciously low win rate: ${winRate}%` };
    }

    return { score: 0 };
  }

  /**
   * Calculate suspicion based on rapid improvement
   */
  private static calculateRapidImprovementScore(profile: ChessProfile): { score: number; reason?: string } {
    if (!profile.recentActivity) {
      return { score: 0 };
    }

    const { ratingChange7Days, ratingChange30Days } = profile.recentActivity;

    // Massive improvement in a week
    if (ratingChange7Days && ratingChange7Days > 300) {
      return { score: 15, reason: `+${ratingChange7Days} rating in 7 days` };
    }

    if (ratingChange7Days && ratingChange7Days > 200) {
      return { score: 10, reason: `Rapid improvement: +${ratingChange7Days} in a week` };
    }

    // Large improvement in a month
    if (ratingChange30Days && ratingChange30Days > 500) {
      return { score: 10, reason: `+${ratingChange30Days} rating in 30 days` };
    }

    return { score: 0 };
  }

  /**
   * Calculate suspicion based on account status
   */
  private static calculateAccountStatusScore(profile: ChessProfile): { score: number; reason?: string } {
    const { accountStatus } = profile;

    // Already flagged by platform
    if (accountStatus.isViolator || accountStatus.isClosed) {
      return { score: 10, reason: 'Account flagged by platform' };
    }

    // Fair play concerns (Chess.com)
    if (accountStatus.isFairPlay === false) {
      return { score: 8, reason: 'Fair play violations detected' };
    }

    // Verified accounts get negative score (more trustworthy)
    if (accountStatus.isVerified) {
      return { score: -5 };
    }

    return { score: 0 };
  }

  /**
   * Get expected number of games for a rating level
   */
  private static getExpectedGamesForRating(rating: number): number {
    if (rating < 1200) return 50;
    if (rating < 1500) return 100;
    if (rating < 1800) return 300;
    if (rating < 2000) return 500;
    if (rating < 2200) return 1000;
    if (rating < 2400) return 2000;
    return 3000;
  }

  /**
   * Analyze profile and return complete analysis
   */
  static analyzeProfile(profile: ChessProfile): ChessProfile {
    // Calculate suspicion score
    const suspicionScore = this.calculateSuspicionScore(profile);
    profile.suspicionScore = suspicionScore;

    // Determine suspicion level
    profile.suspicionLevel = this.getSuspicionLevel(suspicionScore);

    // Log analysis for debugging
    logger.debug(`Analyzed ${profile.username}: Score ${suspicionScore}, Level ${profile.suspicionLevel}`);

    return profile;
  }

  /**
   * Get a human-readable summary of the profile
   */
  static getProfileSummary(profile: ChessProfile): string {
    const age = profile.accountAge < 30
      ? `${profile.accountAge} days old`
      : profile.accountAge < 365
        ? `${Math.floor(profile.accountAge / 30)} months old`
        : `${Math.floor(profile.accountAge / 365)} years old`;

    const mainRating = profile.ratings.blitz || profile.ratings.rapid || profile.ratings.bullet;

    const summary = [
      `Account: ${age}`,
      mainRating ? `Rating: ${mainRating}` : '',
      `Games: ${profile.gameStats.total}`,
      `Win rate: ${profile.gameStats.winRate}%`,
    ].filter(Boolean).join(' | ');

    return summary;
  }

  /**
   * Check if profile should trigger an alert
   */
  static shouldAlert(profile: ChessProfile, alertLevel: SuspicionLevel): boolean {
    const levels = [
      SuspicionLevel.NONE,
      SuspicionLevel.LOW,
      SuspicionLevel.MEDIUM,
      SuspicionLevel.HIGH,
      SuspicionLevel.CRITICAL
    ];

    const profileLevelIndex = levels.indexOf(profile.suspicionLevel);
    const alertLevelIndex = levels.indexOf(alertLevel);

    return profileLevelIndex >= alertLevelIndex;
  }
}