/**
 * URL Rewriting tests
 */
import { describe, it, expect } from 'vitest';
import { resolveUrl, rewriteUrlToProxy } from '../rewrite';
import { decodeProxyPath } from '../proxy-url';
describe('URL Resolution', () => {
    it('should resolve relative URLs', () => {
        const base = 'https://example.com/blog/post';
        expect(resolveUrl('../about', base)).toBe('https://example.com/about');
        expect(resolveUrl('./related', base)).toBe('https://example.com/blog/related');
        expect(resolveUrl('images/pic.jpg', base)).toBe('https://example.com/blog/images/pic.jpg');
    });
    it('should resolve root-relative URLs', () => {
        const base = 'https://example.com/blog/post';
        expect(resolveUrl('/css/style.css', base)).toBe('https://example.com/css/style.css');
        expect(resolveUrl('/images/logo.png', base)).toBe('https://example.com/images/logo.png');
    });
    it('should resolve protocol-relative URLs', () => {
        const base = 'https://example.com/page';
        expect(resolveUrl('//cdn.example.com/script.js', base)).toBe('https://cdn.example.com/script.js');
    });
    it('should preserve absolute URLs', () => {
        const base = 'https://example.com/page';
        expect(resolveUrl('https://other.com/path', base)).toBe('https://other.com/path');
    });
    it('should skip special URLs', () => {
        const base = 'https://example.com';
        expect(resolveUrl('mailto:test@example.com', base)).toBe('mailto:test@example.com');
        expect(resolveUrl('tel:+1234567890', base)).toBe('tel:+1234567890');
        expect(resolveUrl('data:text/html,<h1>Test</h1>', base)).toBe('data:text/html,<h1>Test</h1>');
        expect(resolveUrl('#section', base)).toBe('#section');
    });
});
describe('URL Rewriting to Proxy', () => {
    it('should rewrite absolute URLs', () => {
        const url = 'https://cdn.example.com/image.png';
        const base = 'https://example.com/';
        const rewritten = rewriteUrlToProxy(url, base);
        expect(rewritten).toContain('/p/');
        expect(decodeProxyPath(new URL(rewritten).pathname)).toBe(url);
    });
    it('should rewrite relative URLs', () => {
        const url = 'css/style.css';
        const base = 'https://example.com/blog/post';
        const rewritten = rewriteUrlToProxy(url, base);
        expect(rewritten).toContain('/p/');
        expect(decodeProxyPath(new URL(rewritten).pathname)).toBe(new URL(url, base).href);
    });
    it('should preserve special URLs', () => {
        const base = 'https://example.com';
        expect(rewriteUrlToProxy('mailto:test@example.com', base)).toBe('mailto:test@example.com');
        expect(rewriteUrlToProxy('javascript:void(0)', base)).toBe('javascript:void(0)');
        expect(rewriteUrlToProxy('data:image/png;base64,xxx', base)).toBe('data:image/png;base64,xxx');
    });
    it('should handle empty and root paths', () => {
        const base = 'https://example.com';
        expect(rewriteUrlToProxy('', base)).toBe('');
        expect(rewriteUrlToProxy('/', base)).toBe('/');
    });
});
