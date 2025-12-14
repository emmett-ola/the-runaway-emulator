# RunawayLog 🏃

## 語言說明

本文件為統一的中文說明，適用於簡體中文和繁體中文使用者。

追踪你逃离日常琐事的愿望。每一次点击都代表着一次突破束缚的梦想。

## 这是什么？

一个简单的应用程序，用于追踪你何时梦想逃离工作、会议或日常琐事。点击按钮，在日历热力图中查看模式，并获取励志名言。所有数据都保存在你的浏览器中，确保隐私安全。

## 项目状态

⚠️ **注意**：本项目目前处于早期开发阶段。变更可能会很频繁，文档可能并不总是最新的。请查看 [GitHub Issues](https://github.com/macar-x/runaway-log/issues) 和 [Discussions](https://github.com/macar-x/runaway-log/discussions) 获取最新更新。

## 主要功能

- 一键追踪，带有动画效果
- 统计仪表板（连续天数、趋势、高峰时间）
- 90天日历热力图，支持多种色彩主题
- 深色模式支持
- 渐进式Web应用（可安装，支持离线使用）
- 数据导入/导出功能
- 日历打印功能
- 多语言支持
- 提供免费版和专业版

## 快速开始

### 本地开发
```bash
git clone https://github.com/macar-x/runaway-log.git
cd runaway-log
npm install
npm run dev
```
访问 `http://localhost:5173`

### Docker部署
```bash
docker compose up -d
```
访问 `http://localhost:8080`

## 文档

如需完整文档，请访问我们的 [Wiki](docs/index.md)，其中包括：
- 用户指南和教程
- 开发者文档
- 部署指南
- 贡献指南
- 项目路线图

## 技术栈

React 19 + TypeScript + Vite + anime.js + Vitest  
PWA with Workbox + Service Worker  
Nginx Alpine + Docker (~53MB镜像)

## 系统要求

- **开发环境：** Node.js 20+，npm 10+
- **生产环境：** Docker + Docker Compose

## 许可证

MIT

---

使用 **Ona** AI软件工程代理构建。

## 其他语言版本

- [English](readme.md)