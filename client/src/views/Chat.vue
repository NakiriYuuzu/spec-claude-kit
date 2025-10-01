<script setup lang="ts">
    import { ref, nextTick, watch, onMounted } from 'vue'
    import { useChatStore } from '@/stores'
    import { useMarkdown } from '@/composables/useMarkdown'
    import type { Message, SystemInitData } from '@/types/chat'
    import { Button } from '@/components/ui/button'
    import { Textarea } from '@/components/ui/textarea'
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
    import { Badge } from '@/components/ui/badge'
    import { Send, StopCircle, Trash2 } from 'lucide-vue-next'
    
    const chatStore = useChatStore()
    const { renderMarkdown, addCopyButtons } = useMarkdown()

    const messagesContainer = ref<HTMLElement | null>(null)
    const textareaRef = ref<any>(null)
    
    // 自動滾動到最新訊息
    function scrollToBottom() {
        nextTick(() => {
            if (messagesContainer.value) {
                messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
            }
        })
    }
    
    // 當訊息變化時滾動
    watch(() => chatStore.currentMessages.length, () => {
        scrollToBottom()
    })
    
    // 當打字狀態變化時滾動
    watch(() => chatStore.isTyping, () => {
        scrollToBottom()
    })
    
    // 自動調整 textarea 高度
    function adjustTextareaHeight() {
        if (!textareaRef.value?.$el) return

        const textarea = textareaRef.value.$el
        textarea.style.height = 'auto'
        const newHeight = Math.min(textarea.scrollHeight, 120)
        textarea.style.height = newHeight + 'px'
    }

    watch(() => chatStore.inputText, () => {
        nextTick(() => {
            adjustTextareaHeight()
        })
    })
    
    // 處理鍵盤事件
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            handleSend()
        }
    }
    
    // 發送訊息
    function handleSend() {
        if (!chatStore.inputText.trim() || !chatStore.isConnected || chatStore.isTyping) return

        chatStore.sendMessage(chatStore.inputText)

        nextTick(() => {
            if (textareaRef.value?.$el) {
                textareaRef.value.$el.style.height = 'auto'
            }
        })
    }
    
    // 取消查詢
    function handleCancel() {
        chatStore.cancelQuery()
    }
    
    // 清除訊息
    function handleClear() {
        chatStore.clearMessages()
    }
    
    // 格式化時間
    function formatTime(timestamp: number) {
        const date = new Date(timestamp)
        return date.toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
        })
    }
    
    // 渲染訊息內容
    function renderMessageContent(message: Message): string {
        if (message.type === 'assistant' && message.content) {
            return renderMarkdown(message.content)
        }
        return message.content || ''
    }
    
    // 檢查訊息是否為系統初始化訊息
    function isSystemInit(message: Message): boolean {
        return message.type === 'system' && message.subtype === 'init'
    }
    
    // 獲取系統初始化資料
    function getSystemInitData(message: Message): SystemInitData | null {
        if (!isSystemInit(message) || !message.metadata) return null
        return message.metadata as SystemInitData
    }
    
    // 渲染後添加複製按鈕
    function handleMessageRendered(el: HTMLElement) {
        nextTick(() => {
            addCopyButtons(el)
        })
    }
    
    onMounted(() => {
        scrollToBottom()
    })
</script>

<template>
    <div class="flex flex-col h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
        <!-- 訊息區域 -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 pb-4">
            <!-- 歡迎訊息 -->
            <div v-if="chatStore.currentMessages.length === 0" class="flex items-center justify-center h-full">
                <div class="text-center space-y-4">
                    <div class="text-4xl">🤖</div>
                    <div class="text-xl font-semibold text-gray-700 dark:text-gray-300">
                        Claude WebSocket Chat
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                        {{ chatStore.isConnected ? '開始聊天吧！' : '請等待連接...' }}
                    </div>
                </div>
            </div>
            
            <!-- 訊息列表 -->
            <div
                v-for="(message, index) in chatStore.currentMessages"
                :key="index"
                class="flex"
                :class="{
          'justify-end': message.type === 'user',
          'justify-start': message.type !== 'user',
        }"
            >
                <!-- 使用者訊息 -->
                <div
                    v-if="message.type === 'user'"
                    class="max-w-[70%] rounded-xl p-3 md:p-4 bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md animate-in slide-in-from-bottom-2 duration-300"
                >
                    <div class="whitespace-pre-wrap break-words">{{ message.content }}</div>
                    <div class="text-xs opacity-75 mt-2">{{ formatTime(message.timestamp) }}</div>
                </div>
                
                <!-- 助手訊息 -->
                <div
                    v-else-if="message.type === 'assistant'"
                    class="max-w-[70%] rounded-xl p-3 md:p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm animate-in slide-in-from-bottom-2 duration-300"
                >
                    <div
                        class="prose prose-sm dark:prose-invert max-w-none message-content"
                        v-html="renderMessageContent(message)"
                        :ref="(el) => handleMessageRendered(el as HTMLElement)"
                    ></div>
                    <div class="text-xs text-gray-400 mt-2">{{ formatTime(message.timestamp) }}</div>
                </div>
                
                <!-- 系統訊息 -->
                <div
                    v-else-if="message.type === 'system' && !isSystemInit(message)"
                    class="w-full max-w-2xl mx-auto"
                >
                    <div
                        class="rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 text-sm text-center animate-in fade-in duration-300">
                        {{ message.content || message.subtype }}
                    </div>
                </div>
                
                <!-- 系統初始化訊息 -->
                <Card
                    v-else-if="isSystemInit(message)"
                    class="w-full max-w-2xl mx-auto animate-in fade-in duration-300"
                >
                    <CardHeader>
                        <CardTitle class="text-sm">系統資訊</CardTitle>
                        <CardDescription>Claude Code SDK 初始化</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-3">
                        <template v-if="getSystemInitData(message)">
                            <div class="grid grid-cols-2 gap-2 text-sm">
                                <div class="text-gray-500 dark:text-gray-400">Session ID</div>
                                <div class="font-mono text-xs break-all">{{
                                        getSystemInitData(message)?.session_id
                                    }}
                                </div>
                                
                                <div class="text-gray-500 dark:text-gray-400">Model</div>
                                <div>{{ getSystemInitData(message)?.model }}</div>
                                
                                <div class="text-gray-500 dark:text-gray-400">Working Dir</div>
                                <div class="font-mono text-xs break-all">{{ getSystemInitData(message)?.cwd }}</div>
                                
                                <div class="text-gray-500 dark:text-gray-400">Permission Mode</div>
                                <div>{{ getSystemInitData(message)?.permissionMode }}</div>
                            </div>
                            
                            <div v-if="getSystemInitData(message)?.mcp_servers?.length" class="space-y-1">
                                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">MCP Servers</div>
                                <div class="flex flex-wrap gap-1">
                                    <Badge
                                        v-for="server in getSystemInitData(message)?.mcp_servers"
                                        :key="server.name"
                                        variant="secondary"
                                        class="text-xs"
                                    >
                                        {{ server.name }} ({{ server.status }})
                                    </Badge>
                                </div>
                            </div>
                            
                            <div v-if="getSystemInitData(message)?.tools?.length" class="space-y-1">
                                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">
                                    可用工具：{{ getSystemInitData(message)?.tools?.length }}
                                </div>
                            </div>
                        </template>
                    </CardContent>
                </Card>
                
                <!-- 錯誤訊息 -->
                <div
                    v-else-if="message.type === 'error'"
                    class="w-full max-w-2xl mx-auto"
                >
                    <div
                        class="rounded-lg p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm animate-in fade-in duration-300">
                        <div class="font-medium">❌ 錯誤</div>
                        <div class="mt-1">{{ message.content }}</div>
                    </div>
                </div>
                
                <!-- Tool Use 訊息 -->
                <div
                    v-else-if="message.type === 'tool_use'"
                    class="w-full max-w-2xl mx-auto"
                >
                    <div
                        class="rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm animate-in fade-in duration-300">
                        <div class="font-medium text-blue-800 dark:text-blue-200">🔧 使用工具: {{
                                message.toolName
                            }}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 打字指示器 -->
            <div v-if="chatStore.isTyping" class="flex justify-start animate-in fade-in duration-300">
                <div
                    class="max-w-[70%] rounded-xl p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div class="flex items-center gap-1">
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 輸入區域 -->
        <div class="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-6 space-y-3">
            <div class="flex items-end gap-3">
                <Textarea
                    ref="textareaRef"
                    v-model="chatStore.inputText"
                    placeholder="輸入訊息..."
                    class="min-h-[44px] max-h-[120px] resize-none"
                    :disabled="!chatStore.isConnected"
                    @keydown="handleKeydown"
                />
                <Button
                    size="icon"
                    :disabled="!chatStore.isConnected || !chatStore.inputText.trim() || chatStore.isTyping"
                    @click="handleSend"
                    class="shrink-0 h-11 w-11"
                >
                    <Send class="h-4 w-4" />
                </Button>
            </div>
            
            <div class="flex items-center gap-2 flex-wrap">
                <Button
                    variant="outline"
                    size="sm"
                    @click="chatStore.newConversation"
                    :disabled="!chatStore.isConnected || chatStore.isTyping"
                >
                    新對話
                </Button>
                
                <Button
                    variant="outline"
                    size="sm"
                    @click="handleCancel"
                    :disabled="!chatStore.isConnected || !chatStore.currentSessionId"
                    class="text-orange-600 hover:text-orange-700"
                >
                    <StopCircle class="h-4 w-4 mr-1" />
                    取消
                </Button>
                
                <Button
                    variant="outline"
                    size="sm"
                    @click="handleClear"
                    class="text-red-600 hover:text-red-700"
                >
                    <Trash2 class="h-4 w-4 mr-1" />
                    清除訊息
                </Button>
                
                <div class="ml-auto flex items-center gap-2">
                    <div class="flex items-center gap-1.5">
                        <div
                            class="w-2 h-2 rounded-full transition-colors"
                            :class="{
                'bg-green-500 animate-pulse': chatStore.isConnected,
                'bg-gray-400': !chatStore.isConnected,
              }"
                        ></div>
                        <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ chatStore.isConnected ? '已連接' : '未連接' }}
            </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    /* Message content styles */
    :deep(.message-content) {
        font-size: 14px;
        line-height: 1.6;
    }
    
    :deep(.message-content h1),
    :deep(.message-content h2),
    :deep(.message-content h3),
    :deep(.message-content h4),
    :deep(.message-content h5),
    :deep(.message-content h6) {
        margin-top: 16px;
        margin-bottom: 8px;
        font-weight: 600;
        line-height: 1.25;
    }
    
    :deep(.message-content h1) {
        font-size: 1.5em;
    }
    
    :deep(.message-content h2) {
        font-size: 1.3em;
    }
    
    :deep(.message-content h3) {
        font-size: 1.1em;
    }
    
    :deep(.message-content p) {
        margin-bottom: 12px;
    }
    
    :deep(.message-content ul),
    :deep(.message-content ol) {
        margin-bottom: 12px;
        padding-left: 24px;
    }
    
    :deep(.message-content li) {
        margin-bottom: 4px;
    }
    
    :deep(.message-content code) {
        background: rgb(243 244 246);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
        font-size: 0.9em;
        color: rgb(225 29 72);
    }
    
    :deep(.message-content pre) {
        background: rgb(30 41 59);
        color: rgb(226 232 240);
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;
        margin-bottom: 12px;
        position: relative;
    }
    
    :deep(.message-content pre code) {
        background: none;
        padding: 0;
        color: inherit;
        font-size: 0.85em;
    }
    
    :deep(.code-copy-btn) {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgb(71 85 105);
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s, background 0.2s;
    }
    
    :deep(.message-content pre:hover .code-copy-btn) {
        opacity: 1;
    }
    
    :deep(.code-copy-btn:hover) {
        background: rgb(100 116 139);
    }
    
    :deep(.code-copy-btn.copied) {
        background: rgb(34 197 94);
    }
    
    :deep(.message-content blockquote) {
        border-left: 4px solid rgb(102 126 234);
        padding-left: 12px;
        margin: 12px 0;
        color: rgb(100 116 139);
        font-style: italic;
    }
    
    :deep(.message-content a) {
        color: rgb(102 126 234);
        text-decoration: none;
    }
    
    :deep(.message-content a:hover) {
        text-decoration: underline;
    }
    
    :deep(.message-content table) {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 12px;
    }
    
    :deep(.message-content table th),
    :deep(.message-content table td) {
        border: 1px solid rgb(229 231 235);
        padding: 8px;
        text-align: left;
    }
    
    :deep(.message-content table th) {
        background: rgb(249 250 251);
        font-weight: 600;
    }
    
    :deep(.message-content hr) {
        border: none;
        border-top: 1px solid rgb(229 231 235);
        margin: 16px 0;
    }
    
    :deep(.message-content img) {
        max-width: 100%;
        border-radius: 8px;
        margin: 8px 0;
    }
    
    /* Dark mode adjustments */
    :global(.dark) :deep(.message-content code) {
        background: rgb(31 41 55);
        color: rgb(251 113 133);
    }
    
    :global(.dark) :deep(.message-content table th),
    :global(.dark) :deep(.message-content table td) {
        border-color: rgb(55 65 81);
    }
    
    :global(.dark) :deep(.message-content table th) {
        background: rgb(31 41 55);
    }
    
    :global(.dark) :deep(.message-content blockquote) {
        color: rgb(156 163 175);
    }
    
    :global(.dark) :deep(.message-content hr) {
        border-top-color: rgb(55 65 81);
    }
</style>
