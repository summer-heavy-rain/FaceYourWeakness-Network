# Clash Verge 特有功能

> Clash Verge 不只是 mihomo 的 GUI 壳子——它在配置管理上加了一套自己的抽象层。
> 理解这套抽象层，你才能在"不碰订阅文件"的前提下，随心所欲地定制配置。

---

## 1. Clash Verge vs Clash Verge Rev

先理清一段历史，免得你搜教程时被搞糊涂。

| 项目 | 作者 | 状态 |
|------|------|------|
| **Clash Verge** | zzzgydi | 原作者于 2023 年停更 |
| **Clash Verge Rev** | 社区 fork | 活跃维护中，目前主流 |

两者的核心都是 **mihomo**（Clash Meta），UI 操作几乎一致。如果你现在安装的叫 "Clash Verge Rev"，本文的所有内容同样适用。后文统一称 "Clash Verge"。

**怎么判断你用的是哪个？** 打开 Clash Verge → 设置 → 关于（About），看版本号和项目链接。Rev 版本的仓库是 `clash-verge-rev/clash-verge-rev`。

---

## 2. Profiles 管理

Clash Verge 最独特的设计就是 **Profile Chain**（配置链）。你不需要直接编辑一个巨大的 YAML 文件——而是把配置分成多个层次，由 Clash Verge 自动合并成最终配置喂给 mihomo。

### 2.1 三种 Profile 类型

| 类型 | 来源 | 特点 |
|------|------|------|
| **Remote（远程订阅）** | 机场 URL，如 NxOnEarth 的订阅链接 | 自动更新，包含节点列表、基础规则、策略组 |
| **Local（本地文件）** | 手动创建的 `.yaml` 文件 | 完全由你控制，不会被覆盖 |
| **Merge / Script** | 覆写层 | 在订阅配置的基础上做增量修改 |

### 2.2 Profile Chain：配置是怎么合并的

```
NxOnEarth 订阅 YAML           你的 Mixin (YAML)           你的 Script (JS)
     │                              │                           │
     │  ┌───────────────────────────┘                           │
     ▼  ▼                                                       │
   YAML Merge（字段合并）                                        │
     │                                                          │
     │  ┌───────────────────────────────────────────────────────┘
     ▼  ▼
   Script 处理（JS 函数接收完整 config 对象，可以做任何修改）
     │
     ▼
   最终配置 → 喂给 mihomo 内核
```

**关键理解**：订阅文件每次更新都会被覆盖。你的自定义规则如果直接写在订阅文件里，下次更新就丢了。所以 Clash Verge 提供了 Mixin 和 Script 两种覆写机制——它们独立于订阅文件，不会被覆盖。

### 2.3 订阅配置的自动更新

Clash Verge → Profiles → 点击远程订阅右侧的刷新按钮（或设置自动更新间隔）。

- 更新只替换订阅文件本身
- Mixin 和 Script 不受影响
- 更新后 Clash Verge 自动重新走 Profile Chain 合并配置

**建议**：设置自动更新间隔为 24 小时。NxOnEarth 的节点列表会变化（节点下线、新增），定期更新能拿到最新节点。

---

## 3. Mixin（混入）

### 是什么

Mixin 是一段 YAML 片段，它会被**合并进**订阅配置。你可以用它来添加自定义规则、修改 DNS 设置、开启 TUN 模式——而不用碰订阅文件。

### 为什么需要

你想让 `cursor.exe` 的流量走代理，但 NxOnEarth 的订阅规则里没有这条。你有两个选择：

1. ❌ 直接编辑订阅 YAML → 下次更新被覆盖，白干
2. ✅ 写一个 Mixin → 永远生效，更新订阅不受影响

### 怎么用

Clash Verge → Profiles → 点击 "Global Merge"（全局合并）或创建一个新的 Merge 类型 Profile。

### 示例

```yaml
# Clash Verge Mixin 示例
# 这段配置会被合并进订阅配置

dns:
  enable: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - https://doh.pub/dns-query          # 腾讯 DoH，用于解析国内域名
    - https://dns.alidns.com/dns-query   # 阿里 DoH

rules:
  # 开发工具走代理
  - PROCESS-NAME,cursor.exe,PROXY
  - PROCESS-NAME,code.exe,PROXY
  - DOMAIN-SUFFIX,openai.com,PROXY
  - DOMAIN-SUFFIX,anthropic.com,PROXY
  # AI 服务
  - DOMAIN-SUFFIX,claude.ai,PROXY
```

### Mixin 的合并规则

这是你必须理解的**核心机制**：

| YAML 类型 | 合并行为 | 例子 |
|-----------|---------|------|
| **标量值**（字符串、数字、布尔） | 覆盖 | `log-level: debug` 会替换原来的 `log-level` |
| **对象/字典** | 深度合并 | `dns.enable: true` 会合并进原有的 `dns` 块 |
| **数组/列表** | **前置插入** | Mixin 的 `rules` 会被放到订阅 `rules` 的**前面** |

数组前置插入这个行为对 `rules` 来说通常是你想要的——你的自定义规则优先级比订阅规则更高（因为 Clash 规则是从上到下匹配，先匹配先生效）。

但如果你想**替换**整个数组（比如完全重写 `dns.nameserver`），Mixin 做不到。这时候需要 Script。

---

## 4. Script（脚本覆写）

### 是什么

Script 是一个 JavaScript 函数，它接收完整的配置对象（订阅 + Mixin 合并后的结果），你可以用 JS 对它做任意修改：删除字段、替换数组、条件判断、正则过滤……

### 为什么需要

Mixin 只能做"加法"（合并），Script 能做"减法"和"替换"。典型场景：

- 删掉订阅里你不想要的节点（比如过滤掉高倍率节点）
- 替换整个 DNS 配置
- 根据条件动态生成规则
- 重新排序规则
- 创建订阅里没有的策略组

### 怎么用

Clash Verge → Profiles → 点击 "Global Script"（全局脚本）或创建一个新的 Script 类型 Profile。

### 示例

```javascript
// Clash Verge Script 覆写
// 函数签名必须是 main(config)，返回修改后的 config

function main(config) {
  // === DNS 配置 ===
  config.dns = {
    enable: true,
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    listen: "0.0.0.0:1053",
    nameserver: [
      "https://doh.pub/dns-query",
      "https://dns.alidns.com/dns-query"
    ],
    fallback: [
      "https://dns.cloudflare.com/dns-query",
      "https://dns.google/dns-query"
    ],
    "fallback-filter": {
      geoip: true,
      "geoip-code": "CN"
    }
  };

  // === 在 rules 最前面插入自定义规则 ===
  const customRules = [
    "PROCESS-NAME,cursor.exe,PROXY",
    "PROCESS-NAME,code.exe,PROXY",
    "DOMAIN-SUFFIX,openai.com,PROXY",
    "DOMAIN-SUFFIX,anthropic.com,PROXY",
    "DOMAIN-SUFFIX,github.com,PROXY"
  ];
  config.rules = customRules.concat(config.rules || []);

  // === 过滤掉高倍率节点（名字里包含 "x3" "x5" 等） ===
  if (config.proxies) {
    config.proxies = config.proxies.filter(
      p => !/x[3-9]|×[3-9]|倍率[3-9]/i.test(p.name)
    );
  }

  return config;
}
```

### Script vs Mixin：怎么选

| 需求 | 用 Mixin | 用 Script |
|------|---------|----------|
| 添加几条规则 | ✅ 简单够用 | 大材小用 |
| 修改 DNS 某个字段 | ✅ | 可以但不必要 |
| 完全替换 DNS 配置 | ❌ 只能合并不能替换 | ✅ |
| 过滤/删除节点 | ❌ | ✅ |
| 条件逻辑（if/else） | ❌ | ✅ |
| 创建新的策略组 | ❌ 只能合并 | ✅ 完全控制 |
| 不懂 JavaScript | ✅ 只要会写 YAML | ❌ |

**实践建议**：先从 Mixin 开始，够用就不要用 Script。当你发现 Mixin 限制了你，再切换到 Script。两者也可以共存——先走 Mixin 合并，再走 Script 处理。

---

## 5. Service Mode（服务模式）

### 是什么

Service Mode 会安装一个 **Windows Service**（`Clash Verge Service`），以 **SYSTEM** 权限运行。

### 为什么需要

**TUN 模式需要创建虚拟网卡，这需要管理员权限。** 具体来说：

- 创建/删除 TUN adapter（虚拟网卡）
- 修改系统路由表
- 设置 DNS 劫持

如果不用 Service Mode，每次启动 Clash Verge 都需要点 UAC 弹窗授权管理员权限。Service Mode 让 mihomo 内核以系统服务身份运行，自动获得权限，不需要每次弹窗。

### 安装 / 卸载

**安装**：Clash Verge → 设置 → Service Mode → Install

安装后 Windows 服务列表里会多一个 `Clash Verge Service`（可以在 `services.msc` 里看到）。

**卸载**：同一个位置 → Uninstall

### 排错

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| Service 安装失败 | 没有管理员权限 | 右键 Clash Verge → "以管理员身份运行"，再安装 |
| TUN 模式开不了 | Service 没启动 | `services.msc` 里找到 Clash Verge Service，手动启动 |
| Service 状态异常 | 上次异常退出 | 先 Uninstall，重启电脑，再 Install |
| 与杀毒软件冲突 | 杀毒软件阻止服务安装 | 临时关闭杀毒软件，安装完再开 |

---

## 6. 日志查看

### 在哪看

Clash Verge → 左侧菜单 → **Logs**（日志）

日志实时滚动，显示 mihomo 内核的输出。你可以在这里看到：
- 每条连接的规则匹配结果
- DNS 解析记录
- 节点连接成功/失败
- 配置加载错误

### 日志文件位置

Clash Verge 的日志和配置文件存储在：

```
Windows: %USERPROFILE%\.config\clash-verge\    （旧版）
         %APPDATA%\io.github.clash-verge-rev.clash-verge-rev\    （Rev 版）
```

具体路径取决于版本。最靠谱的方法：Clash Verge → 设置 → Open App Dir。

### 常见日志消息解读

```
# 正常消息
INFO[0000] Start initial compatible provider ...   ← 正在加载订阅配置
INFO[0000] RESTful API listening at: 127.0.0.1:9097  ← API 接口启动
INFO[0000] TUN interface tun0 opened                 ← TUN 虚拟网卡创建成功

# 警告/错误
WARN[0000] can't find proxy xxx in group yyy         ← 策略组引用了不存在的节点名
ERROR[0000] Parse config error: ...                  ← 配置文件语法错误，看冒号后面的具体信息
ERROR[0000] Start TUN: permission denied             ← TUN 需要管理员权限，安装 Service Mode
```

### 日志级别

在配置文件中设置：

```yaml
log-level: info     # 可选值：silent, error, warning, info, debug
```

排错时改成 `debug` 可以看到更详细的信息（包括每条连接的匹配过程），但日志量会非常大。日常用 `info` 即可。

---

## 7. Clash Verge 的坑

这些是实际使用中你大概率会踩到的坑，按踩坑频率排序。

### 坑 1：YAML 语法错误导致 Core 崩溃

**现象**：修改 Mixin 后 Clash Verge 提示 "Core 启动失败"、"Parse config error"。

**原因**：YAML 对缩进极其敏感。一个多余的空格、少一个空格、Tab 和空格混用，都会导致解析失败。

**排查**：
1. 看 Clash Verge 日志里的错误信息，会告诉你第几行出错
2. 检查缩进——YAML 只能用**空格**，不能用 Tab
3. 冒号后面必须跟一个空格：`key: value`（✅） vs `key:value`（❌）
4. 字符串里有特殊字符（如 `#`、`:`）要加引号

**预防**：用 VS Code 编辑 YAML，安装 YAML 插件，语法错误会实时标红。

### 坑 2：文件编码必须是 UTF-8

**现象**：配置文件里写了中文注释，加载后乱码或报错。

**原因**：mihomo 只认 UTF-8 编码。如果你用 Windows 自带的记事本保存，默认可能是 UTF-8 with BOM 或 ANSI，都可能出问题。

**解决**：用 VS Code 打开，右下角确认编码是 `UTF-8`（不带 BOM）。

### 坑 3：Clash Verge "卡死"

**现象**：UI 无响应，或者点按钮没反应。

**常见原因**：
1. **DNS 解析挂起** — 最常见。如果 DNS 服务器不可达，mihomo 会阻塞在 DNS 解析上，表现为整个代理卡住。
2. **节点全部不可用** — 所有代理节点都连不上，mihomo 反复尝试。
3. **配置文件巨大** — 订阅里节点太多（几百个），加载和测速消耗大量资源。

**解决**：
1. 先尝试 **重启 Core**（Clash Verge → 设置 → Clash Core → Restart），而不是关闭整个程序
2. 如果 Core 重启没用，杀掉 mihomo 进程：`taskkill /f /im mihomo.exe`（PowerShell 管理员）
3. 如果频繁卡死，检查 DNS 配置——确保 `nameserver` 里的 DNS 服务器在国内网络下是可达的

### 坑 4：更新订阅后规则"消失"

**现象**：你在订阅 YAML 里手动加的规则，更新订阅后没了。

**原因**：订阅更新会完整替换订阅文件。你的手动修改被覆盖了。

**正解**：**永远不要直接编辑订阅文件。** 用 Mixin 或 Script 添加自定义配置。这是 Profile Chain 存在的全部意义。

### 坑 5：Mixin 的规则没生效

**现象**：在 Mixin 里加了 `rules`，但流量还是没走预期的策略组。

**排查**：
1. 确认 Mixin 已经启用（Profile 列表里有勾选标记）
2. 规则里引用的策略组名字必须和订阅配置里的一致。比如你写了 `PROXY`，但订阅配置里策略组叫 `🚀 节点选择`，就不会匹配。
3. 打开日志，看你的请求匹配了哪条规则——如果匹配的不是你的 Mixin 规则，说明在你的规则之前有更靠前的规则命中了。

**关键**：规则里的策略组名字必须精确匹配。打开 Clash Verge → Proxies 面板，看实际的策略组名字是什么。

### 坑 6：TUN 模式和系统代理同时开

**后果**：流量被双重拦截，可能导致回环（loop）——流量进入 Clash → 出去 → 又被系统代理设置送回 Clash → 循环。

**正解**：两种模式选其一。TUN 模式下不需要开系统代理。如果开了 TUN，去 Clash Verge 设置里关掉 "System Proxy"。

---

## 总结：Clash Verge 的心智模型

```
                    你的输入层
                ┌──────────────────┐
                │  Remote Profile  │  ← NxOnEarth 订阅
                │  (订阅 YAML)     │
                └────────┬─────────┘
                         │
                    ┌────▼─────┐
                    │  Mixin   │  ← 你的 YAML 覆写（增量合并）
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Script  │  ← 你的 JS 覆写（完全控制）
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ 最终配置  │  ← Clash Verge 自动合并的结果
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  mihomo  │  ← 真正处理网络流量的内核
                    └──────────┘
```

记住这个分层，你就不会再困惑"我改的东西怎么被覆盖了"或"我应该在哪改配置"。
