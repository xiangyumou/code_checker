# 使用官方 Node.js 运行时作为父镜像
# 选择与您的项目兼容的版本（例如 LTS 版本 node:18 或 node:20）
FROM node:18-alpine

# 设置容器中的工作目录
WORKDIR /app

# 复制 package.json 和锁文件 (package-lock.json 或 yarn.lock)
# 先复制这些文件以利用 Docker 的依赖缓存层
COPY package*.json ./

# 复制应用程序的其余代码
# 注意：确保在项目根目录有一个 .dockerignore 文件来排除 node_modules, .git 等
COPY . .

# 安装项目依赖
# Note: npm ci is run after copying files so it can find the shared library
RUN npm install
# 如果使用 yarn，请取消注释下一行并注释掉上一行
# RUN yarn install --frozen-lockfile

# (可选) 为生产环境构建应用
# 如果您只需要开发服务器，可以跳过此步骤
# RUN npm run build

# 暴露应用程序运行的端口 (Vite 默认为 5173)
EXPOSE 5173

# 定义运行应用程序的命令 (Vite 开发服务器)
# 使用 --host 将其暴露到容器外部
CMD ["npm", "run", "dev", "--", "--host"]
# 如果使用 yarn:
# CMD ["yarn", "dev", "--host"]