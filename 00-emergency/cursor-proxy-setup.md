# Cursor / VSCode 代理配置完整指南

> 适用环境：Windows 10 + Clash Verge (mihomo 内核) + Cursor (Electron)
>
> 前置知识：不需要。本文从 Cursor 为什么会网络异常讲起。

---

## 目录

1. [Cursor 的网络架构](#1-cursor-的网络架构)
2. [方案一：TUN 模式（推荐）](#2-方案一tun-模式推荐)
3. [方案二：系统代理 + Cursor 设置](#3-方案二系统代理--cursor-设置)
4. [方案三：环境变量（针对终端内工具）](#4-方案三环境变量针对终端内工具)
5. [常见报错及修复](#5-常见报错及修复)
6. [验证清单](#6-验证清单)

---

## 1. Cursor 的网络架构

Cursor 本质是 VSCode 的 fork，而 VSCode 基于 **Electron**，Electron 又基于 **Chromium + Node.js**。理解这个架构是理解代理问题的关键。

### Electron 的双进程模型

```
┌──────────────────────────────────────────────────┐
│                  Cursor 进程                       │
│                                                    │
│  ┌──────────────┐     ┌────────────────────────┐  │
│  │ Main Process │     │  Renderer Process(es)  │  │
│  │  (Node.js)   │     │    (Chromium)           │  │
│  │              │     │                        │  │
│  │ - 插件宿主    │     │ - UI 渲染              │  │
│  │ - 文件操作    │     │ - Webview              │  │
│  │ - Git 操作    │     │ - AI Chat 面板         │  │
│  │ - Terminal    │     │                        │  │
│  └──────┬───────┘     └──────────┬─────────────┘  │
│         │                        │                  │
│    uses Node.js            uses Chromium            │
│    net stack               net stack                │
└─────────┼────────────────────────┼──────────────────┘
          │                        │
          ▼                        ▼
   独立的代理逻辑            Chromium 代理解析链
```

**Renderer Process（Chromium）** 的代理解析链：

1. `--proxy-server` 命令行参数 → 最高优先级
2. PAC (Proxy Auto-Config) 文件
3. 操作系统的系统代理设置（Windows: Internet Options / WinHTTP）
4. 直连

**Main Process（Node.js）** 的代理行为：

- Node.js 的 `http`/`https` 模块 **默认不读系统代理**
- 需要显式设置 `HTTP_PROXY` / `HTTPS_PROXY` 环境变量，或在代码里手动使用 proxy agent
- VSCode/Cursor 自己实现了一层代理逻辑，读取 `settings.json` 中的 `http.proxy` 字段

### 为什么 Cursor 经常出代理问题

三个进程/场景，三套不同的代理机制：

| 场景 | 网络栈 | 代理来源 |
|------|--------|----------|
| AI Chat / Copilot 请求 | Chromium 或 Node.js（取决于实现） | `settings.json` 的 `http.proxy` 或系统代理 |
| 插件市场 / 更新检查 | Node.js (main process) | `settings.json` 的 `http.proxy` |
| 集成终端内的 git / npm | 子进程继承的环境变量 | `HTTP_PROXY` 环境变量 |

**结论**：没有一个单一配置能覆盖所有场景——除非你在网络层面就把流量全部接管。这就是 TUN 模式存在的意义。

---

## 2. 方案一：TUN 模式（推荐）

### TUN 是什么

TUN (network **TUN**nel) 是一个虚拟网卡设备。启用 TUN 模式后，Clash 会在操作系统层面创建一个虚拟网络适配器，修改系统路由表，让 **所有 IP 层流量**（不只是 HTTP）都经过 Clash 内核处理。

```
普通系统代理模式：
  App → 检查系统代理设置 → 有些 App 忽略 → 流量泄漏/直连失败

TUN 模式：
  App → 操作系统网络栈 → 路由表指向 TUN 虚拟网卡
      → Clash 内核接管 → 按规则分流 → 代理/直连
```

关键区别：系统代理是"请求"应用去使用代理（应用可以不听），TUN 模式是在操作系统层面"劫持"所有流量（应用无法绑定）。

### 为什么 TUN 是 Cursor 的最优解

- **零配置**：不需要改 Cursor 的 `settings.json`，不需要设环境变量
- **全覆盖**：Main Process、Renderer Process、集成终端、子进程——全部走代理
- **透明代理**：应用甚至不知道自己在走代理，不会有 proxy 协议兼容问题
- 唯一的代价：需要管理员权限安装 Service Mode

### 在 Clash Verge 中启用 TUN

**第一步：安装 Service Mode（仅需一次）**

TUN 模式需要修改系统路由表，这要求管理员权限。Clash Verge 通过一个后台服务来实现：

1. 打开 Clash Verge → 设置（齿轮图标）
2. 找到 "Service Mode" / "服务模式"
3. 点击安装 → 弹出 UAC 对话框 → 确认
4. 安装成功后旁边的图标会变绿

**第二步：启用 TUN 模式**

1. Clash Verge 主界面 → 找到 "TUN Mode" / "TUN 模式" 开关
2. 打开开关
3. 检查系统托盘图标，确认 TUN 已激活
4. 打开 Windows 设置 → 网络适配器，应该能看到一个新的虚拟网卡（名称类似 `Meta` 或 `Clash`）

**第三步：验证 TUN 生效**

打开 PowerShell：

```powershell
# 不指定任何代理，直接请求——如果 TUN 工作正常，这应该成功
curl.exe https://www.google.com -I

# 检查能否到达 OpenAI API（Cursor 用的后端）
curl.exe https://api.openai.com -I

# 查看路由表，确认默认路由指向 TUN 虚拟网卡
route print 0.0.0.0
```

如果 `curl.exe https://www.google.com -I` 返回 `HTTP/2 200`（或 301/302），说明 TUN 工作正常。

### TUN 模式的注意事项

- **DNS**：TUN 模式下 Clash 会接管 DNS 解析。确保 Clash 配置中 DNS 部分正确。推荐使用 `fake-ip` 模式（详见 [DNS 策略](../03-clash-mastery/dns-strategy.md)）。
- **性能**：TUN 模式多了一层用户态网络栈处理，对延迟有微量（< 1ms）影响，正常使用感知不到。
- **冲突**：如果你同时运行了其他 VPN 软件（如 WireGuard、OpenVPN），可能会路由冲突。同时只开一个。
- **游戏/UDP**：TUN 模式支持 UDP，所以游戏加速也能走。系统代理模式做不到。

---

## 3. 方案二：系统代理 + Cursor 设置

如果你不想或不能用 TUN（比如 Service Mode 安装失败），可以手动配置。代价是你需要在多个地方设置代理。

### 3.1 确认 Clash Verge 的代理端口

打开 Clash Verge → 设置 → 找到以下信息：

- **Mixed Port**（混合端口）：默认通常是 `7897`（不同版本可能不同，以你的实际为准）
- 混合端口同时支持 HTTP 和 SOCKS5 协议

你的代理地址就是：
- HTTP 代理: `http://127.0.0.1:7897`
- SOCKS5 代理: `socks5://127.0.0.1:7897`

### 3.2 开启 Clash Verge 系统代理

Clash Verge 主界面 → 打开 "System Proxy" / "系统代理" 开关。

这会修改 Windows 的 Internet Options 代理设置。Chromium 进程（Cursor 的 Renderer）会读取这个设置。

### 3.3 配置 Cursor 的 settings.json

打开 Cursor → `Ctrl + Shift + P` → 输入 `Preferences: Open User Settings (JSON)`

添加以下配置：

```jsonc
{
  // Cursor/VSCode 的内置代理设置
  // 这会影响 Main Process 的 Node.js 请求（插件市场、更新检查、AI 功能）
  "http.proxy": "http://127.0.0.1:7897",

  // 是否严格验证 SSL 证书
  // 默认 true。如果你遇到 UNABLE_TO_VERIFY_LEAF_SIGNATURE 错误，可以设为 false
  "http.proxyStrictSSL": true,

  // 代理授权（如果你的代理需要用户名密码，通常 Clash 不需要）
  // "http.proxyAuthorization": null,

  // 是否对插件也使用代理
  "http.proxySupport": "override"
}
```

**settings.json 文件路径**（Windows）：

```
%APPDATA%\Cursor\User\settings.json
```

展开就是：

```
C:\Users\<你的用户名>\AppData\Roaming\Cursor\User\settings.json
```

### 3.4 关于 `http.proxyStrictSSL`

**默认应该保持 `true`**。只有在你遇到 TLS 证书验证错误时才考虑改为 `false`。

改为 `false` 意味着什么：
- Cursor 的 Node.js 进程在通过代理发 HTTPS 请求时，不会验证服务器证书的完整信任链
- 安全影响：理论上中间人攻击可以拦截你的请求（但你已经在用代理了，Clash 本身就是个"善意的中间人"）
- 如果你只是在本地开发环境使用，风险可控

**更干净的解法**：如果 Clash 的 TLS 行为导致证书问题，检查 Clash 配置中是否误开了 MITM（中间人）功能。正常的 CONNECT 隧道代理不应该破坏 TLS 证书链。

### 3.5 集成终端的代理

Cursor 的 `http.proxy` 只影响 Cursor 自身的请求，**不会传递给集成终端里的命令**。终端里的 git、npm、curl 等工具需要通过环境变量获取代理信息。

在 `settings.json` 中配置终端环境变量：

```jsonc
{
  "terminal.integrated.env.windows": {
    "HTTP_PROXY": "http://127.0.0.1:7897",
    "HTTPS_PROXY": "http://127.0.0.1:7897",
    "ALL_PROXY": "http://127.0.0.1:7897",
    "NO_PROXY": "localhost,127.0.0.1,::1,10.*,192.168.*"
  }
}
```

> `NO_PROXY` 指定不走代理的地址。本地地址和内网地址应该排除，否则本地开发服务器（localhost:3000）之类的也会试图走代理。

设置后**需要重启终端**（关掉现有终端 tab，新开一个），新终端才会继承这些环境变量。

---

## 4. 方案三：环境变量（针对终端内工具）

即使用了 TUN 模式，有些工具在特定场景下可能需要显式的代理配置（比如 Docker daemon）。这里列出常见工具的代理设置方式。

### 4.1 PowerShell 环境变量

**临时设置（当前会话）**：

```powershell
$env:HTTP_PROXY = "http://127.0.0.1:7897"
$env:HTTPS_PROXY = "http://127.0.0.1:7897"
$env:ALL_PROXY = "http://127.0.0.1:7897"
$env:NO_PROXY = "localhost,127.0.0.1"
```

**永久设置（用户级环境变量）**：

```powershell
[System.Environment]::SetEnvironmentVariable("HTTP_PROXY", "http://127.0.0.1:7897", "User")
[System.Environment]::SetEnvironmentVariable("HTTPS_PROXY", "http://127.0.0.1:7897", "User")
```

> ⚠️ 永久设置环境变量意味着 **关掉 Clash 后所有使用这些环境变量的工具都会报连接失败**。推荐只做临时设置，或者写一个快速切换脚本。

**快速切换脚本**（保存为 `proxy.ps1`）：

```powershell
param(
    [switch]$Off
)

if ($Off) {
    Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue
    Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue
    Remove-Item Env:ALL_PROXY -ErrorAction SilentlyContinue
    Write-Host "Proxy OFF" -ForegroundColor Red
} else {
    $env:HTTP_PROXY = "http://127.0.0.1:7897"
    $env:HTTPS_PROXY = "http://127.0.0.1:7897"
    $env:ALL_PROXY = "http://127.0.0.1:7897"
    Write-Host "Proxy ON -> 127.0.0.1:7897" -ForegroundColor Green
}
```

使用：`.\proxy.ps1` 开启，`.\proxy.ps1 -Off` 关闭。

### 4.2 CMD 环境变量

```cmd
set HTTP_PROXY=http://127.0.0.1:7897
set HTTPS_PROXY=http://127.0.0.1:7897
```

### 4.3 Git

```bash
# 全局设置
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897

# 只对 GitHub 设置代理（推荐，避免影响内网 Git 仓库）
git config --global http.https://github.com.proxy http://127.0.0.1:7897

# 查看当前配置
git config --global --get http.proxy

# 取消设置
git config --global --unset http.proxy
git config --global --unset https.proxy
```

> 如果你用 SSH 方式 clone（`git@github.com:...`），HTTP 代理设置无效。SSH 需要在 `~/.ssh/config` 中配置 ProxyCommand：
>
> ```
> Host github.com
>     ProxyCommand connect -H 127.0.0.1:7897 %h %p
> ```
>
> 需要安装 `connect`（Git for Windows 自带，路径通常在 `C:\Program Files\Git\mingw64\bin\connect.exe`）。
> 或者更简单的方式——直接用 TUN 模式，不需要折腾这些。

### 4.4 npm / pnpm / yarn

```bash
# npm
npm config set proxy http://127.0.0.1:7897
npm config set https-proxy http://127.0.0.1:7897

# 查看
npm config get proxy

# 取消
npm config delete proxy
npm config delete https-proxy

# pnpm 同理
pnpm config set proxy http://127.0.0.1:7897
pnpm config set https-proxy http://127.0.0.1:7897
```

> npm 也会读取 `HTTP_PROXY` / `HTTPS_PROXY` 环境变量。如果已经设了环境变量，npm config 可以不用设。

### 4.5 pip

```bash
# 临时使用
pip install package_name --proxy http://127.0.0.1:7897

# 永久设置（pip.ini）
# Windows 路径: %APPDATA%\pip\pip.ini
```

pip.ini 内容：

```ini
[global]
proxy = http://127.0.0.1:7897
```

> 更好的方案：国内 pip 直接换镜像源（清华、阿里），不走代理通常更快：
>
> ```bash
> pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
> ```

### 4.6 Docker

Docker Desktop 的代理配置比较特殊，分两层：

**Docker daemon（拉取镜像）**：

编辑 `C:\Users\<你的用户名>\.docker\daemon.json`：

```json
{
  "proxies": {
    "http-proxy": "http://127.0.0.1:7897",
    "https-proxy": "http://127.0.0.1:7897",
    "no-proxy": "localhost,127.0.0.1"
  }
}
```

> 注意：Docker Desktop for Windows 的 daemon 运行在 WSL2 或 Hyper-V VM 内部。`127.0.0.1` 在那个虚拟机里指向虚拟机自身，不是你的 Windows 主机。你可能需要改成 `host.docker.internal:7897`，并且确保 Clash Verge 的 "Allow LAN" / "局域网连接" 开关打开。

**Docker CLI / build 时的代理**：

编辑 `C:\Users\<你的用户名>\.docker\config.json`：

```json
{
  "proxies": {
    "default": {
      "httpProxy": "http://host.docker.internal:7897",
      "httpsProxy": "http://host.docker.internal:7897",
      "noProxy": "localhost,127.0.0.1"
    }
  }
}
```

**如果你用 TUN 模式**：Docker daemon 在 WSL2/Hyper-V VM 内部运行，TUN 虚拟网卡只作用于 Windows 宿主机网络栈，**不会自动覆盖 VM 内部的流量**。所以即使开了 TUN，Docker pull 可能仍然需要手动配代理或使用国内镜像。

---

## 5. 常见报错及修复

### `ECONNREFUSED 127.0.0.1:7897`

**含义**：连接被拒绝。目标端口没有程序在监听。

**排查**：

```powershell
# 检查 7897 端口是否有进程监听
netstat -ano | findstr "7897"

# 或者用 PowerShell
Test-NetConnection -ComputerName 127.0.0.1 -Port 7897
```

**常见原因**：
- Clash Verge 没有运行
- Clash Verge 运行了但内核崩溃了（看 Clash Verge 的日志）
- 端口不是 7897——去 Clash Verge 设置里确认 Mixed Port 的实际值
- 防火墙拦截了本地回环地址（罕见，但 Windows Defender 做得出来）

**修复**：启动 Clash Verge，确认端口号，必要时重启 Clash 内核。

---

### `ETIMEDOUT`

**含义**：连接超时。TCP 握手在规定时间内没有完成。

**排查**：

```powershell
# 能不能连上代理本身？
Test-NetConnection -ComputerName 127.0.0.1 -Port 7897

# 代理能连上，但目标超时？试试直连
curl.exe -x http://127.0.0.1:7897 https://www.google.com -v --connect-timeout 10
```

**常见原因**：
- 代理节点（机场服务器）宕机或被封
- DNS 解析失败导致连接到错误的 IP
- TUN 模式未正确启用，流量走了直连被 GFW 拦截
- Clash 的规则把目标域名匹配到了一个不可用的节点

**修复**：
1. 在 Clash Verge 中切换到其他节点
2. 检查 Clash 日志，看请求匹配到了哪个规则和哪个节点
3. 对节点做延迟测试，选择可用的节点

---

### `UNABLE_TO_VERIFY_LEAF_SIGNATURE` / 证书错误

**含义**：TLS 证书链验证失败。客户端无法信任服务器出示的证书。

**常见原因**：
- 某些代理模式下 Clash 会做 TLS 拦截（MITM），用自签名证书替换原始证书
- 企业网络的 SSL 检测设备注入了自签名证书
- Node.js 使用的 CA 证书列表和操作系统不同

**修复**：

```jsonc
// settings.json — 临时解决（不推荐长期使用）
{
  "http.proxyStrictSSL": false
}
```

```powershell
# 或者设置 Node.js 环境变量跳过证书验证（影响集成终端内的 Node 程序）
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
```

> ⚠️ 以上是"止血"手段。根本解决方案是找到为什么证书链会断裂——通常是关掉 Clash 的 MITM / 全局拦截功能，或者正确安装 Clash 的 CA 根证书到系统信任存储。

---

### `WebSocket connection failed`

**含义**：WebSocket 升级握手失败。

Cursor 的 AI 功能（实时补全、Chat）可能使用 WebSocket 长连接。某些代理配置不正确时会导致 WebSocket 升级失败。

**常见原因**：
- HTTP 代理不支持或未正确实现 `CONNECT` 方法（WebSocket 需要通过 CONNECT 隧道）
- 代理超时配置太短，WebSocket 空闲期间被代理断开

**修复**：
- 使用 SOCKS5 代理替代 HTTP 代理（SOCKS5 天然支持任意 TCP 连接）：
  ```jsonc
  {
    "http.proxy": "socks5://127.0.0.1:7897"
  }
  ```
- 或者用 TUN 模式彻底绕过代理协议层面的限制

---

### `ECONNRESET`

**含义**：连接被远端重置。TCP RST 包。

**常见原因**：
- **GFW 主动重置连接**——最常见的场景。GFW 检测到翻墙协议特征，发 RST 包中断连接
- 代理节点不稳定，服务端主动关闭连接
- 本地网络不稳定（Wi-Fi 断连等）

**排查**：

```powershell
# 试不同的节点
# 看 Clash 日志有没有大量 connection reset

# 测试直连（绕过代理）是否也被 reset
curl.exe --noproxy "*" https://www.google.com -v
```

**修复**：
1. 切换节点（不同地区、不同协议）
2. 如果所有节点都频繁 ECONNRESET，可能是 ISP / GFW 在做深度包检测。尝试换协议（如 Trojan → Hysteria2，走 QUIC 协议更难被识别）
3. 联系机场客服确认节点状态

---

## 6. 验证清单

配置完成后，按顺序跑一遍以下测试。每一步都过了才算配置成功。

### ✅ 基础连通性（PowerShell）

```powershell
# 1. Google 可达性
curl.exe https://www.google.com -I -s -o NUL -w "%{http_code}"
# 期望输出: 200 或 301

# 2. OpenAI API 可达性（Cursor 的 AI 后端）
curl.exe https://api.openai.com -I -s -o NUL -w "%{http_code}"
# 期望输出: 200 或 403（403 是正常的，说明能连上，只是没认证）

# 3. GitHub 可达性
curl.exe https://github.com -I -s -o NUL -w "%{http_code}"
# 期望输出: 200

# 4. npm registry 可达性
curl.exe https://registry.npmjs.org -I -s -o NUL -w "%{http_code}"
# 期望输出: 200
```

### ✅ Cursor AI 功能

1. 打开 Cursor
2. 打开 AI Chat 面板（`Ctrl + L`）
3. 输入任意问题，确认能正常回复
4. 在代码文件中尝试 Tab 补全，确认能正常工作

### ✅ Git 操作

```powershell
# 在 Cursor 的集成终端中执行
git ls-remote https://github.com/anthropics/anthropic-cookbook.git HEAD
# 期望输出: 一个 commit hash + HEAD
```

### ✅ npm 安装

```powershell
# 在 Cursor 的集成终端中执行
npm ping
# 期望输出: npm notice PING https://registry.npmjs.org/
# 期望输出: npm notice PONG ...ms
```

### ✅ DNS 解析

```powershell
nslookup github.com
# 期望: 返回真实 IP，而非被污染的地址
# 如果 TUN 模式 + fake-ip: 返回 198.18.x.x 是正常的，这是 Clash 的 fake-ip 段
```

---

## 总结：选哪个方案？

```
你能装 Service Mode 吗？
  ├─ 能 → 用 TUN 模式，完事。(方案一)
  └─ 不能
       ├─ 需要 Docker 吗？
       │    ├─ 不需要 → 系统代理 + settings.json (方案二)
       │    └─ 需要 → 系统代理 + settings.json + Docker 单独配 (方案二+三)
       └─ 集成终端的工具也需要代理？
            └─ 加上环境变量配置 (方案三)
```

**懒人结论**：能用 TUN 就用 TUN。一劳永逸，不用到处配代理。

---

> 最后更新: 2026-04-05
