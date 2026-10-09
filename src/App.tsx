import React, { useState } from 'react';
import './App.css';

export function App() {
  const [agreed, setAgreed] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  const openTerms = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowTermsModal(true);
  };

  const handleLaunch = () => {
    if (!agreed) return;
    setSessionActive(true);
  };

  const getVncUrl = () => `http://${window.location.hostname}:6080/vnc.html?autoconnect=true&resize=scale&reconnect=true`;

  if (sessionActive) {
    return (
      <div className="poxey-session-container">
        <div className="session-topbar">
          <div className="session-title-group">
            <span className="session-dot"></span>
            <span className="session-title">Poxey X - Remote Chrome Session</span>
          </div>
          <button className="dock-btn" onClick={() => setSessionActive(false)}>
            Exit Session
          </button>
        </div>
        <div className="session-viewport">
          <iframe 
            src={getVncUrl()}
            title="Remote Chrome Browser"
            className="remote-chrome-frame"
            allow="fullscreen; clipboard-read; clipboard-write"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="poxey-container">
      <div className="poxey-wrapper">
        
        <div className="poxey-logo-container">
          <img 
            src="/IMG_4115_3.PNG" 
            alt="Poxey X Logo" 
            className="poxey-logo-img"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/IMG_4115_3.png';
            }}
          />
        </div>

        <h2 className="poxey-main-subtitle">Your private browser, anywhere.</h2>
        <p className="poxey-main-description">
          Poxey is a private remote browser that lets you browse the web through a separate session running on our server.
        </p>

        <div className="poxey-features">
          <div className="feature-item">
            <h3 className="feature-title">Remote browsing</h3>
            <p className="feature-desc">Browse websites securely through a cloud server.</p>
          </div>

          <div className="feature-item">
            <h3 className="feature-title">Access restricted sites</h3>
            <p className="feature-desc">Bypass local network and device restrictions.</p>
          </div>

          <div className="feature-item">
            <h3 className="feature-title">Private session</h3>
            <p className="feature-desc">Your session stays private and isolated.</p>
          </div>

          <div className="feature-item">
            <h3 className="feature-title">Works anywhere</h3>
            <p className="feature-desc">Access from any phone, tablet, or computer.</p>
          </div>
        </div>

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

        <button 
          className={`poxey-launch-btn ${agreed ? 'active' : 'disabled'}`}
          disabled={!agreed}
          onClick={handleLaunch}
        >
          Launch Browser
        </button>

      </div>

      {showTermsModal && (
        <div className="terms-modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="terms-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="terms-modal-header">
              <h3>Terms & Conditions</h3>
              <button className="terms-close-btn" onClick={() => setShowTermsModal(false)}>✕</button>
            </div>
            <div className="terms-modal-body">
              <h4>1. Acceptance of Terms</h4>
              <p>By launching and using Poxey X, you agree to follow all rules outlined in this agreement.</p>
              
              <h4>2. Authorized Usage</h4>
              <p>Poxey X provides remote isolated browser sessions. You agree not to use the service for illegal activities, network attacks, or unauthorized data scraping.</p>
              
              <h4>3. Privacy & Session Data</h4>
              <p>Remote browser sessions are temporary. Once you exit your session, temporary cache, cookies, and active browsing data are cleared from the host server.</p>
              
              <h4>4. System Resources</h4>
              <p>Sessions are subject to resource limits to ensure stability for all users. Inactive sessions may be closed automatically.</p>

              <h4>5. Disclaimer of Liability</h4>
              <p>Poxey X is provided "as is" without warranties of any kind. Use the service responsibly.</p>
            </div>
            <button className="terms-modal-done" onClick={() => setShowTermsModal(false)}>Got It</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
