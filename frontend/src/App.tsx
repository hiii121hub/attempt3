import React from 'react'
import VNCViewer from './components/VNCViewer'
import './App.css'

const App: React.FC = () => {

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', backgroundColor: '#333', color: '#fff', fontSize: '14px' }}>
        <strong>Remote Browser PoC</strong> - Chromium via VNC
      </div>
      <VNCViewer />
    </div>
  )
}

export default App
