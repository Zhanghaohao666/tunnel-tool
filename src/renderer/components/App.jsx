import React, { useState, useEffect, useCallback } from 'react';
import Titlebar from './Titlebar';
import Sidebar from './Sidebar';
import RuleList from './RuleList';
import AddRuleModal from './AddRuleModal';
import Toast from './Toast';

const TABS = [
  { key: 'all', label: 'ALL RULES' },
  { key: 'proxy', label: 'PROXY' },
  { key: 'tunnel', label: 'TUNNEL' },
];

export default function App() {
  const [rules, setRules] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [modalMode, setModalMode] = useState(null); // null | 'add' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [runningIds, setRunningIds] = useState(new Set());

  useEffect(() => {
    window.tunnelAPI.getConfig().then((cfg) => {
      if (cfg?.rules) setRules(cfg.rules);
    });
  }, []);

  const save = useCallback((next) => {
    setRules(next);
    window.tunnelAPI.saveConfig(next);
  }, []);

  const notify = useCallback((msg, type = 'success') => {
    setToast({ msg, type, key: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Add ──
  const addRule = useCallback((rule) => {
    const id = `${rule.type}-${Date.now()}`;
    const next = [...rules, { ...rule, id }];
    save(next);
    setModalMode(null);
    notify('Rule added');
  }, [rules, save, notify]);

  // ── Edit ──
  const editRule = useCallback((rule) => {
    const next = rules.map((r) => (r.id === rule.id ? { ...rule } : r));
    save(next);
    setModalMode(null);
    setEditTarget(null);
    notify('Rule updated');
  }, [rules, save, notify]);

  const openEdit = useCallback((rule) => {
    setEditTarget(rule);
    setModalMode('edit');
  }, []);

  // ── Duplicate ──
  const duplicateRule = useCallback((rule) => {
    const baseName = rule.name.replace(/\s*\(\d+\)\s*$/, '');
    const existingNames = rules.map((r) => r.name);
    let suffix = 1;
    let newName = `${baseName} (1)`;
    while (existingNames.includes(newName)) {
      suffix++;
      newName = `${baseName} (${suffix})`;
    }
    const id = `${rule.type}-${Date.now()}`;
    const { id: _old, ...rest } = rule;
    const next = [...rules, { ...rest, id, name: newName }];
    save(next);
    notify(`Duplicated as "${newName}"`);
  }, [rules, save, notify]);

  // ── Delete ──
  const deleteRule = useCallback((id) => {
    const rule = rules.find((r) => r.id === id);
    if (runningIds.has(id)) {
      if (rule?.type === 'proxy') window.tunnelAPI.stopProxy(id);
      else window.tunnelAPI.stopTunnel(id);
    }
    save(rules.filter((r) => r.id !== id));
    setRunningIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    notify('Rule deleted');
  }, [rules, save, notify, runningIds]);

  // ── Start / Stop ──
  const startRule = useCallback(async (rule) => {
    try {
      const res =
        rule.type === 'proxy'
          ? await window.tunnelAPI.startProxy(rule)
          : await window.tunnelAPI.startTunnel(rule);
      if (res.ok) {
        setRunningIds((prev) => new Set(prev).add(rule.id));
        if (res.warning) {
          notify(res.warning, 'warning');
        } else {
          notify(`Started ${rule.name}`);
        }
      } else {
        notify(res.error || 'Failed to start', 'error');
      }
    } catch (e) {
      notify(e.message, 'error');
    }
  }, [notify]);

  const stopRule = useCallback((rule) => {
    if (rule.type === 'proxy') window.tunnelAPI.stopProxy(rule.id);
    else window.tunnelAPI.stopTunnel(rule.id);
    setRunningIds((prev) => {
      const n = new Set(prev);
      n.delete(rule.id);
      return n;
    });
    notify(`Stopped ${rule.name}`);
  }, [notify]);

  const filtered = activeTab === 'all' ? rules : rules.filter((r) => r.type === activeTab);

  return (
    <>
      <Titlebar />
      <div className="app-layout">
        <Sidebar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          ruleCount={rules.length}
          runningCount={runningIds.size}
        />
        <div className="main">
          <div className="main-header">
            <h1>{TABS.find((t) => t.key === activeTab)?.label}</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => { setEditTarget(null); setModalMode('add'); }}>
                + ADD RULE
              </button>
            </div>
          </div>
          <div className="main-content">
            <RuleList
              rules={filtered}
              runningIds={runningIds}
              onStart={startRule}
              onStop={stopRule}
              onEdit={openEdit}
              onDuplicate={duplicateRule}
              onDelete={deleteRule}
            />
          </div>
        </div>
      </div>
      {modalMode && (
        <AddRuleModal
          editRule={modalMode === 'edit' ? editTarget : null}
          onAdd={addRule}
          onEdit={editRule}
          onClose={() => { setModalMode(null); setEditTarget(null); }}
        />
      )}
      {toast && <Toast key={toast.key} msg={toast.msg} type={toast.type} />}
    </>
  );
}
