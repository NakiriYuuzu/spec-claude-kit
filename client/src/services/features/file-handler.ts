/**
 * 檔案處理器 - 提供檔案上傳和下載功能
 */

import type { HttpClient, ProgressEvent, RequestConfig } from '../core/types'

/**
 * 檔案上傳選項
 */
export interface UploadOptions {
    /** 檔案欄位名稱 */
    fieldName?: string
    /** 額外的表單數據 */
    data?: Record<string, any>
    /** 進度回調 */
    onProgress?: (progress: ProgressEvent) => void
    /** 請求配置 */
    config?: RequestConfig
    /** 是否多檔案上傳 */
    multiple?: boolean
    /** 最大檔案大小（字節） */
    maxSize?: number
    /** 允許的檔案類型 */
    acceptedTypes?: string[]
    /** 是否自動生成縮圖 */
    generateThumbnail?: boolean
    /** 縮圖大小 */
    thumbnailSize?: { width: number; height: number }
}

/**
 * 檔案下載選項
 */
export interface DownloadOptions {
    /** 檔案名稱 */
    filename?: string
    /** 進度回調 */
    onProgress?: (progress: ProgressEvent) => void
    /** 請求配置 */
    config?: RequestConfig
    /** 是否自動下載 */
    autoDownload?: boolean
    /** 下載前確認 */
    confirmBeforeDownload?: boolean
}

/**
 * 檔案驗證結果
 */
export interface FileValidationResult {
    valid: boolean
    errors: string[]
}

/**
 * 檔案處理器
 */
export class FileHandler {
    private httpClient: HttpClient

    constructor(httpClient: HttpClient) {
        this.httpClient = httpClient
    }

    /**
     * 上傳單個檔案
     */
    async uploadFile<T = any>(
        url: string,
        file: File,
        options: UploadOptions = {}
    ): Promise<T> {
        // 驗證檔案
        const validation = this.validateFile(file, options)
        if (!validation.valid) {
            throw new Error(`File validation failed: ${validation.errors.join(', ')}`)
        }

        // 準備表單數據
        const formData = await this.prepareFormData(file, options)

        // 發送請求
        return this.httpClient.post<T>(url, formData, {
            ...options.config,
            headers: {
                ...options.config?.headers,
                // 讓瀏覽器自動設置 Content-Type
            }
        })
    }

    /**
     * 上傳多個檔案
     */
    async uploadFiles<T = any>(
        url: string,
        files: File[],
        options: UploadOptions = {}
    ): Promise<T> {
        // 驗證所有檔案
        const validationResults = files.map(file => ({
            file,
            validation: this.validateFile(file, options)
        }))

        const invalidFiles = validationResults.filter(r => !r.validation.valid)
        if (invalidFiles.length > 0) {
            const errors = invalidFiles.map(r =>
                `${r.file.name}: ${r.validation.errors.join(', ')}`
            )
            throw new Error(`File validation failed:\n${errors.join('\n')}`)
        }

        // 準備表單數據
        const formData = await this.prepareMultipleFormData(files, options)

        // 發送請求
        return this.httpClient.post<T>(url, formData, {
            ...options.config,
            headers: {
                ...options.config?.headers,
            }
        })
    }

    /**
     * 下載檔案
     */
    async downloadFile(url: string, options: DownloadOptions = {}): Promise<void> {
        // 確認下載
        if (options.confirmBeforeDownload) {
            const confirmed = await this.confirmDownload(options.filename || 'file')
            if (!confirmed) return
        }

        // 發送請求
        const response = await this.httpClient.get<Blob>(url, {
            ...options.config,
            responseType: 'blob'
        })

        // 自動下載
        if (options.autoDownload !== false) {
            this.triggerDownload(response, options.filename)
        }
    }

    /**
     * 下載並返回 Blob
     */
    async downloadAsBlob(url: string, options: Omit<DownloadOptions, 'autoDownload'> = {}): Promise<Blob> {
        return this.httpClient.get<Blob>(url, {
            ...options.config,
            responseType: 'blob'
        })
    }

    /**
     * 下載並返回 Base64
     */
    async downloadAsBase64(url: string, options: DownloadOptions = {}): Promise<string> {
        const blob = await this.downloadAsBlob(url, options)
        return this.blobToBase64(blob)
    }

    /**
     * 驗證檔案
     */
    private validateFile(file: File, options: UploadOptions): FileValidationResult {
        const errors: string[] = []

        // 檢查檔案大小
        if (options.maxSize && file.size > options.maxSize) {
            errors.push(`檔案大小超過限制 (最大: ${this.formatFileSize(options.maxSize)})`)
        }

        // 檢查檔案類型
        if (options.acceptedTypes && options.acceptedTypes.length > 0) {
            const isAccepted = options.acceptedTypes.some(type => {
                if (type.includes('*')) {
                    // 支援萬用字元，如 'image/*'
                    const [mainType] = type.split('/')
                    return file.type.startsWith(mainType)
                }
                return file.type === type || file.name.endsWith(type)
            })

            if (!isAccepted) {
                errors.push(`不支援的檔案類型 (允許: ${options.acceptedTypes.join(', ')})`)
            }
        }

        return {
            valid: errors.length === 0,
            errors
        }
    }

    /**
     * 準備單檔案表單數據
     */
    private async prepareFormData(file: File, options: UploadOptions): Promise<FormData> {
        const formData = new FormData()
        const fieldName = options.fieldName || 'file'

        // 添加檔案
        if (options.generateThumbnail && file.type.startsWith('image/')) {
            const thumbnail = await this.generateThumbnail(file, options.thumbnailSize)
            formData.append(`${fieldName}_thumbnail`, thumbnail)
        }

        formData.append(fieldName, file)

        // 添加額外數據
        if (options.data) {
            Object.entries(options.data).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        value.forEach(item => {
                            formData.append(`${key}[]`, this.serializeValue(item))
                        })
                    } else {
                        formData.append(key, this.serializeValue(value))
                    }
                }
            })
        }

        return formData
    }

    /**
     * 準備多檔案表單數據
     */
    private async prepareMultipleFormData(files: File[], options: UploadOptions): Promise<FormData> {
        const formData = new FormData()
        const fieldName = options.fieldName || 'files'

        // 添加所有檔案
        for (let i = 0; i < files.length; i++) {
            const file = files[i]

            if (options.generateThumbnail && file.type.startsWith('image/')) {
                const thumbnail = await this.generateThumbnail(file, options.thumbnailSize)
                formData.append(`${fieldName}[${i}]_thumbnail`, thumbnail)
            }

            formData.append(`${fieldName}[${i}]`, file)
        }

        // 添加額外數據
        if (options.data) {
            Object.entries(options.data).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    formData.append(key, this.serializeValue(value))
                }
            })
        }

        return formData
    }

    /**
     * 生成縮圖
     */
    private async generateThumbnail(
        file: File,
        size: { width: number; height: number } = {width: 200, height: 200}
    ): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()

            reader.onload = (e) => {
                const img = new Image()

                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    const ctx = canvas.getContext('2d')!

                    // 計算縮放比例
                    const scale = Math.min(size.width / img.width, size.height / img.height)
                    const width = img.width * scale
                    const height = img.height * scale

                    canvas.width = width
                    canvas.height = height

                    // 繪製縮圖
                    ctx.drawImage(img, 0, 0, width, height)

                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob)
                        } else {
                            reject(new Error('Failed to generate thumbnail'))
                        }
                    }, file.type)
                }

                img.onerror = () => reject(new Error('Failed to load image'))
                img.src = e.target?.result as string
            }

            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsDataURL(file)
        })
    }

    /**
     * 序列化值
     */
    private serializeValue(value: any): string {
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value)
        }
        return String(value)
    }

    /**
     * 觸發下載
     */
    private triggerDownload(blob: Blob, filename?: string): void {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')

        link.href = url
        link.download = filename || this.extractFilename(url) || 'download'
        link.style.display = 'none'

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // 清理 URL
        setTimeout(() => URL.revokeObjectURL(url), 100)
    }

    /**
     * 從 URL 提取檔名
     */
    private extractFilename(url: string): string {
        try {
            const urlObj = new URL(url)
            const pathname = urlObj.pathname
            const filename = pathname.substring(pathname.lastIndexOf('/') + 1)
            return decodeURIComponent(filename)
        } catch {
            return 'download'
        }
    }

    /**
     * Blob 轉 Base64
     */
    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
    }

    /**
     * 確認下載
     */
    private async confirmDownload(filename: string): Promise<boolean> {
        if (typeof window !== 'undefined' && window.confirm) {
            return window.confirm(`確定要下載 ${filename} 嗎？`)
        }
        return true
    }

    /**
     * 格式化檔案大小
     */
    private formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB']
        let size = bytes
        let unitIndex = 0

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024
            unitIndex++
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`
    }
}

/**
 * 批次上傳管理器
 */
export class BatchUploadManager {
    private fileHandler: FileHandler
    private concurrency: number

    constructor(fileHandler: FileHandler, concurrency: number = 3) {
        this.fileHandler = fileHandler
        this.concurrency = concurrency
    }

    /**
     * 批次上傳檔案
     */
    async uploadBatch<T = any>(
        url: string,
        files: File[],
        options: UploadOptions & {
            onFileProgress?: (file: File, progress: ProgressEvent) => void
            onFileComplete?: (file: File, result: T) => void
            onFileError?: (file: File, error: Error) => void
        } = {}
    ): Promise<{ successful: T[]; failed: Array<{ file: File; error: Error }> }> {
        const successful: T[] = []
        const failed: Array<{ file: File; error: Error }> = []

        // 創建上傳任務
        const tasks = files.map(file => async () => {
            try {
                const result = await this.fileHandler.uploadFile<T>(url, file, {
                    ...options,
                    onProgress: (progress) => {
                        options.onFileProgress?.(file, progress)
                    }
                })

                successful.push(result)
                options.onFileComplete?.(file, result)
            } catch (error: any) {
                failed.push({file, error})
                options.onFileError?.(file, error)
            }
        })

        // 併發控制執行
        await this.executeWithConcurrency(tasks)

        return {successful, failed}
    }

    /**
     * 併發控制執行
     */
    private async executeWithConcurrency(tasks: Array<() => Promise<void>>): Promise<void> {
        const executing: Promise<void>[] = []

        for (const task of tasks) {
            const promise = task().then(() => {
                executing.splice(executing.indexOf(promise), 1)
            })

            executing.push(promise)

            if (executing.length >= this.concurrency) {
                await Promise.race(executing)
            }
        }

        await Promise.all(executing)
    }
}

/**
 * 創建檔案處理器
 */
export function createFileHandler(httpClient: HttpClient): FileHandler {
    return new FileHandler(httpClient)
}

/**
 * 創建批次上傳管理器
 */
export function createBatchUploadManager(
    fileHandler: FileHandler,
    concurrency?: number
): BatchUploadManager {
    return new BatchUploadManager(fileHandler, concurrency)
}
