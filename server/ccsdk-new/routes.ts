import { Elysia, t } from "elysia"
import { WebSocketHandler } from "./websocket-handler"
import { AIClient } from "./ai-client"
import { loadConfig } from "./config"
import { createElysiaWSAdapter } from "./elysia-ws-adapter"
import { getDatabase } from "./database"

// Create a WebSocket handler instance
const wsHandler = new WebSocketHandler(loadConfig())

// Get database instance
const db = getDatabase()

// Store adapter instances for cleanup (use clientId as a key instead of ws object)
const wsAdapters = new Map<string, any>()

// Create API routes for Claude Code SDK with ElysiaJS native WebSocket
export const ccsdkRoutesNative = new Elysia({ prefix: "/api/ccsdk" })
    // WebSocket endpoint using ElysiaJS native WebSocket API
    .ws("/ws", {
        // Schema validation for messages (make sessionId optional/nullable)
        body: t.Object({
            type: t.String(),
            content: t.Optional(t.String()),
            sessionId: t.Optional(t.Nullable(t.String())), // Allow null or undefined
            newConversation: t.Optional(t.Boolean()),
            error: t.Optional(t.String())
        }),
        // Handle new WebSocket connection
        async open(ws) {
            console.log("[ElysiaJS Native WebSocket] Connection opened")

            // Initialize ws.data with session information
            // Extend ws.data instead of replacing it to preserve default properties
            Object.assign(ws.data, {
                sessionId: '',
                clientId: Date.now().toString() + '-' + Math.random().toString(36).substring(7)
            })

            // Create an adapter for compatibility with the existing handler
            const adapter = createElysiaWSAdapter(ws)
            const clientId = (ws.data as any).clientId
            wsAdapters.set(clientId, adapter)
            console.log(`[WS ${clientId}] Adapter created and stored`)

            // Call handler with adapted WebSocket
            await wsHandler.onOpen(adapter as any)
        },
        // Handle incoming messages
        async message(ws, message) {
            const clientId = (ws.data as any).clientId
            console.log(`[WS ${clientId}] Message received:`, message)

            // Update sessionId if provided in the message
            if (typeof message === 'object' && message.sessionId) {
                (ws.data as any).sessionId = message.sessionId
                console.log(`[WS ${clientId}] Session ID updated: ${message.sessionId}`)
            }

            const adapter = wsAdapters.get(clientId)
            if (adapter) {
                // Convert message to string format expected by handler
                const messageStr = typeof message === 'string'
                    ? message
                    : JSON.stringify(message)

                await wsHandler.onMessage(adapter as any, messageStr)
            } else {
                console.error(`[WS ${clientId}] Adapter not found in Map`)
            }
        },
        // Handle connection closely
        close(ws, code, reason) {
            const clientId = (ws.data as any).clientId
            console.log(`[WS ${clientId}] Connection closed - Code: ${code}, Reason: ${reason}`)

            const adapter = wsAdapters.get(clientId)
            if (adapter) {
                wsHandler.onClose(adapter as any)
                wsAdapters.delete(clientId)
                console.log(`[WS ${clientId}] Adapter cleaned up`)
            } else {
                console.error(`[WS ${clientId}] Adapter not found during cleanup`)
            }
        },
        // Handle WebSocket errors (optional)
        // Note: In error handler, the first parameter is not the WebSocket instance
        error(error) {
            console.error("[ElysiaJS Native WebSocket] Error:", error)
            // Cannot send a message in error handler as ws is not available
        },
        // Optional: Handle drain event (when the server is ready for more data)
        drain() {
            console.log("[ElysiaJS Native WebSocket] Drain event - ready for more data")
        },
        // Optional: Configure WebSocket settings
        idleTimeout: 120, // 120-second idle timeout
        maxBackpressure: 1024 * 1024 * 16, // 16MB
        closeOnBackpressureLimit: false,
        perMessageDeflate: false // Disable compression for now
    })
    // REST API endpoints
    .get("/sessions", () => {
        return {
            count: wsHandler.getActiveSessionsCount(),
            sessions: wsHandler.getActiveSessions()
        }
    })
    .post("/query", async ({ body }: { body: { prompt: string; options?: any } }) => {
        const { prompt, options } = body
        const aiClient = new AIClient(loadConfig())

        try {
            const result = await aiClient.querySingle(prompt, options)
            return {
                success: true,
                ...result
            }
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            }
        }
    }, {
        body: t.Object({
            prompt: t.String(),
            options: t.Optional(t.Any())
        })
    })
    .get("/config", () => {
        return loadConfig()
    })
    .get("/health", () => {
        return {
            status: "healthy",
            activeSessions: wsHandler.getActiveSessionsCount(),
            timestamp: new Date().toISOString()
        }
    })
    // Database query endpoints
    .get("/db/sessions", ({ query }: { query: { limit?: string; offset?: string } }) => {
        const limit = query.limit ? parseInt(query.limit) : 100
        const offset = query.offset ? parseInt(query.offset) : 0
        return {
            sessions: db.getAllSessions(limit, offset),
            limit,
            offset
        }
    })
    .get("/db/sessions/active", () => {
        return {
            sessions: db.getActiveSessions()
        }
    })
    .get("/db/sessions/:id", ({ params }: { params: { id: string } }) => {
        const session = db.getSession(params.id)
        if (!session) {
            return {
                error: "Session not found",
                code: 404
            }
        }
        return { session }
    })
    .get("/db/sessions/:id/messages", ({ params, query }: { params: { id: string }; query: { limit?: string } }) => {
        const limit = query.limit ? parseInt(query.limit) : 1000
        const messages = db.getMessages(params.id, limit)
        return {
            sessionId: params.id,
            messages,
            count: messages.length
        }
    })
    .delete("/db/sessions/:id", ({ params }: { params: { id: string } }) => {
        try {
            db.deleteSession(params.id)
            return {
                success: true,
                message: `Session ${params.id} deleted`
            }
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            }
        }
    })
    .get("/db/stats", () => {
        return db.getStats()
    })
    .get("/db/search", ({ query }: any) => {
        if (!query.q) {
            return {
                error: "Query parameter 'q' is required",
                code: 400
            }
        }
        const limit = query.limit ? parseInt(query.limit) : 50
        const results = db.searchMessages(query.q, limit)
        return {
            query: query.q,
            results,
            count: results.length
        }
    })
    .post("/db/cleanup", ({ body }: { body: { days?: number } }) => {
        const days = body.days || 30
        const deleted = db.cleanupOldSessions(days)
        return {
            success: true,
            deletedCount: deleted,
            daysKept: days
        }
    }, {
        body: t.Object({
            days: t.Optional(t.Number())
        })
    })
    .post("/db/backup", ({ body }: { body: { path?: string } }) => {
        const backupPath = body.path || `./data/backup-${Date.now()}.db`
        const success = db.backup(backupPath)
        return {
            success,
            path: backupPath
        }
    }, {
        body: t.Object({
            path: t.Optional(t.String())
        })
    })

// Export a function to use the native routes with the main Elysia app
export function useCCSDKRoutes(app: any) {
    app.use(ccsdkRoutesNative)

    // Add a chat interface page route
    app.get("/api/ccsdk/chat", async () => {
        const file = Bun.file("./ccsdk-new/test-chat.html")
        return new Response(await file.text(), {
            headers: {
                "Content-Type": "text/html; charset=utf-8"
            }
        })
    })

    return app
}