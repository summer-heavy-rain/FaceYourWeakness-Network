# TLS：凭什么信任这个网站

> 你每天往 `api.anthropic.com` 发 API Key。凭什么你相信对面真的是 Anthropic 而不是有人在冒充？凭什么你相信路上没人偷看？答案是 TLS。

---

## HTTP vs HTTPS

先从最基本的开始。

**HTTP（HyperText Transfer Protocol）**是明文协议。你发的所有内容——请求 URL、Header、Body——在网络上像明信片一样传输。路上任何一个设备（路由器、ISP、GFW）都能看到全部内容。

```
HTTP（明文）:

你的电脑 ──────────────────────────────────> 服务器
         POST /v1/messages
         Authorization: Bearer sk-ant-xxxxx    ← ISP 能看到你的 API Key
         {"message": "帮我写快排"}              ← ISP 能看到你说了什么
```

**HTTPS = HTTP + TLS**。TLS（Transport Layer Security）在 TCP 之上建立一个加密通道，所有 HTTP 内容在这个通道里传输：

```
HTTPS（加密）:

你的电脑 ──────────────────────────────────> 服务器
         [TLS 加密的数据，外人看到的是乱码]
         ISP: 只知道你在跟某个 IP 通信
              看不到 URL、Header、Body
```

HTTPS 里那个 **S** 代表 **Secure**，但"安全"在这里有三层含义：

1. **机密性（Confidentiality）**：内容加密，第三方看不到
2. **完整性（Integrity）**：数据没被篡改
3. **身份认证（Authentication）**：你连的确实是 Anthropic 的服务器，不是冒牌货

第三点最容易被忽略，但可能是最重要的。

---

## TLS 握手过程

当你的 Cursor 要跟 `api.anthropic.com` 建立 HTTPS 连接，TCP 三次握手之后，紧接着会做一次 **TLS 握手**。简化版流程：

```
你的电脑 (Client)                          Anthropic (Server)
      │                                         │
      │──① Client Hello ───────────────────────>│
      │  "我支持这些加密算法"                      │
      │  "我要连 api.anthropic.com" (SNI)        │
      │                                         │
      │<─② Server Hello + Certificate ─────────│
      │  "我们用这个加密算法"                      │
      │  "这是我的数字证书，证明我是真正的         │
      │   api.anthropic.com"                     │
      │                                         │
      │  ③ Client 验证证书                        │
      │  检查: 证书是否由受信任的 CA 签发?          │
      │  检查: 证书的域名是否匹配?                 │
      │  检查: 证书是否在有效期内?                  │
      │  检查: 证书是否被吊销?                     │
      │                                         │
      │──④ Key Exchange ───────────────────────>│
      │  双方通过数学方法协商出一个                 │
      │  对称加密密钥（session key）               │
      │  这个密钥只有双方知道                      │
      │                                         │
      │<═══════ 加密通道建立 ═════════════════>│
      │  后续所有 HTTP 数据用 session key 加密     │
      │                                         │
```

### 几个值得注意的细节

**SNI 是明文的**：第一步 Client Hello 里的 SNI（Server Name Indication）字段——你要连接的域名——是**没有加密的**。这是因为服务器需要先知道你要访问哪个域名，才能选择正确的证书返回（一台服务器可能托管多个网站）。

这意味着**路上的任何人（包括 GFW）都能看到你要去哪个网站**，虽然看不到具体内容。这是 TLS 协议最大的隐私短板。新的 **ECH（Encrypted Client Hello）** 标准正在解决这个问题，但还在推广中。

**非对称加密 vs 对称加密**：握手阶段用非对称加密（公钥/私钥对）来验证身份和交换密钥。建立连接后用对称加密（双方共享一个密钥）来加密数据。因为对称加密比非对称加密快得多，这样兼顾了安全和性能。

---

## 证书链（Certificate Chain）— 信任的传递

TLS 握手的核心问题是：**你怎么知道服务器给你的证书是真的？**

答案是**信任链（Chain of Trust）**：

```
┌─────────────────────────────────────┐
│  Root CA (根证书颁发机构)              │ ← 预装在你的 OS/浏览器里
│  比如: DigiCert, Let's Encrypt       │    你"无条件"信任它们
│  (自签名证书)                         │
└────────────────┬────────────────────┘
                 │ 签名
                 ▼
┌─────────────────────────────────────┐
│  Intermediate CA (中间证书颁发机构)    │ ← Root CA 担保它可信
│  比如: Cloudflare Inc ECC CA-3      │
└────────────────┬────────────────────┘
                 │ 签名
                 ▼
┌─────────────────────────────────────┐
│  Server Certificate (服务器证书)      │ ← Intermediate CA 担保它可信
│  持有者: api.anthropic.com           │
│  有效期: 2024-01-01 ~ 2025-01-01    │
└─────────────────────────────────────┘
```

验证逻辑（从下往上）：
1. 服务器给你它的证书，说"我是 `api.anthropic.com`"
2. 你的电脑检查这个证书的签名——它是由 Cloudflare Inc ECC CA-3 签发的
3. 你的电脑检查 Cloudflare 的中间证书——它是由 DigiCert 签发的
4. DigiCert 的根证书预装在你的操作系统里——你信任它
5. 信任逐级传递：你信任 DigiCert → DigiCert 担保 Cloudflare → Cloudflare 担保 `api.anthropic.com` → 你信任 `api.anthropic.com`

**如果链条中的任何一环断裂**——证书过期、签名不匹配、根 CA 不在你的信任列表里——浏览器/应用程序就会报错。

你见过的那个 **`UNABLE_TO_VERIFY_LEAF_SIGNATURE`** 错误，就是这条信任链在某个环节断了。"Leaf" 就是最底层的服务器证书，"unable to verify" 就是没法沿着信任链验证它。

---

## 和你的代理使用有什么关系

TLS 不是一个抽象的理论知识。你每天遇到的很多网络问题都跟它直接相关。

### 1. SNI 泄漏 — GFW 怎么知道你去哪

即使你用了 HTTPS，GFW 依然可以通过读取 TLS Client Hello 里的 SNI 字段来知道你在访问什么网站。

```
你的电脑 ────[Client Hello: SNI=api.anthropic.com]────> GFW

GFW: "api.anthropic.com？封了。"  *注入 TCP RST*
```

**解决方案**：
- **代理整条连接**：让 Clash 接管，你的 Client Hello 根本不会直接发到 GFW 能看到的地方
- **ECH（Encrypted Client Hello）**：加密 SNI 字段。还在推广阶段，不是所有服务器都支持
- **Trojan 协议**：你的 Client Hello 里的 SNI 是你的代理服务器的域名（看起来像正常网站），不是 `api.anthropic.com`

### 2. 证书错误与 MITM 代理

有些代理/工具会做 **TLS 拦截（MITM，Man-in-the-Middle）**：

```
正常情况:
Cursor ──TLS──> api.anthropic.com（证书: Anthropic 的，由受信任 CA 签发）
✓ 证书验证通过

MITM 代理的情况:
Cursor ──TLS──> 代理 ──TLS──> api.anthropic.com
                 │
                 代理用自己的证书冒充 api.anthropic.com
                 这个证书不是受信任的 CA 签发的
                 ✗ 证书验证失败!

错误: UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

代理想要"看到" HTTPS 的内容（比如做广告过滤、流量分析），就必须在中间解密再重新加密。但它用来重新加密的证书不是 Anthropic 的真证书，Cursor 不认——于是报错。

**这就是你之前遇到的问题的根本原因之一。**

解决方案（按推荐程度排序）：
1. **不要用会做 TLS 拦截的代理**。正常的 Clash 不会做 MITM。如果你遇到证书错误，先检查是不是有别的软件在拦截（杀毒软件、公司防火墙等）。
2. **如果必须用 MITM 代理**（比如公司要求），把代理的根证书添加到 Node.js 的信任列表：
   ```
   NODE_EXTRA_CA_CERTS=C:\path\to\proxy-ca.crt
   ```
3. **最后的手段**（不推荐，有安全风险）：
   ```
   NODE_TLS_REJECT_UNAUTHORIZED=0
   ```
   这会让 Node.js 跳过所有证书验证——相当于"我不在乎对面是谁"。在开发环境可以临时用，但你要清楚这样做**完全放弃了 TLS 的身份认证功能**。

### 3. 为什么 Trojan 协议能骗过 GFW

Trojan 协议的设计思路和 TLS 紧密相关：

```
Trojan 的工作方式:

正常用户连你的代理服务器:
Client ──TLS──> 代理服务器
                │
                收到 Trojan 密码 → 代理模式
                没收到/密码错误 → 返回一个正常网站的内容（回落）

GFW 来探测:
GFW ──TLS──> 代理服务器
              │
              没有 Trojan 密码 → "这就是一个正常的 HTTPS 网站"
              GFW: "嗯，看起来正常，不是代理"
```

Trojan 服务器使用**真正的 TLS 证书**（通常是 Let's Encrypt 签发的），配合一个真正的网站作为"回落"。从外部看，它和一个普通的 HTTPS 网站**完全一样**。

GFW 没法区分"一个正常的 HTTPS 网站"和"一个使用 Trojan 协议的代理服务器"——因为在 TLS 层面，它们就是一样的。

---

## 动手验证

### 在浏览器里查看证书

1. 用浏览器（通过代理）访问 `https://api.anthropic.com`
2. 点地址栏的锁图标 → "证书"/"Connection is secure" → "Certificate"
3. 你能看到：
   - 证书颁发给谁（Common Name / Subject）
   - 谁签发的（Issuer）
   - 有效期
   - 完整的证书链

### 用 curl 查看 TLS 握手细节

```powershell
# 查看完整的 TLS 握手过程（如果 curl 可用）
curl -v https://api.anthropic.com 2>&1 | Select-String "SSL|TLS|subject|issuer|expire"
```

你会看到类似的输出：
```
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
* Server certificate:
*  subject: CN=anthropic.com
*  issuer: C=US; O=Let's Encrypt; CN=R3
*  expire date: 2025-03-15
```

### 检测是否有 MITM

比较方便的方法：

1. 在浏览器里打开一个 HTTPS 网站
2. 查看证书的签发者（Issuer）
3. 如果签发者是你公司的名字、杀毒软件的名字、或者其他你没见过的名字——有人在做 MITM

常见的 MITM 签发者：
- 杀毒软件：`Kaspersky`、`ESET`、`Avast`
- 公司防火墙：`Fortinet`、`Palo Alto`、`Zscaler`
- 抓包工具：`mitmproxy`、`Charles`、`Fiddler`

如果签发者是正常的公共 CA（`DigiCert`、`Let's Encrypt`、`Cloudflare`、`Google Trust Services`），那就没问题。

### PowerShell 查看证书链

```powershell
# 用 PowerShell 获取某个网站的证书信息
$uri = "https://api.anthropic.com"
$request = [System.Net.HttpWebRequest]::Create($uri)
$request.AllowAutoRedirect = $false
$request.Proxy = [System.Net.WebProxy]::new("http://127.0.0.1:7890")  # 如果需要通过 Clash 代理
try { $request.GetResponse() | Out-Null } catch {}
$cert = $request.ServicePoint.Certificate
Write-Host "Subject: $($cert.Subject)"
Write-Host "Issuer: $($cert.Issuer)"
Write-Host "Expires: $($cert.GetExpirationDateString())"
```

---

## 总结

| 概念 | 一句话 | 和你的关系 |
|------|--------|-----------|
| TLS | TCP 之上的加密层，保证机密性、完整性、身份认证 | 你的每一次 API 调用都经过 TLS |
| SNI | TLS 握手中明文暴露的域名 | GFW 靠它知道你要去哪，Clash 帮你隐藏它 |
| 证书链 | 信任从 Root CA 逐级传递到服务器证书 | 链断了就是 `UNABLE_TO_VERIFY_LEAF_SIGNATURE` |
| MITM | 中间人解密+重新加密，打断信任链 | 某些代理/杀软会做，导致证书错误 |
| Trojan | 伪装成正常 HTTPS 的代理协议 | 利用 TLS 的"正常外表"骗过 GFW |

TLS 不只是"加个锁"。它是整个互联网信任体系的基石。你理解了 TLS，就理解了为什么代理能工作、为什么证书会报错、为什么 GFW 有时候能拦你有时候拦不住。

---

> **上一篇**: [NAT 与 GFW：为什么你需要翻墙](nat-and-gfw.md)
> **下一篇**: [代理的本质](../02-proxy-protocols/what-is-a-proxy.md) — 理解了网络基础之后，接下来看代理到底在做什么。
