import type { NekodeBackgroundTaskControlItem } from "./background-task-controls.js";

export function mergeNekodeBackgroundTaskControlItems(
  current: readonly NekodeBackgroundTaskControlItem[],
  updates: readonly NekodeBackgroundTaskControlItem[],
): NekodeBackgroundTaskControlItem[] {
  const jobsById = new Map(current.map((job) => [job.jobId, job] as const));
  for (const job of updates) {
    jobsById.set(job.jobId, job);
  }
  return Array.from(jobsById.values());
}
