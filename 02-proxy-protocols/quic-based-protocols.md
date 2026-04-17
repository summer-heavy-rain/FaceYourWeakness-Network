# QUIC 系协议：Hysteria 与 TUIC

> 前面讲的 SS、VMess、Trojan 都是基于 TCP 的。这篇讲的是另一个分支——基于 QUIC（也就是 UDP）的翻墙协议。它们的核心卖点是**速度**。

---

## QUIC 是什么

### 背景

传统的 HTTPS 连接需要经历：

```
TCP 三次握手（1 RTT）
  → TLS 握手（1-2 RTT）
    → 发送 HTTP 请求

总共需要 2-3 个往返（RTT）才能开始传数据。
```

RTT（Round-Trip Time）= 数据从你到服务器再回来的时间。中国到美国服务器大约 150-250ms，所以光握手就要花 300-750ms。

### QUIC 的解决方案

Google 开发了 QUIC（Quick UDP Internet Connections），用 UDP 替代 TCP：

```
QUIC 0-RTT 连接：
  → 一个包同时完成：连接建立 + TLS 握手 + 发送数据

首次连接：1 RTT
后续连接：0 RTT（利用之前的 session 信息）
```

### 关键优势

1. **更快的连接建立**：0-RTT 或 1-RTT，比 TCP+TLS 的 2-3 RTT 快得多

2. **没有队头阻塞（Head-of-Line Blocking）**：
   - TCP 的问题：如果一个包丢了，后面所有包都要等它重传——即使后面的包跟丢的包没关系
   - QUIC 的解决：每个 stream 独立，一个 stream 丢包不影响其他 stream

3. **内建加密**：QUIC 强制使用 TLS 1.3，不存在不加密的 QUIC

4. **连接迁移**：切换 WiFi / 移动网络时，TCP 连接会断（因为 IP 变了），QUIC 用 Connection ID 维持连接不中断

> HTTP/3 就是 HTTP over QUIC——这是 Web 的未来。但这里我们关心的不是 HTTP/3，而是利用 QUIC 作为传输层来翻墙。

---

## Hysteria / Hysteria2

### 核心思路

Hysteria 的作者观察到一个现象：**中国的国际出口带宽经常很拥堵，TCP 的拥塞控制算法会在丢包时大幅降速——但很多时候这些丢包不是因为真正的网络拥塞，而是 QoS 策略或者随机丢包。**

Hysteria 的回应：用 QUIC 作为底层传输，然后使用一种叫 **Brutal** 的拥塞控制算法——你告诉它 "我的带宽是 100Mbps"，它就会尽力把这 100Mbps 都用满，不管有没有丢包。

```
传统 TCP 拥塞控制：
  检测到丢包 → 大幅降速 → 慢慢恢复
  结果：在中国的国际链路上经常只能跑到实际带宽的一小部分

Hysteria Brutal 拥塞控制：
  检测到丢包 → 管它呢，继续发 → 通过冗余纠错处理丢包
  结果：能跑满你指定的带宽
```

### 实际效果

在网络质量差（丢包率高）的场景下，Hysteria 的速度优势非常明显——可能是传统 TCP 协议的数倍甚至十倍。这在中国的国际出口拥堵时段（晚高峰）尤其有价值。

### Hysteria2

Hysteria2 是重写版本，改进了：
- 协议更简洁
- 更好的伪装能力（伪装成标准 HTTP/3 流量）
- 与 Clash Meta（mihomo）集成更好
- 配置更简单

### 代价

- **激进的带宽占用可能触发 ISP 注意**：运营商可能会因为你持续高带宽占用 UDP 而限速或封端口
- **UDP 流量可能被优先丢弃**：某些网络环境对 UDP 流量不友好
- **需要合理设置带宽参数**：设太高会浪费，设太低会限制速度

---

## TUIC

### 定位

TUIC（"Too Unreliable, I Choose..."）也基于 QUIC，但设计哲学跟 Hysteria 不同：

| | Hysteria | TUIC |
|---|---|---|
| 拥塞控制 | Brutal（激进） | 标准 QUIC 拥塞控制（保守） |
| 速度 | 极快 | 快（但比 Hysteria 温和） |
| 隐蔽性 | 中等（激进行为容易被注意） | 较好（行为更像正常 QUIC 流量） |
| ISP 风险 | 较高（可能被限速） | 较低 |

TUIC 更适合需要在速度和隐蔽性之间取得平衡的场景。

### Clash 支持

Clash Meta（mihomo）同时支持 Hysteria2 和 TUIC。Clash Verge 使用 mihomo 作为核心，所以这两种协议都可以直接用。

---

## 为什么 UDP 协议有时不好使

### 问题

1. **企业/校园网络可能封锁 UDP**：很多公司和学校的防火墙只允许 TCP 流量通过，直接把 UDP 丢掉
2. **ISP 限速 UDP**：某些运营商对 UDP 流量的 QoS 优先级很低，或者主动限速
3. **NAT 问题**：复杂的 NAT 环境可能导致 UDP 连接不稳定
4. **GFW 对 UDP 的态度**：GFW 也在学习识别 QUIC 流量，虽然还没有大规模封锁

### 诊断方法

```
如果 Hysteria2/TUIC 节点连不上或者很慢：

1. 换一个 TCP 协议的节点（Trojan/VLESS）试试
   → 如果 TCP 节点正常 → 说明你的网络环境对 UDP 不友好
   → 如果 TCP 节点也不行 → 问题不在协议，可能是节点本身或 GFW 封锁

2. 检查是否在公司/校园网络
   → 如果是 → UDP 协议大概率不可用，用 TCP 协议

3. 换一个时段测试
   → 晚高峰 UDP 可能被限速，凌晨可能没问题
```

---

## 在你的场景中

### 如果 NxOnEarth 提供了 Hysteria2 节点

试试看。如果你的网络环境允许 UDP，Hysteria2 的速度会明显优于 TCP 协议——特别是在晚高峰拥堵时段。

### 如果你在公司办公

公司网络大概率对 UDP 不友好。优先用 Trojan 或 VLESS+WS+TLS（TCP 协议，走 443 端口，看起来像正常 HTTPS）。

### 推荐策略

在 Clash Verge 中配置一个 `url-test` proxy group，同时包含 Hysteria2 和 Trojan 节点：

```yaml
proxy-groups:
  - name: "Auto"
    type: url-test
    proxies:
      - HY2-HK-Node
      - Trojan-HK-Node
      - VLESS-JP-Node
      # ...更多节点
    url: http://www.gstatic.com/generate_204
    interval: 300
```

让 Clash 自动测速选择——如果 Hysteria2 更快就用 Hysteria2，如果 UDP 不通就自动 fallback 到 TCP 节点。你不需要手动操心。

---

## 速度对比（粗略参考）

```
相同网络条件下的典型表现（非严格测试，仅供参考）：

高丢包环境（晚高峰）：
  SS/Trojan (TCP):  ████░░░░░░  30-50% 带宽利用率
  Hysteria2 (QUIC): █████████░  80-95% 带宽利用率

低丢包环境（凌晨）：
  SS/Trojan (TCP):  ████████░░  80% 带宽利用率
  Hysteria2 (QUIC): █████████░  90% 带宽利用率

UDP 被限速的环境：
  SS/Trojan (TCP):  ██████░░░░  正常
  Hysteria2 (QUIC): ██░░░░░░░░  反而更慢（或完全不通）
```

结论：**没有绝对最好的协议，只有最适合当前网络环境的协议。** 这就是为什么 Clash 的多节点自动切换那么有用。
