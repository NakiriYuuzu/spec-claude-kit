import { MessageQueue } from "./message-queue"
import type { WSClient, SessionInfo } from "./types"
import { AIClient } from "./ai-client"
import { getDatabase } from "./database"

// Session class to manage a single Claude conversation
export class Session {
	public readonly id: string
	private messageQueue: MessageQueue<string>
	private queryPromise: Promise<void> | null = null
	private subscribers: Set<WSClient> = new Set()
	private messageCount = 0
	private aiClient: AIClient
	private sdkSessionId: string | null = null
	private createdAt: Date
	private lastActivity: Date
	private currentAbortController: AbortController | null = null
	private db = getDatabase()

	constructor(id: string, aiOptions?: any) {
		this.id = id
		this.messageQueue = new MessageQueue()
		this.aiClient = new AIClient(aiOptions)
		this.createdAt = new Date()
		this.lastActivity = new Date()

		// 在資料庫中創建 session 記錄
		try {
			this.db.createSession(this.id, this.createdAt, { aiOptions })
		} catch (error) {
			console.error("Failed to create session in database:", error)
		}
	}

	// Process a single user message
	async addUserMessage(content: string): Promise<void> {
		if (this.queryPromise) {
			// Queue is busy, wait for it
			await this.queryPromise
		}

		this.messageCount++
		this.lastActivity = new Date()
		console.log(`Processing message ${this.messageCount} in session ${this.id}`)

		// 記錄用戶消息到資料庫
		try {
			this.db.createMessage({
				sessionId: this.id,
				type: 'user',
				content: content,
				timestamp: new Date()
			})
			this.db.updateSession(this.id, {
				lastActivity: this.lastActivity,
				messageCount: this.messageCount,
				isActive: true
			})
		} catch (error) {
			console.error("Failed to save user message to database:", error)
		}

		// 創建新的 AbortController 給這次查詢
		this.currentAbortController = new AbortController()

		this.queryPromise = (async () => {
			try {
				// Use resume for multi-turn, continue for first message
				const options = this.sdkSessionId
					? { resume: this.sdkSessionId, abortController: this.currentAbortController }
					: { abortController: this.currentAbortController }

				for await (const message of this.aiClient.queryStream(content, options)) {
					this.broadcastToSubscribers(message)

					// Capture SDK session ID for multi-turn
					if (message.type === 'system' && message.subtype === 'init') {
						this.sdkSessionId = message.session_id
						console.log(`Captured SDK session ID: ${this.sdkSessionId}`)

						// 更新資料庫中的 SDK session ID
						try {
							this.db.updateSession(this.id, { sdkSessionId: this.sdkSessionId })
						} catch (error) {
							console.error("Failed to update SDK session ID:", error)
						}
					}

					// Check if conversation ended with a result
					if (message.type === 'result') {
						console.log('Result received, ready for next user message')
					}
				}
			} catch (error) {
				const errorMessage = (error as Error).message
				console.error(`Error in session ${this.id}:`, error)

				// 檢查是否為取消錯誤
				if (errorMessage.includes('abort') || errorMessage.includes('cancel')) {
					this.broadcast({
						type: 'cancelled',
						sessionId: this.id,
						message: 'Query cancelled by user'
					})
				} else {
					this.broadcastError("Query failed: " + errorMessage)
				}
			} finally {
				this.currentAbortController = null
				this.queryPromise = null

				// 將 session 標記為非活躍狀態
				try {
					this.db.updateSession(this.id, {
						isActive: false,
						lastActivity: new Date()
					})
				} catch (error) {
					console.error("Failed to update session isActive status:", error)
				}
			}
		})()

		await this.queryPromise
	}

	// Subscribe a WebSocket client to this session
	subscribe(client: WSClient) {
		this.subscribers.add(client)
		client.data.sessionId = this.id

		// Send session info to new subscriber
		const sessionInfo: SessionInfo = {
			id: this.id,
			messageCount: this.messageCount,
			isActive: this.queryPromise !== null,
			createdAt: this.createdAt,
			lastActivity: this.lastActivity
		}

		client.send(JSON.stringify({
			type: 'session_info',
			data: sessionInfo
		}))
	}

	// Unsubscribe a WebSocket client from this session
	unsubscribe(client: WSClient) {
		this.subscribers.delete(client)
	}

	// Broadcast a message to all subscribers
	private broadcastToSubscribers(message: any) {
		let wsMessage: any = null

		if (message.type === "assistant") {
			// Stream assistant responses
			const content = message.message?.content
			if (typeof content === 'string') {
				wsMessage = {
					type: 'assistant_message',
					content: content,
					sessionId: this.id
				}
				// 記錄到資料庫
				this.saveMessageToDB('assistant', null, content)
			} else if (Array.isArray(content)) {
				// Handle content blocks
				for (const block of content) {
					if (block.type === 'text') {
						wsMessage = {
							type: 'assistant_message',
							content: block.text,
							sessionId: this.id
						}
						// 記錄到資料庫
						this.saveMessageToDB('assistant', 'text', block.text)
					} else if (block.type === 'tool_use') {
						wsMessage = {
							type: 'tool_use',
							toolName: block.name,
							toolId: block.id,
							toolInput: block.input,
							sessionId: this.id
						}
						// 記錄到資料庫
						this.saveMessageToDB('tool_use', block.name, null, { toolId: block.id, toolInput: block.input })
					} else if (block.type === 'tool_result') {
						wsMessage = {
							type: 'tool_result',
							toolUseId: block.tool_use_id,
							content: block.content,
							isError: block.is_error,
							sessionId: this.id
						}
						// 記錄到資料庫
						this.saveMessageToDB('tool_result', block.is_error ? 'error' : 'success', null, {
							toolUseId: block.tool_use_id,
							content: block.content
						})
					}
					if (wsMessage) {
						this.broadcast(wsMessage)
					}
				}
				return // Already broadcasted block by block
			}
		} else if (message.type === "result") {
			if (message.subtype === "success") {
				wsMessage = {
					type: 'result',
					success: true,
					result: message.result,
					cost: message.total_cost_usd,
					duration: message.duration_ms,
					sessionId: this.id
				}
				// 記錄到資料庫
				this.saveMessageToDB('result', 'success', message.result, null, message.total_cost_usd, message.duration_ms)
			} else {
				wsMessage = {
					type: 'result',
					success: false,
					error: message.subtype,
					sessionId: this.id
				}
				// 記錄到資料庫
				this.saveMessageToDB('result', message.subtype, null)
			}
		} else if (message.type === "system") {
			wsMessage = {
				type: 'system',
				subtype: message.subtype,
				sessionId: this.id,
				data: message
			}
			// 記錄到資料庫
			this.saveMessageToDB('system', message.subtype, null, message)
		} else if (message.type === "user") {
			// Echo user messages to subscribers
			wsMessage = {
				type: 'user_message',
				content: message.message?.content,
				sessionId: this.id
			}
		}

		if (wsMessage) {
			this.broadcast(wsMessage)
		}
	}

	// 輔助方法：保存消息到資料庫
	private saveMessageToDB(
		type: string,
		subtype: string | null = null,
		content: string | null = null,
		metadata: any = null,
		cost: number | undefined = undefined,
		duration: number | undefined = undefined
	) {
		try {
			this.db.createMessage({
				sessionId: this.id,
				type,
				subtype: subtype || undefined,
				content: content || undefined,
				timestamp: new Date(),
				cost,
				duration,
				metadata
			})
		} catch (error) {
			console.error("Failed to save message to database:", error)
		}
	}

	private broadcast(message: any) {
		const messageStr = JSON.stringify(message)
		for (const client of this.subscribers) {
			try {
				client.send(messageStr)
			} catch (error) {
				console.error('Error broadcasting to client:', error)
				this.subscribers.delete(client)
			}
		}
	}

	private broadcastError(error: string) {
		this.broadcast({
			type: 'error',
			error: error,
			sessionId: this.id
		})
	}

	// Check if session has any subscribers
	hasSubscribers(): boolean {
		return this.subscribers.size > 0
	}

	// Get session info
	getInfo(): SessionInfo {
		return {
			id: this.id,
			messageCount: this.messageCount,
			isActive: this.queryPromise !== null,
			createdAt: this.createdAt,
			lastActivity: this.lastActivity
		}
	}

	// Cancel current query
	cancel(): boolean {
		if (this.currentAbortController) {
			console.log(`Cancelling query in session ${this.id}`)
			this.currentAbortController.abort()
			this.broadcast({
				type: 'cancelling',
				sessionId: this.id,
				message: 'Cancelling current query...'
			})
			return true
		}
		return false
	}

	// Clean up session
	async cleanup() {
		// 取消任何進行中的查詢
		if (this.currentAbortController) {
			this.currentAbortController.abort()
		}
		this.messageQueue.close()
		this.subscribers.clear()

		// 更新資料庫中的 session 狀態
		try {
			this.db.updateSession(this.id, {
				isActive: false,
				lastActivity: new Date()
			})
		} catch (error) {
			console.error("Failed to update session status in database:", error)
		}
	}

	// End current conversation (for starting fresh)
	endConversation() {
		// 取消當前查詢
		if (this.currentAbortController) {
			this.currentAbortController.abort()
		}
		this.sdkSessionId = null
		this.queryPromise = null
		this.messageCount = 0

		// 將 session 標記為非活躍狀態
		try {
			this.db.updateSession(this.id, {
				isActive: false,
				lastActivity: new Date()
			})
		} catch (error) {
			console.error("Failed to update session status in endConversation:", error)
		}
	}
}