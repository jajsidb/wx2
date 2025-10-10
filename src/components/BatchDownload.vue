<template>
  <div class="batch-download-container">
    <!-- 文件选择界面 -->
    <div class="file-selection-panel" v-if="!showDownloadQueue">
      <div class="panel-header">
        <h2 class="panel-title">
          <i class="icon-download"></i>
          批量下载文件
        </h2>
        <div class="header-actions">
          <button 
            class="btn btn-secondary"
            @click="refreshFileList"
            :disabled="loading"
          >
            <i class="icon-refresh" :class="{ 'spinning': loading }"></i>
            刷新
          </button>
          <button 
            class="btn btn-primary"
            @click="startBatchDownload"
            :disabled="selectedFiles.length === 0 || loading"
          >
            <i class="icon-download"></i>
            下载选中文件 ({{ selectedFiles.length }})
          </button>
        </div>
      </div>

      <!-- 搜索和筛选 -->
      <div class="filter-section">
        <div class="search-box">
          <i class="icon-search"></i>
          <input 
            type="text" 
            v-model="searchQuery"
            placeholder="搜索文件名..."
            @input="handleSearch"
          >
        </div>
        <div class="filter-controls">
          <select v-model="selectedFileType" @change="handleFilterChange">
            <option value="">所有类型</option>
            <option value="image">图片文件</option>
            <option value="document">文档文件</option>
            <option value="card">信息卡</option>
          </select>
          <select v-model="selectedStudent" @change="handleFilterChange">
            <option value="">所有学生</option>
            <option v-for="student in students" :key="student.id" :value="student.id">
              {{ student.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- 批量操作栏 -->
      <div class="bulk-actions" v-if="selectedFiles.length > 0">
        <div class="selection-info">
          <label class="checkbox-container">
            <input 
              type="checkbox" 
              :checked="isAllSelected"
              @change="toggleSelectAll"
            >
            <span class="checkmark"></span>
            已选择 {{ selectedFiles.length }} / {{ filteredFiles.length }} 个文件
          </label>
        </div>
        <div class="action-buttons">
          <button class="btn btn-outline" @click="clearSelection">
            清空选择
          </button>
          <button class="btn btn-primary" @click="startBatchDownload">
            <i class="icon-download"></i>
            开始下载
          </button>
        </div>
      </div>

      <!-- 文件列表 -->
      <div class="file-list-container">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载文件列表...</p>
        </div>
        
        <div v-else-if="filteredFiles.length === 0" class="empty-state">
          <i class="icon-folder-empty"></i>
          <p>{{ searchQuery ? '未找到匹配的文件' : '暂无可下载的文件' }}</p>
        </div>

        <div v-else class="file-grid">
          <div 
            v-for="file in paginatedFiles" 
            :key="file.id"
            class="file-item"
            :class="{ 'selected': selectedFiles.includes(file.id) }"
            @click="toggleFileSelection(file.id)"
          >
            <div class="file-checkbox">
              <input 
                type="checkbox" 
                :checked="selectedFiles.includes(file.id)"
                @click.stop
                @change="toggleFileSelection(file.id)"
              >
            </div>
            
            <div class="file-preview">
              <div class="file-icon" :class="`file-type-${file.type}`">
                <i :class="getFileIcon(file.type)"></i>
              </div>
            </div>
            
            <div class="file-info">
              <h4 class="file-name" :title="file.name">{{ file.name }}</h4>
              <div class="file-meta">
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
                <span class="file-date">{{ formatDate(file.createdAt) }}</span>
              </div>
              <div class="file-tags" v-if="file.studentId">
                <span class="tag">{{ getStudentName(file.studentId) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页控件 -->
        <div class="pagination" v-if="totalPages > 1">
          <button 
            class="btn btn-outline btn-sm"
            @click="currentPage--"
            :disabled="currentPage === 1"
          >
            上一页
          </button>
          <span class="page-info">
            第 {{ currentPage }} 页，共 {{ totalPages }} 页
          </span>
          <button 
            class="btn btn-outline btn-sm"
            @click="currentPage++"
            :disabled="currentPage === totalPages"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <!-- 下载队列管理界面 -->
    <div class="download-queue-panel" v-else>
      <div class="panel-header">
        <h2 class="panel-title">
          <i class="icon-queue"></i>
          下载队列管理
        </h2>
        <div class="header-actions">
          <button class="btn btn-outline" @click="showDownloadQueue = false">
            <i class="icon-back"></i>
            返回文件选择
          </button>
          <button 
            class="btn btn-secondary"
            @click="refreshDownloadTasks"
            :disabled="refreshingTasks"
          >
            <i class="icon-refresh" :class="{ 'spinning': refreshingTasks }"></i>
            刷新状态
          </button>
        </div>
      </div>

      <!-- 队列控制栏 -->
      <div class="queue-controls">
        <div class="queue-stats">
          <div class="stat-item">
            <span class="stat-label">总任务数:</span>
            <span class="stat-value">{{ downloadTasks.length }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">已完成:</span>
            <span class="stat-value completed">{{ completedTasksCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">进行中:</span>
            <span class="stat-value downloading">{{ downloadingTasksCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">失败:</span>
            <span class="stat-value failed">{{ failedTasksCount }}</span>
          </div>
        </div>
        
        <div class="queue-actions">
          <button 
            class="btn btn-success"
            @click="resumeAllTasks"
            :disabled="!canResumeAll"
          >
            <i class="icon-play"></i>
            全部开始
          </button>
          <button 
            class="btn btn-warning"
            @click="pauseAllTasks"
            :disabled="!canPauseAll"
          >
            <i class="icon-pause"></i>
            全部暂停
          </button>
          <button 
            class="btn btn-danger"
            @click="cancelAllTasks"
            :disabled="downloadTasks.length === 0"
          >
            <i class="icon-stop"></i>
            全部取消
          </button>
          <button 
            class="btn btn-outline"
            @click="cleanupCompletedTasks"
            :disabled="completedTasksCount === 0"
          >
            <i class="icon-clean"></i>
            清理已完成
          </button>
        </div>
      </div>

      <!-- 整体进度条 -->
      <div class="overall-progress" v-if="downloadTasks.length > 0">
        <div class="progress-header">
          <span class="progress-label">整体进度</span>
          <span class="progress-percentage">{{ overallProgress.toFixed(1) }}%</span>
        </div>
        <div class="progress-bar">
          <div 
            class="progress-fill"
            :style="{ width: overallProgress + '%' }"
          ></div>
        </div>
        <div class="progress-info">
          <span>平均速度: {{ formatSpeed(averageSpeed) }}</span>
          <span v-if="estimatedTimeRemaining > 0">
            预计剩余: {{ formatTime(estimatedTimeRemaining) }}
          </span>
        </div>
      </div>

      <!-- 下载任务列表 -->
      <div class="task-list-container">
        <div v-if="downloadTasks.length === 0" class="empty-state">
          <i class="icon-queue-empty"></i>
          <p>暂无下载任务</p>
        </div>

        <div v-else class="task-list">
          <div 
            v-for="task in downloadTasks" 
            :key="task.id"
            class="task-item"
            :class="[`status-${task.status}`, { 'has-error': task.error }]"
          >
            <div class="task-info">
              <div class="task-header">
                <h4 class="task-name" :title="task.fileName">{{ task.fileName }}</h4>
                <div class="task-actions">
                  <button 
                    v-if="task.status === 'paused' || task.status === 'failed'"
                    class="btn-icon btn-success"
                    @click="resumeTask(task.id)"
                    title="恢复下载"
                  >
                    <i class="icon-play"></i>
                  </button>
                  <button 
                    v-if="task.status === 'downloading'"
                    class="btn-icon btn-warning"
                    @click="pauseTask(task.id)"
                    title="暂停下载"
                  >
                    <i class="icon-pause"></i>
                  </button>
                  <button 
                    v-if="task.status !== 'completed'"
                    class="btn-icon btn-danger"
                    @click="cancelTask(task.id)"
                    title="取消下载"
                  >
                    <i class="icon-stop"></i>
                  </button>
                </div>
              </div>
              
              <div class="task-progress">
                <div class="progress-bar">
                  <div 
                    class="progress-fill"
                    :class="`status-${task.status}`"
                    :style="{ width: task.progress + '%' }"
                  ></div>
                </div>
                <div class="progress-details">
                  <span class="progress-text">
                    {{ task.progress.toFixed(1) }}% 
                    ({{ formatFileSize(task.downloadedBytes) }} / {{ formatFileSize(task.totalBytes) }})
                  </span>
                  <span v-if="task.status === 'downloading'" class="speed">
                    {{ formatSpeed(task.speed) }}
                  </span>
                </div>
              </div>
              
              <div class="task-status">
                <span class="status-badge" :class="`status-${task.status}`">
                  {{ getStatusText(task.status) }}
                </span>
                <span class="task-time">{{ formatDate(task.updatedAt) }}</span>
              </div>
              
              <div v-if="task.error" class="task-error">
                <i class="icon-error"></i>
                <span>{{ task.error }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { 
  getDownloadableFiles, 
  createBatchDownload, 
  getDownloadTasks,
  pauseDownloadTask,
  resumeDownloadTask,
  cancelDownloadTask,
  pauseBatchDownload,
  resumeBatchDownload,
  cancelBatchDownload,
  cleanupCompletedTasks as apiCleanupCompletedTasks,
  getStudents
} from '../api'
import { downloadManager } from '../utils/downloadManager'

// 响应式数据
const loading = ref(false)
const refreshingTasks = ref(false)
const showDownloadQueue = ref(false)
const searchQuery = ref('')
const selectedFileType = ref('')
const selectedStudent = ref('')
const selectedFiles = ref<string[]>([])
const currentPage = ref(1)
const pageSize = 20

const files = ref<any[]>([])
const students = ref<any[]>([])
const downloadTasks = ref<any[]>([])
const currentBatchId = ref<string>('')

// 定时器
let progressTimer: NodeJS.Timeout | null = null

// 计算属性
const filteredFiles = computed(() => {
  let result = files.value

  if (searchQuery.value) {
    result = result.filter(file => 
      file.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }

  if (selectedFileType.value) {
    result = result.filter(file => file.type === selectedFileType.value)
  }

  if (selectedStudent.value) {
    result = result.filter(file => file.studentId === selectedStudent.value)
  }

  return result
})

const paginatedFiles = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredFiles.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredFiles.value.length / pageSize)
})

const isAllSelected = computed(() => {
  return filteredFiles.value.length > 0 && 
         filteredFiles.value.every(file => selectedFiles.value.includes(file.id))
})

const completedTasksCount = computed(() => {
  return downloadTasks.value.filter(task => task.status === 'completed').length
})

const downloadingTasksCount = computed(() => {
  return downloadTasks.value.filter(task => task.status === 'downloading').length
})

const failedTasksCount = computed(() => {
  return downloadTasks.value.filter(task => task.status === 'failed').length
})

const canResumeAll = computed(() => {
  return downloadTasks.value.some(task => 
    task.status === 'paused' || task.status === 'failed'
  )
})

const canPauseAll = computed(() => {
  return downloadTasks.value.some(task => task.status === 'downloading')
})

const overallProgress = computed(() => {
  if (downloadTasks.value.length === 0) return 0
  
  const totalProgress = downloadTasks.value.reduce((sum, task) => sum + task.progress, 0)
  return totalProgress / downloadTasks.value.length
})

const averageSpeed = computed(() => {
  const downloadingTasks = downloadTasks.value.filter(task => task.status === 'downloading')
  if (downloadingTasks.length === 0) return 0
  
  const totalSpeed = downloadingTasks.reduce((sum, task) => sum + task.speed, 0)
  return totalSpeed / downloadingTasks.length
})

const estimatedTimeRemaining = computed(() => {
  if (averageSpeed.value === 0) return 0
  
  const remainingBytes = downloadTasks.value.reduce((sum, task) => {
    return sum + (task.totalBytes - task.downloadedBytes)
  }, 0)
  
  return remainingBytes / averageSpeed.value
})

// 方法
const refreshFileList = async () => {
  loading.value = true
  try {
    const response = await getDownloadableFiles({
      page: 1,
      size: 1000 // 获取所有文件
    })
    files.value = response.data.data || []
  } catch (error) {
    console.error('获取文件列表失败:', error)
  } finally {
    loading.value = false
  }
}

const loadStudents = async () => {
  try {
    const response = await getStudents({ page: 1, size: 1000 })
    students.value = response.data.data || []
  } catch (error) {
    console.error('获取学生列表失败:', error)
  }
}

const handleSearch = () => {
  currentPage.value = 1
}

const handleFilterChange = () => {
  currentPage.value = 1
}

const toggleFileSelection = (fileId: string) => {
  const index = selectedFiles.value.indexOf(fileId)
  if (index > -1) {
    selectedFiles.value.splice(index, 1)
  } else {
    selectedFiles.value.push(fileId)
  }
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedFiles.value = []
  } else {
    selectedFiles.value = filteredFiles.value.map(file => file.id)
  }
}

const clearSelection = () => {
  selectedFiles.value = []
}

const startBatchDownload = async () => {
  if (selectedFiles.value.length === 0) return
  
  try {
    loading.value = true
    const response = await createBatchDownload({
      fileIds: selectedFiles.value
    })
    
    currentBatchId.value = response.data.batchId
    showDownloadQueue.value = true
    
    // 开始监控下载进度
    startProgressMonitoring()
    
    // 清空选择
    selectedFiles.value = []
  } catch (error) {
    console.error('创建下载任务失败:', error)
  } finally {
    loading.value = false
  }
}

const refreshDownloadTasks = async () => {
  refreshingTasks.value = true
  try {
    const response = await getDownloadTasks(currentBatchId.value)
    downloadTasks.value = response.data.data || []
  } catch (error) {
    console.error('获取下载任务失败:', error)
  } finally {
    refreshingTasks.value = false
  }
}

const startProgressMonitoring = () => {
  if (progressTimer) {
    clearInterval(progressTimer)
  }
  
  progressTimer = setInterval(async () => {
    await refreshDownloadTasks()
  }, 1000) // 每秒更新一次
}

const stopProgressMonitoring = () => {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

const pauseTask = async (taskId: string) => {
  try {
    await pauseDownloadTask(taskId)
    await refreshDownloadTasks()
  } catch (error) {
    console.error('暂停任务失败:', error)
  }
}

const resumeTask = async (taskId: string) => {
  try {
    await resumeDownloadTask(taskId)
    await refreshDownloadTasks()
  } catch (error) {
    console.error('恢复任务失败:', error)
  }
}

const cancelTask = async (taskId: string) => {
  try {
    await cancelDownloadTask(taskId)
    await refreshDownloadTasks()
  } catch (error) {
    console.error('取消任务失败:', error)
  }
}

const pauseAllTasks = async () => {
  try {
    await pauseBatchDownload(currentBatchId.value)
    await refreshDownloadTasks()
  } catch (error) {
    console.error('暂停所有任务失败:', error)
  }
}

const resumeAllTasks = async () => {
  try {
    await resumeBatchDownload(currentBatchId.value)
    await refreshDownloadTasks()
  } catch (error) {
    console.error('恢复所有任务失败:', error)
  }
}

const cancelAllTasks = async () => {
  try {
    await cancelBatchDownload(currentBatchId.value)
    await refreshDownloadTasks()
  } catch (error) {
    console.error('取消所有任务失败:', error)
  }
}

const cleanupCompletedTasks = async () => {
  try {
    await apiCleanupCompletedTasks(currentBatchId.value)
    await refreshDownloadTasks()
  } catch (error) {
    console.error('清理已完成任务失败:', error)
  }
}

// 工具函数
const getFileIcon = (type: string) => {
  const iconMap: Record<string, string> = {
    image: 'icon-image',
    document: 'icon-document',
    card: 'icon-card',
    default: 'icon-file'
  }
  return iconMap[type] || iconMap.default
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatSpeed = (bytesPerSecond: number) => {
  return formatFileSize(bytesPerSecond) + '/s'
}

const formatTime = (seconds: number) => {
  if (seconds < 60) return `${Math.round(seconds)}秒`
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`
  return `${Math.round(seconds / 3600)}小时`
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

const getStudentName = (studentId: string) => {
  const student = students.value.find(s => s.id === studentId)
  return student ? student.name : '未知学生'
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: '等待中',
    downloading: '下载中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return statusMap[status] || status
}

// 监听器
watch(showDownloadQueue, (newValue) => {
  if (newValue) {
    startProgressMonitoring()
  } else {
    stopProgressMonitoring()
  }
})

// 生命周期
onMounted(async () => {
  await Promise.all([
    refreshFileList(),
    loadStudents()
  ])
})

onUnmounted(() => {
  stopProgressMonitoring()
})
</script>

<style scoped>
.batch-download-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 面板头部 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* 按钮样式 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
  border-color: #6b7280;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
  border-color: #4b5563;
}

.btn-outline {
  background: transparent;
  color: #6b7280;
  border-color: #d1d5db;
}

.btn-outline:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-success {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.btn-warning {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.btn-danger {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-icon {
  padding: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: rgba(0, 0, 0, 0.05);
}

/* 搜索和筛选 */
.filter-section {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 6px;
}

.search-box {
  position: relative;
  flex: 1;
}

.search-box i {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.search-box input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.filter-controls {
  display: flex;
  gap: 12px;
}

.filter-controls select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
}

/* 批量操作栏 */
.bulk-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  margin-bottom: 16px;
}

.selection-info {
  display: flex;
  align-items: center;
}

.checkbox-container {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

/* 文件网格 */
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.file-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
}

.file-item.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.file-checkbox input {
  margin: 0;
}

.file-preview {
  flex-shrink: 0;
}

.file-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 24px;
}

.file-type-image {
  background: #fef3c7;
  color: #d97706;
}

.file-type-document {
  background: #dbeafe;
  color: #2563eb;
}

.file-type-card {
  background: #d1fae5;
  color: #059669;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.file-tags {
  display: flex;
  gap: 4px;
}

.tag {
  padding: 2px 6px;
  background: #f3f4f6;
  color: #374151;
  border-radius: 4px;
  font-size: 11px;
}

/* 队列控制 */
.queue-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 20px;
}

.queue-stats {
  display: flex;
  gap: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.stat-value.completed {
  color: #10b981;
}

.stat-value.downloading {
  color: #3b82f6;
}

.stat-value.failed {
  color: #ef4444;
}

.queue-actions {
  display: flex;
  gap: 8px;
}

/* 整体进度 */
.overall-progress {
  margin-bottom: 24px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 6px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.progress-percentage {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.progress-fill.status-completed {
  background: #10b981;
}

.progress-fill.status-failed {
  background: #ef4444;
}

.progress-fill.status-paused {
  background: #f59e0b;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
}

/* 任务列表 */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
}

.task-item.status-completed {
  border-color: #10b981;
  background: #f0fdf4;
}

.task-item.status-failed {
  border-color: #ef4444;
  background: #fef2f2;
}

.task-item.status-downloading {
  border-color: #3b82f6;
  background: #eff6ff;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.task-name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  margin-right: 12px;
}

.task-actions {
  display: flex;
  gap: 4px;
}

.task-progress {
  margin-bottom: 8px;
}

.progress-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.task-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.status-pending {
  background: #f3f4f6;
  color: #374151;
}

.status-badge.status-downloading {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-badge.status-paused {
  background: #fef3c7;
  color: #d97706;
}

.status-badge.status-completed {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.status-failed {
  background: #fee2e2;
  color: #dc2626;
}

.status-badge.status-cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.task-time {
  font-size: 11px;
  color: #9ca3af;
}

.task-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px;
  background: #fee2e2;
  border-radius: 4px;
  font-size: 12px;
  color: #dc2626;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.page-info {
  font-size: 14px;
  color: #6b7280;
}

/* 状态样式 */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: #6b7280;
}

.loading-state i,
.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .batch-download-container {
    padding: 16px;
  }
  
  .panel-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .filter-section {
    flex-direction: column;
  }
  
  .bulk-actions {
    flex-direction: column;
    gap: 12px;
  }
  
  .file-grid {
    grid-template-columns: 1fr;
  }
  
  .queue-controls {
    flex-direction: column;
    gap: 16px;
  }
  
  .queue-stats {
    justify-content: space-around;
    width: 100%;
  }
  
  .task-header {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .task-name {
    margin-right: 0;
  }
}
</style>