# neko-relay

Nekode 手机远控的**私域 relay**（单用户，LAN 模式）。桌面端与手机端的客户端代码零改动，
只是把官方 zcode.z.ai 的 relay 换成本机进程；手机页面也由本进程同源托管。

## 组成

```
手机浏览器 ──http://<lan-ip>:8788/login──→ 密码换 JWT，写入 localStorage
           ──http://<lan-ip>:8788/remote/v4──→ packages/web 构建产物（同源）
           ──ws://<lan-ip>:8788/api/v1/remote/ws2──┐
桌面 Nekode main ──ws://<lan-ip>:8788/... ───────┤  配对/心跳/透传（Relay V2 契约）
                                                ▼
                                          src/server.js
```

## 首次装配

```bash
pnpm install                       # ws + zod
node scripts/setup.mjs             # 生成 config.json 与 desktop-jwt，打印手机密码（只显示一次）
```

## 常驻

```bash
cp neko-relay.service ~/.config/systemd/user/neko-relay.service
systemctl --user daemon-reload
systemctl --user enable --now neko-relay
systemctl --user status neko-relay
```

## 启动桌面端

**启动方式无关**：`scripts/setup.mjs` 会把 `{ port, jwt }` 写进
`~/.nekode/private-relay.json`，Nekode 主进程启动时自动发现并进入私域模式——
图标、双击 AppImage、任何启动器都一样生效。桌面连接固定走 `127.0.0.1`，
二维码里的局域网地址由主进程枚举网卡自动探测（跳过 docker/tun/tailscale/代理段）。

`nekode.desktop` 仍指向 `bin/launch-nekode.sh`（额外注入三个 `NEKODE_WEB_REMOTE_CONTROL_*`
环境变量，作为覆盖手段：换端口、临时换网络时可用）。删掉
`~/.nekode/private-relay.json` 即回退官方 relay。

## 手机使用

1. 手机连与桌面同一 WiFi；
2. 桌面 Nekode → 远控弹窗 → 开启，出现二维码；
3. 手机扫码（或用桌面显示的链接）打开登录页 → 输入密码；
4. 设备列表选中桌面机 → 配对成功，接管会话。

## 运维

| 动作 | 做法 |
| --- | --- |
| 改密码 | 改 `config.json` 的 `passwordSha256`（`node -e "console.log(require('crypto').createHash('sha256').update('新密码').digest('hex'))"`），重启服务 |
| 轮换 JWT 密钥 | 换 `config.json.jwtSecret`，删 `desktop-jwt` 重跑 `setup.mjs`，手机重新登录 |
| 看日志 | `journalctl --user -u neko-relay -f` |
| 端口冲突 | 改 `config.json.port`（desktop 的启动脚本会自动跟随） |

## 与官方 relay 的差异

单进程单用户；设备表不持久化（relay 重启后手机重新扫码即可）；同 `device_mid` 重复注册
替换旧记录；无推送设施（`notification/status` 返回 `unavailable`，桌面侧自动关闭推送上报）。
协议细节与官方一致，见 `src/contract.js` 的出处注释。

## 公网化（未实施）

同一进程可直接跑在任何公网机器上，加 TLS 反代（wss + https 同源）后仅改启动脚本里的
两个 URL，代码零改动。注意官方协议无端到端加密，公网部署时 TLS 是唯一防线。
