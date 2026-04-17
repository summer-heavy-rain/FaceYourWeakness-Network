# DNS：互联网的电话簿

> 你输入 `google.com`，但计算机只认数字。DNS 就是那本把名字翻译成电话号码的电话簿。而在中国，有人会给你一本假的。

---

## DNS 是什么

每台联网的设备都有一个 IP 地址，比如 `142.250.80.46`。你访问网站的时候输入的是 `google.com` 而不是这串数字，因为人脑记不住数字但记得住名字。

**DNS（Domain Name System）**就是负责把域名翻译成 IP 地址的系统。你可以把它理解为：

- 域名 = 人名（`google.com`）
- IP 地址 = 电话号码（`142.250.80.46`）
- DNS 服务器 = 电话簿 / 114 查号台

每次你的程序要访问一个域名，操作系统都会先做一次 DNS 查询，拿到 IP 之后才能建立连接。**没有 DNS 解析，就没有后续的一切。**

---

## DNS 解析过程

当 Cursor 要连 `api.anthropic.com`，DNS 解析大致经过这些步骤：

```
Cursor: "我要连 api.anthropic.com"
   │
   ▼
OS DNS 缓存: 上次查过吗？
   │
   ├─ 有缓存且没过期 → 直接返回 IP（最快）
   │
   └─ 没有 →
         │
         ▼
      系统配置的 DNS 服务器（比如 114.114.114.114 或路由器）
         │
         ├─ 有缓存 → 返回
         │
         └─ 没有 → 开始递归查询
                │
                ▼
             根域名服务器（Root Server）
             "我不知道 api.anthropic.com，但 .com 归谁管我知道"
                │
                ▼
             .com TLD 服务器
             "我不知道 api.anthropic.com，但 anthropic.com 归谁管我知道"
                │
                ▼
             anthropic.com 权威服务器（Authoritative Server）
             "api.anthropic.com 的 IP 是 104.18.32.47"
                │
                ▼
             结果逐级返回，并在每一级缓存（缓存时间由 TTL 决定）
```

### 关键概念

- **递归查询（Recursive Query）**：你问一个 DNS 服务器，它如果不知道就帮你一路问到底，最后给你最终答案
- **权威服务器（Authoritative Server）**：某个域名的"官方回答者"，它说啥就是啥
- **TTL（Time To Live）**：缓存有效期。比如 TTL=300 意味着这条记录缓存 5 分钟，过期后要重新查询
- **记录类型**：最常见的是 `A` 记录（域名 → IPv4 地址）和 `AAAA` 记录（域名 → IPv6 地址）

---

## DNS 污染（DNS Poisoning）— 你在中国最该关心的

正常的 DNS 查询是**明文 UDP 包**，没有任何加密。这意味着任何中间人都能看到你在问什么域名，也能篡改回复。

GFW 就是这么干的：

```
你的电脑 ──DNS 查询: api.anthropic.com?──> ISP ──> ──> 真正的 DNS 服务器
                                            │
                                       GFW 在这里
                                       看到你在查 api.anthropic.com
                                       抢先返回一个假 IP!
                                            │
你的电脑 <──假 IP: 93.46.8.89──────────────┘
```

GFW 的速度比真正的 DNS 服务器更快（因为它就在你家门口），所以它的假回复先到达你的电脑。你的电脑以为拿到了正确答案，于是去连那个假 IP——当然什么都连不上。

### 怎么确认自己被 DNS 污染了？

打开 PowerShell，运行：

```powershell
nslookup google.com
```

如果返回的 IP 地址看起来很奇怪（比如一个明显不属于 Google 的 IP），或者每次查都返回不同的、不合理的结果，大概率是 DNS 污染。

你也可以对比：

```powershell
# 用国内 DNS 查
nslookup google.com 114.114.114.114

# 用 Cloudflare DNS 查（如果没被拦截的话）
nslookup google.com 1.1.1.1
```

如果两个结果不一样，而且第一个的 IP 不是 Google 的——恭喜你看到了 DNS 污染的活标本。

---

## DNS 泄漏（DNS Leak）

你可能觉得："我都开了 Clash 了，DNS 污染跟我有什么关系？"

**有关系**，如果你的 DNS 泄漏了的话。

DNS 泄漏的意思是：虽然你的 HTTP/HTTPS 流量走了代理，但 **DNS 查询却没走代理**，直接发给了 ISP 的 DNS 服务器。

```
有泄漏的情况:

Cursor → Clash → 代理 → api.anthropic.com     ← 流量走代理，OK
Cursor → OS → ISP DNS → "api.anthropic.com?"  ← DNS 查询直连，泄漏!
```

后果：
1. ISP 知道你在访问 `api.anthropic.com`（即使内容加密了）
2. DNS 查询被 GFW 污染，返回假 IP
3. Clash 拿到假 IP，代理也连不上真正的服务器

DNS 泄漏是一个隐蔽的问题——表面上你在用代理，实际上你的域名查询在裸奔。

### 怎么检测 DNS 泄漏？

1. 确保 Clash 已开启
2. 用浏览器（通过代理）访问 [https://www.dnsleaktest.com](https://www.dnsleaktest.com)
3. 点 "Extended test"
4. 如果结果里出现了中国 ISP 的 DNS 服务器（电信、联通、移动的 IP）——你的 DNS 在泄漏

---

## Clash 怎么解决 DNS 问题

Clash 有几种策略来处理 DNS，从简单到复杂：

### 1. fake-ip 模式（推荐）

这是最干净的解决方案。原理很聪明：

```
Cursor: "我要连 api.anthropic.com"
   │
   ▼
Clash: "好的，我给你一个假 IP: 198.18.0.42（这个 IP 只在本机有意义）"
   │
   ▼
Cursor 以为 api.anthropic.com 的 IP 是 198.18.0.42，
发起 TCP 连接到 198.18.0.42
   │
   ▼
Clash 拦截所有发往 198.18.0.0/15 网段的流量，
看到 198.18.0.42 → 查表 → 哦这是 api.anthropic.com
   │
   ▼
Clash 根据规则把 api.anthropic.com 发给代理节点
代理节点在境外做真正的 DNS 解析
```

整个过程**根本没有在境内做真正的 DNS 查询**。GFW 没有机会污染，ISP 看不到任何域名。

### 2. redir-host 模式

Clash 真的去做 DNS 解析（用你配置的上游 DNS），拿到真实 IP 后再处理。这种模式下你需要配好加密 DNS 来防止污染。

### 3. DoH / DoT — 加密 DNS 查询

- **DoH（DNS over HTTPS）**：把 DNS 查询包在 HTTPS 里。看起来跟普通的 HTTPS 流量一样，GFW 分不出来。
  - 例如：`https://dns.cloudflare.com/dns-query`
- **DoT（DNS over TLS）**：用 TLS 加密 DNS 查询。走专用端口 853。

### 4. 分流 DNS（Split DNS）

国内域名用国内 DNS（速度快），国外域名用代理节点解析或加密 DNS（防污染）：

```yaml
# Clash 配置示例
dns:
  enable: true
  enhanced-mode: fake-ip
  nameserver:
    - https://dns.alidns.com/dns-query   # 国内域名走阿里 DNS
    - https://doh.pub/dns-query           # 或腾讯 DNS
  fallback:
    - https://dns.cloudflare.com/dns-query  # 国外域名走 Cloudflare
    - https://dns.google/dns-query          # 或 Google DNS
  fallback-filter:
    geoip: true
    geoip-code: CN
```

这个配置的逻辑是：先用国内 DNS 解析，如果解析结果的 IP 不是中国的（geoip 判断），就认为可能被污染了，改用 fallback 里的加密 DNS 重新解析。

详细的 DNS 策略配置见 [DNS 策略详解](../03-clash-mastery/dns-strategy.md)。

---

## 动手验证

### 查看当前 DNS 配置

```powershell
# 查看网络接口的 DNS 配置
ipconfig /all | findstr "DNS"
```

### 查看 DNS 缓存

```powershell
# 查看本机 DNS 缓存
ipconfig /displaydns

# 清除 DNS 缓存（排错时有用）
ipconfig /flushdns
```

### 测试 DNS 解析

```powershell
# 直接查询
nslookup api.anthropic.com

# 指定 DNS 服务器查询
nslookup api.anthropic.com 8.8.8.8

# 查看详细过程
nslookup -debug api.anthropic.com
```

### 检测 DNS 泄漏

1. 开启 Clash
2. 浏览器访问 [https://www.dnsleaktest.com](https://www.dnsleaktest.com)（确保走代理）
3. 运行 Extended Test
4. 如果结果只显示你代理节点所在地区的 DNS 服务器 → 没有泄漏 ✓
5. 如果出现中国 ISP 的 DNS → 有泄漏 ✗，检查 Clash DNS 配置

---

## 总结

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| DNS 污染 | GFW 拦截 DNS 查询，返回假 IP | Clash fake-ip / 加密 DNS |
| DNS 泄漏 | DNS 查询绕过代理直连 ISP | Clash 接管 DNS / TUN 模式 |
| DNS 解析慢 | DNS 服务器距离远或过载 | 用地理位置近的 DNS + 缓存 |
| DNS 结果不一致 | 不同 DNS 服务器返回不同结果 | 统一由 Clash 管理 DNS |

DNS 是网络世界的第一道门。如果 DNS 出了问题，后面的 TCP、TLS、HTTP 都是白搭——你连对方的门牌号都找不到，还怎么敲门？

---

> **上一篇**: [一个数据包的一生](the-life-of-a-packet.md)
> **下一篇**: [NAT 与 GFW：为什么你需要翻墙](nat-and-gfw.md)
