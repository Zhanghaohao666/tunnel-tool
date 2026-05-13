import React from 'react';

export default function Sidebar({ tabs, activeTab, onTabChange, ruleCount, runningCount }) {
  return (
    <div className="sidebar">
      <span className="sidebar-label">Views</span>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          className={`sidebar-item${activeTab === tab.key ? ' active' : ''}`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </div>
      ))}
      <div className="sidebar-footer">
        <div>{ruleCount} rule{ruleCount !== 1 ? 's' : ''}</div>
        <div>{runningCount} running</div>
      </div>
    </div>
  );
}
