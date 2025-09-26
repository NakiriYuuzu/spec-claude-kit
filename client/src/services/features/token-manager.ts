/**
 * Token 管理器 - 提供靈活的 Token 存儲和管理
 */

import type { TokenManager } from '@/services'

/**
 * Token 存儲介面
 */
export interface TokenStorage {
    getItem(key: string): string | null | Promise<string | null>

    setItem(key: string, value: string): void | Promise<void>

    removeItem(key: string): void | Promise<void>
}

/**
 * 瀏覽器 LocalStorage 存儲
 */
export class LocalStorageTokenStorage implements TokenStorage {
    getItem(key: string): string | null {
        if (typeof window === 'undefined') return null
        return localStorage.getItem(key)
    }

    setItem(key: string, value: string): void {
        if (typeof window === 'undefined') return
        localStorage.setItem(key, value)
    }

    removeItem(key: string): void {
        if (typeof window === 'undefined') return
        localStorage.removeItem(key)
    }
}

/**
 * 瀏覽器 SessionStorage 存儲
 */
export class SessionStorageTokenStorage implements TokenStorage {
    getItem(key: string): string | null {
        if (typeof window === 'undefined') return null
        return sessionStorage.getItem(key)
    }

    setItem(key: string, value: string): void {
        if (typeof window === 'undefined') return
        sessionStorage.setItem(key, value)
    }

    removeItem(key: string): void {
        if (typeof window === 'undefined') return
        sessionStorage.removeItem(key)
    }
}

/**
 * 記憶體存儲
 */
export class MemoryTokenStorage implements TokenStorage {
    private storage = new Map<string, string>()

    getItem(key: string): string | null {
        return this.storage.get(key) || null
    }

    setItem(key: string, value: string): void {
        this.storage.set(key, value)
    }

    removeItem(key: string): void {
        this.storage.delete(key)
    }
}

/**
 * Cookie 存儲
 */
export class CookieTokenStorage implements TokenStorage {
    private domain?: string
    private path: string = '/'
    private secure: boolean = true
    private sameSite: 'strict' | 'lax' | 'none' = 'lax'

    constructor(options?: {
        domain?: string
        path?: string
        secure?: boolean
        sameSite?: 'strict' | 'lax' | 'none'
    }) {
        if (options) {
            this.domain = options.domain
            this.path = options.path || '/'
            this.secure = options.secure ?? true
            this.sameSite = options.sameSite || 'lax'
        }
    }

    getItem(key: string): string | null {
        if (typeof document === 'undefined') return null

        const name = key + '='
        const cookies = document.cookie.split(';')

        for (let cookie of cookies) {
            cookie = cookie.trim()
            if (cookie.indexOf(name) === 0) {
                return decodeURIComponent(cookie.substring(name.length))
            }
        }

        return null
    }

    setItem(key: string, value: string): void {
        if (typeof document === 'undefined') return

        const cookieParts = [
            `${key}=${encodeURIComponent(value)}`,
            `path=${this.path}`,
            `SameSite=${this.sameSite}`
        ]

        if (this.domain) {
            cookieParts.push(`domain=${this.domain}`)
        }

        if (this.secure) {
            cookieParts.push('Secure')
        }

        document.cookie = cookieParts.join('; ')
    }

    removeItem(key: string): void {
        if (typeof document === 'undefined') return

        document.cookie = `${key}=; path=${this.path}; expires=Thu, 01 Jan 1970 00:00:00 UTC`
    }
}

/**
 * 基礎 Token 管理器
 */
export class BaseTokenManager implements TokenManager {
    protected storage: TokenStorage
    protected tokenKey: string
    protected tokenType: string

    constructor(options?: {
        storage?: TokenStorage
        tokenKey?: string
        tokenType?: string
    }) {
        this.storage = options?.storage || new LocalStorageTokenStorage()
        this.tokenKey = options?.tokenKey || 'auth_token'
        this.tokenType = options?.tokenType || 'Bearer'
    }

    async getToken(): Promise<string | null> {
        return await this.storage.getItem(this.tokenKey)
    }

    async setToken(token: string | null): Promise<void> {
        if (token) {
            await this.storage.setItem(this.tokenKey, token)
        } else {
            await this.storage.removeItem(this.tokenKey)
        }
    }

    async removeToken(): Promise<void> {
        await this.storage.removeItem(this.tokenKey)
    }

    getTokenType(): string {
        return this.tokenType
    }
}

/**
 * JWT Token 管理器
 */
export class JWTTokenManager extends BaseTokenManager {
    private refreshTokenKey: string
    private refreshThreshold: number

    constructor(options?: {
        storage?: TokenStorage
        tokenKey?: string
        refreshTokenKey?: string
        tokenType?: string
        refreshThreshold?: number
    }) {
        super(options)
        this.refreshTokenKey = options?.refreshTokenKey || 'refresh_token'
        this.refreshThreshold = options?.refreshThreshold || 300000 // 5 分鐘
    }

    async getRefreshToken(): Promise<string | null> {
        return await this.storage.getItem(this.refreshTokenKey)
    }

    async setRefreshToken(token: string | null): Promise<void> {
        if (token) {
            await this.storage.setItem(this.refreshTokenKey, token)
        } else {
            await this.storage.removeItem(this.refreshTokenKey)
        }
    }

    async setTokens(accessToken: string | null, refreshToken?: string | null): Promise<void> {
        await this.setToken(accessToken)
        if (refreshToken !== undefined) {
            await this.setRefreshToken(refreshToken)
        }
    }

    async isTokenExpired(): Promise<boolean> {
        const token = await this.getToken()
        if (!token) return true

        try {
            // 解析 JWT
            const payload = this.parseJWT(token)
            if (!payload.exp) return false

            // 檢查是否過期（考慮刷新閾值）
            const expiryTime = payload.exp * 1000
            const currentTime = Date.now()
            return currentTime >= (expiryTime - this.refreshThreshold)
        } catch {
            return true
        }
    }

    private parseJWT(token: string): any {
        try {
            const base64Url = token.split('.')[1]
            if (!base64Url) throw new Error('Invalid JWT token')
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            )
            return JSON.parse(jsonPayload)
        } catch {
            throw new Error('Invalid JWT token')
        }
    }

    async getTokenPayload(): Promise<any | null> {
        const token = await this.getToken()
        if (!token) return null

        try {
            return this.parseJWT(token)
        } catch {
            return null
        }
    }
}

/**
 * OAuth Token 管理器
 */
export class OAuthTokenManager extends BaseTokenManager {
    private refreshTokenKey: string
    private expiresAtKey: string

    constructor(options?: {
        storage?: TokenStorage
        tokenKey?: string
        refreshTokenKey?: string
        expiresAtKey?: string
        tokenType?: string
    }) {
        super(options)
        this.refreshTokenKey = options?.refreshTokenKey || 'refresh_token'
        this.expiresAtKey = options?.expiresAtKey || 'expires_at'
    }

    async getRefreshToken(): Promise<string | null> {
        return await this.storage.getItem(this.refreshTokenKey)
    }

    async setTokens(
        accessToken: string | null,
        refreshToken?: string | null,
        expiresIn?: number
    ): Promise<void> {
        await this.setToken(accessToken)

        if (refreshToken !== undefined) {
            if (refreshToken) {
                await this.storage.setItem(this.refreshTokenKey, refreshToken)
            } else {
                await this.storage.removeItem(this.refreshTokenKey)
            }
        }

        if (expiresIn !== undefined && accessToken) {
            const expiresAt = Date.now() + expiresIn * 1000
            await this.storage.setItem(this.expiresAtKey, expiresAt.toString())
        }
    }

    async isTokenExpired(): Promise<boolean> {
        const token = await this.getToken()
        if (!token) return true

        const expiresAt = await this.storage.getItem(this.expiresAtKey)
        if (!expiresAt) return false

        return Date.now() >= parseInt(expiresAt, 10)
    }

    async removeToken(): Promise<void> {
        await super.removeToken()
        await this.storage.removeItem(this.refreshTokenKey)
        await this.storage.removeItem(this.expiresAtKey)
    }
}

/**
 * 創建 Token 管理器
 */
export function createTokenManager(type: 'basic' | 'jwt' | 'oauth' = 'basic', options?: any): TokenManager {
    switch (type) {
        case 'jwt':
            return new JWTTokenManager(options)
        case 'oauth':
            return new OAuthTokenManager(options)
        default:
            return new BaseTokenManager(options)
    }
}
