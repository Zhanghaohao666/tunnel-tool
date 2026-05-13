const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { X509Certificate } = require('node:crypto');

const CertificateManager = require('../src/main/certManager');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tunnel-tool-cert-test-'));
}

test('status reports missing default certificate pair', async () => {
  const manager = new CertificateManager(makeTempDir());
  const status = await manager.status();

  assert.equal(status.exists, false);
  assert.equal(status.valid, false);
  assert.equal(status.trusted, false);
  assert.match(status.certPath, /localhost-cert\.pem$/);
  assert.match(status.keyPath, /localhost-key\.pem$/);
  assert.equal(status.message, '本地 HTTPS 证书还没有生成，请先在证书管理中生成证书。');
});

test('generate creates a localhost certificate with required SAN entries', async () => {
  const manager = new CertificateManager(makeTempDir(), {
    execFile: async () => ({ stdout: '', stderr: '' }),
  });

  const result = await manager.generate();
  assert.equal(result.ok, true);

  const status = await manager.status();
  assert.equal(status.exists, true);
  assert.equal(status.valid, true);
  assert.equal(status.expired, false);
  assert.equal(status.subject, 'CN=localhost');
  assert.equal(status.san.includes('DNS:localhost'), true);
  assert.match(status.san, /IP Address[:=]127\.0\.0\.1/);
  assert.match(status.san, /IP Address[:=](::1|0:0:0:0:0:0:0:1|0000:0000:0000:0000:0000:0000:0000:0001)/);

  const cert = new X509Certificate(fs.readFileSync(status.certPath));
  assert.equal(cert.subject, 'CN=localhost');
});

test('status marks mismatched certificate and key as invalid', async () => {
  const dir = makeTempDir();
  const first = new CertificateManager(path.join(dir, 'first'));
  const second = new CertificateManager(path.join(dir, 'second'));
  await first.generate();
  await second.generate();

  fs.copyFileSync(first.certPath, second.certPath);
  const status = await second.status();

  assert.equal(status.exists, true);
  assert.equal(status.valid, false);
  assert.equal(status.message, '证书和私钥不匹配，请重新生成或重新导入。');
});

test('trust imports the current certificate into the CurrentUser root store', async () => {
  const calls = [];
  const manager = new CertificateManager(makeTempDir(), {
    execFile: async (file, args) => {
      calls.push([file, args]);
      return { stdout: 'CertUtil: -addstore 命令成功完成。', stderr: '' };
    },
  });

  await manager.generate();
  const result = await manager.trust();

  assert.equal(result.ok, true);
  assert.equal(calls.length >= 1, true);
  const addstoreCall = calls.find(([file, args]) => file === 'certutil.exe' && args.includes('-addstore'));
  assert.ok(addstoreCall);
  assert.deepEqual(addstoreCall[1].slice(0, 4), ['-user', '-f', '-addstore', 'Root']);
  assert.equal(addstoreCall[1][4], manager.certPath);
});

test('importPair copies provided files into the managed certificate directory', async () => {
  const source = new CertificateManager(makeTempDir());
  await source.generate();

  const target = new CertificateManager(makeTempDir());
  const result = await target.importPair({ certFile: source.certPath, keyFile: source.keyPath });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(target.certPath), true);
  assert.equal(fs.existsSync(target.keyPath), true);

  const status = await target.status();
  assert.equal(status.exists, true);
  assert.equal(status.valid, true);
});

test('getDefaultPair reads the managed certificate pair after generation', async () => {
  const manager = new CertificateManager(makeTempDir());
  await manager.generate();

  const pair = manager.getDefaultPair();

  assert.match(pair.cert, /BEGIN CERTIFICATE/);
  assert.match(pair.key, /BEGIN RSA PRIVATE KEY|BEGIN PRIVATE KEY/);
});
