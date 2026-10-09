/**
 * Private Browser Gateway Worker
 *
 * Main proxy/gateway handler for the Private Browser application
 */
import { validateSSRF, validateRedirectTarget } from './security';
import { encodeProxyPath, parseProxyRequest } from './proxy-url';
import { rewriteHtml, rewriteCss } from './rewrite';
import { storeCookies, getCookies } from './cookies';
/**
 * Check if content type indicates HTML
 */
function isHtmlContent(contentType) {
    if (!contentType)
        return false;
    return contentType.includes('text/html') || contentType.includes('application/xhtml');
}
/**
 * Check if content type indicates CSS
 */
function isCssContent(contentType) {
    if (!contentType)
        return false;
    return contentType.includes('text/css');
}
/**
 * Check if content type indicates JSON or text-like
 */
/**
 * Handle proxy request
 */
export default {
    async fetch(request) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }
        const url = new URL(request.url);
        const path = url.pathname;
        // Parse proxy request
        const parsed = parseProxyRequest(path, url.search);
        if (!parsed) {
            // Not a valid proxy request
            return new Response('Invalid proxy URL', { status: 400 });
        }
        const { destinationUrl } = parsed;
        let { remainingPath } = parsed;
        // Validate SSRF
        try {
            await validateSSRF(destinationUrl);
        }
        catch (e) {
            const error = e;
            console.error('SSRF validation failed:', error.message);
            return new Response(`Access denied: ${error.message}`, { status: 403 });
        }
        // Build the full destination URL
        const destUrl = new URL(destinationUrl);
        destUrl.pathname = remainingPath;
        destUrl.search = url.search;
        const fullDestinationUrl = destUrl.href;
        console.log(`Proxying: ${request.method} ${fullDestinationUrl}`, `Tab: ${url.searchParams.get('_tb') || 'unknown'}`);
        // Add cookies
        const cookies = getCookies(fullDestinationUrl);
        const headers = new Headers(request.headers);
        // Never forward cookies or authentication credentials from the proxy request.
        headers.delete('Cookie');
        headers.delete('Authorization');
        headers.delete('Proxy-Authorization');
        // Add only cookies stored for the destination website.
        if (cookies) {
            headers.set('Cookie', cookies);
        }
        // Remove hop-by-hop headers
        headers.delete('Connection');
        headers.delete('Keep-Alive');
        headers.delete('TE');
        headers.delete('Transfer-Encoding');
        headers.delete('Upgrade');
        headers.delete('Host');
        // Set proper User-Agent if not provided
        if (!headers.has('User-Agent')) {
            headers.set('User-Agent', 'Mozilla/5.0 (Private Browser)');
        }
        // Make the request
        let response;
        try {
            response = await fetch(fullDestinationUrl, {
                method: request.method,
                headers,
                body: request.body,
                redirect: 'manual', // Handle redirects manually for validation
            });
        }
        catch (e) {
            const error = e;
            console.error('Fetch error:', error.message);
            return new Response(`Gateway error: ${error.message}`, { status: 502 });
        }
        // Handle redirects
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('Location');
            if (location) {
                try {
                    // Validate redirect target
                    const redirectDestination = new URL(location, fullDestinationUrl);
                    await validateRedirectTarget(redirectDestination.href, fullDestinationUrl);
                    // Keep navigation inside the proxy so the next request is validated too.
                    const proxyRedirectUrl = new URL(request.url);
                    proxyRedirectUrl.pathname =
                        encodeProxyPath(`${redirectDestination.origin}/`) +
                            redirectDestination.pathname;
                    proxyRedirectUrl.search = redirectDestination.search;
                    proxyRedirectUrl.hash = redirectDestination.hash;
                    const redirectHeaders = new Headers(response.headers);
                    redirectHeaders.set('Location', proxyRedirectUrl.href);
                    response = new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: redirectHeaders,
                    });
                    console.log(`Redirect: ${response.status} through proxy to ${redirectDestination.href}`);
                }
                catch (e) {
                    const error = e;
                    console.error('Invalid redirect:', error.message);
                    return new Response(`Invalid redirect target: ${error.message}`, { status: 403 });
                }
            }
        }
        // Store cookies from response
        const setCookieHeaders = response.headers.getSetCookie?.();
        if (setCookieHeaders && setCookieHeaders.length > 0) {
            storeCookies(fullDestinationUrl, setCookieHeaders);
        }
        // Get content type
        const contentType = response.headers.get('Content-Type');
        // Clone response body for reading
        let responseBody = await response.arrayBuffer();
        // Rewrite HTML content
        if (isHtmlContent(contentType)) {
            try {
                const text = new TextDecoder().decode(responseBody);
                const rewritten = rewriteHtml(text, destinationUrl);
                responseBody = new TextEncoder().encode(rewritten).buffer;
                // Update Content-Length since body changed
                const newHeaders = new Headers(response.headers);
                newHeaders.delete('Content-Length');
                newHeaders.delete('Content-Encoding');
                return new Response(responseBody, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            }
            catch (e) {
                console.error('HTML rewriting error:', e);
                // Fall through to return original response
            }
        }
        // Rewrite CSS content
        if (isCssContent(contentType)) {
            try {
                const text = new TextDecoder().decode(responseBody);
                const rewritten = rewriteCss(text, destinationUrl);
                responseBody = new TextEncoder().encode(rewritten).buffer;
                const newHeaders = new Headers(response.headers);
                newHeaders.delete('Content-Length');
                newHeaders.delete('Content-Encoding');
                return new Response(responseBody, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            }
            catch (e) {
                console.error('CSS rewriting error:', e);
                // Fall through to return original response
            }
        }
        // Return response with modified headers
        const finalHeaders = new Headers(response.headers);
        // Add CORS headers
        finalHeaders.set('Access-Control-Allow-Origin', '*');
        // Remove problematic headers that might break iframe embedding
        finalHeaders.delete('X-Frame-Options');
        finalHeaders.delete('Content-Security-Policy');
        finalHeaders.delete('Content-Security-Policy-Report-Only');
        return new Response(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: finalHeaders,
        });
    },
};
