// ============================================================
// Clash Verge Script 覆写：Cursor / 开发环境优化
// ============================================================
//
// 用法：Clash Verge → Profiles → 新建 Script 类型 Profile → 粘贴此脚本
//       或设置为 Global Script
//
// 这个脚本做了什么：
// 1. 配置 fake-ip DNS（避免 DNS 污染 + 零延迟响应）
// 2. 为 cursor.exe、code.exe、git.exe 等开发进程添加规则
// 3. 为 OpenAI、Anthropic、GitHub 等域名添加规则
// 4. 创建 "AI服务" 和 "开发工具" 策略组（如果不存在）
// 5. 启用 TUN 模式（可选，默认关闭，取消注释即可开启）
// 6. 配置 fake-ip-filter 排除项
//

function main(config) {

  // ============================================================
  // 辅助函数
  // ============================================================

  // 检查策略组是否已存在
  function hasProxyGroup(name) {
    return (config["proxy-groups"] || []).some(g => g.name === name);
  }

  // 获取可用的代理节点名列表（从已有策略组中提取，或直接用 proxies）
  function getAvailableProxies() {
    // 优先用 proxy-providers 的名字（如果有的话）
    var providerNames = Object.keys(config["proxy-providers"] || {});

    // 如果有 provider，返回 use 引用方式
    if (providerNames.length > 0) {
      return { use: providerNames };
    }

    // 否则用 config.proxies 里的节点名
    var names = (config.proxies || []).map(function(p) { return p.name; });
    return { proxies: names };
  }

  // ============================================================
  // 1. DNS 配置：fake-ip 模式
  // ============================================================

  // 完全替换 DNS 配置（不是合并），确保干净一致
  config.dns = {
    enable: true,
    listen: "0.0.0.0:1053",
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",

    // fake-ip-filter：这些域名不分配假 IP，返回真实解析结果
    // 某些应用/协议拿到假 IP 会行为异常
    "fake-ip-filter": [
      // Windows 网络连通性检测 —— 拿到假 IP 会误判"无网络连接"
      "*.msftconnecttest.com",
      "*.msftncsi.com",

      // NTP 时间同步服务 —— 需要真实 IP 才能正确同步时间
      "time.windows.com",
      "time.nist.gov",
      "time.apple.com",
      "time.*.com",
      "time.*.gov",
      "ntp.*.com",
      "time.*.edu.cn",

      // 本地域名 —— 不应该走代理
      "localhost",
      "*.local",
      "*.lan",
      "*.localdomain",
      "*.home.arpa",

      // STUN/WebRTC —— 语音视频通话的 NAT 穿透需要真实 IP
      "stun.*.*",
      "stun.*.*.*",

      // 微信/QQ —— IM 需要真实 IP 做连接优化
      "*.qq.com",
      "*.weixin.qq.com"
    ],

    // nameserver：主 DNS，用于解析国内域名
    // 选择国内可达的 DoH 服务器，加密 DNS 查询
    nameserver: [
      "https://doh.pub/dns-query",          // 腾讯 DNSPod
      "https://dns.alidns.com/dns-query"    // 阿里云
    ],

    // fallback：备用 DNS，用于解析被墙域名
    // 当 nameserver 解析结果被 fallback-filter 判定为"可能被污染"时启用
    fallback: [
      "https://dns.cloudflare.com/dns-query",
      "https://dns.google/dns-query",
      "tls://8.8.4.4:853"
    ],

    // fallback-filter：判断 nameserver 结果是否被污染
    "fallback-filter": {
      geoip: true,
      "geoip-code": "CN",
      ipcidr: ["240.0.0.0/4"],
      domain: [
        "+.google.com",
        "+.facebook.com",
        "+.youtube.com",
        "+.googleapis.com",
        "+.openai.com",
        "+.anthropic.com",
        "+.github.com"
      ]
    }
  };

  // ============================================================
  // 2. 确保 PROCESS-NAME 规则能工作
  // ============================================================

  config["find-process-mode"] = "always";

  // ============================================================
  // 3. 创建策略组（如果不存在）
  // ============================================================

  if (!config["proxy-groups"]) {
    config["proxy-groups"] = [];
  }

  var proxySource = getAvailableProxies();

  // 找一个已有的"手动选择"类策略组名字，作为子选项
  var existingSelectGroup = null;
  config["proxy-groups"].forEach(function(g) {
    if (g.type === "select" && !existingSelectGroup) {
      existingSelectGroup = g.name;
    }
  });

  // "AI服务" 策略组
  if (!hasProxyGroup("🤖 AI服务")) {
    var aiGroup = {
      name: "🤖 AI服务",
      type: "select",
      proxies: ["DIRECT"]
    };
    // 把已有的 select 策略组加为选项
    if (existingSelectGroup) {
      aiGroup.proxies.unshift(existingSelectGroup);
    }
    // 引用 proxy-providers 或直接加节点
    if (proxySource.use) {
      aiGroup.use = proxySource.use;
    } else if (proxySource.proxies && proxySource.proxies.length > 0) {
      aiGroup.proxies = proxySource.proxies.concat(aiGroup.proxies);
    }
    config["proxy-groups"].push(aiGroup);
  }

  // "开发工具" 策略组
  if (!hasProxyGroup("💻 开发工具")) {
    var devGroup = {
      name: "💻 开发工具",
      type: "select",
      proxies: ["DIRECT"]
    };
    if (existingSelectGroup) {
      devGroup.proxies.unshift(existingSelectGroup);
    }
    if (proxySource.use) {
      devGroup.use = proxySource.use;
    } else if (proxySource.proxies && proxySource.proxies.length > 0) {
      devGroup.proxies = proxySource.proxies.concat(devGroup.proxies);
    }
    config["proxy-groups"].push(devGroup);
  }

  // ============================================================
  // 4. 自定义规则
  // ============================================================
  //
  // 规则从上到下匹配，先命中先生效。
  // 我们把自定义规则插到最前面，确保优先级最高。

  var customRules = [
    // ---- 进程匹配：开发工具 ----
    // 按进程名匹配，不管访问什么域名都走"开发工具"策略组
    "PROCESS-NAME,cursor.exe,💻 开发工具",
    "PROCESS-NAME,code.exe,💻 开发工具",        // VS Code
    "PROCESS-NAME,git.exe,💻 开发工具",
    "PROCESS-NAME,node.exe,💻 开发工具",
    "PROCESS-NAME,npm.cmd,💻 开发工具",
    "PROCESS-NAME,docker.exe,💻 开发工具",

    // ---- 域名匹配：AI 服务 ----
    "DOMAIN-SUFFIX,openai.com,🤖 AI服务",
    "DOMAIN-SUFFIX,oaiusercontent.com,🤖 AI服务",
    "DOMAIN-SUFFIX,anthropic.com,🤖 AI服务",
    "DOMAIN-SUFFIX,claude.ai,🤖 AI服务",
    "DOMAIN-SUFFIX,cursor.sh,🤖 AI服务",
    "DOMAIN-SUFFIX,cursor.com,🤖 AI服务",
    "DOMAIN-SUFFIX,anysphere.inc,🤖 AI服务",

    // ---- 域名匹配：开发工具（代理） ----
    "DOMAIN-SUFFIX,github.com,💻 开发工具",
    "DOMAIN-SUFFIX,githubusercontent.com,💻 开发工具",
    "DOMAIN-SUFFIX,github.io,💻 开发工具",
    "DOMAIN-SUFFIX,githubassets.com,💻 开发工具",
    "DOMAIN-SUFFIX,npmjs.org,💻 开发工具",
    "DOMAIN-SUFFIX,npmjs.com,💻 开发工具",
    "DOMAIN-SUFFIX,yarnpkg.com,💻 开发工具",
    "DOMAIN-SUFFIX,docker.io,💻 开发工具",
    "DOMAIN-SUFFIX,docker.com,💻 开发工具",
    "DOMAIN-SUFFIX,gcr.io,💻 开发工具",
    "DOMAIN-SUFFIX,ghcr.io,💻 开发工具",
    "DOMAIN-SUFFIX,pypi.org,💻 开发工具",
    "DOMAIN-SUFFIX,pythonhosted.org,💻 开发工具",
    "DOMAIN-SUFFIX,stackoverflow.com,💻 开发工具",

    // ---- 域名匹配：国内镜像走直连 ----
    // 这些是国内的包管理镜像，走代理反而更慢
    "DOMAIN-SUFFIX,npmmirror.com,DIRECT",
    "DOMAIN-SUFFIX,registry.npmmirror.com,DIRECT",
    "DOMAIN-SUFFIX,mirrors.aliyun.com,DIRECT",
    "DOMAIN-SUFFIX,mirrors.tuna.tsinghua.edu.cn,DIRECT",
    "DOMAIN-SUFFIX,pypi.tuna.tsinghua.edu.cn,DIRECT"
  ];

  // 将自定义规则插入到现有规则的最前面
  config.rules = customRules.concat(config.rules || []);

  // 去重：如果订阅配置里已经有相同的规则，保留我们的（在前面）即可
  // Clash 是先匹配先生效，重复的后面那条永远不会被匹配到，不影响功能，只是冗余

  // ============================================================
  // 5. TUN 模式（可选）
  // ============================================================
  //
  // TUN 模式在 OS 层面劫持所有网络流量，不依赖应用自己设置代理。
  // 好处：docker、git、node 等不读系统代理设置的程序也能走代理。
  // 前提：需要安装 Clash Verge Service Mode（管理员权限）。
  //
  // 如果你已经安装了 Service Mode 并想开启 TUN，取消下面的注释：

  /*
  config.tun = {
    enable: true,
    stack: "mixed",         // mixed = gVisor + system，兼顾兼容性和性能
    "dns-hijack": [
      "any:53"              // 劫持所有 DNS 请求到 Clash 的 DNS 模块
    ],
    "auto-route": true,     // 自动配置系统路由表
    "auto-detect-interface": true
  };
  */

  // ============================================================
  // 6. 其他优化
  // ============================================================

  // TLS 指纹伪装成 Chrome，帮助规避 GFW 的 TLS 指纹识别
  config["global-client-fingerprint"] = "chrome";

  // 允许 IPv6（看你的网络环境，不确定就关掉）
  config.ipv6 = false;

  // TCP 并发：同时发起多个 TCP 连接，用最快建立的那个
  // 可以改善高延迟网络下的体验
  config["tcp-concurrent"] = true;

  return config;
}
