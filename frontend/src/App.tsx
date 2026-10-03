import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import VNCViewer from './components/VNCViewer';
import PoxeyAudio from './PoxeyAudio';
import { startPoxeyHeartbeat, stopPoxeyHeartbeat } from './sessionHeartbeat';

const SESSION_API =
  '/__poxey_session/session/create';

export function App() {
  const [agreed, setAgreed] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [audioMuted, setAudioMuted] = useState(false);
  const vncRef = useRef<any>(null);
  const [screenSize, setScreenSize] = useState(100);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionActive || !sessionToken) return;

    startPoxeyHeartbeat(sessionToken, {
      onExpired: () => {
        setSessionActive(false);
        setSessionToken('');
        setError('Your Poxey session has ended.');
      },
    });

    return () => {
      void stopPoxeyHeartbeat(sessionToken);
    };
  }, [sessionActive, sessionToken]);

  const openTerms = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowTermsModal(true);
  };

  const handleScreenSizeChange = (sizePercent: number) => {
    if (!sessionToken) return

    setScreenSize(sizePercent)

    window.dispatchEvent(
      new CustomEvent('poxey-screen-size', {
        detail: { sizePercent },
      }),
    )
  };

  const handleLaunch = async () => {
    if (!agreed || launching) return;

    setLaunching(true);
    setError('');

    try {
      const response = await fetch(SESSION_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Session creation failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error('No session token returned');
      }

      setSessionToken(data.token);
      setSessionActive(true);
    } catch (err) {
      console.error(err);
      setError('Could not start the remote browser. Please try again.');
    } finally {
      setLaunching(false);
    }
  };

  if (sessionActive) {
    return (
      <div className="poxey-session-container">
        <div className="poxey-viewport-wrapper">
          <div className="poxey-chrome-canvas">
            <VNCViewer ref={vncRef} token={sessionToken} />
            <PoxeyAudio
              audioToken={sessionToken}
              enabled={!audioMuted}
              onEnabledChange={(enabled) => setAudioMuted(!enabled)}
            />
          </div>
        </div>

        <div className="left-toolbar">
          <button
            className="dock-btn keyboard-btn"
            onClick={() => vncRef.current?.focusKeyboard()}
            title="Toggle Keyboard"
          >
            ⌨️
          </button>
          <button
            className="dock-btn home-btn"
            onClick={() => {
              setSessionActive(false);
              setSessionToken('');
            }}
            title="Return Home"
          >
            🏠
          </button>
          <button
            className={`dock-btn audio-btn ${audioMuted ? 'muted' : ''}`}
            onClick={() => setAudioMuted(!audioMuted)}
            title="Toggle Audio"
          >
            {audioMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="poxey-container">
      <div className="poxey-wrapper">
        <div className="poxey-logo-container">
          <img
            src="/logo.png"
            alt="Poxey X Logo"
            className="poxey-logo-img"
          />
        </div>

        <h2 className="poxey-main-subtitle">
          Your private browser, anywhere.
        </h2>

        <p className="poxey-main-description">
          Poxey is a private remote browser that lets you browse the web through
          a separate Chromium session running on our server. Websites load
          inside the remote browser instead of directly on your device.
        </p>

        <div className="poxey-features">
          <div className="feature-item">
            <h3 className="feature-title">Remote browsing</h3>
            <p className="feature-desc">
              Browse websites through a real Chromium browser.
            </p>
          </div>

          <div className="feature-item">
            <h3 className="feature-title">Access restricted sites</h3>
            <p className="feature-desc">
              Poxey can help access websites that your network, school,
              workplace, or device administrator may restrict.
            </p>
          </div>

          <div className="feature-item">
            <h3 className="feature-title">Private session</h3>
            <p className="feature-desc">
              Your browsing session runs separately from your normal browser.
            </p>
          </div>

          <div className="feature-item">
            <h3 className="feature-title">Works anywhere</h3>
            <p className="feature-desc">
              Use Poxey from a phone, tablet, or computer with a normal web
              browser.
            </p>
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
              I agree to{' '}
              <a href="#" className="terms-link" onClick={openTerms}>
                Terms & Conditions
              </a>
            </span>
          </label>
        </div>

        {error && <p className="stream-info">{error}</p>}

        <button
          className={`poxey-launch-btn ${
            agreed && !launching ? 'active' : 'disabled'
          }`}
          disabled={!agreed || launching}
          onClick={handleLaunch}
        >
          {launching ? 'Starting Browser...' : 'Launch Browser'}
        </button>
      </div>

      {showTermsModal && (
        <div
          className="terms-modal-overlay"
          onClick={() => setShowTermsModal(false)}
        >
          <div
            className="terms-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="terms-modal-header">
              <h3>Terms & Conditions</h3>
              <button
                className="terms-close-btn"
                onClick={() => setShowTermsModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="terms-modal-body">
              <p>
                <strong>1. Acceptance of Terms</strong>
                <br />
                By using Poxey X, you agree to these Terms & Conditions.
              </p>

              <p>
                <strong>2. Use of Poxey X</strong>
                <br />
                Poxey X provides temporary remote browser sessions. You agree
                not to use the service for illegal, harmful, or malicious
                activity.
              </p>

              <p>
                <strong>3. Privacy</strong>
                <br />
                Your browsing session is isolated from your device. Free
                session data is deleted when the session ends. Poxey X does not
                sell your browsing activity.
              </p>

              <p>
                <strong>4. Session Limits</strong>
                <br />
                Free users receive a limited amount of browsing time every 24
                hours. Unused time does not carry over.
              </p>

              <p>
                <strong>5. Service Availability</strong>
                <br />
                Poxey X may experience interruptions, slowdowns, or changes due
                to maintenance, network conditions, or server availability.
              </p>

              <p>
                <strong>6. Agreement</strong>
                <br />
                By checking "I agree to the Terms & Conditions" and launching
                Poxey X, you confirm that you agree to these terms.
              </p>
            </div>

            <button
              className="terms-modal-done"
              onClick={() => setShowTermsModal(false)}
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
