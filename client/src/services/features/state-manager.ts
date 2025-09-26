/**
 * 狀態管理器 - 提供可選的狀態管理功能
 */

import type { StateManager, ApiError } from '@/services'

/**
 * 狀態變更事件
 */
export interface StateChangeEvent {
    type: 'loading' | 'error' | 'clear'
    key?: string
    value?: any
    timestamp: number
}

/**
 * 狀態訂閱器
 */
export type StateSubscriber = (event: StateChangeEvent) => void

/**
 * 基礎狀態管理器
 */
export class BaseStateManager implements StateManager {
    protected loadingStates: Map<string, boolean> = new Map()
    protected errors: ApiError[] = []
    protected subscribers: Set<StateSubscriber> = new Set()
    protected maxErrors: number

    constructor(options?: {
        maxErrors?: number
    }) {
        this.maxErrors = options?.maxErrors || 10
    }

    /**
     * 設置加載狀態
     */
    setLoading(key: string, isLoading: boolean): void {
        if (isLoading) {
            this.loadingStates.set(key, true)
        } else {
            this.loadingStates.delete(key)
        }

        this.notifySubscribers({
            type: 'loading',
            key,
            value: isLoading,
            timestamp: Date.now()
        })
    }

    /**
     * 檢查是否正在加載
     */
    isLoading(key?: string): boolean {
        if (key) {
            return this.loadingStates.get(key) || false
        }
        return this.loadingStates.size > 0
    }

    /**
     * 獲取所有加載中的鍵
     */
    getLoadingKeys(): string[] {
        return Array.from(this.loadingStates.keys())
    }

    /**
     * 添加錯誤
     */
    addError(error: ApiError): void {
        this.errors.unshift(error)

        // 限制錯誤數量
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(0, this.maxErrors)
        }

        this.notifySubscribers({
            type: 'error',
            value: error,
            timestamp: Date.now()
        })
    }

    /**
     * 清除錯誤
     */
    clearErrors(): void {
        this.errors = []

        this.notifySubscribers({
            type: 'clear',
            timestamp: Date.now()
        })
    }

    /**
     * 移除特定錯誤
     */
    removeError(index: number): void {
        if (index >= 0 && index < this.errors.length) {
            const removed = this.errors.splice(index, 1)[0]

            this.notifySubscribers({
                type: 'error',
                key: 'remove',
                value: removed,
                timestamp: Date.now()
            })
        }
    }

    /**
     * 獲取錯誤列表
     */
    getErrors(): ApiError[] {
        return [...this.errors]
    }

    /**
     * 獲取最新錯誤
     */
    getLatestError(): ApiError | null {
        return this.errors[0] || null
    }

    /**
     * 按類型過濾錯誤
     */
    getErrorsByCode(code: number | string): ApiError[] {
        return this.errors.filter(error => error.code === code)
    }

    /**
     * 訂閱狀態變化
     */
    subscribe(callback: StateSubscriber): () => void {
        this.subscribers.add(callback)

        // 返回取消訂閱函數
        return () => {
            this.subscribers.delete(callback)
        }
    }

    /**
     * 通知訂閱者
     */
    protected notifySubscribers(event: StateChangeEvent): void {
        this.subscribers.forEach(subscriber => {
            try {
                subscriber(event)
            } catch (error) {
                console.error('State subscriber error:', error)
            }
        })
    }

    /**
     * 重置所有狀態
     */
    reset(): void {
        this.loadingStates.clear()
        this.errors = []

        this.notifySubscribers({
            type: 'clear',
            key: 'reset',
            timestamp: Date.now()
        })
    }

    /**
     * 獲取狀態快照
     */
    getSnapshot(): {
        loading: Record<string, boolean>
        errors: ApiError[]
        isLoading: boolean
        hasErrors: boolean
    } {
        return {
            loading: Object.fromEntries(this.loadingStates),
            errors: [...this.errors],
            isLoading: this.isLoading(),
            hasErrors: this.errors.length > 0
        }
    }
}

/**
 * 分組狀態管理器
 */
export class GroupedStateManager extends BaseStateManager {
    private groups: Map<string, {
        loading: Map<string, boolean>
        errors: ApiError[]
    }> = new Map()

    /**
     * 設置分組加載狀態
     */
    setGroupLoading(group: string, key: string, isLoading: boolean): void {
        const groupState = this.getOrCreateGroup(group)

        if (isLoading) {
            groupState.loading.set(key, true)
        } else {
            groupState.loading.delete(key)
        }

        this.notifySubscribers({
            type: 'loading',
            key: `${group}:${key}`,
            value: isLoading,
            timestamp: Date.now()
        })
    }

    /**
     * 檢查分組是否正在加載
     */
    isGroupLoading(group: string, key?: string): boolean {
        const groupState = this.groups.get(group)
        if (!groupState) return false

        if (key) {
            return groupState.loading.get(key) || false
        }
        return groupState.loading.size > 0
    }

    /**
     * 添加分組錯誤
     */
    addGroupError(group: string, error: ApiError): void {
        const groupState = this.getOrCreateGroup(group)
        groupState.errors.unshift(error)

        // 限制錯誤數量
        if (groupState.errors.length > this.maxErrors) {
            groupState.errors = groupState.errors.slice(0, this.maxErrors)
        }

        this.notifySubscribers({
            type: 'error',
            key: group,
            value: error,
            timestamp: Date.now()
        })
    }

    /**
     * 清除分組錯誤
     */
    clearGroupErrors(group: string): void {
        const groupState = this.groups.get(group)
        if (groupState) {
            groupState.errors = []

            this.notifySubscribers({
                type: 'clear',
                key: group,
                timestamp: Date.now()
            })
        }
    }

    /**
     * 獲取分組錯誤
     */
    getGroupErrors(group: string): ApiError[] {
        const groupState = this.groups.get(group)
        return groupState ? [...groupState.errors] : []
    }

    /**
     * 重置分組
     */
    resetGroup(group: string): void {
        this.groups.delete(group)

        this.notifySubscribers({
            type: 'clear',
            key: `${group}:reset`,
            timestamp: Date.now()
        })
    }

    /**
     * 獲取或創建分組
     */
    private getOrCreateGroup(group: string) {
        let groupState = this.groups.get(group)
        if (!groupState) {
            groupState = {
                loading: new Map(),
                errors: []
            }
            this.groups.set(group, groupState)
        }
        return groupState
    }

    /**
     * 獲取所有分組
     */
    getGroups(): string[] {
        return Array.from(this.groups.keys())
    }

    /**
     * 獲取分組快照
     */
    getGroupSnapshot(group: string) {
        const groupState = this.groups.get(group)
        if (!groupState) {
            return {
                loading: {},
                errors: [],
                isLoading: false,
                hasErrors: false
            }
        }

        return {
            loading: Object.fromEntries(groupState.loading),
            errors: [...groupState.errors],
            isLoading: groupState.loading.size > 0,
            hasErrors: groupState.errors.length > 0
        }
    }

    /**
     * 清除所有分組
     */
    clearAllGroups(): void {
        this.groups.clear()

        this.notifySubscribers({
            type: 'clear',
            key: 'all-groups',
            timestamp: Date.now()
        })
    }
}

/**
 * 全局狀態管理器（單例）
 */
export class GlobalStateManager extends BaseStateManager {
    private static instance: GlobalStateManager

    static getInstance(options?: { maxErrors?: number }): GlobalStateManager {
        if (!GlobalStateManager.instance) {
            GlobalStateManager.instance = new GlobalStateManager(options)
        }
        return GlobalStateManager.instance
    }

    static resetInstance(): void {
        if (GlobalStateManager.instance) {
            GlobalStateManager.instance.reset()
            GlobalStateManager.instance = undefined as any
        }
    }
}

/**
 * 創建狀態管理器
 */
export function createStateManager(
    type: 'basic' | 'grouped' | 'global' = 'basic',
    options?: any
): StateManager {
    switch (type) {
        case 'grouped':
            return new GroupedStateManager(options)
        case 'global':
            return GlobalStateManager.getInstance(options)
        default:
            return new BaseStateManager(options)
    }
}
