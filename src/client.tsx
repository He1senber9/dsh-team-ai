// dsh-team-ai 客户端插件：Web GUI 侧边栏「团队看板」入口。
//
// 浏览器端 cordis 插件，导出 { apply, inject }（与官方 client 插件一致）。
// 通过 slots.inject("sidebar.footer.action") 在侧边栏底部加一个触发器，
// 点击展开浮动看板面板；数据同源 fetch /team-ai/kanban.json（Node 半区 webServer 路由），
// 5 秒轮询 + 连接重置时刷新。
import { useState, useSyncExternalStore } from "react";

// ===== 数据类型（与 bin/kanban.mjs 的 kanban.json 结构对应） =====
type RoleStatus = "idle" | "working" | "done" | "blocked";

interface KanbanRoleEntry {
  status: RoleStatus;
  task: string | null;
  activity: string;
  since: string;
}

interface KanbanState {
  version: number;
  updatedAt: string;
  currentTask: {
    slug: string;
    title: string;
    round: number;
    phase: string;
  } | null;
  roles: Record<string, KanbanRoleEntry>;
  /** 看板所属项目名（kanbanRepo 目录名），服务端附加 */
  repoName?: string | null;
}

type KanbanSnapshot = KanbanState | { error: string } | null;

// ===== 数据源（observable，useSyncExternalStore 消费） =====
interface KanbanSource {
  subscribe(listener: () => void): () => void;
  getSnapshot(): KanbanSnapshot;
  load(): void;
}

function createKanbanSource(getRepoPath: () => string | undefined): KanbanSource {
  let snapshot: KanbanSnapshot = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const load = () => {
    // 跟随当前工作区：传 ?repo=<当前工作区路径>，切换项目后面板自动跟随
    const repo = getRepoPath();
    const query = repo ? `?repo=${encodeURIComponent(repo)}` : "";
    fetch(`/team-ai/kanban.json${query}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = res.headers.get("content-type") || "";
        if (!type.includes("application/json")) {
          throw new Error(
            "路由未返回 JSON（服务器可能未重启/插件未加载新代码，或看板路由未注册）",
          );
        }
        return res.json();
      })
      .then((data) => {
        snapshot = data as KanbanState;
        emit();
      })
      .catch((error) => {
        snapshot = { error: String(error) };
        emit();
      });
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    load,
  };
}

// ===== 样式（内联，避免 CSS 注入复杂度） =====
const triggerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "6px 10px",
  border: "none",
  background: "transparent",
  color: "var(--dsw-alias-label-secondary, #57606a)",
  cursor: "pointer",
  borderRadius: 8,
  fontSize: 14,
  whiteSpace: "nowrap",
  overflow: "hidden",
};

const layerStyle: React.CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 64,
  width: 440,
  maxWidth: "calc(100vw - 32px)",
  maxHeight: "70vh",
  overflow: "auto",
  background: "var(--dsw-surface-overlay, #fff)",
  border: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
  borderRadius: 12,
  boxShadow: "0 8px 28px rgba(0,0,0,.18)",
  padding: 12,
  zIndex: 1000,
  fontFamily: "system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontSize: 13,
  color: "var(--dsw-alias-label-primary, #1f2328)",
};

const colStyle = (accent: string): React.CSSProperties => ({
  border: "1px solid var(--dsw-alias-border-l1, #d8dee4)",
  borderTop: `3px solid ${accent}`,
  borderRadius: 8,
  padding: 8,
  minWidth: 0,
});

const cardStyle = (status: RoleStatus): React.CSSProperties => {
  const accent =
    status === "done"
      ? "var(--dsw-alias-success-fg, #1a7f37)"
      : status === "blocked"
        ? "var(--dsw-alias-danger-fg, #cf222e)"
        : status === "working"
          ? "var(--dsw-alias-accent-fg, #0969da)"
          : "var(--dsw-alias-border-l2, #d0d7de)";
  return {
    border: "1px solid var(--dsw-alias-border-l1, #d8dee4)",
    borderLeft: `4px solid ${accent}`,
    borderRadius: 6,
    padding: "6px 8px",
    marginBottom: 6,
    background: "var(--dsw-surface-base, #fff)",
    opacity: status === "done" ? 0.8 : 1,
  };
};

// ===== 看板面板 =====
function KanbanBoard({
  source,
}: {
  source: KanbanSource;
}) {
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot);

  if (snapshot === null) {
    return <div style={{ padding: 12 }}>看板加载中…</div>;
  }
  if ("error" in snapshot) {
    return (
      <div style={{ padding: 12, color: "var(--dsw-alias-danger-fg, #cf222e)" }}>
        看板读取失败：{snapshot.error}（请确认插件已配置 kanbanRepo 或 KANBAN_REPO）
        <button onClick={() => source.load()} style={{ marginLeft: 8 }}>
          重试
        </button>
      </div>
    );
  }

  const state = snapshot;
  const cur = state.currentTask;
  const roles = Object.entries(state.roles);
  const group = (pred: (s: RoleStatus) => boolean) =>
    roles.filter(([, entry]) => pred(entry.status));

  const renderCol = (
    title: string,
    accent: string,
    items: [string, KanbanRoleEntry][],
  ) => (
    <div style={colStyle(accent)}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {items.length === 0 && (
        <div style={{ color: "var(--dsw-alias-label-tertiary, #8c959f)" }}>—</div>
      )}
      {items.map(([role, entry]) => (
        <div key={role} style={cardStyle(entry.status)}>
          <div style={{ fontWeight: 600 }}>{role}</div>
          {entry.task && (
            <div style={{ color: "var(--dsw-alias-accent-fg, #0969da)" }}>@{entry.task}</div>
          )}
          {entry.activity && (
            <div style={{ color: "var(--dsw-alias-label-secondary, #57606a)" }}>
              {entry.activity}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
        AI 团队看板{state.repoName ? ` · ${state.repoName}` : ""}
      </div>
      <div style={{ color: "var(--dsw-alias-label-secondary, #57606a)", marginBottom: 10 }}>
        当前任务：
        {cur
          ? `${cur.slug}（${cur.title || "无标题"}）· 第 ${cur.round} 轮 · ${cur.phase || "无阶段"}`
          : "（无）"}
        <span style={{ marginLeft: 8, opacity: 0.7 }}>{state.updatedAt}</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          alignItems: "start",
        }}
      >
        {renderCol(
          "进行中 / 受阻",
          "var(--dsw-alias-accent-fg, #0969da)",
          group((s) => s === "working" || s === "blocked"),
        )}
        {renderCol("已完成", "var(--dsw-alias-success-fg, #1a7f37)", group((s) => s === "done"))}
        {renderCol("待命", "var(--dsw-alias-border-l2, #d0d7de)", group((s) => s === "idle"))}
      </div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button onClick={() => source.load()}>刷新</button>
        <a
          href="/team-ai/kanban.html"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--dsw-alias-accent-fg, #0969da)" }}
        >
          打开完整看板 ↗
        </a>
      </div>
    </div>
  );
}

// ===== 侧边栏底部触发器 + 浮动面板 =====
function KanbanFooterAction({
  wide,
  source,
}: {
  wide: boolean;
  source: KanbanSource;
}) {
  const [open, setOpen] = useState(false);
  // 按钮标签跟随项目名（服务端 repoName），与工作区项目对应
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot);
  const repoName =
    snapshot !== null && !("error" in snapshot) ? snapshot.repoName : null;
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        title={repoName ? `团队看板 · ${repoName}` : "团队看板"}
        onClick={() => setOpen((v) => !v)}
        style={{ ...triggerStyle, ...(open ? { color: "var(--dsw-alias-accent-fg, #0969da)" } : {}) }}
      >
        <span style={{ flex: "none" }}>📋</span>
        {!wide && (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {repoName ? `团队看板 · ${repoName}` : "团队看板"}
          </span>
        )}
      </button>
      {open && (
        <div style={layerStyle}>
          <KanbanBoard source={source} />
        </div>
      )}
    </div>
  );
}

// ===== 插件面 =====
/** apply 需要的 cordis 服务：slots（list 槽注册）+ workspaces + sessions（当前工作区解析）。 */
export const inject = ["slots", "workspaces", "sessions"];

/**
 * 插件主体：注册 sidebar.footer.action 条目（触发器 + 浮动面板）。
 * @param ctx - 浏览器端 cordis 上下文
 */
export function apply(ctx: {
  slots: {
    inject(hole: string, factory: () => unknown): unknown;
    register(descriptor: unknown, component: unknown): unknown;
  };
  get(name: string): unknown;
  on(event: string, listener: () => void): unknown;
  off(event: string, listener: () => void): unknown;
  effect(fn: () => unknown, label?: string): unknown;
}): void {
  // 当前工作区解析优先级：
  //   1) 当前 session 所属的工作区（sessions.list.current → workspace.sessionIds 映射）
  //   2) 最近活跃工作区（workspaces.list.recentWorkspaceId）
  //   3) 服务端配置（kanbanRepo / KANBAN_REPO，无参数时由服务端回落）
  const workspaces = ctx.get("workspaces") as
    | {
        list?: {
          getSnapshot(): {
            items?: { workspaceId: string; path: string; sessionIds?: string[] }[];
            recentWorkspaceId?: string;
          };
          subscribe(listener: () => void): () => void;
        };
      }
    | undefined;
  const sessions = ctx.get("sessions") as
    | {
        list?: {
          getSnapshot(): { current?: string };
          subscribe(listener: () => void): () => void;
        };
      }
    | undefined;
  const getRepoPath = () => {
    const wsState = workspaces?.list?.getSnapshot?.();
    const items = wsState?.items ?? [];
    const sessionId = sessions?.list?.getSnapshot?.().current;
    const bySession = sessionId
      ? items.find((w) => w.sessionIds?.includes(sessionId))
      : undefined;
    const byRecent = items.find((w) => w.workspaceId === wsState?.recentWorkspaceId);
    return (bySession ?? byRecent)?.path;
  };
  const source = createKanbanSource(getRepoPath);
  source.load();
  ctx.effect(() => {
    const dispose = ctx.slots.inject("sidebar.footer.action", () =>
      ctx.slots.register(
        {
          name: "sidebar.footer.action",
          id: "team-ai-kanban",
          order: 30,
          inject: () => ({ source }),
        },
        KanbanFooterAction,
      ),
    );
    const onReset = () => source.load();
    ctx.on("connection/reset", onReset);
    // 切换工作区/当前 session 后重载看板（跟随当前项目）
    const unsubscribeWorkspaces = workspaces?.list?.subscribe?.(() => source.load());
    const unsubscribeSessions = sessions?.list?.subscribe?.(() => source.load());
    return () => {
      if (typeof dispose === "function") dispose();
      if (typeof unsubscribeWorkspaces === "function") unsubscribeWorkspaces();
      if (typeof unsubscribeSessions === "function") unsubscribeSessions();
      ctx.off("connection/reset", onReset);
    };
  }, "team-ai: kanban footer action");
}
