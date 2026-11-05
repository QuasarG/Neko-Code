import {
  NEKODE_AGENT_PROVIDER,
  NEKODE_COMMAND_AGENT_SOURCES,
  type NekodeProvider,
  type CommandAgentSource,
} from "@zcode/shared";

export const COMMAND_AGENT_SOURCES = [
  ...NEKODE_COMMAND_AGENT_SOURCES,
] as const satisfies readonly CommandAgentSource[];

export const COMMAND_AGENT_SOURCE_META: Record<
  CommandAgentSource,
  {
    labelId: string;
    provider: NekodeProvider;
    pathHint: string;
  }
> = {
  zcodeAgent: {
    labelId: "settings.commands.source.zcodeAgent",
    pathHint: "~/.nekode/commands",
    provider: NEKODE_AGENT_PROVIDER,
  },
};
