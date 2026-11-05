import type { ReactNode } from "react";
import { cn } from "@/components/lib/utils.js";

interface RootStartupLoadingProps {
  label: string;
  children?: ReactNode;
  busy?: boolean;
}

export function RootStartupLoading({ label, children, busy = true }: RootStartupLoadingProps) {
  return (
    <div
      // Web 端全局 html/body/#root 为 Electron 透明背景让路，React 接管后会替换 HTML 启动壳。
      // 这里必须由阻塞态自身承接主题背景，否则远控链接会在 Root 恢复期间继续露出浏览器白底。
      className="flex h-full min-h-dvh flex-col items-center justify-center gap-6 bg-background text-foreground"
      role="status"
      aria-busy={busy}
      aria-label={label}
      data-testid="root-startup-loading"
    >
      <NekodeStartupLogoBadge />
      {children}
    </div>
  );
}

/** 初始化与引导共用品牌图标，保持底色、描边、圆角和标志比例一致。 */
export function NekodeStartupLogoBadge({
  animated = true,
  size = "default",
}: {
  animated?: boolean;
  size?: "default" | "titlebar";
}) {
  return (
    <div
      data-desktop-logo-badge={size === "titlebar" ? "true" : undefined}
      className={cn(
        "relative flex items-center justify-center bg-[linear-gradient(180deg,#000000_0%,#151718_100%)] text-[#ffffff] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-[rgba(255,255,255,0.1)] before:content-['']",
        size === "titlebar"
          ? "size-5 rounded shadow-sm/20 before:border-white/20"
          : "size-24 rounded-3xl shadow-xl/20",
      )}
    >
      {/* Button 会给 SVG 默认尺寸；紧凑 Logo 显式恢复自动高度，保持标志原始比例。 */}
      <NekodeStartupLogo
        className={size === "titlebar" ? "size-auto w-3.25" : "h-auto w-14"}
        animated={animated}
      />
    </div>
  );
}

export function NekodeStartupLogo({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="118"
      height="118"
      fill="none"
      viewBox="0 0 256 256"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      {animated ? (
        <animate
          attributeName="opacity"
          begin="3s"
          dur="1.8s"
          repeatCount="indefinite"
          values="1;0.4;1"
        />
      ) : null}
<path d="M 52 53 L 92 82 H 164 L 204 53 V 151 C 204 187, 175 203, 128 211 C 81 203, 52 187, 52 151 Z" fill="#B988EA" />
        <path d="M 84 119 L 109 143 L 84 167" fill="none" stroke="#111111" stroke-width="12" stroke-linecap="butt" stroke-linejoin="miter" />
        <path d="M 172 119 L 147 143 L 172 167" fill="none" stroke="#111111" stroke-width="12" stroke-linecap="butt" stroke-linejoin="miter" />
        <rect x="118" y="178" width="20" height="12" fill="#111111" />
    </svg>
  );
}
