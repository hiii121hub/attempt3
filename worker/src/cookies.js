/**
 * Cookie Management
 *
 * Handles cookie isolation per destination, domain/path matching, and persistence
 */
/**
 * In-memory cookie store
 * Note: This will be cleared when the Worker restarts
 * For persistence, use Cloudflare Durable Objects or Workers KV
 */
let cookieStore = {};
/**
 * Extract domain from destination URL
 */
function getDomainFromUrl(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    }
    catch {
        return '';
    }
}
/**
 * Check if a cookie path matches a request path
 */
function pathMatches(cookiePath, requestPath) {
    if (!cookiePath)
        return true;
    cookiePath = cookiePath || '/';
    if (requestPath === cookiePath)
        return true;
    if (requestPath.startsWith(cookiePath) && cookiePath.endsWith('/'))
        return true;
    if (requestPath.startsWith(cookiePath + '/'))
        return true;
    return false;
}
/**
 * Check if a cookie domain matches a request domain
 */
function domainMatches(cookieDomain, requestDomain) {
    if (!cookieDomain || !requestDomain)
        return false;
    cookieDomain = cookieDomain.toLowerCase().replace(/^\./, '');
    requestDomain = requestDomain.toLowerCase();
    return requestDomain === cookieDomain || requestDomain.endsWith('.' + cookieDomain);
}
/**
 * Parse Set-Cookie header
 */
function parseSetCookie(setCookieHeader) {
    const parts = setCookieHeader.split(';').map(p => p.trim());
    const [nameValue] = parts;
    const [, value] = nameValue.split('=').map(p => p.trim());
    const attributes = {
        value: value || '',
    };
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const [attrName, attrValue] = part.split('=').map(p => p.trim());
        switch (attrName.toLowerCase()) {
            case 'domain':
                attributes.domain = attrValue;
                break;
            case 'path':
                attributes.path = attrValue;
                break;
            case 'expires':
                attributes.expires = new Date(attrValue);
                break;
            case 'max-age':
                const maxAge = parseInt(attrValue, 10);
                if (!isNaN(maxAge)) {
                    attributes.expires = new Date(Date.now() + maxAge * 1000);
                }
                break;
            case 'secure':
                attributes.secure = true;
                break;
            case 'httponly':
                attributes.httpOnly = true;
                break;
            case 'samesite':
                attributes.sameSite = attrValue;
                break;
        }
    }
    return attributes;
}
/**
 * Format cookies for Cookie header
 */
function formatCookieHeader(cookies) {
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}
/**
 * Store cookies from Set-Cookie headers
 */
export function storeCookies(destinationUrl, setCookieHeaders) {
    const domain = getDomainFromUrl(destinationUrl);
    if (!domain)
        return;
    if (!cookieStore[domain]) {
        cookieStore[domain] = {};
    }
    for (const header of setCookieHeaders) {
        const cookie = parseSetCookie(header);
        const [nameValue] = header.split(';')[0].trim().split('=');
        const cookieName = nameValue.trim();
        if (cookie.domain) {
            cookie.domain = cookie.domain.toLowerCase().replace(/^\./, '');
            if (!domainMatches(cookie.domain, domain))
                continue;
        }
        // Check expiration
        if (cookie.expires && cookie.expires < new Date()) {
            delete cookieStore[domain][cookieName];
            continue;
        }
        // Store cookie
        cookieStore[domain][cookieName] = {
            ...cookie,
            timestamp: Date.now(),
        };
    }
}
/**
 * Retrieve cookies for a destination URL
 */
export function getCookies(destinationUrl) {
    const url = new URL(destinationUrl);
    const domain = url.hostname.toLowerCase();
    const path = url.pathname;
    const cookies = [];
    // Check all stored domains that match
    for (const storedDomain in cookieStore) {
        for (const cookieName in cookieStore[storedDomain]) {
            const cookie = cookieStore[storedDomain][cookieName];
            // Domain cookies may be shared with matching subdomains.
            // Host-only cookies must stay on the exact host that set them.
            if (cookie.domain ? !domainMatches(cookie.domain, domain) : storedDomain !== domain)
                continue;
            // Check expiration
            if (cookie.expires && cookie.expires < new Date()) {
                delete cookieStore[storedDomain][cookieName];
                continue;
            }
            // Check path
            if (!pathMatches(cookie.path, path))
                continue;
            // Check secure flag
            if (cookie.secure && url.protocol !== 'https:')
                continue;
            cookies.push({
                name: cookieName,
                value: cookie.value,
            });
        }
    }
    return formatCookieHeader(cookies);
}
/**
 * Clear all cookies for a destination
 */
export function clearCookies(destinationUrl) {
    const domain = getDomainFromUrl(destinationUrl);
    if (!domain)
        return;
    for (const storedDomain of Object.keys(cookieStore)) {
        const bucket = cookieStore[storedDomain];
        for (const [cookieName, cookie] of Object.entries(bucket)) {
            const appliesToDestination = cookie.domain
                ? domainMatches(cookie.domain, domain)
                : storedDomain === domain;
            if (appliesToDestination) {
                delete bucket[cookieName];
            }
        }
        if (Object.keys(bucket).length === 0) {
            delete cookieStore[storedDomain];
        }
    }
}
/**
 * Get cookie store statistics (for debugging)
 */
export function getCookieStats() {
    return Object.entries(cookieStore)
        .filter(([_, cookies]) => Object.keys(cookies).length > 0)
        .map(([domain, cookies]) => ({
        domain,
        count: Object.keys(cookies).length,
    }));
}
