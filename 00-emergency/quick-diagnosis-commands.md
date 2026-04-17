# 诊断命令速查卡

> 网不通了？打开 PowerShell，按场景跑命令。每条命令都告诉你：**怎么跑、看什么、正常/异常分别长什么样**。

## 前置须知

- 所有命令在 **PowerShell** 中执行（Windows 10）
- 本文假设你的 Clash Verge 监听端口为 `7897`（mixed-port），API 端口为 `9097`（external-controller）。如果你改过，自行替换
- `curl` 在 PowerShell 中默认是 `Invoke-WebRequest` 的别名。如果命令报错，用 `curl.exe` 替代（Windows 自带的真 curl）

---

## 1. 网络连通性测试

最基本的判断：你的网到底通不通。

### 测试国内连通性

```powershell
ping baidu.com
```

**做什么**：向百度发 ICMP 请求，测试国内网络是否正常。不走代理。

**正常输出**：

```
Reply from 39.156.66.10: bytes=32 time=12ms TTL=52
Reply from 39.156.66.10: bytes=32 time=11ms TTL=52
```

**异常**：`Request timed out` 或 `Ping request could not find host` → 你的基础网络（Wi-Fi/网线）本身就有问题，跟代理无关。先修网。

---

### 测试国外 IP 可达性

```powershell
ping 8.8.8.8
```

**做什么**：直接 ping Google 的 DNS 服务器 IP。这是 ICMP 协议，不走代理。

**正常输出**（不代理时大概率超时）：

```
Request timed out.
Request timed out.
```

**解读**：ping 不通 ≠ 代理不工作。GFW 通常会拦截境外 ICMP 流量。这条命令的价值是**确认你的国内网络本身是通的**（对比上一条）。如果连 `ping baidu.com` 都不通，问题在本地网络。

---

### 测试 Clash 端口是否监听

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 7897
```

**做什么**：测试本机 7897 端口是否有进程在监听（TCP 连接测试）。

**正常输出**：

```
TcpTestSucceeded : True
```

**异常**：`TcpTestSucceeded : False` → Clash Verge 没有在运行，或者端口配置不对。打开 Clash Verge 看看是不是挂了。

---

## 2. DNS 诊断

DNS 是翻墙中最容易出问题的环节。域名解析错了，后面全白搭。

### 默认 DNS 查询

```powershell
nslookup google.com
```

**做什么**：用系统默认 DNS 服务器解析 `google.com`。

**正常输出**（开了代理/fake-ip 模式）：

```
Server:  clash-dns
Address:  127.0.0.1

Non-authoritative answer:
Name:    google.com
Address:  198.18.0.x    # fake-ip 段
```

**异常——DNS 污染迹象**：

```
Name:    google.com
Address:  31.13.xx.xx   # 返回了一个完全不相关的 IP
```

如果返回的 IP 不在 Google 的 IP 段（通常是 `142.250.x.x`、`172.217.x.x` 等），且不在 fake-ip 段（`198.18.0.0/16`），那就是 DNS 被污染了。

---

### 指定 DNS 服务器查询

```powershell
nslookup google.com 8.8.8.8
```

**做什么**：绕过系统 DNS，直接向 Google DNS（8.8.8.8）查询。

**正常输出**：应该返回 Google 的真实 IP。

**异常**：如果超时或返回奇怪 IP → GFW 在中间劫持/污染了 DNS 查询（UDP 53 端口被拦截或注入）。这正是你需要 Clash DNS（DoH/DoT）的原因。

---

### 通过 Clash DNS 查询

```powershell
nslookup google.com 127.0.0.1
```

**做什么**：通过 Clash 的内置 DNS 服务解析域名。

**前提**：Clash 配置中 `dns.listen` 设置为 `0.0.0.0:53` 或类似值，且 Clash 正在运行。TUN 模式下 Clash 通常会接管系统 DNS。

**正常输出**：返回 fake-ip 段地址（`198.18.x.x`）或真实 IP，取决于你的 DNS 模式。

**异常**：连接被拒绝 → Clash DNS 没启动，检查配置。

---

### 如何识别 DNS 污染

DNS 污染的典型特征：

| 现象 | 含义 |
|------|------|
| `google.com` 解析到 `127.0.0.1` 或 `0.0.0.0` | 被黑洞路由 |
| 解析到不属于该网站的 IP（如 Facebook 的 IP 被返回给 Google） | 注入了假响应 |
| 国内 DNS 和国外 DNS 返回完全不同的结果 | 中间有劫持 |
| 解析到一个国内 IP，但网站明显在海外 | 典型污染 |

快速对比命令：

```powershell
# 对比国内 DNS 和 Clash DNS 的解析结果
nslookup google.com 223.5.5.5     # 阿里 DNS
nslookup google.com 127.0.0.1     # Clash DNS
```

如果两个结果差异巨大，且阿里 DNS 返回的 IP `ping` 不通或不在 Google 的 AS 段，说明国内 DNS 被污染了。

---

## 3. 代理测试

确认 Clash 端口活着之后，测试代理是否真的能转发流量。

### HTTP 代理测试

```powershell
curl.exe -x http://127.0.0.1:7897 https://www.google.com -I
```

**做什么**：通过 Clash 的 HTTP 代理端口访问 Google，只拿 HTTP 头（`-I`）。

**正常输出**：

```
HTTP/1.1 200 OK
Content-Type: text/html; charset=ISO-8859-1
```

**异常**：
- `Connection refused` → Clash 没运行或端口不对
- `HTTP/1.1 503` → Clash 运行了但所有节点都挂了
- 超时无响应 → 节点不通或被封

---

### SOCKS5 代理测试

```powershell
curl.exe -x socks5://127.0.0.1:7897 https://www.google.com -I
```

**做什么**：通过 SOCKS5 协议走代理。Clash 的 mixed-port 同时支持 HTTP 和 SOCKS5。

**正常输出**：同上，`HTTP/1.1 200 OK`。

**解读**：如果 HTTP 代理不通但 SOCKS5 通（或反过来），说明某种协议层有问题。正常情况下 mixed-port 两个都应该通。

---

### 测试 OpenAI 可达性（Cursor 需要）

```powershell
curl.exe -x http://127.0.0.1:7897 https://api.openai.com/v1/models -I
```

**做什么**：测试能不能通过代理到达 OpenAI 的 API。Cursor 的 AI 功能依赖这个。

**正常输出**：

```
HTTP/2 401
```

`401 Unauthorized` 是**正常的**——说明网络通了，只是没带 API Key。能收到 401 就说明 Cursor 的网络链路没问题。

**异常**：`403 Forbidden` → OpenAI 可能封了你节点的 IP（某些地区的 IP 被 ban）。换节点试试。

---

### 测试 GitHub API

```powershell
curl.exe -x http://127.0.0.1:7897 https://api.github.com -I
```

**做什么**：测试 GitHub API 可达性。

**正常输出**：

```
HTTP/2 200
X-RateLimit-Remaining: 59
```

---

## 4. 端口和进程

排查"端口被占"或"Clash 根本没跑"。

### 查看端口占用

```powershell
netstat -ano | findstr "7897"
```

**做什么**：列出所有使用 7897 端口的连接和监听状态。

**正常输出**：

```
  TCP    127.0.0.1:7897    0.0.0.0:0    LISTENING    12345
  TCP    0.0.0.0:7897      0.0.0.0:0    LISTENING    12345
```

**关键信息**：
- `LISTENING` → 有进程在监听这个端口（应该是 Clash）
- 最右边的数字（`12345`）是 PID（进程ID），可以用下面的命令查是哪个进程
- 如果没有任何输出 → 没有进程在监听 7897，Clash 没在跑

确认 PID 对应的进程：

```powershell
Get-Process -Id 12345 | Select-Object ProcessName, Path
```

---

### 查 Clash 相关进程

```powershell
Get-Process | Where-Object {$_.ProcessName -like "*clash*" -or $_.ProcessName -like "*verge*"}
```

**做什么**：找出所有进程名包含 "clash" 或 "verge" 的进程。

**正常输出**：

```
Handles  NPM(K)  PM(K)  WS(K)  CPU(s)    Id  ProcessName
-------  ------  -----  -----  ------    --  -----------
    320      25  45000  52000    5.20  12345  clash-verge
    180      18  30000  35000    2.10  12346  clash-meta
```

**异常**：没有任何输出 → Clash Verge 没有在运行。打开它。

---

## 5. 路由和网卡

TUN 模式会在系统中创建虚拟网卡和路由规则，这组命令帮你确认 TUN 是否生效。

### 查看所有网卡信息

```powershell
ipconfig /all
```

**做什么**：列出所有网络适配器及其配置。

**看什么**：

- 找一个名为 `Clash` 或 `Meta` 或 `utun` 的虚拟网卡 → TUN 模式已生效
- 如果没找到虚拟网卡但你开了 TUN 模式 → TUN 没有成功创建（可能需要 Service Mode / 管理员权限）
- 看 DNS 服务器地址：如果是 `127.0.0.1` 或 `198.18.0.1`，说明 Clash 接管了 DNS

**TUN 虚拟网卡示例**：

```
以太网适配器 Clash:
   IPv4 地址 . . . . . . . . . : 198.18.0.1
   子网掩码  . . . . . . . . . : 255.255.0.0
   默认网关  . . . . . . . . . : 0.0.0.0
```

---

### 查看路由表

```powershell
route print
```

**做什么**：显示系统路由表。

**TUN 模式下**会看到类似这样的路由：

```
网络目标        网络掩码          网关            接口          跃点数
0.0.0.0          128.0.0.0        198.18.0.1      198.18.0.1      1
128.0.0.0        128.0.0.0        198.18.0.1      198.18.0.1      1
```

这两条路由的含义是"所有流量都走 TUN 虚拟网卡"（`0.0.0.0/1` + `128.0.0.0/1` = 全部 IP 空间）。这是 TUN 模式的标志性路由。

**没开 TUN 时**：不会有指向 `198.18.x.x` 的路由。

---

### 路由追踪

```powershell
tracert google.com
```

**做什么**：追踪数据包到 `google.com` 经过的每一跳路由器。

**实际用途**：主要看第一跳。如果第一跳是 `198.18.0.1`（TUN 网关），说明流量确实走了 Clash TUN。这个命令对被墙的目标通常会在几跳后开始全部超时（`* * *`），这是正常的。

```
  1    <1 ms    <1 ms    <1 ms  198.18.0.1        # ← TUN 网关，流量走 Clash
  2     *        *        *     请求超时。
  3     *        *        *     请求超时。
```

---

## 6. Clash 特定诊断

### Clash Verge 日志位置

Clash Verge 的日志和配置文件通常在：

```
%USERPROFILE%\.config\clash-verge-rev\
```

打开方式：

```powershell
explorer "$env:USERPROFILE\.config\clash-verge-rev"
```

关键文件：
- `logs/` — 运行日志
- `profiles/` — 订阅配置文件
- `clash-verge.yaml` — Clash Verge 自身设置

也可以在 Clash Verge 界面点击 **设置 → 打开日志文件夹** 直接跳转。

---

### 通过 API 查看代理组状态

```powershell
curl.exe http://127.0.0.1:9097/proxies
```

**做什么**：调用 Clash 的 RESTful API，获取所有代理组和节点的状态信息。

**端口说明**：`9097` 是 `external-controller` 配置的端口。如果你改过，用你自己的端口。在 Clash Verge 界面的"设置"页面可以查看。

**正常输出**（JSON，这里简化）：

```json
{
  "proxies": {
    "GLOBAL": {
      "type": "Selector",
      "now": "🇯🇵 日本节点",
      "all": ["🇯🇵 日本节点", "🇺🇸 美国节点", "🇭🇰 香港节点"]
    },
    "🇯🇵 日本节点": {
      "type": "Trojan",
      "history": [
        {"delay": 185}
      ]
    }
  }
}
```

**看什么**：
- `now` — 当前选中的节点
- `history[].delay` — 最近一次延迟测试结果（毫秒）。`0` 表示超时/不可用
- 如果所有节点的 delay 都是 0 → 所有节点都挂了，可能是订阅过期或机场跑路

---

### 查看特定代理组

```powershell
curl.exe http://127.0.0.1:9097/proxies/GLOBAL
```

把 `GLOBAL` 换成你想查的代理组名称（URL 编码中文）。

---

### Clash 日志中常见错误及含义

| 日志关键词 | 含义 | 怎么办 |
|-----------|------|--------|
| `dial tcp: i/o timeout` | 连接节点超时 | 节点挂了，换节点 |
| `connection refused` | 目标拒绝连接 | 端口被封或服务端关了 |
| `TLS handshake timeout` | TLS 握手超时 | 节点 IP 被精准封锁 |
| `no route to host` | 没有到目标的路由 | 检查 TUN 和路由表 |
| `DNS resolve failed` | DNS 解析失败 | 检查 Clash DNS 配置 |
| `proxy adapter not found` | 规则引用了不存在的代理组 | 检查配置中的 proxy-group 名称 |
| `subscription expired` | 订阅过期 | 续费或联系机场 |
| `all proxies are not alive` | 所有节点都不可用 | 更新订阅 → 测速 → 换机场 |

---

## 快速排错流程

把上面的命令串起来，5 分钟定位问题：

```
Step 1: ping baidu.com           → 国内网通不通？
Step 2: Test-NetConnection 7897  → Clash 活着吗？
Step 3: curl.exe -x proxy google → 代理通不通？
Step 4: nslookup + DNS 对比      → DNS 有没有问题？
Step 5: 看 Clash 日志            → 具体什么错误？
```

如果 Step 1 就不通——别折腾代理了，先修 Wi-Fi。
