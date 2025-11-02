# Sus Meter - Chess Profile Analyzer Refactoring Plan

## Project Goal
Transform the template extension into a chess profile analyzer that helps users (especially streamers) identify suspicious accounts, new accounts, and likely cheaters on lichess.org and chess.com.

## Key Features to Implement

### 1. Profile Detection & Analysis
- **Account Age**: Display account creation date and age
- **Game Statistics**: Total games, win rate, rating progression
- **Red Flags**:
  - New accounts with unusually high ratings
  - Steep rating climbs in short periods
  - Low game count with high performance
  - Accounts with unusual accuracy patterns
  - Recent name changes (if available)

### 2. Visual Indicators
- **Badge System**: Color-coded indicators overlaid on usernames
  - 🟢 Green: Established account (>6 months, normal progression)
  - 🟡 Yellow: Caution (1-6 months old, or unusual patterns)
  - 🔴 Red: High suspicion (very new + high rating, or flagged patterns)
  - ⚫ Black: Known ban/closed account
- **Hover Cards**: Detailed info on mouse hover
- **Inline Indicators**: Small badges next to usernames in chat, game lists, etc.

### 3. Streamer-Specific Features
- **Quick Scan Mode**: For viewer challenges during streams
- **Bulk Analysis**: Check multiple profiles in tournament/arena settings
- **Alert System**: Configurable warnings for specific patterns
- **Whitelist/Blacklist**: Remember trusted/suspicious players

## Files to Refactor

### Phase 1: Type System & Core Data Structures

#### `src/types/index.ts` - Complete Rewrite
```typescript
// Replace entire file with chess-specific types
export interface ChessProfile {
  username: string;
  platform: 'lichess' | 'chess.com';
  accountAge: number; // days
  createdAt: string;
  ratings: {
    bullet?: number;
    blitz?: number;
    rapid?: number;
    classical?: number;
  };
  gameStats: {
    total: number;
    wins: number;
    losses: number;
    draws: number;
  };
  suspicionLevel: SuspicionLevel;
  suspicionReasons: string[];
  lastSeen?: string;
  isStreaming?: boolean;
  isClosed?: boolean;
}
```

### Phase 2: Content Scripts

#### `src/content/index.ts` - Complete Rewrite
Split into:
- `src/content/lichess.ts` - Lichess-specific DOM parsing
- `src/content/chess-com.ts` - Chess.com-specific DOM parsing
- `src/content/profile-detector.ts` - Common profile detection logic
- `src/content/ui-injector.ts` - Badge and hover card injection

### Phase 3: Analysis Engine

#### New Files to Create:
- `src/utils/profile-analyzer.ts` - Core analysis logic
- `src/utils/suspicion-calculator.ts` - Calculate suspicion scores
- `src/utils/api-client.ts` - Fetch data from chess platform APIs
- `src/utils/cache-manager.ts` - Cache profile data

### Phase 4: Background Service

#### `src/background/index.ts` - Major Update
- Add API request handling
- Implement caching system
- Add profile data fetching
- Manage cross-tab communication

### Phase 5: Popup UI

#### `src/popup/` - Complete Redesign
- Show current page analysis
- Display recent suspicious profiles
- Quick settings toggles
- Statistics dashboard

### Phase 6: Manifest & Permissions

#### `public/manifest.json` - Update
```json
{
  "host_permissions": [
    "*://lichess.org/*",
    "*://www.lichess.org/*",
    "*://chess.com/*",
    "*://www.chess.com/*"
  ],
  "permissions": [
    "storage",
    "activeTab",
    "alarms"
  ],
  "content_scripts": [
    {
      "matches": [
        "*://lichess.org/*",
        "*://www.lichess.org/*"
      ],
      "js": ["content-lichess.js"]
    },
    {
      "matches": [
        "*://chess.com/*",
        "*://www.chess.com/*"
      ],
      "js": ["content-chess-com.js"]
    }
  ]
}
```

## Implementation Order

1. **Types & Interfaces** (30 min)
   - Define all chess-specific types
   - Remove template types

2. **Profile Analyzer Core** (1 hr)
   - Suspicion calculation algorithm
   - Pattern detection logic

3. **Content Scripts** (2 hrs)
   - Lichess DOM parsing
   - Chess.com DOM parsing
   - UI injection system

4. **Background Service** (1 hr)
   - API integration
   - Caching system

5. **Popup UI** (1 hr)
   - Profile display
   - Settings management

6. **Testing & Refinement** (30 min)
   - Test on both platforms
   - Fine-tune detection

## Suspicion Detection Algorithm

```typescript
function calculateSuspicion(profile: ChessProfile): SuspicionLevel {
  let score = 0;

  // New account with high rating
  if (profile.accountAge < 7 && profile.ratings.blitz > 2000) score += 50;
  if (profile.accountAge < 30 && profile.ratings.blitz > 2400) score += 30;

  // Low games with high performance
  if (profile.gameStats.total < 100 && getWinRate(profile) > 0.8) score += 40;

  // Rapid rating climb
  // (needs historical data - future enhancement)

  if (score >= 70) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}
```

## UI Components to Build

1. **Profile Badge Component**
   - Small circular indicator
   - Color-coded by suspicion level
   - Click for details

2. **Hover Card Component**
   - Account age prominently displayed
   - Key statistics
   - Suspicion reasons listed

3. **Popup Dashboard**
   - Current page scan results
   - Recent suspicious profiles
   - Quick stats

## Files to Delete/Rename
- Remove all template-specific code
- Delete example functions
- Remove generic "scan page" functionality

## Configuration Options
```typescript
interface ExtensionConfig {
  enabled: boolean;
  showBadges: boolean;
  showHoverCards: boolean;
  alertThreshold: SuspicionLevel;
  checkChatUsers: boolean;
  checkOpponents: boolean;
  checkTournamentPlayers: boolean;
  cacheExpiry: number; // hours
  whitelistedUsers: string[];
  blacklistedUsers: string[];
}
```

## Success Criteria
1. ✅ Badges appear next to usernames on both platforms
2. ✅ Hover shows account age and key stats
3. ✅ New accounts are clearly flagged
4. ✅ Works in chat, game lists, and tournaments
5. ✅ Minimal performance impact
6. ✅ Configurable sensitivity

## Next Steps
Start with Phase 1: Refactor the type system to be chess-specific.