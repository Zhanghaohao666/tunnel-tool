# Tunnel Tool

Windows desktop tool for local protocol forwarding, local HTTPS gateway conversion, and SSH tunnels.

Language: [中文](#中文) | [English](#english)

---

## 中文

### 简介

Tunnel Tool 是一个 Windows 桌面端口转发工具，基于 Electron + React 构建。它适合把本地 HTTPS 请求转发到远程 HTTP/HTTPS 服务，也适合通过 SSH 把远程端口映射到本地。

典型场景：

```text
Claude Code / Claude Desktop
-> https://localhost:15722
-> http://203.0.113.10:1234
```

### 功能

- 协议转换代理：支持 `HTTPS -> HTTP`、`HTTPS -> HTTPS`、`HTTP -> HTTP`、`HTTP -> HTTPS`
- 本地 HTTPS 证书管理：生成、导入、信任 localhost 证书，解决 Claude Code / Claude Desktop 连接本地 HTTPS 的证书问题
- SSH 隧道：支持密码认证和密钥文件认证
- 规则管理：添加、编辑、复制、启动、停止、删除规则
- 配置持久化：关闭应用后规则自动保存
- Windows 打包：支持 NSIS 安装包和便携版 exe

### 下载与安装

如果你已经有打包产物：

- `Tunnel Tool Setup 1.0.0.exe`：NSIS 安装包，双击后按安装向导安装
- `Tunnel Tool 1.0.0.exe`：便携版，双击即可运行

如果从源码运行：

```powershell
git clone https://github.com/Zhanghaohao666/tunnel-tool.git
cd tunnel-tool
npm install
npm start
```

### 使用：Claude Code / Claude Desktop 本地 HTTPS 转发

1. 点击 `+ ADD RULE`
2. 类型选择 `PROXY`
3. 填写规则：

```text
Name: Claude Gateway
Listen: HTTPS localhost:15722
Target: HTTP 203.0.113.10:1234
```

4. 如果 Listen 选择了 `HTTPS`，表单里会出现 `LOCAL HTTPS CERTIFICATE`
5. 第一次使用时点击 `GENERATE`
6. 再点击 `TRUST CERTIFICATE`
7. 完全退出并重新打开 Claude Code / Claude Desktop
8. 点击 `ADD RULE`
9. 在规则列表里点击 `START`
10. Claude Code / Claude Desktop 的 Gateway base URL 填：

```text
https://localhost:15722
```

### 本地 HTTPS 证书按钮说明

`REFRESH`：重新读取证书状态。

`GENERATE`：生成新的本机 localhost 证书和私钥。首次使用或证书过期/损坏时使用。

`TRUST CERTIFICATE`：把当前证书导入 Windows 当前用户的受信任根证书库。导入成功后需要完全重启 Claude Code / Claude Desktop。

`IMPORT CERT/KEY`：导入你已有的证书和私钥，不生成新证书。需要先选择证书文件，再选择私钥文件。

`OPEN FOLDER`：打开证书保存目录。

证书默认保存位置：

```text
%APPDATA%/tunnel-tool/certs/localhost-cert.pem
%APPDATA%/tunnel-tool/certs/localhost-key.pem
```

验证证书是否已经被系统信任：

```powershell
curl.exe --max-time 10 https://localhost:15722/v1/models
```

如果不再出现 `SEC_E_UNTRUSTED_ROOT`，而是返回 `401`、未提供令牌、上游错误或模型列表，说明 TLS 证书信任已经通过。

### 使用：SSH 隧道

1. 点击 `+ ADD RULE`
2. 类型选择 `TUNNEL`
3. 填写：

```text
Server: 203.0.113.10
SSH Port: 22
Username: root
Authentication: PASSWORD 或 KEY FILE
Local Port: 3306
Remote Host: 127.0.0.1
Remote Port: 3306
```

4. 点击 `ADD RULE`
5. 在规则列表里点击 `START`
6. 本地连接 `127.0.0.1:3306`

### 开发命令

```powershell
npm install
npm start
npm run build
npm test
```

### 打包 Windows 版本

生成 NSIS 安装包：

```powershell
npm run pack
```

同时生成 NSIS 安装包和便携版：

```powershell
npm run build
npx electron-builder --win nsis portable
```

产物在 `dist` 目录：

```text
dist/Tunnel Tool Setup 1.0.0.exe
dist/Tunnel Tool 1.0.0.exe
```

### 配置文件位置

规则配置：

```text
%APPDATA%/tunnel-tool/tunnel-config.json
```

证书文件：

```text
%APPDATA%/tunnel-tool/certs/
```

### 技术栈

- Electron 33
- React 18
- Webpack 5
- Node.js http/https/net
- ssh2
- selfsigned
- electron-builder

### 贡献者

- Zhanghaohao666

### 许可证

MIT

---

## English

### Overview

Tunnel Tool is a Windows desktop forwarding utility built with Electron and React. It can expose a local HTTP/HTTPS proxy, convert a local HTTPS gateway to an upstream HTTP/HTTPS API, and create SSH tunnels for remote ports.

Typical use case:

```text
Claude Code / Claude Desktop
-> https://localhost:15722
-> http://203.0.113.10:1234
```

### Features

- Protocol conversion proxy: `HTTPS -> HTTP`, `HTTPS -> HTTPS`, `HTTP -> HTTP`, `HTTP -> HTTPS`
- Local HTTPS certificate management: generate, import, trust, and inspect localhost certificates
- Fixes local HTTPS certificate trust issues for Claude Code / Claude Desktop
- SSH tunnels with password or key-file authentication
- Rule management: add, edit, duplicate, start, stop, and delete rules
- Persistent local configuration
- Windows packaging: NSIS installer and portable exe

### Install

If you already have release artifacts:

- `Tunnel Tool Setup 1.0.0.exe`: NSIS installer
- `Tunnel Tool 1.0.0.exe`: portable executable

Run from source:

```powershell
git clone https://github.com/Zhanghaohao666/tunnel-tool.git
cd tunnel-tool
npm install
npm start
```

### Usage: Claude Code / Claude Desktop HTTPS Gateway

1. Click `+ ADD RULE`
2. Select `PROXY`
3. Fill in:

```text
Name: Claude Gateway
Listen: HTTPS localhost:15722
Target: HTTP 203.0.113.10:1234
```

4. When Listen is `HTTPS`, the `LOCAL HTTPS CERTIFICATE` panel appears
5. Click `GENERATE` on first use
6. Click `TRUST CERTIFICATE`
7. Fully quit and reopen Claude Code / Claude Desktop
8. Click `ADD RULE`
9. Click `START` in the rule list
10. Use this Gateway base URL:

```text
https://localhost:15722
```

### Local HTTPS Certificate Buttons

`REFRESH`: reload the current certificate status.

`GENERATE`: create a new local localhost certificate and private key.

`TRUST CERTIFICATE`: import the current certificate into the Windows Current User trusted root store. Restart Claude Code / Claude Desktop after this.

`IMPORT CERT/KEY`: import an existing certificate and private key instead of generating a new pair.

`OPEN FOLDER`: open the certificate directory.

Default certificate paths:

```text
%APPDATA%/tunnel-tool/certs/localhost-cert.pem
%APPDATA%/tunnel-tool/certs/localhost-key.pem
```

Verify local TLS trust:

```powershell
curl.exe --max-time 10 https://localhost:15722/v1/models
```

If `SEC_E_UNTRUSTED_ROOT` no longer appears, TLS trust is working. A `401`, missing-token error, upstream error, or model list means the local HTTPS certificate was accepted.

### Usage: SSH Tunnel

1. Click `+ ADD RULE`
2. Select `TUNNEL`
3. Fill in:

```text
Server: 203.0.113.10
SSH Port: 22
Username: root
Authentication: PASSWORD or KEY FILE
Local Port: 3306
Remote Host: 127.0.0.1
Remote Port: 3306
```

4. Click `ADD RULE`
5. Click `START` in the rule list
6. Connect to `127.0.0.1:3306` locally

### Development

```powershell
npm install
npm start
npm run build
npm test
```

### Build Windows Packages

Build the NSIS installer:

```powershell
npm run pack
```

Build both NSIS and portable targets:

```powershell
npm run build
npx electron-builder --win nsis portable
```

Artifacts are written to `dist`:

```text
dist/Tunnel Tool Setup 1.0.0.exe
dist/Tunnel Tool 1.0.0.exe
```

### Config Paths

Rules:

```text
%APPDATA%/tunnel-tool/tunnel-config.json
```

Certificates:

```text
%APPDATA%/tunnel-tool/certs/
```

### Tech Stack

- Electron 33
- React 18
- Webpack 5
- Node.js http/https/net
- ssh2
- selfsigned
- electron-builder

### Contributor

- Zhanghaohao666

### License

MIT
