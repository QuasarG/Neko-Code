# 私域 Relay 部署（LAN 模式）

Nekode 的手机远控默认依赖 zcode.z.ai 官方云（Relay V2 Go 服务 + OAuth + OSS 页面托管），且协议无端到端加密，官方 relay 可见全部明文流量。本文档描述把这条链路完整搬进私域的最小改法。

## 拓扑（LAN 模式）

```
手机浏览器(同一 WiFi)
  │ http://<桌面机IP>:8788/login → 写入 localStorage 凭据（同源 shim 页）
  │ http://<桌面机IP>:8788/remote/v4 → 页面 origin 推导 relay URL
  │ ws://<桌面机IP>:8788/api/v1/remote/ws2
  ▼
neko-relay（桌面机上的独立 Node 进程，systemd user 服务）
  │ 单用户 JWT(HS256) + 一次性 token + 配对/心跳/透传（契约同官方 V2）
  │ 同时静态托管 packages/web 构建产物（同源硬约束）
  ▼ ws://127.0.0.1:8788（环境变量覆盖）
Nekode 桌面 main → 窗口 Host attachment（web-remote-replayable）
```

无 TLS、无公网暴露；手机仅限与桌面机同网段使用。

## 桌面端改动（唯一一处代码改动）

`packages/desktop/src/main/index.ts`：新增 `NEKODE_WEB_REMOTE_CONTROL_JWT` 环境变量。
设置后仅远控链路改用该 JWT，不读 credential 仓——仓里的 `zcodejwttoken` 是 GLM 账号体系
共用登录令牌（BigModel 套餐请求、provider provisioning、feedback、official MCP 均消费），
为私域覆盖它会破坏账号链路，因此远控令牌必须旁路。

配套环境变量（上游自带，无需改码）：

| 变量 | 值 |
| --- | --- |
| `NEKODE_WEB_REMOTE_CONTROL_RELAY_WS_URL` | `ws://<桌面机IP>:8788/api/v1/remote/ws2` |
| `NEKODE_WEB_REMOTE_CONTROL_URL` | `http://<桌面机IP>:8788/remote/v4`（二维码指向） |
| `NEKODE_WEB_REMOTE_CONTROL_JWT` | 私域 JWT（无 exp，避免手机端按过期清理凭据） |

**启动方式无关的自动发现**（首选路径）：neko-relay 的 setup 脚本写入
`~/.nekode/private-relay.json`（`{ "port", "jwt" }`），Nekode 主进程启动时
`resolvePrivateRelayLaunch()` 按「环境变量 → 落盘配置」的顺序解析：存在该文件即进入
私域模式。桌面端连接固定走 `127.0.0.1`（relay 同机，最稳）；二维码/手机页面 URL 的
局域网 IP 由主进程枚举网卡自动探测（跳过 docker/veth/tun/tailscale 与代理 fake-ip 段
198.18/15），不写死。环境变量（`nekode.desktop` 的 `Exec` 前缀注入）仍保留为覆盖手段。

另有配套改动 `webRemoteControlManager.hasStaticLogin`（由主进程根据环境变量传入）：
私域静态令牌模式下忽略账号登录态通知。原因是 Nekode 分支已移除账号登录入口，
渲染层启动时必然上报 `signed-out`，原逻辑会把所有窗口钉成 `auth-required`，
而弹窗里的登录按钮是死链——静态模式直接跳过该分支，远控不依赖任何账号体系。

私域模式下 `getEndpointUrls()` 的 **origin 也必须一起替换为 `http://127.0.0.1:<port>`**：
设备注册、一次性 token、推送上报都走 HTTP origin，只换 `relayWsUrl` 会让桌面拿私域
JWT 去官方 `zcode.z.ai` 注册并被 401 打成 auth-required（2026-11-04 实测踩坑）。
二维码的 `remoteUrl` 保持局域网地址（手机可达），手机侧 relay 地址由页面 origin 推导。

同时 `WebRemoteControlDialog` 已整体移除「需要先登录」卡片与登录按钮（2026-11-04，
zexin 拍板：coding plan auth 与远控无关，直接砍掉）。弹窗打开即自动启动远控；
状态轮询不再应用 `auth-required`，远端 relay 认证失败会以普通错误提示呈现。

## 手机端鉴权（shim 页，不改 web 应用代码）

`/login` 同源页：密码 → relay 签发 JWT → 写入浏览器 localStorage 四键
（`zcodejwttoken`、`oauth:active_provider`=`zai`、`oauth:zai:access_token`、
`oauth:zai:user_info`）→ 跳转 `/remote/v4`。`WebAuthService.loadCachedSessionState`
要求四键齐全且 JWT 未过期，shim 写全即可绕过官方 OAuth。

## relay 服务契约面

- HTTP：`/api/v1/remote/device` 注册/列表、`/api/v1/remote/device/delete`、
  `/api/v1/remote/token`（60s 一次性）、`/api/v1/remote/notification/status`
  （声明 `unavailable`，桌面侧优雅关闭推送上报）、`/api/v1/remote/notification/events`（回 `ignored`）。
- WS `/api/v1/remote/ws2`：`auth_init` 按 `device_sid` 配对、同角色重连 KICKED、
  device 掉线推 `DEVICE_OFFLINE`、`pair_status_query` 心跳、`data.payload` 纯透传、单消息 1MiB。
- 与官方差异：单进程单用户；同 `device_mid` 重复注册替换旧记录（官方会累积）；
  推送能力不实现（status=unavailable）；设备表不持久化（重启后手机重新扫码即可）。

## 验收

1. relay 本地回环测试：device/terminal 双角色脚本完成 register→token→auth_init→matched→数据互传。
2. `curl /remote/v4` 返回 web 构建产物；`curl /login` 返回 shim 页。
3. 真机：桌面开远控出二维码 → 手机同 WiFi 扫码 → 设备配对 → 会话接管、断线重连恢复。

## 后续（公网模式，未实施）

同一 relay 进程部署到公网机器（如 182.92.129.1）+ TLS（tailscale cert 或 CF），
仅改两个 URL 环境变量的 scheme/host，代码零改动。
