/**
 * 默認配置值
 */

import type { ApiClientConfig, RetryConfig, CacheConfig } from '@/services'

/**
 * 默認重試配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    delay: 1000,
    exponentialBackoff: true,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    retryableErrors: ['NetworkError', 'TimeoutError']
}

/**
 * 默認快取配置
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
    enabled: false,
    ttl: 300000, // 5 分鐘
}

/**
 * 默認客戶端配置
 */
export const DEFAULT_CLIENT_CONFIG: Partial<ApiClientConfig> = {
    timeout: 30000,
    responseType: 'json',
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    concurrencyLimit: 10,
    deduplication: true
}

/**
 * 環境變數映射
 */
export const ENV_CONFIG_MAP = {
    baseURL: ['VITE_API_BASE_URL', 'REACT_APP_API_BASE_URL', 'NEXT_PUBLIC_API_BASE_URL', 'API_BASE_URL'],
    timeout: ['VITE_API_TIMEOUT', 'REACT_APP_API_TIMEOUT', 'NEXT_PUBLIC_API_TIMEOUT', 'API_TIMEOUT'],
    tokenKey: ['VITE_TOKEN_KEY', 'REACT_APP_TOKEN_KEY', 'NEXT_PUBLIC_TOKEN_KEY', 'TOKEN_KEY']
}

/**
 * 從環境變數獲取配置
 */
export function getConfigFromEnv(): Partial<ApiClientConfig> {
    const config: Partial<ApiClientConfig> = {}

    // 獲取 baseURL
    for (const envKey of ENV_CONFIG_MAP.baseURL) {
        const value = getEnvValue(envKey)
        if (value) {
            config.baseURL = value
            break
        }
    }

    // 獲取 timeout
    for (const envKey of ENV_CONFIG_MAP.timeout) {
        const value = getEnvValue(envKey)
        if (value) {
            const timeout = parseInt(value, 10)
            if (!isNaN(timeout)) {
                config.timeout = timeout
            }
            break
        }
    }

    return config
}

/**
 * 獲取環境變數值
 */
function getEnvValue(key: string): string | undefined {
    // Node.js 環境
    if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env) {
        return (globalThis as any).process.env[key]
    }

    // Vite 環境
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        return (import.meta.env as any)[key]
    }

    // 瀏覽器環境
    if (typeof window !== 'undefined') {
        // @ts-ignore
        return window[key] || window.env?.[key]
    }

    return undefined
}

/**
 * 合併配置
 */
export function mergeConfig(
    ...configs: Array<Partial<ApiClientConfig> | undefined>
): ApiClientConfig {
    const result = {...DEFAULT_CLIENT_CONFIG} as ApiClientConfig

    for (const config of configs) {
        if (!config) continue

        // 合併基礎屬性
        Object.assign(result, config)

        // 深度合併 headers
        if (config.headers) {
            result.headers = {
                ...result.headers,
                ...config.headers
            }
        }

        // 深度合併 retry
        if (config.retry) {
            result.retry = {
                ...result.retry,
                ...config.retry
            }
        }

        // 深度合併 cache
        if (config.cache) {
            result.cache = {
                ...result.cache,
                ...config.cache
            }
        }

        // 深度合併 responseSchema
        if (config.responseSchema) {
            result.responseSchema = {
                ...result.responseSchema,
                ...config.responseSchema
            }
        }
    }

    return result
}

/**
 * 驗證配置
 */
export function validateConfig(config: ApiClientConfig): void {
    const errors: string[] = []

    // 檢查必要欄位
    if (!config.baseURL) {
        errors.push('baseURL is required')
    }

    // 檢查 URL 格式
    if (config.baseURL && !isValidURL(config.baseURL)) {
        errors.push('baseURL must be a valid URL')
    }

    // 檢查 timeout
    if (config.timeout !== undefined && (config.timeout <= 0 || config.timeout > 600000)) {
        errors.push('timeout must be between 1 and 600000 ms')
    }

    // 檢查併發限制
    if (config.concurrencyLimit !== undefined && config.concurrencyLimit <= 0) {
        errors.push('concurrencyLimit must be greater than 0')
    }

    if (errors.length > 0) {
        throw new Error(`Invalid API client configuration:\n${errors.join('\n')}`)
    }
}

/**
 * 檢查是否為有效 URL
 */
function isValidURL(url: string): boolean {
    try {
        new URL(url)
        return true
    } catch {
        // 可能是相對路徑
        return url.startsWith('/') || url.startsWith('./')
    }
}

/**
 * 預設配置集合
 */
export const PRESET_CONFIGS = {
    /**
     * 開發環境配置
     */
    development: {
        timeout: 60000,
        retry: {
            maxAttempts: 1,
            delay: 1000
        },
        cache: {
            enabled: false
        }
    },

    /**
     * 生產環境配置
     */
    production: {
        timeout: 30000,
        retry: DEFAULT_RETRY_CONFIG,
        cache: {
            enabled: true,
            ttl: 300000
        }
    },

    /**
     * 移動端配置
     */
    mobile: {
        timeout: 45000,
        retry: {
            maxAttempts: 5,
            delay: 2000,
            exponentialBackoff: true
        },
        concurrencyLimit: 3
    },

    /**
     * 低網速配置
     */
    slowNetwork: {
        timeout: 90000,
        retry: {
            maxAttempts: 5,
            delay: 3000,
            exponentialBackoff: true
        },
        concurrencyLimit: 2
    }
}

/**
 * 根據環境獲取預設配置
 */
export function getPresetConfig(preset: keyof typeof PRESET_CONFIGS): Partial<ApiClientConfig> {
    return PRESET_CONFIGS[preset] || {}
}
