# 学习资源与工具

> 精选的学习资源，按主题分类。每个资源附带简短说明和适用水平。

---

## 1. 网络基础

| 资源 | 说明 | 水平 |
|------|------|------|
| **Computer Networking: A Top-Down Approach** (Kurose & Ross) | 网络入门的最佳教材，从应用层往下讲，叙事逻辑远好于国内谢希仁那本。先理解"为什么"再理解"怎么做"。 | 入门 |
| [How DNS Works](https://howdns.works/) | 用漫画解释 DNS 的工作原理，10 分钟就能看完。对理解 DNS 污染的前置知识很有帮助。 | 入门 |
| [High Performance Browser Networking](https://hpbn.co/) | Ilya Grigorik 写的免费在线书，覆盖 TCP/UDP/TLS/HTTP2/WebSocket 等现代网络栈。偏 Web 性能优化视角，但底层概念讲得很透。 | 入门→进阶 |

---

## 2. 代理与翻墙

| 资源 | 说明 | 水平 |
|------|------|------|
| [V2Ray/Xray 官方文档](https://xtls.github.io/) | Xray-core 的官方文档，包含 VLESS、VMess、Trojan、Reality 等协议的配置说明。内容偏服务端配置，但理解协议细节必读。 | 中级 |
| [mihomo (Clash Meta) Wiki](https://wiki.metacubex.one/) | Clash Meta 内核的官方 Wiki，你用的 Clash Verge 底层就是这个。理解 Clash 行为的权威来源。 | 中级 |
| [Clash Verge Rev GitHub](https://github.com/clash-verge-rev/clash-verge-rev) | 你正在使用的客户端的源码仓库。Release Notes 里经常有重要的 bug fix 和新功能说明，出了问题先来这里看 Issues。 | 中级 |

---

## 3. Clash 配置

| 资源 | 说明 | 水平 |
|------|------|------|
| [mihomo 配置文档](https://wiki.metacubex.one/config/) | Clash Meta 配置文件的完整参考。每个字段是什么意思、支持什么值，都在这里。写覆写脚本前必读。 | 中级 |
| [Loyalsoldier 规则集](https://github.com/Loyalsoldier/clash-rules) | 高质量的 Clash 规则集，包含 GFW 域名列表、国内直连列表等。基于 v2ray-rules-dat 生成，更新频繁。 | 入门→中级 |
| [blackmatrix7 规则集](https://github.com/blackmatrix7/ios_rule_script) | 最全面的分流规则集合，覆盖各种 App 和服务（Netflix、Telegram、OpenAI 等）。想给特定 App 走特定节点时来这里找规则。 | 入门→中级 |

---

## 4. 诊断工具

| 工具 | 说明 | 水平 |
|------|------|------|
| [DNS Leak Test](https://dnsleaktest.com/) | 检测你的 DNS 请求是否泄露到了代理之外。如果你以为走了代理但 DNS 查询还是走的本地 ISP → DNS 泄露。 | 入门 |
| [ipinfo.io](https://ipinfo.io/) / [ip.sb](https://ip.sb/) | 查看你当前的出口 IP、所属 ISP 和地理位置。确认代理是否生效的最简单方法——打开看 IP 是不是你节点的 IP。 | 入门 |
| [Speedtest](https://www.speedtest.net/) | 测速工具。分别选国内和海外服务器测试，可以判断是国际出口慢还是本地网络慢。 | 入门 |
| [TLS Client Hello 检测](https://tls.peet.ws/) | 检查你的 TLS fingerprint（JA3/JA4）。如果你的代理客户端的 TLS 指纹很独特，GFW 可能通过指纹识别代理流量。 | 进阶 |
| [bgp.he.net](https://bgp.he.net/) | Hurricane Electric 的 BGP 查询工具。查 IP 所属 ASN、路由信息。排查节点 IP 归属和路由问题时用。 | 进阶 |

---

## 5. 进阶阅读

| 资源 | 说明 | 水平 |
|------|------|------|
| [GFW Report](https://gfw.report/) | 学术级别的 GFW 技术分析，来自研究人员的实测论文。想真正理解 GFW 是怎么检测和封锁流量的，这是最硬核的来源。 | 进阶 |
| [QUIC 协议交互式指南](https://quic.xargs.org/) | 逐字节解释 QUIC 协议的握手和数据传输过程。理解 Hysteria/TUIC 为什么用 QUIC 之前，先搞懂 QUIC 本身。 | 进阶 |
| [TLS 1.3 详解](https://tls13.xargs.org/) | 同系列，逐字节解释 TLS 1.3 握手过程。理解 SNI 检测、ECH、Trojan 协议的底层基础。配合 Wireshark 抓包食用效果最好。 | 进阶 |

---

## 6. 社区

| 社区 | 说明 | 水平 |
|------|------|------|
| Clash Meta / mihomo Telegram 群 | 客户端使用问题、配置交流的主要社区。搜索历史消息通常能找到你遇到的问题。 | 全水平 |
| V2Ray / Xray Telegram 群 | 协议层面的讨论更多。如果你想了解协议细节或者自建节点，这里更合适。 | 中级→进阶 |
| 机场用户群 | 各机场通常有自己的 Telegram 群或频道。节点状态更新、线路切换公告看这里。**注意：不要在群里分享敏感信息（你的 IP、订阅链接、具体翻墙用途等）。** | 入门 |

---

## 使用建议

1. **刚入门**：先读 How DNS Works 漫画 + Computer Networking 前几章，建立网络分层的基本概念
2. **能用但不懂为什么**：读 mihomo Wiki + 配置文档，搞清楚 Clash 的每个配置字段在做什么
3. **想深入理解**：读 GFW Report 的论文 + TLS 1.3/QUIC 的交互式指南，理解对抗的底层逻辑
4. **出了问题**：先用诊断工具（DNS Leak Test、IP 查询）定位问题层级，再去对应社区搜索
