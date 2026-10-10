#!/usr/bin/env bash
# 恢复站点：仓库转公开 -> 启用 Pages 工作流 -> 必要时重建 Pages 站点 -> revert 维护页 -> 等各源恢复
# 用法: ./resume-site.sh
# 需要: GITHUB_TOKEN（或 ~/.biped_site_token）
#   PAT 权限: Contents RW + Administration RW（必需）
#             Pages RW    （用于自动重建被重置的 Pages 站点，强烈建议）
#             Actions RW  （用于开关工作流，可选）
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
    GITHUB_TOKEN="$(tr -d '[:space:]' < "$HOME/.biped_site_token")"
  else
    echo "错误: 未找到 GITHUB_TOKEN。请 export GITHUB_TOKEN=xxx 或写入 ~/.biped_site_token" >&2
    exit 1
  fi
fi

api() { # method path [data]
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

warn() { echo "    ⚠ $*"; }

echo "==> 1/6 仓库转公开"
api PATCH "/repos/$REPO_OWNER/$REPO_NAME" '{"private": false}' \
  | grep -o '"private": *[a-z]*' | head -1

echo "==> 2/6 重新启用 GitHub Pages 工作流"
resp="$(api PUT "/repos/$REPO_OWNER/$REPO_NAME/actions/workflows/pages.yml/enable" || true)"
if echo "$resp" | grep -q '"message"'; then
  warn "启用失败（PAT 缺 Actions 权限）。若下线时也没关成功，这里无需处理。"
else
  echo "    已启用 pages.yml"
fi

echo "==> 3/6 检查并（必要时）重建 Pages 站点"
# 转私有时 GitHub 会删掉 Pages 站点配置；转回公开不会自动恢复。
# 必须在 push 之前做，否则工作流会因 Pages 未启用而失败。
has_pages="$(api GET "/repos/$REPO_OWNER/$REPO_NAME" | grep -o '"has_pages": *[a-z]*' | head -1 | tr -d ' ' | cut -d: -f2)"
echo "    has_pages = ${has_pages:-未知}"
SKIP_GH=0
if [ "$has_pages" = "false" ]; then
  echo "    Pages 已被重置，尝试用 API 自动重建..."
  resp="$(api POST "/repos/$REPO_OWNER/$REPO_NAME/pages" '{"build_type":"workflow"}' || true)"
  if echo "$resp" | grep -q '"message"'; then
    SKIP_GH=1
    warn "自动重建失败（PAT 缺 Pages: Read and write）。请手动："
    echo "        仓库 Settings -> Pages -> Source 选 'GitHub Actions'"
    echo "        再对 pages.yml 点 'Re-run all jobs'"
  else
    echo "    ✓ Pages 已重建"
  fi
fi

echo "==> 4/6 revert 维护页 commit"
PAUSE_SHA=""
[ -f .pause-state ] && PAUSE_SHA="$(tr -d '[:space:]' < .pause-state)"
[ -z "$PAUSE_SHA" ] && PAUSE_SHA="$(git log --grep='pause site (maintenance page' -n1 --format=%H || true)"
if [ -z "$PAUSE_SHA" ]; then
  warn "找不到暂停 commit，改用 git revert HEAD"
  git revert --no-edit HEAD
else
  echo "    撤销: $PAUSE_SHA"
  git revert --no-edit "$PAUSE_SHA"
fi
git push origin "HEAD:main"
rm -f .pause-state

echo "==> 5/6 等待各源恢复正式页面"
for u in "${URLS[@]}"; do
  case "$u" in
    *lilycarry.github.io*)
      if [ "$SKIP_GH" = 1 ]; then echo "    - $u 跳过（Pages 未启用）"; continue; fi ;;
  esac
  ok=0
  for i in $(seq 1 18); do
    body="$(curl -sS --max-time 20 "$u" || true)"
    if echo "$body" | grep -q "$LIVE_MARK" && ! echo "$body" | grep -q "$MARKER"; then ok=1; break; fi
    sleep 10
  done
  if [ "$ok" = 1 ]; then echo "    ✓ $u"; else echo "    ✗ $u 超时未恢复"; fi
done

echo "==> 6/6 完成"
echo "    若个别源仍未恢复，等 1-2 分钟再刷，或到对应平台看构建日志。"
