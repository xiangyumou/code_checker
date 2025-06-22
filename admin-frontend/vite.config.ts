import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { // 添加 server 配置
    host: true, // 监听所有地址，允许外部访问
    port: 5173, // 可以明确指定端口，虽然通常是默认值
    proxy: {
      // 将 /api/v1 的请求代理到后端服务
      '/api/v1': {
        target: 'http://backend:8000', // 后端服务地址
        changeOrigin: true, // 需要 VHost
      },
      // 注意：管理后台目前没有 WebSocket，如果需要再添加
      '/ws': {
        target: 'ws://backend:8000', // Target the backend service for WebSocket
        ws: true, // Enable WebSocket proxying
      },
    }
  }
})
