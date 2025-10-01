<script setup lang="ts">
    import AppSidebar from "@/components/AppSidebar.vue"
    import {
        Breadcrumb,
        BreadcrumbItem,
        BreadcrumbLink,
        BreadcrumbList,
        BreadcrumbPage,
        BreadcrumbSeparator,
    } from "@/components/ui/breadcrumb"
    import { Separator } from "@/components/ui/separator"
    import {
        SidebarInset,
        SidebarProvider,
        SidebarTrigger,
    } from "@/components/ui/sidebar"
    import { useChatStore } from "@/stores"
    import { computed } from "vue"

    const chatStore = useChatStore()

    // 計算當前顯示的 session ID（截短版本）
    const displaySessionId = computed(() => {
        if (!chatStore.currentSessionId) {
            return '新對話'
        }
        // 如果 ID 太長，只顯示前面和後面部分
        const id = chatStore.currentSessionId
        if (id.length > 30) {
            return `${id.substring(0, 15)}...${id.substring(id.length - 10)}`
        }
        return id
    })
</script>

<template>
    <SidebarProvider
        :style="{
      '--sidebar-width': '350px',
    }"
    >
        <AppSidebar />
        <SidebarInset>
            <header class="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
                <SidebarTrigger class="-ml-1" />
                <Separator orientation="vertical" class="mr-2 h-4" />
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem class="hidden md:block">
                            <BreadcrumbLink href="#">
                                Chat
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator class="hidden md:block" />
                        <BreadcrumbItem>
                            <BreadcrumbPage class="max-w-[400px] truncate" :title="chatStore.currentSessionId || '新對話'">
                                {{ displaySessionId }}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </header>
            <RouterView />
        </SidebarInset>
    </SidebarProvider>
</template>
