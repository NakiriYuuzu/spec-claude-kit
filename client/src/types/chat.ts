// WebSocket 訊息類型
export type MessageType =
	| 'user'
	| 'assistant'
	| 'system'
	| 'error'
	| 'info'
	| 'tool_use'
	| 'tool_result'
	| 'result'

export type MessageSubtype =
	| 'init'
	| 'success'
	| 'text'
	| string

// Session 介面
export interface Session {
	id: string
	sdk_session_id?: string
	created_at: number
	last_activity: number
	message_count: number
	is_active: boolean
	metadata?: any
}

// Message 介面
export interface Message {
	id?: number
	session_id: string
	type: MessageType
	subtype?: MessageSubtype
	content?: string
	timestamp: number
	cost?: number
	duration?: number
	metadata?: any
	// 額外的欄位用於顯示
	toolName?: string
	toolId?: string
	toolInput?: any
	toolUseId?: string
	isError?: boolean
}

// WebSocket 傳入訊息類型
export interface WSChatMessage {
	type: 'chat'
	content: string
	sessionId?: string | null
	newConversation?: boolean
}

export interface WSSubscribeMessage {
	type: 'subscribe'
	sessionId: string
}

export interface WSUnsubscribeMessage {
	type: 'unsubscribe'
	sessionId: string
}

export interface WSCancelMessage {
	type: 'cancel'
	sessionId: string
}

export interface WSSystemInfoMessage {
	type: 'system_info'
}

export type WSOutgoingMessage =
	| WSChatMessage
	| WSSubscribeMessage
	| WSUnsubscribeMessage
	| WSCancelMessage
	| WSSystemInfoMessage

// WebSocket 接收訊息類型
export interface WSConnectedMessage {
	type: 'connected'
	message: string
	availableSessions?: SessionInfo[]
}

export interface WSSessionInfoMessage {
	type: 'session_info'
	data: SessionInfo
}

export interface WSAssistantMessage {
	type: 'assistant_message'
	content: string
	sessionId: string
}

export interface WSSystemMessage {
	type: 'system'
	subtype: string
	sessionId: string
	data?: any
}

export interface WSErrorMessage {
	type: 'error'
	error: string
	sessionId?: string
}

export interface WSResultMessage {
	type: 'result'
	success: boolean
	result?: any
	cost?: number
	duration?: number
	error?: string
	sessionId: string
}

export interface WSToolUseMessage {
	type: 'tool_use'
	toolName: string
	toolId: string
	toolInput: any
	sessionId: string
}

export interface WSToolResultMessage {
	type: 'tool_result'
	toolUseId: string
	content: any
	isError: boolean
	sessionId: string
}

export interface WSCancelledMessage {
	type: 'cancelled'
	message: string
	sessionId: string
}

export interface WSCancellingMessage {
	type: 'cancelling'
	message: string
	sessionId: string
}

export type WSIncomingMessage =
	| WSConnectedMessage
	| WSSessionInfoMessage
	| WSAssistantMessage
	| WSSystemMessage
	| WSErrorMessage
	| WSResultMessage
	| WSToolUseMessage
	| WSToolResultMessage
	| WSCancelledMessage
	| WSCancellingMessage

// Session Info（從 server 傳來的）
export interface SessionInfo {
	id: string
	messageCount: number
	isActive: boolean
	createdAt: Date | string
	lastActivity: Date | string
}

// MCP Server Info
export interface MCPServer {
	name: string
	status: string
}

// System Init Data
export interface SystemInitData {
	session_id: string
	model: string
	cwd: string
	permissionMode: string
	mcp_servers?: MCPServer[]
	tools?: any[]
}

// API Response 類型
export interface SessionsResponse {
	count: number
	sessions: Session[]
	limit?: number
	offset?: number
}

export interface SessionResponse {
	session: Session
}

export interface MessagesResponse {
	sessionId: string
	messages: Message[]
	count: number
}

export interface StatsResponse {
	totalSessions: number
	activeSessions: number
	totalMessages: number
	totalCost: number
	messagesByType: Array<{
		type: string
		count: number
	}>
}

// 連接狀態
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

// Chat Store State
export interface ChatState {
	// WebSocket
	ws: WebSocket | null
	connectionStatus: ConnectionStatus

	// Current Session
	currentSessionId: string | null
	currentMessages: Message[]
	isTyping: boolean

	// Sessions List
	sessions: Session[]
	sessionsLoading: boolean

	// UI State
	inputText: string
	searchQuery: string
}
