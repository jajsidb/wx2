# 寝室信息卡系统 - API接口文档

## 1. 接口概览

### 1.1 基础信息
- **Base URL**: `http://localhost:8080/api`
- **Content-Type**: `application/json`
- **字符编码**: UTF-8

### 1.2 通用响应格式
```json
{
  "success": true,
  "message": "操作成功",
  "data": {},
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1.3 错误响应格式
```json
{
  "success": false,
  "message": "错误描述",
  "data": null,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 2. 文件管理接口

### 2.1 导入学生信息Excel文件

**接口地址**: `POST /api/students/import`

**请求方式**: `multipart/form-data`

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| file | File | 是 | Excel文件(.xlsx/.xls) |
| batchId | String | 是 | 批次ID |

**Excel文件格式要求**:
- 第一行为表头：姓名、学院、班级、辅导员、寝室号、床位号
- 数据行最多4行
- 支持.xlsx和.xls格式

**响应示例**:
```json
{
  "success": true,
  "message": "导入成功",
  "data": 25
}
```

### 2.2 上传学生照片

**接口地址**: `POST /api/students/{id}/photo`

**请求方式**: `multipart/form-data`

**路径参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | Long | 学生ID |

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| file | File | 是 | 照片文件(jpg/png/jpeg) |

**响应示例**:
```json
{
  "success": true,
  "message": "照片上传成功",
  "data": "/uploads/photos/student_1_20240101120000.jpg"
}
```

## 3. 学生信息管理接口

### 3.1 创建学生信息

**接口地址**: `POST /api/students`

**请求体**:
```json
{
  "name": "张三",
  "college": "计算机学院",
  "className": "软件工程2021-1班",
  "counselor": "李老师",
  "dormitoryNumber": "A101",
  "bedNumber": "1"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "学生信息创建成功",
  "data": {
    "id": 1,
    "name": "张三",
    "college": "计算机学院",
    "className": "软件工程2021-1班",
    "counselor": "李老师",
    "dormitoryNumber": "A101",
    "bedNumber": "1",
    "photoPath": null,
    "batchId": null,
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

### 3.2 获取学生列表

**接口地址**: `GET /api/students`

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | Integer | 否 | 页码，默认0 |
| size | Integer | 否 | 每页大小，默认20 |
| sortBy | String | 否 | 排序字段，默认createdAt |
| sortDir | String | 否 | 排序方向，默认desc |
| college | String | 否 | 学院筛选 |
| className | String | 否 | 班级筛选 |
| counselor | String | 否 | 辅导员筛选 |
| dormitoryNumber | String | 否 | 寝室号筛选 |
| nameKeyword | String | 否 | 姓名关键词搜索 |
| batchId | String | 否 | 批次ID筛选 |

**响应示例**:
```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "content": [
      {
        "id": 1,
        "name": "张三",
        "college": "计算机学院",
        "className": "软件工程2021-1班",
        "counselor": "李老师",
        "dormitoryNumber": "A101",
        "bedNumber": "1",
        "photoPath": "/uploads/photos/student_1.jpg",
        "batchId": "batch-123456",
        "createdAt": "2024-01-01T12:00:00Z"
      }
    ],
    "totalElements": 1,
    "totalPages": 1,
    "size": 20,
    "number": 0
  }
}
```

### 3.3 根据批次ID获取学生列表

**接口地址**: `GET /api/students/batch/{batchId}`

**路径参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| batchId | String | 批次ID |

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "name": "张三",
      "college": "计算机学院",
      "className": "软件工程2021-1班",
      "counselor": "李老师",
      "dormitoryNumber": "A101",
      "bedNumber": "1",
      "photoPath": "/uploads/photos/student_1.jpg",
      "batchId": "batch-123456",
      "createdAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### 3.4 获取单个学生信息

**接口地址**: `GET /api/students/{id}`

**路径参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | Long | 学生ID |

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "id": 1,
    "name": "张三",
    "college": "计算机学院",
    "className": "软件工程2021-1班",
    "counselor": "李老师",
    "dormitoryNumber": "A101",
    "bedNumber": "1",
    "photoPath": "/uploads/photos/student_1.jpg",
    "batchId": "batch-123456",
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

### 3.5 更新学生信息

**接口地址**: `PUT /api/students/{id}`

**路径参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | Long | 学生ID |

**请求体**:
```json
{
  "name": "张三",
  "college": "计算机学院",
  "className": "软件工程2021-1班",
  "counselor": "李老师",
  "dormitoryNumber": "A101",
  "bedNumber": "1"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "学生信息更新成功",
  "data": {
    "id": 1,
    "name": "张三",
    "college": "计算机学院",
    "className": "软件工程2021-1班",
    "counselor": "李老师",
    "dormitoryNumber": "A101",
    "bedNumber": "1",
    "photoPath": "/uploads/photos/student_1.jpg",
    "batchId": "batch-123456",
    "updatedAt": "2024-01-01T12:30:00Z"
  }
}
```

### 3.6 删除学生信息

**接口地址**: `DELETE /api/students/{id}`

**路径参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | Long | 学生ID |

**响应示例**:
```json
{
  "success": true,
  "message": "学生信息删除成功",
  "data": null
}
```

### 3.7 批量删除学生信息

**接口地址**: `DELETE /api/students/batch`

**请求体**:
```json
[1, 2, 3]
```

**响应示例**:
```json
{
  "success": true,
  "message": "批量删除成功",
  "data": null
}
```

## 4. 信息卡生成接口

### 4.1 生成单张信息卡

**接口地址**: `POST /api/cards/generate/{studentId}`

**路径参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| studentId | Long | 学生ID |

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| templateId | Long | 否 | 模板ID，默认使用系统模板 |

**响应示例**:
```json
{
  "success": true,
  "message": "信息卡生成成功",
  "data": {
    "taskId": "task-123456",
    "downloadUrl": "/api/cards/download/task-123456"
  }
}
```

### 4.2 批量生成信息卡

**接口地址**: `POST /api/cards/generate/batch`

**请求体**:
```json
{
  "studentIds": [1, 2, 3, 4],
  "templateId": 1
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "批量生成任务已启动",
  "data": {
    "taskId": "task-789012",
    "totalCount": 4,
    "status": "pending"
  }
}
```

### 4.3 获取生成进度

**接口地址**: `GET /api/cards/task/{taskId}/progress`

**路径参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| taskId | String | 任务ID |

**响应示例**:
```json
{
  "success": true,
  "message": "获取任务进度成功",
  "data": {
    "taskId": "task-123456",
    "status": "processing",
    "progress": 75,
    "total": 4,
    "completed": 3,
    "message": "正在生成第3张信息卡..."
  }
}
```

## 5. 模板管理接口

### 5.1 获取模板列表

**接口地址**: `GET /api/templates`

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | Integer | 否 | 页码，默认0 |
| size | Integer | 否 | 每页大小，默认20 |
| sortBy | String | 否 | 排序字段，默认createdAt |
| sortDir | String | 否 | 排序方向，默认desc |
| isActive | Boolean | 否 | 是否激活状态筛选 |

**响应示例**:
```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "content": [
      {
        "id": 1,
        "templateName": "默认模板",
        "templatePath": "/templates/default.png",
        "width": 800,
        "height": 600,
        "isActive": true,
        "createdAt": "2024-01-01T12:00:00Z"
      }
    ],
    "totalElements": 1,
    "totalPages": 1,
    "size": 20,
    "number": 0
  }
}
```

### 5.2 获取单个模板信息

**接口地址**: `GET /api/templates/{id}`

**路径参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | Long | 模板ID |

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "id": 1,
    "templateName": "默认模板",
    "templatePath": "/templates/default.png",
    "width": 800,
    "height": 600,
    "isActive": true,
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

### 5.3 获取激活的模板列表

**接口地址**: `GET /api/templates/active`

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "templateName": "默认模板",
      "templatePath": "/templates/default.png",
      "width": 800,
      "height": 600,
      "isActive": true,
      "createdAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### 5.4 获取默认模板

**接口地址**: `GET /api/templates/default`

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "id": 1,
    "templateName": "默认模板",
    "templatePath": "/templates/default.png",
    "width": 800,
    "height": 600,
    "isActive": true,
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

## 6. 系统信息接口

### 6.1 获取系统状态

**接口地址**: `GET /api/system/status`

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "version": "1.0.0",
    "status": "running",
    "uptime": "2 days, 3 hours, 45 minutes",
    "database": "connected",
    "diskSpace": {
      "total": "100GB",
      "used": "25GB",
      "free": "75GB"
    }
  }
}
```

### 6.2 获取统计信息

**接口地址**: `GET /api/system/statistics`

**响应示例**:
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "totalStudents": 156,
    "totalBatches": 12,
    "totalCards": 89,
    "todayUploads": 5,
    "todayGenerations": 23
  }
}
```

## 7. 错误码说明

| 错误码 | 说明 |
|--------|------|
| 1001 | 文件格式不支持 |
| 1002 | 文件大小超出限制 |
| 1003 | Excel格式错误 |
| 1004 | 学生信息验证失败 |
| 2001 | 学生不存在 |
| 2002 | 批次不存在 |
| 3001 | 模板不存在 |
| 3002 | 信息卡生成失败 |
| 4001 | 数据库连接失败 |
| 5001 | 系统内部错误 |

## 8. 接口调用示例

### 8.1 JavaScript (Axios)

```javascript
// 上传Excel文件
const uploadExcel = async (file, batchId) => {
  const formData = new FormData();
  formData.append('file', file);
  if (batchId) {
    formData.append('batchId', batchId);
  }
  
  try {
    const response = await axios.post('/api/files/upload-excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.error('上传失败:', error);
    throw error;
  }
};

// 生成信息卡
const generateCard = async (studentId) => {
  try {
    const response = await axios.post(`/api/cards/generate/${studentId}`, {}, {
      responseType: 'blob'
    });
    
    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '信息卡.png');
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error('生成失败:', error);
    throw error;
  }
};
```

### 8.2 cURL

```bash
# 导入学生信息Excel文件
curl -X POST "http://localhost:8080/api/students/import" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@students.xlsx" \
  -F "batchId=batch-001"

# 获取学生列表
curl -X GET "http://localhost:8080/api/students?batchId=batch-001" \
  -H "Accept: application/json"

# 生成信息卡
curl -X POST "http://localhost:8080/api/cards/generate/1" \
  -H "Accept: application/json"
```

## 9. 接口测试

### 9.1 Postman集合

建议创建Postman集合包含以下测试用例：
1. 文件上传测试
2. 学生信息CRUD测试
3. 信息卡生成测试
4. 错误处理测试

### 9.2 自动化测试

使用JUnit和MockMvc进行接口自动化测试：

```java
@SpringBootTest
@AutoConfigureTestDatabase
class ApiIntegrationTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @Test
    void testUploadExcel() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "test.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "test data".getBytes());
        
        mockMvc.perform(multipart("/api/files/upload-excel")
                .file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
```