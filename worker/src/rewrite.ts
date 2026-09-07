/**
 * URL Rewriting for HTML and CSS
 * 
 * Rewrites URLs in HTML and CSS to route through the proxy gateway
 */

import { buildProxyUrl } from './proxy-url'

/**
 * Resolve a URL against a base URL (handles relative, absolute, root-relative, etc.)
 */
export function resolveUrl(url: string, baseUrl: string): string {
  // Skip special URLs
  if (
    url.startsWith('data:') ||
    url.startsWith('javascript:') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:') ||
    url.startsWith('#') ||
    url === '' ||
    url === '/' ||
    url === './'
  ) {
    return url
  }

  // Protocol-relative URLs (e.g., //example.com/path)
  if (url.startsWith('//')) {
    try {
      const baseUrlObj = new URL(baseUrl)
      return `${baseUrlObj.protocol}${url}`
    } catch {
      return url
    }
  }

  // Absolute URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // Relative and root-relative URLs
  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}

/**
 * Rewrite a URL to go through the proxy
 */
export function rewriteUrlToProxy(url: string, destinationUrl: string): string {
  // Don't rewrite special URLs
  if (
    url.startsWith('data:') ||
    url.startsWith('javascript:') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:')
  ) {
    return url
  }

  // First resolve relative URLs
  const resolved = resolveUrl(url, destinationUrl)

  // If it's a special URL after resolution, don't rewrite
  if (
    resolved.startsWith('data:') ||
    resolved.startsWith('javascript:') ||
    resolved.startsWith('mailto:') ||
    resolved.startsWith('tel:')
  ) {
    return resolved
  }

  // If it's not an HTTP URL, don't rewrite
  if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) {
    return resolved
  }

  // Rewrite to proxy
  return buildProxyUrl(resolved)
}

/**
 * Rewrite HTML content
 * Rewrites URLs in href, src, srcset, forms, etc.
 */
export function rewriteHtml(html: string, destinationUrl: string): string {
  // This is a basic string-based rewrite
  // For production, use a proper HTML parser like cheerio

  let result = html

  // Rewrite anchor hrefs
  result = result.replace(
    /href=["']([^"']+)["']/gi,
    (_match, url: string) => {
      const rewritten = rewriteUrlToProxy(url, destinationUrl)
      return `href="${rewritten}"`
    }
  )

  // Rewrite img src
  result = result.replace(
    /src=["']([^"']+)["']/gi,
    (_match, url: string) => {
      const rewritten = rewriteUrlToProxy(url, destinationUrl)
      return `src="${rewritten}"`
    }
  )

  // Rewrite srcset
  result = result.replace(
    /srcset=["']([^"']+)["']/gi,
    (_match, srcset: string) => {
      const rewritten = srcset
        .split(',')
        .map((item: string) => {
          const parts = item.trim().split(/\s+/)
          const url = parts[0]
          const descriptor = parts.slice(1).join(' ')
          const rewrittenUrl = rewriteUrlToProxy(url, destinationUrl)
          return descriptor ? `${rewrittenUrl} ${descriptor}` : rewrittenUrl
        })
        .join(',')
      return `srcset="${rewritten}"`
    }
  )

  // Rewrite form actions
  result = result.replace(
    /action=["']([^"']+)["']/gi,
    (_match, url: string) => {
      const rewritten = rewriteUrlToProxy(url, destinationUrl)
      return `action="${rewritten}"`
    }
  )

  // Rewrite style URLs
  result = result.replace(
    /url\(["']?([^"')]+)["']?\)/gi,
    (_match, url: string) => {
      const cleanUrl = url.replace(/^["']|["']$/g, '')
      const rewritten = rewriteUrlToProxy(cleanUrl, destinationUrl)
      return `url("${rewritten}")`
    }
  )

  // Inject navigation bridge script
  result = injectNavigationBridge(result, destinationUrl)

  return result
}

/**
 * Rewrite CSS content
 */
export function rewriteCss(css: string, destinationUrl: string): string {
  let result = css

  // Rewrite url() in CSS
  result = result.replace(
    /url\(["']?([^"')]+)["']?\)/gi,
    (match, url) => {
      const cleanUrl = url.replace(/^["']|["']$/g, '')
      const rewritten = rewriteUrlToProxy(cleanUrl, destinationUrl)
      return `url("${rewritten}")`
    }
  )

  // Rewrite @import
  result = result.replace(
    /@import\s+["']([^"']+)["']/gi,
    (match, url) => {
      const rewritten = rewriteUrlToProxy(url, destinationUrl)
      return `@import "${rewritten}"`
    }
  )

  return result
}

/**
 * Inject a navigation bridge script into HTML
 * This allows the proxied page to communicate navigation back to the browser UI
 */
function injectNavigationBridge(html: string, destinationUrl: string): string {
  const bridge = `
<script>
  // Navigation bridge for Private Browser
  (function() {
    const originalLocation = window.location;
    const destinationUrl = "${destinationUrl.replace(/"/g, '\\"')}";
    
    const tabId = new URLSearchParams(window.location.search).get('_tb') || 'unknown';
    
    // Intercept navigation
    window.addEventListener('click', function(e) {
      if (e.target.tagName === 'A' && e.target.href) {
        e.preventDefault();
        e.stopPropagation();
        const href = e.target.href;
        if (href && !href.startsWith('javascript:') && !href.startsWith('data:')) {
          window.parent.postMessage({
            type: 'navigate',
            tabId: tabId,
            destination: href,
            timestamp: Date.now()
          }, '*');
        }
      }
    }, true);
    
    // Intercept window.open
    const originalOpen = window.open;
    window.open = function(url, target, features) {
      if (target === '_blank' || !target) {
        window.parent.postMessage({
          type: 'navigate',
          tabId: tabId,
          destination: url,
          timestamp: Date.now()
        }, '*');
        return null;
      }
      return originalOpen.call(this, url, target, features);
    };
  })();
</script>
  `
  
  const bodyMatch = html.match(/<body[^>]*>/i)
  if (bodyMatch) {
    return html.replace(bodyMatch[0], bodyMatch[0] + bridge)
  }
  
  return html + bridge
}
