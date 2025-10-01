import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
	ConnectionStatus,
	Message,
	Session,
	WSIncomingMessage,
	WSOutgoingMessage,
	SessionsResponse,
	MessagesResponse,
} from '@/types/chat'

const API_BASE = '/api/ccsdk'

export const useChatStore = defineStore('chat', () => {
	// State
	const ws = ref<WebSocket | null>(null)
	const connectionStatus = ref<ConnectionStatus>('disconnected')
	const currentSessionId = ref<string | null>(null)
	const currentMessages = ref<Message[]>([])
	const isTyping = ref(false)
	const sessions = ref<Session[]>([])
	const sessionsLoading = ref(false)
	const inputText = ref('')
	const searchQuery = ref('')

	// Computed
	const isConnected = computed(() => connectionStatus.value === 'connected')

	const filteredSessions = computed(() => {
		if (!searchQuery.value) return sessions.value

		const query = searchQuery.value.toLowerCase()
		return sessions.value.filter((session) => {
			return session.id.toLowerCase().includes(query) ||
				session.sdk_session_id?.toLowerCase().includes(query)
		})
	})

	const currentSession = computed(() => {
		if (!currentSessionId.value) return null
		return sessions.value.find((s) => s.id === currentSessionId.value)
	})

	// WebSocket Actions
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null
	let reconnectAttempts = 0
	const maxReconnectAttempts = 5
	const reconnectDelay = 3000 // 3 秒

	function connectWebSocket() {
		if (ws.value?.readyState === WebSocket.OPEN) {
			console.log('WebSocket already connected')
			return
		}

		// 清除之前的重連計時器
		if (reconnectTimer) {
			clearTimeout(reconnectTimer)
			reconnectTimer = null
		}

		connectionStatus.value = 'connecting'

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
		const wsUrl = `${protocol}//${window.location.host}${API_BASE}/ws`

		try {
			ws.value = new WebSocket(wsUrl)

			ws.value.onopen = () => {
				console.log('WebSocket connected')
				connectionStatus.value = 'connected'
				reconnectAttempts = 0 // 重置重連次數
			}

			ws.value.onmessage = (event) => {
				try {
					const data: WSIncomingMessage = JSON.parse(event.data)
					handleWebSocketMessage(data)
				} catch (error) {
					console.error('Failed to parse WebSocket message:', error)
				}
			}

			ws.value.onerror = (error) => {
				console.error('WebSocket error:', error)
				connectionStatus.value = 'error'
			}

			ws.value.onclose = (event) => {
				console.log('WebSocket closed:', event.code, event.reason)
				connectionStatus.value = 'disconnected'
				ws.value = null

				// 自動重連（如果未達到最大重連次數）
				if (reconnectAttempts < maxReconnectAttempts) {
					reconnectAttempts++
					console.log(`嘗試重連 (${reconnectAttempts}/${maxReconnectAttempts})...`)
					reconnectTimer = setTimeout(() => {
						connectWebSocket()
					}, reconnectDelay)
				} else {
					console.log('已達到最大重連次數，停止自動重連')
				}
			}
		} catch (error) {
			console.error('Failed to create WebSocket:', error)
			connectionStatus.value = 'error'
		}
	}

	// 手動重連（重置重連次數）
	function reconnectWebSocket() {
		reconnectAttempts = 0
		if (reconnectTimer) {
			clearTimeout(reconnectTimer)
			reconnectTimer = null
		}
		connectWebSocket()
	}

	function disconnectWebSocket() {
		if (ws.value) {
			ws.value.close()
			ws.value = null
		}
		connectionStatus.value = 'disconnected'
	}

	function sendWebSocketMessage(message: WSOutgoingMessage) {
		if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
			console.error('WebSocket is not connected')
			return false
		}

		try {
			ws.value.send(JSON.stringify(message))
			return true
		} catch (error) {
			console.error('Failed to send WebSocket message:', error)
			return false
		}
	}

	// Handle incoming WebSocket messages
	function handleWebSocketMessage(data: WSIncomingMessage) {
		console.log('Received message:', data)

		switch (data.type) {
			case 'connected':
				console.log('Connected to server:', data.message)
				// 載入 sessions 列表
				loadSessions()
				break

			case 'session_info':
				// 更新或新增 session
				updateSessionInfo(data.data)
				// 如果當前沒有 session ID（新對話），則設置為這個 session
				if (!currentSessionId.value) {
					currentSessionId.value = data.data.id
					console.log('Set current session ID to:', data.data.id)
				}
				break

			case 'assistant_message':
				isTyping.value = false
				addMessage({
					session_id: data.sessionId,
					type: 'assistant',
					content: data.content,
					timestamp: Date.now(),
				})
				break

			case 'system':
				addMessage({
					session_id: data.sessionId,
					type: 'system',
					subtype: data.subtype,
					timestamp: Date.now(),
					metadata: data.data,
				})
				break

			case 'error':
				isTyping.value = false
				addMessage({
					session_id: data.sessionId || currentSessionId.value || 'unknown',
					type: 'error',
					content: data.error,
					timestamp: Date.now(),
				})
				break

			case 'result':
				isTyping.value = false
				// 不顯示 result 訊息（如 test-chat.html）
				break

			case 'cancelled':
			case 'cancelling':
				isTyping.value = false
				addMessage({
					session_id: data.sessionId,
					type: 'system',
					content: data.message,
					timestamp: Date.now(),
				})
				break

			case 'tool_use':
				addMessage({
					session_id: data.sessionId,
					type: 'tool_use',
					toolName: data.toolName,
					toolId: data.toolId,
					toolInput: data.toolInput,
					timestamp: Date.now(),
				})
				break

			case 'tool_result':
				addMessage({
					session_id: data.sessionId,
					type: 'tool_result',
					toolUseId: data.toolUseId,
					content: JSON.stringify(data.content),
					isError: data.isError,
					timestamp: Date.now(),
				})
				break
		}
	}

	function updateSessionInfo(sessionInfo: any) {
		const existingIndex = sessions.value.findIndex((s) => s.id === sessionInfo.id)

		const session: Session = {
			id: sessionInfo.id,
			created_at: new Date(sessionInfo.createdAt).getTime(),
			last_activity: new Date(sessionInfo.lastActivity).getTime(),
			message_count: sessionInfo.messageCount,
			is_active: sessionInfo.isActive,
		}

		if (existingIndex >= 0) {
			sessions.value[existingIndex] = session
		} else {
			sessions.value.unshift(session)
		}

		// 排序 sessions（最近活動的在前）
		sessions.value.sort((a, b) => b.last_activity - a.last_activity)
	}

	function addMessage(message: Message) {
		// 添加訊息的邏輯：
		// 1. 如果訊息的 session_id 與當前 session 匹配
		// 2. 如果訊息的 session_id 是 'pending'（本地暫時的）
		// 3. 如果當前沒有 session ID（新對話的第一條訊息）
		if (
			message.session_id === currentSessionId.value ||
			message.session_id === 'pending' ||
			currentSessionId.value === null
		) {
			currentMessages.value.push(message)
		}
	}

	// Chat Actions
	async function sendMessage(content: string) {
		if (!content.trim()) return

		// 先清空輸入框和設置 typing 狀態
		const messageContent = content.trim()
		inputText.value = ''

		// 添加用戶訊息到畫面
		addMessage({
			session_id: currentSessionId.value || 'pending',
			type: 'user',
			content: messageContent,
			timestamp: Date.now(),
		})

		// 設置 typing 狀態
		isTyping.value = true

		// 發送 WebSocket 訊息
		const success = sendWebSocketMessage({
			type: 'chat',
			content: messageContent,
			sessionId: currentSessionId.value,
			newConversation: currentSessionId.value === null,
		})

		if (!success) {
			// 如果發送失敗，取消 typing 狀態
			isTyping.value = false
		}
	}

	function cancelQuery() {
		if (!currentSessionId.value) return

		sendWebSocketMessage({
			type: 'cancel',
			sessionId: currentSessionId.value,
		})
	}

	function newConversation() {
		currentSessionId.value = null
		currentMessages.value = []
	}

	function clearMessages() {
		currentMessages.value = []
	}

	// Session Management
	async function loadSessions() {
		sessionsLoading.value = true

		try {
			const response = await fetch(`${API_BASE}/db/sessions?limit=100`)
			if (!response.ok) throw new Error('Failed to load sessions')

			const data: SessionsResponse = await response.json()
			sessions.value = data.sessions.sort((a, b) => b.last_activity - a.last_activity)
		} catch (error) {
			console.error('Failed to load sessions:', error)
		} finally {
			sessionsLoading.value = false
		}
	}

	async function selectSession(sessionId: string) {
		if (currentSessionId.value === sessionId) return

		// 取消訂閱當前 session
		if (currentSessionId.value) {
			sendWebSocketMessage({
				type: 'unsubscribe',
				sessionId: currentSessionId.value,
			})
		}

		// 清空當前訊息
		currentMessages.value = []
		currentSessionId.value = sessionId

		// 載入 session 歷史訊息
		await loadSessionMessages(sessionId)

		// 訂閱新 session
		sendWebSocketMessage({
			type: 'subscribe',
			sessionId: sessionId,
		})
	}

	async function loadSessionMessages(sessionId: string) {
		try {
			const response = await fetch(`${API_BASE}/db/sessions/${sessionId}/messages`)
			if (!response.ok) throw new Error('Failed to load messages')

			const data: MessagesResponse = await response.json()

			// 轉換資料庫訊息為顯示格式
			currentMessages.value = data.messages.map((msg) => ({
				id: msg.id,
				session_id: msg.session_id,
				type: msg.type as any,
				subtype: msg.subtype,
				content: msg.content,
				timestamp: msg.timestamp,
				cost: msg.cost,
				duration: msg.duration,
				metadata: msg.metadata ? (typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata) : undefined,
			}))
		} catch (error) {
			console.error('Failed to load session messages:', error)
		}
	}

	async function deleteSession(sessionId: string) {
		try {
			const response = await fetch(`${API_BASE}/db/sessions/${sessionId}`, {
				method: 'DELETE',
			})

			if (!response.ok) throw new Error('Failed to delete session')

			// 從列表中移除
			sessions.value = sessions.value.filter((s) => s.id !== sessionId)

			// 如果刪除的是當前 session，清空
			if (currentSessionId.value === sessionId) {
				currentSessionId.value = null
				currentMessages.value = []
			}

			return true
		} catch (error) {
			console.error('Failed to delete session:', error)
			return false
		}
	}

	// 初始化
	function init() {
		connectWebSocket()
	}

	// 清理
	function cleanup() {
		disconnectWebSocket()
	}

	return {
		// State
		ws,
		connectionStatus,
		currentSessionId,
		currentMessages,
		isTyping,
		sessions,
		sessionsLoading,
		inputText,
		searchQuery,

		// Computed
		isConnected,
		filteredSessions,
		currentSession,

		// Actions
		connectWebSocket,
		disconnectWebSocket,
		reconnectWebSocket,
		sendMessage,
		cancelQuery,
		newConversation,
		clearMessages,
		loadSessions,
		selectSession,
		deleteSession,
		init,
		cleanup,
	}
})
