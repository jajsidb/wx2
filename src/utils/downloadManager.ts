import { 
  downloadFile, 
  getDownloadTaskStatus, 
  pauseDownloadTask, 
  resumeDownloadTask, 
  cancelDownloadTask 
} from '../api'

export interface DownloadProgress {
  taskId: string
  fileName: string
  progress: number
  downloadedBytes: number
  totalBytes: number
  speed: number
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled'
  error?: string
  retryCount: number
}

export interface DownloadOptions {
  maxRetries?: number
  retryDelay?: number
  chunkSize?: number
  onProgress?: (progress: DownloadProgress) => void
  onComplete?: (taskId: string, blob: Blob) => void
  onError?: (taskId: string, error: string) => void
}

class DownloadManager {
  private downloads = new Map<string, DownloadProgress>()
  private abortControllers = new Map<string, AbortController>()
  private retryTimers = new Map<string, NodeJS.Timeout>()
  
  private defaultOptions: Required<DownloadOptions> = {
    maxRetries: 3,
    retryDelay: 2000,
    chunkSize: 1024 * 1024, // 1MB
    onProgress: () => {},
    onComplete: () => {},
    onError: () => {}
  }

  /**
   * 开始下载任务
   */
  async startDownload(
    taskId: string, 
    fileId: string, 
    fileName: string, 
    options: DownloadOptions = {}
  ): Promise<void> {
    const opts = { ...this.defaultOptions, ...options }
    
    // 初始化下载进度
    const progress: DownloadProgress = {
      taskId,
      fileName,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      status: 'pending',
      retryCount: 0
    }
    
    this.downloads.set(taskId, progress)
    
    try {
      // 获取任务状态，检查是否支持断点续传
      const taskStatus = await this.getTaskStatus(taskId)
      if (taskStatus) {
        progress.downloadedBytes = taskStatus.downloadedBytes
        progress.totalBytes = taskStatus.totalBytes
        progress.progress = taskStatus.progress
        progress.status = taskStatus.status
      }
      
      await this.executeDownload(taskId, fileId, opts)
    } catch (error) {
      this.handleDownloadError(taskId, error as Error, opts)
    }
  }

  /**
   * 执行下载
   */
  private async executeDownload(
    taskId: string, 
    fileId: string, 
    options: Required<DownloadOptions>
  ): Promise<void> {
    const progress = this.downloads.get(taskId)
    if (!progress) return

    // 创建取消控制器
    const abortController = new AbortController()
    this.abortControllers.set(taskId, abortController)

    try {
      progress.status = 'downloading'
      options.onProgress(progress)

      // 计算断点续传的范围
      const rangeHeader = progress.downloadedBytes > 0 
        ? `bytes=${progress.downloadedBytes}-` 
        : undefined

      const startTime = Date.now()
      let lastProgressTime = startTime
      let lastDownloadedBytes = progress.downloadedBytes

      // 下载文件
      const response = await downloadFile(fileId, {
        range: rangeHeader,
        onProgress: (progressPercent: number, speed: number) => {
          const now = Date.now()
          
          // 更新进度信息
          if (progress.totalBytes === 0 && response.headers['content-length']) {
            progress.totalBytes = parseInt(response.headers['content-length'])
          }
          
          progress.progress = progressPercent
          progress.speed = speed
          
          // 计算实际下载速度
          if (now - lastProgressTime > 1000) {
            const timeDiff = (now - lastProgressTime) / 1000
            const bytesDiff = progress.downloadedBytes - lastDownloadedBytes
            progress.speed = bytesDiff / timeDiff
            
            lastProgressTime = now
            lastDownloadedBytes = progress.downloadedBytes
          }
          
          options.onProgress(progress)
        }
      })

      // 检查是否被取消
      if (abortController.signal.aborted) {
        progress.status = 'cancelled'
        options.onProgress(progress)
        return
      }

      // 下载完成
      progress.status = 'completed'
      progress.progress = 100
      options.onProgress(progress)
      options.onComplete(taskId, response.data)

      // 清理资源
      this.cleanup(taskId)

    } catch (error) {
      if (abortController.signal.aborted) {
        progress.status = 'cancelled'
        options.onProgress(progress)
        return
      }
      
      throw error
    }
  }

  /**
   * 处理下载错误
   */
  private handleDownloadError(
    taskId: string, 
    error: Error, 
    options: Required<DownloadOptions>
  ): void {
    const progress = this.downloads.get(taskId)
    if (!progress) return

    progress.retryCount++
    progress.error = error.message

    // 检查是否需要重试
    if (progress.retryCount <= options.maxRetries) {
      progress.status = 'pending'
      options.onProgress(progress)

      // 延迟重试
      const timer = setTimeout(() => {
        this.retryTimers.delete(taskId)
        this.executeDownload(taskId, '', options).catch(err => {
          this.handleDownloadError(taskId, err, options)
        })
      }, options.retryDelay * progress.retryCount)

      this.retryTimers.set(taskId, timer)
    } else {
      // 重试次数用完，标记为失败
      progress.status = 'failed'
      options.onProgress(progress)
      options.onError(taskId, error.message)
      
      this.cleanup(taskId)
    }
  }

  /**
   * 暂停下载
   */
  async pauseDownload(taskId: string): Promise<void> {
    const progress = this.downloads.get(taskId)
    if (!progress) return

    try {
      // 取消当前下载
      const abortController = this.abortControllers.get(taskId)
      if (abortController) {
        abortController.abort()
      }

      // 清理重试定时器
      const retryTimer = this.retryTimers.get(taskId)
      if (retryTimer) {
        clearTimeout(retryTimer)
        this.retryTimers.delete(taskId)
      }

      // 调用API暂停任务
      await pauseDownloadTask(taskId)
      
      progress.status = 'paused'
    } catch (error) {
      console.error('暂停下载失败:', error)
      progress.error = '暂停下载失败'
    }
  }

  /**
   * 恢复下载
   */
  async resumeDownload(taskId: string, fileId: string, options: DownloadOptions = {}): Promise<void> {
    const progress = this.downloads.get(taskId)
    if (!progress) return

    try {
      // 调用API恢复任务
      await resumeDownloadTask(taskId)
      
      // 重新开始下载
      const opts = { ...this.defaultOptions, ...options }
      await this.executeDownload(taskId, fileId, opts)
    } catch (error) {
      console.error('恢复下载失败:', error)
      this.handleDownloadError(taskId, error as Error, { ...this.defaultOptions, ...options })
    }
  }

  /**
   * 取消下载
   */
  async cancelDownload(taskId: string): Promise<void> {
    const progress = this.downloads.get(taskId)
    if (!progress) return

    try {
      // 取消当前下载
      const abortController = this.abortControllers.get(taskId)
      if (abortController) {
        abortController.abort()
      }

      // 调用API取消任务
      await cancelDownloadTask(taskId)
      
      progress.status = 'cancelled'
      this.cleanup(taskId)
    } catch (error) {
      console.error('取消下载失败:', error)
      progress.error = '取消下载失败'
      progress.status = 'failed'
    }
  }

  /**
   * 获取下载进度
   */
  getProgress(taskId: string): DownloadProgress | undefined {
    return this.downloads.get(taskId)
  }

  /**
   * 获取所有下载任务
   */
  getAllDownloads(): DownloadProgress[] {
    return Array.from(this.downloads.values())
  }

  /**
   * 获取任务状态
   */
  private async getTaskStatus(taskId: string): Promise<any> {
    try {
      const response = await getDownloadTaskStatus(taskId)
      return response.data
    } catch (error) {
      console.error('获取任务状态失败:', error)
      return null
    }
  }

  /**
   * 清理资源
   */
  private cleanup(taskId: string): void {
    // 清理取消控制器
    const abortController = this.abortControllers.get(taskId)
    if (abortController) {
      this.abortControllers.delete(taskId)
    }

    // 清理重试定时器
    const retryTimer = this.retryTimers.get(taskId)
    if (retryTimer) {
      clearTimeout(retryTimer)
      this.retryTimers.delete(taskId)
    }
  }

  /**
   * 清理已完成的下载任务
   */
  cleanupCompleted(): void {
    for (const [taskId, progress] of this.downloads.entries()) {
      if (progress.status === 'completed' || progress.status === 'cancelled') {
        this.downloads.delete(taskId)
        this.cleanup(taskId)
      }
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    // 取消所有下载
    for (const taskId of this.downloads.keys()) {
      this.cancelDownload(taskId)
    }

    // 清理所有资源
    this.downloads.clear()
    this.abortControllers.clear()
    
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer)
    }
    this.retryTimers.clear()
  }
}

// 创建全局下载管理器实例
export const downloadManager = new DownloadManager()

// 工具函数
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const formatSpeed = (bytesPerSecond: number): string => {
  return formatFileSize(bytesPerSecond) + '/s'
}

export const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}秒`
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`
  return `${Math.round(seconds / 3600)}小时`
}

export const calculateETA = (downloadedBytes: number, totalBytes: number, speed: number): number => {
  if (speed === 0 || totalBytes === 0) return 0
  const remainingBytes = totalBytes - downloadedBytes
  return remainingBytes / speed
}

// 网络状态检测
export const checkNetworkStatus = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!navigator.onLine) {
      resolve(false)
      return
    }

    // 尝试发送一个小的请求来检测网络连接
    const img = new Image()
    const timeout = setTimeout(() => {
      resolve(false)
    }, 5000)

    img.onload = () => {
      clearTimeout(timeout)
      resolve(true)
    }

    img.onerror = () => {
      clearTimeout(timeout)
      resolve(false)
    }

    // 使用一个小的图片来测试连接
    img.src = '/favicon.ico?' + Date.now()
  })
}

// 自动重连机制
export class NetworkMonitor {
  private listeners: Array<(isOnline: boolean) => void> = []
  private isOnline = navigator.onLine
  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    this.setupEventListeners()
    this.startPeriodicCheck()
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.updateStatus(true)
    })

    window.addEventListener('offline', () => {
      this.updateStatus(false)
    })
  }

  private startPeriodicCheck(): void {
    this.checkInterval = setInterval(async () => {
      const isOnline = await checkNetworkStatus()
      if (isOnline !== this.isOnline) {
        this.updateStatus(isOnline)
      }
    }, 10000) // 每10秒检查一次
  }

  private updateStatus(isOnline: boolean): void {
    if (this.isOnline !== isOnline) {
      this.isOnline = isOnline
      this.listeners.forEach(listener => listener(isOnline))
    }
  }

  onStatusChange(callback: (isOnline: boolean) => void): () => void {
    this.listeners.push(callback)
    
    // 返回取消监听的函数
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  getStatus(): boolean {
    return this.isOnline
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.listeners = []
  }
}

// 创建全局网络监控实例
export const networkMonitor = new NetworkMonitor()