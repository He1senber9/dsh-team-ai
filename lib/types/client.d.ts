/**
 * dsh-team-ai 客户端插件类型面（浏览器端）。
 * 与官方 client 插件一致：导出 { apply, inject }，由浏览器端 vendored cordis loader
 * 作为对象插件消费；entry 名来自 loader entry.options.name（无需导出 name）。
 */
/** apply 依赖的 cordis 服务名列表。 */
export const inject: string[];
/**
 * 插件主体：注册 sidebar.footer.action 条目（团队看板触发器 + 浮动面板）。
 * @param ctx - 浏览器端 cordis 上下文。
 */
export function apply(ctx: unknown): void;
