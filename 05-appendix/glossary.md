# 术语表

> 遇到不懂的词就来这里查。按英文字母排序，中文解释，英文术语保留原样。

---

### Allow-LAN

Clash 的一个配置选项，开启后允许局域网内的其他设备通过你的 Clash 代理上网。比如你的同事把代理地址设为你的内网 IP + 端口，就能共享你的翻墙服务。关闭时只有本机（`127.0.0.1`）能连接 Clash。

---

### Bind Address

Clash 监听的网络地址。设为 `127.0.0.1` 表示只允许本机连接；设为 `0.0.0.0` 表示允许所有网络接口的连接（配合 Allow-LAN 实现局域网共享）。搞不清楚的话就记住：本机用 `127.0.0.1`，共享用 `0.0.0.0`。

---

### CDN (Content Delivery Network)

**English**: Content Delivery Network

内容分发网络。CDN 在全球部署很多服务器节点，让用户从最近的节点获取资源（图片、JS、CSS 等）。在代理场景中需要注意：CDN 域名通常不需要走代理（国内有节点），但某些被墙的 CDN（如 `cdnjs.cloudflare.com`）需要。规则配置中要区分对待。

---

### Clash Meta / mihomo

Clash 的一个增强分支内核，原名 Clash.Meta，现改名为 mihomo。相比原版 Clash（已归档停止维护），它支持更多协议（如 VLESS、Hysteria2）和更强的功能（如 TUN 模式改进、进程规则匹配）。Clash Verge 默认使用 mihomo 作为内核。

---

### Clash Verge / Clash Verge Rev

Clash 的 GUI 客户端。原版 Clash Verge 停止维护后，社区 fork 了 Clash Verge Rev（继续开发）。它提供了图形界面来管理 Clash 内核（mihomo），支持 Mixin 覆写、订阅管理、规则编辑等功能。你日常操作的那个带托盘图标的软件就是它。

---

### DNS (Domain Name System)

**English**: Domain Name System

域名系统，互联网的"电话簿"。把人能读的域名（如 `google.com`）翻译成机器需要的 IP 地址（如 `142.250.80.46`）。在翻墙场景中，DNS 是最关键也最脆弱的环节之一——GFW 可以通过污染 DNS 响应来阻止你访问被墙网站。Clash 内置了 DNS 模块来解决这个问题。

---

### DNS Leak

DNS 泄漏。指即使你开了代理，DNS 查询却没有走代理通道，而是直接发给了本地 ISP 的 DNS 服务器。后果：你的 ISP 能看到你在访问什么域名（虽然看不到内容）。在 Clash 中，正确配置 DNS 并使用 TUN 模式可以有效避免 DNS 泄漏。

---

### DNS Pollution / DNS Poisoning

DNS 污染 / DNS 投毒。GFW 的一种封锁手段：当你向 DNS 服务器查询被墙域名时，GFW 抢先返回一个假的 IP 地址，导致你根本连不到真正的目标服务器。这就是为什么你用国内 DNS 查 `google.com` 会得到一个错误 IP。Clash 通过 fake-ip 或 fallback DNS 来对抗污染。

---

### DoH (DNS over HTTPS)

**English**: DNS over HTTPS

把 DNS 查询包装在 HTTPS 协议中发送。传统 DNS 查询走明文 UDP 53 端口，容易被 GFW 监听和篡改。DoH 把查询塞进 HTTPS 流量里，GFW 无法区分它和普通 HTTPS 请求。Clash 支持配置 DoH 上游服务器，比如 `https://dns.google/dns-query`。

---

### DoT (DNS over TLS)

**English**: DNS over TLS

和 DoH 类似，也是加密 DNS 查询，但走专用的 853 端口。优点是更"纯粹"（不复用 HTTPS 端口），缺点是 GFW 可以直接封 853 端口。在中国大陆环境下，DoH 通常比 DoT 更可靠。

---

### Fake-IP

Clash DNS 的一种工作模式。当应用查询域名时，Clash 不去真正解析，而是立刻返回一个假的 IP（通常在 `198.18.0.0/16` 段），同时记录"这个假 IP 对应哪个域名"。当应用用这个假 IP 发起连接时，Clash 根据映射表找到域名，再通过代理节点去解析真实 IP。好处：速度快（不用等 DNS 解析），且完全避免 DNS 污染。缺点：某些直连应用可能因为拿到假 IP 而出问题。

---

### Fallback (DNS / Proxy Group)

兜底 / 回退机制，在两个场景中出现：

1. **DNS Fallback**：Clash DNS 配置中的 `fallback` 服务器列表。当主 DNS（`nameserver`）的结果被判定为可疑（如返回了国内 IP 但域名属于国外），Clash 会用 fallback 列表中的 DNS（通常是 DoH）重新查询，取信 fallback 的结果。
2. **Proxy Group Fallback**：一种策略组类型。按顺序尝试节点，第一个能用的就用，挂了自动切下一个。比 url-test 更保守，适合稳定性优先的场景。

---

### GFW (Great Firewall)

**English**: Great Firewall

中国国家防火墙，官方名称"金盾工程"的一部分。它通过 DNS 污染、IP 封锁、深度包检测（DPI）、TCP 重置等手段阻止中国大陆用户访问境外特定网站和服务。你需要 Clash 的根本原因就是它。

---

### GeoIP

基于 IP 地址判断地理位置的数据库/技术。Clash 使用 GeoIP 数据库来判断一个 IP 属于哪个国家/地区。规则中 `GEOIP,CN,DIRECT` 的意思是"如果目标 IP 属于中国，就直连不走代理"。GeoIP 数据库需要定期更新，否则可能误判。

---

### HTTP CONNECT

HTTP 协议中的一个方法，用来建立隧道（tunnel）。当浏览器要通过 HTTP 代理访问 HTTPS 网站时，它会先发一个 `CONNECT` 请求告诉代理"帮我和目标建立一条 TCP 隧道"，然后在这条隧道里跑 TLS 加密流量。代理只知道你连了哪个域名，看不到具体内容。

---

### Hysteria / Hysteria2

基于 QUIC 协议的翻墙协议。QUIC 本身基于 UDP，不像 TCP 那样容易被 GFW 的 TCP 重置攻击干扰。Hysteria2 是第二代，改善了性能和伪装能力。在网络质量差、丢包率高的环境下，Hysteria 通常比基于 TCP 的协议（如 Trojan、VMess）表现更好。mihomo 内核支持 Hysteria2。

---

### IP-CIDR

一种 Clash 规则类型，用来匹配 IP 地址段。CIDR（Classless Inter-Domain Routing）是一种 IP 地址表示法，比如 `10.0.0.0/8` 表示"以 10 开头的所有 IP"。在规则中写 `IP-CIDR,10.0.0.0/8,DIRECT` 意思是"目标 IP 在这个段的流量直连"。常用于让内网流量跳过代理。

---

### Keep-Alive

保持连接存活的机制。TCP 连接建立后，如果长时间没有数据传输，中间的路由器/NAT/防火墙可能会把连接断掉。Keep-Alive 通过定期发送小数据包来告诉网络设备"这条连接还在用，别断"。在代理场景中，合理的 Keep-Alive 设置可以减少频繁重连的开销。

---

### Latency / RTT

**English**: Round-Trip Time

延迟 / 往返时间。一个数据包从你的电脑到目标服务器再返回所花的时间，单位毫秒（ms）。Clash 策略组中的 url-test 会定期测量各节点的延迟，自动选择最快的节点。延迟越低越好。通常香港节点延迟 40-80ms，日本 60-120ms，美国 150-250ms。

---

### Load Balance

负载均衡。Clash 策略组的一种类型，把流量分散到多个节点上。不是选最快的一个（那是 url-test），而是让多个节点同时干活。适合需要大量并发连接的场景（如 npm install 同时拉几十个包），但可能导致同一个网站看到你的请求来自不同 IP。

---

### Mixed Port

Clash 的混合端口，同时支持 HTTP 和 SOCKS5 两种代理协议。配置一个端口就能应对两种协议的需求，省事。你的 `7897` 就是 mixed-port。应用连它的时候，用 `http://127.0.0.1:7897` 或 `socks5://127.0.0.1:7897` 都行。

---

### Mixin

Clash Verge 特有的功能。允许你在不修改订阅原始配置文件的情况下，"混入"你自己的配置内容。比如机场给你的订阅有 100 条规则，你想加 5 条自己的规则，不用改原始文件，在 Mixin 里写就行。订阅更新时你的修改不会丢。非常实用的功能。

---

### NAT (Network Address Translation)

**English**: Network Address Translation

网络地址转换。你家路由器只有一个公网 IP，但你有手机、电脑、平板等多个设备。NAT 把这些设备的内网地址（如 `192.168.1.x`）和路由器的公网地址之间做映射，让所有设备共享一个公网 IP 上网。翻墙场景中，某些协议（如 Hysteria/QUIC）对 NAT 类型敏感，NAT 类型太严格可能导致连接不稳。

---

### Node / 节点

在代理语境中，节点就是一台部署了翻墙协议服务端的远程服务器。你的机场（NxOnEarth）在全球多个地区部署了节点，每个节点有自己的 IP、端口、协议类型。Clash 配置中的 `proxies` 部分列出了所有可用节点。

---

### PAC (Proxy Auto-Configuration)

**English**: Proxy Auto-Configuration

代理自动配置。一个 JavaScript 文件，定义了哪些 URL 走代理、哪些直连。这是一种比较老的分流方式。Clash 的规则系统比 PAC 强大得多，所以一般不需要 PAC。但某些企业环境或特殊应用可能还在用。

---

### Port

端口。一台电脑上可以运行很多网络程序，端口号用来区分不同的程序。范围是 0-65535。Clash 监听 `7897` 端口收代理请求，用 `9097` 端口提供 API。端口冲突（两个程序抢同一个端口）是常见问题——用 `netstat -ano | findstr "端口号"` 排查。

---

### Process Name (规则类型)

Clash（mihomo）的一种规则匹配方式，根据发起网络请求的进程名称来分流。比如 `PROCESS-NAME,cursor.exe,Proxy` 表示所有 `cursor.exe` 发出的流量都走代理。这比按域名匹配更精确，特别适合那些你知道一定需要代理的应用。需要 TUN 模式或 Service Mode 才能获取进程信息。

---

### Protocol (协议)

协议是通信双方约定好的"语言"。网络中有各层级的协议：TCP/UDP 是传输层，HTTP/HTTPS 是应用层，Shadowsocks/VMess/Trojan 是翻墙协议。选翻墙协议时要考虑：抗检测能力（GFW 能不能识别）、性能、稳定性。

---

### Proxy Group / 策略组

Clash 中把多个节点组织在一起的逻辑容器。策略组定义了"从这些节点中怎么选一个来用"。常见类型有：Select（手动选）、URL-Test（自动选最快）、Fallback（按顺序兜底）、Load-Balance（负载均衡）。规则的目标可以是一个节点，也可以是一个策略组。

---

### Proxy Provider

代理节点的外部数据源。不把节点直接写在配置文件里，而是指向一个 URL（通常是机场的订阅链接）。Clash 定期从这个 URL 拉取最新的节点列表。好处：机场加减节点时你不用手动改配置。你的 NxOnEarth 订阅就是通过 Proxy Provider 机制加载的。

---

### Redir-Host

Clash DNS 的另一种工作模式（相对于 Fake-IP）。收到域名查询时，Clash 会真正去解析域名拿到真实 IP 并返回给应用。好处是兼容性比 Fake-IP 好（应用拿到的是真实 IP），缺点是解析过程中有可能被 DNS 污染。目前 mihomo 推荐使用 Fake-IP 模式。

---

### Rule / 规则

Clash 分流系统的核心概念。每条规则定义了"满足某个条件的流量，发往哪里"。格式是 `类型,值,目标`，比如 `DOMAIN-SUFFIX,google.com,Proxy` 表示"所有以 google.com 结尾的域名走代理"。规则按顺序匹配，匹配到即停。最后一条通常是 `MATCH,兜底策略`。

---

### Rule Provider

和 Proxy Provider 类似的概念，但针对规则。把规则集放在外部文件或 URL 中，Clash 自动拉取和更新。比如你可以引用一个社区维护的"国内域名直连列表"，不用自己一条条写。常见格式有 YAML 和文本格式。

---

### Select (策略组类型)

最基础的策略组类型——手动选择。你在 Clash 界面上手动点选用哪个节点。适合需要精确控制走哪个国家/地区的场景（比如某些网站只对日本 IP 开放）。

---

### Service Mode

Clash Verge 的一个运行模式。以系统服务的形式安装 Clash 内核，获得更高权限。主要用途：创建 TUN 虚拟网卡时需要管理员权限，Service Mode 可以避免每次都手动"以管理员身份运行"。安装后 Clash 核心作为 Windows 服务常驻后台。

---

### Shadowsocks (SS)

最早一批广泛使用的翻墙协议之一，由 clowwindy 在 2012 年创建。原理是用对称加密把流量包装成看起来随机的数据。优点是简单、轻量、速度快。缺点是流量特征已经被 GFW 大量学习，容易被识别和封锁。现在主要作为基础或备用协议使用。

---

### SOCKS5

一种通用的代理协议，工作在传输层，可以代理任意 TCP（和可选的 UDP）流量。比 HTTP 代理更底层、更通用——HTTP 代理只能代理 HTTP/HTTPS 流量，SOCKS5 什么 TCP 流量都能转发。Clash 的 mixed-port 同时支持 HTTP 和 SOCKS5。

---

### Subscription / 订阅

机场提供给你的一个 URL，包含了所有可用节点的信息（加密的）。Clash 从这个 URL 下载节点列表并加载到配置中。你需要定期"更新订阅"来获取最新的节点信息（机场可能增减节点或更换 IP）。订阅链接是敏感信息，不要分享给不信任的人。

---

### TCP

**English**: Transmission Control Protocol

传输控制协议。互联网最基础的传输协议之一。特点是可靠——保证数据按序、完整地到达（通过确认机制和重传）。HTTP、HTTPS、SSH 等应用层协议都跑在 TCP 上。翻墙协议中，大多数（如 Trojan、VMess）基于 TCP。缺点是 GFW 可以通过发送 RST 包来强制切断 TCP 连接。

---

### TLS (Transport Layer Security)

**English**: Transport Layer Security

传输层安全协议。给通信加密的标准方案，HTTPS 中的"S"就是它。TLS 保证两件事：数据在传输中不被窃听、你连的确实是目标服务器（不是中间人）。Trojan 协议的核心思路就是把翻墙流量伪装成普通的 TLS（HTTPS）流量，让 GFW 难以区分。

---

### Trojan

一种翻墙协议。核心思路是"藏在 TLS 中"——把代理流量伪装成标准的 HTTPS 连接。GFW 看到的就是一个正常的 HTTPS 请求，很难区分它和真正的网站访问。比 VMess 更简洁，性能开销更低。目前是最主流的翻墙协议之一。

---

### TUN (Network TUNnel)

**English**: Network TUNnel

一种虚拟网卡技术。Clash 在 TUN 模式下会创建一个虚拟网卡，把系统的所有网络流量（不只是设了代理的应用）都劫持到 Clash 中处理。相比系统代理模式，TUN 模式可以捕获更多流量（包括不走系统代理的应用），是更彻底的全局代理方式。需要管理员权限或 Service Mode。

---

### UDP

**English**: User Datagram Protocol

用户数据报协议。和 TCP 相对，UDP 不保证可靠传输——发了就完事，不管你收没收到。优点是快、延迟低。DNS 查询、游戏、视频通话通常用 UDP。翻墙场景中，基于 UDP 的协议（如 Hysteria/QUIC）可以绕过 GFW 的 TCP RST 攻击。但某些网络环境会限制或丢弃 UDP 流量。

---

### URL-Test (策略组类型)

Clash 策略组的一种类型。定期对组内所有节点进行延迟测试（访问指定 URL），自动选择延迟最低的节点。适合"我不想手动管，自动选最快的就行"的场景。配置参数包括测试间隔（`interval`）和容差（`tolerance`，避免频繁切换）。

---

### VMess / VLESS

V2Ray 项目设计的翻墙协议。VMess 包含加密和认证，VLESS 是简化版（去掉了加密层，依赖外层 TLS 加密）。VMess 曾经是主流，但因为协议特征被 GFW 学习，现在逐渐被 Trojan 和 VLESS + Reality 等方案取代。mihomo 内核同时支持两者。

---

### WebSocket (WS)

一种在 HTTP 连接上建立全双工通信的协议。在翻墙中，WebSocket 常作为传输层套在翻墙协议外面，让流量看起来像普通的 Web 通信。比如 `VMess + WS + TLS` 组合的流量在 GFW 看来就是一个正常的 HTTPS WebSocket 连接。还能利用 CDN（如 Cloudflare）中转，隐藏真实服务器 IP。
