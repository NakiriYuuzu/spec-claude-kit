# TypeScript SDK 參考

> Claude Code TypeScript SDK 的完整 API 參考，包含所有函數、類型和介面。

<script src="/components/typescript-sdk-type-links.js" defer />

## 函數

### `query()`

與 Claude Code 互動的主要函數。建立一個非同步產生器，在訊息到達時串流傳輸。

```ts
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query
```

#### 參數

| 參數        | 類型                                                               | 描述                         |
| :-------- | :--------------------------------------------------------------- | :------------------------- |
| `prompt`  | `string \| AsyncIterable<`[`SDKUserMessage`](#sdkusermessage)`>` | 輸入提示，可以是字串或用於串流模式的非同步可迭代物件 |
| `options` | [`Options`](#options)                                            | 可選的配置物件（見下方 Options 類型）    |

#### 回傳值

回傳一個 [`Query`](#query-1) 物件，該物件擴展了 `AsyncGenerator<`[`SDKMessage`](#sdkmessage)`, void>` 並包含額外的方法。

### `tool()`

建立一個類型安全的 MCP 工具定義，用於 SDK MCP 伺服器。

```ts
function tool<Schema extends ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: z.infer<ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>
): SdkMcpToolDefinition<Schema>
```

#### 參數

| 參數            | 類型                                                                | 描述               |
| :------------ | :---------------------------------------------------------------- | :--------------- |
| `name`        | `string`                                                          | 工具的名稱            |
| `description` | `string`                                                          | 工具功能的描述          |
| `inputSchema` | `Schema extends ZodRawShape`                                      | 定義工具輸入參數的 Zod 模式 |
| `handler`     | `(args, extra) => Promise<`[`CallToolResult`](#calltoolresult)`>` | 執行工具邏輯的非同步函數     |

### `createSdkMcpServer()`

建立一個在應用程式相同程序中執行的 MCP 伺服器實例。

```ts
function createSdkMcpServer(options: {
  name: string;
  version?: string;
  tools?: Array<SdkMcpToolDefinition<any>>;
}): McpSdkServerConfigWithInstance
```

#### 參數

| 參數                | 類型                            | 描述                             |
| :---------------- | :---------------------------- | :----------------------------- |
| `options.name`    | `string`                      | MCP 伺服器的名稱                     |
| `options.version` | `string`                      | 可選的版本字串                        |
| `options.tools`   | `Array<SdkMcpToolDefinition>` | 使用 [`tool()`](#tool) 建立的工具定義陣列 |

## 類型

### `Options`

`query()` 函數的配置物件。

| 屬性                           | 類型                                                                                                | 預設值                     | 描述                  |
| :--------------------------- | :------------------------------------------------------------------------------------------------ | :---------------------- | :------------------ |
| `abortController`            | `AbortController`                                                                                 | `new AbortController()` | 用於取消操作的控制器          |
| `additionalDirectories`      | `string[]`                                                                                        | `[]`                    | Claude 可以存取的額外目錄    |
| `allowedTools`               | `string[]`                                                                                        | 所有工具                    | 允許的工具名稱清單           |
| `appendSystemPrompt`         | `string`                                                                                          | `undefined`             | 附加到預設系統提示的文字        |
| `canUseTool`                 | [`CanUseTool`](#canusetool)                                                                       | `undefined`             | 工具使用的自訂權限函數         |
| `continue`                   | `boolean`                                                                                         | `false`                 | 繼續最近的對話             |
| `customSystemPrompt`         | `string`                                                                                          | `undefined`             | 完全替換預設系統提示          |
| `cwd`                        | `string`                                                                                          | `process.cwd()`         | 目前工作目錄              |
| `disallowedTools`            | `string[]`                                                                                        | `[]`                    | 不允許的工具名稱清單          |
| `env`                        | `Dict<string>`                                                                                    | `process.env`           | 環境變數                |
| `executable`                 | `'bun' \| 'deno' \| 'node'`                                                                       | 自動偵測                    | 要使用的 JavaScript 執行時 |
| `executableArgs`             | `string[]`                                                                                        | `[]`                    | 傳遞給執行檔的參數           |
| `extraArgs`                  | `Record<string, string \| null>`                                                                  | `{}`                    | 額外參數                |
| `fallbackModel`              | `string`                                                                                          | `undefined`             | 主要模型失敗時使用的模型        |
| `hooks`                      | `Partial<Record<`[`HookEvent`](#hookevent)`, `[`HookCallbackMatcher`](#hookcallbackmatcher)`[]>>` | `{}`                    | 事件的鉤子回調             |
| `includePartialMessages`     | `boolean`                                                                                         | `false`                 | 包含部分訊息事件            |
| `maxThinkingTokens`          | `number`                                                                                          | `undefined`             | 思考過程的最大 token 數     |
| `maxTurns`                   | `number`                                                                                          | `undefined`             | 最大對話輪數              |
| `mcpServers`                 | `Record<string, [`McpServerConfig`](#mcpserverconfig)>`                                           | `{}`                    | MCP 伺服器配置           |
| `model`                      | `string`                                                                                          | CLI 預設值                 | 要使用的 Claude 模型      |
| `pathToClaudeCodeExecutable` | `string`                                                                                          | 自動偵測                    | Claude Code 執行檔的路徑  |
| `permissionMode`             | [`PermissionMode`](#permissionmode)                                                               | `'default'`             | 會話的權限模式             |
| `permissionPromptToolName`   | `string`                                                                                          | `undefined`             | 權限提示的 MCP 工具名稱      |
| `resume`                     | `string`                                                                                          | `undefined`             | 要恢復的會話 ID           |
| `stderr`                     | `(data: string) => void`                                                                          | `undefined`             | stderr 輸出的回調        |
| `strictMcpConfig`            | `boolean`                                                                                         | `false`                 | 強制執行嚴格的 MCP 驗證      |

### `Query`

由 `query()` 函數回傳的介面。

```ts
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
}
```

#### 方法

| 方法                    | 描述                  |
| :-------------------- | :------------------ |
| `interrupt()`         | 中斷查詢（僅在串流輸入模式下可用）   |
| `setPermissionMode()` | 變更權限模式（僅在串流輸入模式下可用） |

### `PermissionMode`

```ts
type PermissionMode = 
  | 'default'           // 標準權限行為
  | 'acceptEdits'       // 自動接受檔案編輯
  | 'bypassPermissions' // 繞過所有權限檢查
  | 'plan'              // 規劃模式 - 不執行
```

### `CanUseTool`

控制工具使用的自訂權限函數類型。

```ts
type CanUseTool = (
  toolName: string,
  input: ToolInput,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
  }
) => Promise<PermissionResult>;
```

### `PermissionResult`

權限檢查的結果。

```ts
type PermissionResult = 
  | {
      behavior: 'allow';
      updatedInput: ToolInput;
      updatedPermissions?: PermissionUpdate[];
    }
  | {
      behavior: 'deny';
      message: string;
      interrupt?: boolean;
    }
```

### `McpServerConfig`

MCP 伺服器的配置。

```ts
type McpServerConfig = 
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig
  | McpSdkServerConfigWithInstance;
```

#### `McpStdioServerConfig`

```ts
type McpStdioServerConfig = {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
```

#### `McpSSEServerConfig`

```ts
type McpSSEServerConfig = {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}
```

#### `McpHttpServerConfig`

```ts
type McpHttpServerConfig = {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}
```

#### `McpSdkServerConfigWithInstance`

```ts
type McpSdkServerConfigWithInstance = {
  type: 'sdk';
  name: string;
  instance: McpServer;
}
```

## 訊息類型

### `SDKMessage`

查詢回傳的所有可能訊息的聯合類型。

```ts
type SDKMessage = 
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKCompactBoundaryMessage;
```

### `SDKAssistantMessage`

助理回應訊息。

```ts
type SDKAssistantMessage = {
  type: 'assistant';
  uuid: UUID;
  session_id: string;
  message: APIAssistantMessage; // 來自 Anthropic SDK
  parent_tool_use_id: string | null;
}
```

### `SDKUserMessage`

使用者輸入訊息。

```ts
type SDKUserMessage = {
  type: 'user';
  uuid?: UUID;
  session_id: string;
  message: APIUserMessage; // 來自 Anthropic SDK
  parent_tool_use_id: string | null;
}
```

### `SDKUserMessageReplay`

需要 UUID 的重播使用者訊息。

```ts
type SDKUserMessageReplay = {
  type: 'user';
  uuid: UUID;
  session_id: string;
  message: APIUserMessage;
  parent_tool_use_id: string | null;
}
```

### `SDKResultMessage`

最終結果訊息。

```ts
type SDKResultMessage = 
  | {
      type: 'result';
      subtype: 'success';
      uuid: UUID;
      session_id: string;
      duration_ms: number;
      duration_api_ms: number;
      is_error: boolean;
      num_turns: number;
      result: string;
      total_cost_usd: number;
      usage: NonNullableUsage;
      permission_denials: SDKPermissionDenial[];
    }
  | {
      type: 'result';
      subtype: 'error_max_turns' | 'error_during_execution';
      uuid: UUID;
      session_id: string;
      duration_ms: number;
      duration_api_ms: number;
      is_error: boolean;
      num_turns: number;
      total_cost_usd: number;
      usage: NonNullableUsage;
      permission_denials: SDKPermissionDenial[];
    }
```

### `SDKSystemMessage`

系統初始化訊息。

```ts
type SDKSystemMessage = {
  type: 'system';
  subtype: 'init';
  uuid: UUID;
  session_id: string;
  apiKeySource: ApiKeySource;
  cwd: string;
  tools: string[];
  mcp_servers: {
    name: string;
    status: string;
  }[];
  model: string;
  permissionMode: PermissionMode;
  slash_commands: string[];
  output_style: string;
}
```

### `SDKPartialAssistantMessage`

串流部分訊息（僅當 `includePartialMessages` 為 true 時）。

```ts
type SDKPartialAssistantMessage = {
  type: 'stream_event';
  event: RawMessageStreamEvent; // 來自 Anthropic SDK
  parent_tool_use_id: string | null;
  uuid: UUID;
  session_id: string;
}
```

### `SDKCompactBoundaryMessage`

表示對話壓縮邊界的訊息。

```ts
type SDKCompactBoundaryMessage = {
  type: 'system';
  subtype: 'compact_boundary';
  uuid: UUID;
  session_id: string;
  compact_metadata: {
    trigger: 'manual' | 'auto';
    pre_tokens: number;
  };
}
```

### `SDKPermissionDenial`

被拒絕的工具使用資訊。

```ts
type SDKPermissionDenial = {
  tool_name: string;
  tool_use_id: string;
  tool_input: ToolInput;
}
```

## 鉤子類型

### `HookEvent`

可用的鉤子事件。

```ts
type HookEvent = 
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop'
  | 'SubagentStop'
  | 'PreCompact';
```

### `HookCallback`

鉤子回調函數類型。

```ts
type HookCallback = (
  input: HookInput, // 所有鉤子輸入類型的聯合
  toolUseID: string | undefined,
  options: { signal: AbortSignal }
) => Promise<HookJSONOutput>;
```

### `HookCallbackMatcher`

帶有可選匹配器的鉤子配置。

```ts
interface HookCallbackMatcher {
  matcher?: string;
  hooks: HookCallback[];
}
```

### `HookInput`

所有鉤子輸入類型的聯合類型。

```ts
type HookInput = 
  | PreToolUseHookInput
  | PostToolUseHookInput
  | NotificationHookInput
  | UserPromptSubmitHookInput
  | SessionStartHookInput
  | SessionEndHookInput
  | StopHookInput
  | SubagentStopHookInput
  | PreCompactHookInput;
```

### `BaseHookInput`

所有鉤子輸入類型擴展的基礎介面。

```ts
type BaseHookInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
}
```

#### `PreToolUseHookInput`

```ts
type PreToolUseHookInput = BaseHookInput & {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: ToolInput;
}
```

#### `PostToolUseHookInput`

```ts
type PostToolUseHookInput = BaseHookInput & {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: ToolInput;
  tool_response: ToolOutput;
}
```

#### `NotificationHookInput`

```ts
type NotificationHookInput = BaseHookInput & {
  hook_event_name: 'Notification';
  message: string;
  title?: string;
}
```

#### `UserPromptSubmitHookInput`

```ts
type UserPromptSubmitHookInput = BaseHookInput & {
  hook_event_name: 'UserPromptSubmit';
  prompt: string;
}
```

#### `SessionStartHookInput`

```ts
type SessionStartHookInput = BaseHookInput & {
  hook_event_name: 'SessionStart';
  source: 'startup' | 'resume' | 'clear' | 'compact';
}
```

#### `SessionEndHookInput`

```ts
type SessionEndHookInput = BaseHookInput & {
  hook_event_name: 'SessionEnd';
  reason: 'clear' | 'logout' | 'prompt_input_exit' | 'other';
}
```

#### `StopHookInput`

```ts
type StopHookInput = BaseHookInput & {
  hook_event_name: 'Stop';
  stop_hook_active: boolean;
}
```

#### `SubagentStopHookInput`

```ts
type SubagentStopHookInput = BaseHookInput & {
  hook_event_name: 'SubagentStop';
  stop_hook_active: boolean;
}
```

#### `PreCompactHookInput`

```ts
type PreCompactHookInput = BaseHookInput & {
  hook_event_name: 'PreCompact';
  trigger: 'manual' | 'auto';
  custom_instructions: string | null;
}
```

### `HookJSONOutput`

鉤子回傳值。

```ts
type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput;
```

#### `AsyncHookJSONOutput`

```ts
type AsyncHookJSONOutput = {
  async: true;
  asyncTimeout?: number;
}
```

#### `SyncHookJSONOutput`

```ts
type SyncHookJSONOutput = {
  continue?: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  decision?: 'approve' | 'block';
  systemMessage?: string;
  reason?: string;
  hookSpecificOutput?:
    | {
        hookEventName: 'PreToolUse';
        permissionDecision?: 'allow' | 'deny' | 'ask';
        permissionDecisionReason?: string;
      }
    | {
        hookEventName: 'UserPromptSubmit';
        additionalContext?: string;
      }
    | {
        hookEventName: 'SessionStart';
        additionalContext?: string;
      }
    | {
        hookEventName: 'PostToolUse';
        additionalContext?: string;
      };
}
```

## 工具輸入類型

所有內建 Claude Code 工具的輸入模式文件。這些類型從 `@anthropic/claude-code-sdk` 匯出，可用於類型安全的工具互動。

### `ToolInput`

**注意：** 這是一個僅用於文件的類型，用於清晰說明。它代表所有工具輸入類型的聯合。

```ts
type ToolInput = 
  | AgentInput
  | BashInput
  | BashOutputInput
  | FileEditInput
  | FileMultiEditInput
  | FileReadInput
  | FileWriteInput
  | GlobInput
  | GrepInput
  | KillShellInput
  | NotebookEditInput
  | WebFetchInput
  | WebSearchInput
  | TodoWriteInput
  | ExitPlanModeInput
  | ListMcpResourcesInput
  | ReadMcpResourceInput;
```

### Task

**工具名稱：** `Task`

```ts
interface AgentInput {
  /**
   * 任務的簡短（3-5 個詞）描述
   */
  description: string;
  /**
   * 代理要執行的任務
   */
  prompt: string;
  /**
   * 用於此任務的專門代理類型
   */
  subagent_type: string;
}
```

啟動新代理來自主處理複雜的多步驟任務。

### Bash

**工具名稱：** `Bash`

```ts
interface BashInput {
  /**
   * 要執行的命令
   */
  command: string;
  /**
   * 可選的超時時間（毫秒，最大 600000）
   */
  timeout?: number;
  /**
   * 此命令功能的清晰、簡潔描述（5-10 個詞）
   */
  description?: string;
  /**
   * 設為 true 以在背景執行此命令
   */
  run_in_background?: boolean;
}
```

在持續的 shell 會話中執行 bash 命令，支援可選的超時和背景執行。

### BashOutput

**工具名稱：** `BashOutput`

```ts
interface BashOutputInput {
  /**
   * 要檢索輸出的背景 shell ID
   */
  bash_id: string;
  /**
   * 可選的正規表達式來過濾輸出行
   */
  filter?: string;
}
```

從執行中或已完成的背景 bash shell 檢索輸出。

### Edit

**工具名稱：** `Edit`

```ts
interface FileEditInput {
  /**
   * 要修改的檔案的絕對路徑
   */
  file_path: string;
  /**
   * 要替換的文字
   */
  old_string: string;
  /**
   * 要替換成的文字（必須與 old_string 不同）
   */
  new_string: string;
  /**
   * 替換所有 old_string 的出現（預設 false）
   */
  replace_all?: boolean;
}
```

在檔案中執行精確的字串替換。

### MultiEdit

**工具名稱：** `MultiEdit`

```ts
interface FileMultiEditInput {
  /**
   * 要修改的檔案的絕對路徑
   */
  file_path: string;
  /**
   * 要依序執行的編輯操作陣列
   */
  edits: Array<{
    /**
     * 要替換的文字
     */
    old_string: string;
    /**
     * 要替換成的文字
     */
    new_string: string;
    /**
     * 替換所有出現（預設 false）
     */
    replace_all?: boolean;
  }>;
}
```

在一次操作中對單一檔案進行多次編輯。

### Read

**工具名稱：** `Read`

```ts
interface FileReadInput {
  /**
   * 要讀取的檔案的絕對路徑
   */
  file_path: string;
  /**
   * 開始讀取的行號
   */
  offset?: number;
  /**
   * 要讀取的行數
   */
  limit?: number;
}
```

從本地檔案系統讀取檔案，包括文字、圖片、PDF 和 Jupyter notebook。

### Write

**工具名稱：** `Write`

```ts
interface FileWriteInput {
  /**
   * 要寫入的檔案的絕對路徑
   */
  file_path: string;
  /**
   * 要寫入檔案的內容
   */
  content: string;
}
```

將檔案寫入本地檔案系統，如果存在則覆寫。

### Glob

**工具名稱：** `Glob`

```ts
interface GlobInput {
  /**
   * 用於匹配檔案的 glob 模式
   */
  pattern: string;
  /**
   * 要搜尋的目錄（預設為 cwd）
   */
  path?: string;
}
```

快速檔案模式匹配，適用於任何程式碼庫大小。

### Grep

**工具名稱：** `Grep`

```ts
interface GrepInput {
  /**
   * 要搜尋的正規表達式模式
   */
  pattern: string;
  /**
   * 要搜尋的檔案或目錄（預設為 cwd）
   */
  path?: string;
  /**
   * 過濾檔案的 Glob 模式（例如 "*.js"）
   */
  glob?: string;
  /**
   * 要搜尋的檔案類型（例如 "js", "py", "rust"）
   */
  type?: string;
  /**
   * 輸出模式："content", "files_with_matches", 或 "count"
   */
  output_mode?: 'content' | 'files_with_matches' | 'count';
  /**
   * 不區分大小寫搜尋
   */
  '-i'?: boolean;
  /**
   * 顯示行號（用於內容模式）
   */
  '-n'?: boolean;
  /**
   * 每個匹配前顯示的行數
   */
  '-B'?: number;
  /**
   * 每個匹配後顯示的行數
   */
  '-A'?: number;
  /**
   * 每個匹配前後顯示的行數
   */
  '-C'?: number;
  /**
   * 限制輸出為前 N 行/項目
   */
  head_limit?: number;
  /**
   * 啟用多行模式
   */
  multiline?: boolean;
}
```

基於 ripgrep 構建的強大搜尋工具，支援正規表達式。

### KillBash

**工具名稱：** `KillBash`

```ts
interface KillShellInput {
  /**
   * 要終止的背景 shell ID
   */
  shell_id: string;
}
```

根據 ID 終止執行中的背景 bash shell。

### NotebookEdit

**工具名稱：** `NotebookEdit`

```ts
interface NotebookEditInput {
  /**
   * Jupyter notebook 檔案的絕對路徑
   */
  notebook_path: string;
  /**
   * 要編輯的儲存格 ID
   */
  cell_id?: string;
  /**
   * 儲存格的新來源
   */
  new_source: string;
  /**
   * 儲存格的類型（code 或 markdown）
   */
  cell_type?: 'code' | 'markdown';
  /**
   * 編輯的類型（replace, insert, delete）
   */
  edit_mode?: 'replace' | 'insert' | 'delete';
}
```

編輯 Jupyter notebook 檔案中的儲存格。

### WebFetch

**工具名稱：** `WebFetch`

```ts
interface WebFetchInput {
  /**
   * 要擷取內容的 URL
   */
  url: string;
  /**
   * 在擷取的內容上執行的提示
   */
  prompt: string;
}
```

從 URL 擷取內容並使用 AI 模型處理。

### WebSearch

**工具名稱：** `WebSearch`

```ts
interface WebSearchInput {
  /**
   * 要使用的搜尋查詢
   */
  query: string;
  /**
   * 僅包含來自這些網域的結果
   */
  allowed_domains?: string[];
  /**
   * 永不包含來自這些網域的結果
   */
  blocked_domains?: string[];
}
```

搜尋網路並回傳格式化的結果。

### TodoWrite

**工具名稱：** `TodoWrite`

```ts
interface TodoWriteInput {
  /**
   * 更新的待辦事項清單
   */
  todos: Array<{
    /**
     * 任務描述
     */
    content: string;
    /**
     * 任務狀態
     */
    status: 'pending' | 'in_progress' | 'completed';
    /**
     * 任務描述的主動形式
     */
    activeForm: string;
  }>;
}
```

建立和管理結構化的任務清單以追蹤進度。

### ExitPlanMode

**工具名稱：** `ExitPlanMode`

```ts
interface ExitPlanModeInput {
  /**
   * 要由使用者執行以供批准的計劃
   */
  plan: string;
}
```

退出規劃模式並提示使用者批准計劃。

### ListMcpResources

**工具名稱：** `ListMcpResources`

```ts
interface ListMcpResourcesInput {
  /**
   * 可選的伺服器名稱來過濾資源
   */
  server?: string;
}
```

列出連接伺服器的可用 MCP 資源。

### ReadMcpResource

**工具名稱：** `ReadMcpResource`

```ts
interface ReadMcpResourceInput {
  /**
   * MCP 伺服器名稱
   */
  server: string;
  /**
   * 要讀取的資源 URI
   */
  uri: string;
}
```

從伺服器讀取特定的 MCP 資源。

## 工具輸出類型

所有內建 Claude Code 工具的輸出模式文件。這些類型代表每個工具回傳的實際回應資料。

### `ToolOutput`

**注意：** 這是一個僅用於文件的類型，用於清晰說明。它代表所有工具輸出類型的聯合。

```ts
type ToolOutput = 
  | TaskOutput
  | BashOutput
  | BashOutputToolOutput
  | EditOutput
  | MultiEditOutput
  | ReadOutput
  | WriteOutput
  | GlobOutput
  | GrepOutput
  | KillBashOutput
  | NotebookEditOutput
  | WebFetchOutput
  | WebSearchOutput
  | TodoWriteOutput
  | ExitPlanModeOutput
  | ListMcpResourcesOutput
  | ReadMcpResourceOutput;
```

### Task

**工具名稱：** `Task`

```ts
interface TaskOutput {
  /**
   * 來自子代理的最終結果訊息
   */
  result: string;
  /**
   * Token 使用統計
   */
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  /**
   * 總成本（美元）
   */
  total_cost_usd?: number;
  /**
   * 執行持續時間（毫秒）
   */
  duration_ms?: number;
}
```

在完成委派任務後回傳來自子代理的最終結果。

### Bash

**工具名稱：** `Bash`

```ts
interface BashOutput {
  /**
   * 合併的 stdout 和 stderr 輸出
   */
  output: string;
  /**
   * 命令的退出代碼
   */
  exitCode: number;
  /**
   * 命令是否因超時而被終止
   */
  killed?: boolean;
  /**
   * 背景程序的 Shell ID
   */
  shellId?: string;
}
```

回傳帶有退出狀態的命令輸出。背景命令立即回傳 shellId。

### BashOutput

**工具名稱：** `BashOutput`

```ts
interface BashOutputToolOutput {
  /**
   * 自上次檢查以來的新輸出
   */
  output: string;
  /**
   * 目前 shell 狀態
   */
  status: 'running' | 'completed' | 'failed';
  /**
   * 退出代碼（完成時）
   */
  exitCode?: number;
}
```

回傳來自背景 shell 的增量輸出。

### Edit

**工具名稱：** `Edit`

```ts
interface EditOutput {
  /**
   * 確認訊息
   */
  message: string;
  /**
   * 進行的替換次數
   */
  replacements: number;
  /**
   * 被編輯的檔案路徑
   */
  file_path: string;
}
```

回傳成功編輯的確認和替換次數。

### MultiEdit

**工具名稱：** `MultiEdit`

```ts
interface MultiEditOutput {
  /**
   * 成功訊息
   */
  message: string;
  /**
   * 應用的編輯總數
   */
  edits_applied: number;
  /**
   * 被編輯的檔案路徑
   */
  file_path: string;
}
```

在依序應用所有編輯後回傳確認。

### Read

**工具名稱：** `Read`

```ts
type ReadOutput = 
  | TextFileOutput
  | ImageFileOutput
  | PDFFileOutput
  | NotebookFileOutput;

interface TextFileOutput {
  /**
   * 帶有行號的檔案內容
   */
  content: string;
  /**
   * 檔案中的總行數
   */
  total_lines: number;
  /**
   * 實際回傳的行數
   */
  lines_returned: number;
}

interface ImageFileOutput {
  /**
   * Base64 編碼的圖片資料
   */
  image: string;
  /**
   * 圖片 MIME 類型
   */
  mime_type: string;
  /**
   * 檔案大小（位元組）
   */
  file_size: number;
}

interface PDFFileOutput {
  /**
   * 頁面內容陣列
   */
  pages: Array<{
    page_number: number;
    text?: string;
    images?: Array<{
      image: string;
      mime_type: string;
    }>;
  }>;
  /**
   * 總頁數
   */
  total_pages: number;
}

interface NotebookFileOutput {
  /**
   * Jupyter notebook 儲存格
   */
  cells: Array<{
    cell_type: 'code' | 'markdown';
    source: string;
    outputs?: any[];
    execution_count?: number;
  }>;
  /**
   * Notebook 元資料
   */
  metadata?: Record<string, any>;
}
```

以適合檔案類型的格式回傳檔案內容。

### Write

**工具名稱：** `Write`

```ts
interface WriteOutput {
  /**
   * 成功訊息
   */
  message: string;
  /**
   * 寫入的位元組數
   */
  bytes_written: number;
  /**
   * 被寫入的檔案路徑
   */
  file_path: string;
}
```

在成功寫入檔案後回傳確認。

### Glob

**工具名稱：** `Glob`

```ts
interface GlobOutput {
  /**
   * 匹配的檔案路徑陣列
   */
  matches: string[];
  /**
   * 找到的匹配數量
   */
  count: number;
  /**
   * 使用的搜尋目錄
   */
  search_path: string;
}
```

回傳匹配 glob 模式的檔案路徑，按修改時間排序。

### Grep

**工具名稱：** `Grep`

```ts
type GrepOutput = 
  | GrepContentOutput
  | GrepFilesOutput
  | GrepCountOutput;

interface GrepContentOutput {
  /**
   * 帶有上下文的匹配行
   */
  matches: Array<{
    file: string;
    line_number?: number;
    line: string;
    before_context?: string[];
    after_context?: string[];
  }>;
  /**
   * 總匹配數
   */
  total_matches: number;
}

interface GrepFilesOutput {
  /**
   * 包含匹配的檔案
   */
  files: string[];
  /**
   * 有匹配的檔案數量
   */
  count: number;
}

interface GrepCountOutput {
  /**
   * 每個檔案的匹配計數
   */
  counts: Array<{
    file: string;
    count: number;
  }>;
  /**
   * 所有檔案的總匹配數
   */
  total: number;
}
```

以 output\_mode 指定的格式回傳搜尋結果。

### KillBash

**工具名稱：** `KillBash`

```ts
interface KillBashOutput {
  /**
   * 成功訊息
   */
  message: string;
  /**
   * 被終止的 shell ID
   */
  shell_id: string;
}
```

在終止背景 shell 後回傳確認。

### NotebookEdit

**工具名稱：** `NotebookEdit`

```ts
interface NotebookEditOutput {
  /**
   * 成功訊息
   */
  message: string;
  /**
   * 執行的編輯類型
   */
  edit_type: 'replaced' | 'inserted' | 'deleted';
  /**
   * 受影響的儲存格 ID
   */
  cell_id?: string;
  /**
   * 編輯後 notebook 中的總儲存格數
   */
  total_cells: number;
}
```

在修改 Jupyter notebook 後回傳確認。

### WebFetch

**工具名稱：** `WebFetch`

```ts
interface WebFetchOutput {
  /**
   * AI 模型對提示的回應
   */
  response: string;
  /**
   * 被擷取的 URL
   */
  url: string;
  /**
   * 重新導向後的最終 URL
   */
  final_url?: string;
  /**
   * HTTP 狀態碼
   */
  status_code?: number;
}
```

回傳 AI 對擷取的網頁內容的分析。

### WebSearch

**工具名稱：** `WebSearch`

```ts
interface WebSearchOutput {
  /**
   * 搜尋結果
   */
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    /**
     * 額外的元資料（如果可用）
     */
    metadata?: Record<string, any>;
  }>;
  /**
   * 總結果數
   */
  total_results: number;
  /**
   * 被搜尋的查詢
   */
  query: string;
}
```

回傳來自網路的格式化搜尋結果。

### TodoWrite

**工具名稱：** `TodoWrite`

```ts
interface TodoWriteOutput {
  /**
   * 成功訊息
   */
  message: string;
  /**
   * 目前待辦事項統計
   */
  stats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
}
```

回傳帶有目前任務統計的確認。

### ExitPlanMode

**工具名稱：** `ExitPlanMode`

```ts
interface ExitPlanModeOutput {
  /**
   * 確認訊息
   */
  message: string;
  /**
   * 使用者是否批准了計劃
   */
  approved?: boolean;
}
```

在退出計劃模式後回傳確認。

### ListMcpResources

**工具名稱：** `ListMcpResources`

```ts
interface ListMcpResourcesOutput {
  /**
   * 可用資源
   */
  resources: Array<{
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
    server: string;
  }>;
  /**
   * 總資源數
   */
  total: number;
}
```

回傳可用 MCP 資源的清單。

### ReadMcpResource

**工具名稱：** `ReadMcpResource`

```ts
interface ReadMcpResourceOutput {
  /**
   * 資源內容
   */
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
  /**
   * 提供資源的伺服器
   */
  server: string;
}
```

回傳請求的 MCP 資源內容。

## 權限類型

### `PermissionUpdate`

更新權限的操作。

```ts
type PermissionUpdate = 
  | {
      type: 'addRules';
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
    }
  | {
      type: 'replaceRules';
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
    }
  | {
      type: 'removeRules';
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
    }
  | {
      type: 'setMode';
      mode: PermissionMode;
      destination: PermissionUpdateDestination;
    }
  | {
      type: 'addDirectories';
      directories: string[];
      destination: PermissionUpdateDestination;
    }
  | {
      type: 'removeDirectories';
      directories: string[];
      destination: PermissionUpdateDestination;
    }
```

### `PermissionBehavior`

```ts
type PermissionBehavior = 'allow' | 'deny' | 'ask';
```

### `PermissionUpdateDestination`

```ts
type PermissionUpdateDestination = 
  | 'userSettings'     // 全域使用者設定
  | 'projectSettings'  // 每個目錄的專案設定
  | 'localSettings'    // Gitignored 本地設定
  | 'session'          // 僅目前會話
```

### `PermissionRuleValue`

```ts
type PermissionRuleValue = {
  toolName: string;
  ruleContent?: string;
}
```

## 其他類型

### `ApiKeySource`

```ts
type ApiKeySource = 'user' | 'project' | 'org' | 'temporary';
```

### `ConfigScope`

```ts
type ConfigScope = 'local' | 'user' | 'project';
```

### `NonNullableUsage`

[`Usage`](#usage) 的版本，所有可為空的欄位都變為不可為空。

```ts
type NonNullableUsage = {
  [K in keyof Usage]: NonNullable<Usage[K]>;
}
```

### `Usage`

Token 使用統計（來自 `@anthropic-ai/sdk`）。

```ts
type Usage = {
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}
```

### `CallToolResult`

MCP 工具結果類型（來自 `@modelcontextprotocol/sdk/types.js`）。

```ts
type CallToolResult = {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    // 額外欄位因類型而異
  }>;
  isError?: boolean;
}
```

### `AbortError`

中止操作的自訂錯誤類別。

```ts
class AbortError extends Error {}
```

## 另請參閱

* [SDK 概述](/zh-TW/docs/claude-code/sdk/sdk-overview) - 一般 SDK 概念
* [Python SDK 參考](/zh-TW/docs/claude-code/sdk/sdk-python) - Python SDK 文件
* [CLI 參考](/zh-TW/docs/claude-code/cli-reference) - 命令列介面
* [常見工作流程](/zh-TW/docs/claude-code/common-workflows) - 逐步指南
