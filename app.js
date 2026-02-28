const STORAGE_KEY = "laoHuTaskListV1";
const SYNC_KEY = "laoHuTaskListSyncV1";

const state = {
  tasks: [],
  archivedTasks: [],
  editingId: null,
  syncToken: null // 用于 GitHub 同步
};

// 初始化
async function init() {
  loadFromStorage();
  await syncFromCloud(); // 从云端同步
  renderAll();
  bindEvents();
  
  // 定期同步（每5分钟）
  setInterval(syncToCloud, 5 * 60 * 1000);
}

// 加载本地数据
function loadFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data) {
      state.tasks = data.tasks || [];
      state.archivedTasks = data.archivedTasks || [];
      state.syncToken = data.syncToken;
    }
  } catch (e) {
    console.error('加载数据失败', e);
  }
}

// 保存到本地
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    tasks: state.tasks,
    archivedTasks: state.archivedTasks,
    syncToken: state.syncToken,
    lastSync: new Date().toISOString()
  }));
}

// 从云端同步
async function syncFromCloud() {
  try {
    // 使用 GitHub Gist 同步
    const gistId = await getOrCreateGist();
    if (!gistId) return;
    
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${getGitHubToken()}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.ok) {
      const gist = await response.json();
      const cloudData = JSON.parse(gist.files['todo-data.json'].content);
      
      // 合并数据（云端优先）
      if (cloudData && cloudData.lastSync > (localStorage.getItem('lastSync') || '0')) {
        state.tasks = cloudData.tasks || [];
        state.archivedTasks = cloudData.archivedTasks || [];
        saveToStorage();
        renderAll();
        console.log('✅ 从云端同步成功');
      }
    }
  } catch (e) {
    console.log('云同步失败，使用本地数据', e);
  }
}

// 同步到云端
async function syncToCloud() {
  try {
    const gistId = await getOrCreateGist();
    if (!gistId) return;
    
    const data = {
      tasks: state.tasks,
      archivedTasks: state.archivedTasks,
      lastSync: new Date().toISOString()
    };
    
    await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${getGitHubToken()}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'todo-data.json': {
            content: JSON.stringify(data, null, 2)
          }
        }
      })
    });
    
    console.log('✅ 已同步到云端');
  } catch (e) {
    console.log('同步到云端失败', e);
  }
}

// 获取或创建 Gist
async function getOrCreateGist() {
  let gistId = localStorage.getItem('gistId');
  
  if (!gistId) {
    // 创建新 Gist
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${getGitHubToken()}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: '老胡任务清单数据',
        public: false,
        files: {
          'todo-data.json': {
            content: JSON.stringify({
              tasks: [],
              archivedTasks: [],
              lastSync: new Date().toISOString()
            }, null, 2)
          }
        }
      })
    });
    
    if (response.ok) {
      const gist = await response.json();
      gistId = gist.id;
      localStorage.setItem('gistId', gistId);
    }
  }
  
  return gistId;
}

// 获取 GitHub Token（需要用户配置）
function getGitHubToken() {
  // 从 localStorage 获取用户配置的 token
  return localStorage.getItem('githubToken') || '';
}

// 渲染所有
function renderAll() {
  renderStats();
  renderTaskList();
}

// 渲染统计
function renderStats() {
  const counts = { A1: 0, A2: 0, B1: 0, C: 0 };
  state.tasks.filter(t => !t.completed).forEach(t => {
    if (counts[t.priority] !== undefined) {
      counts[t.priority]++;
    }
  });
  
  document.getElementById('stat-a1').textContent = counts.A1;
  document.getElementById('stat-a2').textContent = counts.A2;
  document.getElementById('stat-b1').textContent = counts.B1;
  document.getElementById('stat-c').textContent = counts.C;
}

// 渲染任务列表
function renderTaskList() {
  const taskList = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  
  const activeTasks = state.tasks.filter(t => !t.completed);
  
  if (activeTasks.length === 0) {
    taskList.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  // 按优先级排序
  const priorityOrder = { A1: 0, A2: 1, B1: 2, C: 3 };
  const sortedTasks = [...activeTasks].sort((a, b) => {
    return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
  });
  
  taskList.innerHTML = sortedTasks.map(task => `
    <div class="task-card ${task.priority.toLowerCase()}" data-id="${task.id}">
      <div class="task-header">
        <div class="task-info">
          <div class="task-name">${escapeHtml(task.name)}</div>
          <div class="task-meta">
            <span class="task-tag priority ${task.priority.toLowerCase()}">${task.priority}</span>
            <span class="task-tag type">${escapeHtml(task.type)}</span>
            ${task.deadline ? `<span class="task-deadline">📅 ${formatDate(task.deadline)}</span>` : ''}
          </div>
          ${task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button onclick="markAsCompleted('${task.id}')" style="background:#27ae60;color:white;border:none;">✓ 已执行</button>
        <button onclick="markAsNotCompleted('${task.id}')" style="background:#95a5a6;color:white;border:none;">○ 未执行</button>
        <button onclick="editTask('${task.id}')">编辑</button>
        <button onclick="deleteTask('${task.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

// 渲染归档列表
function renderArchiveList() {
  const archiveList = document.getElementById('archive-list');
  
  if (state.archivedTasks.length === 0) {
    archiveList.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">暂无归档任务</p>';
    return;
  }
  
  archiveList.innerHTML = state.archivedTasks.map(task => `
    <div class="archive-item">
      <div class="task-name">✅ ${escapeHtml(task.name)}</div>
      <div class="archive-id">归档编号: ${task.archiveId} | ${task.priority} | ${task.type} | ${formatDate(task.archivedAt)}</div>
    </div>
  `).join('');
}

// 工具函数
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${min}`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generateArchiveId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(state.archivedTasks.length + 1).padStart(3, '0');
  return `${y}${m}${d}${seq}`;
}

// 添加任务
function addTask(taskData) {
  state.tasks.push({
    id: generateId(),
    ...taskData,
    completed: false,
    status: '未执行',
    createdAt: new Date().toISOString()
  });
  saveToStorage();
  syncToCloud(); // 同步到云端
  renderAll();
}

// 更新任务
function updateTask(id, taskData) {
  const index = state.tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    state.tasks[index] = { ...state.tasks[index], ...taskData };
    saveToStorage();
    syncToCloud(); // 同步到云端
    renderAll();
  }
}

// 删除任务
function deleteTask(id) {
  if (confirm('确定要删除这个任务吗？')) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveToStorage();
    syncToCloud(); // 同步到云端
    renderAll();
  }
}

// 标记为已执行（自动归档）
function markAsCompleted(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.completed = true;
    task.status = '已执行';
    task.archiveId = generateArchiveId();
    task.archivedAt = new Date().toISOString();
    state.archivedTasks.unshift(task);
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveToStorage();
    syncToCloud(); // 同步到云端
    renderAll();
    alert('✅ 任务已完成并归档！');
  }
}

// 标记为未执行
function markAsNotCompleted(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.status = '未执行';
    task.completed = false;
    saveToStorage();
    syncToCloud(); // 同步到云端
    alert('⏳ 任务状态已更新为"未执行"');
  }
}

// 编辑任务
function editTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    state.editingId = id;
    document.getElementById('task-id').value = id;
    document.getElementById('task-name').value = task.name;
    document.getElementById('task-type').value = task.type;
    document.getElementById('task-priority').value = task.priority;
    document.getElementById('task-deadline').value = task.deadline || '';
    document.getElementById('task-note').value = task.note || '';
    document.getElementById('modal-title').textContent = '编辑任务';
    openModal();
  }
}

// 打开弹窗
function openModal() {
  document.getElementById('modal').classList.add('show');
}

// 关闭弹窗
function closeModal() {
  document.getElementById('modal').classList.remove('show');
  document.getElementById('task-form').reset();
  document.getElementById('task-id').value = '';
  document.getElementById('modal-title').textContent = '添加任务';
  state.editingId = null;
}

// 配置 GitHub Token
function configureSync() {
  const token = prompt('请输入您的 GitHub Personal Access Token（需要 gist 权限）：\n\n获取方式：\n1. 访问 https://github.com/settings/tokens\n2. 点击 "Generate new token (classic)"\n3. 勾选 "gist" 权限\n4. 生成并复制 token');
  
  if (token) {
    localStorage.setItem('githubToken', token);
    alert('✅ 配置成功！现在可以跨平台同步了');
    syncFromCloud();
  }
}

// 绑定事件
function bindEvents() {
  // 添加任务按钮
  document.getElementById('btn-add').addEventListener('click', () => {
    state.editingId = null;
    document.getElementById('modal-title').textContent = '添加任务';
    openModal();
  });
  
  // 归档按钮
  document.getElementById('btn-archive').addEventListener('click', () => {
    renderArchiveList();
    document.getElementById('archive-modal').classList.add('show');
  });
  
  // 关闭弹窗
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('archive-close').addEventListener('click', () => {
    document.getElementById('archive-modal').classList.remove('show');
  });
  
  // 表单提交
  document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const taskData = {
      name: document.getElementById('task-name').value.trim(),
      type: document.getElementById('task-type').value,
      priority: document.getElementById('task-priority').value,
      deadline: document.getElementById('task-deadline').value,
      note: document.getElementById('task-note').value.trim()
    };
    
    if (!taskData.name) {
      alert('请输入任务名称');
      return;
    }
    
    if (state.editingId) {
      updateTask(state.editingId, taskData);
    } else {
      addTask(taskData);
    }
    
    closeModal();
  });
  
  // 点击弹窗外部关闭
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
      closeModal();
    }
  });
  
  document.getElementById('archive-modal').addEventListener('click', (e) => {
    if (e.target.id === 'archive-modal') {
      document.getElementById('archive-modal').classList.remove('show');
    }
  });
}

// 启动
init();
