/**
 * Cookie Management
 * 
 * Handles cookie isolation per destination, domain/path matching, and persistence
 */

interface CookieAttributes {
  value: string
  domain?: string
  path?: string
  expires?: Date
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

interface CookieStore {
  [destination: string]: {
    [name: string]: CookieAttributes & { timestamp: number }
  }
}

/**
 * In-memory cookie store
 * Note: This will be cleared when the Worker restarts
 * For persistence, use Cloudflare Durable Objects or Workers KV
 */
let cookieStore: CookieStore = {}

/**
 * Extract domain from destination URL
 */
function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Check if a cookie path matches a request path
 */
function pathMatches(cookiePath: string | undefined, requestPath: string): boolean {
  if (!cookiePath) return true
  cookiePath = cookiePath || '/'
  if (requestPath === cookiePath) return true
  if (requestPath.startsWith(cookiePath) && cookiePath.endsWith('/')) return true
  if (requestPath.startsWith(cookiePath + '/')) return true
  return false
}

/**
 * Check if a cookie domain matches a request domain
 */
function domainMatches(cookieDomain: string | undefined, requestDomain: string): boolean {
  if (!cookieDomain) return true
  cookieDomain = cookieDomain.toLowerCase()
  requestDomain = requestDomain.toLowerCase()

  // Exact match
  if (cookieDomain === requestDomain) return true

  // Domain suffix match (e.g., .example.com matches www.example.com)
  if (cookieDomain.startsWith('.')) {
    return requestDomain.endsWith(cookieDomain) || requestDomain === cookieDomain.slice(1)
  }

  // Subdomain match for implicit dot cookies
  if (requestDomain.endsWith('.' + cookieDomain)) return true

  return false
}

/**
 * Parse Set-Cookie header
 */
function parseSetCookie(setCookieHeader: string): CookieAttributes {
  const parts = setCookieHeader.split(';').map(p => p.trim())
  const [nameValue] = parts
  const [, value] = nameValue.split('=').map(p => p.trim())

  const attributes: CookieAttributes = {
    value: value || '',
  }

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const [attrName, attrValue] = part.split('=').map(p => p.trim())

    switch (attrName.toLowerCase()) {
      case 'domain':
        attributes.domain = attrValue
        break
      case 'path':
        attributes.path = attrValue
        break
      case 'expires':
        attributes.expires = new Date(attrValue)
        break
      case 'max-age':
        const maxAge = parseInt(attrValue, 10)
        if (!isNaN(maxAge)) {
          attributes.expires = new Date(Date.now() + maxAge * 1000)
        }
        break
      case 'secure':
        attributes.secure = true
        break
      case 'httponly':
        attributes.httpOnly = true
        break
      case 'samesite':
        attributes.sameSite = attrValue as 'Strict' | 'Lax' | 'None'
        break
    }
  }

  return attributes
}

/**
 * Format cookies for Cookie header
 */
function formatCookieHeader(cookies: Array<{ name: string; value: string }>): string {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

/**
 * Store cookies from Set-Cookie headers
 */
export function storeCookies(
  destinationUrl: string,
  setCookieHeaders: string[]
): void {
  const originDomain = getDomainFromUrl(destinationUrl)
  if (!originDomain) return

  for (const header of setCookieHeaders) {
    const cookie = parseSetCookie(header)
    const [nameValue] = header.split(';')[0].trim().split('=')
    const cookieName = nameValue.trim()

    // A Domain attribute controls which host/subdomains receive
    // the cookie. Without Domain, the cookie is host-only.
    const storageDomain = cookie.domain
      ? cookie.domain.toLowerCase()
      : originDomain

    if (!cookieStore[storageDomain]) {
      cookieStore[storageDomain] = {}
    }

    // Check expiration
    if (cookie.expires && cookie.expires < new Date()) {
      delete cookieStore[storageDomain][cookieName]
      continue
    }

    // Store cookie
    cookieStore[storageDomain][cookieName] = {
      ...cookie,
      timestamp: Date.now(),
    }
  }
}

/**
 * Retrieve cookies for a destination URL
 */
export function getCookies(destinationUrl: string): string {
  const url = new URL(destinationUrl)
  const domain = url.hostname.toLowerCase()
  const path = url.pathname

  const cookies: Array<{ name: string; value: string }> = []

  // Check all stored domains that match
  for (const storedDomain in cookieStore) {
    if (!domainMatches(storedDomain, domain)) continue

    for (const cookieName in cookieStore[storedDomain]) {
      const cookie = cookieStore[storedDomain][cookieName]

      // Check expiration
      if (cookie.expires && cookie.expires < new Date()) {
        delete cookieStore[storedDomain][cookieName]
        continue
      }

      // Check path
      if (!pathMatches(cookie.path, path)) continue

      // Check secure flag
      if (cookie.secure && url.protocol !== 'https:') continue

      cookies.push({
        name: cookieName,
        value: cookie.value,
      })
    }
  }

  return formatCookieHeader(cookies)
}

/**
 * Clear all cookies for a destination
 */
export function clearCookies(destinationUrl: string): void {
  const domain = getDomainFromUrl(destinationUrl)
  if (domain && cookieStore[domain]) {
    delete cookieStore[domain]
  }
}

/**
 * Get cookie store statistics (for debugging)
 */
export function getCookieStats(): { domain: string; count: number }[] {
  return Object.entries(cookieStore)
    .filter(([_, cookies]) => Object.keys(cookies).length > 0)
    .map(([domain, cookies]) => ({
      domain,
      count: Object.keys(cookies).length,
    }))
}
