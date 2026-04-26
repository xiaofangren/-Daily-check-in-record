function renderHeatmap(container, records, year, month, itemColor) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const dateSet = new Set();
  records.forEach(r => dateSet.add(r.date));

  const cellSize = 38;
  const gap = 4;
  const labelHeight = 24;
  const weekLabels = ['日', '一', '二', '三', '四', '五', '六'];

  const weeks = Math.ceil((firstDayOfWeek + daysInMonth) / 7);
  const svgWidth = weeks * (cellSize + gap) + gap + 36;
  const svgHeight = 7 * (cellSize + gap) + gap + labelHeight;

  let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${svgWidth}px;">`;

  svg += `<style>
    .hm-cell { rx: 6; ry: 6; transition: opacity 0.15s; cursor: default; }
    .hm-cell:hover { opacity: 0.8; }
    .hm-label { font-size: 10px; fill: var(--text-secondary, #8E8E93); font-family: -apple-system, sans-serif; }
    .hm-date-label { font-size: 9px; fill: var(--text-secondary, #8E8E93); font-family: -apple-system, sans-serif; text-anchor: middle; }
  </style>`;

  for (let dow = 0; dow < 7; dow++) {
    svg += `<text x="14" y="${labelHeight + dow * (cellSize + gap) + cellSize / 2 + 4}" class="hm-label" text-anchor="middle">${weekLabels[dow]}</text>`;
  }

  let day = 1;
  for (let week = 0; week < weeks; week++) {
    for (let dow = 0; dow < 7; dow++) {
      if (week === 0 && dow < firstDayOfWeek) continue;
      if (day > daysInMonth) break;

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isChecked = dateSet.has(dateStr);
      const x = 36 + week * (cellSize + gap);
      const y = labelHeight + dow * (cellSize + gap);

      if (isChecked) {
        svg += `<rect class="hm-cell" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${itemColor}" opacity="0.9"/>`;
        svg += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 5}" class="hm-date-label" fill="#fff" font-weight="600" font-size="12">${day}</text>`;
      } else {
        svg += `<rect class="hm-cell" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="var(--border, #E5E5EA)" opacity="0.4"/>`;
        svg += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 4}" class="hm-date-label">${day}</text>`;
      }

      day++;
    }
  }

  svg += '</svg>';
  container.innerHTML = svg;
}

function renderBarChart(container, records, year, month, itemColor) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const countByDay = {};
  records.forEach(r => {
    const day = parseInt(r.date.split('-')[2]);
    countByDay[day] = (countByDay[day] || 0) + 1;
  });

  const maxCount = Math.max(1, ...Object.values(countByDay));
  const barWidth = Math.max(6, Math.min(16, (300 - daysInMonth * 2) / daysInMonth));
  const chartHeight = 80;
  const svgWidth = daysInMonth * (barWidth + 2) + 40;
  const svgHeight = chartHeight + 30;

  let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${svgWidth}px;">`;

  svg += `<line x1="30" y1="0" x2="30" y2="${chartHeight}" stroke="var(--border, #E5E5EA)" stroke-width="0.5"/>`;
  svg += `<line x1="30" y1="${chartHeight}" x2="${svgWidth}" y2="${chartHeight}" stroke="var(--border, #E5E5EA)" stroke-width="0.5"/>`;

  for (let i = 0; i <= maxCount; i++) {
    const y = chartHeight - (i / maxCount) * chartHeight;
    svg += `<text x="26" y="${y + 4}" font-size="9" fill="var(--text-secondary, #8E8E93)" text-anchor="end" font-family="-apple-system, sans-serif">${i}</text>`;
    if (i > 0) {
      svg += `<line x1="30" y1="${y}" x2="${svgWidth}" y2="${y}" stroke="var(--border, #E5E5EA)" stroke-width="0.3" stroke-dasharray="3,3"/>`;
    }
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const count = countByDay[day] || 0;
    const barHeight = Math.max(0, (count / maxCount) * chartHeight);
    const x = 34 + (day - 1) * (barWidth + 2);
    const y = chartHeight - barHeight;

    if (count > 0) {
      svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${itemColor}" rx="2" opacity="0.85"/>`;
    }

    if (day === 1 || day === 10 || day === 20 || day === daysInMonth) {
      svg += `<text x="${x + barWidth / 2}" y="${chartHeight + 14}" font-size="9" fill="var(--text-secondary, #8E8E93)" text-anchor="middle" font-family="-apple-system, sans-serif">${day}</text>`;
    }
  }

  svg += '</svg>';
  container.innerHTML = svg;
}

function calcStats(records, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateSet = new Set();
  records.forEach(r => dateSet.add(r.date));

  const totalDays = dateSet.size;
  const rate = daysInMonth > 0 ? ((totalDays / daysInMonth) * 100).toFixed(1) : 0;

  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const checkEnd = isCurrentMonth ? today.getDate() : daysInMonth;

  for (let d = checkEnd; d >= 1; d--) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dateSet.has(dateStr)) {
      tempStreak++;
      if (currentStreak === 0 && d >= checkEnd - 1) currentStreak = tempStreak;
    } else {
      if (tempStreak > maxStreak) maxStreak = tempStreak;
      tempStreak = 0;
    }
  }
  if (tempStreak > maxStreak) maxStreak = tempStreak;

  if (currentStreak === 0 && dateSet.has(`${year}-${String(month + 1).padStart(2, '0')}-${String(checkEnd).padStart(2, '0')}`)) {
    currentStreak = 1;
  }

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dowCount = [0, 0, 0, 0, 0, 0, 0];
  dateSet.forEach(dateStr => {
    const d = new Date(dateStr + 'T00:00:00');
    dowCount[d.getDay()]++;
  });

  let bestDow = 0;
  let bestDowCount = 0;
  dowCount.forEach((c, i) => {
    if (c > bestDowCount) {
      bestDowCount = c;
      bestDow = i;
    }
  });

  return {
    totalDays,
    totalRecords: records.length,
    rate,
    currentStreak,
    maxStreak,
    bestDow: weekDays[bestDow],
    bestDowCount,
    dowCount
  };
}

function renderStatsCards(container, stats, itemColor) {
  container.innerHTML = `
    <div class="stat-card" style="border-top: 3px solid ${itemColor}">
      <div class="stat-value">${stats.totalDays}</div>
      <div class="stat-label">打卡天数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.rate}%</div>
      <div class="stat-label">完成率</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.currentStreak}</div>
      <div class="stat-label">当前连续</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.maxStreak}</div>
      <div class="stat-label">最长连续</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">周${stats.bestDow}</div>
      <div class="stat-label">最常打卡</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.totalRecords}</div>
      <div class="stat-label">总记录数</div>
    </div>
  `;
}

function renderWeekdayChart(container, stats, itemColor) {
  const weekLabels = ['日', '一', '二', '三', '四', '五', '六'];
  const maxCount = Math.max(1, ...stats.dowCount);
  const barWidth = 28;
  const chartHeight = 60;
  const svgWidth = 7 * (barWidth + 8) + 10;
  const svgHeight = chartHeight + 30;

  let svg = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${svgWidth}px;">`;

  for (let i = 0; i < 7; i++) {
    const count = stats.dowCount[i];
    const barHeight = Math.max(2, (count / maxCount) * chartHeight);
    const x = 5 + i * (barWidth + 8);
    const y = chartHeight - barHeight;

    svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${itemColor}" rx="4" opacity="${count > 0 ? 0.85 : 0.2}"/>`;

    if (count > 0) {
      svg += `<text x="${x + barWidth / 2}" y="${y - 4}" font-size="10" fill="var(--text, #1C1C1E)" text-anchor="middle" font-family="-apple-system, sans-serif" font-weight="600">${count}</text>`;
    }

    svg += `<text x="${x + barWidth / 2}" y="${chartHeight + 16}" font-size="11" fill="var(--text-secondary, #8E8E93)" text-anchor="middle" font-family="-apple-system, sans-serif">${weekLabels[i]}</text>`;
  }

  svg += '</svg>';
  container.innerHTML = svg;
}
