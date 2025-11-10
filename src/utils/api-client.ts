import { ChessProfile, ChessPlatform, API_ENDPOINTS } from '@/types';
import { createLogger } from './logger';

const logger = createLogger('APIClient');

/**
 * API client for fetching chess profile data from various platforms
 */
export class ChessAPIClient {
  /**
   * Fetch profile data from Lichess or Chess.com
   */
  static async fetchProfile(username: string, platform: ChessPlatform): Promise<ChessProfile | null> {
    try {
      if (platform === 'lichess') {
        return await this.fetchLichessProfile(username);
      } else {
        return await this.fetchChessComProfile(username);
      }
    } catch (error) {
      logger.error(`Failed to fetch profile for ${username} on ${platform}:`, error);
      return null;
    }
  }

  /**
   * Fetch Lichess profile data
   */
  private static async fetchLichessProfile(username: string): Promise<ChessProfile | null> {
    try {
      // Lichess API endpoint - no authentication required for public data
      const response = await fetch(API_ENDPOINTS.lichess.user(username));

      if (!response.ok) {
        if (response.status === 404) {
          logger.warn(`Lichess user not found: ${username}`);
        } else if (response.status === 429) {
          logger.warn(`Rate limited by Lichess. Waiting before retry.`);
        }
        return null;
      }

      const data = await response.json();

      // Calculate account age
      const createdAt = new Date(data.createdAt);
      const accountAge = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Extract ratings
      const ratings = {
        bullet: data.perfs?.bullet?.rating,
        blitz: data.perfs?.blitz?.rating,
        rapid: data.perfs?.rapid?.rating,
        classical: data.perfs?.classical?.rating,
        puzzle: data.perfs?.puzzle?.rating,
      };

      // Extract peak ratings
      const peakRatings = {
        bullet: data.perfs?.bullet?.peak,
        blitz: data.perfs?.blitz?.peak,
        rapid: data.perfs?.rapid?.peak,
        classical: data.perfs?.classical?.peak,
      };

      // Calculate game statistics
      const totalGames = data.count?.all || 0;
      const ratedGames = data.count?.rated || 0;
      const unratedGames = totalGames - ratedGames;
      const wins = data.count?.win || 0;
      const losses = data.count?.loss || 0;
      const draws = data.count?.draw || 0;
      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

      // Create profile object
      const profile: ChessProfile = {
        username: data.username,
        platform: 'lichess',
        accountAge,
        createdAt: createdAt.toISOString(),
        ratings,
        peakRatings,
        gameStats: {
          total: totalGames,
          rated: ratedGames,
          unrated: unratedGames,
          wins,
          losses,
          draws,
          winRate,
        },
        accountStatus: {
          isOnline: data.online || false,
          isStreaming: data.streaming || false,
          isVerified: data.verified || false,
          isClosed: data.disabled || false,
          isViolator: data.tosViolation || false,
        },
        suspicionScore: 0, // Will be calculated by analyzer
        suspicionLevel: 'none' as any, // Will be calculated by analyzer
        suspicionReasons: [],
        lastUpdated: new Date().toISOString(),
      };

      // Add recent activity if available
      if (data.seenAt) {
        const lastSeen = new Date(data.seenAt);
        const daysSinceLastSeen = Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastSeen <= 30) {
          profile.recentActivity = {
            gamesLast7Days: 0, // Would need additional API call
            gamesLast30Days: 0, // Would need additional API call
          };
        }
      }

      logger.debug(`Fetched Lichess profile for ${username}`);
      return profile;

    } catch (error) {
      logger.error(`Error fetching Lichess profile for ${username}:`, error);
      return null;
    }
  }

  /**
   * Fetch Chess.com profile data
   */
  private static async fetchChessComProfile(username: string): Promise<ChessProfile | null> {
    try {
      // Chess.com recommends including a User-Agent header to prevent blocking
      const headers = {
        'User-Agent': 'Sus-Meter-Extension/1.0 (https://github.com/bezal/sus-meter)',
      };

      // Fetch basic profile using Published-Data API
      const profileResponse = await fetch(API_ENDPOINTS.chesscom.user(username), { headers });

      if (!profileResponse.ok) {
        if (profileResponse.status === 404) {
          logger.warn(`Chess.com user not found: ${username}`);
        } else if (profileResponse.status === 429) {
          logger.warn(`Rate limited by Chess.com. Please wait before retrying.`);
        }
        return null;
      }

      const profileData = await profileResponse.json();

      // Fetch stats endpoint
      const statsResponse = await fetch(API_ENDPOINTS.chesscom.stats(username), { headers });
      const statsData = statsResponse.ok ? await statsResponse.json() : {};

      // Calculate account age
      const createdAt = new Date(profileData.joined * 1000); // Chess.com uses Unix timestamp
      const accountAge = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Extract ratings from stats
      const ratings = {
        bullet: statsData.chess_bullet?.last?.rating,
        blitz: statsData.chess_blitz?.last?.rating,
        rapid: statsData.chess_rapid?.last?.rating,
        classical: statsData.chess_daily?.last?.rating,
        puzzle: statsData.tactics?.highest?.rating,
      };

      // Extract peak ratings
      const peakRatings = {
        bullet: statsData.chess_bullet?.best?.rating,
        blitz: statsData.chess_blitz?.best?.rating,
        rapid: statsData.chess_rapid?.best?.rating,
        classical: statsData.chess_daily?.best?.rating,
      };

      // Calculate total games
      let totalGames = 0;
      let ratedGames = 0;
      let unratedGames = 0;
      let totalWins = 0;
      let totalLosses = 0;
      let totalDraws = 0;

      // Count rated games from standard time controls
      ['chess_bullet', 'chess_blitz', 'chess_rapid', 'chess_daily'].forEach(category => {
        if (statsData[category]?.record) {
          const record = statsData[category].record;
          const categoryWins = record.win || 0;
          const categoryLosses = record.loss || 0;
          const categoryDraws = record.draw || 0;

          totalWins += categoryWins;
          totalLosses += categoryLosses;
          totalDraws += categoryDraws;
          ratedGames += categoryWins + categoryLosses + categoryDraws;
        }
      });

      // Count unrated games (variants and puzzle rush)
      ['chess960', 'chess3check', 'kingofthehill', 'crazyhouse'].forEach(variant => {
        if (statsData[variant]?.record) {
          const record = statsData[variant].record;
          const variantGames = (record.win || 0) + (record.loss || 0) + (record.draw || 0);
          unratedGames += variantGames;
          totalWins += record.win || 0;
          totalLosses += record.loss || 0;
          totalDraws += record.draw || 0;
        }
      });

      totalGames = totalWins + totalLosses + totalDraws;
      const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

      // Create profile object
      const profile: ChessProfile = {
        username: profileData.username,
        platform: 'chess.com',
        accountAge,
        createdAt: createdAt.toISOString(),
        ratings,
        peakRatings,
        gameStats: {
          total: totalGames,
          rated: ratedGames,
          unrated: unratedGames,
          wins: totalWins,
          losses: totalLosses,
          draws: totalDraws,
          winRate,
        },
        accountStatus: {
          isOnline: profileData.status === 'online',
          isStreaming: profileData.is_streamer || false,
          isVerified: profileData.verified || false,
          isClosed: profileData.status === 'closed',
          isFairPlay: !profileData.fair_play_violations,
        },
        suspicionScore: 0, // Will be calculated by analyzer
        suspicionLevel: 'none' as any, // Will be calculated by analyzer
        suspicionReasons: [],
        lastUpdated: new Date().toISOString(),
      };

      logger.debug(`Fetched Chess.com profile for ${username}`);
      return profile;

    } catch (error) {
      logger.error(`Error fetching Chess.com profile for ${username}:`, error);
      return null;
    }
  }

  /**
   * Batch fetch multiple profiles
   */
  static async fetchProfiles(
    usernames: string[],
    platform: ChessPlatform
  ): Promise<Map<string, ChessProfile | null>> {
    const results = new Map<string, ChessProfile | null>();

    // Fetch profiles with rate limiting
    // API documentation recommends serial access only
    for (const username of usernames) {
      const profile = await this.fetchProfile(username, platform);
      results.set(username, profile);

      // Delay between requests to respect rate limits
      // Lichess: recommends one request at a time
      // Chess.com: serial access is unlimited, parallel may trigger 429
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  /**
   * Check if a user exists on a platform
   */
  static async userExists(username: string, platform: ChessPlatform): Promise<boolean> {
    try {
      const url = platform === 'lichess'
        ? API_ENDPOINTS.lichess.user(username)
        : API_ENDPOINTS.chesscom.user(username);

      // Add User-Agent header for Chess.com
      const options: RequestInit = { method: 'HEAD' };
      if (platform === 'chess.com') {
        options.headers = {
          'User-Agent': 'Sus-Meter-Extension/1.0 (https://github.com/bezal/sus-meter)',
        };
      }

      const response = await fetch(url, options);
      return response.ok;
    } catch (error) {
      logger.error(`Error checking if user exists: ${username} on ${platform}`, error);
      return false;
    }
  }
}