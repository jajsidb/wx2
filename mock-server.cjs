const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// 模拟数据存储
let students = [
  {
    id: '1',
    name: '张三',
    college: '计算机学院',
    class: '软件工程2021-1班',
    counselor: '李老师',
    dormitory: 'A101',
    bed: '1',
    photo_url: null,
    batchId: 'batch-demo-001'
  },
  {
    id: '2',
    name: '李四',
    college: '计算机学院',
    class: '软件工程2021-1班',
    counselor: '李老师',
    dormitory: 'A101',
    bed: '2',
    photo_url: null,
    batchId: 'batch-demo-001'
  },
  {
    id: '3',
    name: '王五',
    college: '电子工程学院',
    class: '电子信息2021-2班',
    counselor: '王老师',
    dormitory: 'B202',
    bed: '1',
    photo_url: null,
    batchId: 'batch-demo-002'
  }
];

let nextId = 4;

// 通用响应格式
const successResponse = (data, message = '操作成功') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString()
});

const errorResponse = (message = '操作失败', data = null) => ({
  success: false,
  message,
  data,
  timestamp: new Date().toISOString()
});

// API路由

// 1. 获取学生列表
app.get('/api/students', (req, res) => {
  const { page = 0, size = 10, nameKeyword = '' } = req.query;
  
  let filteredStudents = students;
  
  // 按姓名搜索
  if (nameKeyword) {
    filteredStudents = students.filter(student => 
      student.name.includes(nameKeyword)
    );
  }
  
  // 分页
  const startIndex = parseInt(page) * parseInt(size);
  const endIndex = startIndex + parseInt(size);
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);
  
  const response = {
    content: paginatedStudents,
    totalElements: filteredStudents.length,
    totalPages: Math.ceil(filteredStudents.length / parseInt(size)),
    size: parseInt(size),
    number: parseInt(page)
  };
  
  res.json(successResponse(response, '获取学生列表成功'));
});

// 2. 创建学生
app.post('/api/students', (req, res) => {
  const studentData = req.body;
  const newStudent = {
    id: nextId.toString(),
    ...studentData,
    photo_url: null
  };
  
  students.push(newStudent);
  nextId++;
  
  res.json(successResponse(newStudent, '学生创建成功'));
});

// 3. 更新学生信息
app.put('/api/students/:id', (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  
  const studentIndex = students.findIndex(s => s.id === id);
  if (studentIndex === -1) {
    return res.status(404).json(errorResponse('学生不存在'));
  }
  
  students[studentIndex] = { ...students[studentIndex], ...updateData };
  res.json(successResponse(students[studentIndex], '学生信息更新成功'));
});

// 4. 删除学生
app.delete('/api/students/:id', (req, res) => {
  const { id } = req.params;
  const studentIndex = students.findIndex(s => s.id === id);
  
  if (studentIndex === -1) {
    return res.status(404).json(errorResponse('学生不存在'));
  }
  
  students.splice(studentIndex, 1);
  res.json(successResponse(null, '学生删除成功'));
});

// 5. 批量删除学生
app.delete('/api/students/batch', (req, res) => {
  const studentIds = req.body;
  
  if (!Array.isArray(studentIds)) {
    return res.status(400).json(errorResponse('请提供学生ID数组'));
  }
  
  const deletedCount = studentIds.length;
  students = students.filter(student => !studentIds.includes(parseInt(student.id)));
  
  res.json(successResponse({ deletedCount }, `成功删除${deletedCount}个学生`));
});

// 6. 根据批次获取学生
app.get('/api/students/batch/:batchId', (req, res) => {
  const { batchId } = req.params;
  const batchStudents = students.filter(s => s.batchId === batchId);
  
  res.json(successResponse(batchStudents, '获取批次学生成功'));
});

// 7. 上传学生照片
app.post('/api/students/:id/photo', upload.single('file'), (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json(errorResponse('请选择照片文件'));
  }
  
  const studentIndex = students.findIndex(s => s.id === id);
  if (studentIndex === -1) {
    return res.status(404).json(errorResponse('学生不存在'));
  }
  
  const photoUrl = `/uploads/${req.file.filename}`;
  students[studentIndex].photo_url = photoUrl;
  
  res.json(successResponse(photoUrl, '照片上传成功'));
});

// 8. 导入Excel文件
app.post('/api/students/import', upload.single('file'), (req, res) => {
  const { batchId } = req.body;
  
  if (!req.file) {
    return res.status(400).json(errorResponse('请选择Excel文件'));
  }
  
  // 模拟Excel解析和导入
  const mockImportedStudents = [
    {
      id: nextId.toString(),
      name: '导入学生1',
      college: '导入学院',
      class: '导入班级',
      counselor: '导入辅导员',
      dormitory: 'C301',
      bed: '1',
      photo_url: null,
      batchId: batchId
    },
    {
      id: (nextId + 1).toString(),
      name: '导入学生2',
      college: '导入学院',
      class: '导入班级',
      counselor: '导入辅导员',
      dormitory: 'C301',
      bed: '2',
      photo_url: null,
      batchId: batchId
    }
  ];
  
  students.push(...mockImportedStudents);
  nextId += mockImportedStudents.length;
  
  res.json(successResponse(mockImportedStudents.length, `成功导入${mockImportedStudents.length}条学生数据`));
});

// 9. 批量创建学生
app.post('/api/students/batch-create', (req, res) => {
  const { students: studentsData, batchId } = req.body;
  
  if (!Array.isArray(studentsData)) {
    return res.status(400).json(errorResponse('请提供学生数据数组'));
  }
  
  const newStudents = studentsData.map(studentData => ({
    id: nextId++,
    ...studentData,
    photo_url: null,
    batchId: batchId || `batch-${Date.now()}`
  }));
  
  students.push(...newStudents);
  
  res.json(successResponse(newStudents, `成功创建${newStudents.length}条学生记录`));
});

// 10. 生成单个信息卡
app.post('/api/cards/generate/:studentId', (req, res) => {
  const { studentId } = req.params;
  const student = students.find(s => s.id === studentId);
  
  if (!student) {
    return res.status(404).json(errorResponse('学生不存在'));
  }
  
  // 模拟信息卡生成
  const cardData = {
    cardId: `card-${studentId}-${Date.now()}`,
    studentId: studentId,
    generatedAt: new Date().toISOString(),
    downloadUrl: `/cards/card-${studentId}.pdf`
  };
  
  res.json(successResponse(cardData, '信息卡生成成功'));
});

// 11. 批量生成信息卡
app.post('/api/cards/generate/batch', (req, res) => {
  const { studentIds } = req.body;
  
  if (!Array.isArray(studentIds)) {
    return res.status(400).json(errorResponse('请提供学生ID数组'));
  }
  
  const taskId = `task-${Date.now()}`;
  const cards = studentIds.map(id => ({
    cardId: `card-${id}-${Date.now()}`,
    studentId: id,
    generatedAt: new Date().toISOString()
  }));
  
  res.json(successResponse({ taskId, cards }, `开始批量生成${studentIds.length}张信息卡`));
});

// 12. 获取系统统计
app.get('/api/system/statistics', (req, res) => {
  const stats = {
    totalStudents: students.length,
    totalBatches: [...new Set(students.map(s => s.batchId))].length,
    totalCards: Math.floor(students.length * 0.8), // 模拟已生成的信息卡数量
    lastUpdated: new Date().toISOString()
  };
  
  res.json(successResponse(stats, '获取系统统计成功'));
});

// 13. 获取任务进度
app.get('/api/tasks/:taskId/progress', (req, res) => {
  const { taskId } = req.params;
  
  const progress = {
    taskId,
    status: 'completed',
    progress: 100,
    message: '任务已完成',
    completedAt: new Date().toISOString()
  };
  
  res.json(successResponse(progress, '获取任务进度成功'));
});

// 静态文件服务
app.use('/uploads', express.static('uploads'));

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Mock API Server is running on http://localhost:${PORT}`);
  console.log(`📁 API Base URL: http://localhost:${PORT}/api`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET    /api/students - 获取学生列表`);
  console.log(`   POST   /api/students - 创建学生`);
  console.log(`   PUT    /api/students/:id - 更新学生`);
  console.log(`   DELETE /api/students/:id - 删除学生`);
  console.log(`   DELETE /api/students/batch - 批量删除学生`);
  console.log(`   POST   /api/students/import - 导入Excel`);
  console.log(`   POST   /api/students/:id/photo - 上传照片`);
  console.log(`   GET    /api/system/statistics - 系统统计`);
  console.log(`   POST   /api/cards/generate/:id - 生成信息卡`);
});