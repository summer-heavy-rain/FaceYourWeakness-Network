# 配置文件完整解剖

> "改了就炸"的根本原因：你不知道配置文件里各个区块之间的依赖关系。改了 A 不知道 B 会跟着崩。这篇文档解决这个问题。

## 1. 配置文件在哪

### 文件位置

Clash Verge 的配置文件存储在：

```
C:\Users\<你的用户名>\.config\clash-verge\   （旧版本）
C:\Users\<你的用户名>\.local\share\io.github.clash-verge-rev.clash-verge-rev\  （新版本）
```

关键文件和目录：

| 路径 | 说明 |
|------|------|
| `profiles/` | 存放所有订阅和本地配置文件 |
| `profiles/<hash>.yaml` | 某个订阅下载下来的原始配置 |
| `clash-verge.yaml` | Clash Verge 自身的设置（不是 Clash 内核配置） |
| `logs/` | mihomo 内核日志 |

### 配置的合并逻辑

这是很多人不理解的地方。Clash Verge 实际喂给 mihomo 的配置，**不是**你的订阅文件本身，而是经过多层合并的结果：

```
订阅配置（机场下发的 .yaml）
       │
       ▼
  Merge 覆写（如果设置了 Merge 类型的 Profile）
       │
       ▼
  Script 覆写（如果设置了 Script 类型的 Profile）
       │
       ▼
  最终配置 → 喂给 mihomo 内核
```

**这意味着**：你在 Clash Verge 的"订阅编辑"里看到的内容，可能和 mihomo 实际运行的配置不一样。如果你用了 Mixin/Script 覆写，改动会叠加上去。

排错时想看 mihomo 实际吃进去的配置，可以访问：

```
http://127.0.0.1:9097/configs
```

（9097 是默认的 `external-controller` 端口，具体端口看你的 General 配置。）

---

## 2. 六大区块

一份完整的 Clash 配置文件由六大区块组成。下面逐一拆解。

### Block 1: General（基础设置）

控制 Clash 内核的全局行为。

```yaml
# ═══════════════════════════════════════
# Block 1: General — 基础设置
# ═══════════════════════════════════════

mixed-port: 7897
# 混合代理端口。在这个端口上同时提供 HTTP 和 SOCKS5 代理。
# Cursor、浏览器等应用会连这个端口。
# 改了这个端口 → 所有配置了代理地址的应用都要改。

allow-lan: false
# 是否允许局域网内的其他设备连你的代理。
# 办公室共享时改为 true。
# 安全提示：公共网络下务必保持 false。

bind-address: '*'
# 监听地址。'*' 表示监听所有网卡。
# 仅当 allow-lan: true 时有意义。

mode: rule
# 运行模式，三个选项：
#   rule   — 按规则匹配（日常使用）
#   global — 所有流量都走代理（调试用）
#   direct — 所有流量都直连（等于关了代理）
# ⚠️ 改成 global/direct 会让 Rules 区块完全失效。

log-level: info
# 日志级别：silent / error / warning / info / debug
# 出问题时改成 debug 可以看到更多信息。

external-controller: 127.0.0.1:9097
# RESTful API 地址。Clash Verge 和 Yacd 等面板通过这个端口控制内核。
# 如果这个端口被占用，内核会启动失败。

secret: ''
# API 访问密钥。本机使用可以留空。
# 如果 external-controller 暴露到局域网，必须设一个密钥。
```

**常见翻车点**：
- 改了 `mixed-port` 但忘了更新 Cursor/浏览器里的代理端口设置
- 把 `mode` 改成了 `direct`，然后以为翻墙坏了
- `external-controller` 的端口被其他进程占用导致内核启动失败

---

### Block 2: DNS

控制 Clash 如何解析域名。这是最容易搞混的区块。

```yaml
# ═══════════════════════════════════════
# Block 2: DNS — 域名解析
# ═══════════════════════════════════════

dns:
  enable: true
  # 启用 Clash 内置 DNS 解析器。
  # 如果关闭，Clash 将依赖系统 DNS（大多数情况下你不想这样）。

  enhanced-mode: fake-ip
  # 两个选项：
  #   fake-ip    — 给域名分配假 IP，快，避免 DNS 污染（推荐）
  #   redir-host — 做真实 DNS 解析，兼容性更好但更慢
  # ⚠️ 这个选项影响 Rule Engine 的匹配行为（详见依赖关系图）。

  fake-ip-range: 198.18.0.1/16
  # fake-ip 使用的 IP 地址段。
  # 这个段的 IP 不会真正出现在互联网上，Clash 内部使用。
  # 一般不需要改。

  fake-ip-filter:
    - '*.lan'
    - '*.local'
    - 'localhost'
    # 不使用 fake-ip 的域名列表。
    # 这些域名会走真实 DNS 解析。
    # 通常用于局域网服务发现、mDNS 等场景。

  nameserver:
    - 223.5.5.5              # 阿里公共 DNS
    - 119.29.29.29           # 腾讯 DNSPod
    # 主 DNS 服务器，用于解析国内域名。
    # 这些是国内 DNS，响应快，但可能被 GFW 污染（对于境外域名）。

  fallback:
    - tls://8.8.8.8:853      # Google DNS over TLS
    - https://1.1.1.1/dns-query  # Cloudflare DNS over HTTPS
    # 备用 DNS 服务器，用于解析可能被污染的域名。
    # 使用加密协议（DoT/DoH），GFW 无法篡改结果。
    # 但因为服务器在境外，延迟较高。

  fallback-filter:
    geoip: true
    geoip-code: CN
    # fallback 过滤策略：
    # 当 nameserver 返回的 IP 不属于 CN（中国），
    # 则认为结果可能被污染，使用 fallback 的结果。
    # 这是一种启发式判断：国内域名解析出的 IP 应该在中国，
    # 如果解析出了境外 IP，大概率是 DNS 污染。
```

**DNS 解析的决策流程**：

```
域名需要解析
    │
    ├── 在 fake-ip-filter 列表中？
    │     是 → 走真实 DNS 解析（nameserver）
    │     否 ↓
    │
    ├── enhanced-mode 是 fake-ip？
    │     是 → 分配假 IP，不做真实解析
    │     否 ↓ （redir-host 模式）
    │
    ├── 同时查询 nameserver 和 fallback
    │
    └── nameserver 结果的 IP 属于 CN？
          是 → 用 nameserver 的结果（国内域名，没被污染）
          否 → 用 fallback 的结果（可能被污染，用加密 DNS 的结果）
```

**常见翻车点**：
- 把 `enhanced-mode` 从 `fake-ip` 改成 `redir-host`，导致规则匹配行为变化，很多规则失效
- `nameserver` 里填了境外 DNS（如 8.8.8.8），导致国内网站解析变慢
- `fallback` 里没有填加密 DNS，导致境外域名的 DNS 结果被污染

---

### Block 3: Proxies（代理节点）

每个 proxy 条目代表一台远端代理服务器。

```yaml
# ═══════════════════════════════════════
# Block 3: Proxies — 代理节点
# ═══════════════════════════════════════

proxies:
  - name: "US-Node-1"
    type: vmess
    server: us1.example.com
    port: 443
    uuid: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    alterId: 0
    cipher: auto
    tls: true
    network: ws
    ws-opts:
      path: /path
      headers:
        Host: us1.example.com

  - name: "JP-Node-1"
    type: trojan
    server: jp1.example.com
    port: 443
    password: your-password
    sni: jp1.example.com
```

**你通常不需要手动修改这个区块。** 它由机场订阅自动生成。

但你需要知道：
- **`name` 是唯一标识**：Proxy Groups 通过 `name` 引用节点。如果你手动改了节点名，引用它的策略组就找不到了。
- **每个节点的本质**：一个协议 + 一个服务器地址 + 认证信息。Clash 用这些信息建立到远端的加密隧道。
- **节点里的字段**：`type`（协议类型）、`server`（服务器地址）、`port`（端口）、加密和认证相关字段。不同协议的字段不同。

---

### Block 4: Proxy Groups（策略组）

策略组是配置文件中**最灵活也最容易搞混**的部分。

```yaml
# ═══════════════════════════════════════
# Block 4: Proxy Groups — 策略组
# ═══════════════════════════════════════

proxy-groups:
  - name: "Proxy"
    type: select
    proxies:
      - "Auto"
      - "US-Node-1"
      - "JP-Node-1"
      - "DIRECT"
    # 手动选择。在 Clash Verge UI 里点击切换。

  - name: "Auto"
    type: url-test
    proxies:
      - "US-Node-1"
      - "JP-Node-1"
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
    # 自动测速选最快的。
    # url: 用于测速的 URL（不需要翻墙就能访问的轻量 URL）
    # interval: 每 300 秒测一次（单位：秒）
    # tolerance: 延迟差在 50ms 以内的不切换（避免频繁切换）

  - name: "AI"
    type: select
    proxies:
      - "US-Node-1"
      - "US-Node-2"
    # 专门给 AI 服务用的策略组。
    # OpenAI、Claude 等只对特定地区开放，所以单独建一个组。

  - name: "Final"
    type: select
    proxies:
      - "Proxy"
      - "DIRECT"
    # 兜底策略组。没有被任何规则匹配的流量走这里。
```

**策略组的四种类型**：

| 类型 | 行为 | 何时用 |
|------|------|--------|
| `select` | 手动选择一个节点或子策略组 | 你想精确控制的流量（如 AI 服务） |
| `url-test` | 自动选延迟最低的节点 | 日常浏览、GitHub 等 |
| `fallback` | 按列表顺序选第一个可用的节点 | 优先级排序，保证可用性 |
| `load-balance` | 分散流量到多个节点 | 大流量下载（少用） |

**关键理解**：策略组可以嵌套。一个 `select` 组的选项里可以包含另一个 `url-test` 组。这样你可以先手动选地区（select），地区内部自动选最快的节点（url-test）。

**常见翻车点**：
- 策略组的 `proxies` 里引用了不存在的节点名 → 内核报错
- 改了策略组的 `name` 但没改 Rules 里的引用 → 内核报错
- `url-test` 的 `url` 设成了一个需要翻墙才能访问的地址 → 测速永远失败

---

### Block 5: Rule Providers（规则提供者）

规则可以很长（几千条），写在配置文件里不现实。Rule Providers 允许从外部加载规则集。

```yaml
# ═══════════════════════════════════════
# Block 5: Rule Providers — 外部规则集
# ═══════════════════════════════════════

rule-providers:
  reject:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt"
    path: ./ruleset/reject.yaml
    interval: 86400
    # 广告域名列表。每 86400 秒（24小时）更新一次。

  proxy:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt"
    path: ./ruleset/proxy.yaml
    interval: 86400
    # 需要代理的域名列表。

  direct:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt"
    path: ./ruleset/direct.yaml
    interval: 86400
    # 国内直连的域名列表。

  cncidr:
    type: http
    behavior: ipcidr
    url: "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt"
    path: ./ruleset/cncidr.yaml
    interval: 86400
    # 中国 IP 段列表。
```

**关键字段**：
- `type`: `http`（从 URL 下载）或 `file`（本地文件）
- `behavior`: `domain`（域名匹配）、`ipcidr`（IP 段匹配）、`classical`（混合类型）
- `interval`: 多久更新一次（秒）
- `path`: 下载后缓存到本地的路径

**Rule Providers 本身不生效**，它只是定义了规则集的来源。要在 Rules 区块里用 `RULE-SET` 类型来引用它。

---

### Block 6: Rules（规则）

这是决定"哪些流量走哪条路"的最终裁判。

```yaml
# ═══════════════════════════════════════
# Block 6: Rules — 路由规则
# ═══════════════════════════════════════

rules:
  # ---- 特殊流量 ----
  - DOMAIN-SUFFIX,openai.com,AI           # OpenAI → AI 策略组
  - DOMAIN-SUFFIX,anthropic.com,AI        # Claude → AI 策略组
  - DOMAIN-KEYWORD,github,Proxy           # GitHub → Proxy 策略组

  # ---- 引用 Rule Provider 定义的规则集 ----
  - RULE-SET,reject,REJECT                # 广告域名 → 屏蔽
  - RULE-SET,proxy,Proxy                  # 需要代理的域名 → Proxy 策略组
  - RULE-SET,direct,DIRECT                # 国内域名 → 直连
  - RULE-SET,cncidr,DIRECT                # 中国 IP 段 → 直连

  # ---- GeoIP 兜底 ----
  - GEOIP,CN,DIRECT                       # 目标 IP 在中国 → 直连

  # ---- 最终兜底 ----
  - MATCH,Final                            # 以上都不匹配 → Final 策略组
```

**规则匹配是自上而下、首次命中即停止的。** 顺序非常重要。

**常用规则类型**：

| 类型 | 语法 | 匹配对象 |
|------|------|----------|
| `DOMAIN` | `DOMAIN,example.com,Proxy` | 精确匹配域名 |
| `DOMAIN-SUFFIX` | `DOMAIN-SUFFIX,google.com,Proxy` | 匹配域名后缀（含子域名） |
| `DOMAIN-KEYWORD` | `DOMAIN-KEYWORD,github,Proxy` | 域名包含关键词 |
| `IP-CIDR` | `IP-CIDR,91.108.4.0/22,Proxy` | 目标 IP 在指定网段 |
| `GEOIP` | `GEOIP,CN,DIRECT` | 目标 IP 属于指定国家 |
| `PROCESS-NAME` | `PROCESS-NAME,cursor.exe,Proxy` | 发起请求的进程（mihomo 独有） |
| `RULE-SET` | `RULE-SET,proxy,Proxy` | 引用 Rule Provider 定义的规则集 |
| `MATCH` | `MATCH,Final` | 匹配所有（兜底） |

**规则的第三个字段**（如 `Proxy`、`AI`、`DIRECT`）必须是以下之一：
- 一个已定义的 Proxy Group 名称
- `DIRECT`（直连，内置）
- `REJECT`（拒绝，内置）

**常见翻车点**：
- 忘了 `MATCH` 兜底规则 → 未匹配的流量被丢弃 → 部分网站打不开
- 规则引用了不存在的 Proxy Group 名称 → 内核报错启动失败
- 规则顺序不对 → 比如 `GEOIP,CN,DIRECT` 放在 `RULE-SET,proxy,Proxy` 前面，导致某些 CDN 的中国节点被直连，但实际内容需要代理

---

## 3. 区块依赖关系图 —— 最重要的部分

**"改了就炸"的根本原因就是不理解这张图。**

```
                    ┌──────────────┐
                    │   General    │
                    │  (基础设置)   │
                    └──────┬───────┘
                           │
                   mode: rule/global/direct
                   决定 Rules 是否生效
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  ┌──────────┐    ┌────────────────┐   ┌──────────────┐
  │   DNS    │    │  Rule Providers│   │   Proxies    │
  │ (域名解析)│    │  (外部规则集)   │   │  (代理节点)   │
  └────┬─────┘    └───────┬────────┘   └──────┬───────┘
       │                  │                   │
       │ DNS 模式影响      │ 规则集被           │ 节点被策略组
       │ 规则的匹配方式     │ Rules 引用         │ 引用
       │                  │                   │
       │           ┌──────▼───────┐           │
       └──────────►│    Rules     │◄──────────┘
                   │   (规则)     │     （间接依赖：
                   └──────┬───────┘      Rules 引用的是
                          │              Proxy Groups，
                   Rules 引用            Proxy Groups
                   Proxy Groups          引用 Proxies）
                   的名称
                          │
                   ┌──────▼───────┐
                   │ Proxy Groups │
                   │  (策略组)     │
                   └──────┬───────┘
                          │
                   策略组引用
                   Proxies 的名称
                          │
                   ┌──────▼───────┐
                   │   Proxies    │
                   │  (代理节点)   │
                   └──────────────┘
```

### 依赖关系速查表

| 如果你改了… | 可能影响… | 怎么检查 |
|------------|----------|---------|
| Proxy 节点的 `name` | 引用该名称的 Proxy Groups | 全局搜索该名称 |
| Proxy Group 的 `name` | 引用该名称的 Rules | 全局搜索该名称 |
| Proxy Group 的 `name` | 引用该名称的其他 Proxy Groups（嵌套） | 全局搜索该名称 |
| DNS 的 `enhanced-mode` | Rules 中基于域名的规则可能失效 | 检查规则是否依赖域名匹配 |
| General 的 `mode` | `global`/`direct` 会跳过所有 Rules | 确认你是故意的 |
| General 的 `mixed-port` | 所有配了代理端口的应用 | 更新应用端口设置 |
| Rule Provider 的 `name` | Rules 中 `RULE-SET,<name>` 的引用 | 全局搜索该名称 |
| 删除最后一条 `MATCH` 规则 | 未匹配的流量被丢弃 | 确保 `MATCH` 永远存在 |

### 依赖关系的本质

用编程的类比：

```
Proxies     = 底层对象（具体的服务器实例）
Proxy Groups = 抽象层（策略模式：select/url-test/fallback）
Rules        = 路由表（if-else 链，决定流量走哪个抽象层）
DNS          = 预处理器（影响 Rules 的输入数据）
General      = 全局开关（mode 可以 bypass 整个 Rules）
```

引用关系是 **字符串匹配（name-based binding）** ——和 CSS class name 一样脆弱。Clash 没有 IDE 帮你检查引用完整性，名字写错了就是运行时报错。

---

## 4. 为什么"改了就炸"—— 六种经典翻车

### 翻车 1: 改了策略组名字，忘了改 Rules

```yaml
# 你把策略组名从 "Proxy" 改成了 "翻墙"
proxy-groups:
  - name: "翻墙"        # ← 改了这里
    type: select
    ...

rules:
  - DOMAIN-SUFFIX,google.com,Proxy   # ← 忘了改这里！
  # 内核找不到名为 "Proxy" 的策略组 → 启动失败
```

### 翻车 2: Rules 引用了不存在的策略组

```yaml
rules:
  - DOMAIN-SUFFIX,openai.com,AI
  # 但 proxy-groups 里根本没有定义 "AI" 这个策略组 → 启动失败
```

### 翻车 3: YAML 缩进错误

```yaml
# 错误：proxies 的缩进多了两个空格
proxy-groups:
  - name: "Proxy"
    type: select
      proxies:           # ← 这里缩进错了！应该和 type 对齐
        - "US-Node-1"
```

YAML 对缩进极其敏感。必须用空格（不是 Tab），层级关系完全靠缩进表达。多一个少一个空格就可能改变语义或直接报错。

### 翻车 4: DNS 模式和规则不匹配

```yaml
dns:
  enhanced-mode: redir-host    # 用了 redir-host 模式

rules:
  - DOMAIN-SUFFIX,google.com,Proxy
  # redir-host 模式下，如果 DNS 先解析了 google.com 的 IP，
  # 系统可能用 IP 发起连接，Clash 此时可能匹配不到 DOMAIN-SUFFIX 规则。
  # （mihomo 对此有优化，但在边缘场景下可能出问题）
```

一般来说，**用 fake-ip 就对了**，除非你有明确的理由使用 redir-host。

### 翻车 5: 没有 MATCH 兜底规则

```yaml
rules:
  - DOMAIN-SUFFIX,google.com,Proxy
  - GEOIP,CN,DIRECT
  # 缺少 MATCH 兜底！
  # 任何不匹配以上规则的流量会被丢弃。
  # 比如访问一个冷门国外网站 → 直接打不开。
```

### 翻车 6: 订阅更新覆盖了你的修改

你在订阅配置里手动加了一条 Rule，然后点了"更新订阅"——机场下发了新的配置，你的修改被覆盖了。

**解决方案**：永远不要直接修改订阅配置。用 Clash Verge 的 Merge/Script 功能来覆写。这些覆写不会被订阅更新影响。

---

## 5. 安全修改原则

### 原则 1: 永远保留可回滚的状态

在修改前，在 Clash Verge 里复制一份当前 Profile。如果改炸了，切回旧的 Profile 即可恢复。

### 原则 2: 用 Merge/Script，不要直接改订阅

所有自定义修改应该通过 Clash Verge 的覆写功能来做：

- **Merge 类型**：用 YAML 合并语法，适合追加规则、修改 General 设置
- **Script 类型**：用 JavaScript 修改配置对象，适合复杂逻辑（如按条件修改节点名）

这样订阅更新不会覆盖你的修改。

### 原则 3: 每次只改一个东西

改了 DNS 设置，先测试。再改 Rules，再测试。不要同时改三个地方——出了问题你不知道是哪个改动导致的。这就是**变量控制**。

### 原则 4: 改完看日志

Clash Verge → Logs 面板，或者直接看日志文件。常见的错误信息：

| 日志关键词 | 含义 |
|-----------|------|
| `proxy group "xxx" not found` | Rules 引用了不存在的策略组 |
| `proxy "xxx" not found` | 策略组引用了不存在的节点 |
| `yaml: line X: ...` | YAML 语法错误，看行号 |
| `dns resolve failed` | DNS 解析失败 |
| `dial timeout` | 连接超时（节点挂了或被封） |

### 原则 5: 验证 YAML 语法

在保存配置之前，用在线 YAML 验证器检查语法：

- https://www.yamllint.com/
- 或者在 VS Code 里安装 YAML 插件，保存时自动检查

### 原则 6: 理解你改的是哪一层

回顾 [架构总览](architecture-overview.md) 中的模型：

```
你的应用 → [Inbound] → [DNS] → [Rules] → [Proxy Groups] → [Outbound] → 互联网
```

在动手前问自己：
1. 我改的是哪个区块？
2. 这个区块被谁依赖？（看依赖关系图）
3. 改完后需要更新哪些相关区块？

---

## 快速参考：配置文件模板骨架

```yaml
# === General ===
mixed-port: 7897
allow-lan: false
mode: rule
log-level: info
external-controller: 127.0.0.1:9097

# === DNS ===
dns:
  enable: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver: [223.5.5.5, 119.29.29.29]
  fallback: [tls://8.8.8.8:853, https://1.1.1.1/dns-query]
  fallback-filter: { geoip: true, geoip-code: CN }

# === Proxies ===（由订阅自动生成）
proxies:
  - { name: "节点1", type: vmess, server: ..., ... }

# === Proxy Groups ===（引用 Proxies 的 name）
proxy-groups:
  - { name: "Proxy", type: select, proxies: ["Auto", "节点1", "DIRECT"] }
  - { name: "Auto", type: url-test, proxies: ["节点1", ...], url: "http://www.gstatic.com/generate_204", interval: 300 }

# === Rule Providers ===（定义外部规则集来源）
rule-providers:
  proxy: { type: http, behavior: domain, url: "...", path: ./ruleset/proxy.yaml, interval: 86400 }

# === Rules ===（引用 Proxy Groups 和 Rule Providers 的 name）
rules:
  - RULE-SET,proxy,Proxy
  - GEOIP,CN,DIRECT
  - MATCH,Proxy              # ← 永远保留兜底！
```

看着这个骨架，从上到下，每个区块的引用关系应该一目了然了。
