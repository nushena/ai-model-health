# AI 模型健康监控系统

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

轻量级 AI 模型健康监控系统，用于实时监控 OpenAI API 兼容接口的模型可用性和响应速度。适用于公益站、自建 API 等场景。

## ✨ 功能特点

- 🚀 **高性能架构**: 基于 SQLite 数据库，响应延迟 ~5ms，支持 1000+ req/s 并发
- 🔄 **自动定时检测**: 每 5 分钟（可配置）自动检测所有模型状态
- 🌐 **动态模型列表**: 通过 API 自动获取可用模型，无需手动配置
- 📊 **实时数据展示**: 友好的 Web 界面，实时显示模型在线状态、响应延迟和可用率
- 📈 **历史趋势追踪**: 批次对齐的时间轴，保留 14 天历史数据（可配置）
- 🧹 **自动数据清理**: 每天凌晨 3 点自动清理过期数据，回收磁盘空间
- 🎯 **隐蔽检测策略**: 69 个多样化问题 + 16 个 System Prompt，1104 种组合避免被识别为测试流量
- 💰 **成本优化**: 使用 TTFT（Time To First Token）测量，日均成本约 $0.75
- 🔌 **兼容性强**: 支持 OpenAI 官方 API 及任何兼容的第三方接口
- 👨‍👩‍👧 **家人友好**: 界面简洁易懂，无技术术语，适合非技术用户查看

## 项目结构

```
ai-model-monitor/
├── server/              # 后端服务
│   ├── index.js         # Express 主服务
│   ├── scheduler.js     # 定时任务调度器（含自动清理）
│   ├── checker.js       # 模型检测核心逻辑
│   ├── storage.js       # 数据持久化模块
│   ├── database.js      # SQLite 数据库模块
│   ├── migrate.js       # 数据迁移脚本（JSON → SQLite）
│   └── data/            # 运行时数据存储目录
│       └── status.db    # SQLite 数据库文件
├── public/              # 前端静态资源
│   ├── index.html       # 主页面
│   ├── css/
│   │   └── style.css    # 样式文件
│   └── js/
│       └── app.js       # 前端交互逻辑
├── .env.example         # 环境变量配置示例
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 文件并重命名为 `.env`，然后填入你的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# OpenAI API 密钥（必填）
OPENAI_API_KEY=your_api_key_here

# OpenAI API 基础 URL（必填）
# 如果使用第三方兼容接口（如 Azure OpenAI、自建代理等），修改此项
OPENAI_BASE_URL=https://api.openai.com/v1

# 检测间隔（分钟），默认 5 分钟
CHECK_INTERVAL_MINUTES=5

# HTTP 服务端口，默认 3000
PORT=3000

# 数据保留天数，默认 14 天
# 系统会在每天凌晨 3 点自动清理超过此天数的历史数据
DATA_RETENTION_DAYS=14
```

### 3. 数据迁移（如果有旧数据）

如果你之前使用 JSON 文件存储数据，运行迁移脚本：

```bash
node server/migrate.js
```

迁移完成后，旧的 `status.json` 会被重命名为 `status.json.backup`。

### 4. 启动服务

```bash
npm start
```

服务启动后，打开浏览器访问：

- **监控主页**: `http://localhost:3000`
- **API 接口**: `http://localhost:3000/api/status`

## 核心功能说明

### 数据库架构

#### SQLite 数据库结构

```sql
-- 批次表
CREATE TABLE batches (
  id TEXT PRIMARY KEY,           -- 批次 ID
  timestamp INTEGER NOT NULL     -- 检测时间戳
);

-- 检测结果表
CREATE TABLE results (
  batch_id TEXT NOT NULL,        -- 批次 ID
  model_id TEXT NOT NULL,        -- 模型 ID
  success INTEGER NOT NULL,      -- 是否成功 (0/1)
  latency INTEGER,               -- 响应延迟（毫秒）
  error TEXT,                    -- 错误信息
  timestamp INTEGER NOT NULL,    -- 时间戳
  PRIMARY KEY (batch_id, model_id)
);
```

**性能优化**:
- WAL 模式提升并发性能
- 时间戳索引加速查询和清理
- 模型索引快速获取历史数据

**自动清理机制**:
- 每天凌晨 3 点自动清理超过 `DATA_RETENTION_DAYS` 天的数据
- CASCADE DELETE 确保批次和结果同步删除
- 自动执行 VACUUM 回收磁盘空间

### 后端模块

#### `database.js` - SQLite 数据库核心
- 数据库连接管理和表结构初始化
- 提供批次和结果的 CRUD 操作
- 自动清理过期数据（cutoff 时间戳）
- 数据库统计信息查询

#### `checker.js` - 模型检测核心
- 调用 OpenAI API 的 `/v1/models` 接口动态获取可用模型列表
- **测试问题池**: 69 个多样化问题（中英文、数学、表情符号等 8 大类）
- **System Prompt 池**: 16 个随机 Prompt（复读、简短回复、简洁风格三种策略）
- **总组合数**: 1104 种，极难被识别为测试流量
- **TTFT 测量**: 使用流式响应，只等待第一个 token，立即断开连接
- **随机延迟**: 每个模型检测之间加入 0.5-2 秒的随机延迟
- 记录响应延迟、成功/失败状态和错误信息
- 支持自定义 `baseURL`，兼容任何 OpenAI API 兼容接口

#### `scheduler.js` - 定时任务调度器
- 默认每 5 分钟执行一次完整检测（可通过 `.env` 配置）
- 采用"完成后等待"模式，避免检测重叠
- 服务启动后立即执行第一次检测
- **自动清理任务**: 每天凌晨 3 点清理过期数据

#### `storage.js` - 数据持久化
- 适配 SQLite 数据库接口
- 批次对齐的时间轴结构
- 实时写入检测结果
- 提供统一的数据访问接口

#### `index.js` - Express 主服务
- 提供 `/api/status` 接口，返回所有模型的当前状态和统计数据
- 计算可用率、平均延迟等统计指标
- 托管前端静态资源

### 前端模块

#### `index.html` + `app.js` - 友好界面
- **顶部横幅**: 显示总体健康状态（全部正常/部分异常/全部离线）
- **统计卡片**: 总计、在线数、离线数、整体健康度
- **模型卡片**: 每个模型的详细状态
  - 在线/离线图标
  - 友好名称（自动转换技术名称）
  - 上次检测时间（相对时间，如"3 分钟前"）
  - 响应速度（毫秒）
  - 可用率百分比和可视化进度条
  - 错误信息（自动转换为易懂的描述）
- **自动刷新**: 每 30 秒自动调用 API 刷新数据

## 扩展指南

### 手动清理数据

如果需要立即清理数据（不等到凌晨 3 点），可以在 Node.js REPL 中执行：

```javascript
const { cleanupOldData } = require('./server/storage');

// 清理 14 天前的数据
cleanupOldData(14);

// 清理 7 天前的数据
cleanupOldData(7);
```

### 查看数据库统计

```javascript
const { getDatabaseStats } = require('./server/database');
console.log(getDatabaseStats());
// 输出: { batchCount: 288, resultCount: 14400, modelCount: 50, fileSizeKB: 1024 }
```

### 修改清理时间

编辑 `server/scheduler.js` 的 `scheduleNextCleanup()` 函数：

```javascript
// 修改这一行，将 3 改为你想要的小时数（0-23）
next.setHours(3, 0, 0, 0);  // 默认凌晨 3 点
```

### 使用第三方 OpenAI 兼容接口

本系统支持任何 OpenAI API 兼容的接口（如 Azure OpenAI、自建代理、第三方 API 等）。

只需在 `.env` 文件中修改 `OPENAI_BASE_URL`：

```env
# 示例：使用 Azure OpenAI
OPENAI_BASE_URL=https://your-resource-name.openai.azure.com/openai/deployments

# 示例：使用自建代理
OPENAI_BASE_URL=https://your-proxy.com/v1

# 示例：使用其他兼容服务
OPENAI_BASE_URL=https://api.example.com/v1
```

### 添加模型友好名称

如果想为动态获取的模型添加友好的中文名称，编辑 `public/js/app.js` 中的 `MODEL_FRIENDLY_NAMES` 对象：

```javascript
const MODEL_FRIENDLY_NAMES = {
  'your-model-id': '你的模型名称',
  // ... 添加更多映射
};
```

### 添加其他 AI 厂商的模型

如果需要监控非 OpenAI 兼容的 API（如 Anthropic Claude、Google Gemini 等），需要修改：

1. **修改 `checker.js`**:
   - 安装对应厂商的 SDK（如 `npm install @anthropic-ai/sdk`）
   - 修改 `getAvailableModels()` 函数以获取该厂商的模型列表
   - 修改 `checkModel()` 函数以调用该厂商的 API

2. **修改 `app.js`**:
   - 在 `MODEL_FRIENDLY_NAMES` 中添加新模型的友好名称
   - 如需要，调整 `friendlyErrorMessage()` 函数以适配新厂商的错误格式

### 调整检测频率

编辑 `.env` 文件中的 `CHECK_INTERVAL_MINUTES` 参数：

```env
# 每 10 分钟检测一次
CHECK_INTERVAL_MINUTES=10
```

### 修改数据保留天数

编辑 `.env` 文件中的 `DATA_RETENTION_DAYS` 参数：

```env
# 保留最近 30 天的历史记录
DATA_RETENTION_DAYS=30
```

## API 接口

### GET /api/status

返回所有模型的当前状态和统计数据。

**完整地址**: `http://localhost:3000/api/status`

**响应示例**:

```json
{
  "success": true,
  "data": {
    "lastUpdate": 1719123456789,
    "summary": {
      "total": 13,
      "online": 12,
      "offline": 1,
      "overallHealth": 92.31
    },
    "models": [
      {
        "id": "gpt-4",
        "isOnline": true,
        "lastCheck": 1719123456789,
        "latency": 1234,
        "availabilityRate": 98.5,
        "error": null
      }
    ]
  }
}
```

## 注意事项

- **API 费用**: 虽然使用 TTFT 测量大幅降低了成本（预计每天约 $0.75），但频繁调用仍会产生费用。建议根据实际需求调整检测间隔。
- **速率限制**: OpenAI API 有速率限制，如果模型数量较多，建议适当增加检测间隔。
- **环境变量**: 请勿将 `.env` 文件提交到版本控制系统，以保护你的 API 密钥安全。
- **数据库备份**: 定期备份 `server/data/status.db` 文件，避免数据丢失。
- **动态模型列表**: 系统会自动获取 API 提供的所有模型，包括一些不支持聊天完成的模型（如 embedding、whisper 等），这些模型使用专用 API 检测。

## 性能对比

| 指标 | JSON 文件 | SQLite | 提升 |
|------|-----------|--------|------|
| 读取延迟 | ~50ms | ~5ms | **10x** |
| 并发能力 | ~10 req/s | ~1000 req/s | **100x** |
| 内存占用 | 不稳定 | 稳定 (~50MB) | - |
| 数据完整性 | 无保证 | 事务保证 | ✅ |
| 清理效率 | O(n) | O(log n) | **100x** |

## 常见问题

### Q: 如何监控自建 API？
A: 修改 `.env` 中的 `OPENAI_BASE_URL` 为你的自建 API 地址即可。

### Q: 数据库文件越来越大怎么办？
A: 系统会每天凌晨 3 点自动清理超过 `DATA_RETENTION_DAYS` 天的数据，并执行 VACUUM 回收磁盘空间。

### Q: 如何修改清理时间？
A: 编辑 `server/scheduler.js` 的 `scheduleNextCleanup()` 函数，修改 `next.setHours(3, 0, 0, 0)` 中的小时数。

### Q: 检测频率过高会被封号吗？
A: 本系统使用了多样化问题（69 个）和随机 System Prompt（16 个），共 1104 种组合，避免被识别为测试流量。建议检测间隔设置为 5 分钟以上。

### Q: 如何从 JSON 文件迁移到 SQLite？
A: 运行 `node server/migrate.js` 即可自动迁移，旧文件会被重命名为 `status.json.backup`。

## 许可证

MIT License
