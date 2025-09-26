/**
 * ElysiaJS WebSocket Adapter
 *
 * This adapter provides a bridge between ElysiaJS native WebSocket
 * and the existing WebSocketHandler implementation
 */

// ElysiaJS WebSocket type - using the actual ws object from Elysia
export interface ElysiaWebSocket {
	send: (data: string | ArrayBuffer | Uint8Array) => void
	close: (code?: number, reason?: string) => void
	subscribe?: (channel: string) => void
	publish?: (channel: string, data: string | ArrayBuffer | Uint8Array) => void
	unsubscribe?: (channel: string) => void
	isSubscribed?: (channel: string) => boolean
	data: any
	id?: string | number
}

// Adapter to make ElysiaJS WebSocket compatible with WSClient interface
export class ElysiaWebSocketAdapter {
	private ws: ElysiaWebSocket

	constructor(ws: ElysiaWebSocket) {
		this.ws = ws
		// Initialize data if not exists
		if (!this.ws.data) {
			this.ws.data = {}
		}
	}

	// WSClient compatible interface
	send(data: string): void {
		try {
			this.ws.send(data)
		} catch (error) {
			console.error('Failed to send WebSocket message:', error)
		}
	}

	close(code?: number, reason?: string): void {
		this.ws.close(code, reason)
	}

	get data(): any {
		return this.ws.data
	}

	set data(value: any) {
		this.ws.data = value
	}

	// Subscribe to a channel (if supported)
	subscribe(channel: string): void {
		if (this.ws.subscribe) {
			this.ws.subscribe(channel)
		}
	}

	// Publish to a channel (if supported)
	publish(channel: string, data: string): void {
		if (this.ws.publish) {
			this.ws.publish(channel, data)
		}
	}

	// Check subscription status
	isSubscribed(channel: string): boolean {
		if (this.ws.isSubscribed) {
			return this.ws.isSubscribed(channel)
		}
		return false
	}

	// Get the underlying ElysiaJS WebSocket
	getOriginalWs(): ElysiaWebSocket {
		return this.ws
	}
}

// Factory function to create adapter
export function createElysiaWSAdapter(ws: any): ElysiaWebSocketAdapter {
	return new ElysiaWebSocketAdapter(ws as ElysiaWebSocket)
}