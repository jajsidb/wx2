<template>
  <div class="student-list-container">
    <el-card class="main-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon><User /></el-icon>
          <span>学生信息列表</span>
          <el-button class="refresh-btn" :icon="Refresh" @click="fetchStudents" circle />
        </div>
      </template>

      <!-- 搜索和过滤 -->
      <div class="filter-container">
        <div class="search-bar">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索学生姓名"
            @keyup.enter="fetchStudents"
            style="width: 300px; margin-right: 10px;"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          
          <el-select
            v-model="selectedBatchId"
            placeholder="选择批次"
            clearable
            @change="onBatchChange"
            style="width: 200px; margin-right: 10px;"
          >
            <el-option
              v-for="batchId in availableBatches"
              :key="batchId"
              :label="`批次: ${batchId}`"
              :value="batchId"
            />
          </el-select>
          
          <el-button type="primary" @click="fetchStudents" :icon="Search">搜索</el-button>
          <el-button @click="refreshData" :icon="Refresh">刷新</el-button>
          <el-button type="warning" @click="batchDelete" :icon="Delete" :disabled="selectedStudents.length === 0">
            批量删除 ({{ selectedStudents.length }})
          </el-button>
        </div>
      </div>

      <!-- 学生信息表格 -->
      <el-table 
        :data="students" 
        v-loading="loading" 
        class="student-table" 
        stripe 
        border
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="college" label="学院" width="150" />
        <el-table-column prop="class" label="班级" width="150" />
        <el-table-column prop="dormitory" label="寝室" width="120" />
        <el-table-column prop="bed" label="床位" width="80" />
        <el-table-column label="照片" width="120">
          <template #default="scope">
            <el-image
              v-if="scope.row.photo_url"
              :src="scope.row.photo_url"
              :preview-src-list="[scope.row.photo_url]"
              class="student-photo"
              fit="cover"
            />
            <span v-else>未上传</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="scope">
            <el-button-group>
              <el-upload
                :show-file-list="false"
                :auto-upload="true"
                :http-request="(options) => handlePhotoUpload(scope.row.id, options.file)"
                class="upload-btn"
              >
                <el-button size="small" type="primary" :icon="Upload">上传照片</el-button>
              </el-upload>
              <el-button 
                size="small" 
                type="success" 
                :icon="Picture"
                @click="generateSingleCard(scope.row.id)"
              >
                生成信息卡
              </el-button>
              <el-button 
                size="small" 
                type="warning" 
                :icon="Edit"
                @click="editStudent(scope.row)"
              >
                编辑
              </el-button>
              <el-button 
                size="small" 
                type="danger" 
                :icon="Delete"
                @click="handleDelete(scope.row.id)"
              >
                删除
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-if="total > 0"
        class="pagination-container"
        :current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElCard, ElTable, ElTableColumn, ElButton, ElIcon, ElPagination, ElMessage, ElMessageBox, ElImage, ElUpload, ElInput, ElSelect, ElOption } from 'element-plus';
import { User, Refresh, Search, Upload, Picture, Edit, Delete } from '@element-plus/icons-vue';
import { getStudents, uploadPhoto, deleteStudent, getStudentsByBatch, generateCardSingle, updateStudent, deleteStudentsBatch } from '../api';
import { handleApiError, showErrorMessage, showSuccessMessage, showWarningMessage } from '../utils/errorHandler';

interface Student {
  id: string;
  name: string;
  college: string;
  class: string;
  dormitory: string;
  bed: string;
  photo_url?: string;
}

const students = ref<Student[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const searchKeyword = ref('');
const selectedBatchId = ref('');
const availableBatches = ref<string[]>([]);
const selectedStudents = ref<Student[]>([]);

onMounted(() => {
  fetchStudents();
});

const fetchStudents = async () => {
  try {
    loading.value = true;
    
    let response;
    if (selectedBatchId.value) {
      // 根据批次ID获取学生列表
      response = await getStudentsByBatch(selectedBatchId.value);
    } else {
      // 获取所有学生列表
      response = await getStudents({
        page: currentPage.value - 1, // API使用0基索引
        size: pageSize.value,
        nameKeyword: searchKeyword.value
      });
    }
    
    if (selectedBatchId.value) {
      // 批次查询返回的是数组
      students.value = response.data.data || [];
      total.value = students.value.length;
    } else {
      // 分页查询返回的是分页对象
      students.value = response.data.data.content || [];
      total.value = response.data.data.totalElements || 0;
    }
    
    // 收集批次ID用于筛选
    const batchIds = [...new Set(students.value.map(s => s.batchId).filter(Boolean))];
    availableBatches.value = batchIds;
  } catch (error: any) {
    const apiError = handleApiError(error, '获取学生列表');
    showErrorMessage(apiError);
  } finally {
    loading.value = false;
  }
};

// 批次筛选变化时重新获取数据
const onBatchChange = () => {
  currentPage.value = 1;
  fetchStudents();
};

const handlePhotoUpload = async (studentId: string, file: File) => {
  try {
    const response = await uploadPhoto(studentId, file);
    
    // 适配新的API响应格式
    if (response.data.success) {
      showSuccessMessage('照片上传成功');
      fetchStudents(); // Refresh the list
    } else {
      throw new Error(response.data.message || '照片上传失败');
    }
  } catch (error: any) {
    const apiError = handleApiError(error, '上传照片');
    showErrorMessage(apiError);
  }
};

const handleDelete = async (studentId: string) => {
  try {
    await ElMessageBox.confirm('确定要删除该学生吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    const response = await deleteStudent(studentId);
    
    // 适配新的API响应格式
    if (response.data.success) {
      showSuccessMessage('学生信息删除成功');
      fetchStudents(); // Refresh the list
    } else {
      throw new Error(response.data.message || '删除失败');
    }
  } catch (error: any) {
    if (error.message !== 'cancel') {
      const apiError = handleApiError(error, '删除学生');
      showErrorMessage(apiError);
    }
  }
};

const handleSizeChange = (val: number) => {
  pageSize.value = val;
  fetchStudents();
};

const handleCurrentChange = (val: number) => {
  currentPage.value = val;
  fetchStudents();
};

// 刷新数据
const refreshData = () => {
  searchKeyword.value = '';
  selectedBatchId.value = '';
  currentPage.value = 1;
  fetchStudents();
};

// 生成单个信息卡
const generateSingleCard = async (studentId: string) => {
  try {
    const response = await generateCardSingle(studentId);
    showSuccessMessage('信息卡生成成功!');
    
    // 如果返回了下载链接，可以自动下载
    if (response.data.data?.downloadUrl) {
      const link = document.createElement('a')
      link.href = response.data.data.downloadUrl
      link.download = `信息卡.png`
      link.click()
    }
  } catch (error: any) {
    const apiError = handleApiError(error, '生成信息卡');
    showErrorMessage(apiError);
  }
};

// 编辑学生信息
const editStudent = async (student: Student) => {
  try {
    const { value: formData } = await ElMessageBox.prompt(
      `编辑学生信息 - ${student.name}`,
      '编辑',
      {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputValue: JSON.stringify({
          name: student.name,
          college: student.college,
          className: student.class,
          counselor: student.counselor || '',
          dormitoryNumber: student.dormitory,
          bedNumber: student.bed
        }, null, 2),
        inputPlaceholder: '请输入JSON格式的学生信息'
      }
    );

    const updatedData = JSON.parse(formData);
    const response = await updateStudent(student.id, updatedData);
    
    if (response.data.success) {
      showSuccessMessage('学生信息更新成功');
      fetchStudents(); // 刷新列表
    } else {
      throw new Error(response.data.message || '更新失败');
    }
  } catch (error: any) {
    if (error.message !== 'cancel') {
      const apiError = handleApiError(error, '更新学生信息');
      showErrorMessage(apiError);
    }
  }
};

// 处理多选变化
const handleSelectionChange = (selection: Student[]) => {
  selectedStudents.value = selection;
};

// 批量删除
const batchDelete = async () => {
  if (selectedStudents.value.length === 0) {
    ElMessage.warning('请先选择要删除的学生');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedStudents.value.length} 个学生吗？`,
      '批量删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    const studentIds = selectedStudents.value.map(student => student.id);
    
    // 这里需要导入批量删除API
    const response = await deleteStudentsBatch(studentIds);
    
    if (response.data.success) {
      ElMessage.success(`成功删除 ${studentIds.length} 个学生`);
      selectedStudents.value = [];
      fetchStudents(); // 刷新列表
    } else {
      throw new Error(response.data.message || '批量删除失败');
    }
  } catch (error: any) {
    if (error.message !== 'cancel') {
      console.error('批量删除失败:', error);
      ElMessage.error('批量删除失败: ' + (error.response?.data?.message || error.message || '网络错误'));
    }
  }
};

// Expose fetchStudents to be called from parent
defineExpose({ fetchStudents });

</script>

<style scoped>
.student-list-container {
  padding: 20px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.refresh-btn {
  margin-left: auto;
}
.filter-container {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.search-input {
  width: 300px;
}
.student-table {
  width: 100%;
}
.student-photo {
  width: 80px;
  height: 80px;
  border-radius: 4px;
}
.upload-btn {
  display: inline-block;
  margin-right: 10px;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>