<template>
  <div class="template-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>模板管理</span>
          <el-button type="primary" @click="refreshTemplates">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <!-- 模板列表 -->
      <el-table :data="templates" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="templateName" label="模板名称" />
        <el-table-column prop="width" label="宽度" width="100" />
        <el-table-column prop="height" label="高度" width="100" />
        <el-table-column prop="isActive" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.isActive ? 'success' : 'danger'">
              {{ scope.row.isActive ? '激活' : '未激活' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button-group>
              <el-button size="small" @click="viewTemplate(scope.row)">
                <el-icon><View /></el-icon>
                查看
              </el-button>
              <el-button 
                size="small" 
                type="primary" 
                @click="setAsDefault(scope.row)"
                :disabled="scope.row.id === defaultTemplateId"
              >
                <el-icon><Star /></el-icon>
                {{ scope.row.id === defaultTemplateId ? '默认' : '设为默认' }}
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 模板预览对话框 -->
    <el-dialog v-model="previewVisible" title="模板预览" width="60%">
      <div v-if="selectedTemplate" class="template-preview">
        <div class="template-info">
          <p><strong>模板名称：</strong>{{ selectedTemplate.templateName }}</p>
          <p><strong>尺寸：</strong>{{ selectedTemplate.width }} x {{ selectedTemplate.height }}</p>
          <p><strong>状态：</strong>
            <el-tag :type="selectedTemplate.isActive ? 'success' : 'danger'">
              {{ selectedTemplate.isActive ? '激活' : '未激活' }}
            </el-tag>
          </p>
        </div>
        <div class="template-image">
          <img 
            :src="selectedTemplate.templatePath" 
            :alt="selectedTemplate.templateName"
            style="max-width: 100%; height: auto; border: 1px solid #ddd;"
            @error="handleImageError"
          />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElNotification } from 'element-plus';
import { Refresh, View, Star } from '@element-plus/icons-vue';
import { handleApiError, showErrorMessage, showSuccessMessage } from '../utils/errorHandler';
import { getTemplates, getTemplateById, getDefaultTemplate } from '../api';

interface Template {
  id: number;
  templateName: string;
  templatePath: string;
  width: number;
  height: number;
  isActive: boolean;
  createdAt: string;
}

// 响应式数据
const templates = ref<Template[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const previewVisible = ref(false);
const selectedTemplate = ref<Template | null>(null);
const defaultTemplateId = ref<number | null>(null);

// 获取模板列表
const fetchTemplates = async () => {
  loading.value = true
  try {
    const response = await getTemplates()
    templates.value = response.data.data || []
  } catch (error: any) {
    const apiError = handleApiError(error, '获取模板列表')
    showErrorMessage(apiError)
  } finally {
    loading.value = false
  }
}

// 获取默认模板
const fetchDefaultTemplate = async () => {
  try {
    const response = await getDefaultTemplate()
    defaultTemplateId.value = response.data.data.id
  } catch (error: any) {
    const apiError = handleApiError(error, '获取默认模板')
    showErrorMessage(apiError)
  }
}

// 刷新模板列表
const refreshTemplates = () => {
  fetchTemplates();
  fetchDefaultTemplate();
  ElNotification({
    title: '刷新成功',
    message: '模板列表已刷新',
    type: 'success'
  });
};

// 查看模板详情
const viewTemplate = async (template: Template) => {
  try {
    const response = await getTemplateById(template.id);
    selectedTemplate.value = response.data.data;
    previewVisible.value = true;
  } catch (error: any) {
    const apiError = handleApiError(error, '获取模板详情');
    showErrorMessage(apiError);
  }
};

// 设为默认模板
const setAsDefault = (template: Template) => {
  ElMessage.info('设为默认模板功能暂未实现');
  // TODO: 实现设为默认模板的API调用
};

// 处理图片加载错误
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.src = '/public/mk1.jpg'; // 使用默认图片
};

// 格式化日期
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN');
};

// 分页处理
const handleSizeChange = (val: number) => {
  pageSize.value = val;
  currentPage.value = 1;
  fetchTemplates();
};

const handleCurrentChange = (val: number) => {
  currentPage.value = val;
  fetchTemplates();
};

// 组件挂载时获取数据
onMounted(() => {
  fetchTemplates();
  fetchDefaultTemplate();
});
</script>

<style scoped>
.template-management {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.template-preview {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.template-info {
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.template-info p {
  margin: 8px 0;
}

.template-image {
  text-align: center;
  padding: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background-color: #fafafa;
}
</style>