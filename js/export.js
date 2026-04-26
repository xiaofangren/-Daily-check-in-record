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
