#!/usr/bin/env bash
# 查看 Netlify 免费额度消耗（基于推送到 main 的 commit 数估算）
#
# Netlify 2026 免费档规则（credit 制）：
#   300 credits/月 硬上限，用完站点直接暂停（不是限速、不是超额计费）
#   每次生产部署 15 credits  ->  约 20 次生产部署/月
#   带宽 20 credits/GB，请求 2 credits/万次
#   预览部署 / 分支部署 / 失败的部署 = 免费
#
# 用法: ./deploy-status.sh [计费周期起始日期 YYYY-MM-DD]
#   默认周期起始 = 2026-10-10（Netlify 项目创建日），可用第一个参数或环境变量 CYCLE_START 覆盖
set -euo pipefail

CYCLE_START="${1:-${CYCLE_START:-2026-10-10}}"
BUDGET=300          # 每月 credits
COST_DEPLOY=15      # 每次生产部署
SINCE="$CYCLE_START 00:00"

# 统计本周期内推到 main 的 commit（每次合并/推送算一次生产部署）
count=$(git log --oneline --since="$SINCE" origin/main 2>/dev/null | wc -l | tr -d ' ')
[ -z "$count" ] && count=0

credits=$((count * COST_DEPLOY))
pct=$((credits * 100 / BUDGET))
left=$((BUDGET - credits))
left_deploys=$((left / COST_DEPLOY))
[ "$left_deploys" -lt 0 ] && left_deploys=0

echo "=== Netlify 免费额度估算 ==="
echo "  计费周期起始 : $CYCLE_START"
echo "  本周期生产部署: $count 次"
echo "  估算消耗      : $credits / $BUDGET credits  (${pct}%)"
echo "  剩余额度      : $left credits  ≈ 还能推 $left_deploys 次"
echo

if [ "$left_deploys" -le 2 ]; then
  echo "  ⚠ 危险：额度即将耗尽。用完 Netlify 会直接停站（等周期重置）。"
  echo "    迭代请走分支（分支/预览部署免费），只在完工时合并到 main。"
elif [ "$pct" -ge 60 ]; then
  echo "  ⚠ 已用超过 60%，建议把迭代放到分支上，完工再合并。"
else
  echo "  ✓ 额度健康。"
fi
echo
echo "  提示：带宽/请求也会消耗 credits，但通常远小于部署（几十次访问 ≈ 0.0x credits）。"
