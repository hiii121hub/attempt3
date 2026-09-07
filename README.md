# Private Browser

A modern web browser application built with React and Cloudflare Workers, designed to browse websites through a secure proxy/gateway layer.

## Architecture

- **Frontend**: React + TypeScript + Vite (Cloudflare Pages)
- **Backend**: Cloudflare Workers (Gateway/Proxy)
- **Deployment**: Cloudflare (Pages + Workers)

## Features

- ✅ Multi-tab browsing
- ✅ Back/Forward navigation
- ✅ Address bar with URL and search support
- ✅ Proxy gateway for secure browsing
- ✅ SSRF protection
- ✅ Cookie management
- ✅ HTML/CSS URL rewriting
- ✅ Form submission support
- ✅ JavaScript compatibility layer

## Project Structure

```
.
├── frontend/          # React frontend (Cloudflare Pages)
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── styles/        # CSS styling
│   │   ├── utils/         # Browser utilities
│   │   └── types.ts       # TypeScript types
│   ├── index.html
│   ├── vite.config.ts
│   └── tsconfig.json
├── worker/            # Cloudflare Worker (Gateway)
│   ├── src/
│   │   ├── __tests__/     # Test suite
│   │   ├── index.ts       # Main handler
│   │   ├── security.ts    # SSRF protection
│   │   ├── proxy-url.ts   # URL encoding
│   │   ├── rewrite.ts     # HTML/CSS rewriting
│   │   └── cookies.ts     # Cookie management
│   ├── wrangler.toml
│   └── tsconfig.json
└── package.json       # Workspace root
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Wrangler CLI (for Cloudflare Workers)

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   # Frontend will use the local worker URL
   # Already configured in frontend/.env.local
   ```

3. **Start the Worker** (Terminal 1):
   ```bash
   npm run worker:dev
   ```
   This starts the gateway at `http://localhost:8787`

4. **Start the Frontend** (Terminal 2):
   ```bash
   npm run frontend:dev
   ```
   This starts the React app at `http://localhost:3000`

5. **Open in browser**:
   Visit `http://localhost:3000`

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run -w worker test
npm run -w frontend test
```

### Building for Production

```bash
# Build both frontend and worker
npm run frontend:build
npm run worker:build
```

## Deployment

### Prerequisites

- Cloudflare account
- Configured `wrangler.toml` with your account
- Cloudflare Pages project set up

### Deploy Worker

```bash
npm run worker:deploy
```

Production URL: `https://private-browser-gateway.private-browser.workers.dev`

### Deploy Frontend

The frontend should be deployed via Cloudflare Pages. Configure your Pages project to:
- Build command: `npm run frontend:build`
- Build directory: `frontend/dist`
- Environment variable: `VITE_GATEWAY_URL=https://private-browser-gateway.private-browser.workers.dev`

Production URL: `https://private-browser.pages.dev`

## Architecture Details

### Proxy URL Format

Destinations are encoded as:
```
https://gateway.workers.dev/p/<base64url-encoded-url>
```

Example:
- Destination: `https://example.com/page`
- Proxy URL: `https://gateway.workers.dev/p/aHR0cHM6Ly9leGFtcGxlLmNvbS9wYWdl`

### Security Features

- **SSRF Protection**: Blocks private IP ranges, metadata endpoints, and internal services
- **Cookie Isolation**: Cookies from one site don't leak to another
- **URL Validation**: All URLs validated before fetching
- **Redirect Validation**: Redirect targets checked for SSRF

### Resource Handling

- **HTML**: URLs rewritten, navigation bridge injected
- **CSS**: URL() and @import rewritten
- **JavaScript**: Passed through (no modification to preserve compatibility)
- **Binary**: Passed through unchanged

## Supported Browsers

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers

## Limitations

- WebSocket not supported
- Some advanced JavaScript features may not work correctly
- Very large file downloads limited by Worker timeout
- Challenge pages (CAPTCHA, etc.) must be solved manually

## Testing

### Local Testing

1. Start both frontend and worker as described above
2. Use the browser interface to navigate
3. Test sites:
   - example.com
   - bing.com
   - google.com
   - youtube.com
   - chatgpt.com
   - gemini.google.com

### Production Testing

After deployment, test against live URLs:
```
https://private-browser.pages.dev
```

## Troubleshooting

### Blank Page in Iframe

1. Check browser console for errors
2. Verify gateway URL in frontend env vars
3. Inspect iframe src attribute
4. Check Worker logs

### Cookies Not Working

1. Verify destination domain in cookie store
2. Check path and domain matching
3. Ensure secure flag compatible with protocol

### URLs Not Rewriting

1. Check content type is HTML/CSS
2. Verify proxy URL encoding
3. Review Worker response headers

## Development Notes

### Key Files

- `frontend/src/App.tsx` - Main app component
- `frontend/src/components/ProxyView.tsx` - Iframe handler
- `worker/src/index.ts` - Gateway request handler
- `worker/src/security.ts` - SSRF validation
- `worker/src/rewrite.ts` - URL rewriting logic

### TypeScript Strict Mode

The project uses strict TypeScript checking. Ensure types are properly defined.

### Environment Variables

- `VITE_GATEWAY_URL` - Gateway URL (default: http://localhost:8787)

## License

MIT

## Security Disclaimer

This project is a educational tool for understanding web proxy architecture. Use responsibly and respect the terms of service of websites you visit through this proxy.