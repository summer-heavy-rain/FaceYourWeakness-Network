# 排错决策树

> 网不通了？别慌，别乱调。按这棵树走，一步步定位问题。

---

## 60 秒快速排错

在深入之前，先跑一遍这个 checklist。80% 的问题在这里就能解决。

1. **Clash Verge 是不是在运行？** → 看系统托盘有没有图标。没有就启动它。
2. **系统代理是不是开着？** → 打开 Clash Verge → 主界面左侧「系统代理」开关是否亮着。
3. **节点是不是活的？** → 右键托盘图标 → 代理 → 看当前选中节点。如果延迟显示 `timeout`，换一个节点。
4. **订阅是不是过期了？** → 打开 Clash Verge → 订阅 → 看到期时间和剩余流量。
5. **是不是刚更新了 Clash Verge？** → 更新后配置可能被重置。检查 TUN 模式、系统代理开关、allow-lan 等关键设置。
6. **试过更新订阅了吗？** → 订阅页面 → 点击刷新按钮。机场有时会更换节点地址。

**如果上面全试过还不行，继续往下走。**

---

## 如何使用这棵树

每个分支都是 **YES/NO 问题**。回答之后跟着箭头走。

- 📌 = 需要你做一个检查动作
- ✅ = 找到问题，这是修复方案
- ➡️ = 继续往下走
- 🔗 = 交叉引用（去看另一个文档/章节）

---

## 第一步：判断问题类型

问自己：**现在是什么情况？**

| 症状 | 去哪个分支 |
|------|-----------|
| 什么网站都打不开 | [→ 1. 完全断网](#1-完全断网) |
| 有的网站能开有的不行 | [→ 2. 部分断网](#2-部分断网) |
| 能开但是很慢 | [→ 3. 速度慢](#3-速度慢) |
| Cursor / npm / git / Docker 不通 | [→ 4. 开发工具专项](#4-cursor开发工具专项) |
| 一会通一会断 | [→ 5. 频繁断连](#5-频繁断连) |
| 同事连不上我的代理 | [→ 6. 办公室共享问题](#6-办公室共享问题) |

---

## 1. 完全断网

> 什么都打不开——Google 不行，GitHub 不行，连 Baidu 可能也不行。

### 1.1 Clash 进程在运行吗？

📌 **检查方法**：
- 看系统托盘（右下角）有没有 Clash Verge 图标
- 或者打开任务管理器，搜索 `clash-verge` 或 `mihomo`

```powershell
# PowerShell 检查进程
Get-Process -Name "clash-verge*","mihomo*" -ErrorAction SilentlyContinue
```

**没在运行？**
✅ 启动 Clash Verge。如果启动后闪退，以管理员身份运行试试。如果还是闪退，可能是配置文件损坏——去 `~/.config/clash-verge/` 看日志。

**在运行？** ➡️ 继续 1.2

---

### 1.2 不走代理能上网吗？

📌 **检查方法**：临时关闭 Clash Verge 的系统代理开关，然后：

```powershell
# 不走代理直接访问百度
curl -x "" https://www.baidu.com -o NUL -w "%{http_code}" --connect-timeout 5
```

或者直接在浏览器地址栏输入 `baidu.com`。

**百度也打不开？**
✅ 问题不在代理，是你的本地网络有问题：
- Wi-Fi 断了？网线松了？
- 路由器需要重启？
- 公司网络是否需要先认证（Web portal 登录）？

```powershell
# 检查本地网络
ping 114.114.114.114 -n 4
ipconfig
```

如果 `ping 114.114.114.114` 也不通，说明根本没有网络连接。找物理层问题。

**百度能打开？** ➡️ 本地网络没问题，问题在代理这边。继续 1.3

---

### 1.3 系统代理设置正确吗？

📌 **检查方法**：

```powershell
# 查看 Windows 系统代理设置
Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" | Select-Object ProxyEnable, ProxyServer
```

正常情况下应该看到：
- `ProxyEnable: 1`
- `ProxyServer: 127.0.0.1:7897`（端口号取决于你 Clash Verge 的设置）

**ProxyEnable 是 0？**
✅ 系统代理没开。去 Clash Verge 打开「系统代理」开关。

**ProxyEnable 是 1 但端口不对？**
✅ 端口对不上。打开 Clash Verge → 设置 → 查看 mixed-port 配置的端口号，确保系统代理的端口和它一致。

**设置看起来都对？** ➡️ 继续 1.4

---

### 1.4 节点可用吗？

📌 **检查方法**：
- 打开 Clash Verge → 代理页面 → 对当前策略组点击「延迟测试」（闪电图标）
- 或者看 Clash Verge 日志里有没有大量 `dial timeout` / `connection refused`

**所有节点都 timeout？**
✅ 可能原因（按可能性排序）：
1. **机场跑路了/订阅过期了** → 检查订阅到期时间和剩余流量
2. **机场正在维护** → 去机场的 Telegram 群/公告页看看
3. **GFW 大面积封锁** → 等一等，换协议试试（🔗 参见 [协议选择速查表](../02-proxy-protocols/protocol-cheatsheet.md)）
4. **订阅链接挂了** → 手动在浏览器里打开订阅链接（不走代理），看能不能下载到内容

**只有部分节点 timeout？**
✅ 正常现象。切换到延迟低的节点即可。如果你用了 `url-test` 策略组（🔗 参见[策略组](../03-clash-mastery/proxy-groups.md)），它应该会自动切换。

**延迟正常但还是打不开网页？** ➡️ 继续 1.5

---

### 1.5 DNS 有问题吗？

📌 **检查方法**：

```powershell
# 直接用 IP 访问 Google（跳过 DNS）
curl -x http://127.0.0.1:7897 https://142.250.80.46 -o NUL -w "%{http_code}" --connect-timeout 10

# 用代理测试 DNS 解析
curl -x http://127.0.0.1:7897 https://www.google.com -o NUL -w "%{http_code}" --connect-timeout 10
```

（把 `7897` 换成你的实际端口）

**用 IP 能通但域名不行？**
✅ DNS 出了问题。可能的修复：
1. 打开 Clash Verge 配置，确认 DNS 部分配置正确（🔗 参见 [DNS 策略](../03-clash-mastery/dns-strategy.md)）
2. 如果你用的是 `fake-ip` 模式，试试刷新 fake-ip 缓存：重启 mihomo 内核
3. 清除系统 DNS 缓存：

```powershell
ipconfig /flushdns
```

**用 IP 也不行？**
✅ 代理连接本身有问题。可能是节点真的挂了，或者你的 ISP 封了代理协议的特征。试试：
1. 换不同地区的节点
2. 换不同协议的节点（比如从 VMess 换到 Hysteria2）
3. 如果所有协议都不行，联系机场客服

---

## 2. 部分断网

> 有的网站能打开，有的不行。比如 Google 能上但 GitHub 不行；或者国内能上但国外不行。

### 2.1 是特定网站不行，还是某一类网站不行？

📌 **检查方法**：打开多个网站试试

| 测试目标 | URL |
|---------|-----|
| Google 搜索 | `https://www.google.com` |
| GitHub | `https://github.com` |
| ChatGPT | `https://chat.openai.com` |
| YouTube | `https://www.youtube.com` |
| npm registry | `https://registry.npmjs.org` |
| Docker Hub | `https://hub.docker.com` |

**只有一两个特定网站不行？** ➡️ 继续 2.2（可能是规则问题）

**整类网站不行（比如所有国外站都不行）？** ➡️ 回到 [1. 完全断网](#1-完全断网)，你的代理可能根本没工作

---

### 2.2 这个域名有没有被规则匹配到？

📌 **检查方法**：
- 打开 Clash Verge → 连接页面 → 找到对应的连接，看它走的是哪个策略组 / 规则
- 或者在 Clash Verge → 日志 中搜索目标域名

**显示走了 DIRECT（直连）？**
✅ 这个域名被规则匹配到「直连」了，但它实际上需要代理。修复方法：
1. 在你的规则配置中加一条：`DOMAIN-SUFFIX,目标域名,你的代理策略组`
2. 或者在 Clash Verge 的覆写脚本（Mixin）中添加规则（🔗 参见 [Clash Verge 特有功能](../03-clash-mastery/clash-verge-specific.md)）

**显示走了代理节点但还是不行？** ➡️ 继续 2.3

---

### 2.3 是不是当前节点封了这个网站？

📌 **检查方法**：手动切换到不同地区的节点，再试

```powershell
# 用代理测试特定网站
curl -x http://127.0.0.1:7897 https://目标网站 -v --connect-timeout 10
```

**换节点就好了？**
✅ 是节点问题。某些机场节点（尤其是便宜的）会限制访问特定网站（比如 Netflix、ChatGPT）。选一个不限制的节点，或者联系机场问问哪些节点支持。

**所有节点都不行？** ➡️ 继续 2.4

---

### 2.4 DNS 污染/泄漏了吗？

📌 **检查方法**：

```powershell
# 不走代理直接解析域名（使用国内 DNS）
nslookup github.com 114.114.114.114

# 走代理解析
nslookup github.com 127.0.0.1
```

如果不走代理解析出来的 IP 是明显错误的（比如 `127.0.0.1`、`0.0.0.0`、或者某个国内 IP），那就是 DNS 污染。

**确认是 DNS 污染？**
✅ 修复方案：
1. 确保 Clash 配置中开启了 `enhanced-mode: fake-ip` 或 `redir-host`（🔗 参见 [DNS 策略](../03-clash-mastery/dns-strategy.md)）
2. 确保需要代理的域名的 DNS 查询走的是远端解析（不要用国内 DNS 去解析被墙的域名）
3. 在 Clash DNS 配置的 `nameserver-policy` 中，明确指定被污染域名走海外 DNS

**不是 DNS 问题？**
✅ 可能是这个网站本身在维护，或者有地区限制。访问 `https://downdetector.com` 看看是不是全球性故障。

---

## 3. 速度慢

> 能上但是慢得像蜗牛。页面加载几十秒，下载速度低得可怜。

### 3.1 是代理慢还是本地网络慢？

📌 **检查方法**：

```powershell
# 不走代理测速（国内）
curl -x "" -o NUL -w "速度: %{speed_download} bytes/s\n" https://dldir1.qq.com/qqfile/qq/TIM3.4.8/TIM3.4.8.22092.exe --connect-timeout 10

# 走代理测速（国外）
curl -x http://127.0.0.1:7897 -o NUL -w "速度: %{speed_download} bytes/s\n" https://speed.cloudflare.com/__down?bytes=10000000 --connect-timeout 15
```

**不走代理也慢？**
✅ 问题在本地网络，不关 Clash 的事：
- 检查 Wi-Fi 信号强度
- 试试有线连接
- 其他设备也慢吗？如果是，重启路由器
- 联系 ISP（可能是运营商限速或故障）

**只有走代理才慢？** ➡️ 继续 3.2

---

### 3.2 当前节点延迟高吗？

📌 **检查方法**：
- Clash Verge → 代理页面 → 对策略组做延迟测试
- 一般来说，延迟 <200ms 是正常的，>500ms 就算很慢了

**延迟很高？**
✅ 换节点：
1. 选延迟最低的节点
2. 优先选地理位置近的节点（日本、香港、台湾、新加坡对中国大陆延迟通常较低）
3. 如果用了 `url-test` 策略组，检查 `interval` 和 `tolerance` 设置是否合理（🔗 参见 [策略组](../03-clash-mastery/proxy-groups.md)）

**延迟正常但速度就是慢？** ➡️ 继续 3.3

---

### 3.3 是协议问题吗？

📌 **检查方法**：看当前节点用的是什么协议（在节点名称或节点信息里通常能看到）

不同协议在不同网络环境下表现差异巨大：

| 协议 | 特点 |
|------|------|
| VMess (TCP) | 经典，但特征容易被识别，高峰期可能被限速 |
| Trojan | 伪装 HTTPS 流量，相对稳定 |
| Hysteria2 | 基于 QUIC/UDP，抗丢包能力强，通常速度最快 |
| TUIC | 类似 Hysteria2，也是 UDP 系 |
| VLESS + Reality | 新型协议，伪装能力强 |

**试试换个不同协议的节点。** 特别是如果你在用 TCP 系协议（VMess、Trojan），试试 UDP 系协议（Hysteria2、TUIC）——前提是你的机场提供这些节点。

（🔗 参见 [翻墙协议演化史](../02-proxy-protocols/shadowsocks-vmess-trojan.md) 和 [QUIC 系协议](../02-proxy-protocols/quic-based-protocols.md)）

---

### 3.4 TUN 模式是不是带来了额外开销？

📌 **检查方法**：看 Clash Verge 设置里 TUN 模式是否开启

TUN 模式通过虚拟网卡劫持所有流量（🔗 参见 [TUN vs 系统代理](../03-clash-mastery/tun-vs-system-proxy.md)），好处是全局代理、不漏流量，坏处是会引入额外的性能开销。

**TUN 模式开着？**
✅ 试试关掉 TUN 模式，改用系统代理模式，看速度有没有改善：
- 如果明显改善，说明 TUN 模式在你的机器上确实有额外开销。在不需要全局代理时，用系统代理模式就够了
- 如果没改善，TUN 不是问题所在

---

### 3.5 有没有可能是带宽被占满了？

📌 **检查方法**：

```powershell
# 查看当前网络连接状态
netstat -b -n | Select-String "ESTABLISHED" | Measure-Object
```

或者打开任务管理器 → 性能 → 网络，看看带宽使用情况。

**如果你在共享代理给同事：**
✅ 同事可能在看视频/下载大文件，占满了你的带宽。去 Clash Verge 的连接页面看看哪个连接在大量传输数据。

---

## 4. Cursor/开发工具专项

> Cursor、npm、git、Docker 有自己的代理问题，单独说。

### 4.1 Cursor 不走代理？

📌 **检查方法**：
- 打开 Cursor → 设置（`Ctrl+,`）→ 搜索 `proxy`
- 检查 `http.proxy` 设置

**http.proxy 是空的？**
✅ 设置代理：
1. 在 Cursor 设置中设置 `http.proxy` 为 `http://127.0.0.1:7897`（替换为你的端口）
2. 或者设置环境变量：

```powershell
# 临时设置（当前会话）
$env:HTTP_PROXY = "http://127.0.0.1:7897"
$env:HTTPS_PROXY = "http://127.0.0.1:7897"
```

```powershell
# 永久设置（用户级别）
[Environment]::SetEnvironmentVariable("HTTP_PROXY", "http://127.0.0.1:7897", "User")
[Environment]::SetEnvironmentVariable("HTTPS_PROXY", "http://127.0.0.1:7897", "User")
```

**设置了代理但 Cursor 还是连不上？** ➡️ 继续 4.2

---

### 4.2 Cursor 的 AI 功能不工作？（补全、Chat 无响应）

Cursor 连接的是 `api2.cursor.sh` / `*.cursor.sh` 系列域名，走的是 WebSocket 或 HTTPS。

📌 **检查方法**：

```powershell
# 测试能不能连到 Cursor 服务器
curl -x http://127.0.0.1:7897 https://api2.cursor.sh -v --connect-timeout 10
```

**连不上？**
✅ 排查步骤：
1. 确认 `cursor.sh` 相关域名在 Clash 规则中走代理（不是直连）
2. 检查 Cursor 设置中 `http.proxyStrictSSL` 是否为 `true`——如果你的代理会做 MITM（中间人），需要设为 `false`（🔗 参见 [TLS 信任链](../01-packet-journey/tls-trust-chain.md)）
3. 检查 Cursor 设置中 `http.proxySupport` 设为 `override`（确保所有请求都走代理）

**连得上但 WebSocket 经常断？** ➡️ 参见 [5. 频繁断连](#5-频繁断连)

（🔗 完整指南参见 [Cursor 网络配置](cursor-proxy-setup.md)）

---

### 4.3 npm 不走代理？

📌 **检查方法**：

```powershell
npm config get proxy
npm config get https-proxy
```

**没设置？**
✅ 设置 npm 代理：

```powershell
npm config set proxy http://127.0.0.1:7897
npm config set https-proxy http://127.0.0.1:7897
```

或者更好的办法——换成国内镜像源，不需要代理：

```powershell
npm config set registry https://registry.npmmirror.com
```

**设置了代理但 `npm install` 还是超时？**
✅ 可能是 `node-gyp` 需要下载 Node.js headers，试试：

```powershell
npm config set disturl https://npmmirror.com/mirrors/node
```

---

### 4.4 git 不走代理？

📌 **检查方法**：

```powershell
git config --global http.proxy
git config --global https.proxy
```

**没设置？**
✅ 设置 git 代理：

```powershell
# HTTP/HTTPS 协议的 GitHub（用于 git clone https://...）
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
```

对于 SSH 协议的 GitHub（`git clone git@github.com:...`），需要配置 SSH 的 ProxyCommand。编辑 `~/.ssh/config`：

```
Host github.com
    HostName github.com
    User git
    ProxyCommand connect -H 127.0.0.1:7897 %h %p
```

（需要安装 `connect` 工具，或者用 Git for Windows 自带的）

---

### 4.5 Docker 拉镜像失败？

📌 **检查方法**：

```powershell
docker pull hello-world
```

**超时或连接被拒？**
✅ Docker 需要单独配置代理。对于 Docker Desktop：
1. Docker Desktop → Settings → Resources → Proxies
2. 设置 HTTP Proxy 和 HTTPS Proxy 为 `http://127.0.0.1:7897`

或者用国内镜像加速器（可能不需要代理）：
1. Docker Desktop → Settings → Docker Engine
2. 在 JSON 中添加：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ]
}
```

**注意**：如果你开了 TUN 模式，Docker 可能会自动走代理而不需要额外配置。

---

### 4.6 证书错误？（SSL/TLS certificate problem）

📌 **症状**：类似以下错误信息：

```
SSL certificate problem: unable to get local issuer certificate
```

```
UNABLE_TO_GET_ISSUER_CERT_LOCALLY
```

**常见原因**：
1. 公司网络有 MITM 代理（企业防火墙或审计系统插入自己的证书）
2. Clash Verge 的某些功能（比如 MitM）修改了证书链

✅ 修复方法：
- **临时绕过**（不推荐长期使用，有安全风险）：

```powershell
# git
git config --global http.sslVerify false

# npm
npm config set strict-ssl false

# curl
curl -k https://example.com
```

- **正确修复**：找到造成 MITM 的根证书，安装到系统信任证书存储中。（🔗 参见 [TLS 信任链](../01-packet-journey/tls-trust-chain.md)）

---

## 5. 频繁断连

> 能上网，但隔一会就断一下，然后又自动恢复（或者需要手动重连）。

### 5.1 是特定节点的问题还是所有节点都断？

📌 **检查方法**：
- 固定一个节点用一段时间，观察是否断连
- 换另一个节点，同样观察

**只有某些节点会断？**
✅ 那些节点质量差。解决方案：
1. 用 `url-test` 或 `fallback` 策略组让 Clash 自动切换（🔗 参见 [策略组](../03-clash-mastery/proxy-groups.md)）
2. 把经常断的节点从策略组中排除（通过 `filter` 或手动选择）

**所有节点都会断？** ➡️ 继续 5.2

---

### 5.2 是你的本地网络不稳定吗？

📌 **检查方法**：

```powershell
# 长时间 ping 测试
ping 114.114.114.114 -t
```

看有没有丢包或延迟突然飙高的情况。`Ctrl+C` 停止后看统计结果。

**丢包率 > 5%？**
✅ 本地网络不稳定。可能原因：
- Wi-Fi 信号弱 → 靠近路由器或用有线
- 路由器过载 → 连接设备太多，考虑重启或换路由器
- ISP 线路抖动 → 联系运营商

**本地网络稳定？** ➡️ 继续 5.3

---

### 5.3 策略组配置是不是有问题？

📌 **检查方法**：看你的 Clash 配置中策略组的 `interval` 和 `lazy` 设置

```yaml
proxy-groups:
  - name: "AutoSelect"
    type: url-test
    interval: 300       # 每300秒测一次延迟
    tolerance: 50       # 延迟差距超过50ms才切换
    lazy: true          # 没有流量时不测延迟
```

**`interval` 设太小（比如 30 秒）？**
✅ 太频繁的延迟测试会导致不必要的节点切换，看起来就像断连。设置为 `300`（5 分钟）比较合理。

**`tolerance` 设太小（比如 0 或 10）？**
✅ 容差太小会导致频繁切换节点。设为 `50` 或 `100`。

---

### 5.4 是 keep-alive 的问题吗？

有些长连接（比如 Cursor 的 WebSocket、SSH）在空闲一段时间后会被中间设备（路由器、NAT、防火墙）断开。

📌 **症状**：不操作一段时间后突然断开，操作后又重新连上。

✅ 修复方向：
1. 对于 SSH，在 `~/.ssh/config` 中添加：

```
Host *
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

2. 对于 Cursor，确保 Clash 配置中开启了 `tcp-concurrent`（如果你的版本支持的话）
3. 检查路由器/防火墙的 NAT 超时设置（通常在路由器管理界面）

---

## 6. 办公室共享问题

> 你的代理自己用没问题，但同事连不上。

### 6.1 allow-lan 开了吗？

📌 **检查方法**：
- Clash Verge → 设置 → 找到 `allow-lan`（允许局域网连接）

**没开？**
✅ 开启 `allow-lan`。在配置文件中确保：

```yaml
allow-lan: true
bind-address: "*"    # 监听所有网卡（如果只有一个网卡可以写具体 IP）
```

开启后重启 mihomo 内核生效。

**已经开了？** ➡️ 继续 6.2

---

### 6.2 你的 IP 和端口对不对？

📌 **检查方法**：

```powershell
# 查看你的局域网 IP
ipconfig | Select-String "IPv4"
```

假设你的 IP 是 `192.168.1.100`，mixed-port 是 `7897`，那同事需要在他们的设备上设置代理为 `192.168.1.100:7897`。

**同事设置的 IP 或端口不对？**
✅ 告诉同事正确的 IP 和端口。注意：
- IP 必须是你的**局域网 IP**（`192.168.x.x` 或 `10.x.x.x`），不是 `127.0.0.1`
- 端口是 Clash Verge 配置中的 `mixed-port`（不是 socks-port 也不是 redir-port）

**IP 和端口都对？** ➡️ 继续 6.3

---

### 6.3 防火墙挡了吗？

📌 **检查方法**：

```powershell
# 在你的电脑上检查 Windows 防火墙规则
netsh advfirewall firewall show rule name="mihomo" dir=in

# 或者让同事从他的电脑测试能不能连到你的端口
# （同事的电脑上执行）
Test-NetConnection -ComputerName 你的IP -Port 7897
```

**防火墙阻止了？**
✅ 添加防火墙入站规则：

```powershell
# 以管理员身份运行
netsh advfirewall firewall add rule name="Clash LAN" dir=in action=allow protocol=TCP localport=7897
netsh advfirewall firewall add rule name="Clash LAN UDP" dir=in action=allow protocol=UDP localport=7897
```

或者在 Windows Defender 防火墙的高级设置中手动添加。

---

### 6.4 同事和你不在同一个子网？

📌 **检查方法**：比较你和同事的 IP 地址

- 你：`192.168.1.100`
- 同事：`192.168.1.200` → 同一子网 ✓
- 同事：`192.168.2.50` → **不同子网** ✗

**不在同一个子网？**
✅ 不同子网之间默认不能直接通信。解决方案：
1. 把你们连到同一个路由器 / 同一个 VLAN
2. 或者让网管配置子网间的路由

（🔗 参见 [办公室共享方案](office-sharing.md)）

---

### 6.5 同事需要认证吗？

如果你想控制谁能用你的代理（防止蹭网），mihomo 支持基于用户名密码的认证。

📌 **检查方法**：看配置文件中有没有 `authentication` 字段

```yaml
authentication:
  - "user1:password1"
  - "user2:password2"
```

**开了认证但同事没填用户名密码？**
✅ 告诉同事在代理设置中填写用户名和密码。代理地址格式：`http://user1:password1@你的IP:7897`

---

## 附：常用诊断命令速查

```powershell
# 检查 Clash 进程
Get-Process -Name "clash-verge*","mihomo*" -ErrorAction SilentlyContinue

# 查看系统代理设置
Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" | Select-Object ProxyEnable, ProxyServer

# 不走代理直接测试
curl -x "" https://www.baidu.com -o NUL -w "%{http_code}" --connect-timeout 5

# 走代理测试
curl -x http://127.0.0.1:7897 https://www.google.com -o NUL -w "%{http_code}" --connect-timeout 10

# DNS 测试
nslookup github.com 114.114.114.114
nslookup github.com 8.8.8.8

# 查看局域网 IP
ipconfig | Select-String "IPv4"

# 清除 DNS 缓存
ipconfig /flushdns

# 检查端口占用
netstat -ano | Select-String ":7897"

# 长时间 ping 测网络稳定性
ping 114.114.114.114 -t

# 检查防火墙规则
netsh advfirewall firewall show rule name=all dir=in | Select-String "mihomo|clash"
```

（🔗 更多诊断命令参见 [诊断命令速查](quick-diagnosis-commands.md)）

---

## 还是解决不了？

1. **去机场的 Telegram 群/Discord 问** — 很多时候是机场自身的问题，别人也遇到了
2. **去 Clash Verge 的 GitHub Issues 搜** — `https://github.com/clash-verge-rev/clash-verge-rev/issues`
3. **看 mihomo 的文档** — `https://wiki.metacubex.one/`
4. **截图发给你信得过的人看** — 有时候自己看不出来的问题别人一眼就能看到

---

> 这是一个活文档。每次遇到新问题并解决后，回来补充一个分支。
