# 个人工程主页 · 项目约定

最后更新: 2026-10-10 (based on origin/main d09d6bc)

## 部署
- 仓库 origin: git@github.com:LilyCarry/biped-lab-profile.git
- 公网地址: https://lilycarry.github.io/biped-lab-profile/ (push main → .github/workflows/pages.yml 自动部署)
- 一键发布: `一键更新并发布.bat` (git add/commit/push origin main)

## header 镜像切换器 (node-switcher) —— 不要删
- 位于 header nav 最右, 按钮 `#node-toggle` 文字 `源: <b id="node-current-name">` + 下拉 `#node-menu`
- JS 是 index.html 里的**内联 script** (约 130-185 行), 不在 site.js 里 —— 找逻辑别只 grep js 文件
- 4 项: GitHub Pages (真实, is-active) + Cloudflare / Netlify / AliCloud (is-placeholder, href=javascript:void(0), 点了只弹 toast)
- 按钮名字按 hostname 自动判定: pages.dev→Cloudflare, netlify.app→Netlify, localhost→本地测试, lilycarry.github.io→GitHub
- 用户 2026-10-10 说"准备搞上去", 别删, 等真实镜像域名到位再接线

## 图片背板当前状态 (云端版, 与我 10-08 的本地版不同)
- 02 PCB: `.section-backdrop-pcb` 右 0 宽 58%, opacity **0.28**, cover/right center; ≤760px 时宽 80% opacity 0.16
- 04 开源: **已无 section 背板**. 课表图是 `.pr-card-shiguang` 内的 `.schedule-card-watermark` (右 0 宽 48%, opacity 0.35, mask 左透右实)
- 06 learning: `.learning-cubemx` 内 `.cubemx-card-watermark` (cubemx_pinout.png, 右 -15px 宽 50%, opacity 0.38, contain); `.learning-freertos` 内 `.hal-code-watermark` (vscode_code.png, inset 0 满铺, opacity 0.38, cover)

## 课表卡片实测几何 (1400 视口, 要改前先看这个)
- `.pr-card-shiguang` x99-678 高 340; 水印 x400-677 满高
- 卡内文字全部满宽 x125-652 (pr-head / h3 / p 三行 / pr-main / pr-secondary), 唯一空白是底部 y4169-4216 约 47px
- 结论: 右侧竖条必然压文字, 想彻底不挡只能"底部预留图带"
- 未裁剪原图在 git 历史: commit 00119b4 = 2712x1220, e7b7e49 = 2712x1125; 当前 1900x940 是 eea14ab 裁过的
- 取回: `git show 00119b4:assets/shiguang_schedule.jpg > assets/shiguang_schedule_full.jpg`

## 3D 取景 (assets/v2/scene.js)
- `frameView(view, fill)` 在 createView 末尾调用 (fill 0.92)
- pivot 必须用**板子包围盒中心**: traverse 跳过 `type==='ArrowHelper'` 子树 (坐标轴只朝 +X/+Y/+Z, 会把 group AABB 中心拉高约 0.17)
- 取景距离要覆盖**整个演示旋转包络** (roll ±13 / pitch ±9 / yaw ±16) 采样 27 个姿态取最坏值
- 改这三处前先跑探针量 NDC, 别靠肉眼猜

## 协作注意
- 本地未提交改动存在 stash@{0} (10-08 那批: learning card-backdrop / 页脚 / frameView), 已被云端版覆盖, 未 pop
- 云端 AI 会直接往 origin/main 推, 开工前先 `git fetch` + 看 HEAD 是否落后
