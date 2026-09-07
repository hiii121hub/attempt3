/**
 * Private Browser Gateway Worker
 *
 * Main proxy/gateway handler for the Private Browser application
 */
import { validateSSRF, validateRedirectTarget } from './security';
import { parseProxyRequest } from './proxy-url';
import { rewriteHtml, rewriteCss } from './rewrite';
import { storeCookies, getCookies } from './cookies';
const DEFAULT_BRANDING = {
    title: 'Poxey',
    subtitle: 'Your private browser, anywhere.',
};
const SESSION_COOKIE = 'poxey_admin';
const BRANDING_KEY = 'branding';
function base64Url(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
async function sign(value, secret) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return base64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}
async function isAdmin(request, env) {
    const cookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)poxey_admin=([^;]+)/)?.[1];
    if (!cookie)
        return false;
    const [expiry, signature] = atob(cookie.replace(/-/g, '+').replace(/_/g, '/')).split('.');
    if (!expiry || Number(expiry) < Date.now())
        return false;
    return signature === await sign(expiry, env.ADMIN_SESSION_SECRET);
}
function adminHeaders(env) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (env.ADMIN_ORIGIN)
        headers.set('Access-Control-Allow-Origin', env.ADMIN_ORIGIN);
    headers.set('Access-Control-Allow-Credentials', 'true');
    return headers;
}
async function adminResponse(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/admin/'))
        return null;
    if (request.method === 'OPTIONS') {
        const headers = adminHeaders(env);
        headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
        return new Response(null, { status: 204, headers });
    }
    if (path === '/admin/branding' && request.method === 'GET') {
        const branding = await env.BRANDING.get(BRANDING_KEY, 'json') || DEFAULT_BRANDING;
        return new Response(JSON.stringify(branding), { headers: adminHeaders(env) });
    }
    if (path === '/admin/login' && request.method === 'POST') {
        const body = await request.json();
        if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: adminHeaders(env) });
        }
        const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
        const token = btoa(`${expiry}.${await sign(expiry, env.ADMIN_SESSION_SECRET)}`);
        const headers = adminHeaders(env);
        headers.set('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
        return new Response('{}', { headers });
    }
    if (path === '/admin/branding' && request.method === 'PUT') {
        if (!await isAdmin(request, env))
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: adminHeaders(env) });
        const body = await request.json();
        const branding = {
            title: String(body.title || '').trim().slice(0, 80),
            subtitle: String(body.subtitle || '').trim().slice(0, 160),
        };
        if (!branding.title || !branding.subtitle)
            return new Response(JSON.stringify({ error: 'Invalid branding' }), { status: 400, headers: adminHeaders(env) });
        await env.BRANDING.put(BRANDING_KEY, JSON.stringify(branding));
        return new Response(JSON.stringify(branding), { headers: adminHeaders(env) });
    }
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: adminHeaders(env) });
}
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
    async fetch(request, env) {
        const admin = await adminResponse(request, env);
        if (admin)
            return admin;
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
                    const redirectUrl = new URL(location, fullDestinationUrl).href;
                    await validateRedirectTarget(redirectUrl, fullDestinationUrl);
                    // Redirect will be handled client-side through navigation bridge
                    console.log(`Redirect: ${response.status} to ${redirectUrl}`);
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
                responseBody = new TextEncoder().encode(rewritten);
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
                responseBody = new TextEncoder().encode(rewritten);
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
