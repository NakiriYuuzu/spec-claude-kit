/**
 * API 服務主入口 - 提供完整的 API 客戶端功能
 */

// 核心導出
export * from './core/types'
export { createHttpClient } from './core/http-client'
export { InterceptorManager } from './core/interceptors'
export * from './core/interceptors'

// 功能模組導出
export * from './features/token-manager'
export * from './features/state-manager'
export * from './features/error-handler'
export * from './features/file-handler'

// 配置導出
export * from './config/api-config'
export * from './config/defaults'

// 主要 API 客戶端
export { ApiClient, createApiClient } from './api-client'

// 框架適配器
export * from './adapters/vue-adapter'

// 默認 API 實例配置
import { createApiClient } from './api-client'
import { createVueApiClient } from './adapters/vue-adapter'
import { createTokenManager } from './features/token-manager'
import { createStateManager } from './features/state-manager'

/**
 * 快速創建預配置的 API 客戶端
 */
export const createPresetApiClient = {
    /**
     * 創建開發環境 API 客戶端
     */
    development: (baseURL: string) => createApiClient({
        baseURL,
        timeout: 60000,
        retry: {maxAttempts: 1},
        cache: {enabled: false},
        credentials: "include",
        tokenManager: createTokenManager('jwt', { tokenKey: 'dev_auth_token' }),
        stateManager: createStateManager('basic')
    }),

    /**
     * 創建生產環境 API 客戶端
     */
    production: (baseURL: string) => createApiClient({
        baseURL,
        timeout: 30000,
        // retry: {maxAttempts: 3, delay: 1000, exponentialBackoff: true},
        cache: {enabled: true, ttl: 300000},
        tokenManager: createTokenManager('jwt', {
            tokenKey: 'auth_token'
        }),
        stateManager: createStateManager('basic')
    })
}

const apiClient = import.meta.env.VITE_APP_ENV === 'production' ?
    createPresetApiClient.production(`${import.meta.env.VITE_APP_API_PROD}`) :
    createPresetApiClient.development(`${import.meta.env.VITE_APP_API_PROD}`)

export const api = createVueApiClient(apiClient)
