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
          <!-- 分页控制区域 -->
          <div class="pagination-controls" v-if="props.excelData && props.excelData.length > 0">
            <div class="pagination-settings">
              <el-tooltip content="设置每页显示条目数量" placement="top">
                <div class="items-per-page-control">
                  <span class="control-label">每页显示：</span>
                  <el-select v-model="itemsPerPage" size="small" style="width: 80px" @change="changeItemsPerPage">
                    <el-option label="2" :value="2" />
                    <el-option label="4" :value="4" />
                    <el-option label="6" :value="6" />
                    <el-option label="8" :value="8" />
                    <el-option label="全部" :value="-1" />
                  </el-select>
                  <span class="control-label">条</span>
                </div>
              </el-tooltip>
            </div>
            
            <div class="pagination-navigation" v-if="totalPages > 1">
              <el-button-group>
                <el-tooltip content="上一页" placement="top">
                  <el-button 
                    :icon="ArrowLeft" 
                    @click="goToPrevPage" 
                    size="small" 
                    :disabled="!hasPrevPage"
                  />
                </el-tooltip>
                <el-tooltip content="下一页" placement="top">
                  <el-button 
                    :icon="ArrowRight" 
                    @click="goToNextPage" 
                    size="small" 
                    :disabled="!hasNextPage"
                  />
                </el-tooltip>
              </el-button-group>
              
              <div class="page-info">
                <span>{{ pageInfo.current }}/{{ pageInfo.total }}</span>
                <span class="items-info">({{ pageInfo.itemsStart }}-{{ pageInfo.itemsEnd }}/{{ pageInfo.totalItems }})</span>
              </div>
            </div>
          </div>
          
          <!-- 原有工具按钮 -->
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

// 图片尺寸配置 (210mm × 150mm at 300 DPI)
const PHOTOSHOP_WIDTH_MM = 210
const PHOTOSHOP_HEIGHT_MM = 150
const DPI = 300
const MM_TO_INCH = 25.4

// 计算Photoshop中的像素尺寸
const PHOTOSHOP_WIDTH_PX = Math.round((PHOTOSHOP_WIDTH_MM / MM_TO_INCH) * DPI) // 2480px
const PHOTOSHOP_HEIGHT_PX = Math.round((PHOTOSHOP_HEIGHT_MM / MM_TO_INCH) * DPI) // 1772px

// 响应式数据
const containerRef = ref<HTMLElement>()
const imageWrapperRef = ref<HTMLElement>()
const mainImageRef = ref<HTMLImageElement>()
const canvasRef = ref<HTMLCanvasElement>()
const textInputRefs = ref<HTMLInputElement[]>([])

// 图片相关状态
const imageWidth = ref(PHOTOSHOP_WIDTH_PX)
const imageHeight = ref(PHOTOSHOP_HEIGHT_PX)
const imageLoaded = ref(false)
const imageError = ref(false)

// Canvas相关状态
const canvasWidth = ref(PHOTOSHOP_WIDTH_PX)
const canvasHeight = ref(PHOTOSHOP_HEIGHT_PX)
const showCanvas = ref(false)
const canvasContext = shallowRef<CanvasRenderingContext2D | null>(null)

// 显示比例计算
const displayScale = ref(1)
const webDisplayWidth = ref(800) // 网页显示宽度
const webDisplayHeight = ref(600) // 网页显示高度

// 分页相关状态
const itemsPerPage = ref(4) // 每页显示的数据条目数量，默认4条
const currentPage = ref(0) // 当前页码，从0开始
const totalPages = ref(0) // 总页数

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
  vertical: 10,
  horizontal: 8
}))

// 分页相关计算属性
const currentPageData = computed(() => {
  if (!props.excelData || props.excelData.length === 0) return []
  
  if (itemsPerPage.value === -1) {
    // 显示全部数据
    return props.excelData
  }
  
  const startIndex = currentPage.value * itemsPerPage.value
  const endIndex = startIndex + itemsPerPage.value
  return props.excelData.slice(startIndex, endIndex)
})

const hasPrevPage = computed(() => currentPage.value > 0)
const hasNextPage = computed(() => currentPage.value < totalPages.value - 1)

const pageInfo = computed(() => ({
  current: currentPage.value + 1,
  total: totalPages.value,
  itemsStart: currentPage.value * itemsPerPage.value + 1,
  itemsEnd: Math.min((currentPage.value + 1) * itemsPerPage.value, props.excelData?.length || 0),
  totalItems: props.excelData?.length || 0
}))

// 分页控制函数
const goToPrevPage = () => {
  if (hasPrevPage.value) {
    currentPage.value--
    addExcelDataOverlays() // 重新生成文字覆盖层
  }
}

const goToNextPage = () => {
  if (hasNextPage.value) {
    currentPage.value++
    addExcelDataOverlays() // 重新生成文字覆盖层
  }
}

const changeItemsPerPage = (newValue: number) => {
  itemsPerPage.value = newValue
  currentPage.value = 0 // 重置到第一页
  
  // 重新计算总页数
  if (newValue === -1) {
    totalPages.value = 1 // 显示全部时只有一页
  } else {
    totalPages.value = Math.ceil((props.excelData?.length || 0) / newValue)
  }
  
  addExcelDataOverlays() // 重新生成文字覆盖层
}

// 自定义Hooks
const useImageDimensions = () => {
  const updateDimensions = () => {
    if (mainImageRef.value && imageWrapperRef.value) {
      // 获取实际显示尺寸
      const rect = imageWrapperRef.value.getBoundingClientRect()
      webDisplayWidth.value = rect.width
      webDisplayHeight.value = rect.height
      
      // 计算显示比例 (网页显示尺寸 / Photoshop尺寸)
      const scaleX = webDisplayWidth.value / PHOTOSHOP_WIDTH_PX
      const scaleY = webDisplayHeight.value / PHOTOSHOP_HEIGHT_PX
      displayScale.value = Math.min(scaleX, scaleY) // 保持宽高比
      
      // 更新图片尺寸为Photoshop标准尺寸
      imageWidth.value = PHOTOSHOP_WIDTH_PX
      imageHeight.value = PHOTOSHOP_HEIGHT_PX
      canvasWidth.value = PHOTOSHOP_WIDTH_PX
      canvasHeight.value = PHOTOSHOP_HEIGHT_PX
      
      console.log(`Photoshop尺寸: ${PHOTOSHOP_WIDTH_PX}×${PHOTOSHOP_HEIGHT_PX}px`)
      console.log(`网页显示尺寸: ${webDisplayWidth.value}×${webDisplayHeight.value}px`)
      console.log(`显示比例: ${displayScale.value.toFixed(4)}`)
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
    if (!canvasContext.value || !mainImageRef.value) {
      console.warn('Canvas上下文或图片未准备好')
      return
    }

    const ctx = canvasContext.value
    const img = mainImageRef.value
    const canvas = canvasRef.value

    // 设置Canvas尺寸为Photoshop标准尺寸
    if (canvas) {
      canvas.width = PHOTOSHOP_WIDTH_PX
      canvas.height = PHOTOSHOP_HEIGHT_PX
      console.log(`Canvas尺寸设置为: ${PHOTOSHOP_WIDTH_PX}×${PHOTOSHOP_HEIGHT_PX}px`)
    }

    // 清空画布并设置白色背景
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, PHOTOSHOP_WIDTH_PX, PHOTOSHOP_HEIGHT_PX)

    // 等待图片完全加载
    if (img.complete && img.naturalHeight !== 0) {
      // 绘制主图片
      ctx.drawImage(img, 0, 0, PHOTOSHOP_WIDTH_PX, PHOTOSHOP_HEIGHT_PX)
      console.log('主图片绘制完成')
    } else {
      console.warn('主图片未完全加载')
      // 如果图片未加载，绘制占位符
      ctx.fillStyle = '#f0f0f0'
      ctx.fillRect(0, 0, PHOTOSHOP_WIDTH_PX, PHOTOSHOP_HEIGHT_PX)
      ctx.fillStyle = '#666666'
      ctx.font = '48px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('图片加载中...', PHOTOSHOP_WIDTH_PX / 2, PHOTOSHOP_HEIGHT_PX / 2)
    }

    // 绘制文字覆盖层（使用Photoshop坐标）
    let textCount = 0
    textOverlays.value.forEach(textItem => {
      if (textItem.content && textItem.content.trim()) {
        ctx.font = `${textItem.fontSize}px ${textItem.fontFamily}`
        ctx.fillStyle = textItem.color
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        
        // 直接使用Photoshop坐标绘制到Canvas
        ctx.fillText(textItem.content, textItem.x, textItem.y)
        textCount++
      }
    })
    
    console.log(`Canvas渲染完成，尺寸: ${PHOTOSHOP_WIDTH_PX}×${PHOTOSHOP_HEIGHT_PX}px，绘制了${textCount}个文字元素`)
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
    x: 300, // Photoshop坐标
    y: 200, // Photoshop坐标
    fontSize: 36, // Photoshop字体大小
    fontFamily: 'SimSun, 宋体, serif', // 默认使用宋体
    color: '#000000',
    editing: false
  }
  
  textOverlays.value.push(newText)
  selectedTextIndex.value = textOverlays.value.length - 1
  
  nextTick(() => {
    editText(selectedTextIndex.value)
  })
  
  console.log('添加新文字覆盖层，使用宋体字体')
}

const addExcelDataOverlays = () => {
  if (!props.excelData || props.excelData.length === 0) return

  // 使用当前页的数据
  const pageData = currentPageData.value
  
  // 清空现有文字覆盖层
  textOverlays.value = []
  
  // 定义画布中心点坐标
  const centerX = PHOTOSHOP_WIDTH_PX / 2  // 1240px (中心点X坐标)
  const centerY = PHOTOSHOP_HEIGHT_PX / 2 // 886px (中心点Y坐标)
  
  // 定义四组坐标配置，每组包含六个字段的精确位置（统一48号字体）
  const coordinateGroups = [
    // 第一组坐标（基准坐标）
    [
      { key: 'name', label: '姓名', x: 882, y: 585, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'college', label: '学院', x: 818, y: 675, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'className', label: '班级', x: 774, y: 724, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'counselor', label: '辅导员', x: 876, y: 802, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'dormitoryNumber', label: '寝室号', x: 894, y: 879, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'bedNumber', label: '床位号', x: 932, y: 949, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' }
    ],
    // 第二组坐标（保持Y轴不变，调整X轴）
    [
      { key: 'name', label: '姓名', x: 1971, y: 585, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'college', label: '学院', x: 1905, y: 675, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'className', label: '班级', x: 1840, y: 724, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'counselor', label: '辅导员', x: 1971, y: 802, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'dormitoryNumber', label: '寝室号', x: 2001, y: 879, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'bedNumber', label: '床位号', x: 2023, y: 949, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' }
    ],
    // 第三组坐标（保持X轴不变，调整Y轴）
    [
      { key: 'name', label: '姓名', x: 882, y: 1102, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'college', label: '学院', x: 818, y: 1174, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'className', label: '班级', x: 774, y: 1241, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'counselor', label: '辅导员', x: 876, y: 1319, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'dormitoryNumber', label: '寝室号', x: 894, y: 1396, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'bedNumber', label: '床位号', x: 932, y: 1466, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' }
    ],
    // 第四组坐标（基于第三组Y轴，调整X轴）
    [
      { key: 'name', label: '姓名', x: 1917, y: 1102, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'college', label: '学院', x: 1905, y: 1174, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'className', label: '班级', x: 1840, y: 1241, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'counselor', label: '辅导员', x: 1971, y: 1319, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'dormitoryNumber', label: '寝室号', x: 2001, y: 1396, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' },
      { key: 'bedNumber', label: '床位号', x: 2003, y: 1466, fontSize: 48, fontFamily: 'SimSun, 宋体, serif', color: '#000000' }
    ]
  ]
  
  // 为当前页的每条数据创建文字覆盖层
  pageData.forEach((data, dataIndex) => {
    // 确保数据索引不超过坐标组数量
    if (dataIndex < coordinateGroups.length) {
      const currentGroup = coordinateGroups[dataIndex]
      
      currentGroup.forEach((config, configIndex) => {
        const value = data[config.key as keyof typeof data]
        if (value) {
          // 确保坐标在画布范围内
          const clampedX = Math.max(50, Math.min(PHOTOSHOP_WIDTH_PX - 300, config.x))
          const clampedY = Math.max(50, Math.min(PHOTOSHOP_HEIGHT_PX - 50, config.y))
          
          textOverlays.value.push({
            id: `${config.key}-${dataIndex}-${Date.now()}-${configIndex}`,
            content: value, // 直接显示原始数据，不添加标签前缀
            x: clampedX,
            y: clampedY,
            fontSize: config.fontSize,
            fontFamily: config.fontFamily,
            color: config.color,
            editing: false
          })
          
          console.log(`第${dataIndex + 1}组 ${config.label}: "${value}" -> 坐标(${clampedX}, ${clampedY})`)
        }
      })
    }
  })
  
  console.log(`已添加 ${textOverlays.value.length} 个文字覆盖层，当前页显示 ${pageData.length} 条数据`)
  console.log(`画布尺寸: ${PHOTOSHOP_WIDTH_PX}×${PHOTOSHOP_HEIGHT_PX}px，中心点: (${centerX}, ${centerY})`)
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

// 文字位置转换函数
const convertPhotoshopToWebPosition = (psX: number, psY: number) => {
  return {
    x: psX * displayScale.value,
    y: psY * displayScale.value
  }
}

const convertWebToPhotoshopPosition = (webX: number, webY: number) => {
  return {
    x: webX / displayScale.value,
    y: webY / displayScale.value
  }
}

// 中心点坐标系转换函数
const convertCenterToAbsolute = (centerOffsetX: number, centerOffsetY: number) => {
  const centerX = PHOTOSHOP_WIDTH_PX / 2
  const centerY = PHOTOSHOP_HEIGHT_PX / 2
  return {
    x: centerX + centerOffsetX,
    y: centerY + centerOffsetY
  }
}

const convertAbsoluteToCenter = (absoluteX: number, absoluteY: number) => {
  const centerX = PHOTOSHOP_WIDTH_PX / 2
  const centerY = PHOTOSHOP_HEIGHT_PX / 2
  return {
    offsetX: absoluteX - centerX,
    offsetY: absoluteY - centerY
  }
}

// 获取字段在中心坐标系下的标准位置
const getFieldCenterPosition = (fieldKey: string, dataIndex: number = 0) => {
  const fieldPositions = {
    'name': { offsetX: -400, offsetY: -300 },
    'college': { offsetX: -400, offsetY: -200 },
    'className': { offsetX: -400, offsetY: -100 },
    'counselor': { offsetX: -400, offsetY: 0 },
    'dormitoryNumber': { offsetX: -400, offsetY: 100 },
    'bedNumber': { offsetX: -400, offsetY: 200 }
  }
  
  const basePosition = fieldPositions[fieldKey as keyof typeof fieldPositions]
  if (!basePosition) return { offsetX: 0, offsetY: 0 }
  
  // 添加数据索引的垂直偏移
  const dataVerticalOffset = dataIndex * 180
  
  return {
    offsetX: basePosition.offsetX,
    offsetY: basePosition.offsetY + dataVerticalOffset
  }
}

// 获取文字样式（用于显示）
const getTextStyle = (textItem: TextOverlay) => {
  const webPos = convertPhotoshopToWebPosition(textItem.x, textItem.y)
  const webFontSize = textItem.fontSize * displayScale.value
  
  return {
    position: 'absolute',
    left: `${webPos.x}px`,
    top: `${webPos.y}px`,
    fontSize: `${webFontSize}px`,
    fontFamily: textItem.fontFamily,
    color: textItem.color,
    cursor: textItem.editing ? 'text' : 'move',
    userSelect: textItem.editing ? 'text' : 'none',
    whiteSpace: 'nowrap',
    transform: 'translate(0, 0)',
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

// 处理文字点击事件
const handleTextClick = (textItem: TextOverlay, event: MouseEvent) => {
  event.stopPropagation()
  
  // 将网页坐标转换为Photoshop坐标进行编辑
  const rect = imageWrapperRef.value?.getBoundingClientRect()
  if (rect) {
    const webX = event.clientX - rect.left
    const webY = event.clientY - rect.top
    const psPos = convertWebToPhotoshopPosition(webX, webY)
    
    console.log(`点击位置 - 网页坐标: (${webX}, ${webY}), Photoshop坐标: (${psPos.x.toFixed(2)}, ${psPos.y.toFixed(2)})`)
  }
  
  // 设置编辑状态
  textOverlays.value.forEach(item => {
    item.editing = item.id === textItem.id
  })
  
  nextTick(() => {
    const input = textInputRefs.value.find(ref => ref?.dataset.id === textItem.id.toString())
    if (input) {
      input.focus()
      input.select()
    }
  })
}

const onDragMove = (event: MouseEvent) => {
  if (!isDragging.value || dragTextIndex.value === -1) return
  
  // 计算鼠标移动的像素差值
  const deltaX = event.clientX - dragStartPos.x
  const deltaY = event.clientY - dragStartPos.y
  
  // 将像素差值转换为Photoshop坐标系的差值
  const psDeltaX = deltaX / displayScale.value
  const psDeltaY = deltaY / displayScale.value
  
  const textItem = textOverlays.value[dragTextIndex.value]
  
  // 计算新的绝对坐标
  const newX = textItem.x + psDeltaX
  const newY = textItem.y + psDeltaY
  
  // 确保坐标在画布范围内（考虑文本宽度和高度）
  const minX = 50
  const maxX = PHOTOSHOP_WIDTH_PX - 300 // 预留文本宽度空间
  const minY = 50
  const maxY = PHOTOSHOP_HEIGHT_PX - 50 // 预留文本高度空间
  
  textItem.x = Math.max(minX, Math.min(maxX, newX))
  textItem.y = Math.max(minY, Math.min(maxY, newY))
  
  // 更新拖拽起始位置
  dragStartPos.x = event.clientX
  dragStartPos.y = event.clientY
  
  // 输出调试信息（显示中心坐标系偏移）
  const centerOffset = convertAbsoluteToCenter(textItem.x, textItem.y)
  console.log(`拖拽更新: 绝对坐标(${textItem.x.toFixed(1)}, ${textItem.y.toFixed(1)}) = 中心偏移(${centerOffset.offsetX.toFixed(1)}, ${centerOffset.offsetY.toFixed(1)})`)
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
    
    // 确保Canvas已初始化
    if (!canvasRef.value || !canvasContext.value) {
      initCanvas()
      await nextTick()
    }
    
    // 渲染到Canvas
    renderToCanvas()
    await nextTick()
    
    // 生成高质量PNG图片
    const dataUrl = canvasRef.value?.toDataURL('image/png', 1.0)
    if (dataUrl && dataUrl !== 'data:,') {
      emit('export', dataUrl)
      
      // 验证数据URL格式
      if (!dataUrl.startsWith('data:image/png;base64,')) {
        throw new Error('生成的图片格式不正确')
      }
      
      // 创建下载链接
      const link = document.createElement('a')
      link.download = `寝室门牌_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`
      link.href = dataUrl
      
      // 添加到DOM并触发下载
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      showSuccessMessage('图片导出成功')
      console.log('导出成功，图片尺寸:', canvasRef.value?.width, 'x', canvasRef.value?.height)
    } else {
      throw new Error('无法生成图片数据')
    }
  } catch (error: any) {
    console.error('导出图片失败:', error)
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

  // 直接调用addExcelDataOverlays来处理所有数据和分页逻辑
  addExcelDataOverlays()
  
  // 等待DOM更新
  await nextTick()
  
  // 触发文字更新事件
  emit('textUpdate', textOverlays.value)
}

// 监听器
watch(() => props.excelData, (newData) => {
  if (newData && newData.length > 0) {
    // 重新计算总页数
    if (itemsPerPage.value === -1) {
      totalPages.value = 1
    } else {
      totalPages.value = Math.ceil(newData.length / itemsPerPage.value)
    }
    
    // 重置到第一页
    currentPage.value = 0
    
    // 添加Excel数据覆盖层
    addExcelDataOverlays()
  } else {
    // 清空数据时重置分页状态
    textOverlays.value = []
    currentPage.value = 0
    totalPages.value = 0
  }
}, { immediate: true, deep: true })

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
  font-family: 'SimSun', '宋体', serif !important; /* 强制使用宋体字体 */
  font-weight: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
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
  font-family: 'SimSun', '宋体', serif !important; /* 强制使用宋体字体 */
  font-size: inherit;
  color: inherit;
  width: auto;
  min-width: 100px;
  font-weight: normal;
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