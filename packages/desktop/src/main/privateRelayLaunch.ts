// 私域 relay 启动配置解析。
//
// 背景：远控的私域模式最初只靠三个环境变量（由 neko-relay 的启动脚本注入），
// 一旦用户绕过脚本直接双击 AppImage、或桌面启动器缓存了旧入口，变量丢失，
// 远控就会退回官方云并卡在"需要先登录"。这里改为「环境变量优先 + 落盘配置兜底」：
//   - 环境变量（NEKODE_WEB_REMOTE_CONTROL_*）：启动脚本可覆盖（如换端口/换网络）。
//   - ~/.nekode/private-relay.json：{ "port": 8788, "jwt": "..." }，由 neko-relay
//     的 setup 脚本写入。只要该文件存在且 relay 在本机运行，远控就处于私域模式。
//
// 桌面端自身连接一律走 127.0.0.1（relay 与桌面同机，最稳）；二维码/手机页面 URL
// 需要手机可达的局域网地址，因此在这里按网卡自动探测，绝不写死 IP。
import { readFileSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { join } from "node:path";

export interface PrivateRelayLaunch {
  jwt: string;
  port: number;
  /** 二维码/链接指向的手机页面地址。 */
  remoteUrl: string;
  /** 桌面端自用的 relay WebSocket 地址（本机回环）。 */
  relayWsUrl: string;
}

interface PrivateRelayFileConfig {
  port?: unknown;
  jwt?: unknown;
}

export function resolvePrivateRelayLaunch(
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory = homedir(),
): PrivateRelayLaunch | null {
  const envJwt = env["NEKODE_WEB_REMOTE_CONTROL_JWT"]?.trim();
  const envUrl = env["NEKODE_WEB_REMOTE_CONTROL_URL"]?.trim();
  const envWs = env["NEKODE_WEB_REMOTE_CONTROL_RELAY_WS_URL"]?.trim();

  if (envJwt) {
    const port = parsePortFromUrl(envUrl ?? envWs) ?? 8788;
    return {
      jwt: envJwt,
      port,
      remoteUrl: envUrl ?? buildDefaultRemoteUrl(port),
      relayWsUrl: envWs ?? `ws://127.0.0.1:${port}/api/v1/remote/ws2`,
    };
  }

  const file = readPrivateRelayFile(homeDirectory);
  if (!file?.jwt) return null;
  const port = typeof file.port === "number" && file.port > 0 ? file.port : 8788;
  return {
    jwt: file.jwt,
    port,
    remoteUrl: envUrl ?? buildDefaultRemoteUrl(port),
    relayWsUrl: envWs ?? `ws://127.0.0.1:${port}/api/v1/remote/ws2`,
  };
}

function readPrivateRelayFile(homeDirectory: string): { jwt: string; port?: number } | null {
  const candidates = [
    process.env["NEKODE_DATA_BASE_DIR"]
      ? join(process.env["NEKODE_DATA_BASE_DIR"], "private-relay.json")
      : null,
    join(homeDirectory, ".nekode", "private-relay.json"),
  ].filter((path): path is string => Boolean(path));

  for (const path of candidates) {
    let raw: string;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as PrivateRelayFileConfig;
      const jwt = typeof parsed.jwt === "string" ? parsed.jwt.trim() : "";
      if (!jwt) return null;
      return {
        jwt,
        port: typeof parsed.port === "number" ? parsed.port : undefined,
      };
    } catch {
      // 文件损坏按不存在处理，远控回退官方链路。
      continue;
    }
  }
  return null;
}

function parsePortFromUrl(value: string | undefined): number | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const port = Number(parsed.port);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

function buildDefaultRemoteUrl(port: number): string {
  const lanIp = detectLanIpv4() ?? "127.0.0.1";
  return `http://${lanIp}:${port}/remote/v4`;
}

/**
 * 探测手机可访问的局域网 IPv4：跳过回环、容器网桥、代理 TUN（FlClash 的
 * 198.18/15 fake-ip）与 Tailscale（100.64/10），优先 RFC1918 私网地址。
 * 探测不到时返回 null（调用方回退 127.0.0.1，手机需要手动输地址）。
 */
export function detectLanIpv4(
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string | null {
  const preferred: string[] = [];
  const fallback: string[] = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (/^(docker|br-|veth|virbr|tun|tap|tailscale|FlClash)/i.test(name)) continue;
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      if (/^198\.(18|19)\./.test(address.address)) continue; // 代理 fake-ip 段
      if (address.address.startsWith("100.")) continue; // Tailscale CGNAT 段
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(address.address)) {
        preferred.push(address.address);
      } else {
        fallback.push(address.address);
      }
    }
  }
  return preferred[0] ?? fallback[0] ?? null;
}
