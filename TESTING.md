# Sus Meter Extension Testing Guide

## Installation

1. Open Chrome/Edge and navigate to `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the `dist` folder from this project
5. The Sus Meter extension should now be installed with its icon in the toolbar

## Using the Popup Interface (NEW - MVP Feature)

The extension now features a streamlined popup interface for manual profile checking:

### How to Use the Popup

1. **Click the Sus Meter icon** in your browser toolbar
2. **Enter a username** in the input field
3. **Select platform** (Lichess or Chess.com) from the dropdown
4. **Click "Check Profile"** to analyze

### Popup Features

#### Profile Analysis Display
- **Account Age Card** (Primary Focus)
  - Large, prominent display of account age
  - Red border for accounts < 7 days
  - Orange border for accounts < 30 days
  - Shows exact creation date

- **Quick Stats**
  - Current rating
  - Total games played
  - Win rate percentage

- **Suspicion Analysis**
  - Color-coded suspicion level badge
  - Suspicion score (0-100)
  - List of specific suspicion reasons

#### Search History
- **Recent Searches** section shows last 10 searches
- Click on any previous search to re-analyze
- Clear history button to reset
- Shows age indicator for each saved profile

#### Settings Panel
- Toggle auto-detection on chess sites
- Enable/disable hover cards
- Control profile caching (24-hour default)

### Test Usernames

#### Lichess
- **Old accounts**: "lichess", "DrNykterstein" (Magnus Carlsen)
- **New accounts**: Check recent tournament players

#### Chess.com
- **Old accounts**: "hikaru", "MagnusCarlsen"
- **New accounts**: Look for recent registrations in live games

## API Verification

Our implementation has been verified against the official documentation:

### Lichess API
- **Endpoint**: `https://lichess.org/api/user/{username}`
- **Authentication**: None required for public data
- **Rate Limiting**: Serial requests only, wait 1 minute after 429 response
- **Verified**: ✅

### Chess.com API
- **Endpoint**: `https://api.chess.com/pub/player/{username}`
- **Stats Endpoint**: `https://api.chess.com/pub/player/{username}/stats`
- **Authentication**: None required (public API)
- **Headers**: User-Agent recommended: `Sus-Meter-Extension/1.0`
- **Rate Limiting**: Serial access unlimited, parallel may trigger 429
- **Verified**: ✅

## Auto-Detection on Chess Sites

When enabled in settings, the extension still provides automatic detection:

### On Lichess.org

1. Navigate to https://lichess.org
2. Look for usernames in:
   - Chat messages
   - Game pages (player names)
   - Tournament standings
   - User profiles
   - Friend lists

3. Expected behavior:
   - **NEW** badge (red) for accounts < 7 days old
   - **Xd** badge (orange) for accounts 7-14 days old
   - **Xw** badge (amber) for accounts 14-30 days old
   - No badge for accounts > 30 days old

### On Chess.com

1. Navigate to https://chess.com
2. Look for usernames in:
   - Live chat
   - Game pages
   - Tournament pages
   - User profiles
   - Friend/club lists

3. Expected behavior:
   - Same age indicators as Lichess
   - Account age calculated from `joined` timestamp

## Hover Card Features

When hovering over a username with a badge (if enabled):
- Shows detailed account age (e.g., "Account age: 5 days")
- Displays suspicion score and level
- Lists reasons for suspicion
- Shows rating information
- Indicates recent activity

## Console Debugging

1. Open Chrome DevTools (F12)
2. Go to the Console tab
3. Look for messages from:
   - `[ChessComContent]` - Chess.com detection
   - `[LichessContent]` - Lichess detection
   - `[ProfileInjector]` - Badge injection
   - `[APIClient]` - API requests
   - `[ProfileAnalyzer]` - Suspicion scoring
   - `[CacheManager]` - Cache operations

## Troubleshooting

### Popup Issues
1. **No results appearing**: Check if username is correct
2. **Loading stuck**: Check console for API errors
3. **Settings not saving**: Ensure storage permissions are granted

### Auto-Detection Issues
1. **No badges appearing**: Check if auto-detection is enabled in popup settings
2. **Badges not updating**: Refresh the page after enabling
3. **Console errors**: Check for conflicting extensions

### API Errors
1. **404 errors**: Username doesn't exist on selected platform
2. **429 errors**: Rate limited, wait before retrying
3. **Network errors**: Check internet connection

### Visual Issues
1. Check if other extensions conflict
2. Try disabling other chess-related extensions
3. Clear cache and reload

## Performance

The extension includes:
- **24-hour cache** to reduce API calls
- **500ms delay** between batch requests
- **Efficient DOM observation** for auto-detection
- **Local storage** for search history
- **Deduplication** of detected profiles

## Privacy & Security

- Only fetches publicly available data
- No authentication required
- No private user data accessed
- All API calls respect rate limits
- Search history stored locally only
- Cache can be cleared anytime

## MVP Features

This is a Minimum Viable Product (MVP) focusing on:
1. **Manual profile checking** via popup
2. **Account age as primary indicator**
3. **Simple suspicion scoring**
4. **Search history for convenience**
5. **Optional auto-detection on chess sites

Future enhancements could include:
- Bulk profile analysis
- Export functionality
- Advanced filtering options
- Custom suspicion thresholds
- Integration with streaming software