/**
 * 攔截器系統 - 提供請求/響應生命週期鉤子
 */

import type {
    Interceptor,
    RequestConfig,
    ApiError,
    RequestInterceptor,
    ResponseInterceptor,
    ErrorInterceptor
} from './types'

/**
 * 攔截器管理器
 */
export class InterceptorManager {
    private requestInterceptors: RequestInterceptor[] = []
    private responseInterceptors: ResponseInterceptor[] = []
    private errorInterceptors: ErrorInterceptor[] = []

    /**
     * 添加攔截器
     */
    use(interceptor: Interceptor): () => void {
        const removeCallbacks: Array<() => void> = []

        if (interceptor.request) {
            this.requestInterceptors.push(interceptor.request)
            removeCallbacks.push(() => {
                const index = this.requestInterceptors.indexOf(interceptor.request!)
                if (index !== -1) {
                    this.requestInterceptors.splice(index, 1)
                }
            })
        }

        if (interceptor.response) {
            this.responseInterceptors.push(interceptor.response)
            removeCallbacks.push(() => {
                const index = this.responseInterceptors.indexOf(interceptor.response!)
                if (index !== -1) {
                    this.responseInterceptors.splice(index, 1)
                }
            })
        }

        if (interceptor.error) {
            this.errorInterceptors.push(interceptor.error)
            removeCallbacks.push(() => {
                const index = this.errorInterceptors.indexOf(interceptor.error!)
                if (index !== -1) {
                    this.errorInterceptors.splice(index, 1)
                }
            })
        }

        // 返回移除函數
        return () => {
            removeCallbacks.forEach(remove => remove())
        }
    }

    /**
     * 執行請求攔截器
     */
    async executeRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
        let currentConfig = config

        for (const interceptor of this.requestInterceptors) {
            try {
                if (interceptor.onFulfilled) {
                    currentConfig = await interceptor.onFulfilled(currentConfig)
                }
            } catch (error) {
                if (interceptor.onRejected) {
                    currentConfig = await interceptor.onRejected(error)
                } else {
                    throw error
                }
            }
        }

        return currentConfig
    }

    /**
     * 執行響應攔截器
     */
    async executeResponseInterceptors(response: any): Promise<any> {
        let currentResponse = response

        for (const interceptor of this.responseInterceptors) {
            try {
                if (interceptor.onFulfilled) {
                    currentResponse = await interceptor.onFulfilled(currentResponse)
                }
            } catch (error) {
                if (interceptor.onRejected) {
                    currentResponse = await interceptor.onRejected(error)
                } else {
                    throw error
                }
            }
        }

        return currentResponse
    }

    /**
     * 執行錯誤攔截器
     */
    async executeErrorInterceptors(error: ApiError): Promise<any> {
        let currentError = error

        for (const interceptor of this.errorInterceptors) {
            try {
                currentError = await interceptor(currentError)
            } catch (newError: any) {
                currentError = newError
            }
        }

        throw currentError
    }

    /**
     * 清除所有攔截器
     */
    clear(): void {
        this.requestInterceptors = []
        this.responseInterceptors = []
        this.errorInterceptors = []
    }
}

/**
 * 預設攔截器
 */

/**
 * 授權攔截器
 */
export function createAuthInterceptor(tokenManager?: {
    getToken: () => string | null | Promise<string | null>
}): Interceptor {
    return {
        request: {
            onFulfilled: async (config) => {
                if (tokenManager) {
                    const token = await tokenManager.getToken()
                    if (token && !config.headers?.['Authorization']) {
                        config.headers = {
                            ...config.headers,
                            Authorization: `Bearer ${token}`
                        }
                    }
                }
                return config
            }
        }
    }
}

/**
 * 日誌攔截器
 */
export function createLoggingInterceptor(logger?: {
    log: (message: string, data?: any) => void
}): Interceptor {
    const log = logger?.log || console.log

    return {
        request: {
            onFulfilled: (config) => {
                log(`[API Request] ${config.method} ${config.params ? 'with params' : ''}`, {
                    method: config.method,
                    params: config.params,
                    headers: config.headers
                })
                return config
            }
        },
        response: {
            onFulfilled: (response) => {
                log('[API Response]', response)
                return response
            },
            onRejected: (error) => {
                log('[API Error]', error)
                throw error
            }
        }
    }
}

/**
 * 超時攔截器
 */
export function createTimeoutInterceptor(defaultTimeout: number = 30000): Interceptor {
    return {
        request: {
            onFulfilled: (config) => {
                if (!config.timeout) {
                    config.timeout = defaultTimeout
                }
                return config
            }
        }
    }
}

/**
 * 基礎 URL 攔截器
 */
export function createBaseURLInterceptor(baseURL: string): Interceptor {
    return {
        request: {
            onFulfilled: (config) => {
                // 處理相對路徑
                if (config.params?.url && !config.params.url.startsWith('http')) {
                    config.params.url = baseURL + (config.params.url.startsWith('/') ? config.params.url : `/${config.params.url}`)
                }
                return config
            }
        }
    }
}

/**
 * 錯誤重試攔截器
 */
export function createRetryInterceptor(maxRetries: number = 3, delay: number = 1000): Interceptor {
    const retryCount = new WeakMap<RequestConfig, number>()

    return {
        response: {
            onRejected: async (error) => {
                const config = error.config
                if (!config) throw error

                const count = retryCount.get(config) || 0
                if (count >= maxRetries) {
                    retryCount.delete(config)
                    throw error
                }

                // 只重試特定錯誤
                if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR' ||
                    (typeof error.code === 'number' && [408, 429, 500, 502, 503, 504].includes(error.code))) {
                    retryCount.set(config, count + 1)

                    // 延遲重試
                    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, count)))

                    // 重新發送請求
                    return Promise.reject({...error, retry: true})
                }

                throw error
            }
        }
    }
}

/**
 * 請求轉換攔截器
 */
export function createTransformRequestInterceptor(
    transformer: (data: any, headers?: Record<string, string>) => any
): Interceptor {
    return {
        request: {
            onFulfilled: (config) => {
                if (config.body && config.headers) {
                    config.body = transformer(config.body, config.headers)
                }
                return config
            }
        }
    }
}

/**
 * 響應轉換攔截器
 */
export function createTransformResponseInterceptor(
    transformer: (data: any) => any
): Interceptor {
    return {
        response: {
            onFulfilled: (response) => {
                return transformer(response)
            }
        }
    }
}

/**
 * 進度攔截器（用於上傳/下載）
 */
export function createProgressInterceptor(
    onProgress?: (progress: { loaded: number; total: number; percent: number }) => void
): Interceptor {
    return {
        request: {
            onFulfilled: (config) => {
                // 這裡可以添加 XMLHttpRequest 的進度監聽
                // 但由於 fetch API 不支援上傳進度，這裡只是預留介面
                return config
            }
        }
    }
}

/**
 * 快取攔截器
 */
export function createCacheInterceptor(cache: Map<string, any>, ttl: number = 300000): Interceptor {
    return {
        request: {
            onFulfilled: (config) => {
                if (config.method === 'GET' && config.cache?.enabled !== false) {
                    const key = JSON.stringify({url: config.params?.url, params: config.params})
                    const cached = cache.get(key)
                    if (cached && Date.now() - cached.timestamp < ttl) {
                        // 返回快取的響應
                        return Promise.reject({cached: true, data: cached.data})
                    }
                }
                return config
            }
        },
        response: {
            onFulfilled: (response) => {
                // 快取 GET 請求的響應
                const config = response.config
                if (config?.method === 'GET' && config.cache?.enabled !== false) {
                    const key = JSON.stringify({url: config.params?.url, params: config.params})
                    cache.set(key, {data: response, timestamp: Date.now()})
                }
                return response
            }
        }
    }
}

/**
 * 防抖攔截器
 */
export function createDebounceInterceptor(delay: number = 300): Interceptor {
    const pending = new Map<string, number>()

    return {
        request: {
            onFulfilled: (config) => {
                const key = JSON.stringify({
                    method: config.method,
                    url: config.params?.url,
                    params: config.params
                })

                // 取消之前的請求
                const timer = pending.get(key)
                if (timer) {
                    clearTimeout(timer)
                }

                // 設置新的延遲
                return new Promise((resolve) => {
                    const newTimer = setTimeout(() => {
                        pending.delete(key)
                        resolve(config)
                    }, delay)
                    pending.set(key, newTimer)
                })
            }
        }
    }
}

/**
 * 併發控制攔截器
 */
export function createConcurrencyInterceptor(maxConcurrent: number = 5): Interceptor {
    let running = 0
    const queue: Array<() => void> = []

    return {
        request: {
            onFulfilled: async (config) => {
                if (running >= maxConcurrent) {
                    await new Promise<void>(resolve => {
                        queue.push(resolve)
                    })
                }
                running++
                return config
            }
        },
        response: {
            onFulfilled: (response) => {
                running--
                const next = queue.shift()
                if (next) next()
                return response
            },
            onRejected: (error) => {
                running--
                const next = queue.shift()
                if (next) next()
                throw error
            }
        }
    }
}
