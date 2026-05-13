const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { X509Certificate, createPublicKey } = require('crypto');
const selfsigned = require('selfsigned');

let electronShell = null;
try {
  const electron = require('electron');
  electronShell = electron?.shell || null;
} catch {
  electronShell = null;
}

const execFileAsync = promisify(execFile);

function normalizeFingerprint(value) {
  return String(value || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function formatError(error) {
  return [error.message, error.stderr, error.stdout].filter(Boolean).join('\n');
}

class CertificateManager {
  constructor(userDataPath, options = {}) {
    this.userDataPath = userDataPath;
    this.certDir = path.join(userDataPath, 'certs');
    this.certPath = path.join(this.certDir, 'localhost-cert.pem');
    this.keyPath = path.join(this.certDir, 'localhost-key.pem');
    this.execFile = options.execFile || execFileAsync;
    this.shell = options.shell || electronShell;
  }

  async status() {
    const exists = fs.existsSync(this.certPath) && fs.existsSync(this.keyPath);
    if (!exists) {
      return this._statusBase({
        exists: false,
        valid: false,
        trusted: false,
        message: '本地 HTTPS 证书还没有生成，请先在证书管理中生成证书。',
      });
    }

    try {
      const certPem = fs.readFileSync(this.certPath, 'utf8');
      const keyPem = fs.readFileSync(this.keyPath, 'utf8');
      const cert = new X509Certificate(certPem);
      const expired = Date.parse(cert.validTo) <= Date.now();
      const keyMatches = this._keyMatches(cert, keyPem);

      if (!keyMatches) {
        return this._statusBase({
          exists: true,
          valid: false,
          trusted: false,
          subject: cert.subject,
          issuer: cert.issuer,
          notBefore: cert.validFrom,
          notAfter: cert.validTo,
          fingerprint256: cert.fingerprint256,
          fingerprint: cert.fingerprint,
          san: cert.subjectAltName || '',
          expired,
          message: '证书和私钥不匹配，请重新生成或重新导入。',
        });
      }

      const trusted = await this.isTrusted(cert);
      return this._statusBase({
        exists: true,
        valid: !expired,
        trusted,
        subject: cert.subject,
        issuer: cert.issuer,
        notBefore: cert.validFrom,
        notAfter: cert.validTo,
        fingerprint256: cert.fingerprint256,
        fingerprint: cert.fingerprint,
        san: cert.subjectAltName || '',
        expired,
        message: expired ? '本地 HTTPS 证书已经过期，请重新生成证书。' : null,
      });
    } catch (error) {
      return this._statusBase({
        exists: true,
        valid: false,
        trusted: false,
        message: `证书无法读取或格式无效：${error.message}`,
      });
    }
  }

  async generate() {
    ensureDir(this.certDir);
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = await selfsigned.generate(attrs, {
      days: 825,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [
        {
          name: 'basicConstraints',
          cA: true,
          critical: true,
        },
        {
          name: 'keyUsage',
          keyCertSign: true,
          digitalSignature: true,
          keyEncipherment: true,
          cRLSign: true,
          critical: true,
        },
        {
          name: 'extKeyUsage',
          serverAuth: true,
        },
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' },
            { type: 7, ip: '::1' },
          ],
        },
      ],
    });

    fs.writeFileSync(this.certPath, pems.cert, 'utf8');
    fs.writeFileSync(this.keyPath, pems.private, 'utf8');
    return { ok: true, data: await this.status() };
  }

  async trust() {
    const status = await this.status();
    if (!status.exists || !status.valid) {
      return { ok: false, error: status.message || '本地 HTTPS 证书无效，无法导入信任。' };
    }

    try {
      await this.execFile('certutil.exe', ['-user', '-f', '-addstore', 'Root', this.certPath]);
      return {
        ok: true,
        data: await this.status(),
        message: '证书已导入当前用户受信任根证书库，请完全退出并重新打开 Claude Code / Claude Desktop。',
      };
    } catch (error) {
      return { ok: false, error: `certutil 导入失败：${formatError(error)}` };
    }
  }

  async importPair({ certFile, keyFile }) {
    if (!certFile || !keyFile) {
      return { ok: false, error: '请选择证书文件和私钥文件。' };
    }

    ensureDir(this.certDir);
    fs.copyFileSync(certFile, this.certPath);
    fs.copyFileSync(keyFile, this.keyPath);

    const status = await this.status();
    if (!status.valid) {
      return { ok: false, error: status.message, data: status };
    }
    return { ok: true, data: status };
  }

  getDefaultPair() {
    return {
      cert: fs.readFileSync(this.certPath, 'utf8'),
      key: fs.readFileSync(this.keyPath, 'utf8'),
    };
  }

  async openFolder() {
    ensureDir(this.certDir);
    if (this.shell?.openPath) {
      const error = await this.shell.openPath(this.certDir);
      if (error) return { ok: false, error };
    }
    return { ok: true };
  }

  async isTrusted(cert) {
    try {
      const { stdout } = await this.execFile('certutil.exe', ['-user', '-store', 'Root']);
      const target = normalizeFingerprint(cert.fingerprint);
      return normalizeFingerprint(stdout).includes(target);
    } catch {
      return false;
    }
  }

  _keyMatches(cert, keyPem) {
    const certPublicKey = cert.publicKey.export({ type: 'spki', format: 'der' });
    const keyPublicKey = createPublicKey(keyPem).export({ type: 'spki', format: 'der' });
    return certPublicKey.equals(keyPublicKey);
  }

  _statusBase(overrides) {
    return {
      exists: false,
      trusted: false,
      valid: false,
      expired: false,
      subject: null,
      issuer: null,
      notBefore: null,
      notAfter: null,
      fingerprint: null,
      fingerprint256: null,
      san: '',
      certPath: this.certPath,
      keyPath: this.keyPath,
      message: null,
      ...overrides,
    };
  }
}

module.exports = CertificateManager;
