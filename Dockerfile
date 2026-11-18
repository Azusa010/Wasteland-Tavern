# ---------- 构建阶段:安装依赖并编译前端 ----------
FROM node:22-alpine AS build
WORKDIR /app

# 先单独拷贝 package.json 安装依赖,充分利用 Docker 层缓存
# 魔搭构建服务器在国内,使用 npmmirror 加速;如遇同步问题可删掉 --registry 参数
COPY package.json ./
RUN npm install --no-audit --no-fund --registry=https://registry.npmmirror.com

# 拷贝源码并构建前端产物 dist/
COPY . .
RUN npm run build

# ---------- 运行阶段 ----------
FROM node:22-alpine
WORKDIR /app

# 魔搭创空间硬性要求:服务必须监听 0.0.0.0:7860,端口不可修改
# NODE_ENV=production 让 server.ts 直接托管 dist/ 静态产物,而非 Vite 开发中间件
ENV NODE_ENV=production
ENV PORT=7860

# 运行时依赖(node_modules 内含 tsx,用于直接运行 server.ts)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# 服务端入口、前端构建产物、以及服务端引用的源码数据与静态图片
COPY --from=build /app/server.ts ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src

EXPOSE 7860
CMD ["npx", "tsx", "server.ts"]
