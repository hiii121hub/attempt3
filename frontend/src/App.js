import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import VNCViewer from './components/VNCViewer';
import './App.css';
const App = () => {
    return (_jsxs("div", { style: { width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: { padding: '10px', backgroundColor: '#333', color: '#fff', fontSize: '14px' }, children: [_jsx("strong", { children: "Remote Browser PoC" }), " - Chromium via VNC"] }), _jsx(VNCViewer, {})] }));
};
export default App;
