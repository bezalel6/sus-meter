import browser from 'webextension-polyfill';
import type { ExtensionMessage, TabInfo } from '../types';

/**
 * Send a message to the background script
 */
export async function sendToBackground<T = any>(message: ExtensionMessage): Promise<T | null> {
  try {
    const response = await browser.runtime.sendMessage(message);
    return response as T;
  } catch (error) {
    console.error('Error sending message to background:', error);
    return null;
  }
}

/**
 * Send a message to a specific tab
 */
export async function sendToTab<T = any>(
  tabId: number,
  message: ExtensionMessage,
): Promise<T | null> {
  try {
    const response = await browser.tabs.sendMessage(tabId, message);
    return response as T;
  } catch (error) {
    console.error('Error sending message to tab:', error);
    return null;
  }
}

/**
 * Send a message to the active tab
 */
export async function sendToActiveTab<T = any>(message: ExtensionMessage): Promise<T | null> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      return sendToTab<T>(tab.id, message);
    }
    return null;
  } catch (error) {
    console.error('Error sending message to active tab:', error);
    return null;
  }
}

/**
 * Broadcast a message to all tabs
 */
export async function broadcastToAllTabs(message: ExtensionMessage): Promise<void> {
  try {
    const tabs = await browser.tabs.query({});
    const promises = tabs
      .filter((tab): tab is browser.Tabs.Tab & { id: number } => tab.id !== undefined)
      .map((tab) => sendToTab(tab.id, message));
    await Promise.all(promises);
  } catch (error) {
    console.error('Error broadcasting message:', error);
  }
}

/**
 * Get information about the current tab
 */
export async function getCurrentTab(): Promise<TabInfo | null> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      return {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        active: tab.active || false,
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting current tab:', error);
    return null;
  }
}

/**
 * Create a message listener with typed handlers
 */
export function createMessageListener(
  handlers: Map<string, (message: ExtensionMessage, sender: browser.Runtime.MessageSender) => any>,
): void {
  browser.runtime.onMessage.addListener(
    (
      request: any,
      sender: browser.Runtime.MessageSender,
      sendResponse: (response?: any) => void,
    ) => {
      const handler = handlers.get(request.type);
      if (handler) {
        const result = handler(request, sender);
        if (result instanceof Promise) {
          result.then(sendResponse).catch(console.error);
        } else {
          sendResponse(result);
        }
        return true; // Always return true for async compatibility
      }
      return true;
    },
  );
}

/**
 * Execute a script in the active tab
 */
export async function executeScriptInActiveTab<T = any>(func: () => T): Promise<T | null> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: func,
      });
      return results[0]?.result as T;
    }
    return null;
  } catch (error) {
    console.error('Error executing script:', error);
    return null;
  }
}

/**
 * Update the extension badge
 */
export async function updateBadge(
  text: string,
  color: string = '#4688F1',
  tabId?: number,
): Promise<void> {
  try {
    const options: any = { text };
    if (tabId) {
      options.tabId = tabId;
    }
    await browser.action.setBadgeText(options);
    await browser.action.setBadgeBackgroundColor({ color });
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}
