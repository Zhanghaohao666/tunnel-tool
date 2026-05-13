import React from 'react';

export default function RuleList({ rules, runningIds, onStart, onStop, onEdit, onDuplicate, onDelete }) {
  if (rules.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#9889;</div>
        <div className="empty-state-text">No rules yet. Add a proxy or tunnel rule to get started.</div>
      </div>
    );
  }

  return (
    <div className="rule-list">
      {rules.map((rule) => {
        const running = runningIds.has(rule.id);
        const detail = rule.type === 'proxy'
          ? `${rule.listen} → ${rule.target}`
          : `${rule.user}@${rule.server} :${rule.localPort} → :${rule.remotePort}`;

        return (
          <div className="rule-item" key={rule.id}>
            <div className={`rule-status${running ? ' running' : ''}`} />
            <div className="rule-info">
              <div className="rule-name">{rule.name}</div>
              <div className="rule-detail">{detail}</div>
            </div>
            <span className="rule-type-badge">{rule.type}</span>
            <div className="rule-actions">
              {running ? (
                <button className="btn btn-sm btn-danger" onClick={() => onStop(rule)}>STOP</button>
              ) : (
                <button className="btn btn-sm btn-accent" onClick={() => onStart(rule)}>START</button>
              )}
              <button className="btn btn-sm" onClick={() => onEdit(rule)}>EDIT</button>
              <button className="btn btn-sm" onClick={() => onDuplicate(rule)}>COPY</button>
              <button className="btn btn-sm" onClick={() => onDelete(rule.id)}>DEL</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
