# 规则引擎：流量去哪由谁决定

> Clash 的规则系统就是一个 if-else 链。听起来简单，但顺序错了、漏了、理解偏了，就是"有的网站能上有的不行"的噩梦。

---

## 1. 规则的本质

每一个经过 Clash 的网络连接，都需要一个裁决：

- **DIRECT** — 直连，不走代理，直接连目标服务器
- **Proxy（某个代理节点或策略组）** — 走代理，通过远端服务器中转
- **REJECT** — 拒绝，丢弃这个连接（用来屏蔽广告、追踪器等）

Clash 怎么做出这个裁决？**从上到下遍历规则列表，第一条匹配的规则胜出。**

```yaml
rules:
  - DOMAIN-SUFFIX,google.com,Proxy        # 规则 1
  - DOMAIN-SUFFIX,baidu.com,DIRECT        # 规则 2
  - GEOIP,CN,DIRECT                       # 规则 3
  - MATCH,Proxy                           # 规则 4（兜底）
```

假设一个连接的目标是 `www.google.com`：

1. 检查规则 1：`DOMAIN-SUFFIX,google.com` → `www.google.com` 以 `google.com` 结尾 → **命中！** → 走 Proxy
2. 后面的规则不再检查

假设目标是 `some-random-site.xyz`：

1. 规则 1：不匹配
2. 规则 2：不匹配
3. 规则 3：不匹配（非中国 IP）
4. 规则 4：`MATCH` 匹配一切 → 走 Proxy

**如果没有 `MATCH` 兜底规则，不匹配任何规则的流量会被静默丢弃。** 所以最后一条必须是 `MATCH`。

---

## 2. 规则类型详解

### DOMAIN — 精确域名匹配

```yaml
- DOMAIN,api.openai.com,Proxy
```

只匹配 `api.openai.com`，不匹配 `www.openai.com`，也不匹配 `openai.com`。

**用途**：当你需要精确控制某个子域名的走向时。比如 `api.openai.com` 走代理，但假设 `cdn.openai.com` 有国内 CDN 节点可以直连（这只是举例）。

---

### DOMAIN-SUFFIX — 域名后缀匹配（最常用）

```yaml
- DOMAIN-SUFFIX,openai.com,Proxy
```

匹配所有以 `openai.com` 结尾的域名：`openai.com`、`api.openai.com`、`chat.openai.com`、`cdn.openai.com` —— 全部命中。

**这是最常用的规则类型。** 大部分时候你想要的是"这个网站的所有流量都走代理"，DOMAIN-SUFFIX 正好满足。

```yaml
- DOMAIN-SUFFIX,google.com,Proxy     # Google 全家桶
- DOMAIN-SUFFIX,github.com,Proxy     # GitHub
- DOMAIN-SUFFIX,cursor.sh,Proxy      # Cursor
- DOMAIN-SUFFIX,openai.com,Proxy     # OpenAI
```

---

### DOMAIN-KEYWORD — 域名关键词匹配

```yaml
- DOMAIN-KEYWORD,google,Proxy
```

只要域名中**包含** `google` 这个关键词，就匹配。`www.google.com`、`mail.google.co.jp`、`google.com.hk`、甚至 `not-google-at-all.google.evil.com` —— 全部命中。

**威力很大，也很危险。** 比如 `DOMAIN-KEYWORD,ai,Proxy` 会把 `baidu.com`（包含 ai？不包含。但 `baiduai.com` 会中）以及很多你不想代理的域名也拉进去。慎用。

适合的场景：某个服务用了大量不同的域名，但都包含某个关键词。比如 Google 系的域名（`googleapis.com`、`googlevideo.com`、`googleusercontent.com`...）可以用 `DOMAIN-KEYWORD,google,Proxy` 一网打尽——当然更精确的做法是用多条 DOMAIN-SUFFIX。

---

### GEOIP — 按 IP 地理位置匹配

```yaml
- GEOIP,CN,DIRECT
```

当 Clash 知道连接目标的 IP 后，查 GeoIP 数据库判断这个 IP 属于哪个国家/地区。如果是中国大陆的 IP，就直连。

**这是实现"国内直连、国外代理"的核心规则。** 不需要列出所有国内域名，只要最终解析出的 IP 属于中国，就走直连。

注意：GEOIP 规则需要 Clash 先知道目标 IP。如果连接是以域名形式到达 Clash 的，Clash 可能需要先做 DNS 解析才能拿到 IP 进行 GeoIP 匹配。在 fake-ip 模式下，如果域名已经被前面的域名规则匹配了，就不会走到 GEOIP 这一步。

---

### IP-CIDR — IP 段匹配

```yaml
- IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
- IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
- IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
- IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
```

匹配特定的 IP 地址段。CIDR 表示法：`192.168.0.0/16` 意思是"前 16 位固定（192.168），后面随意"，也就是 `192.168.0.0` 到 `192.168.255.255` 的所有 IP。

**最常见的用途**：确保局域网流量不走代理。上面那四条规则覆盖了所有 RFC 1918 私有地址段和本地回环地址。如果你在办公室共享代理，同事的请求到达你的 Clash 后，目标是局域网内的打印机/NAS 之类的设备，这些规则确保它们直连。

---

### PROCESS-NAME — 按进程名匹配（mihomo 特有）

```yaml
- PROCESS-NAME,cursor.exe,Proxy
- PROCESS-NAME,code.exe,Proxy
- PROCESS-NAME,docker.exe,Proxy
```

根据**发起连接的进程**来匹配。不管 cursor.exe 连的是什么域名什么 IP，统统走代理。

**这是一把瑞士军刀。** 有些应用你知道它一定需要代理（比如 Cursor），但你不确定它会连哪些域名（可能有 API 域名、遥测域名、CDN 域名等等）。与其去逆向工程它的所有域名然后一条条写 DOMAIN-SUFFIX，不如直接按进程名一刀切。

**限制**：需要 TUN 模式或 Service Mode 才能获取进程信息。系统代理模式下，Clash 看不到是哪个进程发起的连接。

---

### RULE-SET — 引用外部规则集

```yaml
- RULE-SET,google,Proxy
- RULE-SET,china-direct,DIRECT
- RULE-SET,ad-block,REJECT
```

不自己写规则，引用别人维护的规则集。比如社区维护了一个包含几千条 Google 相关域名的列表，你一条 `RULE-SET` 就全引进来了。后面详细说（→ 第 5 节）。

---

### MATCH — 兜底规则

```yaml
- MATCH,Proxy
```

匹配一切。放在规则列表的**最后一条**。所有前面没被匹配到的流量，都走这条规则的目标。

`MATCH,Proxy` = "其他没说到的，全走代理"（安全策略，适合开发者——宁可代理不需要代理的，也不要漏掉需要代理的）

`MATCH,DIRECT` = "其他没说到的，全直连"（保守策略，适合只需要特定网站走代理的场景）

---

## 3. 规则顺序的重要性

规则是**从上到下、先到先得**。顺序错了，行为就错了。

### 原则：精确的在前，模糊的在后

```
DOMAIN（最精确）
  ↓
DOMAIN-SUFFIX（较精确）
  ↓
DOMAIN-KEYWORD（较模糊）
  ↓
PROCESS-NAME
  ↓
RULE-SET
  ↓
IP-CIDR（需要 IP）
  ↓
GEOIP（需要 IP）
  ↓
MATCH（兜底）
```

### 错误顺序的例子

假设你想要 `direct.google.com` 走直连，但其他 Google 域名走代理：

**错误写法**：

```yaml
rules:
  - DOMAIN-SUFFIX,google.com,Proxy           # 这条先匹配，把所有 google.com 吃掉了
  - DOMAIN,direct.google.com,DIRECT          # 永远不会被执行到
```

**正确写法**：

```yaml
rules:
  - DOMAIN,direct.google.com,DIRECT          # 精确规则在前
  - DOMAIN-SUFFIX,google.com,Proxy           # 宽泛规则在后
```

再比如：

```yaml
# 错误：MATCH 在 GEOIP 前面，GEOIP 永远不执行
rules:
  - DOMAIN-SUFFIX,google.com,Proxy
  - MATCH,Proxy                               # 这里就把所有流量吃掉了
  - GEOIP,CN,DIRECT                           # 永远不会执行，国内流量也走代理

# 正确：
rules:
  - DOMAIN-SUFFIX,google.com,Proxy
  - GEOIP,CN,DIRECT                           # 先让国内 IP 直连
  - MATCH,Proxy                               # 剩下的走代理
```

**记住：`MATCH` 永远是最后一条。**

---

## 4. no-resolve 参数

你可能注意到 IP-CIDR 规则后面有时会跟一个 `no-resolve`：

```yaml
- IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
```

这是什么意思？

IP 类规则（IP-CIDR、GEOIP）需要知道目标的 **IP 地址**才能匹配。但连接到达 Clash 时，可能只有**域名**没有 IP（比如 fake-ip 模式下，应用连的是假 IP，Clash 翻译回域名后只有域名信息）。

这时 Clash 面临一个选择：
- **做 DNS 解析**，拿到真实 IP，然后匹配 IP 规则
- **跳过这条规则**，继续检查下一条

`no-resolve` 的意思是：**如果当前只有域名没有 IP，不要为了匹配这条规则去做 DNS 解析，直接跳过。**

### 什么时候用 no-resolve

**私有地址段的规则应该加 `no-resolve`**：

```yaml
- IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
- IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
- IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
```

原因：这些规则是为了匹配已知是局域网 IP 的连接。如果连接的目标是 `google.com`（域名），没必要为了检查它是不是 192.168.x.x 而去做一次 DNS 解析——明显不是。不加 `no-resolve` 的话，每个域名连接到这里都会触发一次多余的 DNS 查询，浪费时间。

**GEOIP 规则一般不加 `no-resolve`**：

```yaml
- GEOIP,CN,DIRECT
```

因为 GEOIP 是你的重要分流依据——如果一个域名的 IP 属于中国，你需要让它直连。这时 DNS 解析是必要的。

但如果你的规则集已经通过 DOMAIN-SUFFIX 覆盖了绝大部分需要代理的域名，GEOIP 规则基本只会遇到已经有 IP 的连接（前面的域名规则已经处理完了），`no-resolve` 不加也没多少额外开销。

---

## 5. Rule Providers（规则提供者）

手写几百条域名规则？不现实，也不必要。社区已经维护了大量现成的规则集。

### 常用规则集来源

**[blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)**：最全面的中文社区规则集，覆盖：
- 各大平台（Google、Apple、Microsoft、Amazon...）
- 国内服务（阿里巴巴、腾讯、百度、字节跳动...）
- 广告屏蔽
- 隐私追踪屏蔽

### 配置方式

分两步：先声明 rule-provider，再在 rules 中引用。

```yaml
rule-providers:
  # 声明一个名为 "google" 的规则集
  google:
    type: http                              # 从 URL 下载
    behavior: domain                        # 规则类型：纯域名列表
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Google/Google.yaml"
    path: ./ruleset/google.yaml             # 本地缓存路径
    interval: 86400                         # 更新间隔：86400 秒 = 24 小时

  openai:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/OpenAI/OpenAI.yaml"
    path: ./ruleset/openai.yaml
    interval: 86400

  china-direct:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/ChinaMax/ChinaMax.yaml"
    path: ./ruleset/china-direct.yaml
    interval: 86400

  ad-block:
    type: http
    behavior: domain
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/AdvertisingLite/AdvertisingLite.yaml"
    path: ./ruleset/ad-block.yaml
    interval: 86400

rules:
  # ... 你的自定义精确规则（DOMAIN、PROCESS-NAME 等）...
  - RULE-SET,openai,Proxy
  - RULE-SET,google,Proxy
  - RULE-SET,china-direct,DIRECT
  - RULE-SET,ad-block,REJECT
  - GEOIP,CN,DIRECT
  - MATCH,Proxy
```

### behavior 类型

- **domain**：规则集只包含域名，匹配逻辑类似 DOMAIN-SUFFIX。加载快，内存占用小
- **ipcidr**：规则集只包含 IP-CIDR 段
- **classical**：规则集包含完整规则（DOMAIN、DOMAIN-SUFFIX、IP-CIDR 混合）。最灵活但也最大

对于域名分流，用 `behavior: domain` 最常见也最高效。

### 注意事项

- `cdn.jsdelivr.net` 本身可能需要代理才能访问（在中国大陆）。如果首次下载规则集失败，你可能需要先手动配一条 `DOMAIN-SUFFIX,jsdelivr.net,Proxy` 让规则集的 URL 能走代理
- 规则集更新失败不会影响已缓存的规则——Clash 会继续使用上次成功下载的版本
- 规则集越大，Clash 启动和规则匹配的开销越大。别贪多，只引用你真正需要的

---

## 6. 实战：为你的场景设计规则

根据你（melt）的实际使用情况——Cursor 开发、GitHub、npm、Docker、Google 搜索，办公室共享——这是一个推荐的规则结构：

```yaml
rules:
  # ========== 局域网 & 本地 ==========
  - IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
  - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
  - IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
  - IP-CIDR,172.16.0.0/12,DIRECT,no-resolve

  # ========== 开发工具（最重要，放前面）==========
  - DOMAIN-SUFFIX,cursor.sh,Proxy           # Cursor
  - DOMAIN-SUFFIX,cursor.com,Proxy
  - DOMAIN-SUFFIX,openai.com,Proxy          # OpenAI API
  - DOMAIN-SUFFIX,anthropic.com,Proxy       # Claude API
  - DOMAIN-SUFFIX,github.com,Proxy          # GitHub
  - DOMAIN-SUFFIX,githubusercontent.com,Proxy
  - DOMAIN-SUFFIX,github.io,Proxy
  - DOMAIN-SUFFIX,npmjs.org,Proxy           # npm
  - DOMAIN-SUFFIX,npmjs.com,Proxy
  - DOMAIN-SUFFIX,yarnpkg.com,Proxy         # Yarn
  - DOMAIN-SUFFIX,docker.io,Proxy           # Docker
  - DOMAIN-SUFFIX,docker.com,Proxy
  - DOMAIN-SUFFIX,registry-1.docker.io,Proxy
  - DOMAIN-SUFFIX,pypi.org,Proxy            # pip
  - DOMAIN-SUFFIX,pythonhosted.org,Proxy

  # ========== 常用被墙网站 ==========
  - DOMAIN-SUFFIX,google.com,Proxy
  - DOMAIN-SUFFIX,google.co.jp,Proxy
  - DOMAIN-SUFFIX,googleapis.com,Proxy
  - DOMAIN-SUFFIX,googlevideo.com,Proxy
  - DOMAIN-SUFFIX,youtube.com,Proxy
  - DOMAIN-SUFFIX,ytimg.com,Proxy
  - DOMAIN-SUFFIX,wikipedia.org,Proxy
  - DOMAIN-SUFFIX,twitter.com,Proxy
  - DOMAIN-SUFFIX,x.com,Proxy
  - DOMAIN-SUFFIX,telegram.org,Proxy
  - DOMAIN-SUFFIX,t.me,Proxy

  # ========== 广告屏蔽（可选）==========
  - RULE-SET,ad-block,REJECT

  # ========== 国内直连 ==========
  - GEOIP,CN,DIRECT

  # ========== 兜底 ==========
  - MATCH,Proxy
```

### 为什么兜底用 Proxy 而不是 DIRECT

对于开发者来说，**默认走代理**是更安全的策略。原因：

1. 你不知道 Cursor 的某个新功能会连什么新域名。如果默认直连，新域名没有被规则覆盖 → 连不上 → 工作中断
2. npm/pip 的包可能从各种 CDN 域名下载，你不可能都列全
3. 代理了不需要代理的流量 → 稍微慢一点，但能用
4. 没代理需要代理的流量 → 完全不能用

**宁可多代理，不可漏代理。** 流量成本多一点，但工作不中断。

GEOIP,CN,DIRECT 已经把国内流量兜住了，所以"默认代理"不会让你刷 B 站也走代理。

---

## 7. 规则调试

规则写完了，怎么验证它们在正确工作？

### 在 Clash Verge 的连接页面查看

打开 Clash Verge → 左侧菜单 → **连接（Connections）**

这个页面实时显示所有经过 Clash 的连接，每一条都标注了：

- **Host**：目标域名或 IP
- **Rule**：匹配到的规则（比如 `DOMAIN-SUFFIX,google.com`）
- **Chains**：走的代理链路（比如 `Proxy → 🇭🇰 香港节点`）
- **Type**：连接类型（HTTP、HTTPS、DNS 等）
- **Speed**：上下行速度

**如果你发现某个域名走了不该走的路径**——比如 `github.com` 显示 Rule 是 `MATCH` 而不是你写的 `DOMAIN-SUFFIX,github.com,Proxy`——说明你的规则没生效，可能是：

1. 规则拼写错了
2. 规则顺序不对（被前面的规则吃掉了）
3. 配置没有正确加载（Clash Verge → 设置 → 重启内核）

### 临时添加规则测试

在 Clash Verge 中，你可以通过 **Mixin 覆写**临时添加规则而不修改原始订阅配置（🔗 参见 [Clash Verge 特有功能](clash-verge-specific.md)）。

在 Clash Verge 的覆写脚本中：

```javascript
// Mixin JavaScript 覆写
function main(config) {
  // 在规则列表的最前面插入一条临时规则
  config.rules.unshift("DOMAIN-SUFFIX,some-test-site.com,Proxy");
  return config;
}
```

测试完成后删掉这条临时规则即可。

### 用 curl 主动测试

```powershell
# 走代理测试特定域名
curl -x http://127.0.0.1:7897 https://目标域名 -v --connect-timeout 10

# -v 会显示连接过程的详细信息
# 同时去 Clash Verge 连接页面看这个请求匹配了哪条规则
```

### 日志排查

Clash Verge → 左侧菜单 → **日志（Logs）**

日志中会显示每个连接的规则匹配结果。设置日志级别为 `info` 或 `debug` 可以看到更详细的信息：

```yaml
log-level: info    # 可选：silent, error, warning, info, debug
```

`debug` 级别会输出大量信息，排查问题时临时开启，平时用 `info` 即可。

---

> **上一篇**：[DNS 策略](dns-strategy.md) — fake-ip vs redir-host 的工作原理
>
> **下一篇**：[策略组](proxy-groups.md) — select/url-test/fallback/load-balance 怎么选
