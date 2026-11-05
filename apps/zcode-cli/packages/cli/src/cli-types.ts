import type { TuiReadClipboardImage, TuiWriteClipboardText } from "@zcode/tui";
import type { UiLocale } from "@zcode/i18n";
import type { Logger } from "@zcode/contracts";
import type {
  createManagedCdpBrowserRuntime,
  ManagedCdpBrowserRuntimeOptions,
} from "@zcode/adapters/browser";
import type {
  createDefaultProviderEndpointRoutingPort,
  createModelAdapter,
  createNekodeApp,
  CreateDefaultProviderEndpointRoutingPortOptions,
  CreateModelAdapterOptions,
  configureCodingPlanApiKey,
  ConfigureCodingPlanApiKeyOptions,
  inspectNekodeSkill,
  inspectWorkspaceHookTrust,
  grantWorkspaceHookTrust,
  revokeWorkspaceHookTrustCli,
  inspectNekodeCustomCommand,
  InspectNekodeCustomCommandOptions,
  InspectNekodeSkillOptions,
  loginNekodeCli,
  loginBigmodelCodingPlan,
  LoginBigmodelCodingPlanOptions,
  LoginNekodeCliOptions,
  listNekodeCustomCommands,
  ListNekodeCustomCommandsOptions,
  loadNekodeCustomCommand,
  listNekodeSessions,
  listNekodeSkills,
  ListNekodeSessionsOptions,
  ListNekodeSkillsOptions,
  logoutNekodeCli,
  LogoutNekodeCliOptions,
  resolveLatestSession,
  ResolveLatestSessionOptions,
  RunNekodeProtocolAgentOptions,
  prepareNekodeTelemetryEnv,
  startProcessProviderRegistryRuntime,
  shutdownNekodeTelemetry,
  NekodeAppOptions,
} from "@zcode/bootstrap";
import type { CliEnv, DotenvLoadResult, LoadCliDotenvOptions } from "./env.js";
import type { PluginsCommandOverrides } from "./plugins-command.js";
import type { CliShutdownProcess } from "./shutdown.js";
import type { resolveWorkspaceGitBranch } from "./tui-workspace-git.js";

export type BootstrapModule = typeof import("@zcode/bootstrap");

export interface RunDependencies extends PluginsCommandOverrides {
  migrateStorage?: () => Promise<import("@zcode/shared/sqlite-migrations").MigrationResult>;
  protocolLifecycle?: RunNekodeProtocolAgentOptions["lifecycle"];
  protocolInput?: NodeJS.ReadableStream;
  createManagedCdpBrowserRuntime?: (
    options?: ManagedCdpBrowserRuntimeOptions,
  ) => ReturnType<typeof createManagedCdpBrowserRuntime>;
  createModelAdapter?: (
    options?: CreateModelAdapterOptions,
  ) => ReturnType<typeof createModelAdapter>;
  createProviderEndpointRoutingPort?: (
    options: CreateDefaultProviderEndpointRoutingPortOptions,
  ) => ReturnType<typeof createDefaultProviderEndpointRoutingPort>;
  createNekodeApp?: (
    options?: NekodeAppOptions,
  ) => Awaited<ReturnType<typeof createNekodeApp>> | ReturnType<typeof createNekodeApp>;
  /**
   * Session-event shaper for --output-format stream-json. Defaults to the
   * bootstrap module's, which is also what the protocol server uses; injectable
   * so a caller that supplies its own `createNekodeApp` (tests, embedders) can
   * still stream, since the bootstrap module is not loaded on that path.
   */
  mapSessionEvent?: BootstrapModule["mapSessionEvent"];
  cwd?: () => string;
  env?: CliEnv;
  inspectSkill?: (options: InspectNekodeSkillOptions) => ReturnType<typeof inspectNekodeSkill>;
  inspectWorkspaceHookTrust?: typeof inspectWorkspaceHookTrust;
  grantWorkspaceHookTrust?: typeof grantWorkspaceHookTrust;
  revokeWorkspaceHookTrustCli?: typeof revokeWorkspaceHookTrustCli;
  inspectCustomCommand?: (
    options: InspectNekodeCustomCommandOptions,
  ) => ReturnType<typeof inspectNekodeCustomCommand>;
  loginNekodeCli?: (options?: LoginNekodeCliOptions) => ReturnType<typeof loginNekodeCli>;
  loginBigmodelCodingPlan?: (
    options?: LoginBigmodelCodingPlanOptions,
  ) => ReturnType<typeof loginBigmodelCodingPlan>;
  configureCodingPlanApiKey?: (
    options: ConfigureCodingPlanApiKeyOptions,
  ) => ReturnType<typeof configureCodingPlanApiKey>;
  loadDotenv?: (options?: LoadCliDotenvOptions) => DotenvLoadResult;
  prepareNekodeTelemetryEnv?: typeof prepareNekodeTelemetryEnv;
  projectConfigPath?: string;
  listSessions?: (options: ListNekodeSessionsOptions) => ReturnType<typeof listNekodeSessions>;
  listCustomCommands?: (
    options: ListNekodeCustomCommandsOptions,
  ) => ReturnType<typeof listNekodeCustomCommands>;
  loadCustomCommand?: (
    options: InspectNekodeCustomCommandOptions,
  ) => ReturnType<typeof loadNekodeCustomCommand>;
  // headless slash 路由要和 app facade 的保留名 gate 用同一个判据；默认取 bootstrap 的，
  // 注入点只为让单测不必拉起整个 bootstrap 模块。见 prompt-command.ts。
  isReservedSlashCommandName?: BootstrapModule["isReservedNekodeSlashCommandName"];
  listSkills?: (options: ListNekodeSkillsOptions) => ReturnType<typeof listNekodeSkills>;
  logger?: Logger;
  readClipboardImage?: TuiReadClipboardImage;
  writeClipboardText?: TuiWriteClipboardText;
  resolveLatestSession?: (
    options: ResolveLatestSessionOptions,
  ) => ReturnType<typeof resolveLatestSession>;
  resolveWorkspaceGitBranch?: typeof resolveWorkspaceGitBranch;
  logoutNekodeCli?: (options?: LogoutNekodeCliOptions) => ReturnType<typeof logoutNekodeCli>;
  runNekodeProtocolAgent?: (options?: RunNekodeProtocolAgentOptions) => Promise<void>;
  runTui?: typeof import("@zcode/tui").runTui;
  skipUserConfig?: boolean;
  userConfigPath?: string;
  exitProcess?: (code: number) => void;
  shutdownCleanupTimeoutMs?: number;
  shutdownProcess?: CliShutdownProcess;
  startProcessProviderRegistryRuntime?: typeof startProcessProviderRegistryRuntime;
  shutdownNekodeTelemetry?: typeof shutdownNekodeTelemetry;
}

export type CliPermissionMode = "build" | "plan" | "edit" | "yolo" | "guarded";
export type CliRuntimeMode = CliPermissionMode | "auto";

export interface CliModeState {
  current?: CliRuntimeMode;
  override?: CliPermissionMode;
}

export interface CliTargetRequest {
  objective: string;
  replaceExisting: boolean;
}

export type ModeCapableApp = Awaited<ReturnType<typeof createNekodeApp>> & {
  getMode?: () => CliRuntimeMode;
  setLocale?: (locale: UiLocale) => Promise<{ locale: "en-US" | "zh-CN" }>;
  setMode?: (mode: CliRuntimeMode) => Promise<{ mode: CliRuntimeMode }>;
};

export interface CliResumeRequest {
  continueSession: boolean;
  resumeSessionId?: string;
}
