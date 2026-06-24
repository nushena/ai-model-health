/**
 * 模型检测核心逻辑
 * 负责调用 OpenAI API 检测模型可用性
 */

const OpenAI = require('openai');

// 初始化 OpenAI 客户端
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  defaultHeaders: {
    'User-Agent': 'Claude-Code/2.1.159 (Windows NT 10.0; Node.js)'
  }
});

// 测试问题池（多样化的正常问题，避免被识别为无意义测试）
const TEST_QUESTIONS = [
  // 英文单词/短语
  'who', 'hello', 'what time', 'hi there', 'ok', 'yes', 'thanks', 'good',

  // 中文日常问候
  '天气', '自我介绍', '今天星期几', '你好', '介绍一下', '早上好',
  '现在几点', '帮忙', '谢谢', '在吗', '晚安', '午安', '怎么样',

  // 中文常见问题
  '推荐', '建议', '帮我看看', '可以吗', '行不行', '说说', '讲讲',
  '解释下', '咋办', '怎么做', '哪个好', '选哪个',

  // 英文常见问题
  'why', 'how', 'when', 'where', 'which one', 'tell me', 'show me',
  'explain', 'help me', 'any ideas', 'what about', 'can you',

  // 简单数学问题
  '1+1', '2*3', '5-2', '10-3', '4+5',

  // 日常话题
  '电影', '音乐', '书', '游戏', '美食', '旅游', '运动',

  // 表情符号（部分模型支持）
  '👋', '🌤️', '🤔', '😊', '👍', '🎉', '💡', '❓'
];

// System Prompt 池（随机选择，增加多样性）
const SYSTEM_PROMPTS = [
  // 复读类（中英文）
  '你必须原样重复用户说的话，不要添加任何其他内容。',
  'Repeat exactly what the user says, nothing more.',
  '请直接复述用户的输入。',
  'Echo back the user input directly.',

  // 简短回复类（中英文）
  '请简短回答用户的问题，不超过 5 个字。',
  'Answer briefly in 5 words or less.',
  '用最少的字回复。',
  'Reply with minimal words.',
  '一句话回答即可。',
  'Answer in one short sentence.',

  // 简洁风格类（中英文）
  '用最简洁的方式回复用户。',
  'Reply to the user as concisely as possible.',
  '简洁明了地回复。',
  'Be concise and clear.',
  '直截了当地回答。',
  'Answer directly and briefly.'
];

/**
 * 获取随机延迟时间（0.5-2 秒）
 * @returns {number} 延迟毫秒数
 */
function getRandomDelay() {
  return Math.floor(Math.random() * 1500) + 500; // 500-2000ms
}

/**
 * 从问题池中随机选择一个测试问题
 * @returns {string} 随机选中的测试问题
 */
function getRandomTestQuestion() {
  return TEST_QUESTIONS[Math.floor(Math.random() * TEST_QUESTIONS.length)];
}

/**
 * 从 System Prompt 池中随机选择一个
 * @returns {string} 随机选中的 System Prompt
 */
function getRandomSystemPrompt() {
  return SYSTEM_PROMPTS[Math.floor(Math.random() * SYSTEM_PROMPTS.length)];
}

/**
 * 获取可用的模型列表
 * @returns {Promise<Array>} 模型 ID 数组
 */
async function getAvailableModels() {
  try {
    // 调用 OpenAI API 获取模型列表
    const response = await client.models.list();

    // 提取所有模型的 ID 并按字母数字顺序排序
    const models = response.data
      .map(model => model.id)
      .sort((a, b) => {
        // 自然排序（A-Z, 0-9）
        return a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

    console.log(`从 API 获取到 ${models.length} 个模型`);
    return models;
  } catch (error) {
    console.error('获取模型列表失败:', error.message);
    return [];
  }
}

/**
 * 检测单个模型的可用性
 * @param {string} modelId - 模型 ID
 * @returns {Promise<Object>} 检测结果 { success, latency, error, timestamp }
 */
async function checkModel(modelId) {
  const startTime = Date.now();
  const testQuestion = getRandomTestQuestion();
  const systemPrompt = getRandomSystemPrompt();

  try {
    // 设置 30 秒超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('请求超时（30秒）')), 30000);
    });

    let requestPromise;

    // 针对不同类型的模型使用不同的检测策略
    if (modelId.includes('embedding') || modelId.includes('ada')) {
      // Embedding 模型：使用轻量的 embeddings API
      requestPromise = client.embeddings.create({
        model: modelId,
        input: testQuestion
      });
    } else {
      // Chat 模型：使用随机 system prompt + 流式响应
      requestPromise = (async () => {
        const stream = await client.chat.completions.create({
          model: modelId,
          max_tokens: 10,  // 给足够空间回复（中文可能需要多个 token）
          temperature: 0,
          stream: true,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: testQuestion
            }
          ]
        });

        // 只等待第一个有内容的 chunk（TTFT）
        for await (const chunk of stream) {
          if (chunk.choices?.[0]?.delta?.content) {
            // 收到第一个内容 token，证明模型在线，立即返回
            return chunk;
          }
        }
      })();
    }

    // 使用 Promise.race 实现超时控制
    await Promise.race([requestPromise, timeoutPromise]);

    const latency = Date.now() - startTime;

    return {
      success: true,
      latency: latency,
      error: null,
      timestamp: Date.now(),
      testQuestion: testQuestion,
      systemPrompt: systemPrompt
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      success: false,
      latency: latency,
      error: error.message,
      timestamp: Date.now(),
      testQuestion: testQuestion,
      systemPrompt: systemPrompt
    };
  }
}

/**
 * 添加随机延迟（避免请求过于规律）
 * @returns {Promise<void>}
 */
function randomDelay() {
  const delay = getRandomDelay();
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 检测所有模型
 * @param {Function} onProgress - 每检测完一个模型的回调函数
 * @returns {Promise<Array>} 所有模型的检测结果数组
 */
async function checkAllModels(onProgress) {
  const models = await getAvailableModels();
  const results = [];

  console.log(`开始检测 ${models.length} 个模型...`);

  for (const modelId of models) {
    console.log(`正在检测: ${modelId}`);
    const result = await checkModel(modelId);
    const fullResult = {
      modelId,
      ...result
    };
    results.push(fullResult);

    // 实时回调，让调用者可以立即处理结果
    if (onProgress) {
      onProgress(fullResult);
    }

    // 在每个模型检测之间加入随机延迟
    if (models.indexOf(modelId) < models.length - 1) {
      await randomDelay();
    }
  }

  console.log('所有模型检测完成');
  return results;
}

module.exports = {
  getAvailableModels,
  checkModel,
  checkAllModels
};
