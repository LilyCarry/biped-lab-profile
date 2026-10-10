#!/usr/bin/env bash
# 恢复站点：仓库转公开 -> 启用 Pages 工作流 -> revert 维护页 commit -> 等三个源恢复
# 用法: ./resume-site.sh
# 需要: GITHUB_TOKEN 环境变量（或 ~/.biped_site_token 文件），PAT 需 admin 权限
set -euo pipefail

REPO_OWNER="LilyCarry"
REPO_NAME="biped-lab-profile"
MARKER="MAINTENANCE_MODE_MARK_2026"
LIVE_MARK="node-switcher"   # 正式页面里独有的标记
URLS=(
  "https://lilycarry.github.io/biped-lab-profile/"
  "https://bi-lab-pro.netlify.app/"
  "https://biped-lab-profile.pages.dev/"
)

if [ -z "${GITHUB_TOKEN:-}" ]; then
  if [ -f "$HOME/.biped_site_token" ]; then
    GITHUB_TOKEN="$(cat "$HOME/.biped_site_token" | tr -d '[:space:]')"
  else
    echo "错误: 未找到 GITHUB_TOKEN。请 export GITHUB_TOKEN=xxx 或写入 ~/.biped_site_token" >&2
    exit 1
  fi
fi

api() {
  local m="$1" p="$2" d="${3:-}"
  if [ -n "$d" ]; then
    curl -sS -X "$m" "https://api.github.com$p" \
      -H "Authorization: Bearer $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json" -d "$d"
  else
    curl -sS -X "$m" "https://api.github.com$p" \
      -H "Authorization: Bearer $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json"
  fi
}

echo "==> 1/5 仓库转公开"
api PATCH "/repos/$REPO_OWNER/$REPO_NAME" '{"private": false}' \
  | grep -o '"private": *[a-z]*' | head -1

echo "==> 2/5 重新启用 GitHub Pages 工作流"
api PUT "/repos/$REPO_OWNER/$REPO_NAME/actions/workflows/pages.yml/enable" >/dev/null \
  || echo "    启用失败（可忽略，后面 push 也会触发）"

echo "==> 3/5 revert 维护页 commit"
PAUSE_SHA=""
if [ -f .pause-state ]; then
  PAUSE_SHA="$(tr -d '[:space:]' < .pause-state)"
fi
if [ -z "$PAUSE_SHA" ]; then
  PAUSE_SHA="$(git log --grep='pause site (maintenance page' -n1 --format=%H || true)"
fi
if [ -z "$PAUSE_SHA" ]; then
  echo "    找不到暂停 commit，改用 git revert HEAD" >&2
  git revert --no-edit HEAD
else
  echo "    撤销: $PAUSE_SHA"
  git revert --no-edit "$PAUSE_SHA"
fi
git push origin "HEAD:main"
rm -f .pause-state

echo "==> 4/5 等待三个源恢复正式页面（最多 6 分钟）"
for u in "${URLS[@]}"; do
  ok=0
  for i in $(seq 1 36); do
    body="$(curl -sS --max-time 20 "$u" || true)"
    if echo "$body" | grep -q "$LIVE_MARK" && ! echo "$body" | grep -q "$MARKER"; then ok=1; break; fi
    sleep 10
  done
  if [ "$ok" = 1 ]; then echo "    ✓ $u"; else echo "    ✗ $u 超时未恢复"; fi
done

echo "==> 5/5 检查 GitHub Pages 状态"
api GET "/repos/$REPO_OWNER/$REPO_NAME/pages" \
  | C:/Users/xu762/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe -c "
import sys,json
try:
    d=json.load(sys.stdin)
except Exception:
    print('    无法解析 Pages 状态'); raise SystemExit
if 'message' in d:
    print('    Pages 未启用或报错:', d['message'])
else:
    print('    url:', d.get('html_url'), '| status:', d.get('status'))
    print('    build_type:', d.get('build_type'))
" 2>/dev/null || echo "    (状态查询跳过)"

cat <<'TIP'

==> 完成。如果 GitHub Pages 仍 404：
    去仓库 Settings -> Pages，把 Source 重新选为 "GitHub Actions"
    （私有<->公开来回切换后，GitHub 有时会重置这个配置）
    选好后可在 Actions 页手动 Run workflow 触发一次 pages.yml。
TIP
