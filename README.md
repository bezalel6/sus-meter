# Sus-O-Meter

### Know Your Opponent. Protect Your Game.

A powerful Chrome extension that instantly analyzes chess player profiles on Lichess and Chess.com. Whether you're a casual player, competitive chess enthusiast, or streamer, Sus-O-Meter helps you make informed decisions about who you're playing against by revealing critical profile information at a glance.

## Why Sus-O-Meter?

Playing chess online should be fair and enjoyable. Sus-O-Meter empowers you to:

- **Protect Your Rating** - Avoid wasting time on suspicious accounts that might be cheating
- **Safeguard Your Streams** - Keep your content clean by identifying questionable opponents before accepting challenges
- **Make Informed Decisions** - Quickly assess whether an opponent's profile raises red flags
- **Save Time** - Get instant analysis without manually checking multiple profile pages
- **Play with Confidence** - Know who you're up against before the first move

## Features

### 🔍 Instant Profile Analysis
Analyze any chess player profile with a single click. Get comprehensive information including account age, rating, games played, win rate, and more.

### 📊 Smart Suspicion Detection
Advanced algorithm analyzes multiple factors to identify potentially suspicious accounts:
- Very new accounts with high ratings
- Unusually high win rates for account age
- Platform-flagged accounts (maximum suspicion)
- Minimal game history with exceptional performance
- Accounts created recently with professional-level play

### ⚡ Automatic Detection
Automatically scans chess websites and highlights suspicious profiles with visual badges. No manual checking required.

### 🎯 Profile Picker
Use the profile picker tool to quickly analyze any username you see on the page - perfect for checking tournament participants, chat mentions, or leaderboard entries.

### 🎨 Visual Feedback System
Color-coded badges instantly communicate suspicion levels:
- **Red**: Critical - Extremely suspicious account
- **Orange**: High - Very suspicious patterns detected
- **Yellow**: Medium - Some concerning factors
- **Green**: Low - Profile appears normal

### 💾 Smart Caching
Profiles are cached for 24 hours to reduce API calls and provide instant results for recently analyzed players.

### ⚙️ Customizable Settings
Fine-tune the analysis to match your preferences:
- Adjust age thresholds for different suspicion levels
- Configure rating and performance thresholds
- Set minimum games required for established players
- Customize win rate suspicion triggers

### 📝 Analysis History
Keep track of profiles you've analyzed with a searchable history, making it easy to review previous checks.

## Perfect For

### 🎮 Streamers
Protect your content and audience by screening opponents before accepting challenges. Avoid awkward situations where you might face a cheater on stream.

### 🏆 Competitive Players
Make informed decisions about which games to accept. Don't risk your rating against suspicious accounts.

### 👥 Tournament Organizers
Quickly screen participants and identify potentially problematic accounts before events begin.

### 🎓 Chess Coaches
Help students understand the importance of fair play and teach them to recognize suspicious patterns.

## How It Works

1. **Install the Extension** - Add Sus-O-Meter to Chrome in seconds
2. **Visit Chess Websites** - Browse Lichess or Chess.com as usual
3. **See Instant Badges** - Suspicious profiles are automatically highlighted with colored badges
4. **Click for Details** - Hover over badges or click the extension icon for comprehensive analysis
5. **Make Informed Decisions** - Choose whether to accept challenges, report accounts, or simply stay informed

## Use Cases

### Before Accepting a Challenge
Someone challenges you to a game. Click their profile badge to see:
- Account created 5 days ago? ⚠️
- 2400 rating with only 20 games? 🚨
- 95% win rate? 🔴

### During Live Streams
Viewers suggest playing against specific opponents. Use the profile picker to quickly check:
- Are they legitimate players?
- Do they have a normal progression?
- Any red flags that might disrupt your stream?

### Tournament Participation
Browsing tournament participants? Automatically see badges next to usernames:
- Green badges: Established players with normal patterns
- Yellow/Red badges: Accounts worth investigating further

### Chat Monitoring
Someone mentions a player in chat. Hover over their name to see their badge and suspicion level without leaving the page.

## Installation

### From Source (Development)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sus-o-meter.git
cd sus-o-meter
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `dist` directory from the project
   - Start analyzing profiles!

## Development

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Chrome browser

### Available Commands

```bash
# Development with watch mode - rebuilds automatically
npm run dev

# Build for production
npm run build

# Build for development (one-time)
npm run build:dev

# Code quality
npm run lint          # Check for linting errors
npm run lint:fix      # Auto-fix linting errors
npm run format        # Format code with Prettier
npm run type-check    # TypeScript type checking

# Testing
npm run test          # Run tests once
npm run test:watch    # Run tests in watch mode

# Utilities
npm run clean         # Clean build artifacts
npm run generate-icons # Generate icon placeholders
```

### Development Workflow

1. Run `npm run dev` to start watch mode
2. Make changes to source files in `src/`
3. Extension rebuilds automatically
4. Reload extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Click the refresh icon on Sus-O-Meter
5. Test your changes on Lichess or Chess.com

## Tech Stack

**Core Technologies:**
- TypeScript - Type-safe development
- Manifest V3 - Latest Chrome extension standards
- Webpack - Module bundling and optimization

**Code Quality:**
- ESLint & Prettier - Code quality and formatting
- Jest - Testing framework

**Browser Compatibility:**
- webextension-polyfill - Cross-browser support

## Project Structure

```
sus-o-meter/
├── src/
│   ├── background/       # Background service worker (API handler)
│   ├── content/          # Content scripts (Lichess, Chess.com)
│   ├── popup/            # Extension popup UI
│   ├── utils/            # Utility functions (analyzer, cache, API)
│   └── types/            # TypeScript type definitions
├── public/
│   ├── manifest.json     # Extension manifest
│   ├── popup.html        # Popup HTML
│   └── icons/            # Extension icons
├── dist/                 # Build output (generated)
└── scripts/              # Build and utility scripts
```

## Architecture

### Message-Based Communication
All components communicate through a typed messaging system for clean separation of concerns and reliable data flow.

### Smart Caching
Profiles are cached for 24 hours to minimize API calls and provide instant results for recently checked players.

### Multiple Detection Methods
- URL-based profile detection (profile pages)
- DOM-based username scanning (chat, games, tournaments)
- Manual search via popup interface
- Profile picker for click-to-analyze functionality

### Platform-Specific Integration
Optimized content scripts for each platform handle differences in DOM structure and API responses.

## Privacy & Security

- **No Data Collection** - Your searches and analysis results stay on your device
- **Local Storage Only** - All data stored locally in your browser
- **Official APIs** - Uses only public, official APIs from Lichess and Chess.com
- **Minimal Permissions** - Only requests necessary permissions for functionality
- **No External Servers** - All analysis happens locally in your browser

## Supported Platforms

- ✅ **Lichess.org** - Full support for all profile types
- ✅ **Chess.com** - Full support for all profile types

## FAQ

**Q: Does this extension detect cheaters?**
A: Sus-O-Meter identifies suspicious patterns, but it doesn't definitively prove cheating. It's a tool to help you make informed decisions. Always report suspected cheaters through official platform channels.

**Q: Why are some normal accounts flagged?**
A: New accounts with high ratings might be legitimate players creating alt accounts or returning after a break. Use your judgment and consider multiple factors.

**Q: Does this work on mobile?**
A: Currently, Sus-O-Meter is only available for Chrome on desktop. Mobile browser extension support is limited.

**Q: Will this slow down my browsing?**
A: No. Sus-O-Meter is optimized for performance with efficient caching and minimal API calls.

**Q: Can I adjust the sensitivity?**
A: Yes! Open the settings panel to customize thresholds for account age, ratings, win rates, and more.

**Q: Is my data shared with anyone?**
A: No. All data stays on your device. We don't collect, store, or share any information.

## Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`npm run test && npm run lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Roadmap

- [ ] Firefox extension support
- [ ] Advanced machine learning-based detection
- [ ] Whitelist/blacklist management improvements
- [ ] Bulk tournament participant analysis
- [ ] Profile comparison tools
- [ ] Export analysis reports
- [ ] Dark mode support
- [ ] Multiple language support
- [ ] Custom badge designs

## Support

Having issues or questions? Here's how to get help:

- 🐛 **Bug Reports** - Open an issue on GitHub
- 💡 **Feature Requests** - Open an issue with your suggestion
- 📧 **Questions** - Check existing issues or open a new discussion

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Lichess.org and Chess.com for providing public APIs
- The chess community for feedback and feature suggestions
- TypeScript and Chrome Extension communities

## Disclaimer

Sus-O-Meter is an independent tool not affiliated with, endorsed by, or connected to Lichess.org or Chess.com. This extension is designed to help users make informed decisions and should be used responsibly. Always report suspected cheating through official platform channels.

---

**Made with ♟️ for the chess community**

*Stay safe, play fair, and may all your opponents be genuine players.*
