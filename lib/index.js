// dsh-team-ai: AI 开发团队插件。
//
// 1. 注册 skills provider：把本包 skills/ 目录下的角色 skill 注册进 ctx.skills，
//    作为独立 provider（includeDefaultRoots: false），只暴露本插件的 skills。
// 2. 注册团队看板 HTTP 路由（供 Web GUI 面板消费）：
//    - GET /team-ai/kanban.json  → 看板状态 JSON（docs/team/kanban.json）
//    - GET /team-ai/kanban.html  → 自包含 HTML 看板（浏览器新标签页打开）
// webServer 为可选服务（headless 下不存在），用 ctx.get 探测，不影响 skills 注册。
// 复用官方 FileSystemSkillProvider；路径用 import.meta.url 解析，无硬编码。
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FileSystemSkillProvider } from "@deepseek-ai/dsh-skill-filesystem";
import z from "@deepseek-ai/schemastery";
import { loadState, renderHtml, stateFile } from "../bin/kanban.mjs";

/** 插件标识：patch 中的 entry id 与 log 前缀。 */
const name = "team-ai";

/** 注入依赖：skills 注册表（webServer 为可选，见 apply）。 */
const inject = ["skills"];

/**
 * Config schema：
 * - kanbanRepo（可选）：看板状态文件所在仓库的绝对路径（<repo>/docs/team/kanban.json）。
 *   缺省回落 KANBAN_REPO 环境变量；两者都未设置时看板路由返回 404 与提示。
 */
const Config = z.object({
  kanbanRepo: z.string().description(
    "团队看板状态文件所在仓库的绝对路径（<repo>/docs/team/kanban.json）；缺省回落 KANBAN_REPO 环境变量",
  ),
});

/** 本包 skills/ 目录（运行时可解析）。 */
const skillsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../skills");

/** 解析看板仓库路径：?repo 查询参数 > config.kanbanRepo > KANBAN_REPO 环境变量 > 未配置。 */
function resolveKanbanRepo(config, repoParam) {
  const repo = repoParam || config?.kanbanRepo || process.env.KANBAN_REPO;
  return repo ? resolve(repo) : null;
}

/** 看板 JSON 路由 handler（node http server (req, res)）。 */
function handleKanbanJson(config) {
  return (req, res) => {
    const respond = (status, body) => {
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      respond(405, JSON.stringify({ error: "method not allowed" }));
      return;
    }
    // 跟随当前工作区：客户端传 ?repo=<当前工作区路径>；缺省回落配置
    const repoParam = new URL(req.url ?? "/", "http://x").searchParams.get("repo");
    const repo = resolveKanbanRepo(config, repoParam);
    if (!repo) {
      respond(
        404,
        JSON.stringify({ error: "未配置 kanbanRepo：请在插件设置中填写仓库路径，或设置 KANBAN_REPO 环境变量" }),
      );
      return;
    }
    try {
      const file = stateFile(repo);
      const state = loadState(file);
      // 附上项目名（看板仓库的目录名），供面板在按钮上标识"哪个项目的看板"
      const repoName = basename(repo);
      respond(200, JSON.stringify({ ...state, repoName }, null, 2));
    } catch (error) {
      respond(500, JSON.stringify({ error: `读取看板状态失败：${error.message}` }));
    }
  };
}

/** 看板 HTML 路由 handler（浏览器新标签页打开完整看板）。 */
function handleKanbanHtml(config) {
  return (req, res) => {
    const respond = (status, body) => {
      res.writeHead(status, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      respond(405, "method not allowed");
      return;
    }
    // 跟随当前工作区：客户端传 ?repo=<当前工作区路径>；缺省回落配置
    const repoParam = new URL(req.url ?? "/", "http://x").searchParams.get("repo");
    const repo = resolveKanbanRepo(config, repoParam);
    if (!repo) {
      respond(404, "<h3>未配置 kanbanRepo：请在插件设置中填写仓库路径，或设置 KANBAN_REPO 环境变量</h3>");
      return;
    }
    try {
      const file = stateFile(repo);
      const state = loadState(file);
      respond(200, renderHtml(state));
    } catch (error) {
      respond(500, `<h3>读取看板状态失败：${escapeHtml(error.message)}</h3>`);
    }
  };
}

/** HTML 转义（错误信息进页面时防止注入）。 */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * 注册看板路由到 webServer（exact 路由优先于 SPA fallback，随时注册都会生效）。
 * @returns 卸载函数
 */
function registerKanbanRoutes(webServer, config) {
  const disposers = [
    webServer.register({
      kind: "exact",
      path: "/team-ai/kanban.json",
      handler: handleKanbanJson(config),
    }),
    webServer.register({
      kind: "exact",
      path: "/team-ai/kanban.html",
      handler: handleKanbanHtml(config),
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}

/**
 * 等 webServer 可用后注册看板路由（兼容激活时序）。
 * 官方 client-modules 用必选 inject 规避时序，但本插件要在 headless 下保持可用，
 * 因此采用：非 strict get 先行 + internal/service 事件兜底（服务提供时补注册）。
 */
function registerKanbanRoutesWhenReady(ctx, config) {
  const tryRegister = (webServer) => {
    if (!webServer) return false;
    ctx.effect(() => registerKanbanRoutes(webServer, config), "team-ai: kanban routes");
    ctx.logger?.info?.("dsh-team-ai: 看板路由已注册（/team-ai/kanban.json, /team-ai/kanban.html）");
    return true;
  };
  if (tryRegister(ctx.get("webServer", false))) return;
  const listener = (serviceName, value) => {
    if (serviceName !== "webServer") return;
    ctx.off("internal/service", listener);
    if (!tryRegister(value)) {
      ctx.on("internal/service", listener); // 仍未就绪则继续等
    }
  };
  ctx.on("internal/service", listener);
  ctx.logger?.info?.("dsh-team-ai: webServer 未就绪，等待 internal/service 事件后注册看板路由");
}

/**
 * 插件主体：注册 skills provider；web 模式下追加看板路由。
 * @param ctx - cordis 上下文（含 skills 注册表；webServer 可选）
 * @param config - 插件配置（kanbanRepo 可选）
 */
function apply(ctx, config = {}) {
  ctx.skills.registerProvider((control) => {
    return new FileSystemSkillProvider(ctx, control, {
      providerName: "team-ai",
      includeDefaultRoots: false,
      customSkillDirs: [skillsDir],
    });
  });
  registerKanbanRoutesWhenReady(ctx, config);
  ctx.logger?.info?.(`dsh-team-ai: skills provider 已注册（${skillsDir}）`);
}

export { Config, apply, inject, name };
