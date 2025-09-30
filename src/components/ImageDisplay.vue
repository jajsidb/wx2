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
        </div>
      </div>

      <!-- 学生信息表格 -->
      <el-table :data="students" v-loading="loading" class="student-table" stripe border>
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
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-upload
              :show-file-list="false"
              :auto-upload="true"
              :http-request="(options) => handlePhotoUpload(scope.row.id, options.file)"
              class="upload-btn"
            >
              <el-button size="small" type="primary">上传照片</el-button>
            </el-upload>
            <el-button size="small" type="danger" @click="handleDelete(scope.row.id)">删除</el-button>
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
import { User, Refresh, Search } from '@element-plus/icons-vue';
import { getStudents, uploadPhoto, deleteStudent, getStudentsByBatch } from '../api';

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
    
    // 适配新的API响应格式
    if (response.data.success) {
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
    } else {
      throw new Error(response.data.message || '获取学生列表失败');
    }
  } catch (error) {
    console.error('获取学生列表失败:', error);
    ElMessage.error('获取学生列表失败');
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
      ElMessage.success('照片上传成功');
      fetchStudents(); // Refresh the list
    } else {
      throw new Error(response.data.message || '照片上传失败');
    }
  } catch (error: any) {
    console.error('照片上传失败:', error);
    ElMessage.error('照片上传失败: ' + (error.response?.data?.message || error.message || '网络错误'));
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
      ElMessage.success('学生信息删除成功');
      fetchStudents(); // Refresh the list
    } else {
      throw new Error(response.data.message || '删除失败');
    }
  } catch (error: any) {
    if (error.message !== 'cancel') {
      console.error('删除学生失败:', error);
      ElMessage.error('删除失败: ' + (error.response?.data?.message || error.message || '网络错误'));
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