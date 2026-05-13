import React, { useState, useEffect } from 'react';

function parseListen(str) {
  try {
    const u = new URL(str);
    return { proto: u.protocol.replace(':', ''), addr: u.host };
  } catch {
    return { proto: 'https', addr: 'localhost:15722' };
  }
}

function parseTarget(str) {
  try {
    const u = new URL(str);
    return { proto: u.protocol.replace(':', ''), addr: u.host };
  } catch {
    return { proto: 'http', addr: 'localhost:8080' };
  }
}

function certificateLabel(status) {
  if (!status?.exists) return 'Not generated';
  if (!status.valid) return 'Invalid';
  if (!status.trusted) return 'Generated, not trusted';
  return 'Trusted';
}

function certificateStatusClass(status) {
  if (!status?.exists) return 'muted';
  if (!status.valid) return 'error';
  if (!status.trusted) return 'warning';
  return 'success';
}

function shortFingerprint(value) {
  if (!value) return 'N/A';
  return value.split(':').slice(0, 8).join(':');
}

export default function AddRuleModal({ onAdd, onEdit, onClose, editRule }) {
  const isEdit = !!editRule;

  const [type, setType] = useState(editRule?.type || 'proxy');
  const [name, setName] = useState(editRule?.name || '');

  // Proxy fields
  const listenParsed = editRule?.listen ? parseListen(editRule.listen) : null;
  const targetParsed = editRule?.target ? parseTarget(editRule.target) : null;
  const [listenProto, setListenProto] = useState(listenParsed?.proto || 'https');
  const [listenAddr, setListenAddr] = useState(listenParsed?.addr || 'localhost:15722');
  const [targetProto, setTargetProto] = useState(targetParsed?.proto || 'http');
  const [targetAddr, setTargetAddr] = useState(targetParsed?.addr || '203.0.113.10:1234');
  const [certStatus, setCertStatus] = useState(null);
  const [certBusy, setCertBusy] = useState(false);
  const [certMessage, setCertMessage] = useState(null);

  const refreshCertStatus = async () => {
    if (!window.tunnelAPI?.certStatus) return;
    const status = await window.tunnelAPI.certStatus();
    setCertStatus(status);
  };

  useEffect(() => {
    if (type === 'proxy' && listenProto === 'https') {
      refreshCertStatus();
    }
  }, [type, listenProto]);

  // Tunnel fields
  const [server, setServer] = useState(editRule?.server || '203.0.113.10');
  const [sshPort, setSshPort] = useState(String(editRule?.port || 22));
  const [user, setUser] = useState(editRule?.user || 'root');
  const [authType, setAuthType] = useState(editRule?.authType || 'password');
  const [password, setPassword] = useState(editRule?.password || '');
  const [keyFile, setKeyFile] = useState(editRule?.keyFile || '');
  const [remotePort, setRemotePort] = useState(String(editRule?.remotePort || '8080'));
  const [remoteHost, setRemoteHost] = useState(editRule?.remoteHost || '127.0.0.1');
  const [localPort, setLocalPort] = useState(String(editRule?.localPort || '8080'));

  const pickKeyFile = async () => {
    const file = await window.tunnelAPI.openFile({
      filters: [{ name: 'Key Files', extensions: ['pem', 'key', 'ppk', '*'] }],
    });
    if (file) setKeyFile(file);
  };

  const runCertAction = async (action, successMessage) => {
    setCertBusy(true);
    setCertMessage(null);
    try {
      const result = await action();
      if (result?.ok === false) {
        setCertMessage({ type: 'error', text: result.error || 'Certificate operation failed' });
      } else {
        setCertMessage({ type: 'success', text: result?.message || successMessage });
      }
      await refreshCertStatus();
    } catch (error) {
      setCertMessage({ type: 'error', text: error.message });
    } finally {
      setCertBusy(false);
    }
  };

  const generateCertificate = () => {
    runCertAction(
      () => window.tunnelAPI.generateCertificate(),
      'Certificate generated',
    );
  };

  const trustCertificate = () => {
    runCertAction(
      () => window.tunnelAPI.trustCertificate(),
      'Certificate trusted. Restart Claude Code / Claude Desktop before retrying.',
    );
  };

  const importCertificatePair = async () => {
    const certFile = await window.tunnelAPI.openFile({
      filters: [{ name: 'Certificate', extensions: ['pem', 'crt', 'cer'] }],
    });
    if (!certFile) return;

    const keyFile = await window.tunnelAPI.openFile({
      filters: [{ name: 'Private Key', extensions: ['pem', 'key'] }],
    });
    if (!keyFile) return;

    runCertAction(
      () => window.tunnelAPI.importCertificatePair({ certFile, keyFile }),
      'Certificate imported',
    );
  };

  const openCertificateFolder = () => {
    runCertAction(
      () => window.tunnelAPI.openCertificateFolder(),
      'Certificate folder opened',
    );
  };

  const buildRule = () => {
    if (type === 'proxy') {
      return {
        name: name.trim(),
        type: 'proxy',
        listen: `${listenProto}://${listenAddr}`,
        target: `${targetProto}://${targetAddr}`,
      };
    }
    return {
      name: name.trim(),
      type: 'tunnel',
      server,
      port: parseInt(sshPort, 10),
      user,
      authType,
      password: authType === 'password' ? password : undefined,
      keyFile: authType === 'key' ? keyFile : undefined,
      remoteHost,
      remotePort: parseInt(remotePort, 10),
      localPort: parseInt(localPort, 10),
    };
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const rule = buildRule();
    if (isEdit) {
      onEdit({ ...rule, id: editRule.id });
    } else {
      onAdd(rule);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Edit Rule' : 'Add Rule'}</h2>

        <div className="form-group">
          <label className="form-label">RULE TYPE</label>
          <div className="toggle-group">
            <div
              className={`toggle-item${type === 'proxy' ? ' active' : ''}`}
              onClick={() => { if (!isEdit) setType('proxy'); }}
              style={isEdit ? { opacity: 0.6, cursor: 'default' } : {}}
            >
              PROXY
            </div>
            <div
              className={`toggle-item${type === 'tunnel' ? ' active' : ''}`}
              onClick={() => { if (!isEdit) setType('tunnel'); }}
              style={isEdit ? { opacity: 0.6, cursor: 'default' } : {}}
            >
              TUNNEL
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">NAME</label>
          <input
            className="form-input"
            placeholder="My Rule"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="divider" />

        {type === 'proxy' ? (
          <>
            <div className="form-group">
              <label className="form-label">LISTEN</label>
              <div className="form-row">
                <div className="form-group" style={{ flex: '0 0 120px' }}>
                  <select
                    className="form-select"
                    value={listenProto}
                    onChange={(e) => setListenProto(e.target.value)}
                  >
                    <option value="https">HTTPS</option>
                    <option value="http">HTTP</option>
                  </select>
                </div>
                <div className="form-group">
                  <input
                    className="form-input mono"
                    placeholder="localhost:15722"
                    value={listenAddr}
                    onChange={(e) => setListenAddr(e.target.value)}
                  />
                </div>
              </div>
            </div>
            {listenProto === 'https' && (
              <div className="cert-panel">
                <div className="cert-panel-header">
                  <div>
                    <div className="cert-title">LOCAL HTTPS CERTIFICATE</div>
                    <div className={`cert-status ${certificateStatusClass(certStatus)}`}>
                      {certificateLabel(certStatus)}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={refreshCertStatus}
                    disabled={certBusy}
                  >
                    REFRESH
                  </button>
                </div>

                <div className="cert-meta">
                  <div>
                    <span>Subject</span>
                    <strong>{certStatus?.subject || 'N/A'}</strong>
                  </div>
                  <div>
                    <span>Expires</span>
                    <strong>{certStatus?.notAfter || 'N/A'}</strong>
                  </div>
                  <div>
                    <span>Fingerprint</span>
                    <strong>{shortFingerprint(certStatus?.fingerprint256)}</strong>
                  </div>
                </div>

                {certStatus?.message && (
                  <div className="cert-message warning">{certStatus.message}</div>
                )}
                {certMessage && (
                  <div className={`cert-message ${certMessage.type}`}>{certMessage.text}</div>
                )}

                <div className="cert-actions">
                  <button className="btn btn-sm btn-primary" type="button" onClick={generateCertificate} disabled={certBusy}>
                    GENERATE
                  </button>
                  <button className="btn btn-sm" type="button" onClick={trustCertificate} disabled={certBusy || !certStatus?.valid}>
                    TRUST CERTIFICATE
                  </button>
                  <button className="btn btn-sm" type="button" onClick={importCertificatePair} disabled={certBusy}>
                    IMPORT CERT/KEY
                  </button>
                  <button className="btn btn-sm" type="button" onClick={openCertificateFolder} disabled={certBusy}>
                    OPEN FOLDER
                  </button>
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">TARGET</label>
              <div className="form-row">
                <div className="form-group" style={{ flex: '0 0 120px' }}>
                  <select
                    className="form-select"
                    value={targetProto}
                    onChange={(e) => setTargetProto(e.target.value)}
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                </div>
                <div className="form-group">
                  <input
                    className="form-input mono"
                    placeholder="203.0.113.10:1234"
                    value={targetAddr}
                    onChange={(e) => setTargetAddr(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">SERVER</label>
                <input
                  className="form-input mono"
                  placeholder="203.0.113.10"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: '0 0 100px' }}>
                <label className="form-label">SSH PORT</label>
                <input
                  className="form-input mono"
                  placeholder="22"
                  value={sshPort}
                  onChange={(e) => setSshPort(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">USERNAME</label>
              <input
                className="form-input mono"
                placeholder="root"
                value={user}
                onChange={(e) => setUser(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">AUTHENTICATION</label>
              <div className="toggle-group">
                <div
                  className={`toggle-item${authType === 'password' ? ' active' : ''}`}
                  onClick={() => setAuthType('password')}
                >
                  PASSWORD
                </div>
                <div
                  className={`toggle-item${authType === 'key' ? ' active' : ''}`}
                  onClick={() => setAuthType('key')}
                >
                  KEY FILE
                </div>
              </div>
            </div>
            {authType === 'password' ? (
              <div className="form-group">
                <label className="form-label">PASSWORD</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">KEY FILE</label>
                <div className="form-row">
                  <input
                    className="form-input mono"
                    placeholder="No file selected"
                    value={keyFile}
                    readOnly
                  />
                  <button className="btn btn-sm" onClick={pickKeyFile} style={{ whiteSpace: 'nowrap' }}>
                    BROWSE
                  </button>
                </div>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">LOCAL PORT</label>
                <input
                  className="form-input mono"
                  placeholder="8080"
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: '0 0 200px' }}>
                <label className="form-label">REMOTE HOST</label>
                <input
                  className="form-input mono"
                  placeholder="127.0.0.1"
                  value={remoteHost}
                  onChange={(e) => setRemoteHost(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">REMOTE PORT</label>
                <input
                  className="form-input mono"
                  placeholder="8080"
                  value={remotePort}
                  onChange={(e) => setRemotePort(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>CANCEL</button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {isEdit ? 'SAVE' : 'ADD RULE'}
          </button>
        </div>
      </div>
    </div>
  );
}
