import { join } from "node:path";
import { resolveNekodeCliRoot } from "@zcode/shared/node";

export function getDefaultSessionDbPath(): string {
  return join(resolveNekodeCliRoot(), "cli", "db", "db.sqlite");
}
