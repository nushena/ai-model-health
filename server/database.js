/**
 * SQLite 数据库模块
 * 负责数据库初始化、表结构创建、数据清理
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'status.db');

let db = null;

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * 初始化数据库连接和表结构
 */
function initDatabase() {
  ensureDataDir();

  // 创建数据库连接
  db = new Database(DB_FILE);

  // 启用 WAL 模式（Write-Ahead Logging）提升并发性能
  db.pragma('journal_mode = WAL');

  // 创建批次表
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL
    )
  `);

  // 创建时间戳索引（用于快速查询和清理）
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_batches_timestamp
    ON batches(timestamp)
  `);

  // 创建检测结果表
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      batch_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      success INTEGER NOT NULL,
      latency INTEGER,
      error TEXT,
      timestamp INTEGER NOT NULL,
      PRIMARY KEY (batch_id, model_id),
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    )
  `);

  // 创建模型索引（用于按模型查询历史）
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_results_model_timestamp
    ON results(model_id, timestamp)
  `);

  console.log('数据库初始化完成');
}

/**
 * 获取数据库实例
 * @returns {Database} 数据库实例
 */
function getDatabase() {
  if (!db) {
    initDatabase();
  }
  return db;
}

/**
 * 创建新批次
 * @param {string} batchId - 批次 ID
 * @param {number} timestamp - 时间戳
 */
function createBatch(batchId, timestamp) {
  const db = getDatabase();
  const stmt = db.prepare('INSERT INTO batches (id, timestamp) VALUES (?, ?)');
  stmt.run(batchId, timestamp);
}

/**
 * 插入或更新检测结果
 * @param {string} batchId - 批次 ID
 * @param {string} modelId - 模型 ID
 * @param {Object} result - 检测结果
 */
function upsertResult(batchId, modelId, result) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO results (batch_id, model_id, success, latency, error, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(batch_id, model_id)
    DO UPDATE SET
      success = excluded.success,
      latency = excluded.latency,
      error = excluded.error,
      timestamp = excluded.timestamp
  `);

  stmt.run(
    batchId,
    modelId,
    result.success ? 1 : 0,
    result.latency || null,
    result.error || null,
    result.timestamp
  );
}

/**
 * 获取所有批次（按时间正序）
 * @returns {Array} 批次列表
 */
function getAllBatches() {
  const db = getDatabase();
  const stmt = db.prepare('SELECT id, timestamp FROM batches ORDER BY timestamp ASC');
  return stmt.all();
}

/**
 * 获取指定批次的所有模型 ID
 * @param {string} batchId - 批次 ID
 * @returns {Array} 模型 ID 列表
 */
function getModelIdsByBatch(batchId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT DISTINCT model_id FROM results WHERE batch_id = ?');
  return stmt.all(batchId).map(row => row.model_id);
}

/**
 * 获取指定模型的所有检测结果（按时间正序）
 * @param {string} modelId - 模型 ID
 * @returns {Array} 检测结果列表
 */
function getResultsByModel(modelId) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT batch_id, success, latency, error, timestamp
    FROM results
    WHERE model_id = ?
    ORDER BY timestamp ASC
  `);
  return stmt.all(modelId);
}

/**
 * 获取所有唯一的模型 ID
 * @returns {Array} 模型 ID 列表
 */
function getAllModelIds() {
  const db = getDatabase();
  const stmt = db.prepare('SELECT DISTINCT model_id FROM results ORDER BY model_id ASC');
  return stmt.all().map(row => row.model_id);
}

/**
 * 获取指定模型在指定批次的检测结果
 * @param {string} modelId - 模型 ID
 * @param {string} batchId - 批次 ID
 * @returns {Object|null} 检测结果
 */
function getResult(modelId, batchId) {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT success, latency, error, timestamp
    FROM results
    WHERE model_id = ? AND batch_id = ?
  `);
  return stmt.get(modelId, batchId);
}

/**
 * 清理指定时间之前的旧数据
 * @param {number} cutoffTimestamp - 截止时间戳
 * @returns {Object} 清理统计 { deletedBatches, deletedResults }
 */
function cleanupOldData(cutoffTimestamp) {
  const db = getDatabase();

  // 开启事务（确保批次和结果同步删除）
  const transaction = db.transaction(() => {
    // 删除旧批次（外键级联会自动删除关联的 results）
    const deleteBatches = db.prepare('DELETE FROM batches WHERE timestamp < ?');
    const batchInfo = deleteBatches.run(cutoffTimestamp);

    // 为了统计，也手动查询被删除的结果数
    const countResults = db.prepare('SELECT COUNT(*) as count FROM results WHERE timestamp < ?');
    const resultCount = countResults.get(cutoffTimestamp).count;

    return {
      deletedBatches: batchInfo.changes,
      deletedResults: resultCount
    };
  });

  const result = transaction();

  // 执行 VACUUM 回收磁盘空间（定期清理时运行）
  db.exec('VACUUM');

  return result;
}

/**
 * 获取数据库统计信息
 * @returns {Object} 统计信息
 */
function getDatabaseStats() {
  const db = getDatabase();

  const batchCount = db.prepare('SELECT COUNT(*) as count FROM batches').get().count;
  const resultCount = db.prepare('SELECT COUNT(*) as count FROM results').get().count;
  const modelCount = db.prepare('SELECT COUNT(DISTINCT model_id) as count FROM results').get().count;

  // 获取数据库文件大小
  const stats = fs.statSync(DB_FILE);
  const fileSizeKB = Math.round(stats.size / 1024);

  return {
    batchCount,
    resultCount,
    modelCount,
    fileSizeKB
  };
}

/**
 * 关闭数据库连接
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('数据库连接已关闭');
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  createBatch,
  upsertResult,
  getAllBatches,
  getModelIdsByBatch,
  getResultsByModel,
  getAllModelIds,
  getResult,
  cleanupOldData,
  getDatabaseStats,
  closeDatabase
};
