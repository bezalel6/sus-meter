# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sus-O-Meter is a cross-browser extension (Chrome & Firefox) that analyzes user profiles on chess websites (lichess.org and chess.com) to indicate important information about users, potentially flagging suspicious behavior or profile characteristics. The extension helps players, streamers, and tournament organizers make informed decisions by providing instant analysis of account age, statistics, and suspicious patterns. The extension uses Manifest V3 and is built with TypeScript.

## Development Commands

```bash
# Install dependencies
npm install

# Development with watch mode
npm run dev              # Chrome (default) - primary development command
npm run dev:chrome       # Chrome-specific development
npm run dev:firefox      # Firefox-specific development

# Build for production
npm run build            # Build both Chrome and Firefox versions
npm run build:chrome     # Chrome-only production build
npm run build:firefox    # Firefox-only production build

# Build for development (one-time, no watch)
npm run build:dev        # Chrome development build
npm run build:dev:chrome # Chrome development build
npm run build:dev:firefox # Firefox development build

# Packaging
npm run zip              # Create zip files for both browsers
npm run package          # Build and zip both versions

# Linting and formatting
npm run lint          # Check for linting errors
npm run lint:fix      # Auto-fix linting errors
npm run format        # Format code with Prettier
npm run type-check    # TypeScript type checking

# Testing
npm run test          # Run tests once
npm run test:watch    # Run tests in watch mode
jest --testPathPattern=specific.test.ts  # Run specific test file

# Clean build artifacts
npm run clean         # Remove both dist-chrome and dist-firefox
```

## Cross-Browser Build System

The project supports both Chrome and Firefox with dedicated manifest files and build outputs:

### Manifest Files

- **`public/manifest-chrome.json`**: Chrome-specific manifest using `service_worker` for background scripts
- **`public/manifest-firefox.json`**: Firefox-specific manifest with `browser_specific_settings` and `scripts` array for background

Key differences between manifests:
- Firefox includes `browser_specific_settings.gecko` with:
  - Extension ID (`sus-o-meter@chess-analyzer.extension`)
  - Minimum version requirement (Firefox 109+)
  - `data_collection_permissions: false` (extension doesn't collect user data)
- Firefox uses `background.scripts` array, Chrome uses `background.service_worker`
- Both use Manifest V3 for consistency

### Build Outputs

- **`dist-chrome/`**: Chrome extension build with manifest-chrome.json copied as manifest.json
- **`dist-firefox/`**: Firefox extension build with manifest-firefox.json copied as manifest.json
- **`sus-o-meter-chrome.zip`**: Packaged Chrome extension
- **`sus-o-meter-firefox.zip`**: Packaged Firefox extension

### Webpack Configuration

The webpack config accepts a `--env browser=<chrome|firefox>` flag to determine:
1. Which manifest file to copy (`manifest-<browser>.json` → `manifest.json`)
2. Output directory (`dist-<browser>/`)
3. Browser-specific optimizations if needed

Default browser is Chrome for backwards compatibility.

## Architecture & Communication Patterns

### Extension Components

1. **Background Service Worker** (`src/background/index.ts`)
   - Central API request handler and profile analysis coordinator
   - Manages profile caching and whitelist/blacklist
   - Coordinates between content scripts and popup
   - Handles periodic cache cleanup with alarms API

2. **Content Scripts**
   - **Lichess** (`src/content/lichess.ts`): Detects profiles on lichess.org
   - **Chess.com** (`src/content/chess-com.ts`): Detects profiles on chess.com
   - **Profile Injector** (`src/content/profile-injector.ts`): Injects badges and hover cards
   - Scans for usernames in chat, games, tournaments, and lists
   - Communicates with background for profile analysis

3. **Popup UI** (`src/popup/index.ts`)
   - User interface for extension control and settings
   - Displays current page analysis and statistics
   - Manages whitelist/blacklist and configuration

4. **Core Utilities**
   - **Profile Analyzer** (`src/utils/profile-analyzer.ts`): Suspicion scoring algorithm
   - **API Client** (`src/utils/api-client.ts`): Fetches data from chess platforms
   - **Cache Manager** (`src/utils/cache-manager.ts`): Manages profile data caching

### Message Flow Architecture

The extension uses a typed messaging system defined in `src/types/index.ts`. All components communicate through:
- `ExtensionMessage` interface with typed `MessageType` enum
- Utility functions in `src/utils/messaging.ts` for cross-component communication
- Storage utilities in `src/utils/storage.ts` for persistent data

Key message types: `PROFILES_DETECTED`, `ANALYZE_PROFILE`, `GET_CACHED_PROFILE`, `ADD_TO_WHITELIST`, `SETTINGS_UPDATED`

### TypeScript Path Aliases

The project uses path aliases configured in both TypeScript and Webpack:
- `@/` → `src/`
- `@background/` → `src/background/`
- `@content/` → `src/content/`
- `@popup/` → `src/popup/`
- `@utils/` → `src/utils/`
- `@types/` → `src/types/`

## Extension Development Workflow

### Chrome Development

1. **Loading Extension for Development**:
   - Run `npm run dev` or `npm run dev:chrome` to start watch mode
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist-chrome` directory
   - After changes, click the refresh icon on the extension card

2. **Testing Changes**:
   - Content script changes: Reload the chess website page
   - Background script changes: Click refresh on extension card
   - Popup changes: Close and reopen the popup

3. **Debugging**:
   - Background: Click "Inspect views: service worker" in extension card
   - Content: Use browser DevTools on the chess website
   - Popup: Right-click popup and select "Inspect"

### Firefox Development

1. **Loading Extension for Development**:
   - Run `npm run dev:firefox` to start watch mode
   - Navigate to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select any file in the `dist-firefox` directory (e.g., manifest.json)
   - After changes, click the "Reload" button for the extension

2. **Testing Changes**:
   - Content script changes: Reload the chess website page
   - Background script changes: Click reload in about:debugging
   - Popup changes: Close and reopen the popup

3. **Debugging**:
   - Background: Click "Inspect" next to the extension in about:debugging
   - Content: Use browser DevTools on the chess website
   - Popup: Right-click popup and select "Inspect"

## Chess Website Integration

The extension specifically targets:
- **lichess.org**: Open-source chess platform
- **chess.com**: Commercial chess platform

Content scripts should handle differences between these platforms' DOM structures and APIs. Consider using site-specific analyzers if the platforms differ significantly.

## Build System Details

- **Webpack Configuration**: Four entry points (background, content-lichess, content-chess-com, popup) with separate bundles
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Testing**: Jest with ts-jest for TypeScript support, jsdom for browser API mocking
- **Cross-browser**: Uses webextension-polyfill for browser API compatibility

## Key Architectural Decisions

1. **Message-Based Architecture**: All components communicate via typed messages to maintain separation of concerns
2. **Storage Abstraction**: Centralized storage utilities handle all persistence operations
3. **Type Safety**: Comprehensive TypeScript types for all data structures and messages
4. **Badge System**: Visual feedback through extension badge with color-coded states (defined in `BADGE_COLORS`)
5. **Permission Model**: Uses activeTab and storage permissions with host permissions for all URLs

## Important Notes

- Host permissions are restricted to lichess.org and chess.com domains only
- Uses browser.storage.local for data persistence (not sync storage)
- Content scripts run at `document_idle` to ensure DOM is ready
- All async operations use proper error handling with null returns on failure
- Profile data is cached for 24 hours by default to reduce API calls
- The extension uses official public APIs from both chess platforms