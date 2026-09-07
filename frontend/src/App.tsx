import React, { FormEvent, useEffect, useState } from 'react'
import VNCViewer from './components/VNCViewer'
import './App.css'
import { startPoxeyHeartbeat, stopPoxeyHeartbeat } from './sessionHeartbeat'

interface Branding {
  title: string
  subtitle: string
}

const DEFAULT_BRANDING: Branding = {
  title: 'Poxey',
  subtitle: 'Your private browser, anywhere.',
}

const API_BASE = import.meta.env.VITE_ADMIN_API_URL || '/__poxey_admin'

const AdminPage: React.FC = () => {
  const [password, setPassword] = useState('')
  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  const [authenticated, setAuthenticated] = useState(false)
  const [message, setMessage] = useState('')

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (!response.ok) {
      setMessage('Authentication failed.')
      return
    }

    setAuthenticated(true)
    setPassword('')
    setMessage('')
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const response = await fetch(`${API_BASE}/branding`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branding),
    })

    setMessage(response.ok ? 'Saved.' : 'Save failed.')
  }

  return (
    <main className="admin-page">
      <div className="admin-panel">
        <strong>Poxey admin</strong>

        {!authenticated ? (
          <form onSubmit={login}>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <button type="submit">Sign in</button>
          </form>
        ) : (
          <form onSubmit={save}>
            <label>
              Title
              <input
                value={branding.title}
                onChange={event =>
                  setBranding({
                    ...branding,
                    title: event.target.value,
                  })
                }
                required
              />
            </label>

            <label>
              Subtitle
              <input
                value={branding.subtitle}
                onChange={event =>
                  setBranding({
                    ...branding,
                    subtitle: event.target.value,
                  })
                }
                required
              />
            </label>

            <button type="submit">Save branding</button>
          </form>
        )}

        {message && <p role="status">{message}</p>}
      </div>
    </main>
  )
}

const BrowserPage: React.FC = () => {
  const [launched, setLaunched] = useState(false)
  const [branding, setBranding] = useState(DEFAULT_BRANDING)

  useEffect(() => {
    if (launched) {
      startPoxeyHeartbeat()
    } else {
      stopPoxeyHeartbeat()
    }

    return () => {
      stopPoxeyHeartbeat()
    }
  }, [launched])

  useEffect(() => {
    fetch(`${API_BASE}/branding`)
      .then(response => (response.ok ? response.json() : DEFAULT_BRANDING))
      .then(setBranding)
      .catch(() => undefined)
  }, [])

  if (!launched) {
    return (
      <main className="landing-page">
        <div className="landing-content">
          <h1>{branding.title}</h1>

          <p className="landing-subtitle">
            {branding.subtitle}
          </p>

          <p className="landing-description">
            Poxey is a private remote browser that lets you browse the web
            through a separate Chromium session running on our server.
            Websites load inside the remote browser instead of directly on
            your device.
          </p>

          <div className="landing-features">
            <div>
              <strong>🌐 Remote browsing</strong>
              <span>
                Browse websites through a real Chromium browser.
              </span>
            </div>

            <div>
              <strong>🔓 Access restricted sites</strong>
              <span>
                Poxey can help access websites that your network, school,
                workplace, or device administrator may restrict.
              </span>
            </div>

            <div>
              <strong>🔒 Private session</strong>
              <span>
                Your browsing session runs separately from your normal
                browser.
              </span>
            </div>

            <div>
              <strong>📱 Works anywhere</strong>
              <span>
                Use Poxey from a phone, tablet, or computer with a normal
                web browser.
              </span>
            </div>
          </div>

          <button
            className="launch-button"
            onClick={() => setLaunched(true)}
          >
            Launch Browser
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="remote-browser-page">
      <div className="remote-browser-controls">
        <button
          type="button"
          onClick={() => setLaunched(false)}
          aria-label="Return to Poxey home"
        >
          🏠
        </button>
      </div>

      <VNCViewer />
    </main>
  )
}

const App: React.FC = () =>
  window.location.pathname === '/admin' ? (
    <AdminPage />
  ) : (
    <BrowserPage />
  )

export default App
