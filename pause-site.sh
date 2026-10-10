#!/usr/bin/env bash
# 暂停站点：推维护页 -> 等三个源同步 -> 关闭 Pages 工作流 -> 仓库转私有
# 用法: ./pause-site.sh
# 需要: GITHUB_TOKEN 环境变量（或 ~/.biped_site_token 文件），PAT 需 admin 权限
set -euo pipefail

REPO_OWNER="LilyCarry"
REPO_NAME="biped-lab-profile"
MARKER="MAINTENANCE_MODE_MARK_2026"
URLS=(
  "https://lilycarry.github.io/biped-lab-profile/"
  "https://bi-lab-pro.netlify.app/"
  "https://biped-lab-profile.pages.dev/"
)

# ---- token ----
if [ -z "${GITHUB_TOKEN:-}" ]; then
  if [ -f "$HOME/.biped_site_token" ]; then
    GITHUB_TOKEN="$(cat "$HOME/.biped_site_token" | tr -d '[:space:]')"
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
      -H "Accept: application/vnd.github+json" \
      -d "$d"
  else
    curl -sS -X "$m" "https://api.github.com$p" \
      -H "Authorization: Bearer $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json"
  fi
}

echo "==> 1/5 写入维护页（零个人信息）"
cat > index.html <<HTML
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>暂时关闭</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f3ed;color:#252321;
       font-family:ui-sans-serif,system-ui,"Segoe UI",sans-serif;}
  .box{text-align:center;padding:40px;}
  h1{font-size:22px;font-weight:600;margin:0 0 10px;}
  p{font-size:14px;color:#6b6660;margin:0;}
</style>
</head>
<body><div class="box"><h1>站点暂时关闭</h1><p>Site temporarily offline.</p></div></body>
</html>
<!-- $MARKER -->
HTML

echo "==> 2/5 commit + push"
git add index.html
git commit -m "chore: pause site (maintenance page, no personal info)"
git push origin "HEAD:main"
PAUSE_SHA="$(git rev-parse HEAD)"
echo "$PAUSE_SHA" > .pause-state
echo "    暂停 commit: $PAUSE_SHA (已记入 .pause-state)"

echo "==> 3/5 等待三个源同步维护页（最多 6 分钟）"
for u in "${URLS[@]}"; do
  ok=0
  for i in $(seq 1 36); do
    if curl -sS --max-time 20 "$u" | grep -q "$MARKER"; then ok=1; break; fi
    sleep 10
  done
  if [ "$ok" = 1 ]; then echo "    ✓ $u"; else echo "    ✗ $u 超时未同步（继续，稍后自查）"; fi
done

echo "==> 4/5 关闭 GitHub Pages 工作流（避免私有仓库上跑注定失败的 Actions）"
resp="$(api PUT "/repos/$REPO_OWNER/$REPO_NAME/actions/workflows/pages.yml/disable" || true)"
if echo "$resp" | grep -q '"message"'; then
  echo "    ⚠ 关闭失败: $(echo "$resp" | grep -o '"message": *"[^"]*"' | head -1)"
  echo "      → PAT 需要补上 Actions: Read and Write 权限才能关工作流。"
  echo "        不加也不影响站点是否可见，只是私有期间每次 push 会多出一个失败的"
  echo "        Actions run（红叉，无害）。"
else
  echo "    已关闭 pages.yml"
fi

echo "==> 5/5 仓库转私有"
api PATCH "/repos/$REPO_OWNER/$REPO_NAME" '{"private": true}' \
  | grep -o '"private": *[a-z]*' | head -1

echo
echo "==> 完成。当前状态："
echo "    - GitHub Pages : 应已 404（Free 计划私有仓库无 Pages）"
echo "    - Netlify / CF : 仍在服务，但内容是零信息维护页"
echo "    - 仓库源码/历史: 已不可见"
echo
echo "如需让 Netlify / CF 链接也彻底 404，需手动："
echo "    Netlify  : 项目页把 Make public 开关切回去（或删除站点）"
echo "    CF Pages : 删除项目（注意 biped-lab-profile 名字可能被抢注）"
echo
echo "恢复：./resume-site.sh  (暂停 commit: $PAUSE_SHA)"
