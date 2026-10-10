/**
 * SSRF Protection Utilities
 *
 * Validates URLs to prevent Server-Side Request Forgery attacks.
 * Blocks private IP ranges, metadata endpoints, and internal services.
 */
export class SSRFError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SSRFError';
    }
}
/**
 * Private IPv4 ranges (RFC 1918 + other reserved ranges)
 */
const PRIVATE_IPV4_RANGES = [
    { start: '0.0.0.0', end: '0.255.255.255' }, // This network
    { start: '10.0.0.0', end: '10.255.255.255' }, // Private
    { start: '127.0.0.0', end: '127.255.255.255' }, // Loopback
    { start: '169.254.0.0', end: '169.254.255.255' }, // Link-local
    { start: '172.16.0.0', end: '172.31.255.255' }, // Private
    { start: '192.0.0.0', end: '192.0.0.255' }, // IETF protocol assignments
    { start: '192.0.2.0', end: '192.0.2.255' }, // TEST-NET-1 documentation
    { start: '192.168.0.0', end: '192.168.255.255' }, // Private
    { start: '198.18.0.0', end: '198.19.255.255' }, // Network testing
    { start: '198.51.100.0', end: '198.51.100.255' }, // TEST-NET-2
    { start: '203.0.113.0', end: '203.0.113.255' }, // TEST-NET-3
    { start: '224.0.0.0', end: '255.255.255.255' }, // Multicast/Reserved
];
/**
 * Blocked hostnames that are known to be internal or dangerous
 */
const BLOCKED_HOSTNAMES = [
    'localhost',
    '::1',
    '::',
    'metadata.google.internal',
    '169.254.169.254', // AWS, GCP metadata
    '169.254.169.255',
    '169.254.170.2', // Azure metadata
    'lxd-nameserver',
    'lxd-gateway',
    '.local',
    '.localhost',
    'docker',
    '.docker.internal',
];
/**
 * Convert IPv4 string to number for range comparison
 */
function ipv4ToNumber(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4)
        return -1;
    const nums = parts.map(p => parseInt(p, 10));
    if (nums.some(n => isNaN(n) || n < 0 || n > 255))
        return -1;
    return (nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3];
}
/**
 * Check if IPv4 is in private range
 */
function isPrivateIPv4(ip) {
    const num = ipv4ToNumber(ip);
    if (num === -1)
        return false;
    for (const range of PRIVATE_IPV4_RANGES) {
        const start = ipv4ToNumber(range.start);
        const end = ipv4ToNumber(range.end);
        if (num >= start && num <= end) {
            return true;
        }
    }
    return false;
}
/**
 * Check if IPv6 is private/local
 */
function isPrivateIPv6(ip) {
    const address = ip.toLowerCase();
    // Block loopback, unspecified, link-local, unique-local and multicast.
    if (address === '::1' || address === '::')
        return true;
    if (/^fe[89ab][0-9a-f]:/i.test(address))
        return true;
    if (/^f[cd][0-9a-f]{2}:/i.test(address))
        return true;
    if (/^ff[0-9a-f]{2}:/i.test(address))
        return true;
    // Reject IPv4-mapped IPv6 addresses rather than risk bypassing IPv4 checks.
    if (address.startsWith('::ffff:') || address.startsWith('0:0:0:0:0:ffff:'))
        return true;
    return false;
}
/**
 * Validate a destination URL is safe to fetch
 */
export async function validateSSRF(urlString) {
    try {
        const url = new URL(urlString);
        // Block dangerous protocols
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new SSRFError(`Blocked protocol: ${url.protocol}`);
        }
        // Normalize DNS hostnames so a trailing root dot cannot bypass
        // exact-name or suffix-based blocked-hostname checks.
        const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
        const normalizedIp = hostname.startsWith('[') && hostname.endsWith(']')
            ? hostname.slice(1, -1)
            : hostname;
        // Check blocked hostnames
        for (const blocked of BLOCKED_HOSTNAMES) {
            if (blocked.startsWith('.')) {
                // Domain suffix match
                if (hostname.endsWith(blocked) || hostname === blocked.slice(1)) {
                    throw new SSRFError(`Blocked hostname: ${hostname}`);
                }
            }
            else {
                // Exact match
                if (hostname === blocked) {
                    throw new SSRFError(`Blocked hostname: ${hostname}`);
                }
            }
        }
        // Resolve hostname to IP and check
        try {
            // Note: In Cloudflare Workers, we use fetch to attempt to validate.
            // A true DNS resolution isn't available, but we can check common patterns.
            // IPv4 checks
            if (/^\d+\.\d+\.\d+\.\d+$/.test(normalizedIp)) {
                if (isPrivateIPv4(normalizedIp)) {
                    throw new SSRFError(`Blocked private IPv4: ${normalizedIp}`);
                }
            }
            // IPv6 checks
            if (normalizedIp.includes(':')) {
                const mappedIpv4 = normalizedIp.match(/^(?:::ffff:|0:0:0:0:0:ffff:)(\d+\.\d+\.\d+\.\d+)$/i);
                if (isPrivateIPv6(normalizedIp) ||
                    (mappedIpv4 && isPrivateIPv4(mappedIpv4[1]))) {
                    throw new SSRFError(`Blocked private IPv6: ${normalizedIp}`);
                }
            }
        }
        catch (e) {
            if (e instanceof SSRFError)
                throw e;
            // Other errors don't block, just log
            console.log('Could not validate IP:', e);
        }
    }
    catch (e) {
        if (e instanceof SSRFError)
            throw e;
        throw new SSRFError(`Invalid URL: ${String(e)}`);
    }
}
/**
 * Validate a redirect target is safe
 */
export async function validateRedirectTarget(targetUrl, sourceUrl) {
    let resolved;
    try {
        resolved = new URL(targetUrl, sourceUrl);
    }
    catch {
        throw new SSRFError('Invalid redirect URL');
    }
    await validateSSRF(resolved.href);
}
