import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { normalizeUserInput } from '../utils/browser';
import '../styles/AddressBar.css';
const AddressBar = ({ url, isLoading, canGoBack, canGoForward, onNavigate, onBack, onForward, onRefresh, }) => {
    const [inputValue, setInputValue] = useState(url);
    useEffect(() => {
        setInputValue(url);
    }, [url]);
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputValue.trim())
            return;
        const normalizedUrl = normalizeUserInput(inputValue);
        onNavigate(normalizedUrl);
    };
    return (_jsxs("div", { className: "address-bar", children: [_jsxs("div", { className: "browser-controls", children: [_jsx("button", { className: "control-btn", onClick: onBack, disabled: !canGoBack, title: "Back", children: "\u2190" }), _jsx("button", { className: "control-btn", onClick: onForward, disabled: !canGoForward, title: "Forward", children: "\u2192" }), _jsx("button", { className: `control-btn ${isLoading ? 'loading' : ''}`, onClick: onRefresh, title: "Refresh", children: "\u21BB" })] }), _jsx("form", { onSubmit: handleSubmit, className: "url-form", children: _jsx("input", { type: "text", className: "url-input", placeholder: "Enter URL or search...", value: inputValue, onChange: e => setInputValue(e.target.value), spellCheck: "false" }) })] }));
};
export default AddressBar;
