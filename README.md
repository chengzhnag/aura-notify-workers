# Aura Notify

<div align="center">

<p>一个简约、快速、可靠的个人自动化通知中心。</p>

<p>
  <img src="https://img.shields.io/badge/React-18-blue" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue" alt="TypeScript 5.8" />
  <img src="https://img.shields.io/badge/Cloudflare%20Workers-✓-orange" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-3.4-38bdf8" alt="Tailwind CSS 3.4" />
  <img src="https://img.shields.io/badge/开源协议-MIT-green" alt="License MIT" />
</p>

</div>

---

## 📖 简介

**Aura Notify**是一个简约、快速、可靠的个人自动化通知中心。基于 Cloudflare Workers 构建，支持多渠道推送（钉钉、飞书、Telegram、邮件等），可定时或周期性发送通知。

后端基于 **Cloudflare Workers** 与 **Hono** 框架，前端使用 **React 18** + **TypeScript** 构建，开箱即用。

## 📸 项目预览

### 界面预览

#### PC 端
| | |
|:---:|:---:|
| <img src="https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.9kgvol7c1d.webp" width="300"> | <img src="https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.491z3vlnhz.webp" width="300"> |
| <img src="https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.5c1oerhqlw.webp" width="300"> | <img src="https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.7lkoy92orh.webp" width="300"> |

#### 移动端
![项目预览图](https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/Stitch_20260721_104810.3k8pjv5i3y.webp)

### 在线体验

> 🌐 **在线演示**：[https://aura.952737.xyz](https://aura.952737.xyz)  
> 🔒 **密码**：123456

## ✨ 功能特性

- 📅 **灵活的任务调度** - 支持单次、周期、永久三种任务类型
- 🔔 **多渠道推送** - 钉钉、飞书、Telegram、Resend 邮件、微信测试号、WxPusher、PushMe
- ⏰ **智能时区处理** - 支持 UTC 基准时区配置，避免跨天问题
- 📊 **执行日志追踪** - 完整的推送历史记录和状态监控
- 🎨 **现代 UI 界面** - 响应式设计，支持深浅主题切换
- 🔐 **JWT 认证** - 安全的登录验证机制
- 🚀 **边缘部署** - 基于 Cloudflare Workers，全球低延迟

## 🧩 技术栈

**前端**
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui 组件库
- React Router + TanStack Query
- Framer Motion 动画
- Lucide React 图标

**后端**
- Cloudflare Workers
- Hono 框架
- D1 数据库（SQLite）
- JWT 认证
- Scheduled Handler 定时任务

**工具链**
- Bun / npm / yarn / pnpm
- Wrangler CLI
- Zod 数据验证

## 🚀 快速开始

### 前置要求

- Node.js 18+ 或 Bun
- Cloudflare 账号（用于部署）
- D1 数据库（Cloudflare 托管 SQLite）

### 安装

```bash
bun install
```

### 本地开发

启动开发服务器：

```bash
bun run dev
```

应用将在 `http://localhost:3000` 运行。

### 构建

```bash
bun run build
```

## 🛠️ 使用说明

### 1. 配置通知渠道

进入"推送渠道"页面，添加您的通知渠道：

- **钉钉机器人**: Webhook URL + 可选密钥
- **飞书机器人**: Webhook URL + 可选密钥
- **Telegram Bot**: Bot Token + Chat ID
- **Resend 邮件**: API Key + 发件人/收件人邮箱

### 2. 创建通知任务

进入"通知任务"页面，创建新任务：

- **任务类型**:
  - 单次任务：指定日期执行一次
  - 周期任务：在起止日期范围内按频率执行
  - 永久任务：长期有效，按频率执行

- **执行频率**: 设置具体时间点（如 09:00, 14:30）
- **日期类型**: 每天 / 仅工作日 / 仅节假日
- **关联渠道**: 选择一个或多个推送渠道

### 3. 查看执行历史

在"执行历史"页面查看所有推送记录，包括成功/失败状态、响应信息和错误详情。

## 🪄 部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/chengzhnag/aura-notify-workers)

### 手动部署到 Cloudflare Workers（推荐）

按照以下步骤快速部署：

1. **Star + Fork 项目**

点击右上角的 Star 和 Fork 按钮，将此仓库复制到你自己的 GitHub 账号。

2. **调整 ​`wrangler.jsonc` 配置**

在 Fork 后的仓库中编辑 `wrangler.jsonc` 文件：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `PASSWORD` | 登录密码 | `your_secure_password` |
| `JWT_SECRET` | JWT 签名密钥（随意更改） | `your_jwt_secret_key` |
| `UTC_BENCHMARK` | 基准时区（可选，国内无需更改） | `UTC+8` |

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "your-db-name",
      "database_id": "your-database-id"
    }
  ]
}
```

3. **使用 GitHub 仓库创建 Cloudflare Worker 项目**

* 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
* 进入 **Workers & Pages** → **Create application**
* 选择 **Connect to Git**
* 授权并选择你 Fork 的仓库和分支
* 按照向导完成项目创建和部署

4. **绑定自定义域名（可选）**

如果Cloudflare托管了域名，在刚部署的项目里面可以绑定自定义域名。

5. **调用 Init API 初始化 D1 数据库表**

部署完成后，必须调用一次 `/api/init` 接口来创建数据库表结构：
```
https://<your-worker-name>.<your-subdomain>.workers.dev/api/init
```
直接在浏览器访问上述 URL

![image](https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/image.86uckuhxsg.webp)

6. **完成！** 🎉

现在可以访问你的 Worker 域名开始使用了。

## 🤝 贡献

欢迎提交 Pull Request 或 Issue！

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/新功能`）
3. 提交更改（`git commit -m '新增：XXX功能'`）
4. 推送到分支（`git push origin feature/新功能`）
5. 提交 Pull Request

## ⬆️ 支持我

如果你喜欢我的项目或工作，并希望通过捐赠来支持我，非常感谢您的慷慨！

### 我的收款码
<img src="https://cdn.jsdelivr.net/gh/Zgrowth/image@master/document/1000056304.2rvhsy1c5e.png" style="width: 160px;" />

### 注意事项：

- 请在确认金额无误后进行支付。
- 捐赠时可以选择填写留言，告诉我你是谁或者对项目的建议和期待，这对我非常重要！
- 如果遇到任何问题，请联系我。

感谢您的支持与鼓励！


## 📄 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。

## 📜 API 文档

[API 文档](./API.md) 提供详细的 API 使用说明。

## 🙏 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/) — 无服务器平台
- [Hono](https://hono.dev/) — 极速 Web 框架
- [shadcn/ui](https://ui.shadcn.com/) — 精美的 UI 组件
- [Tailwind CSS](https://tailwindcss.com/) — 原子化 CSS 框架
- [React 18](https://react.dev/) — 前端库
