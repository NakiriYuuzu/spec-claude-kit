import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { bootLogger, stopEvent, prettyLog, ErrorMessages } from './utils'
import { useRoot } from './routes'
import { useCCSDKRoutes } from './ccsdk-new/routes'
// import { useCCSDKNativeRoutes } from './ccsdk-new/routes-elysia-native'

try {
	const app = new Elysia()
		.use(cors({ origin: true, credentials: true }))
		.use(swagger())
		.use(prettyLog)
		.onStop(stopEvent)
		.onError(({ code, error, set }: any) => ErrorMessages(code.toString(), error, set))

	// Add root routes
	useRoot(app)

	// Add Claude Code SDK routes (Native ElysiaJS implementation)
    useCCSDKRoutes(app)

	process.on("SIGINT", app.stop)
	process.on("SIGTERM", app.stop)
	app.listen(Bun.env.SERVER_PORT!, bootLogger)
} catch (e) {
	console.log('error booting the server')
	console.error(e)
}