# FaceYourWeakness-Network

> 痛定思痛：一个软件工程师面对自己网络知识盲区的系统性补课仓库。

## 为什么有这个仓库

我是一个软件工程师，日常大量工作依赖翻墙（Cursor、GitHub、npm、Docker Hub...）。但我对网络技术几乎一无所知——每次 Clash 出问题，我只能像文盲一样排列组合乱调配置，浪费大量时间。更糟糕的是，办公室同事也依赖我的网络，一旦出问题整个团队停摆。

这个仓库不是配置文件合集，而是一个**从底层原理到实战排错的知识体系**。目标是：理解每一层在做什么，这样当问题出现时，你知道问题出在哪一层，而不是乱猜。

## 我的环境

- **代理客户端**: Clash Verge（基于 Clash Meta/mihomo 内核）
- **机场**: NxOnEarth 订阅
- **操作系统**: Windows 10
- **主要用途**: Cursor（AI 编程）、GitHub、npm/pip、Docker、Google 搜索
- **额外需求**: 办公室局域网共享代理

## 双轨学习路线

### Track A: 急救通道（遇到问题立刻查）

网不通了？从这里开始：

1. **[排错决策树](00-emergency/troubleshooting-tree.md)** — 从"网不通"出发，一步步定位问题
2. **[Cursor 网络配置](00-emergency/cursor-proxy-setup.md)** — Cursor/VSCode 代理配置完整指南
3. **[办公室共享方案](00-emergency/office-sharing.md)** — 给同事共享代理的配置方法
4. **[诊断命令速查](00-emergency/quick-diagnosis-commands.md)** — curl、nslookup、ping 等诊断工具用法

### Track B: 补课通道（建立系统性理解）

按顺序阅读，每篇都以你的实际场景为切入点：

**第一站：网络基础**
1. [一个数据包的一生](01-packet-journey/the-life-of-a-packet.md) — 按下 Ctrl+L 后数据包经历了什么
2. [DNS：互联网的电话簿](01-packet-journey/dns-the-phonebook.md) — 域名怎么变成 IP，以及为什么会被污染
3. [NAT 与 GFW](01-packet-journey/nat-and-gfw.md) — 为什么你需要翻墙
4. [TLS 信任链](01-packet-journey/tls-trust-chain.md) — HTTPS 的 S 到底在做什么

**第二站：代理协议**
5. [代理的本质](02-proxy-protocols/what-is-a-proxy.md) — 什么是代理，为什么需要代理
6. [SOCKS5 vs HTTP 代理](02-proxy-protocols/socks5-vs-http-proxy.md) — 两种基础代理协议
7. [翻墙协议演化史](02-proxy-protocols/shadowsocks-vmess-trojan.md) — SS → VMess → Trojan 的演化逻辑
8. [QUIC 系协议](02-proxy-protocols/quic-based-protocols.md) — Hysteria/TUIC 为什么更快
9. [协议选择速查表](02-proxy-protocols/protocol-cheatsheet.md)

**第三站：Clash 精通**
10. [Clash 核心架构](03-clash-mastery/architecture-overview.md) — 全局视角
11. [配置文件解剖](03-clash-mastery/config-anatomy.md) — 逐字段注释 + 区块依赖关系
12. [DNS 策略](03-clash-mastery/dns-strategy.md) — fake-ip vs redir-host
13. [规则引擎](03-clash-mastery/rule-engine.md) — 流量去哪由谁决定
14. [策略组](03-clash-mastery/proxy-groups.md) — select/url-test/fallback/load-balance
15. [TUN vs 系统代理](03-clash-mastery/tun-vs-system-proxy.md) — 两种流量劫持方式的本质区别
16. [Clash Verge 特有功能](03-clash-mastery/clash-verge-specific.md) — Mixin/Script/覆写

### 实战配置

- [带注释的基础配置](04-configs/annotated-base.yaml)
- [国内直连规则集](04-configs/rules-china-direct.yaml)
- [Cursor 优化覆写脚本](04-configs/cursor-optimized-override.js)
- [局域网共享配置](04-configs/lan-sharing.yaml)

### 附录

- [术语表](05-appendix/glossary.md) — 遇到不懂的词来这里查
- [GFW 封锁模式](05-appendix/gfw-patterns.md)
- [学习资源](05-appendix/useful-links.md)

## 学习建议

1. **先读 Track A**，保证下次出问题你能自救
2. **再按顺序读 Track B**，不要跳着读，后面的内容依赖前面的概念
3. **遇到不懂的术语**，去 [术语表](05-appendix/glossary.md) 查
4. **实际操作中遇到新问题**，更新排错决策树——这是一个活文档
