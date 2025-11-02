// Test setup file for Jest
// Mock browser API for testing

// Mock chrome/browser API
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    onInstalled: {
      addListener: jest.fn(),
    },
    getManifest: jest.fn(() => ({
      version: '1.0.0',
      name: 'Sus Meter',
    })),
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
    },
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    setIcon: jest.fn(),
  },
  contextMenus: {
    create: jest.fn(),
    remove: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
  },
  scripting: {
    executeScript: jest.fn(),
  },
} as any;

// Mock webextension-polyfill
jest.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: global.chrome,
  runtime: global.chrome.runtime,
  tabs: global.chrome.tabs,
  storage: global.chrome.storage,
  action: global.chrome.action,
  contextMenus: global.chrome.contextMenus,
  scripting: global.chrome.scripting,
}));

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Restore console for test output
afterAll(() => {
  global.console = originalConsole;
});

export {};