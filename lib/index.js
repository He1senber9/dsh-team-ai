// dsh-team-ai: AI 开发团队 skill provider。
//
// 在 profile 启动时把本包 skills/ 目录下的角色 skill 注册进 ctx.skills，
// 作为独立 provider（includeDefaultRoots: false），只暴露本插件的 skills。
// 复用官方 FileSystemSkillProvider，路径用 import.meta.url 解析，无硬编码。
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FileSystemSkillProvider } from "@deepseek-ai/dsh-skill-filesystem";
import z from "@deepseek-ai/schemastery";

/** 插件标识：patch 中的 entry id 与 log 前缀。 */
const name = "team-ai";

/** 注入依赖：skills 注册表。 */
const inject = ["skills"];

/** Config schema：目前无配置项；skills 目录固定为本包 skills/。 */
const Config = z.object({});

/** 本包 skills/ 目录（运行时可解析）。 */
const skillsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../skills");

/**
 * 注册团队 skills provider。
 * @param ctx - cordis 上下文（含 skills 注册表）
 * @param config - 插件配置（暂未使用）
 */
function apply(ctx, _config = {}) {
  ctx.skills.registerProvider((control) => {
    return new FileSystemSkillProvider(ctx, control, {
      providerName: "team-ai",
      includeDefaultRoots: false,
      customSkillDirs: [skillsDir],
    });
  });
  ctx.logger?.info?.(`dsh-team-ai: skills provider 已注册（${skillsDir}）`);
}

export { Config, apply, inject, name };
