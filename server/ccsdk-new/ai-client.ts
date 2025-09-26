import { query } from "@anthropic-ai/claude-code"
import type { SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-code"
import type { AIQueryOptions, QueryResult } from "./types"

export class AIClient {
	private defaultOptions: AIQueryOptions

	constructor(options?: Partial<AIQueryOptions>) {
		this.defaultOptions = {
			maxTurns: 100,
			cwd: process.cwd(),
			model: "sonnet",
			allowedTools: [
				"Task", "Bash", "Glob", "Grep", "Read", "Edit", "MultiEdit",
				"Write", "NotebookEdit", "WebFetch", "TodoWrite", "WebSearch",
				"BashOutput", "KillShell", "ExitPlanMode"
			],
			appendSystemPrompt: "You are a helpful AI assistant that helps with coding tasks.",
			mcpServers: {},
			permissionMode: "default",
			includePartialMessages: false,
			resume: undefined,
			continue: undefined,
			...options
		}
	}

	async* queryStream(
		prompt: string | AsyncIterable<SDKUserMessage>,
		options?: Partial<AIQueryOptions>
	): AsyncIterable<SDKMessage> {
		const mergedOptions = { ...this.defaultOptions, ...options }

		// Convert permission mode if needed
		if (mergedOptions.permissionMode === "acceptEdits") {
			// @ts-ignore - This is valid in Claude Code SDK
			mergedOptions.acceptEdits = true
		} else if (mergedOptions.permissionMode === "bypassPermissions") {
			// @ts-ignore
			mergedOptions.bypassPermissions = true
		} else if (mergedOptions.permissionMode === "plan") {
			// @ts-ignore
			mergedOptions.plan = true
		}

		for await (const message of query({
			prompt,
			options: mergedOptions as any
		})) {
			yield message
		}
	}

	async querySingle(prompt: string, options?: Partial<AIQueryOptions>): Promise<QueryResult> {
		const messages: SDKMessage[] = []
		let totalCost = 0
		let duration = 0

		for await (const message of this.queryStream(prompt, options)) {
			messages.push(message)

			if (message.type === "result" && message.subtype === "success") {
				totalCost = message.total_cost_usd || 0
				duration = message.duration_ms || 0
			}
		}

		return { messages, cost: totalCost, duration }
	}

	// Update default options
	setDefaultOptions(options: Partial<AIQueryOptions>) {
		this.defaultOptions = { ...this.defaultOptions, ...options }
	}

	// Get current options
	getOptions(): AIQueryOptions {
		return { ...this.defaultOptions }
	}
}