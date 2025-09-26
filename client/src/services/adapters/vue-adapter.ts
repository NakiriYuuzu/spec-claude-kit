/**
 * Vue 適配器 - 提供 Vue 框架整合
 */

import { reactive, computed, ref, type Ref, type ComputedRef } from 'vue'
import type { ApiClient } from '../index'
import type { ApiError, StateManager } from '@/services'

/**
 * Vue 狀態管理器
 */
export class VueStateManager implements StateManager {
    private state = reactive({
        loading: {} as Record<string, boolean>,
        errors: [] as ApiError[]
    })

    // 計算屬性 (Vue 專用)
    readonly isLoadingComputed = computed(() => Object.values(this.state.loading).some(v => v))
    readonly hasErrors = computed(() => this.state.errors.length > 0)
    readonly latestError = computed(() => this.state.errors[0] || null)
    readonly errorCount = computed(() => this.state.errors.length)

    setLoading(key: string, isLoading: boolean): void {
        if (isLoading) {
            this.state.loading[key] = true
        } else {
            delete this.state.loading[key]
        }
    }

    isLoading(key?: string): boolean {
        if (key) {
            return this.state.loading[key] || false
        }
        return this.isLoadingComputed.value
    }

    addError(error: ApiError): void {
        this.state.errors.unshift(error)
        if (this.state.errors.length > 10) {
            this.state.errors.pop()
        }
    }

    clearErrors(): void {
        this.state.errors = []
    }

    getErrors(): ApiError[] {
        return [...this.state.errors]
    }

    removeError(index: number): void {
        this.state.errors.splice(index, 1)
    }

    // Vue 特定方法
    getLoadingRef(key: string): ComputedRef<boolean> {
        return computed(() => this.state.loading[key] || false)
    }

    getState() {
        return this.state
    }
}

/**
 * Vue Composable 用於 API 調用
 */
export function useApiCall<T = any>(
    apiCall: () => Promise<T>,
    options: {
        immediate?: boolean
        loadingKey?: string
        onSuccess?: (data: T) => void
        onError?: (error: ApiError) => void
    } = {}
) {
    const data = ref<T | null>(null)
    const error = ref<ApiError | null>(null)
    const loading = ref(false)

    const execute = async () => {
        loading.value = true
        error.value = null

        try {
            const result = await apiCall()
            data.value = result
            options.onSuccess?.(result)
            return result
        } catch (err: any) {
            const apiError: ApiError = {
                code: err.code || 'UNKNOWN',
                message: err.message || 'Unknown error',
                timestamp: Date.now(),
                details: err
            }
            error.value = apiError
            options.onError?.(apiError)
            throw apiError
        } finally {
            loading.value = false
        }
    }

    // 立即執行
    if (options.immediate) {
        execute()
    }

    return {
        data: data as Ref<T | null>,
        error,
        loading,
        execute
    }
}

/**
 * Vue Composable 用於分頁
 */
export function useApiPagination<T = any>(
    apiCall: (page: number, pageSize: number) => Promise<{ data: T[]; total: number }>,
    options: {
        pageSize?: number
        immediate?: boolean
    } = {}
) {
    const currentPage = ref(1)
    const pageSize = ref(options.pageSize || 20)
    const total = ref(0)
    const data = ref<T[]>([])
    const loading = ref(false)
    const error = ref<ApiError | null>(null)

    const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
    const hasNext = computed(() => currentPage.value < totalPages.value)
    const hasPrev = computed(() => currentPage.value > 1)

    const loadPage = async (page: number) => {
        if (page < 1 || (totalPages.value > 0 && page > totalPages.value)) return

        loading.value = true
        error.value = null

        try {
            const result = await apiCall(page, pageSize.value)
            data.value = result.data
            total.value = result.total
            currentPage.value = page
        } catch (err: any) {
            error.value = {
                code: err.code || 'UNKNOWN',
                message: err.message || 'Unknown error',
                timestamp: Date.now(),
                details: err
            }
            throw err
        } finally {
            loading.value = false
        }
    }

    const next = () => loadPage(currentPage.value + 1)
    const prev = () => loadPage(currentPage.value - 1)
    const goto = (page: number) => loadPage(page)
    const refresh = () => loadPage(currentPage.value)

    if (options.immediate) {
        loadPage(1)
    }

    return {
        // 狀態
        data,
        loading,
        error,
        currentPage,
        pageSize,
        total,
        totalPages,
        hasNext,
        hasPrev,
        // 方法
        loadPage,
        next,
        prev,
        goto,
        refresh
    }
}

/**
 * Vue Composable 用於無限滾動
 */
export function useApiInfiniteScroll<T = any>(
    apiCall: (page: number, pageSize: number) => Promise<{ data: T[]; hasMore: boolean }>,
    options: {
        pageSize?: number
        immediate?: boolean
    } = {}
) {
    const items = ref<T[]>([])
    const currentPage = ref(0)
    const pageSize = ref(options.pageSize || 20)
    const loading = ref(false)
    const error = ref<ApiError | null>(null)
    const hasMore = ref(true)

    const loadMore = async () => {
        if (loading.value || !hasMore.value) return

        loading.value = true
        error.value = null

        try {
            const nextPage = currentPage.value + 1
            const result = await apiCall(nextPage, pageSize.value)
            
            items.value.push(...result.data as any)
            currentPage.value = nextPage
            hasMore.value = result.hasMore
        } catch (err: any) {
            error.value = {
                code: err.code || 'UNKNOWN',
                message: err.message || 'Unknown error',
                timestamp: Date.now(),
                details: err
            }
            throw err
        } finally {
            loading.value = false
        }
    }

    const reset = () => {
        items.value = []
        currentPage.value = 0
        hasMore.value = true
        error.value = null
    }

    if (options.immediate) {
        loadMore()
    }

    return {
        items,
        loading,
        error,
        hasMore,
        loadMore,
        reset
    }
}

/**
 * Vue Composable 用於輪詢
 */
export function useApiPolling<T = any>(
    apiCall: () => Promise<T>,
    options: {
        interval?: number
        immediate?: boolean
        maxRetries?: number
        onSuccess?: (data: T) => void
        onError?: (error: ApiError) => void
    } = {}
) {
    const data = ref<T | null>(null)
    const error = ref<ApiError | null>(null)
    const loading = ref(false)
    const isPolling = ref(false)
    const retryCount = ref(0)

    let intervalId: number | null = null

    const poll = async () => {
        if (loading.value) return

        loading.value = true
        error.value = null

        try {
            const result = await apiCall()
            data.value = result
            retryCount.value = 0
            options.onSuccess?.(result)
        } catch (err: any) {
            const apiError: ApiError = {
                code: err.code || 'UNKNOWN',
                message: err.message || 'Unknown error',
                timestamp: Date.now(),
                details: err
            }
            error.value = apiError
            retryCount.value++

            options.onError?.(apiError)

            // 檢查是否超過最大重試次數
            if (options.maxRetries && retryCount.value >= options.maxRetries) {
                stop()
            }
        } finally {
            loading.value = false
        }
    }

    const start = () => {
        if (isPolling.value) return

        isPolling.value = true
        poll() // 立即執行一次

        intervalId = setInterval(poll, options.interval || 5000)
    }

    const stop = () => {
        if (!isPolling.value) return

        isPolling.value = false
        if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
        }
    }

    const restart = () => {
        stop()
        retryCount.value = 0
        start()
    }

    if (options.immediate) {
        start()
    }

    // 組件卸載時停止輪詢
    if (typeof getCurrentInstance !== 'undefined') {
        const instance = getCurrentInstance()
        if (instance) {
            onUnmounted(() => stop())
        }
    }

    return {
        data,
        error,
        loading,
        isPolling,
        retryCount,
        start,
        stop,
        restart,
        poll
    }
}

// 確保在 Vue 環境中才導入
let getCurrentInstance: any
let onUnmounted: any

try {
    const vue = await import('vue')
    getCurrentInstance = vue.getCurrentInstance
    onUnmounted = vue.onUnmounted
} catch {
    // 非 Vue 環境，忽略
}

/**
 * 創建 Vue 整合的 API 客戶端
 */
export function createVueApiClient(apiClient: ApiClient): ApiClient & {
    state: VueStateManager
    useApi: typeof useApiCall
    usePagination: typeof useApiPagination
    useInfiniteScroll: typeof useApiInfiniteScroll
    usePolling: typeof useApiPolling
} {
    const stateManager = new VueStateManager()

    // 如果客戶端支援狀態管理，替換為 Vue 狀態管理器
    if ('setStateManager' in apiClient && typeof apiClient.setStateManager === 'function') {
        apiClient.setStateManager(stateManager)
    }

    const vueClient = Object.assign(apiClient, {
        state: stateManager,
        useApi: useApiCall,
        usePagination: useApiPagination,
        useInfiniteScroll: useApiInfiniteScroll,
        usePolling: useApiPolling
    })

    return vueClient as ApiClient & {
        state: VueStateManager
        useApi: typeof useApiCall
        usePagination: typeof useApiPagination
        useInfiniteScroll: typeof useApiInfiniteScroll
        usePolling: typeof useApiPolling
    }
}
