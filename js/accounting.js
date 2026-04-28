const EXPENSE_CATEGORIES = [
  { name: '餐饮', icon: '🍜', color: '#FF6B6B' },
  { name: '交通', icon: '🚗', color: '#4ECDC4' },
  { name: '购物', icon: '🛍️', color: '#FF9FF3' },
  { name: '住房', icon: '🏠', color: '#54A0FF' },
  { name: '娱乐', icon: '🎮', color: '#5F27CD' },
  { name: '医疗', icon: '💊', color: '#EE5A24' },
  { name: '教育', icon: '📚', color: '#0ABDE3' },
  { name: '通讯', icon: '📱', color: '#10AC84' },
  { name: '服饰', icon: '👔', color: '#FDA7DF' },
  { name: '美容', icon: '💄', color: '#F368E0' },
  { name: '运动', icon: '⚽', color: '#48DBFB' },
  { name: '社交', icon: '🍻', color: '#FF9F43' },
  { name: '宠物', icon: '🐱', color: '#C8D6E5' },
  { name: '日用', icon: '🧴', color: '#A29BFE' },
  { name: '其他', icon: '📝', color: '#636E72' }
];

const INCOME_CATEGORIES = [
  { name: '工资', icon: '💰', color: '#2ED573' },
  { name: '奖金', icon: '🎁', color: '#FFA502' },
  { name: '理财', icon: '📈', color: '#1E90FF' },
  { name: '兼职', icon: '💼', color: '#3742FA' },
  { name: '红包', icon: '🧧', color: '#FF4757' },
  { name: '退款', icon: '💳', color: '#A4B0BE' },
  { name: '其他', icon: '📝', color: '#636E72' }
];

let acctCurrentMonth = '';
let acctCurrentType = 'expense';
let acctSelectedCategory = null;
let acctInputAmount = '';
let acctNote = '';
let acctDate = '';
let acctFilterDate = '';

function initAccounting() {
  const now = new Date();
  acctCurrentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  acctDate = formatDate(now);
  acctCurrentType = 'expense';
  acctFilterDate = '';

  document.getElementById('acct-type-expense').addEventListener('click', () => switchAcctType('expense'));
  document.getElementById('acct-type-income').addEventListener('click', () => switchAcctType('income'));
  document.getElementById('acct-month-prev').addEventListener('click', () => acctPrevMonth());
  document.getElementById('acct-month-next').addEventListener('click', () => acctNextMonth());
  document.getElementById('acct-fab').addEventListener('click', () => openAddBillPanel());

  const filterInput = document.getElementById('acct-date-filter');
  if (filterInput) {
    filterInput.addEventListener('change', (e) => {
      acctFilterDate = e.target.value;
      updateClearBtn();
      renderAcctMonth();
    });
  }
  const clearFilterBtn = document.getElementById('acct-clear-filter');
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', () => {
      acctFilterDate = '';
      const fi = document.getElementById('acct-date-filter');
      if (fi) fi.value = '';
      updateClearBtn();
      renderAcctMonth();
    });
  }

  document.querySelectorAll('.numpad-key').forEach(key => {
    key.addEventListener('click', () => handleNumpad(key.dataset.key));
  });

  document.getElementById('numpad-confirm').addEventListener('click', confirmBill);
  document.getElementById('add-bill-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAddBillPanel();
  });
  document.getElementById('bill-note-input').addEventListener('input', (e) => {
    acctNote = e.target.value;
  });
  document.getElementById('bill-date-input').addEventListener('change', (e) => {
    acctDate = e.target.value;
  });

  renderAcctMonth();
}

function updateClearBtn() {
  const btn = document.getElementById('acct-clear-filter');
  if (btn) {
    btn.style.display = acctFilterDate ? 'block' : 'none';
  }
}

function switchAcctType(type) {
  acctCurrentType = type;
  document.getElementById('acct-type-expense').classList.toggle('active', type === 'expense');
  document.getElementById('acct-type-income').classList.toggle('active', type === 'income');
  acctSelectedCategory = null;
  renderCategoryGrid();
}

function renderCategoryGrid() {
  const categories = acctCurrentType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const grid = document.getElementById('category-grid');
  grid.innerHTML = categories.map(cat => `
    <div class="acct-category-item ${acctSelectedCategory === cat.name ? 'selected' : ''}" data-name="${cat.name}" data-icon="${cat.icon}">
      <div class="acct-category-icon" style="background:${cat.color}20;color:${cat.color}">${cat.icon}</div>
      <span class="acct-category-name">${cat.name}</span>
    </div>
  `).join('');

  grid.querySelectorAll('.acct-category-item').forEach(item => {
    item.addEventListener('click', () => {
      acctSelectedCategory = item.dataset.name;
      grid.querySelectorAll('.acct-category-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });
  });
}

function openAddBillPanel() {
  acctInputAmount = '';
  acctNote = '';
  acctSelectedCategory = null;
  acctDate = formatDate(new Date());
  acctCurrentType = 'expense';

  document.getElementById('bill-amount-display').textContent = '0.00';
  document.getElementById('bill-note-input').value = '';
  document.getElementById('bill-date-input').value = acctDate;
  document.getElementById('acct-type-expense').classList.add('active');
  document.getElementById('acct-type-income').classList.remove('active');

  renderCategoryGrid();

  const overlay = document.getElementById('add-bill-overlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('active'));
}

function closeAddBillPanel() {
  const overlay = document.getElementById('add-bill-overlay');
  overlay.classList.remove('active');
  setTimeout(() => { overlay.style.display = 'none'; }, 250);
}

function handleNumpad(key) {
  if (key === 'delete') {
    acctInputAmount = acctInputAmount.slice(0, -1);
  } else if (key === '.') {
    if (!acctInputAmount.includes('.')) {
      acctInputAmount += acctInputAmount.length === 0 ? '0.' : '.';
    }
  } else if (key === '00') {
    if (acctInputAmount.length > 0 && acctInputAmount !== '0') {
      if (!acctInputAmount.includes('.') || acctInputAmount.split('.')[1].length <= 0) {
        acctInputAmount += '00';
      }
    }
  } else {
    if (acctInputAmount === '0' && key !== '.') {
      acctInputAmount = key;
    } else {
      if (acctInputAmount.includes('.')) {
        const parts = acctInputAmount.split('.');
        if (parts[1].length < 2) {
          acctInputAmount += key;
        }
      } else if (acctInputAmount.length < 8) {
        acctInputAmount += key;
      }
    }
  }

  const display = acctInputAmount || '0';
  document.getElementById('bill-amount-display').textContent =
    display.includes('.') ? display : display + '.00';
}

async function confirmBill() {
  const hintEl = document.getElementById('bill-hint');
  
  if (!acctInputAmount || parseFloat(acctInputAmount) === 0) {
    if (hintEl) {
      hintEl.textContent = '请输入金额';
      hintEl.style.display = 'block';
      setTimeout(() => { hintEl.style.display = 'none'; }, 2000);
    }
    showToast('请输入金额');
    return;
  }
  if (!acctSelectedCategory) {
    if (hintEl) {
      hintEl.textContent = '请选择分类';
      hintEl.style.display = 'block';
      setTimeout(() => { hintEl.style.display = 'none'; }, 2000);
    }
    showToast('请选择分类');
    return;
  }

  const categories = acctCurrentType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const cat = categories.find(c => c.name === acctSelectedCategory);

  try {
    await addBill({
      type: acctCurrentType,
      category: acctSelectedCategory,
      categoryIcon: cat ? cat.icon : '📝',
      amount: parseFloat(acctInputAmount).toFixed(2),
      note: acctNote,
      date: acctDate
    });

    closeAddBillPanel();
    showToast(`${cat.icon} ${acctSelectedCategory} ¥${acctInputAmount} 已记录`);
    renderAcctMonth();
  } catch (e) {
    console.error('Add bill error:', e);
    showToast('记录失败，请重试');
  }
}

function acctPrevMonth() {
  const [y, m] = acctCurrentMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  acctCurrentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderAcctMonth();
}

function acctNextMonth() {
  const now = new Date();
  const [y, m] = acctCurrentMonth.split('-').map(Number);
  const d = new Date(y, m, 1);
  if (d > new Date(now.getFullYear(), now.getMonth(), 1)) return;
  acctCurrentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderAcctMonth();
}

async function renderAcctMonth() {
  const [y, m] = acctCurrentMonth.split('-').map(Number);
  document.getElementById('acct-month-label').textContent = `${y}年${m}月`;

  let bills = await getBillsByMonth(acctCurrentMonth);
  
  if (acctFilterDate) {
    bills = bills.filter(bill => bill.date === acctFilterDate);
  }
  
  const stats = calcMonthStats(bills);

  document.getElementById('acct-month-expense').textContent = `¥${stats.expense}`;
  document.getElementById('acct-month-income').textContent = `¥${stats.income}`;
  document.getElementById('acct-month-balance').textContent = `¥${stats.balance}`;

  renderAcctPieChart(stats);
  renderAcctBillList(bills);
}

function buildPieSVG(cats, catSource, totalAmount, label, amountStr, size) {
  size = size || 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.39;
  const innerR = size * 0.21;

  if (cats.length === 0) {
    return `<div class="acct-pie-empty">${label}暂无</div>`;
  }

  let paths = '';
  let startAngle = -Math.PI / 2;

  cats.forEach(cat => {
    const angle = (cat.total / totalAmount) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const catInfo = catSource.find(c => c.name === cat.category);
    const color = catInfo ? catInfo.color : '#636E72';
    const pct = ((cat.total / totalAmount) * 100).toFixed(1);

    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z" fill="${color}" opacity="0.85" data-cat="${cat.category}" data-type="${cat.type}" data-total="${cat.total.toFixed(2)}" data-count="${cat.count}" data-pct="${pct}" data-icon="${catInfo ? catInfo.icon : '📝'}" style="cursor:pointer;transition:opacity 0.15s"/>`;
    startAngle = endAngle;
  });

  return `<svg viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px;">
    <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="var(--card-bg, #fff)"/>
    ${paths}
    <text x="${cx}" y="${cy - 5}" text-anchor="middle" font-size="9" fill="var(--text-secondary, #8E8E93)" font-family="-apple-system, sans-serif">${label}</text>
    <text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text, #1C1C1E)" font-family="-apple-system, sans-serif">¥${amountStr}</text>
  </svg>`;
}

let pieDetailTimeout = null;

function showPieDetail(pathEl) {
  const cat = pathEl.getAttribute('data-cat');
  const type = pathEl.getAttribute('data-type');
  const total = pathEl.getAttribute('data-total');
  const count = pathEl.getAttribute('data-count');
  const pct = pathEl.getAttribute('data-pct');
  const icon = pathEl.getAttribute('data-icon');

  const detail = document.getElementById('acct-pie-detail');
  if (!detail) return;

  detail.innerHTML = `
    <div class="acct-pie-detail-content">
      <span class="acct-pie-detail-icon">${icon}</span>
      <span class="acct-pie-detail-name">${cat}</span>
      <span class="acct-pie-detail-type ${type}">${type === 'income' ? '收入' : '支出'}</span>
      <span class="acct-pie-detail-amount">¥${total}</span>
      <span class="acct-pie-detail-pct">${pct}%</span>
      <span class="acct-pie-detail-count">${count}笔</span>
    </div>
  `;
  detail.style.display = 'block';

  clearTimeout(pieDetailTimeout);
  pieDetailTimeout = setTimeout(() => {
    detail.style.display = 'none';
  }, 4000);
}

function bindPieClickEvents() {
  const chartArea = document.getElementById('acct-pie-chart');
  if (!chartArea) return;

  chartArea.addEventListener('click', (e) => {
    const path = e.target.closest('path[data-cat]');
    if (path) {
      chartArea.querySelectorAll('path[data-cat]').forEach(p => p.setAttribute('opacity', '0.5'));
      path.setAttribute('opacity', '1');
      showPieDetail(path);
      if (typeof playClickSound === 'function') playClickSound();
    }
  });
}

function renderAcctPieChart(stats) {
  const container = document.getElementById('acct-pie-chart');

  if (stats.categories.length === 0) {
    container.innerHTML = '<div class="acct-pie-empty">暂无记录</div>';
    return;
  }

  const expenseCats = stats.categories.filter(c => c.type === 'expense');
  const incomeCats = stats.categories.filter(c => c.type === 'income');
  const totalExpense = expenseCats.reduce((s, c) => s + c.total, 0) || 1;
  const totalIncome = incomeCats.reduce((s, c) => s + c.total, 0) || 1;

  let expenseSection = buildPieSection(expenseCats, EXPENSE_CATEGORIES, totalExpense, stats.expense, 'expense', '支出');
  let incomeSection = buildPieSection(incomeCats, INCOME_CATEGORIES, totalIncome, stats.income, 'income', '收入');

  container.innerHTML = `
    <div class="acct-chart-split">
      ${expenseSection}
      <div class="acct-chart-divider"></div>
      ${incomeSection}
    </div>
    <div id="acct-pie-detail" class="acct-pie-detail" style="display:none;"></div>
  `;

  bindPieClickEvents();
}

function buildPieSection(cats, catSource, totalAmount, amountStr, type, label) {
  if (cats.length === 0) {
    return `<div class="acct-chart-block">
      <div class="acct-chart-block-header">
        <span class="acct-chart-block-title">${label}</span>
        <span class="acct-chart-block-amount ${type}">${type === 'income' ? '+' : '-'}¥${amountStr}</span>
      </div>
      <div class="acct-pie-empty-small">${label}暂无</div>
    </div>`;
  }

  const svg = buildPieSVG(cats, catSource, totalAmount, label, amountStr, 100);
  
  const rankHTML = cats.map(cat => {
    const catInfo = catSource.find(c => c.name === cat.category);
    const pct = ((cat.total / totalAmount) * 100).toFixed(1);
    return `
      <div class="acct-rank-item">
        <span class="acct-rank-icon">${catInfo ? catInfo.icon : '📝'}</span>
        <span class="acct-rank-name">${cat.category}</span>
        <div class="acct-rank-bar-bg"><div class="acct-rank-bar" style="width:${pct}%;background:${catInfo ? catInfo.color : '#636E72'}"></div></div>
        <span class="acct-rank-pct">${pct}%</span>
      </div>
    `;
  }).join('');

  return `
    <div class="acct-chart-block">
      <div class="acct-chart-block-header">
        <span class="acct-chart-block-title">${label}</span>
        <span class="acct-chart-block-amount ${type}">${type === 'income' ? '+' : '-'}¥${amountStr}</span>
      </div>
      <div class="acct-chart-block-body">
        <div class="acct-pie-single">${svg}</div>
        <div class="acct-rank-section">${rankHTML}</div>
      </div>
    </div>
  `;
}

async function renderAcctBillList(bills) {
  const list = document.getElementById('acct-bill-list');
  
  if (bills.length === 0) {
    list.innerHTML = `<div class="acct-bill-empty">${acctFilterDate ? '该日期暂无记录' : '本月暂无记录'}</div>`;
    return;
  }

  const groups = groupBillsByDate(bills);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  list.innerHTML = groups.map(group => {
    const d = new Date(group.date + 'T00:00:00');
    const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日 周${weekDays[d.getDay()]}`;
    return `
      <div class="acct-bill-group">
        <div class="acct-bill-date">
          <span>${dateLabel}</span>
          <span class="acct-bill-date-summary">
            ${group.dayIncome > 0 ? `收 ¥${group.dayIncome.toFixed(2)}` : ''}
            ${group.dayExpense > 0 ? `支 ¥${group.dayExpense.toFixed(2)}` : ''}
          </span>
        </div>
        ${group.bills.sort((a, b) => b.timestamp - a.timestamp).map(bill => `
          <div class="acct-bill-item" data-id="${bill.id}">
            <span class="acct-bill-icon">${bill.categoryIcon}</span>
            <div class="acct-bill-info">
              <span class="acct-bill-cat">${bill.category}</span>
              ${bill.note ? `<span class="acct-bill-note">${bill.note}</span>` : ''}
            </div>
            <span class="acct-bill-amount ${bill.type}">${bill.type === 'income' ? '+' : '-'}¥${bill.amount}</span>
            <button class="acct-bill-delete" data-id="${bill.id}">✕</button>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');

  list.querySelectorAll('.acct-bill-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      try {
        await deleteBill(id);
        showToast('已删除');
        renderAcctMonth();
      } catch (err) {
        showToast('删除失败');
      }
    });
  });
}
