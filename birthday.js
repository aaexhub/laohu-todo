const BIRTHDAY_STORAGE_KEY = "laoHuBirthdayListV1";

const birthdayState = {
  birthdays: [],
  editingId: null
};

// 初始化
function init() {
  loadFromStorage();
  renderAll();
  bindEvents();
  checkUpcomingBirthdays();
}

// 加载数据
function loadFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem(BIRTHDAY_STORAGE_KEY));
    if (data) {
      birthdayState.birthdays = data.birthdays || [];
    }
  } catch (e) {
    console.error('加载数据失败', e);
  }
}

// 保存数据
function saveToStorage() {
  localStorage.setItem(BIRTHDAY_STORAGE_KEY, JSON.stringify({
    birthdays: birthdayState.birthdays
  }));
}

// 渲染所有
function renderAll() {
  renderThisMonth();
  renderUpcoming();
  renderAllBirthdays();
}

// 计算距离下次生日的天数
function getDaysUntilBirthday(birthdayDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const thisYearBirthday = new Date(
    today.getFullYear(),
    new Date(birthdayDate).getMonth(),
    new Date(birthdayDate).getDate()
  );
  
  // 如果今年生日已过，计算明年
  if (thisYearBirthday < today) {
    thisYearBirthday.setFullYear(today.getFullYear() + 1);
  }
  
  const diffTime = thisYearBirthday - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

// 渲染本月生日
function renderThisMonth() {
  const container = document.getElementById('this-month-birthdays');
  const today = new Date();
  const thisMonth = today.getMonth();
  
  const thisMonthBirthdays = birthdayState.birthdays.filter(b => {
    const birthdayMonth = new Date(b.date).getMonth();
    return birthdayMonth === thisMonth;
  }).sort((a, b) => new Date(a.date).getDate() - new Date(b.date).getDate());
  
  if (thisMonthBirthdays.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;color:rgba(255,255,255,0.6);">本月没有生日</div>';
    return;
  }
  
  container.innerHTML = thisMonthBirthdays.map(b => {
    const days = getDaysUntilBirthday(b.date);
    const isToday = days === 0;
    return `
      <div class="birthday-card" style="${isToday ? 'border:2px solid #e74c3c;' : ''}">
        <div class="birthday-info">
          <div class="birthday-avatar">${b.name.charAt(0)}</div>
          <div>
            <div class="birthday-name">${escapeHtml(b.name)} ${isToday ? '🎂' : ''}</div>
            <div class="birthday-date">${formatDate(b.date)} · ${b.relation}</div>
          </div>
        </div>
        <div class="birthday-countdown">
          <div class="countdown-days">${isToday ? '今天' : days}</div>
          <div class="countdown-label">${isToday ? '生日快乐!' : '天后'}</div>
        </div>
        <div class="birthday-actions">
          ${b.email ? `<button onclick="sendBirthdayEmail('${b.id}')">📧 发邮件</button>` : ''}
          <button onclick="editBirthday('${b.id}')">编辑</button>
          <button onclick="deleteBirthday('${b.id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

// 渲染即将到来的生日
function renderUpcoming() {
  const container = document.getElementById('upcoming-birthdays');
  
  const upcomingBirthdays = birthdayState.birthdays
    .map(b => ({ ...b, days: getDaysUntilBirthday(b.date) }))
    .filter(b => b.days > 0 && b.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
  
  if (upcomingBirthdays.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;color:rgba(255,255,255,0.6);">30天内没有生日</div>';
    return;
  }
  
  container.innerHTML = upcomingBirthdays.map(b => `
    <div class="birthday-card">
      <div class="birthday-info">
        <div class="birthday-avatar">${b.name.charAt(0)}</div>
        <div>
          <div class="birthday-name">${escapeHtml(b.name)}</div>
          <div class="birthday-date">${formatDate(b.date)} · ${b.relation}</div>
        </div>
      </div>
      <div class="birthday-countdown">
        <div class="countdown-days">${b.days}</div>
        <div class="countdown-label">天后</div>
      </div>
      <div class="birthday-actions">
        ${b.email ? `<button onclick="sendBirthdayEmail('${b.id}')">📧 发邮件</button>` : ''}
        <button onclick="editBirthday('${b.id}')">编辑</button>
        <button onclick="deleteBirthday('${b.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

// 渲染所有生日
function renderAllBirthdays() {
  const container = document.getElementById('all-birthdays');
  
  if (birthdayState.birthdays.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;color:rgba(255,255,255,0.6);">还没有添加生日</div>';
    return;
  }
  
  const sortedBirthdays = [...birthdayState.birthdays]
    .map(b => ({ ...b, days: getDaysUntilBirthday(b.date) }))
    .sort((a, b) => a.days - b.days);
  
  container.innerHTML = sortedBirthdays.map(b => `
    <div class="birthday-card">
      <div class="birthday-info">
        <div class="birthday-avatar">${b.name.charAt(0)}</div>
        <div>
          <div class="birthday-name">${escapeHtml(b.name)}</div>
          <div class="birthday-date">${formatDate(b.date)} · ${b.relation}</div>
          ${b.note ? `<div style="font-size:12px;color:#999;margin-top:4px;">${escapeHtml(b.note)}</div>` : ''}
        </div>
      </div>
      <div class="birthday-countdown">
        <div class="countdown-days">${b.days}</div>
        <div class="countdown-label">天后</div>
      </div>
      <div class="birthday-actions">
        ${b.email ? `<button onclick="sendBirthdayEmail('${b.id}')">📧 发邮件</button>` : ''}
        <button onclick="editBirthday('${b.id}')">编辑</button>
        <button onclick="deleteBirthday('${b.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

// 发送生日邮件
function sendBirthdayEmail(id) {
  const birthday = birthdayState.birthdays.find(b => b.id === id);
  if (birthday && birthday.email) {
    const subject = encodeURIComponent(`🎂 生日快乐！`);
    const body = encodeURIComponent(`亲爱的${birthday.name}：\n\n祝你生日快乐！愿你新的一岁里，工作顺利，身体健康，万事如意！\n\n此致\n敬礼\n\n胡孟杰`);
    window.location.href = `mailto:${birthday.email}?subject=${subject}&body=${body}`;
  }
}

// 工具函数
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 添加生日
function addBirthday(birthdayData) {
  birthdayState.birthdays.push({
    id: generateId(),
    ...birthdayData,
    createdAt: new Date().toISOString()
  });
  saveToStorage();
  renderAll();
}

// 更新生日
function updateBirthday(id, birthdayData) {
  const index = birthdayState.birthdays.findIndex(b => b.id === id);
  if (index !== -1) {
    birthdayState.birthdays[index] = { ...birthdayState.birthdays[index], ...birthdayData };
    saveToStorage();
    renderAll();
  }
}

// 删除生日
function deleteBirthday(id) {
  if (confirm('确定要删除这个生日记录吗？')) {
    birthdayState.birthdays = birthdayState.birthdays.filter(b => b.id !== id);
    saveToStorage();
    renderAll();
  }
}

// 编辑生日
function editBirthday(id) {
  const birthday = birthdayState.birthdays.find(b => b.id === id);
  if (birthday) {
    birthdayState.editingId = id;
    document.getElementById('birthday-id').value = id;
    document.getElementById('birthday-name').value = birthday.name;
    document.getElementById('birthday-date').value = birthday.date;
    document.getElementById('birthday-relation').value = birthday.relation;
    document.getElementById('birthday-email').value = birthday.email || '';
    document.getElementById('birthday-note').value = birthday.note || '';
    document.getElementById('birthday-reminder').checked = birthday.reminder !== false;
    document.getElementById('modal-title').textContent = '编辑生日';
    openModal();
  }
}

// 检查即将到来的生日
function checkUpcomingBirthdays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  birthdayState.birthdays.forEach(b => {
    const days = getDaysUntilBirthday(b.date);
    
    // 今天生日
    if (days === 0) {
      showNotification(`🎂 今天是 ${b.name} 的生日！`, `别忘了送上祝福 ${b.email ? '(点击发邮件)' : ''}`);
    }
    // 3天后生日
    else if (days === 3 && b.reminder !== false) {
      showNotification(`🎂 提醒：${b.name} 的生日还有3天`, `生日：${formatDate(b.date)}`);
    }
    // 7天后生日
    else if (days === 7 && b.reminder !== false) {
      showNotification(`🎂 提醒：${b.name} 的生日还有1周`, `生日：${formatDate(b.date)}`);
    }
  });
}

// 显示通知
function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '🎂' });
  }
}

// 请求通知权限
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// 打开弹窗
function openModal() {
  document.getElementById('birthday-modal').classList.add('show');
}

// 关闭弹窗
function closeModal() {
  document.getElementById('birthday-modal').classList.remove('show');
  document.getElementById('birthday-form').reset();
  document.getElementById('birthday-id').value = '';
  document.getElementById('modal-title').textContent = '添加生日';
  birthdayState.editingId = null;
}

// 绑定事件
function bindEvents() {
  // 请求通知权限
  requestNotificationPermission();
  
  // 添加生日按钮
  document.getElementById('btn-add-birthday').addEventListener('click', () => {
    birthdayState.editingId = null;
    document.getElementById('modal-title').textContent = '添加生日';
    openModal();
  });
  
  // 关闭弹窗
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  
  // 表单提交
  document.getElementById('birthday-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const birthdayData = {
      name: document.getElementById('birthday-name').value.trim(),
      date: document.getElementById('birthday-date').value,
      relation: document.getElementById('birthday-relation').value,
      email: document.getElementById('birthday-email').value.trim(),
      note: document.getElementById('birthday-note').value.trim(),
      reminder: document.getElementById('birthday-reminder').checked
    };
    
    if (!birthdayData.name || !birthdayData.date) {
      alert('请填写姓名和生日日期');
      return;
    }
    
    if (birthdayState.editingId) {
      updateBirthday(birthdayState.editingId, birthdayData);
    } else {
      addBirthday(birthdayData);
    }
    
    closeModal();
  });
  
  // 点击弹窗外部关闭
  document.getElementById('birthday-modal').addEventListener('click', (e) => {
    if (e.target.id === 'birthday-modal') {
      closeModal();
    }
  });
}

// 启动
init();
