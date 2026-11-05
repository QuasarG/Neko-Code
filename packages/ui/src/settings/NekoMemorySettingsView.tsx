import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import type { INekoMemoryService, NekoMemoryBookEntry } from "@zcode/services";
import { Alert, AlertDescription } from "@/components/ui/alert.js";
import { Button } from "@/components/ui/button.js";
import { Progress } from "@/components/ui/progress.js";
import { cn } from "@/components/lib/utils.js";
import { useNekoMemoryBooks } from "@/hooks/useNekoMemoryBooks.js";
import { useNekodeIntl } from "@/i18n/IntlProvider.js";

const SCOPE_LABEL_IDS: Record<NekoMemoryBookEntry["scope"], string> = {
  global: "settings.memory.neko.scope.global",
  project: "settings.memory.neko.scope.project",
};

function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
}

type BodyState =
  | { status: "idle" }
  | { status: "loading"; path: string }
  | { status: "ready"; path: string; content: string }
  | { status: "error"; path: string; message: string };

/**
 * Neko 记忆六本书：目录、字节/预算进度与整本正文预览。
 * 只读视图；编辑一律由 agent 的 Edit/Write 完成（预算闸门在 harness）。
 */
export function NekoMemorySettingsView({
  service,
  workspacePath,
  workspaceIdentity,
}: {
  service: INekoMemoryService | undefined;
  workspacePath: string | null;
  workspaceIdentity?: string | null;
}) {
  const { intl, locale } = useNekodeIntl();
  const { snapshot, loading, error, refresh } = useNekoMemoryBooks({
    service,
    workspacePath,
    workspaceIdentity,
    enabled: Boolean(service),
  });
  const books = useMemo(() => snapshot?.books ?? [], [snapshot]);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [bodyState, setBodyState] = useState<BodyState>({ status: "idle" });
  const bodyRequestRef = useRef(0);

  const loadedAt = snapshot?.loadedAt ?? null;

  const loadBook = useCallback(
    async (path: string) => {
      if (!service) return;
      const seq = ++bodyRequestRef.current;
      setBodyState({ status: "loading", path });
      try {
        const body = await service.readBook({ path });
        if (seq !== bodyRequestRef.current) return;
        setBodyState({ status: "ready", path, content: body.content });
      } catch (loadError) {
        if (seq !== bodyRequestRef.current) return;
        setBodyState({
          status: "error",
          path,
          message: loadError instanceof Error ? loadError.message : String(loadError),
        });
      }
    },
    [service],
  );

  // workspace 切换或新快照到达后旧正文作废；展开的书还在就原地重读，不在则收起。
  // expandedPath 刻意不进依赖：展开本身不应触发重置，竞态由请求序号兜底。
  useEffect(() => {
    bodyRequestRef.current += 1;
    setBodyState({ status: "idle" });
    if (expandedPath && books.some((book) => book.path === expandedPath)) {
      void loadBook(expandedPath);
    } else {
      setExpandedPath(null);
    }
  }, [service, workspacePath, workspaceIdentity, loadedAt, books, loadBook]);

  const totalBytes = useMemo(() => books.reduce((total, book) => total + book.bytes, 0), [books]);

  return (
    <section className="space-y-4" data-neko-memory-view="true">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-ui-base font-medium text-foreground">
            {intl.formatMessage({ id: "settings.memory.neko.title" })}
          </h3>
          <p className="mt-1 text-ui-sm leading-5 text-foreground-subtle">
            {intl.formatMessage({ id: "settings.memory.neko.description" })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {books.length > 0 ? (
            <span className="text-ui-sm text-foreground-subtle">
              {intl.formatMessage(
                { id: "settings.memory.neko.summary" },
                { count: books.length, bytes: formatBytes(totalBytes, locale) },
              )}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!service || loading}
            onClick={() => void refresh()}
          >
            {intl.formatMessage({ id: "settings.memory.neko.refresh" })}
          </Button>
        </div>
      </div>

      {!service ? (
        <div className="rounded-xl border border-dashed border-border bg-transparent px-4 py-8 text-center text-ui-base text-foreground-subtle">
          {intl.formatMessage({ id: "settings.memory.neko.unavailable" })}
        </div>
      ) : error ? (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : loading && !snapshot ? (
        <div className="rounded-xl border border-dashed border-border bg-transparent px-4 py-8 text-center text-ui-base text-foreground-subtle">
          {intl.formatMessage({ id: "settings.memory.neko.loading" })}
        </div>
      ) : books.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-transparent px-4 py-8 text-center text-ui-base text-foreground-subtle">
          {intl.formatMessage({ id: "settings.memory.neko.empty" })}
        </div>
      ) : (
        <div className="space-y-2">
          {books.map((book) => {
            const expanded = expandedPath === book.path;
            const percent =
              book.budgetBytes > 0 ? Math.min(100, (book.bytes / book.budgetBytes) * 100) : 0;
            const overBudget = book.bytes > book.budgetBytes;
            return (
              <div
                className="overflow-hidden rounded-xl border border-border bg-surface"
                key={book.path}
              >
                <button
                  aria-expanded={expanded}
                  className="flex w-full min-w-0 items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-hover"
                  onClick={() => {
                    if (expanded) {
                      setExpandedPath(null);
                      return;
                    }
                    setExpandedPath(book.path);
                    void loadBook(book.path);
                  }}
                  type="button"
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-foreground-subtlest">
                    <ChevronRightIcon
                      aria-hidden="true"
                      className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-ui-base font-medium text-foreground">{book.label}</span>
                      <span className="rounded-md bg-background px-1.5 py-0.5 text-ui-xs text-foreground-subtle">
                        {intl.formatMessage({ id: SCOPE_LABEL_IDS[book.scope] })}
                      </span>
                      {overBudget ? (
                        <span className="text-ui-xs text-danger">
                          {intl.formatMessage({ id: "settings.memory.neko.overBudget" })}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="mt-0.5 block truncate text-ui-sm text-foreground-subtle"
                      title={book.path}
                    >
                      {book.relativePath}
                    </span>
                    <span className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                      <Progress
                        aria-label={book.relativePath}
                        className="h-1.5 w-28 shrink-0"
                        indicatorClassName={overBudget ? "bg-danger" : undefined}
                        value={percent}
                      />
                      <span className="tabular-nums text-ui-sm text-foreground-subtle">
                        {formatBytes(book.bytes, locale)} / {formatBytes(book.budgetBytes, locale)}
                      </span>
                    </span>
                  </span>
                </button>
                {expanded ? (
                  <div className="border-t border-border/50 px-4 py-3">
                    <h4 className="text-ui-sm font-medium text-foreground">
                      {intl.formatMessage({ id: "settings.memory.neko.preview" })}
                    </h4>
                    {bodyState.status === "ready" && bodyState.path === book.path ? (
                      bodyState.content.trim() === "" ? (
                        <p className="mt-3 text-ui-sm text-foreground-subtle">
                          {intl.formatMessage({ id: "settings.memory.neko.bodyEmpty" })}
                        </p>
                      ) : (
                        <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words font-mono text-ui-sm text-foreground-subtle">
                          {bodyState.content}
                        </pre>
                      )
                    ) : bodyState.status === "error" && bodyState.path === book.path ? (
                      <p className="mt-3 text-ui-sm text-danger">{bodyState.message}</p>
                    ) : (
                      <p className="mt-3 text-ui-sm text-foreground-subtle">
                        {intl.formatMessage({ id: "settings.memory.neko.previewLoading" })}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
