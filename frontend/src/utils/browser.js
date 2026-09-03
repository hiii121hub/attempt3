const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8787';
/**
 * Encode a destination URL for use in the proxy gateway
 * Format: /p/<base64url-encoded-url>
 */
export function encodeProxyUrl(destinationUrl) {
    try {
        const encoded = btoa(destinationUrl)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        return `${GATEWAY_URL}/p/${encoded}`;
    }
    catch (e) {
        console.error('Failed to encode proxy URL:', e);
        return `${GATEWAY_URL}/error`;
    }
}
/**
 * Decode a proxy URL back to the destination URL
 */
export function decodeProxyUrl(proxyUrl) {
    try {
        const match = proxyUrl.match(/\/p\/([A-Za-z0-9_-]+)$/);
        if (!match)
            return null;
        let encoded = match[1];
        // Add back padding
        while (encoded.length % 4 !== 0) {
            encoded += '=';
        }
        encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
        return atob(encoded);
    }
    catch (e) {
        console.error('Failed to decode proxy URL:', e);
        return null;
    }
}
/**
 * Extract the gateway base URL
 */
export function getGatewayUrl() {
    return GATEWAY_URL;
}
/**
 * Validate if a URL is valid and safe
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Normalize a user input - could be a URL or search term
 */
export function normalizeUserInput(input) {
    input = input.trim();
    // If it looks like a URL, try to parse it
    if (input.includes('://') || input.startsWith('localhost')) {
        return input;
    }
    // If it looks like a domain (contains . and no spaces), treat as URL
    if (input.includes('.') && !input.includes(' ')) {
        // Add https if no protocol
        if (!input.startsWith('http')) {
            return `https://${input}`;
        }
        return input;
    }
    // Otherwise, treat as search query
    return `https://www.bing.com/search?q=${encodeURIComponent(input)}`;
}
/**
 * Generate a unique tab ID
 */
export function generateTabId() {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
/**
 * Create a new tab
 */
export function createTab(destinationUrl) {
    const id = generateTabId();
    const tab = {
        id,
        title: 'New Tab',
        destinationUrl: destinationUrl || '',
        proxyUrl: null,
        isLoading: false,
        history: [],
        historyIndex: -1,
    };
    return tab;
}
/**
 * Navigate to a URL in a tab
 */
export function navigateTab(tab, destinationUrl) {
    const proxyUrl = encodeProxyUrl(destinationUrl);
    // Remove forward history if we're navigating from a point in history
    const newHistory = tab.history.slice(0, tab.historyIndex + 1);
    newHistory.push({
        url: destinationUrl,
        timestamp: Date.now(),
    });
    return {
        ...tab,
        destinationUrl,
        proxyUrl,
        isLoading: true,
        history: newHistory,
        historyIndex: newHistory.length - 1,
    };
}
/**
 * Go back in history
 */
export function goBack(tab) {
    if (tab.historyIndex <= 0) {
        return null;
    }
    const entry = tab.history[tab.historyIndex - 1];
    return {
        ...tab,
        destinationUrl: entry.url,
        proxyUrl: encodeProxyUrl(entry.url),
        isLoading: true,
        historyIndex: tab.historyIndex - 1,
    };
}
/**
 * Go forward in history
 */
export function goForward(tab) {
    if (tab.historyIndex >= tab.history.length - 1) {
        return null;
    }
    const entry = tab.history[tab.historyIndex + 1];
    return {
        ...tab,
        destinationUrl: entry.url,
        proxyUrl: encodeProxyUrl(entry.url),
        isLoading: true,
        historyIndex: tab.historyIndex + 1,
    };
}
/**
 * Mark a tab as loaded
 */
export function setTabLoaded(tab, title) {
    return {
        ...tab,
        isLoading: false,
        title: title || tab.title,
    };
}
