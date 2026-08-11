#!/usr/bin/env bash
#
# appgen 을 PATH 에 심링크한다.
#
# 심링크를 쓰는 이유: 이 레포를 pull 하면 도구가 자동으로 갱신된다. 복사하면 사본이 낡는다.
#
# SKILL.md 가 있으면 ~/.claude/skills/ 에도 심링크해 Claude Code 가 발견하게 한다.
# 스킬은 워크플로우 지시를 담고, 실행은 이 스크립트가 심링크한 appgen 이 담당한다.

set -euo pipefail

TOOL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${APPGEN_BIN_DIR:-$HOME/.local/bin}"
SKILLS_DIR="${APPGEN_SKILLS_DIR:-$HOME/.claude/skills}"

mkdir -p "$BIN_DIR"
ln -sfn "$TOOL_DIR/appgen.ts" "$BIN_DIR/appgen"
chmod +x "$TOOL_DIR/appgen.ts"
echo "심링크: $BIN_DIR/appgen → $TOOL_DIR/appgen.ts"

if [ -f "$TOOL_DIR/SKILL.md" ]; then
  mkdir -p "$SKILLS_DIR"
  ln -sfn "$TOOL_DIR" "$SKILLS_DIR/agentos-app-local"
  echo "심링크: $SKILLS_DIR/agentos-app-local → $TOOL_DIR"
else
  echo "건너뜀: SKILL.md 가 아직 없어 스킬 심링크는 생략했다."
fi

# node 가 .ts 를 네이티브 실행할 수 있어야 한다 (타입 스트리핑). Node 22.6+ 에서 도입되어
# 23.6+ 부터 플래그 없이 동작한다. 그보다 낮으면 실행 시점에 문법 오류로 실패한다.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo
  echo "경고: node ${NODE_MAJOR} 감지. .ts 네이티브 실행은 Node 24+ 를 권장한다."
  echo "      낮은 버전에서는 'node --experimental-strip-types' 가 필요할 수 있다."
fi

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo
    echo "$BIN_DIR 이 PATH 에 없다. 쉘 설정에 아래를 추가할 것:"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

echo
echo "확인: appgen --help"
