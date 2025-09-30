# 寝室门牌生成工具后端（Spring Boot）技术文档

## 项目概述
- 寝室门牌生成工具后端（Spring Boot）：接收工作人员上传的 Excel（含学生证件照、姓名、学院、班级、辅导员、寝室号、床位号），解析并写入 MySQL；根据前端提供的图片模板与固定坐标，将信息渲染到门牌图片；提供接口给前端调用（单张或批量生成、下载）。
- 核心流程：上传 Excel → 解析与校验 → 入库 → 前端调用生成接口 → 图片渲染与存储/打包 → 提供下载。

## 技术栈
- Spring Boot（`spring-boot-starter-web`、`spring-boot-starter-validation`）。
- 数据访问：Spring Data JPA 或 MyBatis（本文以 JPA 示例）。
- Excel 解析：Apache POI（`poi-ooxml`）。
- 图片渲染：Java2D（`BufferedImage`、`Graphics2D`、`ImageIO`）。
- 数据库：MySQL 8.x。
- 文件存储：本地磁盘或对象存储（可抽象 `StorageService`）。

## 数据库设计
- 表：`student`
- 说明：为简化，一人一床，使用唯一约束保证床位唯一归属。

```sql
CREATE TABLE student (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  student_no VARCHAR(64) NULL,
  name VARCHAR(64) NOT NULL,
  college VARCHAR(128) NOT NULL,
  class_name VARCHAR(128) NOT NULL,
  counselor_name VARCHAR(128) NOT NULL,
  dorm_number VARCHAR(64) NOT NULL,
  bed_number VARCHAR(32) NOT NULL,
  photo_url VARCHAR(512) NULL,
  status TINYINT NOT NULL DEFAULT 1, -- 1:有效 0:无效
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_dorm_bed (dorm_number, bed_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- 可选表：`doorplate_task`（记录批量生成任务与结果 ZIP 路径）、`template_meta`（模板与坐标配置的版本化管理）。

## 文件与存储
- Excel 上传：`multipart/form-data`，字段名 `file`，仅支持 `.xlsx`。
- 证件照来源（两种）：
  - 嵌入在 Excel 的单元格或绘图对象内（POI 解析图片并与行绑定）。
  - Excel 某列提供文件名/相对路径，上传时同时附带一个图片文件夹压缩包（`photos.zip`）；后端按文件名关联。
- 存储结构示例：
  - 原始上传：`uploads/excel/{yyyyMMdd}/{uuid}.xlsx`
  - 学生照片：`uploads/photos/{studentId}.jpg`
  - 门牌图片：`generated/doorplates/{dormNumber}-{bedNumber}.png`
  - 批量结果 ZIP：`generated/batches/{taskId}.zip`

## Excel 解析与字段映射
- 必填列：`姓名`、`学院`、`班级`、`辅导员`、`寝室号`、`床位号`、`证件照`。
- 列名容错：可配置列别名，默认按中文列头匹配。
- 推荐表头示例：
  - 姓名 | 学院 | 班级 | 辅导员 | 寝室号 | 床位号 | 证件照
- 图片解析策略：
  - `.xlsx` 嵌入图：使用 POI 读取 `XSSFDrawing/XSSFPicture`，根据图锚点行列映射至数据行。
  - 路径或文件名列：从 `photos.zip` 解压后，按文件名匹配复制到 `photo_url` 存储路径。
- 数据校验与去重：
  - 校验必填字段非空，寝室号/床位号规范（如 `16-304`，`A1` 等）。
  - 通过唯一约束 `(dorm_number, bed_number)` 保障一床一人；重复则更新或报错，行为可通过参数控制（`mode=upsert|strict`）。

## 模板与渲染方案
- 前端提供图片模板（PNG/JPG）与固定坐标；后端根据坐标将文字与照片绘制到模板。
- 坐标配置结构建议（存储或请求中携带）：

```json
{
  "id": "doorplate-default",
  "templateImage": "templates/doorplate-default.png",
  "canvas": { "width": 1200, "height": 800 },
  "fields": {
    "photo": { "x": 80, "y": 120, "width": 240, "height": 320, "shape": "rect" },
    "name": { "x": 400, "y": 180, "font": { "family": "PingFang SC", "size": 48, "color": "#1a1a1a" } },
    "college": { "x": 400, "y": 250, "font": { "family": "PingFang SC", "size": 32, "color": "#1a1a1a" } },
    "className": { "x": 400, "y": 300, "font": { "family": "PingFang SC", "size": 32, "color": "#1a1a1a" } },
    "counselorName": { "x": 400, "y": 350, "font": { "family": "PingFang SC", "size": 28, "color": "#333333" } },
    "dormNumber": { "x": 400, "y": 430, "font": { "family": "PingFang SC", "size": 40, "color": "#1a1a1a" } },
    "bedNumber": { "x": 400, "y": 490, "font": { "family": "PingFang SC", "size": 36, "color": "#1a1a1a" } }
  }
}
```

- 渲染细节：
  - 文本：`Graphics2D` 开启抗锯齿，指定字体与颜色，必要时自动换行或缩放以适配区域宽度。
  - 照片：按 `width/height` 等比缩放居中裁剪；支持圆形/矩形遮罩。
  - 输出：`PNG`，命名规则 `dorm-bed.png`；批量时打包 ZIP 并返回下载地址。

## REST 接口规范
- 统一响应包：

```json
{ "code": 0, "message": "OK", "data": { /* payload */ } }
```

### 上传 Excel 并入库
- `POST /api/upload/excel`
- 请求：`multipart/form-data`，字段 `file`；可选 `mode=upsert|strict`，`photoSource=embedded|filename`，`photoZip`（当 `filename` 时附带）。
- 响应：导入统计、错误列表、成功条目数。

### 查询学生
- `GET /api/students`
- 参数：`name`、`college`、`className`、`dormNumber`、`bedNumber`、`page`、`size`。

### 获取单个学生
- `GET /api/students/{id}`

### 更新学生（选用）
- `PUT /api/students/{id}`，请求体为学生字段（JSON）。

### 删除学生（选用）
- `DELETE /api/students/{id}`

### 生成单张门牌图片（预览）
- `POST /api/doorplates/preview`
- 请求体：`{ studentId: number, templateId: string }` 或携带完整坐标配置 `templateConfig`。
- 响应：图片的临时访问 URL 或 Base64（可配置）。

### 批量生成门牌图片并下载
- `POST /api/doorplates/generate`
- 请求体：

```json
{
  "studentFilter": { "className": "2022软件1班", "dormNumber": "16-304" },
  "studentIds": [1,2,3],
  "templateId": "doorplate-default",
  "output": { "pack": true }
}
```

- 响应：批次任务 `taskId`、结果 ZIP 下载 URL。

### 模板管理（可选）
- `GET /api/templates` 列出模板元数据。
- `POST /api/templates` 上传模板图片与坐标配置。

## 错误码与异常处理
- `0`：成功。
- `4001`：参数校验失败（列缺失、格式不符）。
- `4002`：Excel 解析错误（文件损坏、图片缺失）。
- `4003`：数据冲突（床位重复且非 upsert）。
- `5001`：图片渲染失败（模板或字体错误）。
- `5002`：存储失败（写文件/打包异常）。

## 安全与权限
- 管理员/工作人员角色访问上传与生成接口（JWT 或简单 Token）。
- 配置 CORS 允许前端域名；下载接口支持 `Content-Disposition` 附件头。

## 部署与配置
- `application.yml` 关键项：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/dormdoor?useSSL=false&serverTimezone=Asia/Shanghai&useUnicode=true&characterEncoding=utf8
    username: root
    password: your_password
  servlet:
    multipart:
      max-file-size: 200MB
      max-request-size: 300MB
storage:
  root: /data/dormdoor
  public-base-url: https://your-cdn.com/
image:
  fonts:
    default-family: PingFang SC
```

- Maven 依赖：

```xml
<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
  </dependency>
  <dependency>
    <groupId>mysql</groupId>
    <artifactId>mysql-connector-java</artifactId>
    <scope>runtime</scope>
  </dependency>
  <dependency>
    <groupId>org.apache.poi</groupId>
    <artifactId>poi-ooxml</artifactId>
    <version>5.2.5</version>
  </dependency>
</dependencies>
```

## 示例请求
### 上传 Excel（嵌入图片）
```bash
curl -X POST http://localhost:8080/api/upload/excel \
  -F "file=@/path/to/students.xlsx" \
  -F "mode=upsert" \
  -F "photoSource=embedded"
```

### 上传 Excel + 图片压缩包（文件名列）
```bash
curl -X POST http://localhost:8080/api/upload/excel \
  -F "file=@/path/to/students.xlsx" \
  -F "photoSource=filename" \
  -F "photoZip=@/path/to/photos.zip"
```

### 预览单张门牌
```bash
curl -X POST http://localhost:8080/api/doorplates/preview \
  -H "Content-Type: application/json" \
  -d '{"studentId":123, "templateId":"doorplate-default"}'
```

### 批量生成并下载
```bash
curl -X POST http://localhost:8080/api/doorplates/generate \
  -H "Content-Type: application/json" \
  -d '{"studentIds":[1,2,3], "templateId":"doorplate-default", "output":{"pack":true}}'
```

## 前后端联调说明
- 坐标一致性：后端按照 `templateId` 取坐标，或允许前端每次请求携带 `templateConfig`；前端需确保字体与颜色与视觉稿一致。
- 图片访问：后端返回可访问的 `publicBaseUrl` 拼接路径；或直接返回 Base64 用于预览。
- CORS：允许前端域名；下载 ZIP 接口返回附件头。

## 约束与注意事项
- 支持中文字体；服务器需安装对应字体或使用嵌入字体文件。
- Excel 大文件建议分页导入或异步任务（`doorplate_task`）。
- 模板图片建议 PNG，避免 JPEG 压缩导致文字边缘失真。
- 图片尺寸与坐标以模板实际像素为准，前端提供时需标注清楚。

## 实现要点小结
- 通过 Apache POI 提取数据与图片，使用事务写入 MySQL。
- 使用 Java2D 渲染文字与照片到模板，支持批量 ZIP 输出。
- 提供查询与生成接口、模板坐标配置管理，满足前端联调与生产需要。

> 如需我基于该文档直接初始化一个 Spring Boot 项目骨架（包含实体、控制器、服务与示例实现），请告知期望的包名与存储方式（本地/对象存储）。