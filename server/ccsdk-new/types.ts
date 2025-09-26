import type { ServerWebSocket } from "bun"

// WebSocket client type
export type WSClient = ServerWebSocket<{ sessionId: string }>

// Message types for WebSocket communication
export interface ChatMessage {
	type: "chat"
	content: string
	sessionId?: string
	newConversation?: boolean
}

export interface SubscribeMessage {
	type: "subscribe"
	sessionId: string
}

export interface UnsubscribeMessage {
	type: "unsubscribe"
	sessionId: string
}

export interface SystemInfoMessage {
	type: "system_info"
}

export type IncomingMessage =
	| ChatMessage
	| SubscribeMessage
	| UnsubscribeMessage
	| SystemInfoMessage

// Claude Code SDK types
export interface AIQueryOptions {
	maxTurns?: number
	cwd?: string
	model?: string
	allowedTools?: string[]
	appendSystemPrompt?: string
	mcpServers?: any
	permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan"
	includePartialMessages?: boolean
	resume?: string // Add support for session resume
	continue?: boolean // Add support for continuing conversation
}

// Response types
export interface QueryResult {
	messages: any[]
	cost: number
	duration: number
}

// Session types
export interface SessionInfo {
	id: string
	messageCount: number
	isActive: boolean
	createdAt: Date
	lastActivity: Date
}