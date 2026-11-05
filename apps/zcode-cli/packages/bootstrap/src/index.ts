// Bootstrap public API surface.

export * from "./app/create-app.js";
export type {
  ListNekodeSessionsOptions,
  PromptInput,
  ResolveLatestSessionOptions,
  ResumeOptions,
  RunNekodeProtocolAgentOptions,
  SendInputOptions,
  SendInputResult,
  SetLocaleResult,
  SteerTurnOptions,
  SubmitPromptOptions,
  UserPromptInput,
  NekodeApp,
  NekodeAppOptions,
  NekodeModelOption,
} from "./app/types.js";
export * from "./auth-login.js";
export {
  inspectNekodeCustomCommand,
  listNekodeCustomCommands,
  loadNekodeCustomCommand,
} from "./custom-commands.js";
export type {
  InspectNekodeCustomCommandOptions,
  ListNekodeCustomCommandsOptions,
  NekodeCustomCommandInspection,
} from "./custom-commands.js";
export { createModelAdapter } from "./model-factory.js";
export type { CreateModelAdapterOptions } from "./model-factory.js";
export {
  createDefaultProviderEndpointRoutingPort,
  resolveProcessProviderEndpointRoutingPort,
} from "./provider-endpoint-routing.js";
export type {
  CreateDefaultProviderEndpointRoutingPortOptions,
  ResolveProcessProviderEndpointRoutingPortOptions,
} from "./provider-endpoint-routing.js";
export { startProcessProviderRegistryRuntime } from "./app/process-provider-registry-runtime.js";
export type { ProcessProviderRegistryRuntimeOptions } from "./app/process-provider-registry-runtime.js";
export {
  addNekodePluginMarketplace,
  getNekodePluginsOverview,
  installNekodeMarketplacePlugin,
  listNekodePlugins,
  removeNekodePluginMarketplace,
  resolveNekodePlugins,
  setNekodePluginEnabled,
  uninstallNekodeMarketplacePlugin,
  updateNekodeMarketplacePlugin,
  updateNekodePluginMarketplace,
  validateNekodePluginPath,
} from "./plugins.js";
export type {
  AddNekodeMarketplaceOptions,
  InstallNekodeMarketplacePluginOptions,
  ListNekodePluginsOptions,
  RemoveNekodeMarketplaceOptions,
  ResolveNekodePluginsOptions,
  SetNekodePluginEnabledOptions,
  SetNekodePluginEnabledResult,
  UninstallNekodeMarketplacePluginOptions,
  UpdateNekodeMarketplaceOptions,
  UpdateNekodeMarketplacePluginOptions,
  ValidateNekodePluginPathOptions,
  NekodeAvailablePluginData,
  NekodeInstalledPluginData,
  NekodeMarketplaceSummaryData,
  NekodeMarketplaceUpdateData,
  NekodePluginInstallData,
  NekodePluginUpdateData,
  NekodePluginsOverviewData,
} from "./plugins.js";
export { runNekodeProtocolAgent } from "./zcode-protocol-entrypoint.js";
// Exposed for the CLI's --output-format stream-json: it needs the same event
// shape the protocol server emits, rather than inventing a second one.
export { mapSessionEvent } from "./zcode-protocol/session-mapper.js";
export { prepareNekodeTelemetryEnv, shutdownNekodeTelemetry } from "./telemetry-bootstrap.js";
export type { SessionTranscriptMessage, SessionTranscriptPart } from "./session-transcript.js";
export { listNekodeSessions, resolveLatestSession } from "./sessions.js";
export { inspectNekodeSkill, listNekodeSkills } from "./skills.js";
export type {
  InspectNekodeSkillOptions,
  ListNekodeSkillsOptions,
  NekodeSkillInspection,
} from "./skills.js";
// Exposed for the CLI's headless slash routing: it must decide "is this a real
// custom command?" with the *same* reserved-name gate the app facade's
// customCommandPromptResolver applies, or the two disagree and a reserved name
// reaches the model as literal prompt text. See prompt-command.ts.
export { isReservedNekodeSlashCommandName } from "./slash-command-surface.js";
export {
  grantWorkspaceHookTrust,
  inspectWorkspaceHookTrust,
  revokeWorkspaceHookTrustCli,
} from "./workspace-hook-trust-cli.js";
export type {
  WorkspaceHookTrustCliItem,
  WorkspaceHookTrustCliStatus,
  WorkspaceHookTrustCliTarget,
} from "./workspace-hook-trust-cli.js";

// 嵌入式调用复用产品请求装配，避免来源头与网络配置漂移。
export { createRuntimeAiSdkModelExecutionConfig } from "./model-config.js";
