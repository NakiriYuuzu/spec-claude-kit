/**
 * 核心類型定義 - 提供完整的類型系統和高度可配置性
 */

/**
 * HTTP 方法枚舉
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

/**
 * 響應類型枚舉
 */
export type ResponseType = 'json' | 'text' | 'blob' | 'arraybuffer' | 'formdata'

/**
 * 通用 API 響應介面 - 用戶可自定義結構
 * @template T 數據類型
 * @template M 元數據類型
 */
export interface ApiResponse<T = any, M = any> {
    [key: string]: any
}

/**
 * 標準 API 響應介面 - 提供預設實現
 */
export interface StandardApiResponse<T = any> {
    statusCode: number
    message: string
    data?: T
    success: boolean
    timestamp?: number
    meta?: Record<string, any>
}

/**
 * 請求配置介面
 */
export interface RequestConfig {
    /** HTTP 方法 */
    method?: HttpMethod
    /** 請求頭 */
    headers?: Record<string, string>
    /** 超時時間（毫秒） */
    timeout?: number
    /** 請求體 */
    body?: any
    /** URL 查詢參數 */
    params?: Record<string, any>
    /** 響應類型 */
    responseType?: ResponseType
    /** 憑證模式 */
    credentials?: RequestCredentials
    /** 是否返回原始響應 */
    raw?: boolean
    /** 請求信號（用於取消） */
    signal?: AbortSignal
    /** 元數據 */
    meta?: Record<string, any>
    /** 重試配置 */
    retry?: RetryConfig
    /** 快取配置 */
    cache?: CacheConfig
}

/**
 * 重試配置
 */
export interface RetryConfig {
    /** 最大重試次數 */
    maxAttempts?: number
    /** 重試延遲（毫秒） */
    delay?: number
    /** 是否指數退避 */
    exponentialBackoff?: boolean
    /** 應該重試的狀態碼 */
    retryableStatuses?: number[]
    /** 應該重試的錯誤 */
    retryableErrors?: string[]
}

/**
 * 快取配置
 */
export interface CacheConfig {
    /** 是否啟用快取 */
    enabled?: boolean
    /** 快取時間（毫秒） */
    ttl?: number
    /** 快取鍵生成器 */
    keyGenerator?: (config: RequestConfig) => string
    /** 快取存儲 */
    storage?: CacheStorage
}

/**
 * 快取存儲介面
 */
export interface CacheStorage {
    get(key: string): Promise<any>

    set(key: string, value: any, ttl?: number): Promise<void>

    delete(key: string): Promise<void>

    clear(): Promise<void>

    has(key: string): Promise<boolean>
}

/**
 * API 錯誤介面
 */
export interface ApiError {
    /** 錯誤碼 */
    code: number | string
    /** 錯誤訊息 */
    message: string
    /** 錯誤詳情 */
    details?: any
    /** 時間戳 */
    timestamp: number
    /** 請求配置 */
    config?: RequestConfig
    /** 響應 */
    response?: Response
    /** 堆疊追蹤 */
    stack?: string
}

/**
 * 攔截器介面
 */
export interface Interceptor {
    /** 請求攔截器 */
    request?: RequestInterceptor
    /** 響應攔截器 */
    response?: ResponseInterceptor
    /** 錯誤攔截器 */
    error?: ErrorInterceptor
}

/**
 * 請求攔截器
 */
export interface RequestInterceptor {
    /** 成功處理 */
    onFulfilled?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>
    /** 錯誤處理 */
    onRejected?: (error: any) => any
}

/**
 * 響應攔截器
 */
export interface ResponseInterceptor {
    /** 成功處理 */
    onFulfilled?: (response: any) => any
    /** 錯誤處理 */
    onRejected?: (error: any) => any
}

/**
 * 錯誤攔截器
 */
export interface ErrorInterceptor {
    (error: ApiError): Promise<any> | any
}

/**
 * Token 管理器介面
 */
export interface TokenManager {
    /** 獲取 token */
    getToken(): string | null | Promise<string | null>

    /** 設置 token */
    setToken(token: string | null): void | Promise<void>

    /** 刪除 token */
    removeToken(): void | Promise<void>

    /** 刷新 token */
    refreshToken?(): Promise<string | null>

    /** token 是否過期 */
    isTokenExpired?(): boolean | Promise<boolean>

    /** 獲取 token 類型 */
    getTokenType?(): string
}

/**
 * 狀態管理器介面
 */
export interface StateManager {
    /** 設置加載狀態 */
    setLoading(key: string, isLoading: boolean): void

    /** 獲取加載狀態 */
    isLoading(key?: string): boolean

    /** 添加錯誤 */
    addError(error: ApiError): void

    /** 清除錯誤 */
    clearErrors(): void

    /** 獲取錯誤列表 */
    getErrors(): ApiError[]

    /** 移除錯誤 */
    removeError(index: number): void

    /** 訂閱狀態變化 */
    subscribe?(callback: (state: any) => void): () => void
}

/**
 * 響應轉換器
 */
export interface ResponseTransformer<T = any, R = any> {
    (data: T, response?: Response): R | Promise<R>
}

/**
 * 錯誤轉換器
 */
export interface ErrorTransformer {
    (error: any): ApiError | Promise<ApiError>
}

/**
 * 響應模式配置
 */
export interface ResponseSchema {
    /** 數據字段名 */
    dataField?: string | string[]
    /** 狀態碼字段名 */
    statusField?: string | string[]
    /** 訊息字段名 */
    messageField?: string | string[]
    /** 成功字段名 */
    successField?: string | string[]
    /** 元數據字段名 */
    metaField?: string | string[]
    /** 自定義提取器 */
    extractor?: (response: any) => any
}

/**
 * API 客戶端配置
 */
export interface ApiClientConfig {
    /** 基礎 URL */
    baseURL: string
    /** 默認請求頭 */
    headers?: Record<string, string>
    /** 默認超時時間 */
    timeout?: number
    /** 響應類型 */
    responseType?: ResponseType
    /** 憑證模式 */
    credentials?: RequestCredentials
    /** 攔截器 */
    interceptors?: Interceptor[]
    /** Token 管理器 */
    tokenManager?: TokenManager
    /** 狀態管理器 */
    stateManager?: StateManager
    /** 響應轉換器 */
    responseTransformer?: ResponseTransformer
    /** 錯誤轉換器 */
    errorTransformer?: ErrorTransformer
    /** 響應模式 */
    responseSchema?: ResponseSchema
    /** 重試配置 */
    retry?: RetryConfig
    /** 快取配置 */
    cache?: CacheConfig
    /** 並發限制 */
    concurrencyLimit?: number
    /** 請求去重 */
    deduplication?: boolean
    /** 自定義驗證器 */
    validator?: ResponseValidator
}

/**
 * 響應驗證器
 */
export interface ResponseValidator {
    (response: any): boolean | Promise<boolean>
}

/**
 * HTTP 客戶端介面
 */
export interface HttpClient {
    /** 發送請求 */
    request<T = any>(url: string, config?: RequestConfig): Promise<T>

    /** GET 請求 */
    get<T = any>(url: string, config?: Omit<RequestConfig, 'method'>): Promise<T>

    /** POST 請求 */
    post<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T>

    /** PUT 請求 */
    put<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T>

    /** DELETE 請求 */
    delete<T = any>(url: string, config?: Omit<RequestConfig, 'method'>): Promise<T>

    /** PATCH 請求 */
    patch<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T>

    /** HEAD 請求 */
    head<T = any>(url: string, config?: Omit<RequestConfig, 'method'>): Promise<T>

    /** OPTIONS 請求 */
    options<T = any>(url: string, config?: Omit<RequestConfig, 'method'>): Promise<T>
}

/**
 * 進度事件
 */
export interface ProgressEvent {
    /** 已加載字節數 */
    loaded: number
    /** 總字節數 */
    total: number
    /** 進度百分比 */
    percent: number
    /** 是否可計算長度 */
    lengthComputable: boolean
}

/**
 * 上傳配置
 */
export interface UploadConfig extends RequestConfig {
    /** 進度回調 */
    onProgress?: (event: ProgressEvent) => void
    /** 文件字段名 */
    fieldName?: string
    /** 額外數據 */
    data?: Record<string, any>
}

/**
 * 下載配置
 */
export interface DownloadConfig extends RequestConfig {
    /** 進度回調 */
    onProgress?: (event: ProgressEvent) => void
    /** 文件名 */
    filename?: string
    /** 是否自動下載 */
    autoDownload?: boolean
}
