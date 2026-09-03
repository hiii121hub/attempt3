/**
 * Security tests
 */
import { describe, it, expect } from 'vitest';
import { validateSSRF, SSRFError } from '../src/security';
describe('SSRF Protection', () => {
    it('should allow public URLs', async () => {
        await expect(validateSSRF('https://example.com')).resolves.not.toThrow();
        await expect(validateSSRF('https://www.google.com')).resolves.not.toThrow();
        await expect(validateSSRF('https://github.com/user/repo')).resolves.not.toThrow();
    });
    it('should block localhost', async () => {
        await expect(validateSSRF('http://localhost')).rejects.toThrow(SSRFError);
        await expect(validateSSRF('http://localhost:8000')).rejects.toThrow(SSRFError);
        await expect(validateSSRF('http://127.0.0.1')).rejects.toThrow(SSRFError);
    });
    it('should block private IP ranges', async () => {
        await expect(validateSSRF('http://192.168.1.1')).rejects.toThrow(SSRFError);
        await expect(validateSSRF('http://10.0.0.1')).rejects.toThrow(SSRFError);
        await expect(validateSSRF('http://172.16.0.0')).rejects.toThrow(SSRFError);
    });
    it('should block metadata endpoints', async () => {
        await expect(validateSSRF('http://169.254.169.254')).rejects.toThrow(SSRFError);
        await expect(validateSSRF('http://metadata.google.internal')).rejects.toThrow(SSRFError);
    });
    it('should block dangerous protocols', async () => {
        await expect(validateSSRF('javascript:alert(1)')).rejects.toThrow(SSRFError);
        await expect(validateSSRF('file:///etc/passwd')).rejects.toThrow(SSRFError);
    });
    it('should block IPv6 loopback', async () => {
        await expect(validateSSRF('http://[::1]')).rejects.toThrow(SSRFError);
    });
    it('should allow IPv6 public addresses', async () => {
        // Note: This might not work perfectly in test environment
        // but should not throw for valid public IPv6
        await expect(validateSSRF('https://[2001:4860:4860::8888]')).resolves.not.toThrow();
    });
});
