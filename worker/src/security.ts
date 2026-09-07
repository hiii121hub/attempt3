/**
 * SSRF Protection Utilities
 *
 * Validates URLs to prevent Server-Side Request Forgery attacks.
 * Blocks private IP ranges, metadata endpoints, and internal services.
 */

export class SSRFError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SSRFError'
  }
}

/**
 * Private IPv4 ranges (RFC 1918 + other reserved ranges)
 */
const PRIVATE_IPV4_RANGES = [
  { start: '0.0.0.0', end: '0.255.255.255' },
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '127.0.0.0', end: '127.255.255.255' },
  { start: '169.254.0.0', end: '169.254.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.0.0.0', end: '192.0.2.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  { start: '198.18.0.0', end: '198.19.255.255' },
  { start: '198.51.100.0', end: '198.51.100.255' },
  { start: '203.0.113.0', end: '203.0.113.255' },
  { start: '224.0.0.0', end: '255.255.255.255' },
]

const BLOCKED_HOSTNAMES = [
  'localhost',
  '::1',
  '::',
  'metadata.google.internal',
  '169.254.169.254',
  '169.254.169.255',
  '169.254.170.2',
  'lxd-nameserver',
  'lxd-gateway',
  '.local',
  '.localhost',
  'docker',
  '.docker.internal',
]

function ipv4ToNumber(ip: string): number {
  const parts = ip.split('.')
  if (parts.length !== 4) return -1

  const nums = parts.map(p => Number(p))
  if (nums.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    return -1
  }

  return (
    nums[0] * 2 ** 24 +
    nums[1] * 2 ** 16 +
    nums[2] * 2 ** 8 +
    nums[3]
  )
}

function isPrivateIPv4(ip: string): boolean {
  const num = ipv4ToNumber(ip)
  if (num === -1) return false

  for (const range of PRIVATE_IPV4_RANGES) {
    const start = ipv4ToNumber(range.start)
    const end = ipv4ToNumber(range.end)

    if (num >= start && num <= end) {
      return true
    }
  }

  return false
}

/**
 * Check if IPv6 is private/local.
 *
 * Covers:
 * - loopback ::1
 * - unspecified ::
 * - link-local fe80::/10
 * - unique-local fc00::/7
 * - multicast ff00::/8
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase()

  if (normalized === '::1' || normalized === '::') return true

  const first = normalized.split(':')[0]

  if (first.startsWith('fc') || first.startsWith('fd')) return true
  if (first.startsWith('fe8') || first.startsWith('fe9')) return true
  if (first.startsWith('fea') || first.startsWith('feb')) return true
  if (first.startsWith('ff')) return true

  return false
}

interface DNSAnswer {
  type?: number
  data?: string
}

interface DNSResponse {
  Status?: number
  Answer?: DNSAnswer[]
}

/**
 * Resolve a hostname using Cloudflare DNS-over-HTTPS and reject
 * any A or AAAA result that points at a private/reserved address.
 *
 * Cloudflare Workers do not expose raw DNS resolution APIs, so
 * DNS-over-HTTPS is used here.
 */
async function validateResolvedAddresses(hostname: string): Promise<void> {
  const dnsUrl = new URL('https://cloudflare-dns.com/dns-query')
  dnsUrl.searchParams.set('name', hostname)
  dnsUrl.searchParams.set('type', 'A')

  const ipv4Response = await fetch(dnsUrl.toString(), {
    headers: {
      Accept: 'application/dns-json',
    },
  })

  if (!ipv4Response.ok) {
    throw new SSRFError(
      `DNS resolution failed for ${hostname}: HTTP ${ipv4Response.status}`
    )
  }

  const ipv4Data = (await ipv4Response.json()) as DNSResponse

  if (typeof ipv4Data.Status === 'number' && ipv4Data.Status !== 0) {
    throw new SSRFError(`DNS resolution failed for ${hostname}`)
  }

  const answers = ipv4Data.Answer ?? []
  let foundAddress = false

  for (const answer of answers) {
    if (answer.type !== 1 || !answer.data) continue

    foundAddress = true

    if (isPrivateIPv4(answer.data)) {
      throw new SSRFError(
        `Blocked private IPv4 resolved from ${hostname}: ${answer.data}`
      )
    }
  }

  // Also check AAAA records for private IPv6 addresses.
  const dnsIpv6Url = new URL('https://cloudflare-dns.com/dns-query')
  dnsIpv6Url.searchParams.set('name', hostname)
  dnsIpv6Url.searchParams.set('type', 'AAAA')

  const ipv6Response = await fetch(dnsIpv6Url.toString(), {
    headers: {
      Accept: 'application/dns-json',
    },
  })

  if (!ipv6Response.ok) {
    throw new SSRFError(
      `DNS resolution failed for ${hostname}: HTTP ${ipv6Response.status}`
    )
  }

  const ipv6Data = (await ipv6Response.json()) as DNSResponse

  if (typeof ipv6Data.Status === 'number' && ipv6Data.Status !== 0) {
    throw new SSRFError(`DNS resolution failed for ${hostname}`)
  }

  for (const answer of ipv6Data.Answer ?? []) {
    if (answer.type !== 28 || !answer.data) continue

    foundAddress = true

    if (isPrivateIPv6(answer.data)) {
      throw new SSRFError(
        `Blocked private IPv6 resolved from ${hostname}: ${answer.data}`
      )
    }
  }

  if (!foundAddress) {
    throw new SSRFError(`DNS hostname has no usable address: ${hostname}`)
  }
}

/**
 * Validate a destination URL is safe to fetch.
 */
export async function validateSSRF(urlString: string): Promise<void> {
  try {
    const url = new URL(urlString)

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new SSRFError(`Blocked protocol: ${url.protocol}`)
    }

    const hostname = url.hostname.toLowerCase()
    const normalizedHostname = hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname

    for (const blocked of BLOCKED_HOSTNAMES) {
      if (blocked.startsWith('.')) {
        if (
          hostname.endsWith(blocked) ||
          hostname === blocked.slice(1)
        ) {
          throw new SSRFError(`Blocked hostname: ${hostname}`)
        }
      } else if (normalizedHostname === blocked) {
        throw new SSRFError(`Blocked hostname: ${hostname}`)
      }
    }

    // Direct IPv4 input must be checked before any DNS lookup.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      if (isPrivateIPv4(hostname)) {
        throw new SSRFError(`Blocked private IPv4: ${hostname}`)
      }

      return
    }

    // Direct IPv6 input must be checked before any DNS lookup.
    if (normalizedHostname.includes(':')) {
      if (isPrivateIPv6(normalizedHostname)) {
        throw new SSRFError(`Blocked private IPv6: ${hostname}`)
      }

      return
    }

    // Hostnames must be resolved before they are accepted.
    // Fail closed if DNS resolution cannot be verified.
    await validateResolvedAddresses(hostname)
  } catch (e) {
    if (e instanceof SSRFError) {
      throw e
    }

    throw new SSRFError(`Invalid URL: ${String(e)}`)
  }
}

/**
 * Validate a redirect target is safe.
 */
export async function validateRedirectTarget(
  targetUrl: string
): Promise<void> {
  if (
    targetUrl.startsWith('http://') ||
    targetUrl.startsWith('https://')
  ) {
    await validateSSRF(targetUrl)
  }
}
