/**
 * 核心 HTTP 客戶端 - 提供純淨的 HTTP 請求功能
 */

import type {
    HttpClient,
    RequestConfig,
    ApiClientConfig,
    ApiError,
    CacheStorage
} from './types'

/**
 * 默認快取存儲實現
 */
class DefaultCacheStorage implements CacheStorage {
    private cache = new Map<string, { value: any; expiry: number }>()

    async get(key: string): Promise<any> {
        const item = this.cache.get(key)
        if (!item) return null
        if (Date.now() > item.expiry) {
            this.cache.delete(key)
            return null
        }
        return item.value
    }

    async set(key: string, value: any, ttl: number = 3600000): Promise<void> {
        this.cache.set(key, {
            value,
            expiry: Date.now() + ttl
        })
    }

    async delete(key: string): Promise<void> {
        this.cache.delete(key)
    }

    async clear(): Promise<void> {
        this.cache.clear()
    }

    async has(key: string): Promise<boolean> {
        const item = this.cache.get(key)
        if (!item) return false
        if (Date.now() > item.expiry) {
            this.cache.delete(key)
            return false
        }
        return true
    }
}

/**
 * HTTP 客戶端實現
 */
export class HttpClientImpl implements HttpClient {
    private config: ApiClientConfig
    private cache: CacheStorage
    private pendingRequests = new Map<string, Promise<any>>()

    constructor(config: ApiClientConfig) {
        this.config = {
            timeout: 30000,
            responseType: 'json',
            credentials: 'include',
            concurrencyLimit: 10,
            deduplication: true,
            ...config
        }
        this.cache = config.cache?.storage || new DefaultCacheStorage()
    }

    /**
     * 構建完整 URL
     */
    private buildURL(url: string, params?: Record<string, any>): string {
        // 處理相對路徑
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = this.config.baseURL + (url.startsWith('/') ? url : `/${url}`)
        }

        // 添加查詢參數
        if (params && Object.keys(params).length > 0) {
            const searchParams = new URLSearchParams()
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
                }
            })
            const queryString = searchParams.toString()
            if (queryString) {
                url = `${url}${url.includes('?') ? '&' : '?'}${queryString}`
            }
        }

        return url
    }

    /**
     * 生成請求鍵（用於去重和快取）
     */
    private generateRequestKey(url: string, config: RequestConfig): string {
        const {method = 'GET', params, body} = config
        const keyParts = [method, url]

        if (params) {
            keyParts.push(JSON.stringify(params))
        }

        if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
            keyParts.push(JSON.stringify(body))
        }

        return keyParts.join('|')
    }

    /**
     * 處理快取
     */
    private async handleCache(key: string, config: RequestConfig): Promise<any> {
        if (!config.cache?.enabled || !['GET', 'HEAD', 'OPTIONS'].includes(config.method || 'GET')) {
            return null
        }

        const cacheKey = config.cache.keyGenerator?.(config) || key
        return await this.cache.get(cacheKey)
    }

    /**
     * 保存到快取
     */
    private async saveToCache(key: string, value: any, config: RequestConfig): Promise<void> {
        if (!config.cache?.enabled || !['GET', 'HEAD', 'OPTIONS'].includes(config.method || 'GET')) {
            return
        }

        const cacheKey = config.cache.keyGenerator?.(config) || key
        await this.cache.set(cacheKey, value, config.cache.ttl)
    }

    /**
     * 執行重試
     */
    private async executeWithRetry<T>(
        fn: () => Promise<T>,
        config: RequestConfig
    ): Promise<T> {
        const retry = {...this.config.retry, ...config.retry}
        const maxAttempts = retry?.maxAttempts || 1
        const delay = retry?.delay || 1000
        const exponentialBackoff = retry?.exponentialBackoff ?? true

        let lastError: any

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn()
            } catch (error: any) {
                lastError = error

                // 檢查是否應該重試
                if (attempt === maxAttempts) break

                const shouldRetry = this.shouldRetry(error, retry)
                if (!shouldRetry) break

                // 計算延遲時間
                const waitTime = exponentialBackoff
                    ? delay * Math.pow(2, attempt - 1)
                    : delay

                await new Promise(resolve => setTimeout(resolve, waitTime))
            }
        }

        throw lastError
    }

    /**
     * 判斷是否應該重試
     */
    private shouldRetry(error: any, retry?: RequestConfig['retry']): boolean {
        if (!retry) return false

        // 檢查狀態碼
        if (error.code && retry.retryableStatuses?.includes(error.code)) {
            return true
        }

        // 檢查錯誤類型
        if (error.name && retry.retryableErrors?.includes(error.name)) {
            return true
        }

        // 網絡錯誤默認重試
        if (error.name === 'NetworkError' || error.message?.includes('network')) {
            return true
        }

        return false
    }

    /**
     * 創建錯誤對象
     */
    private createError(
        message: string,
        code: number | string,
        config?: RequestConfig,
        response?: Response,
        details?: any
    ): ApiError {
        const error: ApiError = {
            code,
            message,
            timestamp: Date.now(),
            config,
            response,
            details
        }

        // 使用錯誤轉換器（只支持同步轉換）
        if (this.config.errorTransformer) {
            try {
                const transformed = this.config.errorTransformer(error)
                // 如果返回 Promise，忽略並使用原始錯誤
                if (transformed instanceof Promise) {
                    console.warn('Error transformer returned Promise, only synchronous transformers are supported')
                    return error
                }
                return transformed || error
            } catch (transformError) {
                console.error('Error transformer failed:', transformError)
                return error
            }
        }

        return error
    }

    /**
     * 處理響應
     */
    private async handleResponse(response: Response, config: RequestConfig): Promise<any> {
        let data: any

        // 根據響應類型處理數據
        const responseType = config.responseType || this.config.responseType || 'json'

        switch (responseType) {
            case 'text':
                data = await response.text()
                break
            case 'blob':
                data = await response.blob()
                break
            case 'arraybuffer':
                data = await response.arrayBuffer()
                break
            case 'formdata':
                data = await response.formData()
                break
            case 'json':
            default:
                // 處理空響應
                if (response.status === 204 || response.headers.get('content-length') === '0') {
                    data = null
                } else {
                    // 先獲取文本，然後嘗試解析為 JSON
                    const text = await response.text()
                    if (!text || text.trim() === '') {
                        data = null
                    } else {
                        try {
                            data = JSON.parse(text)
                        } catch (e) {
                            // JSON 解析失敗，返回原始文本
                            data = text
                        }
                    }
                }
        }

        // 處理非成功狀態
        if (!response.ok) {
            throw this.createError(
                response.statusText || `Request failed with status ${response.status}`,
                response.status,
                config,
                response,
                data
            )
        }

        // 使用響應轉換器
        if (this.config.responseTransformer) {
            data = await this.config.responseTransformer(data, response)
        }

        // 使用響應模式提取數據
        if (this.config.responseSchema && data && typeof data === 'object') {
            data = this.extractDataBySchema(data)
        }

        // 驗證響應
        if (this.config.validator) {
            const isValid = await this.config.validator(data)
            if (!isValid) {
                throw this.createError('Response validation failed', 'VALIDATION_ERROR', config, response, data)
            }
        }

        return data
    }

    /**
     * 根據模式提取數據
     */
    private extractDataBySchema(response: any): any {
        const schema = this.config.responseSchema!

        if (schema.extractor) {
            return schema.extractor(response)
        }

        const result: any = {}

        // 提取各個字段
        const fields = [
            {key: 'data', field: schema.dataField},
            {key: 'status', field: schema.statusField},
            {key: 'message', field: schema.messageField},
            {key: 'success', field: schema.successField},
            {key: 'meta', field: schema.metaField}
        ]

        fields.forEach(({key, field}) => {
            if (field) {
                const value = this.getNestedValue(response, field)
                if (value !== undefined) {
                    result[key] = value
                }
            }
        })

        // 如果只有 data 字段，直接返回數據
        if (Object.keys(result).length === 1 && result.data !== undefined) {
            return result.data
        }

        return result
    }

    /**
     * 獲取嵌套值
     */
    private getNestedValue(obj: any, path: string | string[]): any {
        const paths = Array.isArray(path) ? path : [path]

        for (const p of paths) {
            const value = p.split('.').reduce((acc, key) => acc?.[key], obj)
            if (value !== undefined) {
                return value
            }
        }

        return undefined
    }

    /**
     * 發送請求
     */
    async request<T = any>(url: string, config: RequestConfig = {}): Promise<T> {
        const fullUrl = this.buildURL(url, config.params)
        const requestKey = this.generateRequestKey(fullUrl, config)

        // 檢查快取
        const cachedResponse = await this.handleCache(requestKey, config)
        if (cachedResponse !== null) {
            return cachedResponse
        }

        // 請求去重
        if (this.config.deduplication && config.method === 'GET') {
            const pending = this.pendingRequests.get(requestKey)
            if (pending) {
                return pending
            }
        }

        // 合併配置
        const mergedConfig: RequestConfig = {
            ...this.config,
            ...config,
            headers: {
                ...this.config.headers,
                ...config.headers
            }
        }

        // 創建請求
        const requestPromise = this.executeWithRetry(async () => {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), mergedConfig.timeout!)

            try {
                const response = await fetch(fullUrl, {
                    method: mergedConfig.method || 'GET',
                    headers: mergedConfig.headers,
                    body: this.prepareBody(mergedConfig.body, mergedConfig.headers),
                    credentials: mergedConfig.credentials,
                    signal: config.signal || controller.signal
                })

                clearTimeout(timeoutId)

                const result = await this.handleResponse(response, mergedConfig)

                // 保存到快取
                await this.saveToCache(requestKey, result, mergedConfig)

                return result
            } catch (error: any) {
                clearTimeout(timeoutId)

                if (error.name === 'AbortError') {
                    throw this.createError('Request timeout', 'TIMEOUT', mergedConfig)
                }

                throw error
            }
        }, mergedConfig)

        // 保存到待處理請求
        if (this.config.deduplication && config.method === 'GET') {
            this.pendingRequests.set(requestKey, requestPromise)
            requestPromise.finally(() => {
                this.pendingRequests.delete(requestKey)
            })
        }

        return requestPromise
    }

    /**
     * 準備請求體
     */
    private prepareBody(body: any, headers?: Record<string, string>): any {
        if (!body) return undefined

        if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
            return body
        }

        if (headers?.['Content-Type']?.includes('application/json')) {
            return JSON.stringify(body)
        }

        return body
    }

    // HTTP 方法快捷方式
    async get<T = any>(url: string, config?: Omit<RequestConfig, 'method'>): Promise<T> {
        return this.request<T>(url, {...config, method: 'GET'})
    }

    async post<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
        return this.request<T>(url, {...config, method: 'POST', body: data})
    }

    async put<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
        return this.request<T>(url, {...config, method: 'PUT', body: data})
    }

    async delete<T = any>(url: string, config?: Omit<RequestConfig, 'method'>): Promise<T> {
        return this.request<T>(url, {...config, method: 'DELETE'})
    }

    async patch<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
        return this.request<T>(url, {...config, method: 'PATCH', body: data})
    }

    async head<T = any>(url: string, config?: Omit<RequestConfig, 'method'>): Promise<T> {
        return this.request<T>(url, {...config, method: 'HEAD'})
    }

    async options<T = any>(url: string, config?: Omit<RequestConfig, 'method'>): Promise<T> {
        return this.request<T>(url, {...config, method: 'OPTIONS'})
    }
}

/**
 * 創建 HTTP 客戶端
 */
export function createHttpClient(config: ApiClientConfig): HttpClient {
    return new HttpClientImpl(config)
}
