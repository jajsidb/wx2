<template>
  <div class="main-image-display" ref="containerRef">
    <!-- 主图片展示区域 -->
    <div class="image-container" :class="{ 'fullscreen': isFullscreen }">
      <div class="image-wrapper" ref="imageWrapperRef">
        <!-- 主展示图片 -->
        <img
          ref="mainImageRef"
          :src="mainImageSrc"
          :srcset="mainImageSrcset"
          alt="寝室门牌模板"
          class="main-image"
          :class="{ 'retina-optimized': isRetinaDisplay }"
          @load="onImageLoad"
          @error="onImageError"
        />
        
        <!-- Canvas渲染层 -->
        <canvas
          ref="canvasRef"
          class="canvas-overlay"
          :width="canvasWidth"
          :height="canvasHeight"
          v-show="showCanvas"
        ></canvas>
        
        <!-- 悬浮文字层 -->
        <div class="text-overlay-container" v-if="showTextOverlay">
          <div
            v-for="(textItem, index) in textOverlays"
            :key="`text-${index}`"
            class="text-overlay-item"
            :style="getTextStyle(textItem)"
            :class="{ 'editing': textItem.editing, 'selected': selectedTextIndex === index }"
            @click="selectText(index)"
            @dblclick="editText(index)"
          >
            <input
              v-if="textItem.editing"
              v-model="textItem.content"
              @blur="finishEdit(index)"
              @keyup.enter="finishEdit(index)"
              @keyup.esc="cancelEdit(index)"
              class="text-input"
              ref="textInputRefs"
            />
            <span v-else class="text-content">{{ textItem.content }}</span>
            
            <!-- 拖拽控制点 -->
            <div
              v-if="selectedTextIndex === index && !textItem.editing"
              class="drag-handles"
            >
              <div class="drag-handle drag-handle-nw" @mousedown="startDrag(index, 'nw', $event)"></div>
              <div class="drag-handle drag-handle-ne" @mousedown="startDrag(index, 'ne', $event)"></div>
              <div class="drag-handle drag-handle-sw" @mousedown="startDrag(index, 'sw', $event)"></div>
              <div class="drag-handle drag-handle-se" @mousedown="startDrag(index, 'se', $event)"></div>
            </div>
          </div>
        </div>
        
        <!-- 位置校准网格 -->
        <div class="alignment-grid" v-if="showAlignmentGrid">
          <div
            v-for="i in gridLines.vertical"
            :key="`v-${i}`"
            class="grid-line vertical"
            :style="{ left: `${(i / gridLines.vertical) * 100}%` }"
          ></div>
          <div
            v-for="i in gridLines.horizontal"
            :key="`h-${i}`"
            class="grid-line horizontal"
            :style="{ top: `${(i / gridLines.horizontal) * 100}%` }"
          ></div>
        </div>
      </div>
      
      <!-- 控制工具栏 -->
      <div class="control-toolbar" :class="{ 'collapsed': toolbarCollapsed }">
        <div class="toolbar-content" v-show="!toolbarCollapsed">
          <el-button-group class="toolbar-group">
            <el-tooltip content="添加文字" placement="top">
              <el-button :icon="Plus" @click="addTextOverlay" size="small" />
            </el-tooltip>
            <el-tooltip content="显示/隐藏网格" placement="top">
              <el-button 
                :icon="Grid" 
                @click="toggleAlignmentGrid" 
                size="small"
                :type="showAlignmentGrid ? 'primary' : 'default'"
              />
            </el-tooltip>
            <el-tooltip content="全屏显示" placement="top">
              <el-button :icon="FullScreen" @click="toggleFullscreen" size="small" />
            </el-tooltip>
            <el-tooltip content="导出图片" placement="top">
              <el-button :icon="Download" @click="exportImage" size="small" type="success" />
            </el-tooltip>
          </el-button-group>
        </div>
        
        <el-button
          class="toolbar-toggle"
          :icon="toolbarCollapsed ? ArrowRight : ArrowLeft"
          @click="toggleToolbar"
          size="small"
          circle
          :title="toolbarCollapsed ? '展开工具栏' : '收起工具栏'"
        />
      </div>
    </div>
    
    <!-- 属性面板 -->
    <div class="properties-panel" v-if="selectedTextIndex !== -1 && !toolbarCollapsed">
      <el-card class="property-card" shadow="never">
        <template #header>
          <span>文字属性</span>
          <el-button
            class="close-btn"
            :icon="Close"
            @click="selectedTextIndex = -1"
            size="small"
            text
          />
        </template>
        
        <el-form :model="selectedTextItem" label-width="60px" size="small">
          <el-form-item label="内容">
            <el-input v-model="selectedTextItem.content" />
          </el-form-item>
          <el-form-item label="字体">
            <el-select v-model="selectedTextItem.fontFamily">
              <el-option label="PingFang SC" value="PingFang SC" />
              <el-option label="Microsoft YaHei" value="Microsoft YaHei" />
              <el-option label="SimHei" value="SimHei" />
              <el-option label="Arial" value="Arial" />
            </el-select>
          </el-form-item>
          <el-form-item label="大小">
            <el-input-number v-model="selectedTextItem.fontSize" :min="12" :max="72" />
          </el-form-item>
          <el-form-item label="颜色">
            <el-color-picker v-model="selectedTextItem.color" />
          </el-form-item>
          <el-form-item label="X坐标">
            <el-input-number v-model="selectedTextItem.x" :min="0" :max="imageWidth" />
          </el-form-item>
          <el-form-item label="Y坐标">
            <el-input-number v-model="selectedTextItem.y" :min="0" :max="imageHeight" />
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  ref, 
  reactive, 
  computed, 
  onMounted, 
  onUnmounted, 
  nextTick, 
  watch,
  shallowRef
} from 'vue'
import { 
  ElButton, 
  ElButtonGroup, 
  ElTooltip, 
  ElCard, 
  ElForm, 
  ElFormItem, 
  ElInput, 
  ElInputNumber, 
  ElSelect, 
  ElOption, 
  ElColorPicker,
  ElMessage,
  ElNotification 
} from 'element-plus'
import { 
  Plus, 
  Grid, 
  FullScreen, 
  Download, 
  ArrowLeft, 
  ArrowRight, 
  Close,
  Refresh 
} from '@element-plus/icons-vue'
import html2canvas from 'html2canvas'
import { handleApiError, showErrorMessage, showSuccessMessage } from '../utils/errorHandler'

// 接口定义
interface TextOverlay {
  id: string
  content: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  color: string
  editing: boolean
  originalContent?: string
}

interface ExcelData {
  name: string
  college: string
  className: string
  counselor: string
  dormitoryNumber: string
  bedNumber: string
}

// Props定义
interface Props {
  excelData?: ExcelData[]
  templateConfig?: any
  showControls?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showControls: true
})

// Emits定义
const emit = defineEmits<{
  imageLoad: [width: number, height: number]
  textUpdate: [textOverlays: TextOverlay[]]
  export: [dataUrl: string]
}>()

// 响应式数据
const containerRef = ref<HTMLElement>()
const imageWrapperRef = ref<HTMLElement>()
const mainImageRef = ref<HTMLImageElement>()
const canvasRef = ref<HTMLCanvasElement>()
const textInputRefs = ref<HTMLInputElement[]>([])

// 图片相关状态
const imageWidth = ref(0)
const imageHeight = ref(0)
const imageLoaded = ref(false)
const imageError = ref(false)

// Canvas相关状态
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const showCanvas = ref(false)
const canvasContext = shallowRef<CanvasRenderingContext2D | null>(null)

// 文字覆盖层状态
const textOverlays = ref<TextOverlay[]>([])
const selectedTextIndex = ref(-1)
const showTextOverlay = ref(true)

// 控制状态
const isFullscreen = ref(false)
const showAlignmentGrid = ref(false)
const toolbarCollapsed = ref(false)

// 拖拽状态
const isDragging = ref(false)
const dragStartPos = reactive({ x: 0, y: 0 })
const dragTextIndex = ref(-1)

// 计算属性
const isRetinaDisplay = computed(() => window.devicePixelRatio > 1)

const mainImageSrc = computed(() => '/mk1.jpg')

const mainImageSrcset = computed(() => {
  if (isRetinaDisplay.value) {
    return `/mk1.jpg 1x, /mk1.jpg 2x`
  }
  return `/mk1.jpg`
})

const selectedTextItem = computed(() => {
  if (selectedTextIndex.value >= 0 && selectedTextIndex.value < textOverlays.value.length) {
    return textOverlays.value[selectedTextIndex.value]
  }
  return null
})

const gridLines = computed(() => ({
  vertical: 20,
  horizontal: 15
}))

// 自定义Hooks
const useImageDimensions = () => {
  const updateDimensions = () => {
    if (mainImageRef.value) {
      imageWidth.value = mainImageRef.value.naturalWidth
      imageHeight.value = mainImageRef.value.naturalHeight
      canvasWidth.value = imageWidth.value
      canvasHeight.value = imageHeight.value
    }
  }

  return { updateDimensions }
}

const useCanvasRendering = () => {
  const initCanvas = () => {
    if (canvasRef.value) {
      canvasContext.value = canvasRef.value.getContext('2d')
      if (canvasContext.value) {
        canvasContext.value.imageSmoothingEnabled = true
        canvasContext.value.imageSmoothingQuality = 'high'
      }
    }
  }

  const renderToCanvas = () => {
    if (!canvasContext.value || !mainImageRef.value) return

    const ctx = canvasContext.value
    const img = mainImageRef.value

    // 清空画布
    ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)

    // 绘制主图片
    ctx.drawImage(img, 0, 0, canvasWidth.value, canvasHeight.value)

    // 绘制文字覆盖层
    textOverlays.value.forEach(textItem => {
      if (textItem.content.trim()) {
        ctx.font = `${textItem.fontSize}px ${textItem.fontFamily}`
        ctx.fillStyle = textItem.color
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(textItem.content, textItem.x, textItem.y)
      }
    })
  }

  return { initCanvas, renderToCanvas }
}

const { updateDimensions } = useImageDimensions()
const { initCanvas, renderToCanvas } = useCanvasRendering()

// 方法定义
const onImageLoad = () => {
  imageLoaded.value = true
  imageError.value = false
  updateDimensions()
  initCanvas()
  emit('imageLoad', imageWidth.value, imageHeight.value)
  
  // 如果有Excel数据，自动添加文字覆盖层
  if (props.excelData && props.excelData.length > 0) {
    addExcelDataOverlays()
  }
}

const onImageError = () => {
  imageError.value = true
  imageLoaded.value = false
  showErrorMessage('图片加载失败')
}

const addTextOverlay = () => {
  const newText: TextOverlay = {
    id: `text-${Date.now()}`,
    content: '新文字',
    x: 100,
    y: 100,
    fontSize: 24,
    fontFamily: 'PingFang SC',
    color: '#000000',
    editing: false
  }
  
  textOverlays.value.push(newText)
  selectedTextIndex.value = textOverlays.value.length - 1
  
  nextTick(() => {
    editText(selectedTextIndex.value)
  })
}

const addExcelDataOverlays = () => {
  if (!props.excelData || props.excelData.length === 0) return

  const data = props.excelData[0] // 使用第一条数据
  const overlays: TextOverlay[] = [
    {
      id: 'name',
      content: data.name,
      x: 400,
      y: 180,
      fontSize: 48,
      fontFamily: 'PingFang SC',
      color: '#1a1a1a',
      editing: false
    },
    {
      id: 'college',
      content: data.college,
      x: 400,
      y: 250,
      fontSize: 32,
      fontFamily: 'PingFang SC',
      color: '#1a1a1a',
      editing: false
    },
    {
      id: 'className',
      content: data.className,
      x: 400,
      y: 300,
      fontSize: 32,
      fontFamily: 'PingFang SC',
      color: '#1a1a1a',
      editing: false
    },
    {
      id: 'counselor',
      content: data.counselor,
      x: 400,
      y: 350,
      fontSize: 28,
      fontFamily: 'PingFang SC',
      color: '#333333',
      editing: false
    },
    {
      id: 'dormitory',
      content: data.dormitoryNumber,
      x: 400,
      y: 430,
      fontSize: 40,
      fontFamily: 'PingFang SC',
      color: '#1a1a1a',
      editing: false
    },
    {
      id: 'bed',
      content: data.bedNumber,
      x: 400,
      y: 490,
      fontSize: 36,
      fontFamily: 'PingFang SC',
      color: '#1a1a1a',
      editing: false
    }
  ]

  textOverlays.value = overlays
}

const selectText = (index: number) => {
  selectedTextIndex.value = index
}

const editText = (index: number) => {
  if (index >= 0 && index < textOverlays.value.length) {
    const textItem = textOverlays.value[index]
    textItem.originalContent = textItem.content
    textItem.editing = true
    
    nextTick(() => {
      const input = textInputRefs.value[index]
      if (input) {
        input.focus()
        input.select()
      }
    })
  }
}

const finishEdit = (index: number) => {
  if (index >= 0 && index < textOverlays.value.length) {
    const textItem = textOverlays.value[index]
    textItem.editing = false
    delete textItem.originalContent
    emit('textUpdate', textOverlays.value)
  }
}

const cancelEdit = (index: number) => {
  if (index >= 0 && index < textOverlays.value.length) {
    const textItem = textOverlays.value[index]
    if (textItem.originalContent !== undefined) {
      textItem.content = textItem.originalContent
    }
    textItem.editing = false
    delete textItem.originalContent
  }
}

const getTextStyle = (textItem: TextOverlay) => {
  return {
    position: 'absolute',
    left: `${textItem.x}px`,
    top: `${textItem.y}px`,
    fontSize: `${textItem.fontSize}px`,
    fontFamily: textItem.fontFamily,
    color: textItem.color,
    cursor: textItem.editing ? 'text' : 'move',
    userSelect: textItem.editing ? 'text' : 'none',
    whiteSpace: 'nowrap',
    zIndex: textItem.editing ? 1000 : 100
  }
}

const startDrag = (index: number, handle: string, event: MouseEvent) => {
  event.preventDefault()
  isDragging.value = true
  dragTextIndex.value = index
  dragStartPos.x = event.clientX
  dragStartPos.y = event.clientY
  
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

const onDragMove = (event: MouseEvent) => {
  if (!isDragging.value || dragTextIndex.value === -1) return
  
  const deltaX = event.clientX - dragStartPos.x
  const deltaY = event.clientY - dragStartPos.y
  
  const textItem = textOverlays.value[dragTextIndex.value]
  textItem.x = Math.max(0, Math.min(imageWidth.value - 100, textItem.x + deltaX))
  textItem.y = Math.max(0, Math.min(imageHeight.value - 50, textItem.y + deltaY))
  
  dragStartPos.x = event.clientX
  dragStartPos.y = event.clientY
}

const onDragEnd = () => {
  isDragging.value = false
  dragTextIndex.value = -1
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  emit('textUpdate', textOverlays.value)
}

// 切换对齐网格
const toggleAlignmentGrid = () => {
  showAlignmentGrid.value = !showAlignmentGrid.value
}

// 切换工具栏收起状态
const toggleToolbar = () => {
  toolbarCollapsed.value = !toolbarCollapsed.value
  // 如果工具栏收起，同时关闭属性面板
  if (toolbarCollapsed.value) {
    selectedTextIndex.value = -1
  }
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  if (isFullscreen.value) {
    document.documentElement.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
}

const exportImage = async () => {
  try {
    showCanvas.value = true
    await nextTick()
    renderToCanvas()
    
    const dataUrl = canvasRef.value?.toDataURL('image/png', 1.0)
    if (dataUrl) {
      emit('export', dataUrl)
      
      // 创建下载链接
      const link = document.createElement('a')
      link.download = `寝室门牌_${Date.now()}.png`
      link.href = dataUrl
      link.click()
      
      showSuccessMessage('图片导出成功')
    }
  } catch (error: any) {
    const apiError = handleApiError(error, '导出图片')
    showErrorMessage(apiError)
  } finally {
    showCanvas.value = false
  }
}

// 更新文字叠加层（用于Excel数据更新）
const updateTextOverlays = async (data: any[]) => {
  if (!data || data.length === 0) {
    textOverlays.value = []
    return
  }

  // 使用第一条数据更新文字叠加
  const studentData = data[0]
  const overlays: TextOverlay[] = [
    {
      id: 'name',
      content: studentData.name || '',
      x: 400,
      y: 180,
      fontSize: 48,
      fontFamily: 'PingFang SC',
      color: '#1a1a1a',
      editing: false
    },
    {
      id: 'college',
      content: studentData.college || '',
      x: 400,
      y: 250,
      fontSize: 32,
      fontFamily: 'PingFang SC',
      color: '#1a1a1a',
      editing: false
    },
    {
      id: 'className',
      content: studentData.className || '',
      x: 400,
      y: 300,
      fontSize: 32,
      fontFamily: 'PingFang SC',
      color: '#1a1a1a',
      editing: false
    },
    {
      id: 'counselor',
      content: studentData.counselor || '',
      x: 400,
      y: 350,
      fontSize: 28,
      fontFamily: 'PingFang SC',
      color: '#333333',
      editing: false
    },
    {
      id: 'dormitory',
      content: studentData.dormitoryNumber || '',
      x: 400,
      y: 430,
      fontSize: 40,
      fontFamily: 'PingFang SC',
      color: '#1a1a1a',
      editing: false
    },
    {
      id: 'bed',
      content: studentData.bedNumber || '',
      x: 400,
      y: 490,
      fontSize: 36,
      fontFamily: 'PingFang SC',
      color: '#1a1a1a',
      editing: false
    }
  ]

  textOverlays.value = overlays
  
  // 等待DOM更新
  await nextTick()
  
  // 触发文字更新事件
  emit('textUpdate', textOverlays.value)
}

// 监听器
watch(() => props.excelData, (newData) => {
  if (newData && newData.length > 0) {
    addExcelDataOverlays()
  }
}, { deep: true })

watch(textOverlays, () => {
  emit('textUpdate', textOverlays.value)
}, { deep: true })

// 生命周期
onMounted(() => {
  initCanvas()
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
})

// 暴露给父组件的方法
defineExpose({
  addTextOverlay,
  exportImage,
  renderToCanvas,
  textOverlays,
  updateTextOverlays
})
</script>

<style scoped>
.main-image-display {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

.main-image-display.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  background: #000;
}

.image-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.image-wrapper {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.main-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.text-overlay {
  position: absolute;
  pointer-events: auto;
  user-select: none;
  transition: all 0.2s ease;
}

.text-overlay:hover {
  transform: scale(1.02);
}

.text-overlay.selected {
  outline: 2px solid #409eff;
  outline-offset: 2px;
  border-radius: 4px;
}

.text-overlay.editing {
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 8px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.text-input {
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  width: auto;
  min-width: 100px;
}

.drag-handle {
  position: absolute;
  width: 20px;
  height: 20px;
  background: #409eff;
  border: 2px solid #fff;
  border-radius: 50%;
  cursor: move;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 1001;
}

.text-overlay:hover .drag-handle,
.text-overlay.selected .drag-handle {
  opacity: 1;
}

.drag-handle.top-left {
  top: -10px;
  left: -10px;
}

.drag-handle.top-right {
  top: -10px;
  right: -10px;
}

.drag-handle.bottom-left {
  bottom: -10px;
  left: -10px;
}

.drag-handle.bottom-right {
  bottom: -10px;
  right: -10px;
}

.alignment-grid {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
}

.grid-line {
  position: absolute;
  background: rgba(64, 158, 255, 0.3);
}

.grid-line.vertical {
  width: 1px;
  height: 100%;
}

.grid-line.horizontal {
  width: 100%;
  height: 1px;
}

.control-toolbar {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: all 0.3s ease;
  min-width: 60px;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-toolbar.collapsed {
  padding: 8px;
  width: 60px;
  height: 60px;
}

.toolbar-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 200px;
}

.toolbar-toggle {
  position: relative;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--el-border-color-light);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  z-index: 1001;
}

.toolbar-toggle:hover {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
  transform: scale(1.05);
}

.toolbar-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 200px;
}

.toolbar-section {
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.toolbar-section:last-child {
  border-bottom: none;
}

.toolbar-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.properties-panel {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-width: 400px;
  margin: 0 auto;
}

.properties-panel .el-card {
  background: transparent;
  border: none;
  box-shadow: none;
}

.properties-panel .el-form-item {
  margin-bottom: 12px;
}

.properties-panel .el-form-item__label {
  font-size: 12px;
  font-weight: 500;
  color: #666;
}

.canvas-container {
  position: absolute;
  top: -9999px;
  left: -9999px;
  opacity: 0;
  pointer-events: none;
}

.export-canvas {
  border: none;
  background: transparent;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .control-toolbar {
    top: 10px;
    right: 10px;
    padding: 8px;
  }
  
  .toolbar-content {
    min-width: 160px;
  }
  
  .properties-panel {
    bottom: 10px;
    left: 10px;
    right: 10px;
    max-width: none;
  }
  
  .text-overlay {
    min-width: 80px;
  }
  
  .drag-handle {
    width: 24px;
    height: 24px;
  }
}

@media (max-width: 480px) {
  .control-toolbar {
    position: fixed;
    bottom: 20px;
    top: auto;
    right: 20px;
    left: 20px;
    max-width: none;
  }
  
  .toolbar-content {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-around;
    min-width: auto;
  }
  
  .properties-panel {
    display: none;
  }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .main-image-display {
    background: #1a1a1a;
  }
  
  .control-toolbar,
  .properties-panel {
    background: rgba(30, 30, 30, 0.95);
    color: #fff;
  }
  
  .toolbar-section {
    border-bottom-color: #444;
  }
  
  .toolbar-section h4 {
    color: #fff;
  }
  
  .properties-panel .el-form-item__label {
    color: #ccc;
  }
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.text-overlay {
  animation: fadeIn 0.3s ease;
}

.control-toolbar,
.properties-panel {
  animation: fadeIn 0.5s ease;
}

/* 打印样式 */
@media print {
  .control-toolbar,
  .properties-panel,
  .drag-handle,
  .alignment-grid {
    display: none !important;
  }
  
  .main-image-display {
    background: white;
    height: auto;
  }
  
  .image-wrapper {
    box-shadow: none;
    border-radius: 0;
  }
}
</style>