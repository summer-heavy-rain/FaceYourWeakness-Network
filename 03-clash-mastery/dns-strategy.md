# DNS 策略：fake-ip vs redir-host

> 这可能是 Clash 里最让人困惑的概念。不理解它，DNS 配置就永远是在抄作业——出了问题完全不知道从哪下手。

---

## 1. 为什么 Clash 需要自己处理 DNS

先看**没有 Clash 时**，你的电脑怎么访问一个网站：

```
浏览器输入 google.com
    ↓
操作系统 DNS resolver（Windows DNS Client 服务）
    ↓
向 ISP 分配的 DNS 服务器发查询：google.com 的 IP 是什么？
    ↓
ISP DNS 返回 IP（比如 142.250.80.46）
    ↓
浏览器向 142.250.80.46 发起 TCP 连接
```

看起来没问题。但在中国大陆，这条链路有一个致命环节——**GFW 会污染 DNS 响应**。

当你的电脑通过 ISP 的 DNS 查询 `google.com` 时，GFW 检测到这是一个被封锁的域名，**抢在真正的 DNS 服务器之前**返回一个假 IP（比如 `127.0.0.1` 或某个随机的国内 IP）。你的浏览器拿着这个假 IP 去连，当然连不上。

那加上 Clash 呢？假设 Clash 不处理 DNS，流程变成：

```
浏览器输入 google.com
    ↓
操作系统 DNS resolver → ISP DNS → 拿到被污染的假 IP（93.46.8.89）
    ↓
浏览器向 93.46.8.89 发起连接
    ↓
Clash 拦截到连接，但它只看到目标 IP 是 93.46.8.89
    ↓
问题来了：Clash 不知道这个 IP 对应 google.com
    ↓
规则 DOMAIN-SUFFIX,google.com,Proxy 根本匹配不上——因为 Clash 只有一个 IP，没有域名
    ↓
流量可能走了 DIRECT，直连一个不存在的假 IP → 超时
```

**这就是 Clash 必须自己接管 DNS 的根本原因**：如果让操作系统先解析域名，Clash 拿到的就是一个被污染的 IP，丢失了域名信息，规则系统直接废掉。

Clash 的解决方案：**拦截所有 DNS 查询，自己来处理。** 具体怎么处理，有两种模式——redir-host 和 fake-ip。

---

## 2. redir-host 模式（真实 IP 模式）

redir-host 是 Clash 早期的 DNS 处理模式。思路很直觉：既然 ISP DNS 不可信，那我自己找靠谱的 DNS 来解析。

### 工作流程

```
应用请求解析 google.com
    ↓
Clash 拦截 DNS 查询
    ↓
Clash 同时向多组 DNS 发查询：
  - nameserver（国内 DNS，如 223.5.5.5）→ 返回被污染的假 IP
  - fallback（海外 DNS，如 tls://8.8.8.8）→ 返回真实 IP 142.250.80.46
    ↓
Clash 用 fallback-filter 判断：
  nameserver 返回的 IP 是不是国内 IP？
  → 不是国内 IP（假 IP 没有 GeoIP 信息）→ 用 fallback 的结果
    ↓
Clash 返回真实 IP 142.250.80.46 给应用
    ↓
同时 Clash 在内存里记录：142.250.80.46 → google.com
    ↓
应用向 142.250.80.46 发起连接
    ↓
Clash 拦截连接，查映射表：142.250.80.46 → google.com
    ↓
匹配规则 DOMAIN-SUFFIX,google.com,Proxy → 走代理
```

### 优点

- 应用拿到的是**真实 IP**——某些对 IP 做校验的应用（比如部分游戏客户端、P2P 软件）能正常工作
- 概念上比较直觉，"真 IP"听起来就靠谱

### 缺点

- **慢**。每次 DNS 查询都要等真实解析结果回来，特别是 fallback DNS（走海外 DoH/DoT）延迟高
- **DNS 泄漏风险高**。如果 fallback 没配对，或者 fallback-filter 判断失误，可能把被污染的结果返回给应用
- **配置复杂**。nameserver、fallback、fallback-filter 三个层级要精心配置，少一个都可能出问题
- IP → 域名的映射表可能出现冲突（多个域名解析到同一个 IP，比如 CDN）

### 什么时候用

一个字：**尽量别用。** 除非你遇到特定应用在 fake-ip 模式下确实异常（这种情况越来越少），否则没有理由选 redir-host。

---

## 3. fake-ip 模式（推荐）

fake-ip 是 Clash 后来引入的模式，思路非常巧妙：**既然我们不需要真实 IP（代理流量反正是远端解析），那干嘛要费力去解析？给个假的，快速建立映射就完了。**

### 工作流程

```
应用请求解析 google.com
    ↓
Clash 拦截 DNS 查询
    ↓
Clash 从保留 IP 段 198.18.0.0/16 中分配一个假 IP（比如 198.18.0.1）
    ↓
Clash 在内存映射表中记录：198.18.0.1 → google.com
    ↓
立刻返回 198.18.0.1 给应用（毫秒级，没有任何网络请求）
    ↓
应用向 198.18.0.1 发起连接
    ↓
Clash 拦截连接，查映射表：198.18.0.1 → google.com
    ↓
匹配规则 DOMAIN-SUFFIX,google.com,Proxy → 走代理
    ↓
代理节点把 google.com 发给远端服务器
    ↓
远端服务器自己解析 google.com 的真实 IP → 连接目标
```

注意关键区别：**代理流量根本不需要本地解析真实 IP**。远端代理服务器替你解析——它在海外，没有 GFW 污染。

那 DIRECT（直连）流量呢？

```
应用请求解析 baidu.com
    ↓
Clash 返回假 IP 198.18.0.42 → 映射 198.18.0.42 → baidu.com
    ↓
应用向 198.18.0.42 发起连接
    ↓
Clash 拦截，查映射：baidu.com → 匹配规则 GEOIP,CN,DIRECT → 直连
    ↓
这时 Clash 需要真实 IP 了 → 用 nameserver 解析 baidu.com → 119.75.217.109
    ↓
Clash 直接连接 119.75.217.109
```

对于直连流量，Clash 会**在需要时**才去解析真实 IP。延迟只发生在直连流量上，而直连流量用的是国内 DNS，速度很快。

### 优点

- **快**。代理流量完全跳过 DNS 解析环节，少了一次网络往返
- **无 DNS 泄漏**。代理域名的 DNS 查询根本不会离开你的电脑——从 ISP/GFW 的视角，你只是在连 198.18.x.x，它们完全不知道你在访问 google.com
- **配置简单**。不需要折腾 fallback 和 fallback-filter，因为需要代理的域名根本不走本地 DNS

### 缺点

- **Clash 重启后假 IP 映射丢失**。如果应用缓存了之前的假 IP（比如浏览器的 DNS 缓存），下次用这个假 IP 连接时 Clash 可能已经不认识它了 → 连接失败。解决办法：重启 Clash 后清一下系统 DNS 缓存（`ipconfig /flushdns`）
- **极少数应用会验证 IP**。比如某些游戏客户端会检查 DNS 返回的 IP 是否合理，发现 `198.18.x.x` 就拒绝连接。对这些应用，需要用 fake-ip-filter 排除

### fake-ip-filter：给特定域名返回真实 IP

即使在 fake-ip 模式下，某些域名也需要拿到真实 IP 才能正常工作。fake-ip-filter 就是这个"白名单"：匹配的域名会走真实 DNS 解析，不返回假 IP。

常见需要加入 fake-ip-filter 的域名：

```yaml
fake-ip-filter:
  # 本地网络服务发现
  - "*.local"
  - "*.localhost"

  # 时间同步服务（NTP 需要真实 IP）
  - "time.*.com"
  - "time.*.gov"
  - "ntp.*.com"
  - "time.*.apple.com"

  # Windows 网络连通性检测
  - "+.msftconnecttest.com"
  - "+.msftncsi.com"

  # 游戏平台（可能验证 IP）
  - "+.stun.*.*"
  - "+.stun.*.*.*"

  # 局域网 mDNS
  - "+.local"
```

`+` 前缀是 mihomo 的通配符语法，匹配该域名及所有子域名。

---

## 4. 对比表

| 特性 | fake-ip | redir-host |
|------|---------|------------|
| 代理流量 DNS 延迟 | **零**（不解析） | 高（等 fallback DNS 响应） |
| DNS 泄漏风险 | **极低** | 较高（fallback 配错就泄漏） |
| 应用兼容性 | 极少数应用可能异常 | **更好**（真实 IP） |
| 配置复杂度 | **简单** | 复杂（nameserver + fallback + filter） |
| Clash 重启影响 | 需清 DNS 缓存 | **无影响** |
| 推荐程度 | **强烈推荐** | 仅在 fake-ip 出问题时使用 |

结论：**用 fake-ip**。除非你遇到了明确的兼容性问题，否则没有理由用 redir-host。

---

## 5. DNS 配置最佳实践

以下是一个适合中国大陆用户的 Clash DNS 配置模板，逐字段注释：

```yaml
dns:
  enable: true                    # 开启 Clash 内置 DNS
  listen: 0.0.0.0:53             # 监听地址（TUN 模式下需要）
  enhanced-mode: fake-ip          # 使用 fake-ip 模式
  fake-ip-range: 198.18.0.1/16   # 假 IP 分配范围（RFC 5765 保留段，不会和真实 IP 冲突）

  # 这些域名返回真实 IP，不走 fake-ip
  fake-ip-filter:
    - "*.local"
    - "*.localhost"
    - "time.*.com"
    - "ntp.*.com"
    - "+.msftconnecttest.com"
    - "+.msftncsi.com"

  # 默认 DNS 服务器（用国内的，速度快）
  # 这组 DNS 主要用来解析直连流量的真实 IP
  nameserver:
    - 223.5.5.5               # 阿里 DNS
    - 119.29.29.29            # 腾讯 DNS

  # 防污染 DNS（用加密协议，防止 GFW 篡改）
  # redir-host 模式下至关重要；fake-ip 模式下作用不大但配着没坏处
  fallback:
    - tls://8.8.8.8:853          # Google DNS over TLS
    - tls://1.1.1.1:853          # Cloudflare DNS over TLS
    - https://dns.google/dns-query   # Google DoH

  # 判断 nameserver 的结果是否被污染
  fallback-filter:
    geoip: true              # 开启 GeoIP 判断
    geoip-code: CN           # 如果 nameserver 返回非 CN IP，说明可能被污染，用 fallback 结果
    ipcidr:                  # 这些 IP 段一定是假的（GFW 常用的污染 IP）
      - 240.0.0.0/4
      - 0.0.0.0/32
      - 127.0.0.1/32
```

### 为什么 nameserver 用国内 DNS

nameserver 解析的主要是**直连流量**（国内网站）。用国内 DNS（阿里 223.5.5.5、腾讯 119.29.29.29）解析国内域名，速度快且结果准确（CDN 就近分配）。如果你用 8.8.8.8 解析 `baidu.com`，可能被分配到海外 CDN 节点，反而变慢。

### 为什么 fallback 用 DoH/DoT

fallback 是兜底。当 nameserver 返回的 IP 不属于中国（通过 GeoIP 判断），说明可能是被污染的结果。这时 Clash 用 fallback 中的加密 DNS 重新查询。DoH/DoT 走加密通道，GFW 无法篡改响应内容。

在 fake-ip 模式下，fallback 的重要性降低了（代理流量根本不走本地 DNS），但保留它作为直连流量的安全网是好习惯。

---

## 6. 常见 DNS 问题排查

### 国内网站变慢

**症状**：百度、淘宝、B站打开变慢，但 Google 正常。

**原因**：nameserver 配成了海外 DNS（比如 8.8.8.8）。解析国内域名时被分配到了海外 CDN 节点，绕了一大圈。

**修复**：确保 nameserver 只有国内 DNS：

```yaml
nameserver:
  - 223.5.5.5
  - 119.29.29.29
```

不要在 nameserver 里放 `8.8.8.8`，那是 fallback 该做的事。

---

### 某些网站打不开

**症状**：大部分代理网站正常，但某些特定网站（比如某个 AI 工具）打不开。

**排查思路**：

1. 先在 Clash Verge 的连接页面看这个域名走的是代理还是直连
2. 如果走了代理还不行，可能是节点问题（换个节点试）
3. 如果走了直连但其实需要代理 → 规则没配对（🔗 参见 [规则引擎](rule-engine.md)）
4. 如果配置是 redir-host 模式，可能是 DNS 污染穿透了——切换到 fake-ip 模式通常能解决

---

### 游戏/特定应用异常

**症状**：开了 Clash 之后某个游戏连不上服务器，或者某个应用报网络错误。

**原因**：大概率是 fake-ip 导致的。这些应用验证了 DNS 返回的 IP，发现 `198.18.x.x` 不是合法的 IP，拒绝连接。

**修复**：把这个应用访问的域名加入 fake-ip-filter：

```yaml
fake-ip-filter:
  # ... 其他条目 ...
  - "+.游戏域名.com"
  - "+.某应用.cn"
```

不知道应用访问了哪些域名？打开 Clash Verge 的连接页面，启动应用，看它连了哪些域名，找到那些连接失败的，加到 filter 里。

---

### DNS 查询完全不工作

**症状**：所有网站都打不开，Clash 日志里大量 DNS 相关报错。

**排查步骤**：

1. 检查 `dns.enable` 是否为 `true`
2. 检查 `dns.listen` 的端口是否被占用（`netstat -ano | findstr ":53"`）
3. 如果用了 TUN 模式，确保 TUN 的 DNS 配置和 Clash DNS 不冲突
4. 重启 mihomo 内核（Clash Verge → 设置 → 重启内核）

```powershell
# 验证 Clash 的 DNS 是否在工作
nslookup baidu.com 127.0.0.1
```

如果这条命令返回了正确结果，说明 Clash DNS 本身没问题，问题在别处。

---

> **下一篇**：[规则引擎](rule-engine.md) — 理解了 DNS 怎么工作之后，来看看流量到底是怎么被分流的。
