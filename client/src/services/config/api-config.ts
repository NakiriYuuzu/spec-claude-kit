/**
 * API 配置管理器
 */

import type { ApiClientConfig } from '../core/types'
import { mergeConfig, validateConfig, getConfigFromEnv, getPresetConfig } from './defaults'

/**
 * 配置構建器
 */
export class ApiConfigBuilder {
    private config: Partial<ApiClientConfig> = {}

    /**
     * 設置基礎 URL
     */
    baseURL(url: string): this {
        this.config.baseURL = url
        return this
    }

    /**
     * 設置超時時間
     */
    timeout(ms: number): this {
        this.config.timeout = ms
        return this
    }

    /**
     * 設置請求頭
     */
    headers(headers: Record<string, string>): this {
        this.config.headers = {
            ...this.config.headers,
            ...headers
        }
        return this
    }

    /**
     * 設置單個請求頭
     */
    header(key: string, value: string): this {
        if (!this.config.headers) {
            this.config.headers = {}
        }
        this.config.headers[key] = value
        return this
    }

    /**
     * 設置響應類型
     */
    responseType(type: ApiClientConfig['responseType']): this {
        this.config.responseType = type
        return this
    }

    /**
     * 設置憑證模式
     */
    credentials(mode: RequestCredentials): this {
        this.config.credentials = mode
        return this
    }

    /**
     * 啟用/禁用快取
     */
    cache(enabled: boolean, ttl?: number): this {
        this.config.cache = {
            ...this.config.cache,
            enabled,
            ttl
        }
        return this
    }

    /**
     * 設置重試配置
     */
    retry(config: ApiClientConfig['retry']): this {
        this.config.retry = {
            ...this.config.retry,
            ...config
        }
        return this
    }

    /**
     * 設置最大重試次數
     */
    maxRetries(count: number): this {
        if (!this.config.retry) {
            this.config.retry = {}
        }
        this.config.retry.maxAttempts = count
        return this
    }

    /**
     * 設置併發限制
     */
    concurrency(limit: number): this {
        this.config.concurrencyLimit = limit
        return this
    }

    /**
     * 設置響應模式
     */
    responseSchema(schema: ApiClientConfig['responseSchema']): this {
        this.config.responseSchema = {
            ...this.config.responseSchema,
            ...schema
        }
        return this
    }

    /**
     * 使用預設配置
     */
    usePreset(preset: 'development' | 'production' | 'mobile' | 'slowNetwork'): this {
        const presetConfig = getPresetConfig(preset)
        this.config = mergeConfig(this.config, presetConfig)
        return this
    }

    /**
     * 從環境變數加載配置
     */
    fromEnv(): this {
        const envConfig = getConfigFromEnv()
        this.config = mergeConfig(this.config, envConfig)
        return this
    }

    /**
     * 合併其他配置
     */
    merge(config: Partial<ApiClientConfig>): this {
        this.config = mergeConfig(this.config, config)
        return this
    }

    /**
     * 構建最終配置
     */
    build(): ApiClientConfig {
        const finalConfig = mergeConfig(this.config) as ApiClientConfig
        validateConfig(finalConfig)
        return finalConfig
    }
}

/**
 * 配置管理器
 */
export class ApiConfigManager {
    private static configs: Map<string, ApiClientConfig> = new Map()
    private static defaultConfigName = 'default'

    /**
     * 註冊配置
     */
    static register(name: string, config: ApiClientConfig): void {
        validateConfig(config)
        this.configs.set(name, config)
    }

    /**
     * 獲取配置
     */
    static get(name?: string): ApiClientConfig | undefined {
        return this.configs.get(name || this.defaultConfigName)
    }

    /**
     * 獲取所有配置名稱
     */
    static getNames(): string[] {
        return Array.from(this.configs.keys())
    }

    /**
     * 設置默認配置名稱
     */
    static setDefault(name: string): void {
        if (!this.configs.has(name)) {
            throw new Error(`Config "${name}" not found`)
        }
        this.defaultConfigName = name
    }

    /**
     * 清除所有配置
     */
    static clear(): void {
        this.configs.clear()
        this.defaultConfigName = 'default'
    }

    /**
     * 從對象批量註冊配置
     */
    static registerBatch(configs: Record<string, ApiClientConfig>): void {
        Object.entries(configs).forEach(([name, config]) => {
            this.register(name, config)
        })
    }
}

/**
 * 創建配置構建器
 */
export function createConfigBuilder(): ApiConfigBuilder {
    return new ApiConfigBuilder()
}

/**
 * 快速創建配置
 */
export function createConfig(options: {
    baseURL: string
    preset?: 'development' | 'production' | 'mobile' | 'slowNetwork'
    headers?: Record<string, string>
    timeout?: number
    retry?: ApiClientConfig['retry']
    cache?: ApiClientConfig['cache']
    responseSchema?: ApiClientConfig['responseSchema']
}): ApiClientConfig {
    const builder = createConfigBuilder()
        .baseURL(options.baseURL)
        .fromEnv()

    if (options.preset) {
        builder.usePreset(options.preset)
    }

    if (options.headers) {
        builder.headers(options.headers)
    }

    if (options.timeout !== undefined) {
        builder.timeout(options.timeout)
    }

    if (options.retry) {
        builder.retry(options.retry)
    }

    if (options.cache) {
        builder.cache(options.cache.enabled || false, options.cache.ttl)
    }

    if (options.responseSchema) {
        builder.responseSchema(options.responseSchema)
    }

    return builder.build()
}

/**
 * 配置驗證器
 */
export class ConfigValidator {
    private rules: Array<(config: ApiClientConfig) => string | null> = []

    /**
     * 添加驗證規則
     */
    addRule(rule: (config: ApiClientConfig) => string | null): this {
        this.rules.push(rule)
        return this
    }

    /**
     * 驗證配置
     */
    validate(config: ApiClientConfig): { valid: boolean; errors: string[] } {
        const errors: string[] = []

        for (const rule of this.rules) {
            const error = rule(config)
            if (error) {
                errors.push(error)
            }
        }

        // 執行內建驗證
        try {
            validateConfig(config)
        } catch (e: any) {
            errors.push(e.message)
        }

        return {
            valid: errors.length === 0,
            errors
        }
    }
}

/**
 * 創建配置驗證器
 */
export function createConfigValidator(): ConfigValidator {
    return new ConfigValidator()
}
