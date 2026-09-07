/**
 * Proxy URL tests
 */

import { describe, it, expect } from 'vitest'
import { encodeProxyPath, decodeProxyPath, parseProxyRequest } from '../proxy-url'

describe('Proxy URL Encoding', () => {
  it('should encode and decode URLs', () => {
    const url = 'https://example.com/path?query=1'
    const encoded = encodeProxyPath(url)
    const decoded = decodeProxyPath(encoded)
    expect(decoded).toBe(url)
  })

  it('should handle URLs with special characters', () => {
    const url = 'https://example.com/path?q=hello world&x=1&y=2'
    const encoded = encodeProxyPath(url)
    const decoded = decodeProxyPath(encoded)
    expect(decoded).toBe(url)
  })

  it('should handle URLs with fragments', () => {
    const url = 'https://example.com/path#section'
    const encoded = encodeProxyPath(url)
    const decoded = decodeProxyPath(encoded)
    expect(decoded).toBe(url)
  })

  it('should encode to base64url format', () => {
    const encoded = encodeProxyPath('https://example.com')
    expect(encoded).toMatch(/^\/p\/[A-Za-z0-9_-]+$/)
    expect(encoded).not.toMatch(/\+/)
    expect(encoded.slice(3)).not.toMatch(/\//)
    expect(encoded).not.toMatch(/=/)
  })

  it('should return null for invalid proxy paths', () => {
    expect(decodeProxyPath('/invalid/path')).toBeNull()
    expect(decodeProxyPath('/p/invalid!!!')).toBeNull()
  })
})

describe('Parse Proxy Request', () => {
  it('should parse proxy requests', () => {
    const url = 'https://example.com/page?id=1'
    const encoded = encodeProxyPath(url)
    const result = parseProxyRequest(encoded, '')

    expect(result).not.toBeNull()
    expect(result?.destinationUrl).toBe(url)
    expect(result?.remainingPath).toBe('/')
  })

  it('should parse requests with remaining paths', () => {
    const url = 'https://example.com'
    const encoded = encodeProxyPath(url)
    const withPath = encoded + '/about/contact'
    const result = parseProxyRequest(withPath, '')

    expect(result?.destinationUrl).toBe(url)
    expect(result?.remainingPath).toBe('/about/contact')
  })

  it('should preserve query parameters', () => {
    const url = 'https://example.com'
    const encoded = encodeProxyPath(url)
    const result = parseProxyRequest(encoded, '?search=test&page=2')

    expect(result?.query).toBe('?search=test&page=2')
  })
})
