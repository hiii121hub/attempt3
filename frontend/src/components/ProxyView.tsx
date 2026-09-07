import React, { useEffect, useRef, useState } from 'react'
import { Tab, GatewayMessage } from '../types'
import { decodeProxyUrl } from '../utils/browser'
import '../styles/ProxyView.css'

interface ProxyViewProps {
  tab: Tab
  onPageLoadComplete: () => void
  onNavigate: (url: string) => void
}

const ProxyView: React.FC<ProxyViewProps> = ({
  tab,
  onPageLoadComplete,
  onNavigate,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState<string | null>(null)
  const prevTabIdRef = useRef<string | null>(null)

  /**
   * Update iframe URL when tab navigation changes
   */
  useEffect(() => {
    if (!iframeRef.current || !tab.proxyUrl) {
      return
    }

    // Check if this is actually a new tab or navigation
    if (prevTabIdRef.current !== tab.id) {
      console.log(`Switching to tab ${tab.id}`)
      prevTabIdRef.current = tab.id
    }

    console.log(`Loading proxy URL for tab ${tab.id}: ${tab.proxyUrl}`)
    iframeRef.current.src = tab.proxyUrl
    setError(null)
  }, [tab.proxyUrl, tab.id])

  /**
   * Handle iframe load event
   */
  const handleIframeLoad = () => {
    console.log(`iframe loaded for tab ${tab.id}`)
    onPageLoadComplete()
  }

  /**
   * Handle iframe error
   */
  const handleIframeError = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    console.error(`iframe error for tab ${tab.id}:`, e)
    setError(`Failed to load ${tab.destinationUrl}`)
    onPageLoadComplete()
  }

  /**
   * Listen for navigation messages from iframe
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as GatewayMessage | undefined
      if (!message || message.tabId !== tab.id) {
        return
      }

      if (message.type === 'navigate' && message.destination) {
        console.log(`Tab ${tab.id} requesting navigation to: ${message.destination}`)
        onNavigate(message.destination)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [tab.id, onNavigate])

  if (!tab.proxyUrl && tab.destinationUrl) {
    return (
      <div className="proxy-view">
        <div className="loading-state">
          <p>Invalid URL or no proxy URL generated</p>
          <p className="detail">{tab.destinationUrl}</p>
        </div>
      </div>
    )
  }

  if (!tab.destinationUrl && !tab.proxyUrl) {
    return (
      <div className="proxy-view">
        <div className="empty-state">
          <p>Enter a URL in the address bar to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="proxy-view">
      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}
      {tab.isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="proxy-iframe"
        title={tab.title}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />
    </div>
  )
}

export default ProxyView
