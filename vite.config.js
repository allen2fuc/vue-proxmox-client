import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue()],
    server: {
        proxy: {
            '/api': {
                target: 'https://192.168.88.29:8006',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '/api2/json'),
                secure: false, // 忽略 SSL 证书验证
            }
        }
    }
})