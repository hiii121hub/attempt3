import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import '../styles/ProxyView.css';
const ProxyView = ({ tab, onPageLoadComplete, onNavigate, }) => {
    const iframeRef = useRef(null);
    const [error, setError] = useState(null);
    const prevTabIdRef = useRef(null);
    /**
     * Update iframe URL when tab navigation changes
     */
    useEffect(() => {
        if (!iframeRef.current || !tab.proxyUrl) {
            return;
        }
        // Check if this is actually a new tab or navigation
        if (prevTabIdRef.current !== tab.id) {
            console.log(`Switching to tab ${tab.id}`);
            prevTabIdRef.current = tab.id;
        }
        console.log(`Loading proxy URL for tab ${tab.id}: ${tab.proxyUrl}`);
        iframeRef.current.src = tab.proxyUrl;
        setError(null);
    }, [tab.proxyUrl, tab.id]);
    /**
     * Handle iframe load event
     */
    const handleIframeLoad = () => {
        console.log(`iframe loaded for tab ${tab.id}`);
        onPageLoadComplete();
    };
    /**
     * Handle iframe error
     */
    const handleIframeError = (e) => {
        console.error(`iframe error for tab ${tab.id}:`, e);
        setError(`Failed to load ${tab.destinationUrl}`);
        onPageLoadComplete();
    };
    /**
     * Listen for navigation messages from iframe
     */
    useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            if (!message || message.tabId !== tab.id) {
                return;
            }
            if (message.type === 'navigate' && message.destination) {
                console.log(`Tab ${tab.id} requesting navigation to: ${message.destination}`);
                onNavigate(message.destination);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [tab.id, onNavigate]);
    if (!tab.proxyUrl && tab.destinationUrl) {
        return (_jsx("div", { className: "proxy-view", children: _jsxs("div", { className: "loading-state", children: [_jsx("p", { children: "Invalid URL or no proxy URL generated" }), _jsx("p", { className: "detail", children: tab.destinationUrl })] }) }));
    }
    if (!tab.destinationUrl && !tab.proxyUrl) {
        return (_jsx("div", { className: "proxy-view", children: _jsx("div", { className: "empty-state", children: _jsx("p", { children: "Enter a URL in the address bar to get started" }) }) }));
    }
    return (_jsxs("div", { className: "proxy-view", children: [error && (_jsx("div", { className: "error-banner", children: _jsx("p", { children: error }) })), tab.isLoading && (_jsx("div", { className: "loading-overlay", children: _jsx("div", { className: "spinner" }) })), _jsx("iframe", { ref: iframeRef, className: "proxy-iframe", title: tab.title, sandbox: "allow-same-origin allow-scripts allow-forms allow-popups allow-presentation", onLoad: handleIframeLoad, onError: handleIframeError })] }));
};
export default ProxyView;
