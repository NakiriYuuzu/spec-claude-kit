<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar'
import { MessageSquare, Plus, Trash2, Clock, Hash, RefreshCw } from "lucide-vue-next"
import { onMounted, onUnmounted } from "vue"
import { Badge } from '@/components/ui/badge'
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarInput,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ref } from 'vue'

const props = withDefaults(defineProps<SidebarProps>(), {
    collapsible: "icon",
})

const chatStore = useChatStore()
const { setOpen } = useSidebar()

// 刪除確認對話框
const deleteDialogOpen = ref(false)
const sessionToDelete = ref<string | null>(null)

// 格式化時間
function formatTime(timestamp: number) {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // 小於 1 分鐘
    if (diff < 60000) {
        return '剛剛'
    }

    // 小於 1 小時
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000)
        return `${minutes} 分鐘前`
    }

    // 小於 24 小時
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000)
        return `${hours} 小時前`
    }

    // 小於 7 天
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000)
        return `${days} 天前`
    }

    // 顯示日期
    return date.toLocaleDateString('zh-TW', {
        month: 'short',
        day: 'numeric',
    })
}

function handleSelectSession(sessionId: string) {
    chatStore.selectSession(sessionId)
    setOpen(true)
}

function confirmDelete(sessionId: string) {
    sessionToDelete.value = sessionId
    deleteDialogOpen.value = true
}

async function handleDelete() {
    if (sessionToDelete.value) {
        await chatStore.deleteSession(sessionToDelete.value)
        deleteDialogOpen.value = false
        sessionToDelete.value = null
    }
}

// 用戶資料
// const user = {
//     name: "Claude User",
//     email: "user@example.com",
//     avatar: "/avatars/user.jpg",
// }

// 初始化
onMounted(() => {
    chatStore.init()
})

onUnmounted(() => {
    chatStore.cleanup()
})
</script>

<template>
    <Sidebar
        class="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
        v-bind="props"
    >
        <!-- 第一層側邊欄：導航圖標 -->
        <Sidebar
            collapsible="none"
            class="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
        >
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" as-child class="md:h-8 md:p-0">
                            <a href="#">
                                <div
                                    class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                                    <MessageSquare class="size-4" />
                                </div>
                                <div class="grid flex-1 text-left text-sm leading-tight">
                                    <span class="truncate font-medium">Claude Chat</span>
                                    <span class="truncate text-xs">CCSDK</span>
                                </div>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent class="px-1.5 md:px-0">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    tooltip="聊天"
                                    :is-active="true"
                                    class="px-2.5 md:px-2"
                                >
                                    <MessageSquare />
                                    <span>聊天</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

<!--            <SidebarFooter>-->
<!--                <NavUser :user="user" />-->
<!--            </SidebarFooter>-->
        </Sidebar>

        <!-- 第二層側邊欄：Sessions 列表 -->
        <Sidebar collapsible="none" class="hidden flex-1 md:flex">
            <SidebarHeader class="gap-3.5 border-b p-4">
                <div class="flex w-full items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="text-base font-medium text-foreground">
                            對話列表
                        </div>
                        <Badge
                            v-if="chatStore.isConnected"
                            variant="outline"
                            class="bg-green-500/10 text-green-600 border-green-500/30"
                        >
                            已連接
                        </Badge>
                        <Badge
                            v-else-if="chatStore.connectionStatus === 'connecting'"
                            variant="outline"
                            class="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
                        >
                            連接中...
                        </Badge>
                        <Badge
                            v-else
                            variant="outline"
                            class="bg-red-500/10 text-red-600 border-red-500/30 cursor-pointer hover:bg-red-500/20 transition-colors"
                            @click="chatStore.reconnectWebSocket"
                            title="點擊重新連接"
                        >
                            <RefreshCw class="h-3 w-3 mr-1" />
                            未連接
                        </Badge>
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        @click="chatStore.newConversation"
                        class="h-7 w-7 p-0"
                    >
                        <Plus class="h-4 w-4" />
                    </Button>
                </div>
                <SidebarInput
                    v-model="chatStore.searchQuery"
                    placeholder="搜尋對話..."
                />
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup class="px-0">
                    <SidebarGroupContent>
                        <div v-if="chatStore.sessionsLoading" class="p-4 text-center text-sm text-muted-foreground">
                            載入中...
                        </div>

                        <div v-else-if="chatStore.filteredSessions.length === 0" class="p-4 text-center text-sm text-muted-foreground">
                            {{ chatStore.searchQuery ? '沒有找到對話' : '還沒有對話' }}
                        </div>

                        <div
                            v-for="session in chatStore.filteredSessions"
                            :key="session.id"
                            class="group relative hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight last:border-b-0 cursor-pointer"
                            :class="{
                                'bg-sidebar-accent': chatStore.currentSessionId === session.id
                            }"
                            @click="handleSelectSession(session.id)"
                        >
                            <div class="flex w-full items-center gap-2 justify-between">
                                <span class="font-medium truncate flex-1 min-w-0">{{ session.id }}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    class="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    @click.stop="confirmDelete(session.id)"
                                >
                                    <Trash2 class="h-3 w-3" />
                                </Button>
                            </div>

                            <div class="flex items-center gap-3 text-xs text-muted-foreground w-full flex-wrap">
                                <div class="flex items-center gap-1">
                                    <Hash class="h-3 w-3" />
                                    <span>{{ session.message_count }} 訊息</span>
                                </div>
                                <div class="flex items-center gap-1">
                                    <Clock class="h-3 w-3" />
                                    <span>{{ formatTime(session.last_activity) }}</span>
                                </div>
                                <Badge
                                    v-if="session.is_active"
                                    variant="outline"
                                    class="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs"
                                >
                                    活躍
                                </Badge>
                            </div>
                        </div>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    </Sidebar>

    <!-- 刪除確認對話框 -->
    <AlertDialog v-model:open="deleteDialogOpen">
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>確認刪除</AlertDialogTitle>
                <AlertDialogDescription>
                    確定要刪除這個對話嗎？此操作無法復原。
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction @click="handleDelete">
                    刪除
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>
