# 策略组：节点选择的逻辑层

> 你在 Clash Verge 界面上看到的那些可以展开选择节点的东西，就是策略组（Proxy Groups）。它们是你控制"这类流量走哪个节点"的核心手段。

## 1. 策略组是什么

**策略组不是代理节点本身。** 它是一个逻辑容器——装着一堆节点，并定义了一种**策略**来决定用哪个。

这里的关键设计模式是 **indirection（间接层）**：

```
Rule（规则）──→ Proxy Group（策略组）──→ 实际节点
```

规则**不直接**指向某个节点。规则指向一个策略组，策略组再根据自己的策略决定用哪个节点。

**具体例子：**

假设你有一条规则：

```
DOMAIN-SUFFIX,openai.com,AI服务
```

这条规则说：所有 `openai.com` 的流量 → 交给策略组 `AI服务` 处理。然后 `AI服务` 这个策略组才决定**具体走哪个节点**——可能是自动选最快的，可能是你手动选的某个美国节点。

**为什么要这么设计？** 因为如果规则直接绑定节点，那节点一挂你就得改规则。有了策略组这层抽象，规则不用动，策略组自己会切换可用节点。这就是经典的解耦思想——你在 SICP 里学过的 abstraction barrier，这里是同一个道理。


## 2. 四种策略组类型

### select — 手动选择

```yaml
- name: "手动选择"
  type: select
  proxies:
    - 香港01
    - 日本01
    - 美国01
    - DIRECT
```

**行为：** 你在 Clash Verge UI 上手动点选用哪个节点。选了就一直用，直到你换。

**适用场景：**
- 顶层策略组，你想要完全控制权
- 调试时手动切换节点排查问题

**在 Clash Verge 里长什么样：** 就是那个可以下拉选择节点的列表。


### url-test — 自动测速

```yaml
- name: "自动选择"
  type: url-test
  proxies:
    - 香港01
    - 香港02
    - 日本01
  url: http://www.gstatic.com/generate_204
  interval: 300
  tolerance: 50
```

**行为：** 每隔 `interval` 秒（这里是 300 秒 = 5 分钟），对所有节点发一个 HTTP 请求到 `url`，测延迟。自动切到延迟最低的节点。

**关键参数：**
- `url` — 测速用的 URL。`gstatic.com/generate_204` 是 Google 的一个轻量端点，返回 HTTP 204（无内容），专门用来测连通性和延迟
- `interval` — 测速间隔，单位秒
- `tolerance` — 容差值，单位毫秒。只有当新节点比当前节点快超过这个值时才切换。**设太低（比如 10）节点会频繁跳**，设太高又反应迟钝。50ms 是合理起点

**适用场景：** "别烦我，自动给我最快的"

**⚠️ 注意：latency ≠ throughput（延迟 ≠ 吞吐量）。** 一个 ping 50ms 的节点可能带宽只有 1Mbps，另一个 ping 120ms 的节点可能带宽有 100Mbps。url-test 只看延迟，不看带宽。如果你下载大文件发现速度不行，手动试几个节点。


### fallback — 故障转移

```yaml
- name: "故障转移"
  type: fallback
  proxies:
    - 首选节点
    - 备用节点1
    - 备用节点2
  url: http://www.gstatic.com/generate_204
  interval: 300
```

**行为：** 按列表顺序，使用第一个**健康**的节点。只有当前节点挂了（健康检查失败），才往下切。

**和 url-test 的关键区别：** fallback **尊重你定义的顺序**，不追求最快。url-test 不管顺序，只追求最低延迟。

**适用场景：** 你有一个最喜欢的节点，但怕它挂——"平时用这个，挂了自动换备用"。对关键工作流（比如 Cursor 正在跑长任务的时候）特别有用。


### load-balance — 负载均衡

```yaml
- name: "负载均衡"
  type: load-balance
  proxies:
    - 节点1
    - 节点2
    - 节点3
  url: http://www.gstatic.com/generate_204
  interval: 300
  strategy: consistent-hashing
```

**行为：** 把流量分散到多个节点上。

**两种 strategy：**
- `consistent-hashing` — 同一个目标域名总是走同一个节点。好处是保持 session 一致性（比如你登录了 GitHub，不会因为切节点而掉登录状态）
- `round-robin` — 轮流用各节点。不关心 session，纯粹分散负载

**适用场景：**
- 流量大、单节点扛不住
- 办公室多人共享代理时分散压力
- 你的 NxOnEarth 订阅限制了单节点并发连接数时


## 3. 策略组嵌套

策略组可以包含其他策略组——这是它强大的地方。

```yaml
proxy-groups:
  - name: "AI服务"
    type: select
    proxies:
      - 自动选择      # ← 这是另一个策略组
      - 手动选择      # ← 也是策略组
      - 美国01        # ← 这是一个具体节点
      - DIRECT

  - name: "自动选择"
    type: url-test
    proxies:
      - 香港01
      - 香港02
      - 日本01

  - name: "手动选择"
    type: select
    proxies:
      - 香港01
      - 日本01
      - 美国01
```

这样就形成了一个层级结构：

```
Rule: openai.com → AI服务
                    ├── 自动选择 → (url-test 自动选出) → 香港02
                    ├── 手动选择 → (你选的) → 日本01
                    ├── 美国01 (直接用)
                    └── DIRECT (直连)
```

你在 Clash Verge 里选 `AI服务` → `自动选择`，实际效果就是：OpenAI 的流量会走 url-test 自动选出的最快节点。哪天你觉得自动选的不好，切到 `手动选择` 自己挑一个。

**嵌套的本质就是组合（composition）。** 每个策略组是一个独立的选择单元，你可以像搭积木一样组合它们。


## 4. use 和 proxy-providers

前面的例子都是手动把节点名写在 `proxies` 里。但你用的是 NxOnEarth 的订阅，节点列表是动态的（机场可能增删节点），手动写不现实。

这就是 `proxy-providers` 和 `use` 的用途——**引用订阅里的节点，而不是硬编码节点名**。

```yaml
proxy-providers:
  my-subscription:
    type: http
    url: "你的订阅链接"
    interval: 3600
    path: ./proxy-providers/nxonearth.yaml
    health-check:
      enable: true
      url: http://www.gstatic.com/generate_204
      interval: 300

proxy-groups:
  - name: "自动选择"
    type: url-test
    use:
      - my-subscription     # 引用上面定义的 proxy-provider
    filter: "香港|HK"        # 正则过滤，只要香港节点
```

**`filter` 是 regex（正则表达式）**，匹配节点名称。常用的过滤：
- `"香港|HK|Hong Kong"` — 香港节点
- `"日本|JP|Japan"` — 日本节点
- `"美国|US|United States"` — 美国节点
- `"(?i)hk|hong kong"` — 忽略大小写匹配

**一个 proxy-provider 可以被多个策略组 `use`**，每个用不同的 `filter`。这就是你在 Clash Verge 里常看到"香港自动选择"、"日本自动选择"、"美国自动选择"等分组的实现原理。


## 5. 实战设计建议

你是在中国的开发者，用 Cursor、GitHub、npm、Docker，还要给办公室同事共享。推荐这样设计策略组：

```
节点选择 (select)           ← 顶层总开关，所有没有专门分组的流量走这里
├── 自动选择 (url-test)     ← 自动挑最快的，日常默认选这个
├── 故障转移 (fallback)     ← 关键时刻保稳定
├── 具体节点...             ← 手动切换用
└── DIRECT                  ← 直连

AI服务 (select)             ← Cursor / OpenAI / Claude 等
├── 美国自动 (url-test, filter: US)  ← OpenAI 有时候锁区
├── 自动选择
└── 具体节点...

开发工具 (select)           ← GitHub / npm / Docker Hub
├── 自动选择
├── 香港自动 (url-test, filter: HK)  ← 对 GitHub 延迟通常最低
└── 具体节点...
```

**设计原则：**
- **不要过度工程化。** 3-5 个策略组对大多数人足够了。每多一个组就多一个你需要理解和维护的东西
- **顶层用 select**，给自己留手动控制权
- **底层用 url-test 或 fallback**，自动化日常选择
- **按用途分组**，而不是按地区分组。你关心的是"Cursor 用什么"而不是"我有多少香港节点"
- **每个组都放一个 DIRECT 选项**，方便调试（怀疑代理有问题时切到直连排查）


## 6. 常见问题

### "自动选择老是切节点，一会儿用香港一会儿用日本"

`tolerance` 设太低了。如果两个节点延迟差距在 tolerance 范围内，就不会切换。建议设 50-100ms。

### "延迟显示很低（30ms）但速度很慢"

延迟（latency）和带宽（bandwidth/throughput）是两个完全不同的指标。url-test 只测延迟——发一个小请求的往返时间。带宽取决于节点的实际线路质量、拥堵程度、机场的限速策略等。遇到这种情况，手动换几个节点试试。

### "策略组里的节点全都超时/不可用"

几种可能：
1. 你的订阅过期了或者机场跑路了——检查 NxOnEarth 账户状态
2. 你的网络本身有问题——先确认本地网络是通的（ping baidu.com）
3. GFW 刚好封了这批节点的 IP——等一等或者更新订阅
4. 健康检查 URL 被墙了——换个 URL 试试（但 gstatic.com 一般没问题）

### "use 和 proxies 能混用吗？"

可以。一个策略组里可以同时有 `use`（引用 proxy-provider）和 `proxies`（手动列出的节点/策略组）：

```yaml
- name: "节点选择"
  type: select
  use:
    - my-subscription
  proxies:
    - 自动选择
    - DIRECT
```

### "为什么 Clash Verge 里有些策略组我没在配置文件里写？"

Clash Verge 有 Mixin/覆写功能，可能在你的订阅配置基础上注入了额外的策略组。检查 Clash Verge 的覆写（Override）设置。
