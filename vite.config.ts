import { defineConfig, type Connect, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// OpenSandbox server proxy 호환용 dev 플러그인.
//
// OpenSandbox 는 sandbox 포트를 path-based 프록시 `/sandboxes/{id}/proxy/{port}/...` 로
// 노출하며, 백엔드(vite)로 넘길 때 이 prefix 를 떼고 루트(`/...`)로 요청한다. 이때 vite 를
// `--base {prefix}` 로 띄우면 base 밖(`/`) 요청에 base 로 가는 302 redirect 를 응답하고,
// 프록시가 그 302 를 그대로 전달 → 브라우저가 다시 prefix 로 요청 → 프록시가 또 prefix 를
// 떼고 `/` 로 넘김 → 무한 302 루프(ERR_TOO_MANY_REDIRECTS).
//
// 이 플러그인은 vite 의 base-redirect 미들웨어보다 먼저(stack.unshift) 끼어들어, prefix 가
// 빠진 요청에 prefix 를 다시 붙여 rewrite 한다 → 302 대신 200. HTML 의 asset 경로는 base
// prefix 를 유지하므로 브라우저 → 프록시 라우팅도 정상.
//
// base 가 "/" (직접 접근 / e2b 서브도메인 환경)이면 prefix 가 빈 문자열이라 완전 no-op.
// 즉 base 를 `--base` 로 주지 않는 e2b 경로에서는 이 플러그인이 실행조차 되지 않는다.
const stripBaseRedirect = (): PluginOption => ({
  name: "strip-base-redirect",
  configureServer(server) {
    const prefix = (server.config.base || "/").replace(/\/$/, "");
    server.middlewares.stack.unshift({
      route: "",
      handle: ((req, _res, next) => {
        if (prefix && req.url && !req.url.startsWith(prefix + "/") && req.url !== prefix) {
          req.url = prefix + (req.url.startsWith("/") ? req.url : "/" + req.url);
        }
        next();
      }) as Connect.NextHandleFunction,
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [stripBaseRedirect(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 앱 생성(generate_app) 시점에 에이전트가 차트/테이블/마크다운 등을 새로 import 하면,
  // dev server 기동 시엔 빈 App.tsx 라 pre-bundle 되지 않았던 의존성이 런타임에 처음
  // 발견되어 Vite 가 esbuild optimize 를 재실행하고 full page reload 를 강제한다
  // ("optimized dependencies changed. reloading"). 이 reload 가 끝나기 전 iframe 이
  // 로드되면 빈 화면이 되고, 수동 새로고침해야 보이는 증상이 발생한다.
  // 무거운/전이의존 많은 런타임 deps 를 미리 선언해 기동 시 한 번에 pre-bundle → 이후
  // import 해도 재최적화/reload 없이 HMR 로 즉시 반영되게 한다.
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "echarts",
      "recharts",
      "@tanstack/react-table",
      "react-markdown",
      "remark-gfm",
      "date-fns",
      "date-fns-tz",
      "react-day-picker",
      "react-hook-form",
      "@hookform/resolvers",
      "zod",
      "axios",
      "lucide-react",
      "clsx",
      "class-variance-authority",
      "tailwind-merge",
      "cmdk",
      "sonner",
      "next-themes",
      "modern-screenshot",
      "react-kakao-maps-sdk",
    ],
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
});
