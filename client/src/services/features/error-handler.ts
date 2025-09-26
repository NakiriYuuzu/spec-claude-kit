/**
 * 錯誤處理器 - 提供統一的錯誤處理機制
 */

import type { ApiError, RequestConfig } from '@/services'

/**
 * 錯誤類型常量
 */
export const ErrorType = {
    NETWORK: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT_ERROR',
    AUTHENTICATION: 'AUTHENTICATION_ERROR',
    AUTHORIZATION: 'AUTHORIZATION_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND_ERROR',
    SERVER: 'SERVER_ERROR',
    CLIENT: 'CLIENT_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR'
} as const

export type ErrorType = typeof ErrorType[keyof typeof ErrorType]

/**
 * 錯誤嚴重程度常量
 */
export const ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
} as const

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity]

/**
 * 錯誤處理策略
 */
export interface ErrorHandler {
    /** 判斷是否可以處理此錯誤 */
    canHandle(error: ApiError): boolean

    /** 處理錯誤 */
    handle(error: ApiError): Promise<any> | any

    /** 獲取錯誤類型 */
    getErrorType?(error: ApiError): ErrorType

    /** 獲取錯誤嚴重程度 */
    getSeverity?(error: ApiError): ErrorSeverity
}

/**
 * 錯誤回報器介面
 */
export interface ErrorReporter {
    report(error: ApiError, context?: any): Promise<void> | void
}

/**
 * 基礎錯誤處理器
 */
export class BaseErrorHandler {
    protected handlers: ErrorHandler[] = []
    protected reporters: ErrorReporter[] = []
    protected defaultMessages: Map<ErrorType, string> = new Map([
        [ErrorType.NETWORK, '網絡連接失敗，請檢查您的網絡設置'],
        [ErrorType.TIMEOUT, '請求超時，請稍後重試'],
        [ErrorType.AUTHENTICATION, '身份驗證失敗，請重新登錄'],
        [ErrorType.AUTHORIZATION, '您沒有權限執行此操作'],
        [ErrorType.VALIDATION, '請求數據格式錯誤'],
        [ErrorType.NOT_FOUND, '請求的資源不存在'],
        [ErrorType.SERVER, '服務器錯誤，請稍後重試'],
        [ErrorType.CLIENT, '客戶端錯誤，請檢查您的請求'],
        [ErrorType.UNKNOWN, '發生未知錯誤']
    ])

    /**
     * 添加錯誤處理器
     */
    addHandler(handler: ErrorHandler): void {
        this.handlers.push(handler)
    }

    /**
     * 添加錯誤回報器
     */
    addReporter(reporter: ErrorReporter): void {
        this.reporters.push(reporter)
    }

    /**
     * 處理錯誤
     */
    async handleError(error: ApiError): Promise<any> {
        // 嘗試使用處理器處理
        for (const handler of this.handlers) {
            if (handler.canHandle(error)) {
                try {
                    const result = await handler.handle(error)
                    if (result !== undefined) {
                        return result
                    }
                } catch (handlerError) {
                    console.error('Error handler failed:', handlerError)
                }
            }
        }

        // 回報錯誤
        await this.reportError(error)

        // 返回友好的錯誤訊息
        return this.createUserFriendlyError(error)
    }

    /**
     * 回報錯誤
     */
    protected async reportError(error: ApiError): Promise<void> {
        const promises = this.reporters.map(reporter => {
            try {
                return reporter.report(error, {
                    timestamp: Date.now(),
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
                    url: typeof window !== 'undefined' ? window.location.href : undefined
                })
            } catch (reportError) {
                console.error('Error reporter failed:', reportError)
            }
        })

        await Promise.allSettled(promises)
    }

    /**
     * 創建用戶友好的錯誤
     */
    protected createUserFriendlyError(error: ApiError): ApiError {
        const errorType = this.getErrorType(error)
        const friendlyMessage = this.defaultMessages.get(errorType) || error.message

        return {
            ...error,
            message: friendlyMessage,
            code: errorType,
            details: {
                originalMessage: error.message,
                type: errorType,
                severity: this.getErrorSeverity(error)
            }
        }
    }

    /**
     * 獲取錯誤類型
     */
    protected getErrorType(error: ApiError): ErrorType {
        // 嘗試從處理器獲取
        for (const handler of this.handlers) {
            if (handler.canHandle(error) && handler.getErrorType) {
                const type = handler.getErrorType(error)
                if (type) return type
            }
        }

        // 根據錯誤碼判斷
        const code = typeof error.code === 'number' ? error.code : error.code

        // 檢查特定的錯誤碼字串
        if (code === 'TIMEOUT' || error.message?.toLowerCase().includes('timeout')) {
            return ErrorType.TIMEOUT
        } else if (code === 'UNKNOWN' || code === 'UNKNOWN_ERROR') {
            return ErrorType.UNKNOWN
        } else if (code === 'NETWORK' || code === 'NETWORK_ERROR') {
            return ErrorType.NETWORK
        }

        // 數字錯誤碼
        const numCode = typeof code === 'number' ? code : 0

        if (numCode === 0 || error.message?.toLowerCase().includes('network')) {
            return ErrorType.NETWORK
        } else if (numCode === 408) {
            return ErrorType.TIMEOUT
        } else if (numCode === 401) {
            return ErrorType.AUTHENTICATION
        } else if (numCode === 403) {
            return ErrorType.AUTHORIZATION
        } else if (numCode === 404) {
            return ErrorType.NOT_FOUND
        } else if (numCode === 422 || numCode === 400) {
            return ErrorType.VALIDATION
        } else if (numCode >= 500) {
            return ErrorType.SERVER
        } else if (numCode >= 400) {
            return ErrorType.CLIENT
        }

        return ErrorType.UNKNOWN
    }

    /**
     * 獲取錯誤嚴重程度
     */
    protected getErrorSeverity(error: ApiError): ErrorSeverity {
        // 嘗試從處理器獲取
        for (const handler of this.handlers) {
            if (handler.canHandle(error) && handler.getSeverity) {
                const severity = handler.getSeverity(error)
                if (severity) return severity
            }
        }

        const errorType = this.getErrorType(error)

        switch (errorType) {
            case ErrorType.NETWORK:
            case ErrorType.TIMEOUT:
                return ErrorSeverity.HIGH
            case ErrorType.AUTHENTICATION:
            case ErrorType.AUTHORIZATION:
            case ErrorType.SERVER:
                return ErrorSeverity.CRITICAL
            case ErrorType.VALIDATION:
            case ErrorType.NOT_FOUND:
                return ErrorSeverity.MEDIUM
            default:
                return ErrorSeverity.LOW
        }
    }

    /**
     * 設置默認錯誤訊息
     */
    setDefaultMessage(type: ErrorType, message: string): void {
        this.defaultMessages.set(type, message)
    }
}

/**
 * 網絡錯誤處理器
 */
export class NetworkErrorHandler implements ErrorHandler {
    canHandle(error: ApiError): boolean {
        return error.code === 0 ||
            error.code === 'NETWORK_ERROR' ||
            error.message?.toLowerCase().includes('network')
    }

    handle(error: ApiError): any {
        // 可以在這裡實現重連邏輯
        return {
            ...error,
            retry: true,
            retryDelay: 3000
        }
    }

    getErrorType(): ErrorType {
        return ErrorType.NETWORK
    }
}

/**
 * 認證錯誤處理器
 */
export class AuthErrorHandler implements ErrorHandler {
    private onAuthError?: () => void

    constructor(onAuthError?: () => void) {
        this.onAuthError = onAuthError
    }

    canHandle(error: ApiError): boolean {
        return error.code === 401 || error.code === 'AUTHENTICATION_ERROR'
    }

    handle(error: ApiError): any {
        // 觸發認證失敗回調（如跳轉到登錄頁）
        if (this.onAuthError) {
            this.onAuthError()
        }
    }

    getErrorType(): ErrorType {
        return ErrorType.AUTHENTICATION
    }

    getSeverity(): ErrorSeverity {
        return ErrorSeverity.CRITICAL
    }
}

/**
 * 驗證錯誤處理器
 */
export class ValidationErrorHandler implements ErrorHandler {
    canHandle(error: ApiError): boolean {
        return error.code === 422 ||
            error.code === 400 ||
            error.code === 'VALIDATION_ERROR'
    }

    handle(error: ApiError): any {
        // 解析驗證錯誤詳情
        const validationErrors = this.parseValidationErrors(error)

        return {
            ...error,
            validationErrors,
            fields: Object.keys(validationErrors)
        }
    }

    private parseValidationErrors(error: ApiError): Record<string, string[]> {
        // 嘗試從不同格式解析驗證錯誤
        if (error.details?.errors) {
            return error.details.errors
        }

        if (error.details?.fields) {
            return error.details.fields
        }

        // Laravel 格式
        if (error.details?.message && typeof error.details.message === 'object') {
            return error.details.message
        }

        return {}
    }

    getErrorType(): ErrorType {
        return ErrorType.VALIDATION
    }

    getSeverity(): ErrorSeverity {
        return ErrorSeverity.MEDIUM
    }
}

/**
 * 控制台錯誤回報器
 */
export class ConsoleErrorReporter implements ErrorReporter {
    report(error: ApiError, context?: any): void {
        console.error('[API Error]', {
            error,
            context,
            stack: new Error().stack
        })
    }
}

/**
 * 遠程錯誤回報器
 */
export class RemoteErrorReporter implements ErrorReporter {
    private endpoint: string

    constructor(endpoint: string) {
        this.endpoint = endpoint
    }

    async report(error: ApiError, context?: any): Promise<void> {
        try {
            await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: {
                        code: error.code,
                        message: error.message,
                        timestamp: error.timestamp,
                        details: error.details
                    },
                    context
                })
            })
        } catch (reportError) {
            console.error('Failed to report error to remote server:', reportError)
        }
    }
}

/**
 * 創建錯誤處理器
 */
export function createErrorHandler(options?: {
    handlers?: ErrorHandler[]
    reporters?: ErrorReporter[]
    onAuthError?: () => void
}): BaseErrorHandler {
    const errorHandler = new BaseErrorHandler()

    // 添加默認處理器
    errorHandler.addHandler(new NetworkErrorHandler())
    errorHandler.addHandler(new AuthErrorHandler(options?.onAuthError))
    errorHandler.addHandler(new ValidationErrorHandler())

    // 添加自定義處理器
    options?.handlers?.forEach(handler => errorHandler.addHandler(handler))

    // 添加默認回報器
    if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'development') {
        errorHandler.addReporter(new ConsoleErrorReporter())
    } else if (typeof window !== 'undefined' && import.meta.env?.VITE_APP_API_DEV) {
        errorHandler.addReporter(new ConsoleErrorReporter())
    }

    // 添加自定義回報器
    options?.reporters?.forEach(reporter => errorHandler.addReporter(reporter))

    return errorHandler
}
