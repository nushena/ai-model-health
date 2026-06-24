/**
 * 数据迁移脚本
 * 将 status.json 的数据迁移到 SQLite 数据库
 * 运行方式: node server/migrate.js
 */

const fs = require('fs');
const path = require('path');
const db = require('./database');

const STATUS_FILE = path.join(__dirname, 'data', 'status.json');

function migrate() {
  console.log('开始数据迁移...');

  // 检查旧数据文件是否存在
  if (!fs.existsSync(STATUS_FILE)) {
    console.log('未找到 status.json 文件，无需迁移');
    return;
  }

  try {
    // 读取旧数据
    const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    console.log(`读取到 ${data.batches.length} 个批次，${Object.keys(data.models).length} 个模型`);

    // 初始化数据库
    db.initDatabase();

    let batchCount = 0;
    let resultCount = 0;

    // 迁移批次
    data.batches.forEach(batch => {
      db.createBatch(batch.id, batch.timestamp);
      batchCount++;
    });

    // 迁移模型结果
    Object.keys(data.models).forEach(modelId => {
      const model = data.models[modelId];

      Object.keys(model.results).forEach(batchId => {
        const result = model.results[batchId];

        db.upsertResult(batchId, modelId, {
          success: result.success,
          latency: result.latency,
          error: result.error,
          timestamp: result.timestamp
        });

        resultCount++;
      });
    });

    console.log(`迁移完成: ${batchCount} 个批次，${resultCount} 条检测记录`);

    // 备份旧文件
    const backupFile = STATUS_FILE + '.backup';
    fs.renameSync(STATUS_FILE, backupFile);
    console.log(`旧数据已备份到: ${backupFile}`);

  } catch (error) {
    console.error('迁移失败:', error.message);
    process.exit(1);
  }
}

// 执行迁移
migrate();
