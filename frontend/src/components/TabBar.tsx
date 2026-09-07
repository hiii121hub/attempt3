import React from 'react'
import { Tab } from '../types'
import '../styles/TabBar.css'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onNewTab: () => void
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onNewTab,
  onSelectTab,
  onCloseTab,
}) => {
  return (
    <div className="tab-bar">
      <div className="tabs-container">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isLoading ? 'loading' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="tab-title">{tab.title || 'New Tab'}</span>
            <button
              className="tab-close"
              onClick={e => {
                e.stopPropagation()
                onCloseTab(tab.id)
              }}
              aria-label="Close tab"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="new-tab-btn" onClick={onNewTab} title="New tab">
        +
      </button>
    </div>
  )
}

export default TabBar
