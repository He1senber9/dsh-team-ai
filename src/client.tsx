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
}

type KanbanSnapshot = KanbanState | { error: string } | null;

// ===== 数据源（observable，useSyncExternalStore 消费） =====
interface KanbanSource {
  subscribe(listener: () => void): () => void;
  getSnapshot(): KanbanSnapshot;
  load(): void;
}

function createKanbanSource(): KanbanSource {
  let snapshot: KanbanSnapshot = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const load = () => {
    fetch("/team-ai/kanban.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
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
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>AI 团队看板</div>
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
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        title="团队看板"
        onClick={() => setOpen((v) => !v)}
        style={{ ...triggerStyle, ...(open ? { color: "var(--dsw-alias-accent-fg, #0969da)" } : {}) }}
      >
        <span style={{ flex: "none" }}>📋</span>
        {!wide && <span>团队看板</span>}
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
/** apply 需要的 cordis 服务：slots（运行时提供，list 槽注册）。 */
export const inject = ["slots"];

/**
 * 插件主体：注册 sidebar.footer.action 条目（触发器 + 浮动面板）。
 * @param ctx - 浏览器端 cordis 上下文
 */
export function apply(ctx: {
  slots: {
    inject(hole: string, factory: () => unknown): unknown;
    register(descriptor: unknown, component: unknown): unknown;
  };
  on(event: string, listener: () => void): unknown;
  off(event: string, listener: () => void): unknown;
  effect(fn: () => unknown, label?: string): unknown;
}): void {
  const source = createKanbanSource();
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
    return () => {
      if (typeof dispose === "function") dispose();
      ctx.off("connection/reset", onReset);
    };
  }, "team-ai: kanban footer action");
}
