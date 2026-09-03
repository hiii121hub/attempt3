import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import TabBar from './TabBar';
import AddressBar from './AddressBar';
import ProxyView from './ProxyView';
import '../styles/BrowserUI.css';
const BrowserUI = ({ tabs, activeTabId, onNewTab, onCloseTab, onSelectTab, onNavigate, onBack, onForward, onRefresh, onPageTitleUpdate, onPageLoadComplete, onNavigationFromProxy, }) => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const canGoBack = activeTab && activeTab.historyIndex > 0;
    const canGoForward = activeTab && activeTab.historyIndex < activeTab.history.length - 1;
    /**
     * Listen for messages from iframe/gateway
     */
    useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            if (!message || !message.tabId)
                return;
            // Validate the message comes from a known tab
            const tab = tabs.find(t => t.id === message.tabId);
            if (!tab) {
                console.warn(`Received message for unknown tab: ${message.tabId}`);
                return;
            }
            switch (message.type) {
                case 'navigate':
                    onNavigationFromProxy(message);
                    break;
                case 'init':
                    console.log(`Tab ${message.tabId} initialized`);
                    break;
                case 'ready':
                    onPageLoadComplete(message.tabId);
                    if (message.destination) {
                        onPageTitleUpdate(message.tabId, message.destination);
                    }
                    break;
                case 'error':
                    console.error(`Tab ${message.tabId} error:`, message.error);
                    onPageLoadComplete(message.tabId);
                    break;
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [tabs, onNavigationFromProxy, onPageTitleUpdate, onPageLoadComplete]);
    return (_jsxs("div", { className: "browser-ui", children: [_jsx(TabBar, { tabs: tabs, activeTabId: activeTabId, onNewTab: onNewTab, onSelectTab: onSelectTab, onCloseTab: onCloseTab }), _jsx(AddressBar, { url: activeTab?.destinationUrl || '', isLoading: activeTab?.isLoading || false, canGoBack: !!canGoBack, canGoForward: !!canGoForward, onNavigate: onNavigate, onBack: onBack, onForward: onForward, onRefresh: onRefresh }), activeTab ? (_jsx(ProxyView, { tab: activeTab, onPageLoadComplete: () => onPageLoadComplete(activeTabId), onNavigate: onNavigate })) : (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No tabs open. Create a new tab to get started." }) }))] }));
};
export default BrowserUI;
