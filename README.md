# AI 模型健康监控系统

一个轻量级的 AI 模型健康监控系统，用于实时监控 OpenAI API 兼容接口的模型可用性和响应速度。

## 功能特点

- 🔄 **自动定时检测**: 每 5 分钟（可配置）自动检测所有模型状态
- 🌐 **动态模型列表**: 通过 API 自动获取可用模型，无需手动配置
- 📊 **实时数据展示**: 友好的 Web 界面，实时显示模型在线状态、响应延迟和可用率
- 💾 **历史数据记录**: 保留最近 24 小时的检测历史，计算可用率统计
- 🎯 **智能请求策略**: 随机消息池 + 随机延迟，避免被识别为固定模式的机器人
- 🔌 **兼容性强**: 支持 OpenAI 官方 API 及任何兼容的第三方接口
- 👨‍👩‍👧 **家人友好**: 界面简洁易懂，无技术术语，适合非技术用户查看

## 项目结构

```
公益站模型监控/
├── server/              # 后端服务
│   ├── index.js         # Express 主服务
│   ├── scheduler.js     # 定时任务调度器
│   ├── checker.js       # 模型检测核心逻辑
│   ├── storage.js       # 数据持久化模块
│   └── data/            # 运行时数据存储目录
│       └── status.json  # 检测结果文件
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

复制 `.env.example` 文件并重命名为 `.env`，然后填入你的 Anthropic API 密钥：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# OpenAI API 密钥（必填）
OPENAI_API_KEY=your_api_key_here

# OpenAI API 基础 URL（可选，默认为官方接口）
# 如果使用第三方兼容接口（如 Azure OpenAI、自建代理等），修改此项
OPENAI_BASE_URL=https://api.openai.com/v1

# 检测间隔（分钟），默认 5 分钟
CHECK_INTERVAL_MINUTES=5

# HTTP 服务端口，默认 3000
PORT=3000

# 保留历史记录的小时数，默认 24 小时
HISTORY_HOURS=24
```

### 3. 启动服务

```bash
npm start
```

服务启动后，打开浏览器访问以下地址：

- **监控主页**: `http://localhost:3000`
- **API 接口测试**: `http://localhost:3000/api/status`

如果修改了端口号（在 `.env` 中配置），请将 `3000` 替换为你设置的端口号。

## 核心功能说明

### 后端模块

#### `checker.js` - 模型检测核心
- 调用 OpenAI API 的 `/v1/models` 接口动态获取可用模型列表
- 维护一个包含 8 条极短消息的测试消息池（"hi"、"ok"、"1+1=?"、"测试"等）
- 每次检测随机选择一条消息，设置 `max_tokens` 为 1-5（最小化 token 消耗）
- 每个模型检测之间加入 1-5 秒的随机延迟，避免被识别为固定模式
- 记录响应延迟、成功/失败状态和错误信息
- 支持自定义 `baseURL`，兼容任何 OpenAI API 兼容接口

#### `scheduler.js` - 定时任务调度器
- 使用 `node-cron` 实现定时任务
- 默认每 5 分钟执行一次完整检测（可通过 `.env` 配置）
- 服务启动后立即执行一次检测

#### `storage.js` - 数据持久化
- 将检测结果保存到 `server/data/status.json`
- 保留最近 N 小时的历史记录（默认 24 小时）
- 自动计算每个模型的可用率（成功次数 / 总检测次数）

#### `index.js` - Express 主服务
- 提供 `/api/status` 接口，返回所有模型的当前状态和统计数据
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

### 修改历史记录保留时长

编辑 `.env` 文件中的 `HISTORY_HOURS` 参数：

```env
# 保留最近 48 小时的历史记录
HISTORY_HOURS=48
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

- **API 费用**: 虽然每次检测使用的 token 极少（1-5 tokens），但频繁调用仍会产生费用。建议根据实际需求调整检测间隔。
- **速率限制**: OpenAI API 有速率限制，如果模型数量较多，建议适当增加检测间隔或增大随机延迟范围。
- **环境变量**: 请勿将 `.env` 文件提交到版本控制系统，以保护你的 API 密钥安全。
- **动态模型列表**: 系统会自动获取 API 提供的所有模型，包括一些不支持聊天完成的模型（如 embedding、whisper 等），这些模型的检测可能会失败，这是正常现象。

## 许可证

MIT License
