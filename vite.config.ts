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
// 이 플러그인은 prefix 가 빠진 요청에 prefix 를 다시 붙여 rewrite 한다. 두 경로를 모두 보정:
//
//  1) HTTP 요청: vite 의 base-redirect 미들웨어보다 먼저(stack.unshift) 끼어들어 rewrite
//     → 302 대신 200. HTML 의 asset 경로는 base prefix 를 유지하므로 정적 리소스도 정상.
//
//  2) HMR WebSocket upgrade: vite 의 HMR 서버는 upgrade 요청의 pathname 이 `hmrBase`(= base)
//     와 **정확히 일치**할 때만 처리한다(`ws.ts` 의 hmrServerWsListener). 그런데 프록시가
//     prefix 를 떼고 `/` 로 넘기면 vite 가 받는 pathname 은 `/` 라 hmrBase 와 불일치 →
//     vite 가 무응답 → 프록시 핸드셰이크 timeout → HMR 끊김(미리보기가 새로고침해야만 갱신).
//     HTTP 와 달리 WS upgrade 는 미들웨어 체인을 안 거치므로 (1)의 보정이 닿지 않는다.
//     그래서 httpServer 의 'upgrade' 이벤트에 vite 의 리스너보다 먼저(prependListener)
//     끼어들어 WS req.url 에도 prefix 를 복원한다 → pathname === hmrBase 일치 → HMR 정상.
//
// base 가 "/" (직접 접근 / e2b 서브도메인 환경)이면 prefix 가 빈 문자열이라 완전 no-op.
// 즉 base 를 `--base` 로 주지 않는 e2b 경로에서는 이 플러그인이 실행조차 되지 않는다.
const stripBaseRedirect = (): PluginOption => ({
  name: "strip-base-redirect",
  configureServer(server) {
    const prefix = (server.config.base || "/").replace(/\/$/, "");
    if (!prefix) return;

    const restorePrefix = (url: string): string => {
      if (url.startsWith(prefix + "/") || url === prefix) return url;
      const queryAt = url.indexOf("?");
      const path = queryAt >= 0 ? url.slice(0, queryAt) : url;
      const search = queryAt >= 0 ? url.slice(queryAt) : "";
      return prefix + (path.startsWith("/") ? path : "/" + path) + search;
    };

    // 1) HTTP 요청 보정
    server.middlewares.stack.unshift({
      route: "",
      handle: ((req, _res, next) => {
        if (req.url) req.url = restorePrefix(req.url);
        next();
      }) as Connect.NextHandleFunction,
    });

    // 2) HMR WebSocket upgrade 보정 (vite hmrServerWsListener 보다 먼저 실행돼야 함)
    server.httpServer?.prependListener("upgrade", (req) => {
      if (req.url) req.url = restorePrefix(req.url);
    });
  },
});

// path-based proxy(`--base /sandboxes/{id}/proxy/{port}/`) 뒤에서 실행 중인지 판별.
// stripBaseRedirect 와 동일한 조건(= base 가 "/" 가 아닌 서브패스)으로, CLI 의 `--base`
// 인자를 보고 결정한다. 이 환경에서만 아래 토큰 검사 우회가 의미를 가진다.
const baseArgIndex = process.argv.indexOf("--base");
const baseArg = baseArgIndex >= 0 ? process.argv[baseArgIndex + 1] : undefined;
const isBehindPathProxy = !!baseArg && baseArg !== "/" && baseArg !== "./";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [stripBaseRedirect(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // HMR WebSocket 토큰 검사 우회 — **path-proxy 환경에서만** 조건부로 켠다.
  //
  // Vite 6+ 는 CSWSH 방어로, Origin 헤더가 있는(=브라우저) WS upgrade 에 대해 URL 의
  // `?token=` 을 서버 토큰과 대조한다. OpenSandbox proxy 를 거치면서 이 토큰 검증이
  // 통과되지 못해 HMR 이 끊긴다. 이 sandbox 의 vite 는 외부 비노출(프록시 경유로만 접근)
  // dev 서버이므로 토큰 검사를 끄는 것이 안전하다.
  //
  // 단, e2b 서브도메인/직접 접근(base="/") 에서는 토큰 검사가 정상 동작하므로 끄지 않는다.
  // → 프록시 환경(isBehindPathProxy)일 때만 우회해 보안 영향을 최소화.
  legacy: {
    skipWebSocketTokenCheck: isBehindPathProxy,
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
