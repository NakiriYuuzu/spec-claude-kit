import { Elysia, t } from "elysia"
import { WebSocketHandler } from "./websocket-handler"
import { AIClient } from "./ai-client"
import { loadConfig } from "./config"
import { createElysiaWSAdapter } from "./elysia-ws-adapter"

// Create WebSocket handler instance
const wsHandler = new WebSocketHandler(loadConfig())

// Store adapter instances for cleanup
const wsAdapters = new Map<any, any>()

// Create API routes for Claude Code SDK with ElysiaJS native WebSocket
export const ccsdkRoutesNative = new Elysia({ prefix: "/api/ccsdk-native" })
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
		open(ws) {
			console.log("[ElysiaJS Native WebSocket] Connection opened")

			// Initialize ws.data with session information
			ws.data = {
				sessionId: '',
				clientId: Date.now().toString() + '-' + Math.random().toString(36).substring(7)
			}

			// Create adapter for compatibility with existing handler
			const adapter = createElysiaWSAdapter(ws)
			wsAdapters.set(ws, adapter)

			// Call handler with adapted WebSocket
			wsHandler.onOpen(adapter as any)
		},
		// Handle incoming messages
		message(ws, message) {
			console.log("[ElysiaJS Native WebSocket] Message received:", message)

			const adapter = wsAdapters.get(ws)
			if (adapter) {
				// Convert message to string format expected by handler
				const messageStr = typeof message === 'string'
					? message
					: JSON.stringify(message)

				wsHandler.onMessage(adapter as any, messageStr)
			}
		},
		// Handle connection close
		close(ws, code, reason) {
			console.log(`[ElysiaJS Native WebSocket] Connection closed - Code: ${code}, Reason: ${reason}`)

			const adapter = wsAdapters.get(ws)
			if (adapter) {
				wsHandler.onClose(adapter as any)
				wsAdapters.delete(ws)
			}
		},
		// Handle WebSocket errors (optional)
		// Note: In error handler, the first parameter is not the WebSocket instance
		error(error) {
			console.error("[ElysiaJS Native WebSocket] Error:", error)
			// Cannot send message in error handler as ws is not available
		},
		// Optional: Handle drain event (when server is ready for more data)
		drain(ws) {
			console.log("[ElysiaJS Native WebSocket] Drain event - ready for more data")
		},
		// Optional: Configure WebSocket settings
		idleTimeout: 120, // 120 seconds idle timeout
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

// Export a function to use the native routes with the main Elysia app
export function useCCSDKNativeRoutes(app: any) {
	app.use(ccsdkRoutesNative)

	// Add test page route for native WebSocket
	app.get("/api/ccsdk-native/test", () => {
		return new Response(`<!DOCTYPE html>
<html>
<head>
    <title>ElysiaJS Native WebSocket Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
        }
        button {
            margin: 5px;
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
        }
        #status {
            margin: 20px 0;
            padding: 10px;
            background: #f0f0f0;
            border-radius: 5px;
        }
        #messages {
            margin-top: 20px;
            padding: 10px;
            background: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 5px;
            max-height: 400px;
            overflow-y: auto;
        }
        .message {
            margin: 5px 0;
            padding: 5px;
            border-left: 3px solid #007bff;
            background: white;
        }
        .error {
            border-left-color: #dc3545;
        }
        .sent {
            border-left-color: #28a745;
        }
    </style>
</head>
<body>
    <h1>ElysiaJS Native WebSocket Test</h1>
    <div>
        <button onclick="connect()">Connect</button>
        <button onclick="sendMessage()">Send Test Message</button>
        <button onclick="sendChat()">Send Chat Message</button>
        <button onclick="sendSystemInfo()">Request System Info</button>
        <button onclick="disconnect()">Disconnect</button>
        <button onclick="clearMessages()">Clear Messages</button>
    </div>
    <div id="status">Status: Disconnected</div>
    <div id="messages"></div>

    <script>
        let ws = null;
        let messageCount = 0;

        function log(msg, type = 'message') {
            const messages = document.getElementById('messages');
            const msgElement = document.createElement('div');
            msgElement.className = \`message \${type}\`;
            msgElement.innerHTML = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
            messages.appendChild(msgElement);
            messages.scrollTop = messages.scrollHeight;
            console.log(msg);
        }

        function updateStatus(status) {
            document.getElementById('status').textContent = \`Status: \${status}\`;
        }

        function connect() {
            if (ws) {
                log('Already connected', 'error');
                return;
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = \`\${protocol}//\${window.location.host}/api/ccsdk-native/ws\`;

            log(\`Connecting to \${wsUrl}...\`, 'sent');
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                updateStatus('Connected');
                log('WebSocket connected successfully');
            };

            ws.onmessage = (event) => {
                log('Received: ' + event.data);
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'error') {
                        log('Error: ' + data.error, 'error');
                    }
                } catch (e) {
                    // Not JSON, just display as is
                }
            };

            ws.onerror = (error) => {
                log('WebSocket error: ' + error, 'error');
            };

            ws.onclose = (event) => {
                updateStatus('Disconnected');
                log(\`WebSocket disconnected (code: \${event.code}, reason: \${event.reason})\`);
                ws = null;
            };
        }

        function sendMessage() {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                log('WebSocket not connected', 'error');
                return;
            }

            const msg = JSON.stringify({
                type: 'test',
                data: 'Hello from ElysiaJS Native WebSocket client!'
            });
            log('Sending: ' + msg, 'sent');
            ws.send(msg);
        }

        function sendChat() {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                log('WebSocket not connected', 'error');
                return;
            }

            const msg = JSON.stringify({
                type: 'chat',
                content: 'Hello Claude! This is from ElysiaJS native WebSocket.',
                sessionId: null, // This will be handled properly now
                newConversation: true
            });
            log('Sending chat message: ' + msg, 'sent');
            ws.send(msg);
        }

        function sendSystemInfo() {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                log('WebSocket not connected', 'error');
                return;
            }

            const msg = JSON.stringify({
                type: 'system_info'
            });
            log('Sending system info request: ' + msg, 'sent');
            ws.send(msg);
        }

        function disconnect() {
            if (ws) {
                log('Closing WebSocket connection...', 'sent');
                ws.close();
                ws = null;
            } else {
                log('Not connected', 'error');
            }
        }

        function clearMessages() {
            document.getElementById('messages').innerHTML = '';
            messageCount = 0;
        }

        // Auto-connect on load
        window.onload = () => {
            log('Page loaded, ready to connect');
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