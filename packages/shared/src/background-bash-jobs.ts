import {
  collectVisibleNekodeBackgroundTaskControlItems,
  getNekodeBackgroundTaskControlItemElapsedMs,
  isActiveNekodeBackgroundTaskControlItem,
  parseNekodeBackgroundTaskControlItems,
  type NekodeBackgroundTaskControlItem,
  type NekodeBackgroundTaskControlStatus,
} from "./background-task-controls.js";

export type NekodeBackgroundBashJobStatus = NekodeBackgroundTaskControlStatus;
export type NekodeBackgroundBashJob = NekodeBackgroundTaskControlItem & {
  taskKind: "bash";
};

export function parseNekodeBackgroundBashJobs(value: unknown): NekodeBackgroundBashJob[] {
  return parseNekodeBackgroundTaskControlItems(value).filter(isBackgroundBashJob);
}

export function isActiveNekodeBackgroundBashJob(job: NekodeBackgroundBashJob): boolean {
  return isActiveNekodeBackgroundTaskControlItem(job);
}

export function getNekodeBackgroundBashJobElapsedMs(
  job: NekodeBackgroundBashJob,
  now = Date.now(),
): number {
  return getNekodeBackgroundTaskControlItemElapsedMs(job, now);
}

export function collectVisibleNekodeBackgroundBashJobs(
  jobs: readonly NekodeBackgroundBashJob[],
  now = Date.now(),
  thresholdMs = 30_000,
): Array<NekodeBackgroundBashJob & { elapsedMs: number }> {
  return collectVisibleNekodeBackgroundTaskControlItems(jobs, now, thresholdMs) as Array<
    NekodeBackgroundBashJob & { elapsedMs: number }
  >;
}

function isBackgroundBashJob(job: NekodeBackgroundTaskControlItem): job is NekodeBackgroundBashJob {
  return job.taskKind === "bash";
}
