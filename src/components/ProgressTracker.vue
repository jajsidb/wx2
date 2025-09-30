<template>
  <div class="progress-tracker">
    <el-card class="progress-card" shadow="hover">
      <template #header>
        <div class="progress-header">
          <el-icon><Loading /></el-icon>
          <span>批量生成进度</span>
        </div>
      </template>
      
      <div class="progress-content">
        <div class="task-info">
          <div class="task-item">
            <span class="label">任务ID:</span>
            <span class="value">{{ taskId || '未开始' }}</span>
          </div>
          <div class="task-item">
            <span class="label">状态:</span>
            <el-tag :type="getStatusType(status)">{{ getStatusText(status) }}</el-tag>
          </div>
          <div class="task-item">
            <span class="label">总数:</span>
            <span class="value">{{ total }}</span>
          </div>
          <div class="task-item">
            <span class="label">已完成:</span>
            <span class="value">{{ completed }}</span>
          </div>
        </div>
        
        <div class="progress-bar">
          <el-progress 
            :percentage="progressPercentage" 
            :status="getProgressStatus(status)"
            :stroke-width="8"
            :show-text="true"
          />
        </div>
        
        <div class="time-info" v-if="startTime">
          <div class="time-item">
            <span class="label">开始时间:</span>
            <span class="value">{{ formatTime(startTime) }}</span>
          </div>
          <div class="time-item" v-if="endTime">
            <span class="label">完成时间:</span>
            <span class="value">{{ formatTime(endTime) }}</span>
          </div>
          <div class="time-item" v-if="estimatedTime">
            <span class="label">预计完成:</span>
            <span class="value">{{ formatTime(estimatedTime) }}</span>
          </div>
        </div>
        
        <div class="error-info" v-if="error">
          <el-alert
            :title="error"
            type="error"
            :closable="false"
            show-icon
          />
        </div>
        
        <div class="action-buttons">
          <el-button 
            v-if="status === 'running'" 
            type="danger" 
            size="small"
            @click="stopTask"
          >
            停止任务
          </el-button>
          <el-button 
            v-if="status === 'completed' && downloadUrl" 
            type="primary" 
            size="small"
            @click="downloadResult"
          >
            下载结果
          </el-button>
          <el-button 
            v-if="status === 'failed' || status === 'stopped'" 
            type="warning" 
            size="small"
            @click="retryTask"
          >
            重试任务
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { getTaskProgress } from '../api'
import { handleApiError, showErrorMessage, showSuccessMessage } from '../utils/errorHandler'

interface Props {
  taskId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

const props = withDefaults(defineProps<Props>(), {
  autoRefresh: true,
  refreshInterval: 2000
})

const emit = defineEmits<{
  taskCompleted: [result: any]
  taskFailed: [error: string]
  taskStopped: []
}>()

// 响应式数据
const status = ref<'pending' | 'running' | 'completed' | 'failed' | 'stopped'>('pending')
const total = ref(0)
const completed = ref(0)
const startTime = ref<string>('')
const endTime = ref<string>('')
const estimatedTime = ref<string>('')
const error = ref<string>('')
const downloadUrl = ref<string>('')
const refreshTimer = ref<NodeJS.Timeout | null>(null)

// 计算属性
const progressPercentage = computed(() => {
  if (total.value === 0) return 0
  return Math.round((completed.value / total.value) * 100)
})

// 获取状态类型
const getStatusType = (status: string) => {
  switch (status) {
    case 'pending': return 'info'
    case 'running': return 'warning'
    case 'completed': return 'success'
    case 'failed': return 'danger'
    case 'stopped': return 'info'
    default: return 'info'
  }
}

// 获取状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case 'pending': return '等待中'
    case 'running': return '进行中'
    case 'completed': return '已完成'
    case 'failed': return '失败'
    case 'stopped': return '已停止'
    default: return '未知'
  }
}

// 获取进度条状态
const getProgressStatus = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'failed': return 'exception'
    case 'stopped': return 'warning'
    default: return undefined
  }
}

// 格式化时间
const formatTime = (timeStr: string) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN')
}

// 获取任务进度
const fetchProgress = async () => {
  if (!props.taskId) return
  
  try {
    const response = await getTaskProgress(props.taskId)
    const data = response.data.data
    
    status.value = data.status
    total.value = data.total || 0
    completed.value = data.completed || 0
    startTime.value = data.startTime || ''
    endTime.value = data.endTime || ''
    estimatedTime.value = data.estimatedTime || ''
    error.value = data.error || ''
    downloadUrl.value = data.downloadUrl || ''
    
    // 任务完成或失败时停止轮询
    if (status.value === 'completed') {
      stopRefresh()
      emit('taskCompleted', data)
      ElNotification({
        title: '任务完成',
        message: `批量生成任务已完成，共生成${total.value}张信息卡`,
        type: 'success',
        duration: 5000
      })
    } else if (status.value === 'failed') {
      stopRefresh()
      emit('taskFailed', error.value)
      ElNotification({
        title: '任务失败',
        message: error.value || '批量生成任务失败',
        type: 'error',
        duration: 5000
      })
    } else if (status.value === 'stopped') {
      stopRefresh()
      emit('taskStopped')
    }
  } catch (err: any) {
    const apiError = handleApiError(err, '获取任务进度')
    showErrorMessage(apiError)
  }
}

// 开始轮询
const startRefresh = () => {
  if (props.autoRefresh && props.taskId) {
    refreshTimer.value = setInterval(fetchProgress, props.refreshInterval)
  }
}

// 停止轮询
const stopRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

// 停止任务
const stopTask = async () => {
  // 这里可以调用停止任务的API
  ElMessage.info('停止任务功能待实现')
}

// 下载结果
const downloadResult = () => {
  if (downloadUrl.value) {
    window.open(downloadUrl.value, '_blank')
  } else {
    ElMessage.warning('下载链接不可用')
  }
}

// 重试任务
const retryTask = () => {
  // 这里可以重新开始任务
  ElMessage.info('重试任务功能待实现')
}

// 监听taskId变化
const watchTaskId = () => {
  if (props.taskId) {
    fetchProgress()
    startRefresh()
  }
}

// 生命周期
onMounted(() => {
  watchTaskId()
})

onUnmounted(() => {
  stopRefresh()
})

// 暴露方法
defineExpose({
  fetchProgress,
  startRefresh,
  stopRefresh
})
</script>

<style scoped>
.progress-tracker {
  width: 100%;
}

.progress-card {
  border-radius: 12px;
  overflow: hidden;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.progress-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.value {
  font-size: 14px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.progress-bar {
  margin: 8px 0;
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--el-fill-color-extra-light);
  border-radius: 8px;
}

.time-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.error-info {
  margin: 8px 0;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

@media (max-width: 768px) {
  .task-info {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    justify-content: center;
  }
}
</style>