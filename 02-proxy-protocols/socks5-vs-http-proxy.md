# SOCKS5 vs HTTP 代理：两种基础代理协议

> 这两个协议解决的问题是：**你的应用怎么把流量交给本地的 Clash？** 它们是 App ↔ Clash 之间的通信方式，不要跟翻墙协议（SS、VMess、Trojan）搞混——那些是 Clash ↔ 远程服务器之间的协议。

---

## HTTP 代理（HTTP CONNECT）

### 工作原理

HTTP 代理最初是为 HTTP 流量设计的。当你要访问 HTTPS 网站时，使用 `CONNECT` 方法建立隧道：

```
Client → Proxy: "CONNECT google.com:443 HTTP/1.1"
Proxy → google.com: [建立 TCP 连接]
Proxy → Client: "HTTP/1.1 200 Connection Established"
Client ←→ Proxy ←→ google.com: [TLS 加密数据双向透传]
```

关键细节：
- 代理能看到你要连接的**目标主机名**（`CONNECT` 请求里写着），但看不到加密后的内容
- 只处理 HTTP/HTTPS 流量——其他类型的 TCP 流量（比如 SSH）没法通过 HTTP 代理
- UDP 流量完全不支持
- 几乎所有应用都支持 HTTP 代理设置——这是最通用的配置方式

### Clash 中的配置

Clash 的 `port` 或 `mixed-port` 提供 HTTP 代理服务：

```yaml
# clash 配置
mixed-port: 7897  # 这个端口同时提供 HTTP 和 SOCKS5 代理
```

应用侧配置：
```bash
# 环境变量方式
export HTTP_PROXY=http://127.0.0.1:7897
export HTTPS_PROXY=http://127.0.0.1:7897

# git 配置方式
git config --global http.proxy http://127.0.0.1:7897
```

---

## SOCKS5 代理

### 工作原理

SOCKS5 比 HTTP 代理**更通用**——它不关心上层是什么协议，只负责转发 TCP/UDP 连接：

```
Client → SOCKS5 Proxy: "请帮我连接到 target:port"
Proxy: [建立到 target:port 的连接]
Client ←→ Proxy ←→ Target: [原始数据双向透传]
```

SOCKS5 的关键特性：
- **协议无关（Protocol agnostic）**：HTTP、HTTPS、FTP、SSH、游戏流量...任何走 TCP 的东西都能代理
- **支持 UDP**：这是对 HTTP 代理的重大优势——DNS 查询、游戏、视频通话等 UDP 流量也能走代理
- **支持认证**：用户名/密码验证（本地 Clash 通常不需要）
- **不解析内容**：SOCKS5 代理看到的就是一坨字节流，不理解也不干预上层协议

### Clash 中的配置

```yaml
# clash 配置（同一个端口）
mixed-port: 7897  # SOCKS5 也在这个端口上
```

应用侧配置：
```bash
# 某些工具支持 SOCKS5
curl --socks5 127.0.0.1:7897 https://example.com

# 或者用环境变量
export ALL_PROXY=socks5://127.0.0.1:7897
```

---

## Mixed Port（混合端口）

Clash 的一个设计：**一个端口同时接受 HTTP 代理和 SOCKS5 代理连接**，自动检测进来的是哪种协议。

```yaml
mixed-port: 7897
```

这意味着：
- 你设置 `http_proxy=http://127.0.0.1:7897` → 走 HTTP 代理协议 ✓
- 你设置 `all_proxy=socks5://127.0.0.1:7897` → 走 SOCKS5 协议 ✓
- 同一个端口，两种协议都接

不需要分开配 `port`（HTTP）和 `socks-port`（SOCKS5），一个 `mixed-port` 搞定。Clash Verge 默认就是这个配置。

---

## 对比表

| 特性 | HTTP Proxy | SOCKS5 |
|------|-----------|--------|
| TCP 支持 | ✓ | ✓ |
| UDP 支持 | ✗ | ✓ |
| 协议感知 | 只理解 HTTP | 协议无关，转发任意字节流 |
| 性能开销 | 略低（协议头更简单） | 略高（但差距可忽略） |
| 应用支持 | 几乎所有应用都支持 | 大部分应用支持，但不如 HTTP 代理普及 |
| 典型用途 | 浏览器、HTTP 工具（curl、git、npm） | 通用代理、需要 UDP 的场景 |

---

## 在你的场景中

### 日常开发工具

大部分开发工具只需要 HTTP 代理就够了：

```bash
# git — HTTP 代理
git config --global http.proxy http://127.0.0.1:7897

# npm — HTTP 代理
npm config set proxy http://127.0.0.1:7897

# Cursor / VS Code — settings.json
"http.proxy": "http://127.0.0.1:7897"
```

这些工具的网络请求本质上都是 HTTP/HTTPS，HTTP 代理完全够用。

### 需要 SOCKS5 的场景

- SSH 通过代理连接远程服务器
- 某些需要 UDP 的应用
- 工具不支持 HTTP 代理但支持 SOCKS5 的情况

### 如果你开了 TUN 模式

**以上都不重要。** TUN 模式在网络层劫持所有流量，应用不需要知道代理的存在。不需要配 `http.proxy`，不需要配环境变量——所有流量自动走 Clash。

TUN 模式下，SOCKS5/HTTP 代理端口仍然存在可用，但你不需要主动使用它们。

---

## 这两个协议和翻墙协议的关系

**这是一个非常容易搞混的点，必须说清楚。**

```
完整链路：

App ──[SOCKS5 或 HTTP]──→ Clash ──[SS / VMess / Trojan]──→ 远程代理服务器 ──→ 目标网站
│                         │                                │
│  本地协议                │  翻墙协议                       │
│  App 和 Clash 之间       │  Clash 和远程服务器之间           │
│  运行在你电脑上           │  穿越 GFW                       │
```

两层完全不同的协议，各管各的事：

| | 本地代理协议 | 翻墙协议 |
|---|---|---|
| 协议 | SOCKS5, HTTP Proxy | Shadowsocks, VMess, VLESS, Trojan, Hysteria2 |
| 通信双方 | App ↔ Clash | Clash ↔ 远程代理服务器 |
| 位置 | 全在你的电脑内部 | 跨越国际网络 |
| 目的 | 把流量交给 Clash | 把流量安全地送到墙外 |
| 加密需求 | 不需要（本地通信） | 必须加密（要躲 GFW） |

不要把 "我配了 SOCKS5 代理" 和 "我用的 Shadowsocks 协议" 搞混。前者是你的 App 怎么跟 Clash 说话，后者是 Clash 怎么跟远程服务器说话。
