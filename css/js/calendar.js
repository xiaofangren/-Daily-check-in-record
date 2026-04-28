class CalendarComponent {
  constructor(container) {
    this.container = container;
    this.currentDate = new Date();
    this.selectedDate = formatDate(new Date());
    this.datesWithRecords = new Set();
    this.touchStartX = 0;
    this.touchEndX = 0;
  }

  async render() {
    await this.loadDatesWithRecords();
    this.renderHTML();
    this.bindEvents();
  }

  async loadDatesWithRecords() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    try {
      const records = await getRecordsByDateRange(startDate, endDate);
      this.datesWithRecords = new Set(records.map(r => r.date));
    } catch (e) {
      console.error('Load calendar dates error:', e);
    }
  }

  renderHTML() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const today = formatDate(new Date());

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    let daysHTML = '';

    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      daysHTML += `<div class="calendar-day other-month">${day}</div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === today;
      const isSelected = dateStr === this.selectedDate;
      const hasRecord = this.datesWithRecords.has(dateStr);

      let classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (isSelected) classes += ' selected';

      daysHTML += `
        <div class="${classes}" data-date="${dateStr}">
          ${day}
          ${hasRecord ? '<div class="dot"></div>' : ''}
        </div>
      `;
    }

    const remainingCells = 42 - (firstDay + daysInMonth);
    for (let i = 1; i <= remainingCells; i++) {
      daysHTML += `<div class="calendar-day other-month">${i}</div>`;
    }

    this.container.innerHTML = `
      <div class="calendar-header">
        <button class="calendar-nav" id="cal-prev">‹</button>
        <span class="month-label">${year}年 ${monthNames[month]}</span>
        <button class="calendar-nav" id="cal-next">›</button>
      </div>
      <div class="calendar-weekdays">
        ${weekdays.map(d => `<div>${d}</div>`).join('')}
      </div>
      <div class="calendar-days" id="cal-days">
        ${daysHTML}
      </div>
    `;
  }

  bindEvents() {
    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');
    const daysContainer = document.getElementById('cal-days');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevMonth());
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextMonth());
    }

    if (daysContainer) {
      daysContainer.addEventListener('click', (e) => {
        const dayEl = e.target.closest('.calendar-day');
        if (!dayEl || dayEl.classList.contains('other-month')) return;
        const date = dayEl.dataset.date;
        if (date) {
          this.selectedDate = date;
          this.render();
          if (typeof renderHistoryList === 'function') {
            renderHistoryList();
          }
        }
      });
    }

    const calDays = document.getElementById('cal-days');
    if (calDays) {
      calDays.addEventListener('touchstart', (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      calDays.addEventListener('touchend', (e) => {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
      }, { passive: true });
    }
  }

  handleSwipe() {
    const diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        this.nextMonth();
      } else {
        this.prevMonth();
      }
    }
  }

  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.render();
  }

  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.render();
  }
}

window.calendarComponent = new CalendarComponent(document.getElementById('calendar-container'));
