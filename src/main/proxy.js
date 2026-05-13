const https = require('https');
const http = require('http');
const net = require('net');
const { URL } = require('url');
const fs = require('fs');

class ProxyManager {
  constructor(options = {}) {
    this.servers = new Map(); // id -> { server, rule }
    this.certManager = options.certManager || null;
  }

  async start(rule) {
    if (this.servers.has(rule.id)) this.stop(rule.id);

    const listenUrl = new URL(rule.listen);
    const targetUrl = new URL(rule.target);
    const isHTTPS = listenUrl.protocol === 'https:';
    const targetIsHTTPS = targetUrl.protocol === 'https:';

    const handler = (clientReq, clientRes) => {
      const opts = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetIsHTTPS ? 443 : 80),
        path: clientReq.url,
        method: clientReq.method,
        headers: { ...clientReq.headers, host: targetUrl.host },
        // Allow self-signed certificates on target
        rejectUnauthorized: false,
      };

      const proto = targetIsHTTPS ? https : http;
      const proxyReq = proto.request(opts, (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(clientRes);
      });

      proxyReq.on('error', (e) => {
        const msg = this._formatError(e, targetUrl);
        console.error(`[Proxy ${rule.id}] ${msg}`);
        if (!clientRes.headersSent) clientRes.writeHead(502);
        clientRes.end(msg);
      });

      clientReq.pipe(proxyReq);
    };

    let startupWarning = null;
    let server;
    if (isHTTPS) {
      const { cert, key, warning } = await this._getCert(rule);
      startupWarning = warning;
      server = https.createServer({ cert, key }, handler);
    } else {
      server = http.createServer(handler);
    }

    // Handle CONNECT method for HTTPS tunneling
    server.on('connect', (req, clientSocket, head) => {
      const targetHost = targetUrl.hostname;
      const targetPort = parseInt(targetUrl.port, 10) || (targetIsHTTPS ? 443 : 80);

      const proxySocket = net.connect(targetPort, targetHost, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length > 0) proxySocket.write(head);
        proxySocket.pipe(clientSocket);
        clientSocket.pipe(proxySocket);
      });

      proxySocket.on('error', (e) => {
        console.error(`[Proxy ${rule.id}] CONNECT tunnel error: ${e.message}`);
        clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      });

      clientSocket.on('error', () => proxySocket.destroy());
    });

    // Handle TLS client errors
    server.on('tlsClientError', (e, socket) => {
      console.error(`[Proxy ${rule.id}] TLS client error: ${e.message}`);
      socket.destroy();
    });

    const port = parseInt(listenUrl.port, 10);
    return new Promise((resolve, reject) => {
      server.on('error', (e) => {
        const msg = this._formatServerError(e, port);
        reject(new Error(msg));
      });
      server.listen(port, listenUrl.hostname, () => {
        this.servers.set(rule.id, { server, rule });
        resolve({ warning: startupWarning });
      });
    });
  }

  _formatError(e, targetUrl) {
    if (e.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
        e.code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
        e.code === 'CERT_HAS_EXPIRED') {
      return `TLS certificate error when connecting to ${targetUrl.host}: ${e.message}`;
    }
    if (e.code === 'ECONNREFUSED') {
      return `Connection refused by ${targetUrl.host} — target server may be down`;
    }
    if (e.code === 'ENOTFOUND') {
      return `Cannot resolve hostname: ${targetUrl.hostname}`;
    }
    if (e.code === 'ETIMEDOUT' || e.code === 'ESOCKETTIMEDOUT') {
      return `Connection timed out to ${targetUrl.host}`;
    }
    return `Proxy error: ${e.message}`;
  }

  _formatServerError(e, port) {
    if (e.code === 'EADDRINUSE') {
      return `Port ${port} is already in use — another service may be using it`;
    }
    if (e.code === 'EACCES') {
      return `Permission denied to bind port ${port}`;
    }
    return `Server error: ${e.message}`;
  }

  stop(id) {
    const entry = this.servers.get(id);
    if (entry) {
      entry.server.close();
      this.servers.delete(id);
    }
  }

  status() {
    const result = {};
    for (const [id, { rule }] of this.servers) {
      result[id] = { running: true, rule };
    }
    return result;
  }

  stopAll() {
    for (const id of this.servers.keys()) this.stop(id);
  }

  async _getCert(rule) {
    // If user provided cert/key files
    if (rule.certFile && rule.keyFile) {
      return {
        cert: fs.readFileSync(rule.certFile, 'utf-8'),
        key: fs.readFileSync(rule.keyFile, 'utf-8'),
        warning: null,
      };
    }

    if (!this.certManager) {
      throw new Error('本地 HTTPS 证书管理器未初始化。');
    }

    const status = await this.certManager.status();
    if (!status.exists || !status.valid) {
      throw new Error(status.message || '本地 HTTPS 证书无效，请先在证书管理中生成证书。');
    }

    return {
      ...this.certManager.getDefaultPair(),
      warning: status.trusted
        ? null
        : '证书已生成但尚未被 Windows 当前用户信任，Claude Code / Claude Desktop 可能仍会拒绝连接。',
    };
  }
}

module.exports = ProxyManager;
