/**
 * API 服務使用範例
 */

import {
  createApiClient,
  createConfigBuilder,
  createTokenManager,
  createStateManager,
  createVueApiClient,
  createAuthInterceptor,
  createLoggingInterceptor,
  createRetryInterceptor,
  ErrorType
} from '../index'

// ============================================
// 1. 基本使用
// ============================================

// 最簡單的使用方式
const simpleApi = createApiClient('https://api.example.com')

// 基本配置
const basicApi = createApiClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
  headers: {
    'X-App-Version': '1.0.0'
  }
})

// ============================================
// 2. 使用配置構建器
// ============================================

const config = createConfigBuilder()
  .baseURL('https://api.example.com')
  .timeout(30000)
  .header('X-App-Version', '1.0.0')
  .cache(true, 300000) // 啟用 5 分鐘快取
  .maxRetries(3)
  .responseSchema({
    dataField: 'Data',
    statusField: 'StatusCode',
    messageField: 'Message'
  })
  .usePreset('production')
  .build()

const api = createApiClient(config)

// ============================================
// 3. 自定義響應格式
// ============================================

// 適配不同的後端響應格式
const customApi = createApiClient({
  baseURL: 'https://api.example.com',
  responseSchema: {
    // 支援多個可能的欄位名
    dataField: ['data', 'result', 'payload'],
    statusField: ['code', 'status', 'statusCode'],
    messageField: ['message', 'msg', 'error'],
    // 或使用自定義提取器
    extractor: (response) => {
      if (response.success) {
        return response.data
      }
      throw new Error(response.error)
    }
  }
})

// ============================================
// 4. Token 管理
// ============================================

// JWT Token 管理
const jwtTokenManager = createTokenManager('jwt', {
  tokenKey: 'access_token',
  refreshTokenKey: 'refresh_token',
  refreshThreshold: 300000 // 5 分鐘前刷新
})

// 檢查 token 是否過期
async function checkTokenStatus() {
  const isExpired = await jwtTokenManager.isTokenExpired?.()
  if (isExpired) {
    console.log('Token 已過期，需要刷新')
  }
}

// OAuth Token 管理
const oauthTokenManager = createTokenManager('oauth', {
  tokenKey: 'access_token',
  refreshTokenKey: 'refresh_token'
})

// 設置 token
await oauthTokenManager.setToken('access_token_value')

// ============================================
// 5. 攔截器使用
// ============================================

const apiWithInterceptors = createApiClient({
  baseURL: 'https://api.example.com',
  tokenManager: jwtTokenManager,
  interceptors: [
    // 認證攔截器
    createAuthInterceptor(jwtTokenManager),
    // 日誌攔截器
    createLoggingInterceptor(console),
    // 重試攔截器
    createRetryInterceptor(3, 1000)
  ]
})

// 添加自定義攔截器
apiWithInterceptors.use({
  request: {
    onFulfilled: async (config) => {
      // 添加時間戳
      if (config.headers) {
        config.headers['X-Request-Time'] = Date.now().toString()
      }
      return config
    }
  },
  response: {
    onFulfilled: (response) => {
      // 記錄響應時間
      const requestTime = response.config?.headers?.['X-Request-Time']
      if (requestTime) {
        const duration = Date.now() - parseInt(requestTime)
        console.log(`Request took ${duration}ms`)
      }
      return response
    }
  }
})

// ============================================
// 6. 狀態管理
// ============================================

// 基礎狀態管理
const stateManager = createStateManager('basic')

// 訂閱狀態變化
const unsubscribe = stateManager.subscribe?.((event) => {
  console.log('State changed:', event)
})

// 分組狀態管理
const groupedState = createStateManager('grouped')

// 管理不同模組的狀態
groupedState.setLoading('users-fetch', true)
groupedState.setLoading('posts-create', true)

// ============================================
// 7. Vue 3 整合
// ============================================

const vueApi = createVueApiClient(
  createApiClient({
    baseURL: 'https://api.example.com',
    tokenManager: jwtTokenManager,
    stateManager: createStateManager('basic')
  })
)

// Vue 組件範例
export const UserListComponent = {
  setup() {
    // 基本 API 調用
    const { data: users, loading, error, execute: fetchUsers } = vueApi.useApi(
      () => vueApi.get('/users'),
      { immediate: true }
    )

    // 分頁
    const {
      data: pagedUsers,
      currentPage,
      totalPages,
      next,
      prev,
      goto,
      refresh
    } = vueApi.usePagination(
      async (page, pageSize) => {
        const response = await vueApi.get('/users', { page, pageSize })
        return {
          data: response.items,
          total: response.total
        }
      },
      { pageSize: 20, immediate: true }
    )

    // 無限滾動
    const {
      items: posts,
      hasMore,
      loadMore,
      loading: loadingMore
    } = vueApi.useInfiniteScroll(
      async (page, pageSize) => {
        const response = await vueApi.get('/posts', { page, pageSize })
        return {
          data: response.items,
          hasMore: page < response.totalPages
        }
      },
      { pageSize: 10 }
    )

    // 輪詢
    const {
      data: serverStatus,
      isPolling,
      start: startPolling,
      stop: stopPolling
    } = vueApi.usePolling(
      () => vueApi.get('/status'),
      {
        interval: 5000,
        immediate: true,
        maxRetries: 10
      }
    )

    return {
      users,
      loading,
      error,
      fetchUsers,
      pagedUsers,
      currentPage,
      next,
      prev,
      posts,
      loadMore,
      serverStatus,
      isPolling,
      startPolling,
      stopPolling
    }
  }
}

// ============================================
// 8. 檔案處理
// ============================================

// 單檔案上傳
async function uploadAvatar(file: File) {
  try {
    const result = await api.upload('/upload/avatar', file, {
      fieldName: 'avatar',
      data: {
        userId: 123,
        description: 'User avatar'
      },
      // maxSize: 5 * 1024 * 1024, // 5MB (not supported in this version)
      // acceptedTypes: ['image/jpeg', 'image/png'],
      // generateThumbnail: true,
      // thumbnailSize: { width: 100, height: 100 },
      onProgress: (progress) => {
        console.log(`上傳進度：${progress.percent}%`)
      }
    })
    console.log('上傳成功:', result)
  } catch (error) {
    console.error('上傳失敗:', error)
  }
}

// 多檔案上傳
async function uploadGallery(files: File[]) {
  const result = await api.uploadMultiple('/upload/gallery', files, {
    fieldName: 'images',
    // multiple: true, (not supported in this version)
    data: {
      albumId: 456
    }
  })
  return result
}

// 檔案下載
async function downloadReport() {
  await api.download('/reports/monthly', {
    filename: 'monthly-report.pdf',
    onProgress: (progress) => {
      console.log(`下載進度：${progress.percent}%`)
    }
  })
}

// 下載為 Blob
async function downloadAsBlob() {
  const blob = await api.downloadAsBlob('/images/logo.png')
  // 創建預覽 URL
  const url = URL.createObjectURL(blob)
  return url
}

// ============================================
// 9. 錯誤處理
// ============================================

// 使用狀態管理的 API 調用
async function createUserWithState(userData: any) {
  const result = await api.postWithState(
    '/users',
    userData,
    {
      loadingKey: 'createUser',
      onSuccess: (data) => {
        console.log('用戶創建成功:', data)
      },
      onError: (error) => {
        // 處理特定錯誤
        if (error.code === 'VALIDATION_ERROR') {
          console.error('驗證失敗:', error.details)
        } else if (error.code === 401) {
          console.error('未授權，請登錄')
        }
      }
    }
  )

  if (result.success) {
    return result.data
  } else {
    throw result.error
  }
}

// ============================================
// 10. 批次操作
// ============================================

import { createBatchUploadManager } from '../features/file-handler'

async function batchUploadImages(files: File[]) {
  const fileHandler = { uploadFile: api.upload.bind(api) }
  const batchManager = createBatchUploadManager(fileHandler as any, 3)

  const { successful, failed } = await batchManager.uploadBatch(
    '/upload/batch',
    files,
    {
      onFileProgress: (file, progress) => {
        console.log(`${file.name}: ${progress.percent}%`)
      },
      onFileComplete: (file, result) => {
        console.log(`${file.name} 完成`)
      },
      onFileError: (file, error) => {
        console.error(`${file.name} 失敗:`, error)
      }
    }
  )

  console.log(`成功: ${successful.length}, 失敗: ${failed.length}`)
}

// ============================================
// 11. 實際使用案例
// ============================================

// 用戶服務
const userService = {
  api: createApiClient({
    baseURL: 'https://api.example.com',
    tokenManager: jwtTokenManager,
    responseSchema: {
      dataField: 'data',
      statusField: 'code',
      messageField: 'message'
    }
  }),

  async login(email: string, password: string) {
    const response = await this.api.post('/auth/login', { email, password })
    if (response.token) {
      await jwtTokenManager.setToken(response.token)
    }
    return response
  },

  async logout() {
    await this.api.post('/auth/logout')
    await jwtTokenManager.removeToken()
  },

  async getProfile() {
    return this.api.get('/users/profile')
  },

  async updateProfile(data: any) {
    return this.api.put('/users/profile', data)
  },

  async uploadAvatar(file: File) {
    return this.api.upload('/users/avatar', file, {
      fieldName: 'avatar'
    })
  }
}

// ============================================
// 12. 測試配置
// ============================================

// 用於測試的模擬配置
const mockApi = createApiClient({
  baseURL: 'http://localhost:3000',
  timeout: 5000,
  interceptors: [
    {
      response: {
        onFulfilled: (response) => {
          console.log('[Mock] Response:', response)
          return response
        }
      }
    }
  ]
})
