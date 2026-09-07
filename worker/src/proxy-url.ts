/**
 * Proxy URL encoding/decoding
 * 
 * Format: /p/<base64url-encoded-destination-url>
 */

/**
 * Encode a destination URL for proxy
 */
export function encodeProxyPath(destinationUrl: string): string {
  const encoded = btoa(destinationUrl)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return `/p/${encoded}`
}

/**
 * Decode a proxy path to get destination URL
 */
export function decodeProxyPath(path: string): string | null {
  const match = path.match(/^\/p\/([A-Za-z0-9_-]+)/)
  if (!match) return null

  let encoded = match[1]
  // Add back padding
  while (encoded.length % 4 !== 0) {
    encoded += '='
  }
  encoded = encoded.replace(/-/g, '+').replace(/_/g, '/')

  try {
    return atob(encoded)
  } catch {
    return null
  }
}

/**
 * Parse the full destination URL from a proxied request
 * Returns: { destinationUrl, remainingPath, query }
 */
export function parseProxyRequest(path: string, query: string): {
  destinationUrl: string
  remainingPath: string
  query: string
} | null {
  const destinationUrl = decodeProxyPath(path)
  if (!destinationUrl) return null

  // Extract the remaining path after /p/<encoded-url>
  const match = path.match(/^\/p\/[A-Za-z0-9_-]+(.*)$/)
  const remainingPath = match ? match[1] || '/' : '/'

  return { destinationUrl, remainingPath, query }
}

/**
 * Build a proxy URL for a destination
 */
export function buildProxyUrl(
  destinationUrl: string,
  basePath: string = 'http://localhost:8787'
): string {
  return basePath + encodeProxyPath(destinationUrl)
}
