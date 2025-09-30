<template>
  <div class="excel-upload-container">
    <el-card class="upload-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon><Upload /></el-icon>
          <span>Excel 数据导入</span>
          <el-tag v-if="parsedData.length > 0" type="success" class="data-count-tag">
            已解析 {{ parsedData.length }} 条数据
          </el-tag>
        </div>
      </template>
      
      <!-- 文件上传区域 -->
      <el-upload
        ref="uploadRef"
        class="upload-dragger"
        drag
        :auto-upload="false"
        :multiple="false"
        :accept="acceptedFormats"
        :before-upload="beforeUpload"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
        :file-list="fileList"
        :disabled="uploading || parsing"
      >
        <el-icon class="el-icon--upload">
          <upload-filled v-if="!parsing" />
          <loading v-else />
        </el-icon>
        <div class="el-upload__text">
          <span v-if="!parsing">将 Excel 文件拖拽到此处，或<em>点击上传</em></span>
          <span v-else>正在解析文件...</span>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 .xlsx 和 .xls 格式，文件大小不超过 {{ maxSizeMB }}MB
            <br>
            <span class="format-tip">表头格式：姓名 | 学院 | 班级 | 辅导员 | 寝室号 | 床位号</span>
          </div>
        </template>
      </el-upload>
      
      <!-- 解析进度 -->
      <div v-if="parsing" class="parsing-progress">
        <el-progress 
          :percentage="parseProgress" 
          :status="parseStatus"
          :stroke-width="6"
        >
          <template #default="{ percentage }">
            <span class="progress-text">{{ parseProgressText }} {{ percentage }}%</span>
          </template>
        </el-progress>
      </div>
      
      <!-- 上传进度 -->
      <div v-if="uploading" class="upload-progress">
        <el-progress 
          :percentage="uploadProgress" 
          :status="uploadStatus"
          :stroke-width="8"
        >
          <template #default="{ percentage }">
            <span class="progress-text">{{ progressText }} {{ percentage }}%</span>
          </template>
        </el-progress>
      </div>
      
      <!-- 数据预览区域 -->
      <div v-if="parsedData.length > 0 && !uploading" class="data-preview">
        <div class="preview-header">
          <h4>数据预览</h4>
          <div class="preview-actions">
            <el-button size="small" @click="togglePreviewMode">
              {{ previewMode === 'table' ? '卡片视图' : '表格视图' }}
            </el-button>
            <el-button size="small" type="warning" @click="editData">
              编辑数据
            </el-button>
          </div>
        </div>
        
        <!-- 表格视图 -->
        <div v-if="previewMode === 'table'" class="table-preview">
          <el-table 
            :data="paginatedData" 
            size="small" 
            border 
            stripe
            max-height="300"
            class="preview-table"
          >
            <el-table-column prop="name" label="姓名" width="100" />
            <el-table-column prop="college" label="学院" width="120" />
            <el-table-column prop="className" label="班级" width="140" />
            <el-table-column prop="counselor" label="辅导员" width="100" />
            <el-table-column prop="dormitoryNumber" label="寝室号" width="100" />
            <el-table-column prop="bedNumber" label="床位号" width="80" />
            <el-table-column label="状态" width="80">
              <template #default="scope">
                <el-tag 
                  :type="getValidationStatus(scope.row).type" 
                  size="small"
                >
                  {{ getValidationStatus(scope.row).text }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          
          <el-pagination
            v-if="parsedData.length > pageSize"
            class="preview-pagination"
            :current-page="currentPage"
            :page-size="pageSize"
            :total="parsedData.length"
            layout="prev, pager, next, sizes"
            :page-sizes="[5, 10, 20]"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
            small
          />
        </div>
        
        <!-- 卡片视图 -->
        <div v-else class="card-preview">
          <div class="card-grid">
            <el-card 
              v-for="(item, index) in paginatedData" 
              :key="index"
              class="data-card"
              :class="{ 'invalid': !isValidData(item) }"
              shadow="hover"
            >
              <div class="card-content">
                <div class="student-info">
                  <h5>{{ item.name || '未填写' }}</h5>
                  <p>{{ item.college }} - {{ item.className }}</p>
                  <p>辅导员：{{ item.counselor }}</p>
                  <p>{{ item.dormitoryNumber }} - {{ item.bedNumber }}</p>
                </div>
                <div class="validation-badge">
                  <el-tag 
                    :type="getValidationStatus(item).type" 
                    size="small"
                  >
                    {{ getValidationStatus(item).text }}
                  </el-tag>
                </div>
              </div>
            </el-card>
          </div>
          
          <el-pagination
            v-if="parsedData.length > pageSize"
            class="preview-pagination"
            :current-page="currentPage"
            :page-size="pageSize"
            :total="parsedData.length"
            layout="prev, pager, next"
            @current-change="handleCurrentChange"
            small
          />
        </div>
        
        <!-- 验证统计 -->
        <div class="validation-summary">
          <el-descriptions :column="4" size="small" border>
            <el-descriptions-item label="总数据">{{ parsedData.length }}</el-descriptions-item>
            <el-descriptions-item label="有效数据">{{ validDataCount }}</el-descriptions-item>
            <el-descriptions-item label="无效数据">{{ invalidDataCount }}</el-descriptions-item>
            <el-descriptions-item label="有效率">{{ validationRate }}%</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      
      <!-- 操作按钮 -->
      <div class="action-buttons" v-if="fileList.length > 0">
        <el-button @click="clearData" :disabled="uploading || parsing">
          清空数据
        </el-button>
        <el-button 
          v-if="parsedData.length === 0"
          type="info" 
          @click="parseExcelFile" 
          :disabled="uploading || parsing"
          :loading="parsing"
        >
          解析文件
        </el-button>
        <el-button 
          v-if="parsedData.length > 0"
          type="primary" 
          @click="handleUpload" 
          :disabled="uploading || parsing || invalidDataCount > 0"
          :loading="uploading"
        >
          保存到数据库 ({{ validDataCount }}/{{ parsedData.length }})
        </el-button>
      </div>
    </el-card>
    
    <!-- 数据编辑对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑数据"
      width="80%"
      :close-on-click-modal="false"
    >
      <el-table 
        :data="editableData" 
        border 
        stripe
        max-height="400"
        class="edit-table"
      >
        <el-table-column type="index" label="#" width="50" />
        <el-table-column label="姓名" width="120">
          <template #default="scope">
            <el-input v-model="scope.row.name" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="学院" width="150">
          <template #default="scope">
            <el-input v-model="scope.row.college" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="班级" width="160">
          <template #default="scope">
            <el-input v-model="scope.row.className" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="辅导员" width="120">
          <template #default="scope">
            <el-input v-model="scope.row.counselor" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="寝室号" width="120">
          <template #default="scope">
            <el-input v-model="scope.row.dormitoryNumber" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="床位号" width="100">
          <template #default="scope">
            <el-input v-model="scope.row.bedNumber" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="scope">
            <el-button 
              type="danger" 
              size="small" 
              @click="removeDataRow(scope.$index)"
              :icon="Delete"
            />
          </template>
        </el-table-column>
      </el-table>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveEditedData">保存修改</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, UploadFilled, Loading, Delete } from '@element-plus/icons-vue'
import type { UploadFile, UploadFiles, UploadRawFile } from 'element-plus'
import * as XLSX from 'xlsx'
import { uploadExcel, saveStudentsToDatabase } from '../api';

// 学生数据接口定义
interface StudentData {
  name: string
  college: string
  className: string
  counselor: string
  dormitoryNumber: string
  bedNumber: string
}

interface Props {
  maxSizeMB?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxSizeMB: 10,
})

// Emits定义
const emit = defineEmits<{
  uploadSuccess: []
  dataParsed: [data: StudentData[]]
}>()

// 响应式数据
const uploadRef = ref<InstanceType<typeof ElUpload>>()
const fileList = ref<UploadFile[]>([])
const uploading = ref(false)
const parsing = ref(false)
const uploadProgress = ref(0)
const parseProgress = ref(0)
const uploadStatus = ref<'success' | 'exception' | 'warning' | ''>('')
const parseStatus = ref<'success' | 'exception' | 'warning' | ''>('')
const progressText = ref('准备上传')
const parseProgressText = ref('正在解析')

// 数据相关
const parsedData = shallowRef<StudentData[]>([])
const editableData = ref<StudentData[]>([])
const editDialogVisible = ref(false)
const currentBatchId = ref<string>('')

// 生成批次ID
const generateBatchId = () => {
  return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// 预览相关
const previewMode = ref<'table' | 'card'>('table')
const currentPage = ref(1)
const pageSize = ref(10)

// 表头映射配置
const headerMapping = {
  '姓名': 'name',
  '学院': 'college', 
  '班级': 'className',
  '辅导员': 'counselor',
  '寝室号': 'dormitoryNumber',
  '床位号': 'bedNumber'
}

// 计算属性
const acceptedFormats = computed(() => '.xlsx,.xls')

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return parsedData.value.slice(start, end)
})

const validDataCount = computed(() => {
  return parsedData.value.filter(item => isValidData(item)).length
})

const invalidDataCount = computed(() => {
  return parsedData.value.length - validDataCount.value
})

const validationRate = computed(() => {
  if (parsedData.value.length === 0) return 0
  return Math.round((validDataCount.value / parsedData.value.length) * 100)
})

// 数据验证函数
const isValidData = (data: StudentData): boolean => {
  return !!(data.name && data.college && data.className && 
           data.counselor && data.dormitoryNumber && data.bedNumber)
}

// 获取验证状态
const getValidationStatus = (data: StudentData) => {
  if (isValidData(data)) {
    return { type: 'success', text: '有效' }
  } else {
    return { type: 'danger', text: '无效' }
  }
}

// 方法定义
const beforeUpload = (rawFile: UploadRawFile) => {
  const isExcel = rawFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                  rawFile.type === 'application/vnd.ms-excel' ||
                  rawFile.name.endsWith('.xlsx') ||
                  rawFile.name.endsWith('.xls')
  
  if (!isExcel) {
    ElMessage.error('只能上传 Excel 文件！')
    return false
  }
  
  const isLtMaxSize = rawFile.size / 1024 / 1024 < props.maxSizeMB
  if (!isLtMaxSize) {
    ElMessage.error(`文件大小不能超过 ${props.maxSizeMB}MB！`)
    return false
  }
  
  return true
}

const handleFileChange = (file: UploadFile, files: UploadFiles) => {
  // Keep only the last selected file
  fileList.value = files.slice(-1)
  
  // 自动解析文件
  if (file.raw) {
    parseExcelFile()
  }
}

const handleFileRemove = () => {
  clearData()
}

// Excel文件解析
const parseExcelFile = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }
  
  const file = fileList.value[0].raw
  if (!file) {
    ElMessage.error('文件读取失败')
    return
  }
  
  parsing.value = true
  parseProgress.value = 0
  parseStatus.value = ''
  parseProgressText.value = '正在读取文件'
  
  try {
    // 模拟解析进度
    const progressInterval = setInterval(() => {
      if (parseProgress.value < 80) {
        parseProgress.value += Math.random() * 15
      }
    }, 100)
    
    // 读取文件
    const arrayBuffer = await file.arrayBuffer()
    parseProgress.value = 30
    parseProgressText.value = '正在解析Excel结构'
    
    // 解析Excel
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    parseProgress.value = 60
    parseProgressText.value = '正在转换数据格式'
    
    // 转换为JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
    
    if (jsonData.length < 2) {
      throw new Error('Excel文件数据不足，至少需要包含表头和一行数据')
    }
    
    // 获取表头
    const headers = jsonData[0] as string[]
    const dataRows = jsonData.slice(1)
    
    parseProgress.value = 80
    parseProgressText.value = '正在验证数据格式'
    
    // 验证表头
    const requiredHeaders = Object.keys(headerMapping)
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header))
    
    if (missingHeaders.length > 0) {
      throw new Error(`缺少必要的表头：${missingHeaders.join(', ')}`)
    }
    
    // 转换数据
    const convertedData: StudentData[] = dataRows
      .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
      .map((row, index) => {
        const studentData: any = {}
        headers.forEach((header, headerIndex) => {
          const mappedKey = headerMapping[header as keyof typeof headerMapping]
          if (mappedKey) {
            studentData[mappedKey] = String(row[headerIndex] || '').trim()
          }
        })
        return studentData as StudentData
      })
    
    clearInterval(progressInterval)
    parseProgress.value = 100
    parseStatus.value = 'success'
    parseProgressText.value = `解析完成！共${convertedData.length}条数据`
    
    parsedData.value = convertedData
    emit('dataParsed', convertedData)
    
    ElMessage.success(`Excel解析成功！共解析${convertedData.length}条数据，其中有效数据${validDataCount.value}条`)
    
    // 延迟重置解析状态
    setTimeout(() => {
      parsing.value = false
      parseProgress.value = 0
      parseStatus.value = ''
      parseProgressText.value = '正在解析'
    }, 2000)
    
  } catch (error: any) {
    parseStatus.value = 'exception'
    parseProgressText.value = '解析失败'
    
    const errorMessage = error.message || '文件解析失败，请检查文件格式'
    ElMessage.error(errorMessage)
    console.error('Excel解析错误:', error)
    
    parsedData.value = []
  } finally {
    parsing.value = false
  }
}

// 切换预览模式
const togglePreviewMode = () => {
  previewMode.value = previewMode.value === 'table' ? 'card' : 'table'
}

// 编辑数据
const editData = () => {
  editableData.value = JSON.parse(JSON.stringify(parsedData.value))
  editDialogVisible.value = true
}

// 保存编辑的数据
const saveEditedData = () => {
  parsedData.value = editableData.value.filter(item => 
    item.name || item.college || item.className || 
    item.counselor || item.dormitoryNumber || item.bedNumber
  )
  editDialogVisible.value = false
  ElMessage.success('数据修改已保存')
  emit('dataParsed', parsedData.value)
}

// 删除数据行
const removeDataRow = (index: number) => {
  editableData.value.splice(index, 1)
}

// 分页处理
const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
}

const clearData = () => {
  fileList.value = []
  parsedData.value = []
  uploadRef.value?.clearFiles()
  uploadProgress.value = 0
  uploadStatus.value = ''
  progressText.value = '准备上传'
  parseProgress.value = 0
  parseStatus.value = ''
  parseProgressText.value = '正在解析'
}

const handleUpload = async () => {
  if (parsedData.value.length === 0) {
    ElMessage.warning('没有可上传的数据')
    return
  }
  
  if (invalidDataCount.value > 0) {
    ElMessage.warning('存在无效数据，请先修正后再上传')
    return
  }

  // 生成新的批次ID
  currentBatchId.value = generateBatchId()
  
  uploading.value = true
  uploadProgress.value = 0
  uploadStatus.value = ''
  progressText.value = '正在保存到数据库'

  try {
    // 模拟上传进度
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += Math.random() * 10
        progressText.value = `正在保存到数据库... ${Math.round(uploadProgress.value)}%`
      }
    }, 200)
    
    // 直接保存解析后的数据到数据库
    const response = await saveStudentsToDatabase(parsedData.value, currentBatchId.value)
    
    clearInterval(progressInterval)
    uploadProgress.value = 100
    uploadStatus.value = 'success'
    progressText.value = '保存成功'
    
    const { total, success, failed, fail_reasons } = response.data.data || {
      total: parsedData.value.length,
      success: parsedData.value.length,
      failed: 0,
      fail_reasons: []
    }
    
    let message = `数据保存完成。总共 ${total} 条，成功 ${success} 条，失败 ${failed} 条。`
    if (failed > 0 && fail_reasons) {
        message += `\n失败原因：\n${fail_reasons.join('\n')}`
    }

    ElMessage({
        message: message,
        type: 'success',
        dangerouslyUseHTMLString: true,
        duration: 5000,
    });

    emit('uploadSuccess')
    clearData()

  } catch (error: any) {
    uploadStatus.value = 'exception'
    progressText.value = '保存失败'
    const errorMessage = error.response?.data?.message || '数据保存失败，请检查网络或联系管理员'
    ElMessage.error(errorMessage)
  } finally {
    uploading.value = false
  }
}

// 暴露给父组件的方法
const resetUpload = () => {
  clearData()
}

defineExpose({
  resetUpload,
})

// 组件挂载时的初始化
onMounted(() => {
  console.log('ExcelUpload 组件已挂载')
})
</script>

<style scoped>
.excel-upload-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.upload-card {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.upload-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.data-count-tag {
  margin-left: auto;
}

.upload-dragger {
  width: 100%;
}

.upload-dragger :deep(.el-upload-dragger) {
  width: 100%;
  height: 180px;
  border: 2px dashed var(--el-border-color);
  border-radius: 8px;
  background-color: var(--el-fill-color-lighter);
  transition: all 0.3s ease;
}

.upload-dragger :deep(.el-upload-dragger:hover) {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.upload-dragger :deep(.el-upload-dragger.is-dragover) {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-8);
}

.el-icon--upload {
  font-size: 48px;
  color: var(--el-color-primary);
  margin-bottom: 16px;
}

.el-upload__text {
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.5;
}

.el-upload__text em {
  color: var(--el-color-primary);
  font-style: normal;
  text-decoration: underline;
}

.el-upload__tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
  margin-top: 8px;
}

.format-tip {
  color: var(--el-color-warning);
  font-weight: 500;
}

/* 进度条样式 */
.parsing-progress,
.upload-progress {
  margin: 20px 0;
  padding: 16px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.progress-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

/* 数据预览样式 */
.data-preview {
  margin-top: 24px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 24px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.preview-header h4 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

/* 表格预览样式 */
.table-preview {
  margin-bottom: 16px;
}

.preview-table {
  border-radius: 8px;
  overflow: hidden;
}

.preview-table :deep(.el-table__header) {
  background-color: var(--el-fill-color-light);
}

.preview-table :deep(.el-table__row:hover > td) {
  background-color: var(--el-color-primary-light-9);
}

/* 卡片预览样式 */
.card-preview {
  margin-bottom: 16px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.data-card {
  border-radius: 8px;
  transition: all 0.3s ease;
}

.data-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.data-card.invalid {
  border-color: var(--el-color-danger);
  background-color: var(--el-color-danger-light-9);
}

.card-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.student-info h5 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.student-info p {
  margin: 4px 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.4;
}

.validation-badge {
  flex-shrink: 0;
}

/* 分页样式 */
.preview-pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

/* 验证统计样式 */
.validation-summary {
  margin-top: 16px;
  padding: 16px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 8px;
}

/* 操作按钮样式 */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* 编辑对话框样式 */
.edit-table {
  border-radius: 8px;
  overflow: hidden;
}

.edit-table :deep(.el-table__header) {
  background-color: var(--el-fill-color-light);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .excel-upload-container {
    padding: 0 16px;
  }
  
  .upload-dragger :deep(.el-upload-dragger) {
    height: 140px;
  }
  
  .el-icon--upload {
    font-size: 36px;
    margin-bottom: 12px;
  }
  
  .card-grid {
    grid-template-columns: 1fr;
  }
  
  .preview-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .action-buttons {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .upload-dragger :deep(.el-upload-dragger) {
    height: 120px;
  }
  
  .el-icon--upload {
    font-size: 32px;
    margin-bottom: 8px;
  }
  
  .el-upload__text {
    font-size: 13px;
  }
  
  .el-upload__tip {
    font-size: 11px;
  }
}

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  .upload-card {
    background-color: var(--el-bg-color-page);
    border-color: var(--el-border-color);
  }
  
  .upload-dragger :deep(.el-upload-dragger) {
    background-color: var(--el-fill-color-darker);
    border-color: var(--el-border-color-darker);
  }
  
  .upload-dragger :deep(.el-upload-dragger:hover) {
    background-color: var(--el-color-primary-light-8);
  }
  
  .data-card.invalid {
    background-color: var(--el-color-danger-light-8);
  }
}

/* 动画效果 */
.parsing-progress,
.upload-progress {
  animation: slideInDown 0.3s ease-out;
}

.data-preview {
  animation: fadeInUp 0.4s ease-out;
}

.data-card {
  animation: fadeInScale 0.3s ease-out;
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

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 高性能优化 */
.data-card,
.preview-table,
.upload-dragger {
  will-change: transform;
}

/* 无障碍支持 */
.upload-dragger :deep(.el-upload-dragger):focus {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.action-buttons .el-button:focus {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
</style>