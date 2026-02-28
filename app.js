const STORAGE_KEY = "laoHuTaskListV1";

// 状态
const state = {
  tasks: [],
  archivedTasks: [],
  editingId: null
};

// 初始化
function init() {
  loadFromStorage();
  renderAll();
  bindEvents();
}

// 加载数据
function loadFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data) {
      state.tasks = data.tasks || [];
      state.archivedTasks = data.archivedTasks || [];
    }
  } catch (e) {
    console.error('加载数据失败', e);
  }
}

// 保存数据
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    tasks: state.tasks,
    archivedTasks: state.archivedTasks
  }));
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
        <div class="task-checkbox" onclick="toggleComplete('${task.id}')"></div>
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
      <div class="archive-id">归档编号: ${task.archiveId} | ${task.priority} | ${task.type}</div>
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
    createdAt: new Date().toISOString()
  });
  saveToStorage();
  renderAll();
}

// 更新任务
function updateTask(id, taskData) {
  const index = state.tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    state.tasks[index] = { ...state.tasks[index], ...taskData };
    saveToStorage();
    renderAll();
  }
}

// 删除任务
function deleteTask(id) {
  if (confirm('确定要删除这个任务吗？')) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveToStorage();
    renderAll();
  }
}

// 完成任务
function toggleComplete(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.completed = true;
    task.archiveId = generateArchiveId();
    task.archivedAt = new Date().toISOString();
    state.archivedTasks.unshift(task);
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveToStorage();
    renderAll();
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
