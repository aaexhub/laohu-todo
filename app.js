const STORAGE_KEY = "laoHuTaskListV1";

const state = {
  tasks: [],
  archivedTasks: [],
  editingId: null,
  gistId: null,
  githubToken: null
};

// 初始化
async function init() {
  loadFromStorage();
  
  if (state.githubToken) {
    await syncFromCloud();
  }
  
  renderAll();
  bindEvents();
  
  if (state.githubToken) {
    setInterval(() => {
      syncToCloud();
    }, 3 * 60 * 1000);
  }
}

function loadFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data) {
      state.tasks = data.tasks || [];
      state.archivedTasks = data.archivedTasks || [];
      state.gistId = data.gistId;
      state.githubToken = data.githubToken;
    }
  } catch (e) {
    console.error('加载数据失败', e);
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    tasks: state.tasks,
    archivedTasks: state.archivedTasks,
    gistId: state.gistId,
    githubToken: state.githubToken,
    lastUpdate: new Date().toISOString()
  }));
}

function renderAll() {
  renderStats();
  renderTaskList();
  updateSyncStatus();
}

function updateSyncStatus() {
  const syncBtn = document.getElementById('btn-sync');
  if (syncBtn) {
    if (state.githubToken) {
      syncBtn.textContent = '已连接';
      syncBtn.style.background = 'rgba(39, 174, 96, 0.3)';
    } else {
      syncBtn.textContent = '同步';
      syncBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    }
  }
}

async function syncFromCloud() {
  if (!state.githubToken) return;
  
  try {
    if (!state.gistId) {
      await createGist();
      if (!state.gistId) return;
    }
    
    const response = await fetch(\`https://api.github.com/gists/\${state.gistId}\`, {
      headers: {
        'Authorization': \`token \${state.githubToken}\`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.ok) {
      const gist = await response.json();
      const cloudData = JSON.parse(gist.files['laohu-todo-data.json'].content);
      
      const localUpdate = localStorage.getItem(STORAGE_KEY) ? 
        JSON.parse(localStorage.getItem(STORAGE_KEY)).lastUpdate : '1970-01-01';
      const cloudUpdate = cloudData.lastUpdate || '1970-01-01';
      
      if (cloudUpdate > localUpdate) {
        state.tasks = cloudData.tasks || [];
        state.archivedTasks = cloudData.archivedTasks || [];
        saveToStorage();
        renderAll();
        console.log('从云端同步成功');
      } else {
        await syncToCloud();
      }
    }
  } catch (e) {
    console.error('从云端同步失败', e);
  }
}

async function syncToCloud() {
  if (!state.githubToken || !state.gistId) return;
  
  try {
    const data = {
      tasks: state.tasks,
      archivedTasks: state.archivedTasks,
      lastUpdate: new Date().toISOString()
    };
    
    const response = await fetch(\`https://api.github.com/gists/\${state.gistId}\`, {
      method: 'PATCH',
      headers: {
        'Authorization': \`token \${state.githubToken}\`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'laohu-todo-data.json': {
            content: JSON.stringify(data, null, 2)
          }
        }
      })
    });
    
    if (response.ok) {
      console.log('已同步到云端');
    }
  } catch (e) {
    console.error('同步到云端失败', e);
  }
}

async function createGist() {
  try {
    const data = {
      tasks: state.tasks,
      archivedTasks: state.archivedTasks,
      lastUpdate: new Date().toISOString()
    };
    
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': \`token \${state.githubToken}\`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: '老胡任务清单数据（自动同步）',
        public: false,
        files: {
          'laohu-todo-data.json': {
            content: JSON.stringify(data, null, 2)
          }
        }
      })
    });
    
    if (response.ok) {
      const gist = await response.json();
      state.gistId = gist.id;
      saveToStorage();
      console.log('Gist 创建成功', state.gistId);
      return true;
    } else {
      const error = await response.json();
      alert('配置失败：' + (error.message || 'Token 权限不足或无效'));
      return false;
    }
  } catch (e) {
    alert('网络错误，请检查网络连接');
    return false;
  }
}

async function configureSync() {
  const hasToken = state.githubToken && state.githubToken.length > 0;
  
  let message = '';
  if (hasToken) {
    message = \`当前已配置 GitHub Token\n\n您的 Gist ID：\${state.gistId || '未创建'}\n\n1. 点击"确定"重新配置\n2. 点击"取消"保持不变\n\n如需在另一台设备同步，请使用相同的 Token 和 Gist ID\`;
  } else {
    message = \`请输入您的 GitHub Personal Access Token\n\n获取步骤：\n1. 访问 https://github.com/settings/tokens\n2. 点击 "Generate new token (classic)"\n3. 填写：\n   - Note: 老胡任务清单\n   - Expiration: No expiration\n   - 勾选 gist 权限\n4. 点击 "Generate token"\n5. 复制生成的 token（只显示一次）\`;
  }
  
  const token = prompt(message);
  
  if (token !== null) {
    if (token.trim() === '') {
      if (confirm('确定要清除 GitHub 同步配置吗？\n\n（本地数据不会丢失）')) {
        state.githubToken = null;
        state.gistId = null;
        saveToStorage();
        updateSyncStatus();
        alert('已清除同步配置');
      }
    } else {
      state.githubToken = token.trim();
      saveToStorage();
      
      const existingGistId = prompt(
        '请输入 Gist ID（可选）\n\n' +
        '如果这是第二台设备，请输入第一台设备显示的 Gist ID\n' +
        '如果是第一台设备，留空会自动创建新的\n\n' +
        'Gist ID 格式类似：abc123def456...'
      );
      
      if (existingGistId && existingGistId.trim()) {
        state.gistId = existingGistId.trim();
        saveToStorage();
        await syncFromCloud();
        alert('配置成功！\n\n已连接到现有数据，现在可以跨平台同步了');
        renderAll();
      } else {
        const success = await createGist();
        if (success) {
          alert(
            '配置成功！\n\n' +
            '您的 Gist ID 是：\n' + state.gistId + '\n\n' +
            '请保存这个 ID！\n' +
            '在其他设备上配置时输入相同的 Token 和这个 Gist ID 即可同步数据'
          );
        }
      }
      updateSyncStatus();
    }
  }
}

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
  
  const priorityOrder = { A1: 0, A2: 1, B1: 2, C: 3 };
  const sortedTasks = [...activeTasks].sort((a, b) => {
    return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
  });
  
  taskList.innerHTML = sortedTasks.map(task => \`
    <div class="task-card \${task.priority.toLowerCase()}" data-id="\${task.id}">
      <div class="task-header">
        <div class="task-info">
          <div class="task-name">\${escapeHtml(task.name)}</div>
          <div class="task-meta">
            <span class="task-tag priority \${task.priority.toLowerCase()}">\${task.priority}</span>
            <span class="task-tag type">\${escapeHtml(task.type)}</span>
            \${task.deadline ? \`<span class="task-deadline">日期: \${formatDate(task.deadline)}</span>\` : ''}
          </div>
          \${task.note ? \`<div class="task-note">\${escapeHtml(task.note)}</div>\` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button onclick="markAsCompleted('\${task.id}')" style="background:#27ae60;color:white;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;">已完成</button>
        <button onclick="markAsNotCompleted('\${task.id}')" style="background:#95a5a6;color:white;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;">未执行</button>
        <button onclick="editTask('\${task.id}')" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;cursor:pointer;background:white;">编辑</button>
        <button onclick="deleteTask('\${task.id}')" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;cursor:pointer;background:white;">删除</button>
      </div>
    </div>
  \`).join('');
}

function renderArchiveList() {
  const archiveList = document.getElementById('archive-list');
  
  if (state.archivedTasks.length === 0) {
    archiveList.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">暂无归档任务</p>';
    return;
  }
  
  archiveList.innerHTML = state.archivedTasks.map(task => \`
    <div class="archive-item">
      <div class="task-name">[完成] \${escapeHtml(task.name)}</div>
      <div class="archive-id">归档编号: \${task.archiveId} | \${task.priority} | \${task.type} | \${formatDate(task.archivedAt)}</div>
    </div>
  \`).join('');
}

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
  return \`\${month}/\${day} \${hour}:\${min}\`;
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
  return \`\${y}\${m}\${d}\${seq}\`;
}

// 按钮事件函数（全局）
function openAddTask() {
  state.editingId = null;
  document.getElementById('modal-title').textContent = '添加任务';
  openModal();
}

function openArchive() {
  renderArchiveList();
  document.getElementById('archive-modal').classList.add('show');
}

function openModal() {
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
  document.getElementById('task-form').reset();
  document.getElementById('task-id').value = '';
  document.getElementById('modal-title').textContent = '添加任务';
  state.editingId = null;
}

function closeArchive() {
  document.getElementById('archive-modal').classList.remove('show');
}

function addTask(taskData) {
  state.tasks.push({
    id: generateId(),
    ...taskData,
    completed: false,
    status: '未执行',
    createdAt: new Date().toISOString()
  });
  saveToStorage();
  syncToCloud();
  renderAll();
}

function updateTask(id, taskData) {
  const index = state.tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    state.tasks[index] = { ...state.tasks[index], ...taskData };
    saveToStorage();
    syncToCloud();
    renderAll();
  }
}

function deleteTask(id) {
  if (confirm('确定要删除这个任务吗？')) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveToStorage();
    syncToCloud();
    renderAll();
  }
}

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
    syncToCloud();
    renderAll();
    alert('任务已完成并归档！');
  }
}

function markAsNotCompleted(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.status = '未执行';
    task.completed = false;
    saveToStorage();
    syncToCloud();
    alert('任务状态已更新为"未执行"');
  }
}

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

function bindEvents() {
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
  
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
      closeModal();
    }
  });
  
  document.getElementById('archive-modal').addEventListener('click', (e) => {
    if (e.target.id === 'archive-modal') {
      closeArchive();
    }
  });
}

init();
