import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api', // The proxy will handle this
  headers: {
    'Content-Type': 'application/json',
  },
});

// 学生数据接口定义
interface StudentData {
  name: string
  college: string
  className: string
  counselor: string
  dormitoryNumber: string
  bedNumber: string
}

// 生成批次ID的工具函数
const generateBatchId = () => {
  return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// 原有的文件上传接口（保留兼容性）
export const uploadExcel = (file: File, batchId?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('batchId', batchId || generateBatchId());
  return apiClient.post('/students/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// 新增：直接保存学生数据到数据库
export const saveStudentsToDatabase = (students: StudentData[], batchId?: string) => {
  return apiClient.post('/students/batch-create', {
    students,
    batchId: batchId || generateBatchId()
  });
};

// 新增：创建单个学生记录
export const createStudent = (student: StudentData, batchId?: string) => {
  return apiClient.post('/students', {
    ...student,
    batchId: batchId || generateBatchId()
  });
};

// 新增：更新学生信息
export const updateStudent = (studentId: string, student: Partial<StudentData>) => {
  return apiClient.put(`/students/${studentId}`, student);
};

export const getStudents = (params: any) => {
  return apiClient.get('/students', { params });
};

export const uploadPhoto = (studentId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post(`/students/${studentId}/photo`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const deleteStudent = (studentId: string) => {
  return apiClient.delete(`/students/${studentId}`);
};

// 根据批次ID获取学生列表
export const getStudentsByBatch = (batchId: string) => {
  return apiClient.get(`/students/batch/${batchId}`);
};

// 批量删除学生
export const deleteStudentsBatch = (studentIds: number[]) => {
  return apiClient.delete('/students/batch', {
    data: studentIds
  });
};

// 新增：获取系统统计信息
export const getSystemStatistics = () => {
  return apiClient.get('/system/statistics');
};

// 新增：生成信息卡
export const generateCard = (studentId: string, templateId?: number) => {
  return apiClient.post(`/cards/generate/${studentId}`, {
    templateId
  }, {
    responseType: 'blob'
  });
};

// 新增：生成单个信息卡
export const generateCardSingle = (studentId: string, templateId?: number) => {
  return apiClient.post(`/cards/generate/${studentId}`, {
    templateId
  });
};

// 新增：批量生成信息卡
export const generateCardsBatch = (studentIds: number[], templateId?: number) => {
  return apiClient.post('/cards/generate/batch', {
    studentIds,
    templateId
  });
};

// 新增：获取生成任务进度
export const getTaskProgress = (taskId: string) => {
  return apiClient.get(`/cards/task/${taskId}/progress`);
};