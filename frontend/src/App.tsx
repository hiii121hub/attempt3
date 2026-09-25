import React, { useState } from 'react'
import BrowserUI from './components/BrowserUI'
import { Tab, GatewayMessage } from './types'
import './App.css'

const App: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: 'tab-1',
      title: 'Google',
      destinationUrl: 'https://www.google.com',
      proxyUrl: 'https://www.google.com',
      history: ['https://www.google.com'],
      historyIndex: 0,
      isLoading: false,
    },
  ])
  const [activeTabId, setActiveTabId] = useState<string | null>('tab-1')

  const handleNewTab = () => {
    const newId = `tab-${Date.now()}`
    const newTab: Tab = {
      id: newId,
      title: 'New Tab',
      destinationUrl: '',
      proxyUrl: '',
      history: [],
      historyIndex: -1,
      isLoading: false,
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newId)
  }

  const handleCloseTab = (tabId: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId)
      if (activeTabId === tabId) {
        setActiveTabId(filtered.length > 0 ? filtered[filtered.length - 1].id : null)
      }
      return filtered
    })
  }

  const handleSelectTab = (tabId: string) => {
    setActiveTabId(tabId)
  }

  const handleNavigate = (url: string) => {
    if (!activeTabId) return
    const formattedUrl = url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `https://${url}`

    setTabs(prev =>
      prev.map(tab => {
        if (tab.id !== activeTabId) return tab
        const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), formattedUrl]
        return {
          ...tab,
          title: formattedUrl,
          destinationUrl: formattedUrl,
          proxyUrl: formattedUrl,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          isLoading: true,
        }
      })
    )
  }

  const handleBack = () => {
    if (!activeTabId) return
    setTabs(prev =>
      prev.map(tab => {
        if (tab.id !== activeTabId || tab.historyIndex <= 0) return tab
        const newIndex = tab.historyIndex - 1
        const targetUrl = tab.history[newIndex]
        return {
          ...tab,
          historyIndex: newIndex,
          destinationUrl: targetUrl,
          proxyUrl: targetUrl,
          title: targetUrl,
        }
      })
    )
  }

  const handleForward = () => {
    if (!activeTabId) return
    setTabs(prev =>
      prev.map(tab => {
        if (tab.id !== activeTabId || tab.historyIndex >= tab.history.length - 1) return tab
        const newIndex = tab.historyIndex + 1
        const targetUrl = tab.history[newIndex]
        return {
          ...tab,
          historyIndex: newIndex,
          destinationUrl: targetUrl,
          proxyUrl: targetUrl,
          title: targetUrl,
        }
      })
    )
  }

  const handleRefresh = () => {
    if (!activeTabId) return
    setTabs(prev =>
      prev.map(tab => (tab.id === activeTabId ? { ...tab, isLoading: true } : tab))
    )
  }

  const handlePageTitleUpdate = (tabId: string, title: string) => {
    setTabs(prev =>
      prev.map(tab => (tab.id === tabId ? { ...tab, title } : tab))
    )
  }

  const handlePageLoadComplete = (tabId: string) => {
    setTabs(prev =>
      prev.map(tab => (tab.id === tabId ? { ...tab, isLoading: false } : tab))
    )
  }

  const handleNavigationFromProxy = (message: GatewayMessage) => {
    if (message.destination && message.tabId) {
      handleNavigate(message.destination)
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <BrowserUI
        tabs={tabs}
        activeTabId={activeTabId}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
        onSelectTab={handleSelectTab}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onRefresh={handleRefresh}
        onPageTitleUpdate={handlePageTitleUpdate}
        onPageLoadComplete={handlePageLoadComplete}
        onNavigationFromProxy={handleNavigationFromProxy}
      />
    </div>
  )
}

export default App
