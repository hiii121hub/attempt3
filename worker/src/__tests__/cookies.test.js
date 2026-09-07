/**
 * Cookie handling tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { storeCookies, getCookies, clearCookies } from '../cookies';
describe('Cookie Management', () => {
    beforeEach(() => {
        clearCookies('https://example.com');
        clearCookies('https://www.example.com');
        clearCookies('https://other.com');
    });
    it('should store and retrieve cookies', () => {
        const url = 'https://example.com';
        storeCookies(url, ['sessionid=abc123; Path=/']);
        const cookies = getCookies(url + '/');
        expect(cookies).toContain('sessionid=abc123');
    });
    it('should respect cookie paths', () => {
        const url = 'https://example.com';
        storeCookies(url, ['path-cookie=value; Path=/blog']);
        // Should match /blog paths
        expect(getCookies(url + '/blog')).toContain('path-cookie');
        expect(getCookies(url + '/blog/post')).toContain('path-cookie');
        // Should not match other paths
        expect(getCookies(url + '/other')).not.toContain('path-cookie');
    });
    it('should handle domain matching', () => {
        const url = 'https://www.example.com';
        storeCookies(url, ['id=123; Domain=.example.com']);
        // Should match subdomains
        expect(getCookies('https://www.example.com/')).toContain('id');
        expect(getCookies('https://api.example.com/')).toContain('id');
        expect(getCookies('https://example.com/')).toContain('id');
    });
    it('should not leak cookies between different domains', () => {
        storeCookies('https://example.com', ['secret=value123']);
        const cookies = getCookies('https://evil.com');
        expect(cookies).not.toContain('secret');
    });
    it('should handle secure flag', () => {
        const url = 'https://example.com';
        storeCookies(url, ['secure-cookie=value; Secure']);
        // Should work with https
        expect(getCookies(url + '/')).toContain('secure-cookie');
        // Note: Would not work with http in real browser
        // but we test URL parsing here
    });
    it('should handle multiple cookies', () => {
        const url = 'https://example.com';
        storeCookies(url, [
            'session=abc123',
            'theme=dark; Path=/',
            'lang=en; Domain=example.com',
        ]);
        const cookies = getCookies(url + '/');
        expect(cookies).toContain('session');
        expect(cookies).toContain('theme');
        expect(cookies).toContain('lang');
    });
    it('should format cookies correctly', () => {
        const url = 'https://example.com';
        storeCookies(url, ['first=1', 'second=2', 'third=3']);
        const cookies = getCookies(url + '/');
        expect(cookies).toMatch(/; /);
    });
});
