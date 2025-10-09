import axios from 'axios'
import { handleApiError, validateApiResponse, showErrorMessage } from './utils/errorHandler'

// 创建axios实例
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证token等
    console.log('API请求:', config.method?.toUpperCase(), config.url, config.data)
    return config
  },
  (error) => {
    console.error('请求拦截器错误:', error)
    return Promise.reject(handleApiError(error, '请求拦截'))
  }
)

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    try {
      // 验证响应格式
      const validatedResponse = validateApiResponse(response)
      
      // 检查业务逻辑成功状态
      if (!validatedResponse.success) {
        throw handleApiError({
          response: {
            data: validatedResponse,
            status: response.status
          }
        }, '业务逻辑错误')
      }
      
      console.log('API响应成功:', response.config.url, validatedResponse)
      return response
    } catch (error) {
      console.error('响应处理错误:', error)
      return Promise.reject(error)
    }
  },
  (error) => {
    const apiError = handleApiError(error, '响应拦截')
    console.error('API响应错误:', apiError)
    return Promise.reject(apiError)
  }
)

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

// 新增：获取单个学生信息
export const getStudentById = (studentId: string) => {
  return apiClient.get(`/students/${studentId}`);
};

// 新增：下载生成的信息卡
export const downloadCard = (taskId: string) => {
  return apiClient.get(`/cards/download/${taskId}`, {
    responseType: 'blob'
  });
};

// 模板管理接口
export const getTemplates = (params?: {
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: string;
  isActive?: boolean;
}) => {
  return apiClient.get('/templates', { params });
};

export const getTemplateById = (templateId: number) => {
  return apiClient.get(`/templates/${templateId}`);
};

export const getActiveTemplates = () => {
  return apiClient.get('/templates/active');
};

export const getDefaultTemplate = () => {
  return apiClient.get('/templates/default');
};

// 新增：获取系统状态
export const getSystemStatus = () => {
  return apiClient.get('/api/system/status')
}