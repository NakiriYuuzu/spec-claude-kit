/**
 * 主要 API 客戶端 - 整合所有模組的統一介面
 */

import { HttpClientImpl } from './core/http-client'
import { InterceptorManager } from './core/interceptors'
import type {
    ApiClientConfig,
    HttpClient,
    RequestConfig,
    TokenManager,
    StateManager,
    Interceptor,
    ApiError,
    UploadConfig,
    DownloadConfig
} from './core/types'
import { createErrorHandler, type BaseErrorHandler } from './features/error-handler'
import { FileHandler } from './features/file-handler'
import { mergeConfig } from './config/defaults'

/**
 * API 客戶端類
 */
export class ApiClient {
    private httpClient: HttpClient
    private interceptorManager: InterceptorManager
    private errorHandler: BaseErrorHandler
    private fileHandler: FileHandler
    private config: ApiClientConfig
    private tokenManager?: TokenManager
    private stateManager?: StateManager

    constructor(config: ApiClientConfig) {
        this.config = config
        this.interceptorManager = new InterceptorManager()

        // 創建 HTTP 客戶端，注入攔截器
        this.httpClient = new HttpClientProxyWithInterceptors(
            new HttpClientImpl(config),
            this.interceptorManager
        )

        // 初始化功能模組
        this.errorHandler = createErrorHandler({
            onAuthError: config.tokenManager ? () => {
                config.tokenManager?.removeToken()
            } : undefined
        })
        this.fileHandler = new FileHandler(this.httpClient)

        // 設置管理器
        this.tokenManager = config.tokenManager
        this.stateManager = config.stateManager

        // 註冊默認攔截器
        this.registerDefaultInterceptors()
    }

    /**
     * 註冊默認攔截器
     */
    private registerDefaultInterceptors(): void {
        // Token 攔截器
        if (this.tokenManager) {
            this.interceptorManager.use({
                request: {
                    onFulfilled: async (config) => {
                        const token = await this.tokenManager!.getToken()
                        if (token && !config.headers?.['Authorization']) {
                            config.headers = {
                                ...config.headers,
                                Authorization: `${this.tokenManager!.getTokenType?.()} ${token}`.trim()
                            }
                        }
                        return config
                    }
                }
            })
        }

        // 錯誤處理攔截器
        this.interceptorManager.use({
            response: {
                onRejected: async (error) => {
                    // 如果有用戶定義的錯誤處理器，則使用它
                    if (this.config.errorHandler) {
                        await this.config.errorHandler.handleError(error)
                    }
                    // 使用內建錯誤處理器進行轉換
                    const handled = await this.errorHandler.handleError(error)
                    throw handled || error
                }
            }
        })

        // 添加用戶定義的攔截器
        this.config.interceptors?.forEach(interceptor => {
            this.interceptorManager.use(interceptor)
        })
    }

    /**
     * 發送請求（帶狀態管理）
     */
    private async requestWithState<T = any>(
        method: () => Promise<T>,
        options: {
            loadingKey?: string
            silent?: boolean
            onSuccess?: (data: T) => void
            onError?: (error: ApiError) => void
        } = {}
    ): Promise<{ success: boolean; data?: T; error?: ApiError }> {
        const loadingKey = options.loadingKey || 'global'

        try {
            // 設置加載狀態
            if (!options.silent && this.stateManager) {
                this.stateManager.setLoading(loadingKey, true)
            }

            // 執行請求
            const data = await method()

            // 成功回調
            options.onSuccess?.(data)

            return {success: true, data}
        } catch (error: any) {
            // 錯誤處理
            const apiError: ApiError = {
                code: error.code || 500,
                message: error.message || 'Unknown error',
                timestamp: Date.now(),
                details: error
            }

            if (!options.silent && this.stateManager) {
                this.stateManager.addError(apiError)
            }

            options.onError?.(apiError)

            return {success: false, error: apiError}
        } finally {
            // 清除加載狀態
            if (!options.silent && this.stateManager) {
                this.stateManager.setLoading(loadingKey, false)
            }
        }
    }

    // HTTP 方法
    async get<T = any>(url: string, params?: Record<string, any>, config?: RequestConfig): Promise<T> {
        return this.httpClient.get<T>(url, {...config, params})
    }

    async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
        return this.httpClient.post<T>(url, data, config)
    }

    async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
        return this.httpClient.put<T>(url, data, config)
    }

    async delete<T = any>(url: string, config?: RequestConfig): Promise<T> {
        return this.httpClient.delete<T>(url, config)
    }

    async patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
        return this.httpClient.patch<T>(url, data, config)
    }

    async head<T = any>(url: string, config?: RequestConfig): Promise<T> {
        return this.httpClient.head<T>(url, config)
    }

    async options<T = any>(url: string, config?: RequestConfig): Promise<T> {
        return this.httpClient.options<T>(url, config)
    }

    // 帶狀態管理的 HTTP 方法
    async getWithState<T = any>(
        url: string,
        params?: Record<string, any>,
        options?: Parameters<typeof this.requestWithState>[1],
        config?: RequestConfig
    ) {
        return this.requestWithState(() => this.get<T>(url, params, config), options)
    }

    async postWithState<T = any>(
        url: string,
        data?: any,
        options?: Parameters<typeof this.requestWithState>[1],
        config?: RequestConfig
    ) {
        return this.requestWithState(() => this.post<T>(url, data, config), options)
    }

    async putWithState<T = any>(
        url: string,
        data?: any,
        options?: Parameters<typeof this.requestWithState>[1],
        config?: RequestConfig
    ) {
        return this.requestWithState(() => this.put<T>(url, data, config), options)
    }

    async deleteWithState<T = any>(
        url: string,
        options?: Parameters<typeof this.requestWithState>[1],
        config?: RequestConfig
    ) {
        return this.requestWithState(() => this.delete<T>(url, config), options)
    }

    async patchWithState<T = any>(
        url: string,
        data?: any,
        options?: Parameters<typeof this.requestWithState>[1],
        config?: RequestConfig
    ) {
        return this.requestWithState(() => this.patch<T>(url, data, config), options)
    }

    // 檔案操作
    async upload<T = any>(url: string, file: File, options?: UploadConfig): Promise<T> {
        return this.fileHandler.uploadFile<T>(url, file, options)
    }

    async uploadMultiple<T = any>(url: string, files: File[], options?: UploadConfig): Promise<T> {
        return this.fileHandler.uploadFiles<T>(url, files, options)
    }

    async download(url: string, options?: DownloadConfig): Promise<void> {
        return this.fileHandler.downloadFile(url, options)
    }

    async downloadAsBlob(url: string, options?: DownloadConfig): Promise<Blob> {
        return this.fileHandler.downloadAsBlob(url, options)
    }

    // 攔截器管理
    use(interceptor: Interceptor): () => void {
        return this.interceptorManager.use(interceptor)
    }

    // 配置管理
    setBaseURL(baseURL: string): void {
        this.config.baseURL = baseURL
    }

    setHeaders(headers: Record<string, string>, override = false): void {
        if (override) {
            this.config.headers = headers
        } else {
            this.config.headers = {...this.config.headers, ...headers}
        }
    }

    setHeader(key: string, value: string): void {
        this.config.headers = {...this.config.headers, [key]: value}
    }

    removeHeader(key: string): void {
        if (this.config.headers) {
            delete this.config.headers[key]
        }
    }

    // Token 管理
    setTokenManager(tokenManager: TokenManager): void {
        this.tokenManager = tokenManager
    }

    getTokenManager(): TokenManager | undefined {
        return this.tokenManager
    }

    // 狀態管理
    setStateManager(stateManager: StateManager): void {
        this.stateManager = stateManager
    }

    getStateManager(): StateManager | undefined {
        return this.stateManager
    }

    // 獲取配置
    getConfig(): ApiClientConfig {
        return {...this.config}
    }
}

/**
 * HTTP 客戶端代理 - 注入攔截器
 */
class HttpClientProxyWithInterceptors implements HttpClient {
    private httpClient: HttpClient
    private interceptorManager: InterceptorManager

    constructor(
        httpClient: HttpClient,
        interceptorManager: InterceptorManager
    ) {
        this.httpClient = httpClient
        this.interceptorManager = interceptorManager
    }

    async request<T = any>(url: string, config?: RequestConfig): Promise<T> {
        // 執行請求攔截器
        const interceptedConfig = await this.interceptorManager.executeRequestInterceptors(
            config || {}
        )

        try {
            // 發送請求
            const response = await this.httpClient.request<T>(url, interceptedConfig)

            // 執行響應攔截器
            return await this.interceptorManager.executeResponseInterceptors(response)
        } catch (error: any) {
            // 執行錯誤攔截器，並拋出處理後的結果
            throw await this.interceptorManager.executeErrorInterceptors(error)
        }
    }

    async get<T = any>(url: string, config?: RequestConfig): Promise<T> {
        return this.request<T>(url, {...config, method: 'GET'})
    }

    async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
        return this.request<T>(url, {...config, method: 'POST', body: data})
    }

    async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
        return this.request<T>(url, {...config, method: 'PUT', body: data})
    }

    async delete<T = any>(url: string, config?: RequestConfig): Promise<T> {
        return this.request<T>(url, {...config, method: 'DELETE'})
    }

    async patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
        return this.request<T>(url, {...config, method: 'PATCH', body: data})
    }

    async head<T = any>(url: string, config?: RequestConfig): Promise<T> {
        return this.request<T>(url, {...config, method: 'HEAD'})
    }

    async options<T = any>(url: string, config?: RequestConfig): Promise<T> {
        return this.request<T>(url, {...config, method: 'OPTIONS'})
    }
}

/**
 * 創建 API 客戶端
 */
export function createApiClient(config: ApiClientConfig | string): ApiClient {
    const finalConfig = typeof config === 'string'
        ? {baseURL: config} as ApiClientConfig
        : config

    return new ApiClient(mergeConfig(finalConfig))
}
