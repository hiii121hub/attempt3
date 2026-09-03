import React, { useState, useEffect, useRef } from 'react'
import { Tab, GatewayMessage } from '../types'
import TabBar from './TabBar'
import AddressBar from './AddressBar'
import ProxyView from './ProxyView'
import '../styles/BrowserUI.css'

interface BrowserUIProps {
  tabs: Tab[]
  activeTabId: string | null
  onNewTab: () => void
  onCloseTab: (tabId: string) => void
  onSelectTab: (tabId: string) => void
  onNavigate: (url: string) => void
  onBack: () => void
  onForward: () => void
  onRefresh: () => void
  onPageTitleUpdate: (tabId: string, title: string) => void
  onPageLoadComplete: (tabId: string) => void
  onNavigationFromProxy: (message: GatewayMessage) => void
}

const BrowserUI: React.FC<BrowserUIProps> = ({
  tabs,
  activeTabId,
  onNewTab,
  onCloseTab,
  onSelectTab,
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  onPageTitleUpdate,
  onPageLoadComplete,
  onNavigationFromProxy,
}) => {
  const activeTab = tabs.find(t => t.id === activeTabId)
  const canGoBack = activeTab && activeTab.historyIndex > 0
  const canGoForward = activeTab && activeTab.historyIndex < activeTab.history.length - 1

  /**
   * Listen for messages from iframe/gateway
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as GatewayMessage | undefined
      if (!message || !message.tabId) return

      // Validate the message comes from a known tab
      const tab = tabs.find(t => t.id === message.tabId)
      if (!tab) {
        console.warn(`Received message for unknown tab: ${message.tabId}`)
        return
      }

      switch (message.type) {
        case 'navigate':
          onNavigationFromProxy(message)
          break
        case 'init':
          console.log(`Tab ${message.tabId} initialized`)
          break
        case 'ready':
          onPageLoadComplete(message.tabId)
          if (message.destination) {
            onPageTitleUpdate(message.tabId, message.destination)
          }
          break
        case 'error':
          console.error(`Tab ${message.tabId} error:`, message.error)
          onPageLoadComplete(message.tabId)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [tabs, onNavigationFromProxy, onPageTitleUpdate, onPageLoadComplete])

  return (
    <div className="browser-ui">
      {/* Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onNewTab={onNewTab}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
      />

      {/* Address Bar */}
      <AddressBar
        url={activeTab?.destinationUrl || ''}
        isLoading={activeTab?.isLoading || false}
        canGoBack={!!canGoBack}
        canGoForward={!!canGoForward}
        onNavigate={onNavigate}
        onBack={onBack}
        onForward={onForward}
        onRefresh={onRefresh}
      />

      {/* Proxy View / Content Area */}
      {activeTab ? (
        <ProxyView
          tab={activeTab}
          onPageLoadComplete={() => onPageLoadComplete(activeTabId!)}
          onNavigate={onNavigate}
        />
      ) : (
        <div className="empty-state">
          <p>No tabs open. Create a new tab to get started.</p>
        </div>
      )}
    </div>
  )
}

export default BrowserUI
