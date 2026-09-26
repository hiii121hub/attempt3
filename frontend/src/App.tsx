import React, { useState } from 'react';
import './App.css';

export function App() {
  const [agreed, setAgreed] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  const openTerms = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowTermsModal(true);
  };

  const handleLaunch = () => {
    if (!agreed) return;
    setSessionActive(true);
  };

  // Live Chrome Session View
  if (sessionActive) {
    return (
      <div className="poxey-session-container">
        {/* Chrome Stream Container with Dynamic Scaling */}
        <div className="poxey-viewport-wrapper">
          <div 
            className="poxey-chrome-canvas"
            style={{ transform: `scale(${zoomLevel / 100})` }}
          >
            <div className="chrome-placeholder-stream">
              <span className="live-badge">● LIVE CHROME SESSION</span>
              <p className="stream-info">Connecting to Chromium server session...</p>
            </div>
          </div>
        </div>

        {/* Bottom Control Dock */}
        <div className="poxey-bottom-dock">
          {/* Home Button */}
          <button 
            className="dock-btn home-btn" 
            onClick={() => setSessionActive(false)}
            title="Return Home"
          >
            🏠 Home
          </button>

          {/* Smooth Screen Resizer */}
          <div className="dock-zoom-control">
            <span className="zoom-label">{zoomLevel}%</span>
            <input 
              type="range" 
              min="50" 
              max="150" 
              value={zoomLevel} 
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="zoom-slider"
            />
          </div>

          {/* Audio Button */}
          <button 
            className={`dock-btn audio-btn ${audioMuted ? 'muted' : ''}`} 
            onClick={() => setAudioMuted(!audioMuted)}
            title="Toggle Audio"
          >
            {audioMuted ? '🔇 Audio Off' : '🔊 Audio On'}
          </button>
        </div>
      </div>
    );
  }

  // Landing Page View
  return (
    <div className="poxey-container">
      <div className="poxey-wrapper">
        
        {/* Logo */}
        <div className="poxey-logo-container">
          <img 
            src="/logo.png" 
            alt="Poxey X Logo" 
            className="poxey-logo-img"
          />
        </div>

        {/* Subtitle & Description */}
        <h2 className="poxey-main-subtitle">Your private browser, anywhere.</h2>
        <p className="poxey-main-description">
          Poxey is a private remote browser that lets you browse the web through a separate Chromium session running on our server. Websites load inside the remote browser instead of directly on your device.
        </p>

        {/* Feature Box */}
        <div className="poxey-features">
          <div className="feature-item">
            <h3 className="feature-title">Remote browsing</h3>
            <p className="feature-desc">Browse websites through a real Chromium browser.</p>
          </div>

          <div className="feature-item">
            <h3 className="feature-title">Access restricted sites</h3>
            <p className="feature-desc">Poxey can help access websites that your network, school, workplace, or device administrator may restrict.</p>
          </div>

          <div className="feature-item">
            <h3 className="feature-title">Private session</h3>
            <p className="feature-desc">Your browsing session runs separately from your normal browser.</p>
          </div>

          <div className="feature-item">
            <h3 className="feature-title">Works anywhere</h3>
            <p className="feature-desc">Use Poxey from a phone, tablet, or computer with a normal web browser.</p>
          </div>
        </div>

        {/* Terms Checkbox */}
        <div className="poxey-terms-container">
          <label className="terms-label">
            <input 
              type="checkbox" 
              className="terms-checkbox" 
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>
              I agree to the{' '}
              <a href="#" className="terms-link" onClick={openTerms}>
                Terms & Conditions
              </a>
            </span>
          </label>
        </div>

        {/* Launch Button */}
        <button 
          className={`poxey-launch-btn ${agreed ? 'active' : 'disabled'}`}
          disabled={!agreed}
          onClick={handleLaunch}
        >
          Launch Browser
        </button>

      </div>

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="terms-modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="terms-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="terms-modal-header">
              <h3>Terms & Conditions</h3>
              <button className="terms-close-btn" onClick={() => setShowTermsModal(false)}>✕</button>
            </div>
            <div className="terms-modal-body">
              <p><strong>1. Acceptance of Terms</strong><br />By using Poxey X, you agree to these Terms & Conditions.</p>
              <p><strong>2. Use of Poxey X</strong><br />Poxey X provides temporary remote browser sessions. You agree not to use the service for illegal, harmful, or malicious activity.</p>
              <p><strong>3. Privacy</strong><br />Your browsing session is isolated from your device. Free session data is deleted when the session ends. Poxey X does not sell your browsing activity.</p>
              <p><strong>4. Session Limits</strong><br />Free users receive a limited amount of browsing time every 24 hours. Unused time does not carry over.</p>
              <p><strong>5. Service Availability</strong><br />Poxey X may experience interruptions, slowdowns, or changes due to maintenance, network conditions, or server availability.</p>
              <p><strong>6. Agreement</strong><br />By checking "I agree to the Terms & Conditions" and launching Poxey X, you confirm that you agree to these terms.</p>
            </div>
            <button className="terms-modal-done" onClick={() => setShowTermsModal(false)}>Got It</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
