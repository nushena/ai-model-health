/**
 * 数据持久化模块
 * 负责读写 status.json 文件，存储模型检测结果
 * 使用批次（batch）对齐的时间轴结构
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * 读取状态数据
 * @returns {Object} 包含批次列表和模型数据的对象
 */
function readStatus() {
  ensureDataDir();

  if (!fs.existsSync(STATUS_FILE)) {
    return {
      lastUpdate: null,
      batches: [],      // 批次列表 [{id, timestamp, modelIds}]
      models: {}        // 模型数据 {modelId: {id, results: {batchId: {success, latency, error}}}}
    };
  }

  try {
    const data = fs.readFileSync(STATUS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取状态文件失败:', error.message);
    return {
      lastUpdate: null,
      batches: [],
      models: {}
    };
  }
}

/**
 * 写入状态数据
 * @param {Object} data - 要保存的数据对象
 */
function writeStatus(data) {
  ensureDataDir();

  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('写入状态文件失败:', error.message);
  }
}

/**
 * 创建新批次
 * @param {Array} modelIds - 本批次要检测的模型 ID 列表
 * @returns {string} 批次 ID
 */
function createBatch(modelIds) {
  const data = readStatus();
  const batchId = `batch-${Date.now()}`;
  const timestamp = Date.now();

  // 添加新批次
  data.batches.push({
    id: batchId,
    timestamp: timestamp,
    modelIds: modelIds
  });

  // 清理过期批次（保留最近 N 小时）
  const historyHours = parseInt(process.env.HISTORY_HOURS) || 24;
  const cutoffTime = Date.now() - historyHours * 60 * 60 * 1000;
  data.batches = data.batches.filter(batch => batch.timestamp > cutoffTime);

  // 初始化本批次的所有模型（如果还不存在）
  modelIds.forEach(modelId => {
    if (!data.models[modelId]) {
      data.models[modelId] = {
        id: modelId,
        results: {}
      };
    }
  });

  data.lastUpdate = timestamp;
  writeStatus(data);

  return batchId;
}

/**
 * 更新单个模型在特定批次的检测结果
 * @param {string} batchId - 批次 ID
 * @param {string} modelId - 模型 ID
 * @param {Object} result - 检测结果 { success, latency, error, timestamp }
 */
function updateModelResult(batchId, modelId, result) {
  const data = readStatus();

  // 确保批次存在，如果不存在则创建
  let batch = data.batches.find(b => b.id === batchId);
  if (!batch) {
    batch = {
      id: batchId,
      timestamp: result.timestamp,
      modelIds: []
    };
    data.batches.push(batch);
  }

  // 将模型添加到批次的模型列表（如果还没有）
  if (!batch.modelIds.includes(modelId)) {
    batch.modelIds.push(modelId);
  }

  // 确保模型存在
  if (!data.models[modelId]) {
    data.models[modelId] = {
      id: modelId,
      results: {}
    };
  }

  // 存储本批次的检测结果
  data.models[modelId].results[batchId] = {
    success: result.success,
    latency: result.latency,
    error: result.error || null,
    timestamp: result.timestamp
  };

  data.lastUpdate = Date.now();
  writeStatus(data);
}

/**
 * 获取所有模型的当前状态
 * @returns {Object} 包含批次和模型状态的对象
 */
function getAllStatus() {
  return readStatus();
}

module.exports = {
  createBatch,
  updateModelResult,
  getAllStatus
};
