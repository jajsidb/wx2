import { ElMessage, ElNotification } from 'element-plus'

// 错误代码定义（根据API文档）
export const ERROR_CODES = {
  SUCCESS: 0,
  PARAM_VALIDATION_ERROR: 4001,
  EXCEL_PARSE_ERROR: 4002,
  DATA_CONFLICT_ERROR: 4003,
  IMAGE_RENDER_ERROR: 5001,
  STORAGE_ERROR: 5002,
  NETWORK_ERROR: 9001,
  UNKNOWN_ERROR: 9999
} as const

// 错误消息映射
export const ERROR_MESSAGES = {
  [ERROR_CODES.SUCCESS]: '操作成功',
  [ERROR_CODES.PARAM_VALIDATION_ERROR]: '参数校验失败',
  [ERROR_CODES.EXCEL_PARSE_ERROR]: 'Excel文件解析错误',
  [ERROR_CODES.DATA_CONFLICT_ERROR]: '数据冲突',
  [ERROR_CODES.IMAGE_RENDER_ERROR]: '图片渲染失败',
  [ERROR_CODES.STORAGE_ERROR]: '存储失败',
  [ERROR_CODES.NETWORK_ERROR]: '网络连接错误',
  [ERROR_CODES.UNKNOWN_ERROR]: '未知错误'
} as const

// API响应接口定义
export interface ApiResponse<T = any> {
  success: boolean
  code: number
  message: string
  data?: T
  timestamp?: string
}

// 错误详情接口
export interface ErrorDetail {
  field?: string
  value?: any
  reason?: string
}

// 扩展的错误响应接口
export interface ApiErrorResponse extends ApiResponse {
  errors?: ErrorDetail[]
  traceId?: string
}

// 错误处理类
export class ApiError extends Error {
  public code: number
  public details?: ErrorDetail[]
  public traceId?: string
  public originalError?: any

  constructor(
    message: string,
    code: number = ERROR_CODES.UNKNOWN_ERROR,
    details?: ErrorDetail[],
    traceId?: string,
    originalError?: any
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.traceId = traceId
    this.originalError = originalError
  }

  // 获取用户友好的错误消息
  getUserMessage(): string {
    return ERROR_MESSAGES[this.code as keyof typeof ERROR_MESSAGES] || this.message
  }

  // 获取详细错误信息
  getDetailMessage(): string {
    let message = this.getUserMessage()
    
    if (this.details && this.details.length > 0) {
      const detailMessages = this.details.map(detail => {
        if (detail.field && detail.reason) {
          return `${detail.field}: ${detail.reason}`
        }
        return detail.reason || '未知详情'
      })
      message += `\n详细信息: ${detailMessages.join(', ')}`
    }
    
    return message
  }
}

// 统一错误处理函数
export function handleApiError(error: any, context?: string): ApiError {
  console.error(`API错误 ${context ? `[${context}]` : ''}:`, error)

  // 如果已经是ApiError，直接返回
  if (error instanceof ApiError) {
    return error
  }

  // 处理Axios错误
  if (error.response) {
    const response = error.response
    const data: ApiErrorResponse = response.data || {}
    
    return new ApiError(
      data.message || `HTTP ${response.status} 错误`,
      data.code || ERROR_CODES.UNKNOWN_ERROR,
      data.errors,
      data.traceId,
      error
    )
  }

  // 处理网络错误
  if (error.request) {
    return new ApiError(
      '网络连接失败，请检查网络设置',
      ERROR_CODES.NETWORK_ERROR,
      undefined,
      undefined,
      error
    )
  }

  // 处理其他错误
  return new ApiError(
    error.message || '未知错误',
    ERROR_CODES.UNKNOWN_ERROR,
    undefined,
    undefined,
    error
  )
}

// 显示错误消息
export function showErrorMessage(error: ApiError | Error | string, options?: {
  showDetail?: boolean
  duration?: number
  type?: 'message' | 'notification'
}) {
  const {
    showDetail = false,
    duration = 4000,
    type = 'message'
  } = options || {}

  let message: string
  let title = '操作失败'

  if (error instanceof ApiError) {
    message = showDetail ? error.getDetailMessage() : error.getUserMessage()
    
    // 根据错误代码设置不同的标题
    switch (error.code) {
      case ERROR_CODES.PARAM_VALIDATION_ERROR:
        title = '参数错误'
        break
      case ERROR_CODES.EXCEL_PARSE_ERROR:
        title = '文件解析错误'
        break
      case ERROR_CODES.DATA_CONFLICT_ERROR:
        title = '数据冲突'
        break
      case ERROR_CODES.NETWORK_ERROR:
        title = '网络错误'
        break
      default:
        title = '操作失败'
    }
  } else if (error instanceof Error) {
    message = error.message
  } else {
    message = String(error)
  }

  if (type === 'notification') {
    ElNotification({
      title,
      message,
      type: 'error',
      duration,
      dangerouslyUseHTMLString: showDetail
    })
  } else {
    ElMessage({
      message,
      type: 'error',
      duration,
      dangerouslyUseHTMLString: showDetail
    })
  }
}

// 成功消息显示
export function showSuccessMessage(message: string, options?: {
  duration?: number
  type?: 'message' | 'notification'
  title?: string
}) {
  const {
    duration = 3000,
    type = 'message',
    title = '操作成功'
  } = options || {}

  if (type === 'notification') {
    ElNotification({
      title,
      message,
      type: 'success',
      duration
    })
  } else {
    ElMessage({
      message,
      type: 'success',
      duration
    })
  }
}

// 警告消息显示
export function showWarningMessage(message: string, options?: {
  duration?: number
  type?: 'message' | 'notification'
  title?: string
}) {
  const {
    duration = 3000,
    type = 'message',
    title = '注意'
  } = options || {}

  if (type === 'notification') {
    ElNotification({
      title,
      message,
      type: 'warning',
      duration
    })
  } else {
    ElMessage({
      message,
      type: 'warning',
      duration
    })
  }
}

// API响应验证
export function validateApiResponse<T>(response: any): ApiResponse<T> {
  if (!response || typeof response !== 'object') {
    throw new ApiError('无效的API响应格式')
  }

  const { data } = response
  if (!data || typeof data !== 'object') {
    throw new ApiError('无效的响应数据格式')
  }

  // 检查必要字段
  if (typeof data.success !== 'boolean') {
    throw new ApiError('响应缺少success字段')
  }

  if (typeof data.code !== 'number') {
    throw new ApiError('响应缺少code字段')
  }

  if (typeof data.message !== 'string') {
    throw new ApiError('响应缺少message字段')
  }

  return data as ApiResponse<T>
}

// 重试机制
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await apiCall()
    } catch (error) {
      lastError = error
      
      if (i === maxRetries) {
        break
      }

      // 只对网络错误进行重试
      const apiError = handleApiError(error)
      if (apiError.code !== ERROR_CODES.NETWORK_ERROR) {
        throw apiError
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
    }
  }

  throw handleApiError(lastError, '重试失败')
}