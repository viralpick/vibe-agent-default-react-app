import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 앱빌더 온톨로지 게이트는 git status 로 "에이전트가 쓴 파일" 을 가려 낸다. src/ 아래에서 무시되는 파일은
// Vite 가 번들해도 검사를 빠져나가므로, .gitignore 가 src/ 를 건드리지 않는지 고정한다 (AOS-4902).

const ROOT = path.resolve(__dirname, "..");

const isIgnored = (relative: string): boolean => {
  try {
    // --no-index: 파일이 없어도 이름만으로 판정한다. 무시되면 exit 0, 아니면 exit 1.
    execFileSync("git", ["check-ignore", "--no-index", "-q", relative], { cwd: ROOT });
    return true;
  } catch {
    return false;
  }
};

describe(".gitignore", () => {
  it.each([
    "src/App.tsx",
    "src/modules/dist/x.ts",
    "src/modules/dist-ssr/x.ts",
    "src/modules/node_modules/x.ts",
    "src/logs/x.ts",
    "src/.claude/x.ts",
    "src/.idea/x.ts",
    "src/.vscode/x.ts",
    "src/modules/.kiro/x.tsx",
    "src/modules/x.local",
    "src/modules/x.log",
  ])("src 아래 %s 는 무시하지 않는다", (relative) => {
    expect(isIgnored(relative)).toBe(false);
  });

  it.each(["dist/index.js", "node_modules/x/index.js", "logs/a.txt", ".claude/x", "debug.log", ".env.local"])(
    "루트의 %s 는 그대로 무시한다",
    (relative) => {
      expect(isIgnored(relative)).toBe(true);
    },
  );
});
