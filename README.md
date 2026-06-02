# html-to-pptx-skill ![License](https://img.shields.io/github/license/Nohaol/html-to-pptx-skill?style=flat-square) ![Skill](https://img.shields.io/badge/Skill-Agent-111111?style=flat-square) ![PPTX](https://img.shields.io/badge/Export-PPTX-F2853A?style=flat-square) ![Codex](https://img.shields.io/badge/Codex-Supported-222222?style=flat-square)

把本地 HTML 幻灯片转换成可分享的 PPTX。

这个 skill 适合把网页 PPT、HTML deck、huashu / guizang 风格的单页演示导出成 PowerPoint。它会先用浏览器逐页高清截图，再把截图封装进 16:9 PPTX，并可把展示视频一起打包成 ZIP。

## 30 秒开始

把仓库放到 Codex skills 目录：

```powershell
git clone https://github.com/Nohaol/html-to-pptx-skill.git ~/.codex/skills/html-to-pptx-skill
```

安装依赖：

```powershell
cd ~/.codex/skills/html-to-pptx-skill
npm install
py -m pip install -r requirements.txt
```

然后直接对 Codex 说：

```text
用 html-to-pptx-skill 把 deck 目录里的 HTML 幻灯片转成 PPTX，并带视频打包
```

## 它会做什么

- 渲染 HTML slide 为高清 PNG，尽量保持原网页视觉效果。
- 检查坏图、404 图片和媒体路径问题，避免导出后才发现空白。
- 生成 16:9 PPTX，适合发给同学、评委或没有浏览器环境的人。
- 支持把 `.mp4` 和 PPTX 一起压成发布用 ZIP。
- 处理常见坑：相对路径、中文文件名、PowerPoint 文件占用、视频兼容。

## 适合

- HTML / Web PPT 转 PowerPoint。
- 已经设计好的网页演示，需要高保真导出。
- 带大量图片、中文路径、视频素材的本地 deck。
- 需要最终交付一个 `.pptx` 或 `.zip` 的比赛、答辩、路演场景。

## 不适合

- 需要在 PowerPoint 里逐字逐图编辑的 PPT。
- 需要复杂动画完整保留的网页演示。
- 需要从零设计 PPT 内容和视觉风格的任务。

## 手动命令

渲染 HTML：

```powershell
node scripts/render_html_deck.js --deck-dir deck --serve-root . --out deck\exports\slide-images --strict
```

生成 PPTX：

```powershell
py scripts/build_pptx.py --manifest deck\exports\slide-manifest.json --out deck\exports\deck.pptx
```

打包 PPTX 和视频：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/pack_release.ps1 `
  -OutputZip deck\exports\deck-release.zip `
  -Files deck\exports\deck.pptx,assets\demo.mp4
```

## 依赖

- Node.js
- Chrome 或 Microsoft Edge
- `playwright-core`
- Python 3
- `python-pptx`
- `Pillow`
