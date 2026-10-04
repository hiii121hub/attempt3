import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import VNCViewer from './components/VNCViewer';
import PoxeyAudio from './PoxeyAudio';
import { endPoxeySession, startPoxeyHeartbeat, stopPoxeyHeartbeat } from './sessionHeartbeat';

const SESSION_API =
  '/__poxey_session/session/create';

function formatSessionTime(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function App() {
  const [agreed, setAgreed] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [audioMuted, setAudioMuted] = useState(false);
  const vncRef = useRef<any>(null);
  const [screenSize, setScreenSize] = useState(100);
  const [launching, setLaunching] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [error, setError] = useState('');
  const [sessionRemainingMs, setSessionRemainingMs] = useState(0);

  useEffect(() => {
    if (!sessionActive || !sessionToken) return;

    startPoxeyHeartbeat(sessionToken, {
      onRemainingMs: (remainingMs) => {
        setSessionRemainingMs(remainingMs);
      },
      onExpired: () => {
        setSessionRemainingMs(0);
        setSessionActive(false);
        setSessionToken('');
        setError('Your Poxey session has ended.');
      },
    });

    return () => {
      stopPoxeyHeartbeat(sessionToken);
    };
  }, [sessionActive, sessionToken]);

  useEffect(() => {
    if (!sessionActive) return;

    const timer = window.setInterval(() => {
      setSessionRemainingMs((remainingMs) =>
        Math.max(0, remainingMs - 1000),
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [sessionActive]);

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

  const handleEndSession = async () => {
    if (!sessionToken || endingSession) return

    setEndingSession(true)
    setError('')

    const token = sessionToken

    stopPoxeyHeartbeat(token)

    try {
      const ended = await endPoxeySession(token)

      if (!ended) {
        setError('Could not end the Poxey session. Please try again.')
        return
      }

      setSessionActive(false)
      setSessionToken('')
      setSessionRemainingMs(0)
    } finally {
      setEndingSession(false)
    }
  }

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

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data?.error === 'ALLOWANCE_EXHAUSTED') {
          throw new Error(
            'Your 25-minute Free allowance has been used. Please wait for your 24-hour allowance to reset.'
          );
        }

        if (data?.error === 'ACTIVE_SESSION') {
          throw new Error(
            'This device already has an active Poxey session.'
          );
        }

        throw new Error(`Session creation failed: ${response.status}`);
      }

      if (!data.token) {
        throw new Error('No session token returned');
      }

      setSessionRemainingMs(
        Number.isFinite(data?.remainingMs) ? data.remainingMs : 0,
      );
      setSessionToken(data.token);
      setSessionActive(true);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Could not start the remote browser. Please try again.'
      );
    } finally {
      setLaunching(false);
    }
  };

  if (sessionActive) {
    const timerWarning =
      sessionRemainingMs <= 60_000
        ? 'critical'
        : sessionRemainingMs <= 5 * 60_000
          ? 'warning'
          : '';

    return (
      <div className="poxey-session-container">
        <div
          className={`poxey-session-timer ${timerWarning}`}
          aria-label={`${formatSessionTime(sessionRemainingMs)} remaining`}
        >
          <span className="timer-icon">⏱</span>
          <span>{formatSessionTime(sessionRemainingMs)}</span>
        </div>

        <div className="dock-zoom-control" aria-label="Screen size">
          <input
            className="zoom-slider"
            type="range"
            min="60"
            max="140"
            step="5"
            value={screenSize}
            onChange={(e) => handleScreenSizeChange(Number(e.target.value))}
            aria-label="Screen size"
          />
        </div>
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
              void handleEndSession()
            }}
            disabled={endingSession}
            title={endingSession ? 'Ending session...' : 'Return Home'}
          >
            {endingSession ? '⏳' : '🏠'}
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
