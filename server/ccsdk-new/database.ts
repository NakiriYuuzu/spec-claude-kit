import { Database } from "bun:sqlite"
import path from "path"

export class CCSDKDatabase {
	private db: Database

	constructor(dbPath: string = "./data/ccsdk.db") {
		// 確保資料目錄存在
		const dir = path.dirname(dbPath)
		if (!require("fs").existsSync(dir)) {
			require("fs").mkdirSync(dir, { recursive: true })
		}

		this.db = new Database(dbPath, { create: true })

		// 啟用 WAL mode 以提升並發性能
		this.db.run("PRAGMA journal_mode = WAL")
		this.db.run("PRAGMA synchronous = NORMAL")
		this.db.run("PRAGMA foreign_keys = ON")

		this.initSchema()
	}

	private initSchema() {
		// Sessions 表
		this.db.run(`
			CREATE TABLE IF NOT EXISTS sessions (
				id TEXT PRIMARY KEY,
				sdk_session_id TEXT,
				created_at INTEGER NOT NULL,
				last_activity INTEGER NOT NULL,
				message_count INTEGER DEFAULT 0,
				is_active BOOLEAN DEFAULT 0,
				metadata TEXT
			)
		`)

		// Messages 表
		this.db.run(`
			CREATE TABLE IF NOT EXISTS messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				session_id TEXT NOT NULL,
				type TEXT NOT NULL,
				subtype TEXT,
				content TEXT,
				timestamp INTEGER NOT NULL,
				cost REAL,
				duration INTEGER,
				metadata TEXT,
				FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
			)
		`)

		// WebSocket Clients 表
		this.db.run(`
			CREATE TABLE IF NOT EXISTS clients (
				id TEXT PRIMARY KEY,
				connected_at INTEGER NOT NULL,
				disconnected_at INTEGER,
				current_session_id TEXT,
				ip_address TEXT,
				user_agent TEXT,
				FOREIGN KEY (current_session_id) REFERENCES sessions(id) ON DELETE SET NULL
			)
		`)

		// 創建索引以提升查詢性能
		this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)`)
		this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`)
		this.db.run(`CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)`)
		this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity)`)
		this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active)`)

		console.log("✅ Database schema initialized")
	}

	// Session 操作
	createSession(id: string, createdAt: Date, metadata?: any) {
		const stmt = this.db.prepare(`
			INSERT INTO sessions (id, created_at, last_activity, message_count, is_active, metadata)
			VALUES (?, ?, ?, 0, 1, ?)
		`)
		stmt.run(
			id,
			createdAt.getTime(),
			createdAt.getTime(),
			metadata ? JSON.stringify(metadata) : null
		)
	}

	updateSession(id: string, updates: {
		sdkSessionId?: string
		lastActivity?: Date
		messageCount?: number
		isActive?: boolean
		metadata?: any
	}) {
		const fields: string[] = []
		const values: any[] = []

		if (updates.sdkSessionId !== undefined) {
			fields.push("sdk_session_id = ?")
			values.push(updates.sdkSessionId)
		}
		if (updates.lastActivity !== undefined) {
			fields.push("last_activity = ?")
			values.push(updates.lastActivity.getTime())
		}
		if (updates.messageCount !== undefined) {
			fields.push("message_count = ?")
			values.push(updates.messageCount)
		}
		if (updates.isActive !== undefined) {
			fields.push("is_active = ?")
			values.push(updates.isActive ? 1 : 0)
		}
		if (updates.metadata !== undefined) {
			fields.push("metadata = ?")
			values.push(JSON.stringify(updates.metadata))
		}

		if (fields.length === 0) return

		values.push(id)
		const stmt = this.db.prepare(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`)
		stmt.run(...values)
	}

	getSession(id: string) {
		const stmt = this.db.prepare("SELECT * FROM sessions WHERE id = ?")
		return stmt.get(id)
	}

	getAllSessions(limit: number = 100, offset: number = 0) {
		const stmt = this.db.prepare(`
			SELECT * FROM sessions
			ORDER BY last_activity DESC
			LIMIT ? OFFSET ?
		`)
		return stmt.all(limit, offset)
	}

	getActiveSessions() {
		const stmt = this.db.prepare("SELECT * FROM sessions WHERE is_active = 1 ORDER BY last_activity DESC")
		return stmt.all()
	}

	deleteSession(id: string) {
		const stmt = this.db.prepare("DELETE FROM sessions WHERE id = ?")
		stmt.run(id)
	}

	// Message 操作
	createMessage(data: {
		sessionId: string
		type: string
		subtype?: string
		content?: string
		timestamp: Date
		cost?: number
		duration?: number
		metadata?: any
	}) {
		const stmt = this.db.prepare(`
			INSERT INTO messages (session_id, type, subtype, content, timestamp, cost, duration, metadata)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`)
		const result = stmt.run(
			data.sessionId,
			data.type,
			data.subtype || null,
			data.content || null,
			data.timestamp.getTime(),
			data.cost || null,
			data.duration || null,
			data.metadata ? JSON.stringify(data.metadata) : null
		)
		return result.lastInsertRowid
	}

	getMessages(sessionId: string, limit: number = 1000) {
		const stmt = this.db.prepare(`
			SELECT * FROM messages
			WHERE session_id = ?
			ORDER BY timestamp ASC
			LIMIT ?
		`)
		return stmt.all(sessionId, limit)
	}

	getMessagesByType(sessionId: string, type: string) {
		const stmt = this.db.prepare(`
			SELECT * FROM messages
			WHERE session_id = ? AND type = ?
			ORDER BY timestamp ASC
		`)
		return stmt.all(sessionId, type)
	}

	// Client 操作
	createClient(id: string, connectedAt: Date, ipAddress?: string, userAgent?: string) {
		const stmt = this.db.prepare(`
			INSERT INTO clients (id, connected_at, ip_address, user_agent)
			VALUES (?, ?, ?, ?)
		`)
		stmt.run(id, connectedAt.getTime(), ipAddress || null, userAgent || null)
	}

	updateClient(id: string, updates: {
		disconnectedAt?: Date
		currentSessionId?: string
	}) {
		const fields: string[] = []
		const values: any[] = []

		if (updates.disconnectedAt !== undefined) {
			fields.push("disconnected_at = ?")
			values.push(updates.disconnectedAt.getTime())
		}
		if (updates.currentSessionId !== undefined) {
			fields.push("current_session_id = ?")
			values.push(updates.currentSessionId)
		}

		if (fields.length === 0) return

		values.push(id)
		const stmt = this.db.prepare(`UPDATE clients SET ${fields.join(", ")} WHERE id = ?`)
		stmt.run(...values)
	}

	// 統計查詢
	getStats() {
		const totalSessions = this.db.prepare("SELECT COUNT(*) as count FROM sessions").get() as any
		const activeSessions = this.db.prepare("SELECT COUNT(*) as count FROM sessions WHERE is_active = 1").get() as any
		const totalMessages = this.db.prepare("SELECT COUNT(*) as count FROM messages").get() as any
		const totalCost = this.db.prepare("SELECT SUM(cost) as total FROM messages WHERE cost IS NOT NULL").get() as any

		const messagesByType = this.db.prepare(`
			SELECT type, COUNT(*) as count
			FROM messages
			GROUP BY type
		`).all()

		return {
			totalSessions: totalSessions.count,
			activeSessions: activeSessions.count,
			totalMessages: totalMessages.count,
			totalCost: totalCost.total || 0,
			messagesByType
		}
	}

	// 清理舊資料
	cleanupOldSessions(daysToKeep: number = 30) {
		const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
		const stmt = this.db.prepare(`
			DELETE FROM sessions
			WHERE is_active = 0 AND last_activity < ?
		`)
		const result = stmt.run(cutoffTime)
		console.log(`🗑️  Cleaned up ${result.changes} old sessions`)
		return result.changes
	}

	// 搜索消息
	searchMessages(query: string, limit: number = 50) {
		const stmt = this.db.prepare(`
			SELECT m.*, s.id as session_id
			FROM messages m
			JOIN sessions s ON m.session_id = s.id
			WHERE m.content LIKE ?
			ORDER BY m.timestamp DESC
			LIMIT ?
		`)
		return stmt.all(`%${query}%`, limit)
	}

	// 關閉資料庫
	close() {
		this.db.close()
	}

	// 取得原始資料庫連接（用於進階操作）
	getDb() {
		return this.db
	}

	// Backup 功能
	backup(backupPath: string) {
		try {
			const backupDb = new Database(backupPath, { create: true })
			this.db.run(`VACUUM INTO '${backupPath}'`)
			backupDb.close()
			console.log(`✅ Database backed up to ${backupPath}`)
			return true
		} catch (error) {
			console.error("❌ Backup failed:", error)
			return false
		}
	}
}

// 單例模式
let dbInstance: CCSDKDatabase | null = null

export function getDatabase(dbPath?: string): CCSDKDatabase {
	if (!dbInstance) {
		dbInstance = new CCSDKDatabase(dbPath)
	}
	return dbInstance
}

export function closeDatabase() {
	if (dbInstance) {
		dbInstance.close()
		dbInstance = null
	}
}