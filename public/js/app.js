/**
 * 前端交互逻辑
 * 负责从后端获取数据并更新页面显示
 */

// ==================== 主题切换功能 ====================
const THEME_MODES = {
  AUTO: 'auto',
  LIGHT: 'light',
  DARK: 'dark'
};

const THEME_TEXTS = {
  auto: '自动切换',
  light: '白天模式',
  dark: '夜晚模式'
};

// 获取当前主题模式
function getCurrentThemeMode() {
  return localStorage.getItem('themeMode') || THEME_MODES.AUTO;
}

// 保存主题模式
function saveThemeMode(mode) {
  localStorage.setItem('themeMode', mode);
}

// 判断当前是否应该是白天（7:00-17:00）
function isDaytime() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 7 && hour < 17;
}

// 应用主题
function applyTheme(mode) {
  const html = document.documentElement;

  if (mode === THEME_MODES.AUTO) {
    // 自动模式：根据时间判断
    if (isDaytime()) {
      html.classList.add('light-mode');
    } else {
      html.classList.remove('light-mode');
    }
  } else if (mode === THEME_MODES.LIGHT) {
    // 强制白天模式
    html.classList.add('light-mode');
  } else {
    // 强制夜晚模式
    html.classList.remove('light-mode');
  }
}

// 切换到下一个主题模式
function toggleTheme() {
  const currentMode = getCurrentThemeMode();
  let nextMode;

  // 循环切换：自动 -> 白天 -> 夜晚 -> 自动
  if (currentMode === THEME_MODES.AUTO) {
    nextMode = THEME_MODES.LIGHT;
  } else if (currentMode === THEME_MODES.LIGHT) {
    nextMode = THEME_MODES.DARK;
  } else {
    nextMode = THEME_MODES.AUTO;
  }

  saveThemeMode(nextMode);
  applyTheme(nextMode);
  updateThemeButtonText(nextMode);
}

// 更新按钮文字
function updateThemeButtonText(mode) {
  const themeText = document.getElementById('theme-text');
  if (themeText) {
    themeText.textContent = THEME_TEXTS[mode];
  }
}

// 初始化主题
function initTheme() {
  const mode = getCurrentThemeMode();
  applyTheme(mode);
  updateThemeButtonText(mode);

  // 绑定按钮点击事件
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // 如果是自动模式，每分钟检查一次时间
  if (mode === THEME_MODES.AUTO) {
    setInterval(() => {
      if (getCurrentThemeMode() === THEME_MODES.AUTO) {
        applyTheme(THEME_MODES.AUTO);
      }
    }, 60000); // 每分钟检查一次
  }
}

// ==================== 模型监控功能 ====================

// 模型友好名称映射（将技术名称转换为易懂的别名）
// 由于模型是动态获取的，这里只为常见模型提供友好名称
// 未匹配的模型将直接显示原始 ID
const MODEL_FRIENDLY_NAMES = {
  // OpenAI GPT 系列
  'gpt-4': 'GPT-4',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'gpt-4-turbo-preview': 'GPT-4 Turbo（预览版）',
  'gpt-4-0125-preview': 'GPT-4 Turbo（0125）',
  'gpt-4-1106-preview': 'GPT-4 Turbo（1106）',
  'gpt-4-32k': 'GPT-4 32K',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
  'gpt-3.5-turbo-0125': 'GPT-3.5 Turbo（0125）',

  // OpenAI o1 系列
  'o1': 'O1',
  'o1-preview': 'O1（预览版）',
  'o1-mini': 'O1 Mini',

  // 其他常见模型
  'text-davinci-003': 'Davinci 003',
  'text-davinci-002': 'Davinci 002',
  'text-curie-001': 'Curie 001',
  'text-babbage-001': 'Babbage 001',
  'text-ada-001': 'Ada 001'
};

// 错误信息友好化转换
function friendlyErrorMessage(error) {
  if (!error) return '';

  if (error.includes('rate_limit') || error.includes('429')) {
    return '请求太频繁，稍后重试';
  }
  if (error.includes('authentication') || error.includes('401')) {
    return '身份验证失败';
  }
  if (error.includes('not_found') || error.includes('404')) {
    return '该助手暂时不可用';
  }
  if (error.includes('timeout') || error.includes('ETIMEDOUT') || error.includes('请求超时')) {
    return '连接超时';
  }
  if (error.includes('overloaded') || error.includes('529')) {
    return '服务器繁忙';
  }

  return '暂时连接不上';
}

// 格式化时间（转换为易读的相对时间）
function formatTime(timestamp) {
  if (!timestamp) return '从未检测';

  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds} 秒前`;
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return `${days} 天前`;
}

// 格式化为具体时间（24小时制 HH:MM）
function formatTimeExact(timestamp) {
  if (!timestamp) return '--:--';

  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

// 更新顶部横幅
function updateBanner(summary) {
  const banner = document.getElementById('overall-banner');

  if (summary.total === 0) {
    banner.style.display = 'inline-flex';
    banner.className = 'banner banner-loading';
    banner.innerHTML = '<span class="banner-icon">⏳</span><span class="banner-text">正在初始化...</span>';
    return;
  }

  if (summary.online === summary.total) {
    banner.style.display = 'inline-flex';
    banner.className = 'banner banner-success';
    banner.innerHTML = '<span class="banner-icon">✅</span><span class="banner-text">AI 助手运行正常</span>';
  } else if (summary.online === 0) {
    banner.style.display = 'inline-flex';
    banner.className = 'banner banner-error';
    banner.innerHTML = '<span class="banner-icon">❌</span><span class="banner-text">所有助手暂时无法连接</span>';
  } else {
    // 部分离线时不显示横幅
    banner.style.display = 'none';
  }
}

// 更新统计数据
function updateStats(summary) {
  document.getElementById('stat-total').textContent = summary.total;
  document.getElementById('stat-online').textContent = summary.online;
  document.getElementById('stat-offline').textContent = summary.offline;
  document.getElementById('stat-health').textContent = `${summary.overallHealth}%`;
}

// 创建历史请求可视化（按批次对齐）
function createHistoryBars(history) {
  // 根据屏幕宽度动态决定显示数量
  const isMobile = window.innerWidth <= 768;
  const maxBars = isMobile ? 20 : 50;

  const bars = [];

  if (!history || history.length === 0) {
    // 没有历史数据，显示灰色条
    for (let i = 0; i < maxBars; i++) {
      bars.push('<div class="history-bar empty"></div>');
    }
  } else {
    // 如果历史记录少于 maxBars，用灰色填充
    const emptyBars = Math.max(0, maxBars - history.length);
    for (let i = 0; i < emptyBars; i++) {
      bars.push('<div class="history-bar empty"></div>');
    }

    // 只显示最近的 maxBars 条记录
    const recentHistory = history.slice(-maxBars);
    recentHistory.forEach(record => {
      if (record.status === 'offline') {
        // 离线状态：模型不在该批次列表中
        const timeText = formatTimeExact(record.timestamp);
        const tooltip = `未检测 | ${timeText} | 模型已离线`;
        bars.push(`<div class="history-bar offline" data-tooltip="${tooltip}"></div>`);
      } else if (record.status === 'pending') {
        // 等待检测状态：批次未完成
        const timeText = formatTimeExact(record.timestamp);
        const tooltip = `等待检测 | ${timeText}`;
        bars.push(`<div class="history-bar empty" data-tooltip="${tooltip}"></div>`);
      } else if (record.status === 'success') {
        // 成功状态
        const timeText = formatTimeExact(record.timestamp);
        const latencyText = record.latency ? `${record.latency}ms` : '-';
        const tooltip = `✓ 成功 | ${timeText} | ${latencyText}`;
        bars.push(`<div class="history-bar success" data-tooltip="${tooltip}"></div>`);
      } else if (record.status === 'failed') {
        // 失败状态
        const timeText = formatTimeExact(record.timestamp);
        const errorText = friendlyErrorMessage(record.error);
        const tooltip = `✗ 失败 | ${timeText} | ${errorText}`;
        bars.push(`<div class="history-bar error" data-tooltip="${tooltip}"></div>`);
      } else {
        // 兼容旧数据格式
        bars.push('<div class="history-bar empty"></div>');
      }
    });
  }

  return bars.join('');
}

// 创建模型卡片
function createModelCard(model) {
  const card = document.createElement('div');
  card.className = 'model-card';

  const friendlyName = MODEL_FRIENDLY_NAMES[model.id] || model.id;

  let availabilityClass = 'availability-low';
  if (model.availabilityRate >= 90) availabilityClass = 'availability-high';
  else if (model.availabilityRate >= 70) availabilityClass = 'availability-medium';

  // 计算请求总数和错误数（从 API 返回的统计数据）
  const requestCount = model.requestCount || 0;
  const errorCount = model.errorCount || 0;
  const successCount = model.successCount || 0;

  let errorHtml = '';
  // 不再显示错误提示信息
  // if (!model.isOnline && model.error) {
  //   errorHtml = `
  //     <div class="model-error">
  //       ${friendlyErrorMessage(model.error)}
  //     </div>
  //   `;
  // }

  card.innerHTML = `
    <div class="model-header">
      <div class="model-title">
        <div class="model-name">${friendlyName}</div>
        <div class="availability-indicator ${availabilityClass}">
          ${model.availabilityRate}%
        </div>
      </div>
      <div class="model-stats">
        <div class="model-stat">
          <div class="model-stat-label">成功率</div>
          <div class="model-stat-value">${model.availabilityRate}%</div>
        </div>
        <div class="model-stat">
          <div class="model-stat-label">延迟</div>
          <div class="model-stat-value">${model.isOnline && model.latency ? model.latency : 0} ms</div>
        </div>
        <div class="model-stat">
          <div class="model-stat-label">平均延迟</div>
          <div class="model-stat-value">${model.avgLatency || 0} ms</div>
        </div>
        <div class="model-stat">
          <div class="model-stat-label">上次检测</div>
          <div class="model-stat-value">${formatTime(model.lastCheck)}</div>
        </div>
      </div>
    </div>
    <div class="model-history">
      ${createHistoryBars(model.history)}
    </div>
    ${errorHtml}
  `;

  return card;
}

// 更新模型列表
function updateModels(models) {
  const list = document.getElementById('models-list');
  list.innerHTML = '';

  if (models.length === 0) {
    list.innerHTML = '<p style="text-align: center; color: #9ca3af;">暂无数据</p>';
    return;
  }

  // 按在线状态和可用率排序
  models.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return b.isOnline - a.isOnline;
    return b.availabilityRate - a.availabilityRate;
  });

  models.forEach(model => {
    const card = createModelCard(model);
    list.appendChild(card);
  });
}

// 更新最后更新时间
function updateLastUpdateTime(timestamp) {
  const lastUpdate = document.getElementById('last-update');
  if (timestamp) {
    lastUpdate.textContent = `最后更新: ${formatTime(timestamp)}`;
  } else {
    lastUpdate.textContent = '最后更新: --';
  }
}

// 从后端获取状态数据
async function fetchStatus() {
  try {
    const response = await fetch('/api/status');
    const result = await response.json();

    if (result.success) {
      updateBanner(result.data.summary);
      updateStats(result.data.summary);
      updateModels(result.data.models);
      updateLastUpdateTime(result.data.lastUpdate);
    } else {
      console.error('获取状态失败:', result.error);
    }
  } catch (error) {
    console.error('请求失败:', error);

    // 显示错误横幅
    const banner = document.getElementById('overall-banner');
    banner.className = 'banner banner-error';
    banner.innerHTML = '<span class="banner-icon">❌</span><span class="banner-text">无法连接到监控服务</span>';
  }
}

// 页面加载完成后立即执行一次
document.addEventListener('DOMContentLoaded', () => {
  // 初始化主题
  initTheme();

  // 获取状态数据
  fetchStatus();

  // 每 30 秒自动刷新一次
  setInterval(fetchStatus, 30000);
});
