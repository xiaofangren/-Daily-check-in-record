const ICONS = [
  '🚿', '🏃', '💧', '💊', '😴', '📖', '🧘', '🍎',
  '🪥', '🧹', '🎵', '✍️', '🏋️', '🚴', '🧠', '☕',
  '🥗', '🛌', '🌅', '🧴', '💅', '🚶', '🏊', '🧹',
  '📝', '🎯', '💪', '🌿', '🎮', '📱'
];

const COLORS = [
  '#4A90D9', '#34C759', '#FF9500', '#FF3B30',
  '#AF52DE', '#5AC8FA', '#FF2D55', '#FFD60A',
  '#30B0C7', '#64D2FF', '#BF5AF2', '#FF6482'
];

const TEMPLATES = [
  { name: '洗头', icon: '🚿', color: '#5AC8FA' },
  { name: '运动', icon: '🏃', color: '#34C759' },
  { name: '喝水', icon: '💧', color: '#4A90D9' },
  { name: '吃药', icon: '💊', color: '#FF9500' },
  { name: '早睡', icon: '😴', color: '#AF52DE' },
  { name: '阅读', icon: '📖', color: '#30B0C7' },
  { name: '冥想', icon: '🧘', color: '#BF5AF2' },
  { name: '刷牙', icon: '🪥', color: '#64D2FF' },
  { name: '护肤', icon: '🧴', color: '#FF6482' },
  { name: '健康饮食', icon: '🥗', color: '#34C759' }
];

const CLIPBOARD_PREFIX = 'DAILY_CHECKIN:';

let currentEditItem = null;
let selectedIcon = '📌';
let selectedColor = '#4A90D9';
let longPressTimer = null;
let longPressTriggered = false;

function isStandalone() {
  return window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
}

document.addEventListener('DOMContentLoaded', async () => {
  const dbOk = await initDB();
  if (!dbOk) {
    showToast('数据库初始化失败，请刷新重试');
    return;
  }

  initUI();
  renderCheckinView();

  // 优先尝试剪贴板同步
  const clipboardSuccess = await autoSyncClipboard();
  if (clipboardSuccess) {
    // 已通过剪贴板处理，不需要再处理 URL
  } else {
    // 剪贴板没有数据，检查 URL 参数作为备用方案
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const itemName = params.get('item');
    if (action === 'checkin' && itemName) {
      if (!isStandalone()) {
        // Safari 打开，复制到剪贴板并显示确认
        await handleSafariCheckin(itemName);
      } else {
        // 万一在 PWA 打开了带参数的 URL，直接处理
        await performCheckin(itemName);
        renderCheckinView();
      }
    }
  }

  registerSW();
  updateStorageInfo();
});

async function performCheckin(itemName) {
  try {
    let item = await getItemByName(itemName);

    if (!item) {
      const template = TEMPLATES.find(t => t.name === itemName);
      const id = await addItem({
        name: itemName,
        icon: template ? template.icon : '📌',
        color: template ? template.color : '#4A90D9'
      });
      item = await getItemById(id);
    }

    if (item) {
      const todayRecords = await getTodayRecords();
      const alreadyChecked = todayRecords.some(r => r.itemId === item.id);

      if (alreadyChecked) {
        showSiriConfirm(`${item.icon} ${item.name} 今天已经打卡过了`);
      } else {
        await checkin(item.id);
        showSiriConfirm(`${item.icon} ${item.name} 打卡成功！`);
      }
    }

    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  } catch (e) {
    console.error('Checkin error:', e);
    showSiriConfirm('打卡失败，请重试');
  }
}

async function handleSafariCheckin(itemName) {
  try {
    const syncData = CLIPBOARD_PREFIX + encodeURIComponent(itemName);

    try {
      await navigator.clipboard.writeText(syncData);
    } catch (e) {
      const textarea = document.createElement('textarea');
      textarea.value = syncData;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    const template = TEMPLATES.find(t => t.name === itemName);
    const icon = template ? template.icon : '📌';

    document.getElementById('app').style.display = 'none';
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#F2F2F7;padding:32px;text-align:center;font-family:-apple-system,sans-serif;';
    container.innerHTML = `
      <div style="max-width:320px;">
        <div style="font-size:64px;margin-bottom:16px;">${icon}</div>
        <h2 style="font-size:22px;font-weight:600;color:#1C1C1E;margin-bottom:8px;">${escapeHtml(itemName)} 已记录！</h2>
        <p style="font-size:15px;color:#8E8E93;line-height:1.6;margin-bottom:24px;">
          打卡数据已暂存剪贴板<br>
          下次打开打卡应用时自动同步
        </p>
        <button onclick="window.close()" style="background:#4A90D9;color:#fff;border:none;padding:12px 32px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;">
          关闭
        </button>
      </div>
    `;
    document.body.appendChild(container);

    setTimeout(() => {
      try { window.close(); } catch(e) {}
    }, 5000);

  } catch (e) {
    console.error('Safari checkin error:', e);
  }
}

async function autoSyncClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.startsWith(CLIPBOARD_PREFIX)) return false;

    const itemName = decodeURIComponent(text.slice(CLIPBOARD_PREFIX.length));
    if (!itemName) return false;

    let item = await getItemByName(itemName);
    if (!item) {
      const template = TEMPLATES.find(t => t.name === itemName);
      const id = await addItem({
        name: itemName,
        icon: template ? template.icon : '📌',
        color: template ? template.color : '#4A90D9'
      });
      item = await getItemById(id);
    }

    if (item) {
      const todayRecords = await getTodayRecords();
      const alreadyChecked = todayRecords.some(r => r.itemId === item.id);

      if (alreadyChecked) {
        if (isStandalone()) {
          showToast(`${item.icon} ${item.name} 今天已经打卡过了`);
        } else {
          showSiriConfirm(`${item.icon} ${item.name} 今天已经打卡过了`);
        }
      } else {
        await checkin(item.id);
        if (isStandalone()) {
          showToast(`${item.icon} ${item.name} 同步成功！`);
        } else {
          showSiriConfirm(`${item.icon} ${item.name} 打卡成功！`);
        }
      }
    }

    try { await navigator.clipboard.writeText(''); } catch(e) {}
    renderCheckinView();
    return true;
  } catch (e) {
    console.log('剪贴板读取失败或无数据:', e);
    return false;
  }
}

function initUI() {
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  document.getElementById('fab-add').addEventListener('click', () => openModal());

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', saveItem);
  document.getElementById('btn-delete-item').addEventListener('click', deleteCurrentItem);

  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById('btn-export').addEventListener('click', exportCSV);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importCSV);
  document.getElementById('btn-clear').addEventListener('click', confirmClearData);
  document.getElementById('btn-clipboard-sync-settings').addEventListener('click', autoSyncClipboard);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      autoSyncClipboard();
    }
  });

  initIconPicker();
  initColorPicker();
  initTemplateList();
}

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

  document.getElementById(viewId).classList.add('active');
  document.querySelector(`[data-view="${viewId}"]`).classList.add('active');

  const fab = document.getElementById('fab-add');
  fab.style.display = viewId === 'checkin-view' ? 'flex' : 'none';

  const titles = {
    'checkin-view': '日常打卡',
    'history-view': '历史记录',
    'settings-view': '设置'
  };
  document.getElementById('header-title').textContent = titles[viewId] || '日常打卡';

  if (viewId === 'history-view') {
    if (window.calendarComponent) {
      window.calendarComponent.render();
    }
    renderHistoryList();
  }

  if (viewId === 'settings-view') {
    updateStorageInfo();
  }
}

async function renderCheckinView() {
  const items = await getAllItems();
  const todayRecords = await getTodayRecords();
  const grid = document.getElementById('checkin-grid');
  const emptyState = document.getElementById('empty-state');
  const todayInfo = document.getElementById('today-info');

  const now = new Date();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dateDisplay = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${weekDays[now.getDay()]}`;

  const checkedCount = new Set(todayRecords.map(r => r.itemId)).size;
  const totalCount = items.length;

  todayInfo.innerHTML = `
    <div class="date-str">${dateDisplay}</div>
    <div class="progress-text">今日已打卡 ${checkedCount}/${totalCount} 项</div>
  `;

  if (items.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  emptyState.style.display = 'none';

  const todayItemIds = new Set(todayRecords.map(r => r.itemId));
  const recordTimeMap = {};
  todayRecords.forEach(r => {
    if (!recordTimeMap[r.itemId]) {
      recordTimeMap[r.itemId] = formatTime(r.timestamp);
    }
  });

  grid.innerHTML = items.map(item => {
    const isChecked = todayItemIds.has(item.id);
    return `
      <div class="checkin-card ${isChecked ? 'checked' : ''}"
           data-id="${item.id}"
           style="border-left: 4px solid ${item.color}">
        ${isChecked ? '<div class="card-check">✓</div>' : ''}
        <div class="card-icon">${item.icon}</div>
        <div class="card-name">${escapeHtml(item.name)}</div>
        ${isChecked ? `<div class="card-time">${recordTimeMap[item.id]}</div>` : ''}
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.checkin-card').forEach(card => {
    const itemId = parseInt(card.dataset.id);
    let touchStartY = 0;
    let touchStartX = 0;

    card.addEventListener('click', () => {
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }
      handleCheckin(itemId, card);
    });

    card.addEventListener('touchstart', (e) => {
      longPressTriggered = false;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        if (navigator.vibrate) navigator.vibrate(30);
        openQuickMenu(itemId);
      }, 500);
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
      clearTimeout(longPressTimer);
      if (longPressTriggered) {
        e.preventDefault();
      }
    });

    card.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartX);
        const dy = Math.abs(touch.clientY - touchStartY);
        if (dx > 10 || dy > 10) {
          clearTimeout(longPressTimer);
        }
      }
    }, { passive: true });

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!longPressTriggered) {
        openQuickMenu(itemId);
      }
    });
  });
}

async function handleCheckin(itemId, cardEl) {
  const todayRecords = await getTodayRecords();
  const isChecked = todayRecords.some(r => r.itemId === itemId);

  if (isChecked) {
    await undoCheckin(itemId);
    showToast('已取消打卡');
  } else {
    await checkin(itemId);
    if (cardEl) {
      cardEl.classList.add('pulse');
      setTimeout(() => cardEl.classList.remove('pulse'), 600);
    }
    const item = await getItemById(itemId);
    showToast(`${item.icon} ${item.name} 打卡成功！`);
  }

  renderCheckinView();
}

async function handleLongPress(itemId) {
  const item = await getItemById(itemId);
  if (item) {
    openModal(item);
  }
}

function initIconPicker() {
  const picker = document.getElementById('icon-picker');
  picker.innerHTML = ICONS.map(icon => `
    <div class="icon-option ${icon === selectedIcon ? 'selected' : ''}"
         data-icon="${icon}">${icon}</div>
  `).join('');

  picker.addEventListener('click', (e) => {
    const option = e.target.closest('.icon-option');
    if (!option) return;
    picker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    selectedIcon = option.dataset.icon;
  });
}

function initColorPicker() {
  const picker = document.getElementById('color-picker');
  picker.innerHTML = COLORS.map(color => `
    <div class="color-option ${color === selectedColor ? 'selected' : ''}"
         data-color="${color}"
         style="background:${color}"></div>
  `).join('');

  picker.addEventListener('click', (e) => {
    const option = e.target.closest('.color-option');
    if (!option) return;
    picker.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    selectedColor = option.dataset.color;
  });
}

function initTemplateList() {
  const list = document.getElementById('template-list');
  list.innerHTML = TEMPLATES.map(t => `
    <div class="template-item" data-name="${t.name}" data-icon="${t.icon}" data-color="${t.color}">
      ${t.icon} ${t.name}
    </div>
  `).join('');

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.template-item');
    if (!item) return;
    document.getElementById('item-name').value = item.dataset.name;
    selectedIcon = item.dataset.icon;
    selectedColor = item.dataset.color;
    refreshPickers();
  });
}

function refreshPickers() {
  document.querySelectorAll('.icon-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.icon === selectedIcon);
  });
  document.querySelectorAll('.color-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.color === selectedColor);
  });
}

function openModal(item = null) {
  currentEditItem = item;
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const nameInput = document.getElementById('item-name');
  const deleteBtn = document.getElementById('btn-delete-item');

  if (item) {
    title.textContent = '编辑打卡项';
    nameInput.value = item.name;
    selectedIcon = item.icon;
    selectedColor = item.color;
    deleteBtn.style.display = 'block';
  } else {
    title.textContent = '添加打卡项';
    nameInput.value = '';
    selectedIcon = '📌';
    selectedColor = '#4A90D9';
    deleteBtn.style.display = 'none';
  }

  refreshPickers();
  overlay.style.display = 'flex';
  nameInput.focus();
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  currentEditItem = null;
}

async function saveItem() {
  const name = document.getElementById('item-name').value.trim();
  if (!name) {
    showToast('请输入项目名称');
    return;
  }

  try {
    if (currentEditItem) {
      currentEditItem.name = name;
      currentEditItem.icon = selectedIcon;
      currentEditItem.color = selectedColor;
      await updateItem(currentEditItem);
      showToast('已更新');
    } else {
      await addItem({
        name: name,
        icon: selectedIcon,
        color: selectedColor
      });
      showToast('已添加');
    }

    closeModal();
    renderCheckinView();
  } catch (e) {
    console.error('Save item error:', e);
    showToast('保存失败，请重试');
  }
}

async function deleteCurrentItem() {
  if (!currentEditItem) return;

  showConfirm('确定删除此打卡项及其所有记录？', async () => {
    try {
      await deleteItem(currentEditItem.id);
      showToast('已删除');
      closeModal();
      renderCheckinView();
    } catch (e) {
      console.error('Delete item error:', e);
      showToast('删除失败');
    }
  });
}

function showSiriConfirm(message) {
  const el = document.getElementById('siri-confirm');
  document.getElementById('siri-message').textContent = message;
  el.style.display = 'flex';

  document.getElementById('siri-close').onclick = () => {
    el.style.display = 'none';
  };
}

function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

function showConfirm(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <p>${escapeHtml(message)}</p>
      <div class="confirm-actions">
        <button class="btn btn-secondary confirm-cancel">取消</button>
        <button class="btn btn-danger confirm-ok">确定</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('.confirm-cancel').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.querySelector('.confirm-ok').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

async function confirmClearData() {
  showConfirm('确定清除全部数据？此操作不可恢复！', async () => {
    try {
      await clearAllData();
      showToast('数据已清除');
      renderCheckinView();
    } catch (e) {
      console.error('Clear data error:', e);
      showToast('清除失败');
    }
  });
}

async function updateStorageInfo() {
  const est = await getStorageEstimate();
  const el = document.getElementById('storage-info');
  if (est && est.quota > 0) {
    const usedMB = (est.usage / 1024 / 1024).toFixed(2);
    const totalMB = (est.quota / 1024 / 1024).toFixed(0);
    el.textContent = `存储使用：${usedMB} MB / ${totalMB} MB (${est.percentUsed}%)`;
  } else {
    el.textContent = '存储信息不可用';
  }
}

async function renderHistoryList() {
  const selectedDate = window.calendarComponent?.selectedDate || formatDate(new Date());
  const filterItem = document.getElementById('filter-item').value;
  const list = document.getElementById('history-list');
  const items = await getAllItems();

  updateFilterDropdown(items);

  let records = await getRecordsByDate(selectedDate);

  if (filterItem !== 'all') {
    const itemId = parseInt(filterItem);
    records = records.filter(r => r.itemId === itemId);
  }

  const itemMap = {};
  items.forEach(item => {
    itemMap[item.id] = item;
  });

  const checkedItemIds = new Set(records.map(r => r.itemId));
  const uncheckedItems = items.filter(item => !checkedItemIds.has(item.id));

  let html = '';

  html += `<div class="history-date-header">${formatDisplayDate(selectedDate)}</div>`;

  if (records.length > 0) {
    records.sort((a, b) => b.timestamp - a.timestamp);
    html += `<div class="history-date-group">`;
    html += records.map(r => {
      const item = itemMap[r.itemId] || { name: '已删除', icon: '🗑️' };
      return `
        <div class="history-record">
          <div class="record-icon">${item.icon}</div>
          <div class="record-info">
            <div class="record-name">${escapeHtml(item.name)}</div>
            <div class="record-time">${formatTime(r.timestamp)}</div>
          </div>
          <button class="record-delete" data-id="${r.id}" title="删除记录">✕</button>
        </div>
      `;
    }).join('');
    html += `</div>`;
  }

  if (uncheckedItems.length > 0) {
    html += `
      <div class="makeup-section">
        <div class="makeup-title">未打卡项目</div>
        <div class="makeup-grid">
          ${uncheckedItems.map(item => `
            <button class="makeup-item" data-item-id="${item.id}" data-date="${selectedDate}" style="border-color:${item.color}">
              <span class="makeup-item-icon">${item.icon}</span>
              <span class="makeup-item-name">${escapeHtml(item.name)}</span>
              <span class="makeup-item-action">补打</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (records.length === 0 && uncheckedItems.length === 0) {
    html = '<div class="history-empty">当天没有打卡记录</div>';
  }

  list.innerHTML = html;

  list.querySelectorAll('.record-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      try {
        await deleteRecord(id);
        renderHistoryList();
        renderCheckinView();
      } catch (e) {
        showToast('删除失败');
      }
    });
  });

  list.querySelectorAll('.makeup-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const itemId = parseInt(btn.dataset.itemId);
      const date = btn.dataset.date;
      try {
        await checkin(itemId, date);
        const item = await getItemById(itemId);
        showToast(`${item.icon} ${item.name} 补打卡成功！`);
        renderHistoryList();
        renderCheckinView();
      } catch (e) {
        showToast('补打卡失败');
      }
    });
  });
}

function updateFilterDropdown(items) {
  const select = document.getElementById('filter-item');
  const currentValue = select.value;

  select.innerHTML = '<option value="all">全部项目</option>' +
    items.map(item => `<option value="${item.id}">${item.icon} ${escapeHtml(item.name)}</option>`).join('');

  select.value = currentValue;

  select.onchange = () => renderHistoryList();
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

let detailItemId = null;
let detailYear = null;
let detailMonth = null;

async function openItemDetail(itemId) {
  const item = await getItemById(itemId);
  if (!item) return;

  detailItemId = itemId;
  const now = new Date();
  detailYear = now.getFullYear();
  detailMonth = now.getMonth();

  const overlay = document.getElementById('detail-overlay');
  overlay.classList.add('active');

  document.getElementById('detail-icon').textContent = item.icon;
  document.getElementById('detail-name').textContent = item.name;
  document.getElementById('detail-color-bar').style.background = item.color;

  renderDetailContent(item);
}

function closeItemDetail() {
  const overlay = document.getElementById('detail-overlay');
  overlay.classList.remove('active');
  detailItemId = null;
}

async function renderDetailContent(item) {
  const startDate = `${detailYear}-${String(detailMonth + 1).padStart(2, '0')}-01`;
  const endDate = `${detailYear}-${String(detailMonth + 1).padStart(2, '0')}-${String(new Date(detailYear, detailMonth + 1, 0).getDate()).padStart(2, '0')}`;

  const records = await getItemRecordsByDateRange(item.id, startDate, endDate);
  const stats = calcStats(records, detailYear, detailMonth);

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  document.getElementById('detail-month-label').textContent = `${detailYear}年${monthNames[detailMonth]}`;

  renderHeatmap(document.getElementById('detail-heatmap'), records, detailYear, detailMonth, item.color);
  renderStatsCards(document.getElementById('detail-stats'), stats, item.color);
  renderWeekdayChart(document.getElementById('detail-weekday'), stats, item.color);
  renderBarChart(document.getElementById('detail-bar'), records, detailYear, detailMonth, item.color);

  const recentList = document.getElementById('detail-recent');
  const allRecords = await getRecordsByItem(item.id);
  allRecords.sort((a, b) => b.timestamp - a.timestamp);
  const recent = allRecords.slice(0, 10);

  if (recent.length > 0) {
    recentList.innerHTML = `
      <div class="detail-section-title">最近记录</div>
      ${recent.map(r => `
        <div class="detail-record-item">
          <span class="detail-record-date">${r.date}</span>
          <span class="detail-record-time">${formatTime(r.timestamp)}</span>
        </div>
      `).join('')}
    `;
  } else {
    recentList.innerHTML = '<div class="detail-section-title">暂无记录</div>';
  }
}

function detailPrevMonth() {
  detailMonth--;
  if (detailMonth < 0) {
    detailMonth = 11;
    detailYear--;
  }
  getItemById(detailItemId).then(item => {
    if (item) renderDetailContent(item);
  });
}

function detailNextMonth() {
  const now = new Date();
  detailMonth++;
  if (detailMonth > 11) {
    detailMonth = 0;
    detailYear++;
  }
  if (detailYear > now.getFullYear() || (detailYear === now.getFullYear() && detailMonth > now.getMonth())) {
    detailMonth = now.getMonth();
    detailYear = now.getFullYear();
    return;
  }
  getItemById(detailItemId).then(item => {
    if (item) renderDetailContent(item);
  });
}

let quickMenuItemId = null;
let quickMenuOpenTime = 0;

async function openQuickMenu(itemId) {
  const item = await getItemById(itemId);
  if (!item) return;
  quickMenuItemId = itemId;
  document.getElementById('quick-menu-icon').textContent = item.icon;
  document.getElementById('quick-menu-name').textContent = item.name;
  document.getElementById('quick-menu-color').style.background = item.color;
  const overlay = document.getElementById('quick-menu-overlay');
  overlay.style.display = 'flex';
  quickMenuOpenTime = Date.now();
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
}

function closeQuickMenu() {
  if (Date.now() - quickMenuOpenTime < 300) return;
  const overlay = document.getElementById('quick-menu-overlay');
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 200);
}

function openDetailFromQuickMenu() {
  closeQuickMenu();
  setTimeout(() => {
    openItemDetail(quickMenuItemId);
  }, 200);
}

function openEditFromQuickMenu() {
  closeQuickMenu();
  setTimeout(() => {
    handleLongPress(quickMenuItemId);
  }, 200);
}

function deleteFromQuickMenu() {
  showConfirm('确定删除此打卡项及其所有记录？', async () => {
    try {
      await deleteItem(quickMenuItemId);
      showToast('已删除');
      closeQuickMenu();
      renderCheckinView();
    } catch (e) {
      console.error('Delete item error:', e);
      showToast('删除失败');
    }
  });
}
