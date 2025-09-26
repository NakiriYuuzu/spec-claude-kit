import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'


// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		tailwindcss()
	],
	resolve: { // 設定常用路徑的別名
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	},
	server: {
		port: 5173,
		host: true,
		hmr: {
			port: 5173,
			host: 'localhost',
			protocol: 'ws'
		},
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true
			}
		}
	}
})
