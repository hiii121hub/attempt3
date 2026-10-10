import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import { encodeProxyPath } from '../proxy-url';
import { clearCookies, storeCookies } from '../cookies';

describe('Proxy destination header security', () => {
  beforeEach(() => {
    clearCookies('https://example.com/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCookies('https://example.com/');
  });

  it('does not forward incoming cookies or authentication credentials', async () => {
    const outgoingFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('ok', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
      );

    const destination = 'https://example.com/';
    const proxyPath = encodeProxyPath(destination);

    const request = new Request(`https://proxy.test${proxyPath}`, {
      headers: {
        Cookie: 'private-session=secret',
        Authorization: 'Bearer private-token',
        'Proxy-Authorization': 'Basic c2VjcmV0',
      },
    });

    const response = await worker.fetch(request);

    expect(response.status).toBe(200);
    expect(outgoingFetch).toHaveBeenCalledOnce();

    const outgoingHeaders = new Headers(
      outgoingFetch.mock.calls[0][1].headers,
    );

    expect(outgoingHeaders.has('Cookie')).toBe(false);
    expect(outgoingHeaders.has('Authorization')).toBe(false);
    expect(outgoingHeaders.has('Proxy-Authorization')).toBe(false);
  });
  it('rewrites valid redirects to stay inside the proxy', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          Location: 'https://example.org/account?next=home',
        },
      }),
    );

    const destination = 'https://example.com/';
    const request = new Request(
      `https://proxy.test${encodeProxyPath(destination)}`,
    );

    const response = await worker.fetch(request);
    const location = response.headers.get('Location');

    expect(response.status).toBe(302);
    expect(location).toBeTruthy();

    const redirectedUrl = new URL(location);
    expect(redirectedUrl.origin).toBe('https://proxy.test');
    expect(redirectedUrl.pathname).toContain('/p/');
    expect(redirectedUrl.pathname).toContain('/account');
    expect(redirectedUrl.search).toBe('?next=home');
  });

  it('forwards only cookies stored for the destination website', async () => {
    storeCookies('https://example.com/', [
      'destination-session=valid-session; Path=/',
    ]);

    const outgoingFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('ok', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
      );

    const destination = 'https://example.com/';
    const proxyPath = encodeProxyPath(destination);

    const request = new Request(`https://proxy.test${proxyPath}`, {
      headers: {
        Cookie: 'attacker-cookie=must-not-leak',
      },
    });

    const response = await worker.fetch(request);

    expect(response.status).toBe(200);
    const outgoingHeaders = new Headers(
      outgoingFetch.mock.calls[0][1].headers,
    );

    expect(outgoingHeaders.get('Cookie')).toBe(
      'destination-session=valid-session',
    );
    expect(outgoingHeaders.get('Cookie')).not.toContain('attacker-cookie');
  });

});

describe('Proxy redirect security', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks redirects to localhost', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: 'http://127.0.0.1/admin' },
      }),
    );

    const request = new Request(
      `https://proxy.test${encodeProxyPath('https://example.com/')}`,
    );

    const response = await worker.fetch(request);

    expect(response.status).toBe(403);
    expect(await response.text()).toContain('Invalid redirect target');
  });

  it('blocks redirects using unsafe protocols', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: 'javascript:alert(1)' },
      }),
    );

    const request = new Request(
      `https://proxy.test${encodeProxyPath('https://example.com/')}`,
    );

    const response = await worker.fetch(request);

    expect(response.status).toBe(403);
    expect(await response.text()).toContain('Invalid redirect target');
  });
});
