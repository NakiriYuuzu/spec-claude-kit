import { Elysia, t } from "elysia"
import { WebSocketHandler } from "./websocket-handler"
import { AIClient } from "./ai-client"
import { loadConfig } from "./config"

// Store WebSocket connections with their data
const wsConnections = new Map<any, { sessionId: string }>()

// Create WebSocket handler instance
const wsHandler = new WebSocketHandler(loadConfig())

// Create API routes for Claude Code SDK
export const ccsdkRoutes = new Elysia({ prefix: "/api/ccsdk" })
	// WebSocket endpoint for real-time communication
	.ws("/ws", {
		async open(ws) {
			console.log("WebSocket opened")
			// Store connection data
			wsConnections.set(ws, { sessionId: "" })

			// Create a wrapper that mimics WSClient interface
			const wsClient = {
				send: (data: string) => ws.send(data),
				data: wsConnections.get(ws)!,
				close: () => ws.close(),
				isAlive: true
			} as any

			await wsHandler.onOpen(wsClient)
		},
		async message(ws, message: any) {
			console.log("WebSocket message received:", message)

			// Create wrapper with stored data
			const wsClient = {
				send: (data: string) => ws.send(data),
				data: wsConnections.get(ws) || { sessionId: "" },
				close: () => ws.close(),
				isAlive: true
			} as any

			const messageStr = typeof message === "string" ? message : JSON.stringify(message)
			await wsHandler.onMessage(wsClient, messageStr)
		},
		close(ws) {
			console.log("WebSocket closed")

			const connectionData = wsConnections.get(ws)
			if (connectionData) {
				const wsClient = {
					send: () => {},
					data: connectionData,
					close: () => {},
					isAlive: false
				} as any

				wsHandler.onClose(wsClient)
				wsConnections.delete(ws)
			}
		}
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

// Export a function to use the routes with the main Elysia app
export function useCCSDKRoutes(app: any) {
	app.use(ccsdkRoutes)

	// Add test page route
	app.get("/api/ccsdk/test", () => {
		return new Response(`<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Test</title>
</head>
<body>
    <h1>WebSocket Test</h1>
    <button onclick="connect()">Connect</button>
    <button onclick="sendMessage()">Send Test Message</button>
    <button onclick="sendChat()">Send Chat Message</button>
    <button onclick="disconnect()">Disconnect</button>
    <div id="status">Disconnected</div>
    <div id="messages"></div>

    <script>
        let ws = null;

        function log(msg) {
            const messages = document.getElementById('messages');
            messages.innerHTML += '<p>' + msg + '</p>';
            console.log(msg);
        }

        function connect() {
            ws = new WebSocket('ws://localhost:3000/api/ccsdk/ws');

            ws.onopen = () => {
                document.getElementById('status').textContent = 'Connected';
                log('WebSocket connected');
            };

            ws.onmessage = (event) => {
                log('Received: ' + event.data);
            };

            ws.onerror = (error) => {
                log('Error: ' + error);
            };

            ws.onclose = () => {
                document.getElementById('status').textContent = 'Disconnected';
                log('WebSocket disconnected');
            };
        }

        function sendMessage() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                const msg = JSON.stringify({ type: 'test', data: 'Hello from client' });
                log('Sending: ' + msg);
                ws.send(msg);
            } else {
                log('WebSocket not connected');
            }
        }

        function sendChat() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                const msg = JSON.stringify({
                    type: 'chat',
                    content: 'Hello, Claude!',
                    sessionId: null
                });
                log('Sending: ' + msg);
                ws.send(msg);
            } else {
                log('WebSocket not connected');
            }
        }

        function disconnect() {
            if (ws) {
                ws.close();
                ws = null;
            }
        }

        // Auto-connect on load
        window.onload = () => {
            setTimeout(connect, 500);
        };
    </script>
</body>
</html>`, {
			headers: {
				"Content-Type": "text/html"
			}
		})
	})

	return app
}