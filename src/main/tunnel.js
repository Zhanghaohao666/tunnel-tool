const { Client } = require('ssh2');
const net = require('net');

class TunnelManager {
  constructor() {
    this.tunnels = new Map(); // id -> { ssh, server, rule }
  }

  async start(rule) {
    if (this.tunnels.has(rule.id)) this.stop(rule.id);

    const ssh = new Client();
    let started = false; // track whether the tunnel resolved

    const authConfig = {
      host: rule.server,
      port: rule.port || 22,
      username: rule.user,
    };

    if (rule.authType === 'password') {
      authConfig.password = rule.password;
    } else if (rule.authType === 'key') {
      const fs = require('fs');
      authConfig.privateKey = fs.readFileSync(rule.keyFile, 'utf-8');
      if (rule.keyPassphrase) {
        authConfig.passphrase = rule.keyPassphrase;
      }
    }

    return new Promise((resolve, reject) => {
      ssh.on('ready', () => {
        started = true;
        // Create local server that forwards to remote
        const server = net.createServer((localSocket) => {
          localSocket.on('error', (e) => {
            console.error(`[Tunnel ${rule.id}] local socket error: ${e.message}`);
            localSocket.destroy();
          });

          ssh.forwardOut(
            '127.0.0.1',
            localSocket.remotePort,
            rule.remoteHost || '127.0.0.1',
            rule.remotePort,
            (err, stream) => {
              if (err) {
                console.error(`[Tunnel ${rule.id}] forward error: ${err.message}`);
                localSocket.destroy();
                return;
              }

              stream.on('error', (e) => {
                console.error(`[Tunnel ${rule.id}] remote stream error: ${e.message}`);
                stream.close();
                localSocket.destroy();
              });

              localSocket.pipe(stream);
              stream.pipe(localSocket);
              stream.on('close', () => localSocket.destroy());
              localSocket.on('close', () => stream.close());
            }
          );
        });

        server.on('error', (e) => {
          console.error(`[Tunnel ${rule.id}] server error: ${e.message}`);
        });

        server.listen(rule.localPort, '127.0.0.1', () => {
          this.tunnels.set(rule.id, { ssh, server, rule });
          resolve();
        });

        server.on('error', reject);
      });

      ssh.on('error', (e) => {
        if (!started) {
          console.error(`[Tunnel ${rule.id}] SSH connect error: ${e.message}`);
          reject(e);
        } else {
          // Connection dropped after successful start — just log, don't crash
          console.error(`[Tunnel ${rule.id}] SSH runtime error: ${e.message}`);
        }
      });

      ssh.connect(authConfig);
    });
  }

  stop(id) {
    const entry = this.tunnels.get(id);
    if (entry) {
      entry.server.close();
      entry.ssh.end();
      this.tunnels.delete(id);
    }
  }

  status() {
    const result = {};
    for (const [id, { rule }] of this.tunnels) {
      result[id] = { running: true, rule };
    }
    return result;
  }

  stopAll() {
    for (const id of this.tunnels.keys()) this.stop(id);
  }
}

module.exports = TunnelManager;
