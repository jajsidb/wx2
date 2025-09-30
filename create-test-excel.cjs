const XLSX = require('xlsx');

// 创建测试数据
const testData = [
  ['姓名', '学院', '班级', '辅导员', '寝室号', '床位号'],
  ['张三', '计算机学院', '软件工程2021-1班', '李老师', 'A101', '1'],
  ['李四', '计算机学院', '软件工程2021-1班', '李老师', 'A101', '2'],
  ['王五', '电子工程学院', '电子信息2021-2班', '王老师', 'B202', '1'],
  ['赵六', '机械工程学院', '机械设计2021-3班', '张老师', 'C303', '1'],
  ['钱七', '外国语学院', '英语2021-4班', '刘老师', 'D404', '2']
];

// 创建工作簿
const wb = XLSX.utils.book_new();

// 创建工作表
const ws = XLSX.utils.aoa_to_sheet(testData);

// 设置列宽
const colWidths = [
  { wch: 10 }, // 姓名
  { wch: 15 }, // 学院
  { wch: 20 }, // 班级
  { wch: 10 }, // 辅导员
  { wch: 10 }, // 寝室号
  { wch: 8 }   // 床位号
];
ws['!cols'] = colWidths;

// 设置表头样式
const headerStyle = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "4472C4" } },
  alignment: { horizontal: "center", vertical: "center" }
};

// 应用表头样式
const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1'];
headerCells.forEach(cell => {
  if (ws[cell]) {
    ws[cell].s = headerStyle;
  }
});

// 设置数据行样式
for (let row = 2; row <= testData.length; row++) {
  for (let col = 1; col <= 6; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };
    }
  }
}

// 添加工作表到工作簿
XLSX.utils.book_append_sheet(wb, ws, '学生信息');

// 写入文件
XLSX.writeFile(wb, 'test-data.xlsx');

console.log('Excel文件创建成功：test-data.xlsx');