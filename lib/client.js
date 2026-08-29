window.__ModuleLoader__.load({
	id: "dsh-team-ai",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function createKanbanSource() {
  let snapshot = null;
  const listeners = /* @__PURE__ */ new Set();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const load = () => {
    fetch("/team-ai/kanban.json", { cache: "no-store" }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") || "";
      if (!type.includes("application/json")) {
        throw new Error(
          "\u8DEF\u7531\u672A\u8FD4\u56DE JSON\uFF08\u670D\u52A1\u5668\u53EF\u80FD\u672A\u91CD\u542F/\u63D2\u4EF6\u672A\u52A0\u8F7D\u65B0\u4EE3\u7801\uFF0C\u6216\u770B\u677F\u8DEF\u7531\u672A\u6CE8\u518C\uFF09"
        );
      }
      return res.json();
    }).then((data) => {
      snapshot = data;
      emit();
    }).catch((error) => {
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
    load
  };
}
var triggerStyle = {
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
  overflow: "hidden"
};
var layerStyle = {
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
  zIndex: 1e3,
  fontFamily: "system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontSize: 13,
  color: "var(--dsw-alias-label-primary, #1f2328)"
};
var colStyle = (accent) => ({
  border: "1px solid var(--dsw-alias-border-l1, #d8dee4)",
  borderTop: `3px solid ${accent}`,
  borderRadius: 8,
  padding: 8,
  minWidth: 0
});
var cardStyle = (status) => {
  const accent = status === "done" ? "var(--dsw-alias-success-fg, #1a7f37)" : status === "blocked" ? "var(--dsw-alias-danger-fg, #cf222e)" : status === "working" ? "var(--dsw-alias-accent-fg, #0969da)" : "var(--dsw-alias-border-l2, #d0d7de)";
  return {
    border: "1px solid var(--dsw-alias-border-l1, #d8dee4)",
    borderLeft: `4px solid ${accent}`,
    borderRadius: 6,
    padding: "6px 8px",
    marginBottom: 6,
    background: "var(--dsw-surface-base, #fff)",
    opacity: status === "done" ? 0.8 : 1
  };
};
function KanbanBoard({
  source
}) {
  const snapshot = (0, import_react.useSyncExternalStore)(source.subscribe, source.getSnapshot);
  if (snapshot === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: 12 }, children: "\u770B\u677F\u52A0\u8F7D\u4E2D\u2026" });
  }
  if ("error" in snapshot) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 12, color: "var(--dsw-alias-danger-fg, #cf222e)" }, children: [
      "\u770B\u677F\u8BFB\u53D6\u5931\u8D25\uFF1A",
      snapshot.error,
      "\uFF08\u8BF7\u786E\u8BA4\u63D2\u4EF6\u5DF2\u914D\u7F6E kanbanRepo \u6216 KANBAN_REPO\uFF09",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => source.load(), style: { marginLeft: 8 }, children: "\u91CD\u8BD5" })
    ] });
  }
  const state = snapshot;
  const cur = state.currentTask;
  const roles = Object.entries(state.roles);
  const group = (pred) => roles.filter(([, entry]) => pred(entry.status));
  const renderCol = (title, accent, items) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: colStyle(accent), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600, marginBottom: 6 }, children: title }),
    items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "var(--dsw-alias-label-tertiary, #8c959f)" }, children: "\u2014" }),
    items.map(([role, entry]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: cardStyle(entry.status), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600 }, children: role }),
      entry.task && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { color: "var(--dsw-alias-accent-fg, #0969da)" }, children: [
        "@",
        entry.task
      ] }),
      entry.activity && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "var(--dsw-alias-label-secondary, #57606a)" }, children: entry.activity })
    ] }, role))
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 700, fontSize: 15, marginBottom: 4 }, children: "AI \u56E2\u961F\u770B\u677F" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { color: "var(--dsw-alias-label-secondary, #57606a)", marginBottom: 10 }, children: [
      "\u5F53\u524D\u4EFB\u52A1\uFF1A",
      cur ? `${cur.slug}\uFF08${cur.title || "\u65E0\u6807\u9898"}\uFF09\xB7 \u7B2C ${cur.round} \u8F6E \xB7 ${cur.phase || "\u65E0\u9636\u6BB5"}` : "\uFF08\u65E0\uFF09",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { marginLeft: 8, opacity: 0.7 }, children: state.updatedAt })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          alignItems: "start"
        },
        children: [
          renderCol(
            "\u8FDB\u884C\u4E2D / \u53D7\u963B",
            "var(--dsw-alias-accent-fg, #0969da)",
            group((s) => s === "working" || s === "blocked")
          ),
          renderCol("\u5DF2\u5B8C\u6210", "var(--dsw-alias-success-fg, #1a7f37)", group((s) => s === "done")),
          renderCol("\u5F85\u547D", "var(--dsw-alias-border-l2, #d0d7de)", group((s) => s === "idle"))
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: () => source.load(), children: "\u5237\u65B0" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "a",
            {
              href: "/team-ai/kanban.html",
              target: "_blank",
              rel: "noreferrer",
              style: { color: "var(--dsw-alias-accent-fg, #0969da)" },
              children: "\u6253\u5F00\u5B8C\u6574\u770B\u677F \u2197"
            }
          )
        ]
      }
    )
  ] });
}
function KanbanFooterAction({
  wide,
  source
}) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const snapshot = (0, import_react.useSyncExternalStore)(source.subscribe, source.getSnapshot);
  const repoName = snapshot !== null && !("error" in snapshot) ? snapshot.repoName : null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { position: "relative" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type: "button",
        title: "\u56E2\u961F\u770B\u677F",
        onClick: () => setOpen((v) => !v),
        style: { ...triggerStyle, ...open ? { color: "var(--dsw-alias-accent-fg, #0969da)" } : {} },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: "none" }, children: "\u{1F4CB}" }),
          !wide && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis" }, children: repoName ? `\u56E2\u961F\u770B\u677F \xB7 ${repoName}` : "\u56E2\u961F\u770B\u677F" })
        ]
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: layerStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KanbanBoard, { source }) })
  ] });
}
var inject = ["slots"];
function apply(ctx) {
  const source = createKanbanSource();
  source.load();
  ctx.effect(() => {
    const dispose = ctx.slots.inject(
      "sidebar.footer.action",
      () => ctx.slots.register(
        {
          name: "sidebar.footer.action",
          id: "team-ai-kanban",
          order: 30,
          inject: () => ({ source })
        },
        KanbanFooterAction
      )
    );
    const onReset = () => source.load();
    ctx.on("connection/reset", onReset);
    return () => {
      if (typeof dispose === "function") dispose();
      ctx.off("connection/reset", onReset);
    };
  }, "team-ai: kanban footer action");
}

		return module.exports;
	}
});
