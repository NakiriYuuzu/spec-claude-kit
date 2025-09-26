import { fileLogger, logger } from '@bogeychan/elysia-logger'

const prettyLog = logger({
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true
		}
	}
})

const fileLog = async () => {
	const logPath = process.env.SERVER_LOG_PATH!
	const logPathFile = Bun.file(logPath)
	const isExists = await logPathFile.exists()

	if (!isExists) {
		await Bun.write("../logs/server.log", "", { createPath: true })
	}

	return fileLogger({
		file: logPath,
		level: Bun.env.SERVER_LOG_LEVEL || 'info',
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true
			}
		}
	})
}

const bootLogger = () => {
	const port = Bun.env.SERVER_PORT
	console.log(`
╭──────────────────────────────────────────────╮
│                                              │
│  🚀 ${Bun.env.STATUS} Server                        │
│                                              │
   Server:   http://localhost:${port}     
   API:      http://localhost:${port}/api
│                                              │
│  Running in ${Bun.env.STATUS} mode! 🎯              │
│                                              │
╰──────────────────────────────────────────────╯
  `)
}

export { prettyLog, fileLog, bootLogger }