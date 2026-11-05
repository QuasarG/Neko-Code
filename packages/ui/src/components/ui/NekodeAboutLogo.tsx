import { cn } from "@/components/lib/utils.js";

/** Nekode 标记：深底圆角方块 + 猫头终端箭头。 */
export function NekodeAboutLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="118"
      height="118"
      viewBox="0 0 256 256"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="256" height="256" rx="54" fill="#211829" />
      <path
        d="M 52 53 L 92 82 H 164 L 204 53 V 151 C 204 187, 175 203, 128 211 C 81 203, 52 187, 52 151 Z"
        fill="#B988EA"
      />
      <path
        d="M 84 119 L 109 143 L 84 167"
        fill="none"
        stroke="#211829"
        strokeWidth="12"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <path
        d="M 172 119 L 147 143 L 172 167"
        fill="none"
        stroke="#211829"
        strokeWidth="12"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <rect x="118" y="178" width="20" height="12" fill="#211829" />
    </svg>
  );
}

/** 横向标识：猫头标记 + Nekode 字标。 */
export function NekodeWordmarkLogo({ className }: { className?: string }) {
  return (
    <svg
      width="244"
      height="54"
      viewBox="0 0 244 54"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(0 0) scale(0.2109)">
        <rect width="256" height="256" rx="54" fill="#211829" />
        <path
          d="M 52 53 L 92 82 H 164 L 204 53 V 151 C 204 187, 175 203, 128 211 C 81 203, 52 187, 52 151 Z"
          fill="#B988EA"
        />
        <path
          d="M 84 119 L 109 143 L 84 167"
          fill="none"
          stroke="#211829"
          strokeWidth="12"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <path
          d="M 172 119 L 147 143 L 172 167"
          fill="none"
          stroke="#211829"
          strokeWidth="12"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        <rect x="118" y="178" width="20" height="12" fill="#211829" />
      </g>
      <text
        x="68"
        y="38"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="30"
        fontWeight="600"
      >
        Nekode
      </text>
    </svg>
  );
}
