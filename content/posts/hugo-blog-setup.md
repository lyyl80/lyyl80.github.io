---
title: "用 Hugo 搭建个人博客的完整流程"
date: 2026-06-24
draft: false
tags: ["教程", "Hugo", "GitHub Pages"]
summary: "从零开始，使用 Hugo 构建一个极简风格的个人博客并部署到 GitHub Pages。"
---

## 前置准备

你需要提前安装好以下工具：

```bash
# 检查 Git 版本
git --version

# 安装 Hugo (macOS)
brew install hugo

# 安装 Hugo (Windows)
choco install hugo-extended
```

## 创建站点

```bash
hugo new site my-blog
cd my-blog
git init
```

## 安装主题

推荐使用 PaperMod 主题：

```bash
git submodule add --depth=1 https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
```

然后在 `hugo.toml` 中添加：

```toml
theme = "PaperMod"
```

## 本地预览

```bash
hugo server -D
```

打开浏览器访问 `http://localhost:1313` 即可看到效果。

## 部署到 GitHub Pages

详见下一篇关于 CI/CD 的文章。
