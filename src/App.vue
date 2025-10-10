<template>
  <div id="app" class="app-container">
    <!-- 应用头部 -->
    <header class="app-header">
      <div class="header-content">
        <h1 class="app-title">
          <el-icon><Picture /></el-icon>
          智能图片展示系统
        </h1>
        <div class="header-actions">
          <el-button-group>
            <el-button 
              type="primary" 
              :icon="Upload" 
              @click="showUploadDialog = true"
              size="large"
            >
              导入Excel数据
            </el-button>
            <el-button 
              type="success" 
              :icon="DataAnalysis" 
              @click="getSystemStats"
              size="large"
            >
              系统统计
            </el-button>
            <el-button 
              type="warning" 
              :icon="Picture" 
              @click="generateAllCards"
              size="large"
              :disabled="students.length === 0"
            >
              批量生成信息卡
            </el-button>
            <el-button 
              type="info" 
              :icon="Refresh" 
              @click="refreshAllData"
              size="large"
            >
              刷新数据
            </el-button>
            <el-button 
              type="primary" 
              :icon="Setting" 
              @click="showTemplateDialog = true"
              size="large"
            >
              模板管理
            </el-button>
            <el-button 
              type="success" 
              :icon="Download" 
              @click="showBatchDownloadDialog = true"
              size="large"
            >
              批量下载
            </el-button>
          </el-button-group>
        </div>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <main class="app-main">
      <!-- 主图片展示区域 -->
      <section class="main-display-section">
        <MainImageDisplay 
          ref="mainImageDisplayRef"
          :excel-data="excelData"
          @text-overlay-updated="handleTextOverlayUpdate"
        />
      </section>

      <!-- 学生信息展示区域 -->
      <section class="student-info-section" v-if="students.length > 0">
        <ImageDisplay 
          :students="students"
          @refresh-needed="refreshStudents"
        />
      </section>
    </main>

    <!-- Excel上传对话框 -->
    <el-dialog
      v-model="showUploadDialog"
      title="Excel数据导入"
      width="90%"
      :close-on-click-modal="false"
      class="upload-dialog"
    >
      <ExcelUpload 
        @upload-success="handleUploadSuccess"
        @data-parsed="handleDataParsed"
      />
    </el-dialog>

    <!-- 模板管理对话框 -->
    <el-dialog
      v-model="showTemplateDialog"
      title="模板管理"
      width="90%"
      :close-on-click-modal="false"
      class="template-dialog"
    >
      <TemplateManagement />
    </el-dialog>

    <!-- 批量下载对话框 -->
    <el-dialog
      v-model="showBatchDownloadDialog"
      title="批量下载管理"
      width="90%"
      :close-on-click-modal="false"
      class="batch-download-dialog"
    >
      <BatchDownload />
    </el-dialog>

    <!-- 数据统计面板 -->
    <div class="stats-panel" v-if="excelData.length > 0">
      <el-card class="stats-card" shadow="hover">
        <template #header>
          <div class="stats-header">
            <el-icon><DataAnalysis /></el-icon>
            <span>数据统计</span>
          </div>
        </template>
        <div class="stats-content">
          <div class="stat-item">
            <span class="stat-label">总数据量</span>
            <span class="stat-value">{{ excelData.length }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">文字叠加</span>
            <span class="stat-value">{{ textOverlayCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">学生信息</span>
            <span class="stat-value">{{ students.length }}</span>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 进度跟踪对话框 -->
    <el-dialog
      v-model="showProgressDialog"
      title="批量生成进度"
      width="600px"
      :close-on-click-modal="false"
      class="progress-dialog"
    >
      <ProgressTracker 
        :task-id="currentTaskId"
        @task-completed="handleTaskCompleted"
        @task-failed="handleTaskFailed"
        @task-stopped="handleTaskStopped"
      />
    </el-dialog>

    <!-- 全局加载状态 -->
    <el-loading 
      v-loading="globalLoading"
      :text="loadingText"
      background="rgba(0, 0, 0, 0.7)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { Picture, Upload, DataAnalysis, Refresh, Setting, Download } from '@element-plus/icons-vue'
import ExcelUpload from './components/ExcelUpload.vue'
import ImageDisplay from './components/ImageDisplay.vue'
import MainImageDisplay from './components/MainImageDisplay.vue'
import TemplateManagement from './components/TemplateManagement.vue'
import ProgressTracker from './components/ProgressTracker.vue'
import BatchDownload from './components/BatchDownload.vue'
import { getStudents, getSystemStatistics, generateCardsBatch } from './api'
import { handleApiError, showErrorMessage, showSuccessMessage, showWarningMessage, ApiError } from './utils/errorHandler'

// 学生数据接口定义
interface StudentData {
  name: string
  college: string
  className: string
  counselor: string
  dormitoryNumber: string
  bedNumber: string
  imageUrl?: string  // 新增图片URL字段，可选
}

// 响应式数据
const mainImageDisplayRef = ref()
const students = ref<any[]>([])
const excelData = ref<StudentData[]>([])
const showUploadDialog = ref(false)
const showTemplateDialog = ref(false)
const showBatchDownloadDialog = ref(false)
const showProgressDialog = ref(false)
const currentTaskId = ref<string>('')
const globalLoading = ref(false)
const loadingText = ref('加载中...')
const textOverlayCount = ref(0)

// 计算属性
const hasData = computed(() => excelData.value.length > 0 || students.value.length > 0)

// 处理Excel数据解析完成
const handleDataParsed = async (data: StudentData[]) => {
  console.log('Excel数据解析完成:', data)
  
  globalLoading.value = true
  loadingText.value = '正在处理Excel数据...'
  
  try {
    // 更新Excel数据
    excelData.value = data
    
    // 等待DOM更新
    await nextTick()
    
    // 通知主图片展示组件更新文字叠加
    if (mainImageDisplayRef.value) {
      await mainImageDisplayRef.value.updateTextOverlays(data)
    }
    
    showSuccessMessage(`成功解析${data.length}条Excel数据，并生成文字叠加`, {
      type: 'notification',
      title: '数据处理完成'
    })
    
  } catch (error: any) {
    const apiError = handleApiError(error, 'Excel数据处理')
    showErrorMessage(apiError, { showDetail: true, type: 'notification' })
  } finally {
    globalLoading.value = false
  }
}

// 处理上传成功
const handleUploadSuccess = async (response: any) => {
  console.log('上传成功:', response)
  
  showSuccessMessage('数据已成功上传到服务器', {
    type: 'notification',
    title: '上传成功'
  })
  
  // 关闭上传对话框
  showUploadDialog.value = false
  
  // 刷新学生列表
  await refreshStudents()
}

// 处理文字叠加更新
const handleTextOverlayUpdate = (count: number) => {
  textOverlayCount.value = count
}

// 刷新学生列表
const refreshStudents = async () => {
  globalLoading.value = true
  loadingText.value = '正在加载学生信息...'
  
  try {
    const response = await getStudents({
      page: 0, // API使用0基索引
      size: 100,
      nameKeyword: ''
    })
    
    // 适配新的API响应格式
    if (response.data.success) {
      students.value = response.data.data.content || []
      ElMessage.success(`成功加载${students.value.length}条学生信息`)
    } else {
      throw new Error(response.data.message || '获取学生列表失败')
    }
  } catch (error: any) {
    const apiError = handleApiError(error, '获取学生列表')
    showErrorMessage(apiError, { showDetail: true })
    
    // 如果是网络错误，提供重试选项
    if (apiError.code === 9001) {
      ElNotification({
        title: '网络连接失败',
        message: '无法连接到服务器，请检查网络或稍后重试',
        type: 'error',
        duration: 0,
        showClose: true
      })
    }
  } finally {
    globalLoading.value = false
  }
}

// 初始化应用
const initializeApp = async () => {
  globalLoading.value = true
  loadingText.value = '正在初始化应用...'
  
  try {
    // 加载学生数据
    await refreshStudents()
    
    ElNotification({
      title: '应用初始化完成',
      message: '欢迎使用智能图片展示系统',
      type: 'success',
      duration: 2000
    })
  } catch (error: any) {
    console.error('应用初始化失败:', error)
    ElNotification({
      title: '初始化失败',
      message: '应用初始化过程中出现错误，部分功能可能不可用',
      type: 'warning',
      duration: 4000
    })
  } finally {
    globalLoading.value = false
  }
}

// 组件挂载时初始化
onMounted(() => {
  console.log('App组件已挂载')
  initializeApp()
})
// 获取系统统计
const getSystemStats = async () => {
  globalLoading.value = true
  loadingText.value = '正在获取系统统计...'
  
  try {
    const response = await getSystemStatistics()
    const stats = response.data.data
    
    // 更新统计数据
    textOverlayCount.value = stats.totalCards || 0
    
    ElNotification({
      title: '系统统计',
      message: `总学生数: ${stats.totalStudents}, 总批次数: ${stats.totalBatches}, 已生成信息卡: ${stats.totalCards}`,
      type: 'info',
      duration: 5000
    })
    
    console.log('获取系统统计成功:', stats)
  } catch (error: any) {
    const apiError = handleApiError(error, '获取系统统计')
    showErrorMessage(apiError)
  } finally {
    globalLoading.value = false
  }
}

// 批量生成信息卡
const generateAllCards = async () => {
  if (students.value.length === 0) {
    showWarningMessage('没有学生数据，无法生成信息卡')
    return
  }
  
  globalLoading.value = true
  loadingText.value = '正在启动批量生成任务...'
  
  try {
    const studentIds = students.value.map(student => student.id)
    const response = await generateCardsBatch(studentIds)
    
    const taskId = response.data.data.taskId
    
    // 显示进度跟踪对话框
    showProgressDialog.value = true
    currentTaskId.value = taskId
    
    showSuccessMessage(`批量生成任务已启动，任务ID: ${taskId}`, {
      type: 'notification',
      title: '任务已启动'
    })
  } catch (error: any) {
    const apiError = handleApiError(error, '批量生成信息卡')
    showErrorMessage(apiError, { showDetail: true, type: 'notification' })
  } finally {
    globalLoading.value = false
  }
}

// 处理任务完成
const handleTaskCompleted = (result: any) => {
  console.log('批量生成任务完成:', result)
  showProgressDialog.value = false
  currentTaskId.value = ''
  
  // 刷新学生列表
  refreshStudents()
}

// 处理任务失败
const handleTaskFailed = (error: string) => {
  console.error('批量生成任务失败:', error)
  showProgressDialog.value = false
  currentTaskId.value = ''
}

// 处理任务停止
const handleTaskStopped = () => {
  console.log('批量生成任务已停止')
  showProgressDialog.value = false
  currentTaskId.value = ''
}

// 刷新所有数据
const refreshAllData = async () => {
  globalLoading.value = true
  loadingText.value = '正在刷新所有数据...'
  
  try {
    await Promise.all([
      refreshStudents(),
      getStats()
    ])
    
    showSuccessMessage('所有数据刷新完成')
  } catch (error: any) {
    const apiError = handleApiError(error, '刷新数据')
    showErrorMessage(apiError)
  } finally {
    globalLoading.value = false
  }
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  flex-direction: column;
}

/* 应用头部样式 */
.app-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--el-border-color-lighter);
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-title .el-icon {
  font-size: 28px;
  color: var(--el-color-primary);
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* 主要内容区域 */
.app-main {
  flex: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.main-display-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.student-info-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 统计面板样式 */
.stats-panel {
  position: fixed;
  top: 120px;
  right: 24px;
  z-index: 999;
  width: 200px;
}

.stats-card {
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-primary);
}

/* 上传对话框样式 */
.upload-dialog {
  border-radius: 16px;
  overflow: hidden;
}

.upload-dialog :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
}

.upload-dialog :deep(.el-dialog__header) {
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
  color: white;
  padding: 20px 24px;
}

.upload-dialog :deep(.el-dialog__title) {
  color: white;
  font-weight: 600;
}

.upload-dialog :deep(.el-dialog__headerbtn .el-dialog__close) {
  color: white;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .stats-panel {
    position: relative;
    top: auto;
    right: auto;
    width: 100%;
    margin-bottom: 24px;
  }
  
  .app-main {
    padding: 16px;
  }
}

@media (max-width: 768px) {
  .header-content {
    padding: 12px 16px;
    flex-direction: column;
    gap: 12px;
  }
  
  .app-title {
    font-size: 20px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: center;
  }
  
  .main-display-section,
  .student-info-section {
    padding: 16px;
    border-radius: 12px;
  }
  
  .upload-dialog {
    width: 95% !important;
  }
}

@media (max-width: 480px) {
  .app-main {
    padding: 12px;
    gap: 16px;
  }
  
  .app-title {
    font-size: 18px;
  }
  
  .main-display-section,
  .student-info-section {
    padding: 12px;
    border-radius: 8px;
  }
}

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  .app-container {
    background: linear-gradient(135deg, #1a1a1a 0%, #2d3748 100%);
  }
  
  .app-header {
    background: rgba(26, 26, 26, 0.95);
    border-bottom-color: var(--el-border-color-darker);
  }
  
  .main-display-section,
  .student-info-section {
    background: rgba(26, 26, 26, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .stats-card {
    background: rgba(26, 26, 26, 0.95);
    border-color: rgba(255, 255, 255, 0.1);
  }
}

/* 动画效果 */
.main-display-section,
.student-info-section,
.stats-panel {
  animation: fadeInUp 0.6s ease-out;
}

.app-header {
  animation: slideInDown 0.4s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 高性能优化 */
.app-header,
.main-display-section,
.student-info-section,
.stats-card {
  will-change: transform;
}

/* 滚动条样式 */
:deep(::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(::-webkit-scrollbar-track) {
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

:deep(::-webkit-scrollbar-thumb) {
  background: var(--el-color-primary-light-5);
  border-radius: 4px;
}

:deep(::-webkit-scrollbar-thumb:hover) {
  background: var(--el-color-primary);
}
</style>
