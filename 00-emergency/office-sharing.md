# 办公室局域网共享 Clash Verge 代理指南

> 场景：你在办公室用 Clash Verge 跑代理，同事也需要访问 GitHub、Cursor 等服务。
> 与其每人都装一套，不如你的电脑当代理服务器，同事直接借道。

---

## 1. 原理：你的电脑变成代理服务器

Clash Verge 本质上是一个本地代理程序——它在你电脑上监听一个端口，接收 HTTP/SOCKS5 请求，然后根据规则把流量转发到代理节点。

默认情况下，它只监听 `127.0.0.1`（localhost），也就是只有你自己能用。打开 `allow-lan` 之后，它会监听 `0.0.0.0`（所有网卡接口），局域网内其他设备就能把你的电脑当作代理服务器来用。

```
同事的电脑 ──HTTP/SOCKS5──▶ 你的电脑 (Clash Verge :7897) ──▶ 代理节点 ──▶ 互联网
                              │
                              ├─ 走规则匹配的流量 → 代理节点 → 目标网站
                              └─ 不匹配的流量 → 直连（DIRECT）
```

关键概念：**mixed-port**。Clash 的 mixed-port 同时支持 HTTP 和 SOCKS5 协议，同事不需要关心用哪种协议，一个端口搞定。

---

## 2. 配置步骤

### Step 1: 找到你的局域网 IP

打开 PowerShell 或 CMD：

```powershell
ipconfig
```

输出会列出多个网卡。找到你连接办公室网络的那个适配器（通常是"以太网"或"WLAN"），看 `IPv4 地址`：

```
以太网适配器 以太网:

   IPv4 地址 . . . . . . . . . . . . : 192.168.1.42    ← 这个就是你的局域网 IP
   子网掩码  . . . . . . . . . . . . : 255.255.255.0
   默认网关  . . . . . . . . . . . . : 192.168.1.1
```

**怎么判断哪个是办公室 LAN？**
- 通常是 `192.168.x.x` 或 `10.x.x.x` 或 `172.16~31.x.x` 开头
- 如果你插网线，看"以太网"；如果连 WiFi，看"WLAN"
- 忽略 `vEthernet`、`VMware`、`VirtualBox` 等虚拟网卡
- 默认网关能 ping 通的那个就是对的

记住这个 IP，后面同事要用。

### Step 2: Clash Verge 配置

**方法 A：通过 Clash Verge UI（推荐）**

1. 打开 Clash Verge → 设置（Settings）
2. 找到 **Allow LAN** / **局域网连接**，打开开关
3. 确认 **Mixed Port** 为 `7897`（Clash Verge 默认值，也可以改成别的端口）

**方法 B：通过配置文件**

在 Clash 配置文件（`.yaml`）中确保有以下字段：

```yaml
mixed-port: 7897
allow-lan: true
bind-address: "*"       # 监听所有网卡，默认就是 "*"
```

各字段含义：

| 字段 | 作用 |
|------|------|
| `mixed-port` | 同时接受 HTTP 和 SOCKS5 连接的端口 |
| `allow-lan` | 是否允许局域网设备连接 |
| `bind-address` | `"*"` = 所有网卡；也可以写死具体 IP 如 `"192.168.1.42"`，只在该接口监听 |

> **提示**：如果你的配置文件里写的是分开的 `port`（HTTP）和 `socks-port`（SOCKS5），建议统一换成 `mixed-port`，省事。

### Step 3: Windows 防火墙放行

这是很多人卡住的地方——Clash 配置没问题，但同事连不上，原因就是 Windows 防火墙挡了入站请求。

**方法 A：PowerShell 一行搞定（以管理员身份运行）**

```powershell
New-NetFirewallRule -DisplayName "Clash Verge LAN" -Direction Inbound -Protocol TCP -LocalPort 7897 -Action Allow
```

**方法 B：手动操作**

1. 搜索"Windows Defender 防火墙" → 高级设置
2. 左侧选"入站规则" → 右侧"新建规则"
3. 规则类型：端口
4. 协议：TCP，特定本地端口：`7897`
5. 操作：允许连接
6. 配置文件：域、专用都勾上（**公用不要勾**）
7. 名称：`Clash Verge LAN`

### Step 4: 同事端配置

把你的 IP 和端口告诉同事（比如 `192.168.1.42:7897`）。

**全局系统代理（Windows）**

设置 → 网络和 Internet → 代理 → 手动设置代理：
- 地址：`192.168.1.42`
- 端口：`7897`
- 打开开关

> 注意：全局代理会让同事所有 HTTP 流量都走你的电脑，包括国内网站。如果不想这样，用下面的 per-app 配置或 PAC 方式。

**Per-app 配置（推荐，按需代理）**

Cursor（在 `settings.json` 中添加）：

```json
{
  "http.proxy": "http://192.168.1.42:7897",
  "http.proxyStrictSSL": false
}
```

Git：

```bash
git config --global http.proxy http://192.168.1.42:7897
git config --global https.proxy http://192.168.1.42:7897
```

npm：

```bash
npm config set proxy http://192.168.1.42:7897
npm config set https-proxy http://192.168.1.42:7897
```

终端临时使用（当前 session 有效）：

```powershell
$env:HTTP_PROXY = "http://192.168.1.42:7897"
$env:HTTPS_PROXY = "http://192.168.1.42:7897"
```

```bash
# Linux / macOS / Git Bash
export HTTP_PROXY=http://192.168.1.42:7897
export HTTPS_PROXY=http://192.168.1.42:7897
```

**验证连通性**

```bash
curl -x http://192.168.1.42:7897 https://www.google.com
```

看到 HTML 内容就说明成功了。如果用 PowerShell：

```powershell
Invoke-WebRequest -Proxy "http://192.168.1.42:7897" -Uri "https://www.google.com"
```

---

## 3. 进阶：PAC 文件自动配置

### PAC 是什么？

PAC（Proxy Auto-Configuration）是一个 JavaScript 文件，浏览器/系统读取后，会根据目标 URL 自动决定走代理还是直连。好处是同事不用全局代理，只有需要翻的域名才走你的代理。

### 写一个简单的 PAC 文件

创建 `proxy.pac`：

```javascript
function FindProxyForURL(url, host) {
  // 需要走代理的域名
  var proxyDomains = [
    "google.com",
    "github.com",
    "githubusercontent.com",
    "github.io",
    "openai.com",
    "cursor.sh",
    "cursor.com",
    "npmjs.org",
    "npmjs.com",
    "stackoverflow.com",
    "docker.io",
    "docker.com",
    "huggingface.co"
  ];

  for (var i = 0; i < proxyDomains.length; i++) {
    if (dnsDomainIs(host, proxyDomains[i])) {
      return "PROXY 192.168.1.42:7897; DIRECT";
      // 含义：优先走代理，代理不可用时直连
    }
  }

  // 其他所有流量直连
  return "DIRECT";
}
```

### 怎么给同事用？

**方法 A：用 Python 临时起一个 HTTP 服务器**

把 `proxy.pac` 放到某个目录，然后：

```powershell
cd C:\path\to\pac\directory
python -m http.server 8080
```

同事在系统代理设置里选"使用设置脚本"，填入：

```
http://192.168.1.42:8080/proxy.pac
```

**方法 B：直接共享文件**

把 `proxy.pac` 通过微信/钉钉发给同事，同事保存到本地，代理设置里填本地路径：

```
file:///C:/Users/xxx/proxy.pac
```

> 注意：`file://` 方式在某些浏览器（如 Chrome）中可能不生效，建议还是用 HTTP 方式托管。

---

## 4. 安全注意事项

### 绝对不要在公共 WiFi 上开 allow-lan

`allow-lan: true` 意味着同一网络内任何人都能用你的代理。在公共 WiFi（咖啡厅、机场）下开着，等于给陌生人提供免费代理——他们干什么坏事，查到的 IP 是你的代理节点。

**下班回家、出差、换网络时，关掉 allow-lan。**

### 流量可见性

你的 Clash 日志可以看到所有经过代理的请求的**域名**（不是完整 URL，HTTPS 只能看到 SNI）。也就是说，你能看到同事在访问什么网站。跟同事说清楚这一点，别让人觉得被偷窥。

### 认证

默认的 Clash 局域网代理没有认证机制，任何知道你 IP:port 的人都能用。如果你的办公室网络比较大（几十人以上），考虑：
- 只绑定特定 IP（`bind-address` 设为具体网卡 IP 而不是 `*`）
- 用防火墙规则限制来源 IP

### 带宽

你的上行带宽是所有人共享的。如果你的网络只有 10Mbps 上行，5 个人同时用代理看 YouTube，体验会很差。注意：
- 提醒同事不要用代理下载大文件或看视频
- 如果人多，考虑让有更好网络的同事也跑一个 Clash，分担负载

---

## 5. 常见问题

### 同事连不上代理

排查顺序：

1. **你的 Clash Verge 启动了吗？** 检查系统托盘图标
2. **allow-lan 开了吗？** Clash Verge 设置里确认
3. **IP 对不对？** 重新 `ipconfig` 确认，IP 可能因为 DHCP 变了
4. **防火墙放行了吗？** 这是最常见的原因。让同事 `ping` 你的 IP，能通再试端口
5. **端口对不对？** 确认 mixed-port 和同事填写的端口一致
6. **同事的代理格式对不对？** 地址只填 IP 不要加 `http://`，端口单独填（系统代理设置的情况下）

快速诊断——让同事在 PowerShell 里跑：

```powershell
Test-NetConnection -ComputerName 192.168.1.42 -Port 7897
```

`TcpTestSucceeded: True` 就说明网络和端口都没问题，检查代理配置本身。

### 速度变慢

- 太多人同时用代理 → 分流到另一台电脑
- 你的代理节点本身慢 → Clash Verge 里切换节点
- 同事在用代理下载大文件 → 提醒他们直连下载

### 你重启/关机后同事全断

- 设置 Clash Verge 开机自启：Clash Verge 设置 → 开机启动（System Proxy / Auto Launch）
- 考虑写一个通知群消息："我要重启，代理会断几分钟"

### 你的 IP 变了

办公室 DHCP 可能会分配不同的 IP。解决方案：
- 去路由器管理页面给你的 MAC 地址绑定固定 IP（推荐）
- 或者每次变了就通知同事更新

### 某些网站走代理后反而打不开

可能是代理规则问题。国内网站走代理反而更慢或被 block。确保 Clash 规则里国内域名走 DIRECT。NxOnEarth 的默认规则一般已经处理好了，但如果有问题可以手动加规则。
