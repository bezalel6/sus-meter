# Sus Meter - Chrome Extension

A TypeScript-based Chrome extension built with Manifest V3 that helps you analyze and meter suspicious content on web pages.

## Features

- 🎯 **Real-time Analysis**: Scans web pages for suspicious content
- 🛡️ **Security Focused**: Built with security best practices in mind
- ⚡ **Performance Optimized**: Efficient background service worker
- 🎨 **Modern UI**: Clean and intuitive popup interface
- 🔧 **Configurable**: Customizable settings and preferences
- 📊 **Visual Indicators**: Badge notifications and visual feedback

## Tech Stack

- **TypeScript**: Type-safe development
- **Manifest V3**: Latest Chrome extension standards
- **Webpack**: Module bundling and optimization
- **ESLint & Prettier**: Code quality and formatting
- **webextension-polyfill**: Cross-browser compatibility

## Project Structure

```
sus-meter/
├── src/
│   ├── background/       # Background service worker
│   ├── content/          # Content scripts
│   ├── popup/            # Popup UI
│   ├── utils/            # Utility functions
│   └── types/            # TypeScript type definitions
├── public/
│   ├── manifest.json     # Extension manifest
│   └── icons/            # Extension icons
├── dist/                 # Build output (generated)
├── scripts/              # Build and utility scripts
└── tests/                # Test files
```

## Development Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Chrome browser

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sus-meter.git
cd sus-meter
```

2. Install dependencies:
```bash
npm install
```

3. Generate icon placeholders:
```bash
node scripts/generate-icons.js
```

4. Build the extension:
```bash
npm run build:dev
```

### Development Commands

```bash
# Start development mode with watch
npm run dev

# Build for production
npm run build

# Build for development
npm run build:dev

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check

# Run tests
npm run test

# Clean build directory
npm run clean
```

## Loading the Extension

### In Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `dist` directory from this project
5. The extension should now appear in your extensions list

### In Edge

1. Open Edge and navigate to `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` directory

### In Brave

1. Open Brave and navigate to `brave://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` directory

## Usage

1. Click on the Sus Meter extension icon in your browser toolbar
2. The popup will show the current page status
3. Click "Scan Page" to analyze the current page
4. Configure settings as needed
5. The extension badge will update based on scan results

## Development Workflow

1. Make changes to the source code
2. Run `npm run dev` to watch for changes
3. The extension will rebuild automatically
4. Reload the extension in Chrome:
   - Go to `chrome://extensions/`
   - Click the refresh button on the Sus Meter extension card
5. Test your changes

## Architecture

### Background Service Worker
- Handles extension lifecycle events
- Manages communication between components
- Controls badge updates and notifications

### Content Scripts
- Injected into web pages
- Analyzes page content
- Communicates findings to background script

### Popup UI
- User interface for extension control
- Settings management
- Real-time status display

## Configuration

### TypeScript Configuration
- Strict mode enabled for type safety
- Path aliases configured for clean imports
- Source maps enabled for debugging

### Webpack Configuration
- Separate bundles for background, content, and popup scripts
- Development and production modes
- Automatic copying of static assets

### ESLint & Prettier
- Consistent code formatting
- TypeScript-specific rules
- Automatic fixing available

## Security Considerations

- Follows Chrome Extension Manifest V3 security best practices
- Content Security Policy configured
- Minimal permissions requested
- No external script injection

## Testing

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

## Building for Production

1. Update version in `manifest.json` and `package.json`
2. Run production build:
```bash
npm run build
```
3. The production-ready extension will be in the `dist` directory
4. Create a ZIP file of the `dist` directory for distribution

## Icons

Placeholder icons are provided. To create custom icons:

1. Design icons in the following sizes:
   - 16x16 (toolbar)
   - 32x32 (Windows)
   - 48x48 (extensions page)
   - 128x128 (Chrome Web Store)

2. Save as PNG files in `public/icons/`
3. Update references in `manifest.json` if needed

## Troubleshooting

### Extension not loading
- Ensure you've built the project (`npm run build`)
- Check that Developer Mode is enabled
- Verify the `dist` directory exists and contains files

### Changes not appearing
- Reload the extension in Chrome
- Clear the browser cache
- Rebuild the project

### TypeScript errors
- Run `npm run type-check` to see all errors
- Ensure all dependencies are installed
- Check that path aliases are correctly configured

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

## Roadmap

- [ ] Add more sophisticated content analysis
- [ ] Implement machine learning for detection
- [ ] Add support for Firefox
- [ ] Create options page for advanced settings
- [ ] Add export functionality for scan results
- [ ] Implement real-time notifications
- [ ] Add dark mode support
- [ ] Create unit and integration tests

## Acknowledgments

- Chrome Extension documentation
- TypeScript community
- webextension-polyfill contributors