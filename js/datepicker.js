// Custom accessible date picker — ARIA grid pattern with full keyboard nav
// Styled to match the BaseballScorecard.org design system

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export class DatePicker {
  constructor(containerEl, onDateSelected) {
    this.onDateSelected = onDateSelected;
    this.focusDay = new Date();
    this.selectedDay = new Date();
    this.isOpen = false;
    this.days = [];

    this.container = containerEl;
    this.container.classList.add('dp');

    // Build the display button (shows current date, opens calendar)
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'dp-toggle';
    this.button.setAttribute('aria-haspopup', 'dialog');
    this.button.setAttribute('aria-expanded', 'false');
    this.container.appendChild(this.button);

    // Build the dialog
    this.dialog = document.createElement('div');
    this.dialog.className = 'dp-dialog';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-label', 'Choose date');

    // Header: prev year, prev month, month-year label, next month, next year
    const header = document.createElement('div');
    header.className = 'dp-header';

    this.prevYearBtn = this._navBtn('Previous year', '\u00AB');
    this.prevMonthBtn = this._navBtn('Previous month', '\u2039');
    this.monthYearLabel = document.createElement('span');
    this.monthYearLabel.className = 'dp-month-year';
    this.monthYearLabel.setAttribute('aria-live', 'polite');
    this.nextMonthBtn = this._navBtn('Next month', '\u203A');
    this.nextYearBtn = this._navBtn('Next year', '\u00BB');

    header.append(this.prevYearBtn, this.prevMonthBtn, this.monthYearLabel, this.nextMonthBtn, this.nextYearBtn);
    this.dialog.appendChild(header);

    // Grid
    const table = document.createElement('table');
    table.className = 'dp-grid';
    table.setAttribute('role', 'grid');

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const d of DAYS) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = d;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    this.tbody = document.createElement('tbody');
    for (let i = 0; i < 6; i++) {
      const row = document.createElement('tr');
      for (let j = 0; j < 7; j++) {
        const td = document.createElement('td');
        td.tabIndex = -1;
        td.addEventListener('click', this._onDayClick.bind(this));
        td.addEventListener('keydown', this._onDayKeydown.bind(this));
        row.appendChild(td);
        this.days.push(td);
      }
      this.tbody.appendChild(row);
    }
    table.appendChild(this.tbody);
    this.dialog.appendChild(table);

    // Footer: Today button
    const footer = document.createElement('div');
    footer.className = 'dp-footer';
    this.todayBtn = document.createElement('button');
    this.todayBtn.type = 'button';
    this.todayBtn.className = 'dp-today';
    this.todayBtn.textContent = 'Today';
    footer.appendChild(this.todayBtn);
    this.dialog.appendChild(footer);

    this.container.appendChild(this.dialog);

    // Events
    this.button.addEventListener('click', () => this.isOpen ? this.close() : this.open());
    this.prevYearBtn.addEventListener('click', () => this._moveMonth(-12));
    this.prevMonthBtn.addEventListener('click', () => this._moveMonth(-1));
    this.nextMonthBtn.addEventListener('click', () => this._moveMonth(1));
    this.nextYearBtn.addEventListener('click', () => this._moveMonth(12));
    this.todayBtn.addEventListener('click', () => { this._select(new Date()); this.close(); });

    // Close on outside click
    document.addEventListener('pointerdown', (e) => {
      if (this.isOpen && !this.container.contains(e.target)) this.close();
    });

    // Close on Escape
    this.dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.close(); e.stopPropagation(); }
    });

    this.close();
    this._updateButton();
  }

  setDate(date) {
    this.selectedDay = new Date(date);
    this.focusDay = new Date(date);
    this._updateButton();
    if (this.isOpen) this._renderGrid();
  }

  open() {
    this.focusDay = new Date(this.selectedDay);
    this.isOpen = true;
    this.dialog.style.display = 'block';
    this.button.setAttribute('aria-expanded', 'true');
    this._renderGrid();
    this._setFocus();
  }

  close() {
    this.isOpen = false;
    this.dialog.style.display = 'none';
    this.button.setAttribute('aria-expanded', 'false');
    this.button.focus();
  }

  _navBtn(label, text) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dp-nav-btn';
    btn.setAttribute('aria-label', label);
    btn.textContent = text;
    return btn;
  }

  _updateButton() {
    const d = this.selectedDay;
    this.button.textContent = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    this.button.setAttribute('aria-label', `Change date, currently ${this.button.textContent}`);
  }

  _renderGrid() {
    const fd = this.focusDay;
    this.monthYearLabel.textContent = `${MONTHS[fd.getMonth()]} ${fd.getFullYear()}`;

    const first = new Date(fd.getFullYear(), fd.getMonth(), 1);
    const startOffset = first.getDay();
    first.setDate(first.getDate() - startOffset);

    const d = new Date(first);
    const today = new Date();
    const lastRow = this.tbody.rows[5];

    for (let i = 0; i < 42; i++) {
      const cell = this.days[i];
      const isOtherMonth = d.getMonth() !== fd.getMonth();
      const isSelected = this._sameDay(d, this.selectedDay);
      const isToday = this._sameDay(d, today);
      const isFocused = this._sameDay(d, fd);

      cell.textContent = isOtherMonth ? '' : d.getDate();
      cell.dataset.date = this._toISO(d);
      cell.className = '';
      cell.tabIndex = -1;
      cell.removeAttribute('aria-selected');

      if (isOtherMonth) {
        cell.classList.add('dp-outside');
      } else {
        if (isToday) cell.classList.add('dp-today-cell');
        if (isSelected) {
          cell.setAttribute('aria-selected', 'true');
          cell.classList.add('dp-selected');
        }
        if (isFocused) cell.tabIndex = 0;
      }

      if (i === 35) {
        lastRow.style.display = isOtherMonth ? 'none' : '';
      }

      d.setDate(d.getDate() + 1);
    }
  }

  _setFocus() {
    const cell = this.days.find(c => c.tabIndex === 0);
    if (cell) cell.focus();
  }

  _select(date) {
    this.selectedDay = new Date(date);
    this.focusDay = new Date(date);
    this._updateButton();
    this._renderGrid();
    if (this.onDateSelected) this.onDateSelected(new Date(date));
  }

  _moveMonth(n) {
    const d = this.focusDay;
    const newDate = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const daysInNew = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
    newDate.setDate(Math.min(d.getDate(), daysInNew));
    this.focusDay = newDate;
    this._renderGrid();
    this._setFocus();
  }

  _moveFocus(offset) {
    const d = new Date(this.focusDay);
    d.setDate(d.getDate() + offset);
    this.focusDay = d;
    if (d.getMonth() !== this.focusDay.getMonth) this._renderGrid();
    this._renderGrid();
    this._setFocus();
  }

  _onDayClick(e) {
    const cell = e.currentTarget;
    if (cell.classList.contains('dp-outside')) return;
    this._select(this._parseDate(cell.dataset.date));
    this.close();
  }

  _onDayKeydown(e) {
    let handled = true;
    switch (e.key) {
      case 'ArrowRight': this._moveFocus(1); break;
      case 'ArrowLeft': this._moveFocus(-1); break;
      case 'ArrowDown': this._moveFocus(7); break;
      case 'ArrowUp': this._moveFocus(-7); break;
      case 'Home': this._moveFocus(-this.focusDay.getDay()); break;
      case 'End': this._moveFocus(6 - this.focusDay.getDay()); break;
      case 'PageUp': this._moveMonth(e.shiftKey ? -12 : -1); break;
      case 'PageDown': this._moveMonth(e.shiftKey ? 12 : 1); break;
      case 'Enter': case ' ':
        this._select(this.focusDay);
        this.close();
        break;
      case 'Tab':
        this.close();
        handled = false;
        break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  _sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  _toISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  _parseDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}
