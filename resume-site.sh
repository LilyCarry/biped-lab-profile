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
resp="$(api PUT "/repos/$REPO_OWNER/$REPO_NAME/actions/workflows/pages.yml/enable" || true)"
if echo "$resp" | grep -q '"message"'; then
  echo "    ⚠ 启用失败: $(echo "$resp" | grep -o '"message": *"[^"]*"' | head -1)"
  echo "      → PAT 缺 Actions: Read and Write。若之前也没关成功，就无需启用，"
  echo "        下面的 push 会正常触发 pages.yml。"
else
  echo "    已启用 pages.yml"
fi

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

echo "==> 4/5 检查 Pages 配置（转私有会让 GitHub 删掉 Pages 站点，转回公开不会自动恢复）"
has_pages="$(api GET "/repos/$REPO_OWNER/$REPO_NAME" | grep -o '"has_pages": *[a-z]*' | head -1 | tr -d ' ' | cut -d: -f2)"
echo "    has_pages = ${has_pages:-未知}"
SKIP_GH=0
if [ "$has_pages" = "false" ]; then
  SKIP_GH=1
  echo "    ⚠ Pages 已被重置，需要手动恢复一次（二选一）："
  echo "      A) 仓库 Settings -> Pages -> Source 选 'GitHub Actions'，"
  echo "         然后到 Actions 页对 pages.yml 点 'Re-run all jobs'"
  echo "      B) 给 PAT 补 Pages: Read and write 权限，重跑本脚本即可自动启用"
fi

echo "==> 5/5 等待各源恢复正式页面"
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

cat <<'TIP'

==> 完成。
    注意：如果 GitHub Pages 仍 404，是"转私有删掉了 Pages 配置"导致的，
    按上面第 4 步的 A 或 B 处理一次即可，之后不再需要。
TIP
