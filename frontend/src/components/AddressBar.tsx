import React, { useState, useEffect } from 'react'
import { normalizeUserInput } from '../utils/browser'
import '../styles/AddressBar.css'

interface AddressBarProps {
  url: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  onNavigate: (url: string) => void
  onBack: () => void
  onForward: () => void
  onRefresh: () => void
}

const AddressBar: React.FC<AddressBarProps> = ({
  url,
  isLoading,
  canGoBack,
  canGoForward,
  onNavigate,
  onBack,
  onForward,
  onRefresh,
}) => {
  const [inputValue, setInputValue] = useState(url)

  useEffect(() => {
    setInputValue(url)
  }, [url])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const normalizedUrl = normalizeUserInput(inputValue)
    onNavigate(normalizedUrl)
  }

  return (
    <div className="address-bar">
      <div className="browser-controls">
        <button
          className="control-btn"
          onClick={onBack}
          disabled={!canGoBack}
          title="Back"
        >
          ←
        </button>
        <button
          className="control-btn"
          onClick={onForward}
          disabled={!canGoForward}
          title="Forward"
        >
          →
        </button>
        <button
          className={`control-btn ${isLoading ? 'loading' : ''}`}
          onClick={onRefresh}
          title="Refresh"
        >
          ↻
        </button>
      </div>

      <form onSubmit={handleSubmit} className="url-form">
        <input
          type="text"
          className="url-input"
          placeholder="Enter URL or search..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          spellCheck="false"
        />
      </form>
    </div>
  )
}

export default AddressBar
