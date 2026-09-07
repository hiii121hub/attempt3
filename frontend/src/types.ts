export interface NavigationEntry {
  url: string
  timestamp: number
}

export interface Tab {
  id: string
  title: string
  destinationUrl: string
  proxyUrl: string | null
  isLoading: boolean
  history: NavigationEntry[]
  historyIndex: number
  favicon?: string
}

export interface BrowserState {
  tabs: Map<string, Tab>
  activeTabId: string | null
}

export interface GatewayMessage {
  type: 'init' | 'navigate' | 'ready' | 'error'
  tabId: string
  destination?: string
  proxyUrl?: string
  error?: string
  timestamp: number
}
