# Claude Code SDK Integration for ElysiaJS

This module provides a clean integration of the Claude Code SDK with ElysiaJS, enabling real-time AI-powered assistance through WebSocket connections.

## Features

- **WebSocket Support**: Real-time bidirectional communication with Claude
- **Session Management**: Multiple concurrent sessions with isolated contexts
- **REST API**: Alternative HTTP endpoints for simple queries
- **Type Safety**: Full TypeScript support
- **Configurable**: Environment-based configuration

## Architecture

### Core Components

1. **AIClient** (`ai-client.ts`)
   - Wrapper around Claude Code SDK
   - Handles streaming and single queries
   - Manages default options and permissions

2. **Session** (`session.ts`)
   - Manages individual conversation contexts
   - Handles message streaming to subscribers
   - Maintains conversation history

3. **WebSocketHandler** (`websocket-handler.ts`)
   - Manages WebSocket connections
   - Routes messages to appropriate sessions
   - Handles client subscriptions

4. **MessageQueue** (`message-queue.ts`)
   - Async message queue implementation
   - Ensures ordered message processing

## API Endpoints

### WebSocket
- `/api/ccsdk/ws` - Main WebSocket endpoint

### REST API
- `GET /api/ccsdk/sessions` - List active sessions
- `POST /api/ccsdk/query` - Send a single query
- `GET /api/ccsdk/config` - Get current configuration
- `GET /api/ccsdk/health` - Health check

## WebSocket Message Types

### Client to Server
```typescript
// Start a chat
{
  type: "chat",
  content: "Your message here",
  sessionId?: "optional-session-id",
  newConversation?: boolean
}

// Subscribe to a session
{
  type: "subscribe",
  sessionId: "session-id"
}

// Unsubscribe from a session
{
  type: "unsubscribe",
  sessionId: "session-id"
}

// Get system information
{
  type: "system_info"
}
```

### Server to Client
```typescript
// Assistant response
{
  type: "assistant_message",
  content: "Claude's response",
  sessionId: "session-id"
}

// Tool usage notification
{
  type: "tool_use",
  toolName: "tool-name",
  toolId: "tool-id",
  toolInput: {},
  sessionId: "session-id"
}

// Result message
{
  type: "result",
  success: true,
  result: "Final result",
  cost: 0.001,
  duration: 1000,
  sessionId: "session-id"
}
```

## Configuration

Set these environment variables to customize behavior:

- `CLAUDE_MODEL` - Model to use (default: "sonnet")
- `CLAUDE_MAX_TURNS` - Maximum conversation turns (default: 100)
- `CLAUDE_CWD` - Working directory for Claude
- `CLAUDE_PERMISSION_MODE` - Permission mode: "default", "acceptEdits", "bypassPermissions", "plan"

## Usage Example

```typescript
import { Elysia } from "elysia";
import { useCCSDKRoutes } from "./ccsdk-new/routes";

const app = new Elysia()
  .use(useCCSDKRoutes)
  .listen(3000);
```

## Client Example

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/api/ccsdk/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

// Send a chat message
ws.send(JSON.stringify({
  type: 'chat',
  content: 'Help me write a TypeScript function'
}));
```