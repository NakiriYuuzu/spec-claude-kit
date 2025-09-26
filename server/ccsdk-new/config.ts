import type { AIQueryOptions } from "./types"

// Default configuration for Claude Code SDK
export const defaultConfig: AIQueryOptions = {
	maxTurns: 100,
	model: "sonnet",
	cwd: process.cwd(),
	allowedTools: [
		"Task",
		"Bash",
		"Glob",
		"Grep",
		"Read",
		"Edit",
		"MultiEdit",
		"Write",
		"NotebookEdit",
		"WebFetch",
		"TodoWrite",
		"WebSearch",
		"BashOutput",
		"KillShell",
		"ExitPlanMode"
	],
	appendSystemPrompt: `You are a helpful AI assistant integrated with a web application.
You can help users with coding, debugging, and various development tasks.
When appropriate, use the available tools to accomplish tasks efficiently.`,
	mcpServers: {},
	permissionMode: "default",
	includePartialMessages: false
}

// Load configuration from environment variables or config file
export function loadConfig(): AIQueryOptions {
	const config = { ...defaultConfig }

	// Override with environment variables if available
	if (process.env.CLAUDE_MODEL) {
		config.model = process.env.CLAUDE_MODEL
	}

	if (process.env.CLAUDE_MAX_TURNS) {
		config.maxTurns = parseInt(process.env.CLAUDE_MAX_TURNS, 10)
	}

	if (process.env.CLAUDE_CWD) {
		config.cwd = process.env.CLAUDE_CWD
	}

	if (process.env.CLAUDE_PERMISSION_MODE) {
		config.permissionMode = process.env.CLAUDE_PERMISSION_MODE as any
	}

	return config
}