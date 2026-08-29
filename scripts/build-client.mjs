// dsh-team-ai 客户端 bundle 构建脚本。
//
// 产出 lib/client.js —— DSH Web 客户端插件注册脚本：
//   window.__ModuleLoader__.load({ id: "dsh-team-ai", factory: (require) => { CJS… } })
// 步骤：esbuild 把 src/client.tsx 打成裸 CJS（react/jsx-runtime 保持 external），
// 再拼装注册外壳。watch 模式下重写 lib/client.js，由 dsh-client-hmr 热换 fiber。
import { build, context } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const watch = args.includes("--watch");
const checkOnly = args.includes("--check");

/** 产物仅依赖 shell seed 模块（react），其余全部打进包内。 */
const options = {
  entryPoints: [resolve(root, "src/client.tsx")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  jsx: "automatic",
  outfile: resolve(root, ".build/client.raw.js"),
  external: ["react", "react/jsx-runtime"],
  logLevel: "info",
};

/** 注册外壳：与官方 client bundle 同构（id = 包名）。 */
function wrap(raw) {
  return `window.__ModuleLoader__.load({
	id: "dsh-team-ai",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${raw}
		return module.exports;
	}
});
`;
}

async function buildOnce() {
  await build(options);
  const raw = readFileSync(options.outfile, "utf8");
  const out = wrap(raw);
  const dest = resolve(root, "lib/client.js");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, out, "utf8");
  console.log(`lib/client.js 已构建（${out.length} 字节）`);
}

if (checkOnly) {
  await build({ ...options, write: false });
  console.log("client 源码构建检查通过");
} else if (watch) {
  const watchCtx = await context(options);
  await watchCtx.watch();
  console.log("watch 模式：修改 src/client.tsx 自动重建 lib/client.js（HMR 热换，无需重启 DSH）");
} else {
  await buildOnce();
}
