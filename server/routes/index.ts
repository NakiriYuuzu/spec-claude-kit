import * as path from 'node:path'
import staticPlugin from '@elysiajs/static'
import type { Context } from 'elysia'

export const useRoot = (app: any) => {
	const isProduction = Bun.env.STATUS!.toLowerCase() === 'production'

	if (isProduction) {
		app.use(staticPlugin({
			assets: path.resolve(process.cwd(), "./client/dist"),
			prefix: "/",
		}))

		app.get("*", ({ set, request }: Context) => {
			const url = new URL(request.url)

			// 跳過 API 路由
			if (url.pathname.startsWith("/api")) {
				set.status = 404
				return { error: "API endpoint not found" }
			}

			// 返回 index.html 以支援 SPA 路由
			set.headers["Content-Type"] = "text/html"
			return Bun.file(path.resolve(process.cwd(), "./client/dist/index.html"))
		})
	} else {
		app.get("*", async ({ request }: Context) => {
			const url = new URL(request.url)

			// 跳過 API 路由
			if (url.pathname.startsWith("/api")) return
			if (url.pathname.startsWith("/swagger")) return

			// 代理到 Vite 開發伺服器
			const viteUrl = `http://localhost:${Bun.env.VITE_PORT}${url.pathname}${url.search}`

			try {
				const response = await fetch(viteUrl, {
					headers: request.headers,
					method: request.method,
				})

				return new Response(response.body, {
					status: response.status,
					headers: response.headers,
				})
			} catch (error) {
				// 如果 Vite 未啟動，返回提示訊息
				return new Response(`
					${await Bun.file(path.resolve(process.cwd(), "./index.html")).text()}
      			`, {
					status: 503,
					headers: { "Content-Type": "text/html charset=utf-8" }
				})
			}
		})
	}
}