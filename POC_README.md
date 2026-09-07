# Remote Browser PoC - Setup & Usage Guide

## Overview

This proof-of-concept demonstrates a real Chromium browser running remotely and controlled interactively through your normal browser using VNC streaming.

**Architecture:**
```
Your Browser → WebSocket → noVNC → VNC Server → Xvfb → Chromium
                                                        ↓
                                                   example.com
```

## Quick Start (5 minutes)

### Step 1: Start Remote Browser Services

In **Terminal 1** of your Codespace:

```bash
./scripts/start-remote-browser.sh
```

This script will:
- Check available system resources
- Install missing packages (Xvfb, Chromium, TightVNC, websockify)
- Start Xvfb virtual display
- Start TightVNC server
- Start websockify (VNC-to-WebSocket bridge)
- Launch Chromium browser in the virtual display
- Display the connection information

**Expected output:**
```
=== Remote Browser PoC Startup ===

[1/5] Checking system resources...
Available RAM: 4900 MB
[2/5] Checking dependencies...
[3/5] Starting virtual display (Xvfb)...
Xvfb started (PID: 1234)
[4/5] Starting TightVNC server...
TightVNC started (PID: 1235)
[5/5] Starting websockify (VNC -> WebSocket bridge)...
websockify started (PID: 1236)
Starting Chromium browser...
Chromium started (PID: 1237)

=== Remote Browser PoC Started Successfully ===

Access the browser at:
  https://codespaces-name-port.github.dev:3000
```

### Step 2: Start Frontend Development Server

In **Terminal 2** of your Codespace:

```bash
cd frontend
npm run dev
```

The Vite dev server will start on port 3000.

### Step 3: Open in Your Browser

In your normal browser, visit the Codespaces public URL shown by Vite:
- Look for: `http://localhost:3000` → Click the link in the terminal
- Or manually construct: `https://codespaces-XXX-YYY.github.dev:3000`
  (replace with your actual Codespace name)

### Step 4: See Chromium Running

You should see:
1. A black canvas area with status "Connecting to VNC server..."
2. After 2-3 seconds: Status changes to "Connected - Remote browser ready"
3. The Chromium window appears on the canvas showing a blank page

### Step 5: Interact with Chromium

1. **Move your mouse** over the canvas
2. **Click** anywhere to interact
3. **Type** in the address bar:
   - Press Ctrl+L to focus address bar
   - Type: `example.com`
   - Press Enter

4. Watch example.com load and render in the remote Chromium
5. **Click links** on the page to navigate

## System Requirements

- **RAM:** ≥800 MB available (Codespaces free tier provides ~5 GB)
- **CPU:** ≥1 core (Codespaces provides 2 cores)
- **Display Server:** Xvfb (virtual display)
- **VNC Server:** TightVNC
- **Browser:** Real Chromium or Chrome
- **WebSocket Bridge:** websockify

## Files Modified/Created

### New Files:
- `scripts/start-remote-browser.sh` - Main startup script
- `scripts/stop-remote-browser.sh` - Stop all services
- `frontend/src/components/VNCViewer.tsx` - React component for noVNC
- `frontend/package.json` - Added noVNC dependency

### Modified Files:
- `frontend/src/App.tsx` - Simplified to display VNC viewer only
- `frontend/src/App.css` - Already compatible with full-height layout

## Troubleshooting

### Issue: "Connecting..." never completes

**Possible causes:**
- WebSocket port 6080 not accessible
- VNC server didn't start

**Fix:**
1. Check if websockify is running:
   ```bash
   ps aux | grep websockify
   ```
2. Check logs:
   ```bash
   tail /tmp/websockify.log
   ```
3. Restart services:
   ```bash
   ./scripts/stop-remote-browser.sh
   sleep 2
   ./scripts/start-remote-browser.sh
   ```

### Issue: Chromium window not visible

**Possible causes:**
- Chromium didn't start
- Xvfb crashed
- VNC server issue

**Fix:**
1. Check Chromium process:
   ```bash
   ps aux | grep chromium
   ```
2. Check logs:
   ```bash
   cat /tmp/chromium.log
   cat /tmp/xvfb.log
   cat /tmp/vnc.log
   ```
3. Verify X11 display:
   ```bash
   echo $DISPLAY
   DISPLAY=:1 xdpyinfo
   ```

### Issue: Mouse/keyboard input doesn't work

**Possible causes:**
- Canvas not in focus
- VNC connection issue

**Fix:**
1. Click the canvas first to ensure it has focus
2. Check browser console for errors (F12)
3. Verify WebSocket connection is established in browser DevTools → Network

### Issue: Codespaces URL won't load

**Possible causes:**
- Port 3000 (frontend) not forwarded
- Vite dev server crashed

**Fix:**
1. Check if Vite is running:
   ```bash
   ps aux | grep vite
   ```
2. Restart Vite:
   ```bash
   cd frontend
   npm run dev
   ```
3. Check Codespaces "Ports" tab to verify port 3000 is forwarded

## Resource Usage

Expected usage during testing:
- **RAM:** 1.5-2 GB (within 4 GB Codespaces limit)
- **CPU:** 30-50% of available cores
- **Bandwidth:** 1-3 Mbps (typical, ~5 Mbps with video)
- **Storage:** ~2 GB (Chromium cache + temporary files)

## Stopping Services

To cleanly shut down all services:

```bash
./scripts/stop-remote-browser.sh
```

Or manually:
```bash
# Stop Chromium
pkill -f chromium

# Stop VNC
vncserver -kill :1

# Stop websockify
pkill -f websockify

# Stop Xvfb
pkill -f "Xvfb.*:1"
```

## Next Steps After PoC Success

Once you confirm:
- [ ] Chromium window visible
- [ ] Mouse input works
- [ ] Keyboard input works
- [ ] example.com loads correctly
- [ ] Links can be clicked and navigate

Possible enhancements (DO NOT DO YET):
- Custom address bar UI
- Tab management
- Browser history
- Multiple sessions
- Cloudflare Pages deployment
- Website-specific handling (YouTube, ChatGPT, etc.)

## Architecture Notes

### Why VNC + noVNC?

- **Simplicity:** VNC is proven, stable, widely used
- **Compatibility:** Works with any browser supporting WebSocket
- **Latency:** 100-150ms acceptable for interactive testing
- **Bandwidth:** 1-3 Mbps typical (fits within free tier)
- **CPU:** Low overhead compared to WebRTC

### Why Not WebRTC?

- Higher CPU usage
- More complex setup
- Not necessary for PoC
- Adds complexity without PoC benefit

### Why Xvfb?

- Lightweight virtual X11 server
- No need for physical display
- Minimal resource overhead
- Perfect for Chromium headless+display use case

### Why TightVNC?

- Compression reduces bandwidth
- Widely used and stable
- Easy to bridge to WebSocket via websockify
- Lower CPU than some alternatives

## Performance Expectations

- **Connection time:** 2-5 seconds
- **Mouse lag:** 50-200ms (cloud routing)
- **Keyboard response:** <100ms
- **Page load time:** Normal (depends on network)
- **Video playback:** 24-30 FPS typical

## Known Limitations

1. **Single user, single session:** This PoC only supports one browser session at a time
2. **No persistence:** Closing Chromium ends the session
3. **No URL rewriting:** Navigation occurs in real Chromium (no proxy layer)
4. **Cloud latency:** 100-150ms latency due to cloud routing
5. **Auto-suspend:** Codespaces auto-suspends after 30 min idle (expected in dev environment)
6. **No authentication:** Any user with the public URL can access the browser

## FAQ

**Q: Can I browse any website?**
A: Yes, the real Chromium makes real requests. This PoC proves that approach works.

**Q: Why does my keyboard input have lag?**
A: Cloud routing adds 100-150ms latency. This is expected and acceptable for testing.

**Q: Can I use this in production?**
A: This is a proof-of-concept. Production would require scaling, authentication, rate limiting, and cost optimization.

**Q: What happens if I close the Chromium window?**
A: You'll need to run the startup script again to launch a new Chromium instance.

**Q: Will this work with ChatGPT / YouTube / Bing?**
A: This PoC proves the architecture works. Those sites may have additional challenges (fingerprinting, rate limiting, etc.) that are NOT addressed in this PoC.

**Q: How long can I run this?**
A: GitHub Codespaces free tier provides 60 core-hours/month. One 2-core session = 2 core-hours per hour of use.

## Success Criteria

You've successfully demonstrated the PoC when:

✓ I can start services with one command  
✓ A web UI appears in my browser  
✓ VNC connection established  
✓ Chromium window visible on canvas  
✓ Mouse movement visible/responsive  
✓ Keyboard input works  
✓ Can navigate to example.com  
✓ Can click links and navigate  

## Support

For issues or questions, check:
1. `/tmp/xvfb.log` - Xvfb logs
2. `/tmp/vnc.log` - VNC server logs
3. `/tmp/websockify.log` - WebSocket bridge logs
4. `/tmp/chromium.log` - Chromium logs
5. Browser DevTools → Console → for JavaScript errors
6. Browser DevTools → Network → for WebSocket errors
