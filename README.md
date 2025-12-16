# Code Checker - ACM 代码分析平台

<div align="center">

**基于 AI 的 ACM 编程问题代码分析工具**

[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

</div>

---

## 📖 项目简介

Code Checker 是一个智能代码分析平台，专为 ACM 竞赛编程设计。通过集成 OpenAI GPT 模型，提供智能的代码审查、问题解析和代码修正建议。

### 核心价值

- 🤖 **AI 驱动分析**：利用大语言模型理解题目并分析代码
- 📝 **智能题目解析**：自动整理和格式化题目信息
- 🔍 **代码错误检测**：精准定位代码问题并提供修改建议
- 📊 **可视化对比**：直观展示原始代码与修正后代码的差异
- 🌐 **多语言支持**：支持中文、英文、德语界面
- 🔄 **实时更新**：WebSocket 实时推送分析进度
- 👨‍💼 **管理后台**：完整的系统配置和日志管理

---

## ✨ 功能特性

### 用户端功能

- ✅ 提交代码和题目描述（支持文字和图片）
- ✅ 实时查看分析进度
- ✅ 查看详细的分析结果
  - 整理后的题目信息
  - 原始代码与修正代码对比
  - 详细的修改说明
- ✅ Monaco Editor 代码编辑器
- ✅ Markdown 渲染（支持数学公式和 Mermaid 图表）
- ✅ 语法高亮显示

### 管理端功能

- ✅ 管理员认证和授权
- ✅ 查看所有用户请求
- ✅ 请求详情查看和管理
- ✅ 系统设置
  - OpenAI API 配置
  - 并发控制设置
  - 日志级别调整
- ✅ 日志查看和过滤
- ✅ 个人资料管理

---

## 🚀 快速开始

### 前置要求

- **Docker** 和 **Docker Compose** 已安装
- **OpenAI API Key**（或兼容的 API）

### 5 分钟部署

```bash
# 1. 克隆项目
git clone <repository-url>
cd code_checker

# 2. 创建环境变量文件
cp .env.example .env

# 3. 编辑 .env 文件，填写必要配置
# - SECRET_KEY: 至少 32 字符的随机字符串
# - POSTGRES_*: 数据库配置
# 提示：可以使用以下命令生成 SECRET_KEY:
# openssl rand -hex 32
nano .env

# 4. 启动所有服务
docker-compose up -d

# 5. 访问应用
# 用户端: http://localhost:5063
# 管理端: http://localhost:5063/admin
```

### 首次使用

1. **初始化管理员账户**

   访问 `http://localhost:5063/admin/initialize`，设置管理员用户名和密码

2. **配置 OpenAI API**

   登录管理后台 → 设置 → 填入 OpenAI API Key 和其他配置

3. **开始使用**

   前往用户端提交代码和题目进行分析

---

## 📦 技术栈

### 后端

- **框架**: FastAPI
- **数据库**: PostgreSQL + SQLAlchemy
- **迁移工具**: Alembic
- **异步支持**: asyncpg
- **实时通信**: WebSocket
- **AI 集成**: OpenAI API
- **认证**: JWT (python-jose)

### 前端

- **框架**: React 19
- **语言**: TypeScript
- **构建工具**: Vite
- **UI 库**: Ant Design
- **代码编辑器**: Monaco Editor
- **路由**: React Router
- **国际化**: i18next
- **图表**: Mermaid
- **状态管理**: React Context

### 基础设施

- **容器化**: Docker + Docker Compose
- **日志**: 结构化日志（文件 + 控制台）
- **开发工具**: ESLint, pytest

---

## 🛠️ 开发指南

### 本地开发（不使用 Docker）

#### 后端开发

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
export SECRET_KEY="your-secret-key"
export POSTGRES_SERVER="localhost"
export POSTGRES_USER="your-user"
export POSTGRES_PASSWORD="your-password"
export POSTGRES_DB="code_checker"

# 运行数据库迁移
alembic upgrade head

# 启动开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 构建生产版本
npm run build
```

#### 运行测试

```bash
# 后端测试
cd backend
pytest tests/ -v

# 前端测试
cd frontend
npm test
```

---

## ⚙️ 环境变量配置

### 必需变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `SECRET_KEY` | JWT 加密密钥（最少 32 字符） | `openssl rand -hex 32` |
| `POSTGRES_SERVER` | PostgreSQL 服务器地址 | `db` (Docker) / `localhost` |
| `POSTGRES_USER` | 数据库用户名 | `code_checker_user` |
| `POSTGRES_PASSWORD` | 数据库密码 | `strong_password_here` |
| `POSTGRES_DB` | 数据库名称 | `code_checker_db` |

### 可选变量

OpenAI 相关配置建议在管理后台中配置，而非环境变量。

---

## 📂 项目结构

```
code_checker/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/            # API 路由
│   │   ├── core/           # 核心配置
│   │   ├── crud/           # 数据库操作
│   │   ├── models/         # SQLAlchemy 模型
│   │   ├── schemas/        # Pydantic 模型
│   │   ├── services/       # 业务逻辑
│   │   └── websockets/     # WebSocket 连接管理
│   ├── alembic/            # 数据库迁移
│   └── tests/              # 测试文件
├── frontend/               # React 前端
│   ├── src/
│   │   ├── features/       # 功能模块
│   │   │   ├── user/       # 用户端
│   │   │   └── admin/      # 管理端
│   │   ├── components/     # 共享组件
│   │   ├── api/            # API 客户端
│   │   └── locales/        # 国际化翻译
│   └── public/             # 静态资源
├── shared/                 # 前后端共享类型
├── docker-compose.yml      # Docker 编排配置
└── .env.example           # 环境变量模板
```

---

## 🔒 安全性

本项目已修复以下安全问题：

- ✅ SECRET_KEY 从环境变量加载
- ✅ 路径遍历漏洞防护
- ✅ API 访问日志记录
- ✅ 安全的 Token 管理（移除 localStorage）

详见 [FIXES_SUMMARY.md](FIXES_SUMMARY.md)

---

## 📚 文档

- [开发文档](CLAUDE.md) - 完整的开发指南和架构说明
- [修复记录](FIXES_SUMMARY.md) - 已解决的安全和性能问题
- [日志测试指南](LOG_TESTING_GUIDE.md) - 日志系统使用说明

---

## 🤝 贡献

欢迎贡献！请确保：

1. 遵循现有代码风格
2. 添加适当的测试
3. 更新相关文档
4. 提交前运行 lint 和测试

---

## 📄 许可证

[您的许可证信息]

---

## 🙏 致谢

- [FastAPI](https://fastapi.tiangolo.com/) - 现代化的 Python Web 框架
- [React](https://react.dev/) - 用户界面构建库
- [Ant Design](https://ant.design/) - 企业级 UI 设计语言
- [OpenAI](https://openai.com/) - AI 能力支持

---

## 📮 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。

---

<div align="center">

**Made with ❤️ for ACM Programmers**

</div>
