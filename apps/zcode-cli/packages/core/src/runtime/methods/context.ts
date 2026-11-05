import {
  traceContextToLogContext,
  createContextBuilder,
  createSubagentContextBuilder,
} from "../deps.js";
import type {
  Model,
  ModelToolCall,
  SkillLoadOutcome,
  TraceContext,
  ContextSourceSnapshot,
  ContextBuilder,
  ContextBuilderConfig,
} from "../deps.js";
import type { NekoMemoryBook } from "@zcode/contracts/neko-memory";
import type { AgentRuntimeInternal } from "../internal.js";
import { shouldUseMidConversationSystem } from "../helpers/runtime-provider-request-messages.js";
import { buildContextHistoryEntries } from "./context-history-entries.js";
import { resolveRuntimeEmbeddedSearchEnabled } from "./embedded-search-branch.js";
import { formatAgentProfileForPrompt } from "../../subagent/profile.js";
import { getContextSourceShellDisplayName } from "./session-shell-environment.js";
import {
  ensureGenUiOutputDirectory,
  resolveGenUiOutputDirectory,
} from "../helpers/gen-ui-output.js";

export { buildContextHistoryEntries };

/**
 * 本会话可见的记忆书：无书架端口（子代理、工作流子会话）返回 undefined，
 * Memory 段随之缺席。books() 按 workspace key 解析项目身份并确保文件存在，
 * 与每轮投递（neko-memory-turn.ts）用同一口径，两个入口看到同一组书。
 */
export function resolveNekoMemoryBooks(
  runtime: AgentRuntimeInternal,
): readonly NekoMemoryBook[] | undefined {
  return runtime.nekoMemoryBooks?.books({
    workspacePath: runtime.config.workspacePath ?? runtime.workingDirectory,
    workspaceIdentity: runtime.config.workspaceIdentity?.toString(),
  });
}

export async function ensureContextInitialized(
  this: AgentRuntimeInternal,
  traceContext: TraceContext,
  model?: Model,
): Promise<void> {
  if (this.contextInitialized) return;

  const shellDisplayName = getContextSourceShellDisplayName(this);
  // child 的快照只由父级传下的配置组成（envInfo、日期、指令快照），端口只留给 cd 之后的环境探测。
  // 修复原因：child 持有父级端口后在这里走完整解析，会重新查找 project root、探测 Project Context，
  // 而 child 的 context builder 不使用这些结果，每次启动都白读一次磁盘。
  const contextSourcePort = this.config.subagentContext ? undefined : this.contextSourcePort;
  const snapshot = contextSourcePort
    ? await contextSourcePort.resolveContextSources(
        {
          workingDirectory: this.workingDirectory,
          currentDate: this.config.currentDate,
          effectiveShellDisplayName: shellDisplayName,
          envInfo: this.config.envInfo,
          userInstructions: this.config.userInstructions
            ? {
                ...this.config.userInstructions,
                workingDirectory:
                  this.config.userInstructions.workingDirectory ?? this.workingDirectory,
              }
            : undefined,
          projectContext: this.config.projectContext,
          trace: traceContext,
        },
        { signal: undefined },
      )
    : this.createConfigOnlyContextSnapshot(this.workingDirectory);

  this.workingDirectory = snapshot.workingDirectory;
  // Bash cd 之后 workingDirectory 会变化，但 workspaceRoot 仍表示会话初始工作区边界。
  this.workspaceRoot = snapshot.workingDirectory;
  this.contextSourceSnapshot = snapshot;
  this.sessionStartGitPrefetch = true;
  this.startMcpStartup(traceContext);
  this.skillLoadOutcome = await this.discoverSkillsForContext(traceContext);
  await ensureGenUiOutputDirectory(this);
  this.contextBuilder = this.createContextBuilderFromSnapshot(
    snapshot,
    resolveNekoMemoryBooks(this),
    {
      model,
    },
  );
  // Bug 根因：模型创建失败轮会在 Context 首次可初始化前接纳并持久化用户输入。
  // init 会替换全部内存历史，因此先保留这些权威运行条目，再接到新建的 Context 前缀之后。
  const preContextEntries = [...this.messageHistory.borrowReadOnlyRuntimeEntries()];
  this.initializeMessageHistoryFromContext(this.contextBuilder, traceContext);
  this.messageHistory.addEntries(preContextEntries);
  this.contextInitialized = true;
}

export async function getSkillCatalog(
  this: AgentRuntimeInternal,
  traceContext: TraceContext,
): Promise<SkillLoadOutcome> {
  // Composer 曾独立扫描磁盘，所以运行中的 Session 会看到 AgentRuntime
  // 尚未加载的新 Skill。先经过 runtime 唯一的 context 初始化门，再返回防御性副本，
  // 让 UI 与本 Session 实际可用的 Skill 保持同一快照；新 runtime 会自然重新发现。
  await this.ensureContextInitialized(traceContext);
  const outcome = this.skillLoadOutcome ?? {
    skills: [],
    diagnostics: [],
    totalDiscovered: 0,
  };
  return {
    skills: outcome.skills.map((skill) => ({ ...skill })),
    diagnostics: outcome.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    totalDiscovered: outcome.totalDiscovered,
  };
}

export function createContextBuilderFromSnapshot(
  this: AgentRuntimeInternal,
  snapshot: ContextSourceSnapshot,
  memoryBooks?: readonly NekoMemoryBook[],
  options: { model?: Model; persistEnvInfo?: boolean } = {},
): ContextBuilder {
  // cwd 与 shell 用 runtime 当前值：环境块已进 system prompt，工作区或 Bash 运行时切换后
  // 不能继续展示会话起点的旧路径/旧 shell。
  const envInfo = {
    ...snapshot.envInfo,
    cwd: this.workingDirectory,
    ...(this.config.bashShellSelection?.display.name
      ? { shell: this.config.bashShellSelection.display.name }
      : {}),
  };
  // 同步 preview / config-only fallback 会构造 unknown envInfo。
  // 这类临时值不能写回 config，否则首轮真实 context source 会把它当作显式 envInfo，
  // 从而跳过 Node env/git 探测。
  if (options.persistEnvInfo !== false) {
    // 执行模型属于 model step，不写回可复用的 Context Source。
    this.config.envInfo = envInfo;
  }
  if (this.config.subagentContext) {
    return createSubagentContextBuilder({
      agentPrompt: this.config.subagentContext.agentPrompt,
      currentDate: snapshot.currentDate,
      envInfo,
      model: options.model,
      skillMetadataBudget: this.config.skillMetadataBudget,
      skills: this.skillLoadOutcome,
      userInstructions: this.config.subagentContext.userInstructions,
    });
  }

  const turnTools = this.getTools(options.model);
  const agentListing = turnTools.some((tool) => tool.name === "Agent")
    ? [
        "Available agent types for the Agent tool:",
        ...this.getAgentDefinitions().activeAgents.map((profile) =>
          formatAgentProfileForPrompt(profile, {
            embeddedSearchEnabled: resolveRuntimeEmbeddedSearchEnabled(this),
          }),
        ),
      ].join("\n")
    : undefined;

  const contextConfig: ContextBuilderConfig = {
    workingDirectory: snapshot.workingDirectory,
    additionalDirectories: this.config.additionalDirectories,
    envInfo,
    model: options.model,
    ...(options.model
      ? { midConversationSystem: shouldUseMidConversationSystem(this.config, options.model) }
      : {}),
    presentationSurface: this.config.presentationSurface,
    genUiOutputDirectory: resolveGenUiOutputDirectory(this),
    currentDate: snapshot.currentDate,
    userInstructions: snapshot.userInstructions,
    projectContext: snapshot.projectContext,
    memoryBooks,
    skills: this.skillLoadOutcome,
    agentProfiles: this.config.subagents?.profiles,
    agentListing,
    embeddedSearchEnabled: resolveRuntimeEmbeddedSearchEnabled(this),
    skillMetadataBudget: this.config.skillMetadataBudget,
    customSystemPrompt: this.config.systemPrompt,
    workflowActor: this.config.workflowActor,
    language: this.config.language,
    outputStyle: this.config.outputStyle,
    compact: this.config.compact,
    guidanceToolNames: turnTools.map((tool) => tool.name),
  };

  return createContextBuilder(contextConfig).setToolRegistry(this.registry);
}

export async function discoverSkillsForContext(
  this: AgentRuntimeInternal,
  traceContext: TraceContext,
): Promise<SkillLoadOutcome | undefined> {
  if (!this.skillPort) {
    return undefined;
  }

  try {
    const outcome = await this.skillPort.discoverSkills({
      workingDirectory: this.workingDirectory,
      trace: traceContext,
    });
    this.logger?.debug("Skills discovered", {
      ...traceContextToLogContext(traceContext),
      diagnosticCount: outcome.diagnostics.length,
      module: "core.runtime",
      skillCount: outcome.skills.length,
      totalDiscovered: outcome.totalDiscovered,
    });
    return outcome;
  } catch (error) {
    this.logger?.warn("Skill discovery failed", {
      ...traceContextToLogContext(traceContext),
      error: error instanceof Error ? error.message : String(error),
      module: "core.runtime",
    });
    return {
      skills: [],
      diagnostics: [
        {
          code: "skill_scan_failed",
          severity: "warning",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
      totalDiscovered: 0,
    };
  }
}

export function createConfigOnlyContextSnapshot(
  this: AgentRuntimeInternal,
  workingDirectory: string,
): ContextSourceSnapshot {
  return {
    workingDirectory,
    envInfo: this.config.envInfo ?? {
      cwd: workingDirectory,
      platform: "unknown",
      shell: "unknown",
      osVersion: "unknown",
      nodeVersion: "unknown",
    },
    currentDate: this.config.currentDate,
    projectContext: this.config.projectContext,
    diagnostics: [],
  };
}

export function initializeMessageHistoryFromContext(
  this: AgentRuntimeInternal,
  contextBuilder: ContextBuilder,
  traceContext: TraceContext,
): void {
  const contextResult = contextBuilder.build();
  this.latestContextBuildResult = contextResult;
  this.messageHistory.init(buildContextHistoryEntries(contextResult));

  this.logger?.debug("Context built", {
    ...traceContextToLogContext(traceContext),
    event: "context.built",
    module: "core.runtime",
    sectionCount: contextResult.sections.length,
    status: "completed",
    tokenMethod: "estimated",
    tokenizer: "zcode.estimateTokens.v1",
    totalChars: contextResult.totalChars,
    totalTokens: contextResult.totalTokens,
    sections: contextResult.sections.map((s) => ({
      name: s.name,
      source: s.source,
      chars: s.chars,
      tokens: s.tokens,
      tokenMethod: "estimated",
      confidence: "medium",
      tokenizer: "zcode.estimateTokens.v1",
      preview: s.preview,
      content: s.content,
    })),
  });
}

export function extractToolCallsFromResult(
  this: AgentRuntimeInternal,
  result: any,
): ModelToolCall[] {
  const toolCalls: ModelToolCall[] = [];

  // Try different result formats
  const responses = result.responses ?? result.finishReasons ?? [];

  for (const response of responses) {
    if (response.toolCalls && Array.isArray(response.toolCalls)) {
      for (const tc of response.toolCalls) {
        toolCalls.push({
          id: tc.id,
          name: tc.name ?? tc.toolName,
          input: tc.input,
          providerExecuted: tc.providerExecuted,
        });
      }
    }
  }

  // Also check for flat tool_calls array
  if (result.toolCalls && Array.isArray(result.toolCalls)) {
    for (const tc of result.toolCalls) {
      if (!toolCalls.find((c) => c.id === tc.id)) {
        toolCalls.push({
          id: tc.id,
          name: tc.name ?? tc.toolName,
          input: tc.input,
          providerExecuted: tc.providerExecuted,
        });
      }
    }
  }

  return toolCalls;
}

export function shouldStreamModelText(this: AgentRuntimeInternal): boolean {
  return this.config.modelStreaming === "on";
}
