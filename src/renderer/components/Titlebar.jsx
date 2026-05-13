import React from 'react';

export default function Titlebar() {
  return (
    <div className="titlebar">
      <span className="titlebar-title">Tunnel Tool</span>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => window.tunnelAPI.minimize()}>−</button>
        <button className="titlebar-btn" onClick={() => window.tunnelAPI.maximize()}>□</button>
        <button className="titlebar-btn close" onClick={() => window.tunnelAPI.close()}>×</button>
      </div>
    </div>
  );
}
