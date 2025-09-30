import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api', // The proxy will handle this
  headers: {
    'Content-Type': 'application/json',
  },
});

// 生成批次ID的工具函数
const generateBatchId = () => {
  return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

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