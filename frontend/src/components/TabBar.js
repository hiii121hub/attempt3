import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import '../styles/TabBar.css';
const TabBar = ({ tabs, activeTabId, onNewTab, onSelectTab, onCloseTab, }) => {
    return (_jsxs("div", { className: "tab-bar", children: [_jsx("div", { className: "tabs-container", children: tabs.map(tab => (_jsxs("div", { className: `tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isLoading ? 'loading' : ''}`, onClick: () => onSelectTab(tab.id), children: [_jsx("span", { className: "tab-title", children: tab.title || 'New Tab' }), _jsx("button", { className: "tab-close", onClick: e => {
                                e.stopPropagation();
                                onCloseTab(tab.id);
                            }, "aria-label": "Close tab", children: "\u00D7" })] }, tab.id))) }), _jsx("button", { className: "new-tab-btn", onClick: onNewTab, title: "New tab", children: "+" })] }));
};
export default TabBar;
