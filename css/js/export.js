async function exportCSV() {
  try {
    const data = await exportAllRecords();
    if (data.records.length === 0) {
      showToast('没有数据可导出');
      return;
    }

    const BOM = '\uFEFF';
    const header = '日期,时间,项目名称,项目图标\n';
    const rows = data.records.map(r => {
      const d = new Date(r.timestamp);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `${dateStr},${timeStr},"${r.itemName}","${r.itemIcon}"`;
    }).join('\n');

    const csv = BOM + header + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `日常打卡_${formatDate(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('导出成功');
  } catch (e) {
    console.error('Export CSV error:', e);
    showToast('导出失败');
  }
}

async function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      showToast('CSV 文件为空');
      return;
    }

    const items = await getAllItems();
    const itemNameMap = {};
    items.forEach(item => {
      itemNameMap[item.name] = item;
    });

    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 3) continue;

      const [dateStr, timeStr, name, icon] = cols;
      if (!dateStr || !timeStr || !name) continue;

      let item = itemNameMap[name];
      if (!item) {
        const template = TEMPLATES.find(t => t.name === name);
        const id = await addItem({
          name: name,
          icon: icon || (template ? template.icon : '📌'),
          color: template ? template.color : '#4A90D9'
        });
        item = await getItemById(id);
        itemNameMap[name] = item;
      }

      const [h, m] = timeStr.split(':').map(Number);
      const dateParts = dateStr.split('-').map(Number);
      const timestamp = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], h || 0, m || 0).getTime();

      if (isNaN(timestamp)) continue;

      await runTransaction('records', 'readwrite', (store) => {
        return store.add({
          itemId: item.id,
          timestamp: timestamp,
          date: dateStr
        });
      });

      imported++;
    }

    showToast(`成功导入 ${imported} 条记录`);
    renderCheckinView();
  } catch (e) {
    console.error('Import CSV error:', e);
    showToast('导入失败');
  }

  event.target.value = '';
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function exportAccountingCSV() {
  try {
    const bills = await getAllBills();
    if (bills.length === 0) {
      showToast('没有记账数据可导出');
      return;
    }

    const BOM = '\uFEFF';
    const header = '日期,类型,分类,分类图标,金额,备注\n';
    const rows = bills.map(b => {
      const dateStr = b.date;
      const typeStr = b.type === 'income' ? '收入' : '支出';
      const amount = parseFloat(b.amount).toFixed(2);
      return `${dateStr},${typeStr},"${b.category}","${b.categoryIcon}",${amount},"${b.note || ''}"`;
    }).join('\n');

    const csv = BOM + header + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `记账数据_${formatDate(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('记账数据导出成功');
  } catch (e) {
    console.error('Export Accounting CSV error:', e);
    showToast('导出失败');
  }
}

async function importAccountingCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      showToast('CSV 文件为空');
      return;
    }

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 5) continue;

      const [dateStr, typeStr, catName, catIcon, amountStr, note] = cols;
      if (!dateStr || !typeStr || !catName || !amountStr) continue;

      const type = typeStr.includes('收') ? 'income' : 'expense';
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) continue;

      const icon = catIcon && catIcon.length > 0 ? catIcon : (type === 'income' ? '💰' : '📝');
      await addBill({
        type: type,
        category: catName,
        categoryIcon: icon,
        amount: amount,
        note: note || '',
        date: dateStr
      });

      imported++;
    }

    showToast(`成功导入 ${imported} 条记账数据`);
    if (typeof renderAcctMonth === 'function') renderAcctMonth();
  } catch (e) {
    console.error('Import Accounting CSV error:', e);
    showToast('导入失败');
  }

  event.target.value = '';
}
