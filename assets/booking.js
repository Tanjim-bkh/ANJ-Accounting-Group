/* The quote form's optional booking: a date picker (a month calendar in a popover) and a time picker (a list
   of half hours from 9:00 am to 4:30 pm), in the shadcn/ui manner, in plain JS.
   - Dates from today on, Monday to Saturday (Sundays closed); the week starts on Monday.
   - They open under "Book an appointment" (a checkbox); ticked, a date is asked for (the reason shows under the
     date through system.js's check on submit) and the time may stay "Any time"; unticked, neither is sent.
   - Both fields are text inputs that cannot be typed in, so the form sends them as words ("Thu 3 Dec 2026",
     "10:30 am") and system.js checks and marks them like the other fields.
   Keyboard: Enter, Space or Arrow Down opens; arrows move; Page Up and Page Down change the month; Home and End go
   to the start and end of the week (or the list); Enter picks; Escape closes; Backspace clears. */
(() => {
  const dateIn = document.getElementById('f-date');
  const timeIn = document.getElementById('f-time');
  const calPop = document.getElementById('f-date-pop');
  const list = document.getElementById('f-time-list');
  if (!dateIn || !timeIn || !calPop || !list) return;
  const dateField = dateIn.closest('.picker'), timeField = timeIn.closest('.picker');

  const icon = {
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
  };

  /* ------------------------------------------------------------ shared */
  const short = new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const long = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const monthName = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' });
  const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const same = (a, b) => !!a && !!b && a.getTime() === b.getTime();
  const today = day0(new Date());
  const closed = d => d < today || d.getDay() === 0;
  const firstOpen = from => { let d = from; while (closed(d)) d = addDays(d, 1); return d; };

  const nudge = el => el.dispatchEvent(new Event('input', { bubbles: true }));   // system.js re-checks a marked field on input

  // "Book an appointment" ticked asks for a date (the time may stay "Any time"); system.js shows the reason on
  // submit and, once shown, it follows the fields. Unticked, both are emptied and disabled, so they are neither
  // checked nor sent.
  const book = document.getElementById('f-book');
  const group = document.getElementById('booking-fields');
  const booking = () => !book || book.checked;
  const rule = () => {
    const msg = booking() && !dateIn.value ? 'Pick a date for your appointment.' : '';
    dateIn.setCustomValidity(msg);
    if (dateIn.getAttribute('aria-invalid') === 'true') {
      const err = document.getElementById('f-date-err');
      if (msg) { err.textContent = msg; err.hidden = false; }
      else { dateIn.removeAttribute('aria-invalid'); err.hidden = true; }
    }
  };

  // the popover under its field, or above it when the screen has no room below
  const place = (pop, field) => {
    const control = field.querySelector('.picker__control');
    pop.classList.remove('is-above');
    pop.style.top = `${control.offsetTop + control.offsetHeight + 6}px`;
    const r = pop.getBoundingClientRect(), c = control.getBoundingClientRect();
    const bar = document.querySelector('.actionbar');
    const floor = innerHeight - (bar && getComputedStyle(bar).display !== 'none' ? bar.offsetHeight : 0) - 8;
    const head = (document.querySelector('header.nav')?.offsetHeight || 0) + 8;
    if (r.bottom > floor && c.top - r.height - 6 > head) {
      pop.style.top = `${control.offsetTop - r.height - 6}px`;
      pop.classList.add('is-above');
    }
  };

  // typing is kept out: the value only comes from the popover
  const noTyping = input => {
    input.addEventListener('beforeinput', e => e.preventDefault());
    input.addEventListener('paste', e => e.preventDefault());
    input.addEventListener('drop', e => e.preventDefault());
  };
  noTyping(dateIn); noTyping(timeIn);

  /* ------------------------------------------------------------ the date */
  let picked = null, view = new Date(today.getFullYear(), today.getMonth(), 1), focusDay = today;
  const calOpen = () => !calPop.hidden;

  const renderCal = () => {
    const y = view.getFullYear(), m = view.getMonth();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;              // Monday first
    const count = new Date(y, m + 1, 0).getDate();
    const atStart = y === today.getFullYear() && m === today.getMonth();
    let rows = '', cells = '';
    for (let i = 0; i < lead; i++) cells += '<td></td>';
    for (let n = 1; n <= count; n++) {
      const d = new Date(y, m, n);
      const attrs = [
        `data-day="${n}"`,
        `tabindex="${same(d, focusDay) ? 0 : -1}"`,
        `aria-label="${long.format(d)}${d.getDay() === 0 ? ', closed' : ''}"`,
        same(d, picked) ? 'aria-selected="true"' : '',
        same(d, today) ? 'aria-current="date"' : '',
        closed(d) ? 'disabled' : ''
      ].join(' ');
      cells += `<td><button type="button" class="cal__day${same(d, today) ? ' is-today' : ''}" ${attrs}>${n}</button></td>`;
      if ((lead + n) % 7 === 0) { rows += `<tr>${cells}</tr>`; cells = ''; }
    }
    if (cells) rows += `<tr>${cells}${'<td></td>'.repeat(7 - ((lead + count) % 7))}</tr>`;
    calPop.innerHTML = `
      <div class="cal__head">
        <button type="button" class="cal__nav cal__nav--prev" aria-label="Previous month"${atStart ? ' disabled' : ''}>${icon.prev}</button>
        <div class="cal__title" aria-live="polite">${monthName.format(view)}</div>
        <button type="button" class="cal__nav cal__nav--next" aria-label="Next month">${icon.next}</button>
      </div>
      <table class="cal__grid" role="grid" aria-label="${monthName.format(view)}">
        <thead><tr>${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((w, i) => `<th scope="col" abbr="${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}">${w}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="cal__foot">
        <span class="cal__note">Closed on Sundays</span>
        ${picked ? '<button type="button" class="cal__clear">Clear</button>' : ''}
      </div>`;
  };

  const focusOn = d => {
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) view = new Date(d.getFullYear(), d.getMonth(), 1);
    focusDay = d;
    renderCal();
    calPop.querySelector(`.cal__day[data-day="${d.getDate()}"]`)?.focus();
  };

  const openCal = () => {
    if (calOpen()) return;
    closeList();
    focusDay = picked || firstOpen(today);
    view = new Date(focusDay.getFullYear(), focusDay.getMonth(), 1);
    renderCal();
    calPop.hidden = false;
    dateIn.setAttribute('aria-expanded', 'true');
    place(calPop, dateField);
    calPop.querySelector('.cal__day[tabindex="0"]')?.focus();
  };
  const closeCal = (refocus = true) => {
    if (!calOpen()) return;
    calPop.hidden = true;
    dateIn.setAttribute('aria-expanded', 'false');
    if (refocus) dateIn.focus();
  };
  const setDate = d => {
    picked = d;
    dateIn.value = d ? short.format(d) : '';
    rule(); nudge(dateIn);
  };

  dateIn.addEventListener('click', () => (calOpen() ? closeCal() : openCal()));
  dateIn.addEventListener('keydown', e => {
    if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); openCal(); }
    else if (['Backspace', 'Delete'].includes(e.key)) { e.preventDefault(); setDate(null); }
    else if (e.key === 'Escape') closeCal();
  });

  calPop.addEventListener('click', e => {
    const day = e.target.closest('.cal__day');
    if (day && !day.disabled) { setDate(new Date(view.getFullYear(), view.getMonth(), +day.dataset.day)); closeCal(); return; }
    if (e.target.closest('.cal__clear')) { setDate(null); closeCal(); return; }
    const nav = e.target.closest('.cal__nav');
    if (nav && !nav.disabled) {
      const step = nav.classList.contains('cal__nav--prev') ? -1 : 1;
      view = new Date(view.getFullYear(), view.getMonth() + step, 1);
      const first = new Date(view);
      focusDay = firstOpen(first < today ? today : first);
      if (focusDay.getMonth() !== view.getMonth()) focusDay = new Date(view);   // a month with no open day keeps the grid
      renderCal();
      calPop.querySelector(step < 0 ? '.cal__nav--prev:not(:disabled)' : '.cal__nav--next')?.focus()
        || calPop.querySelector('.cal__nav--next')?.focus();
    }
  });

  calPop.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeCal(); return; }
    const day = e.target.closest('.cal__day');
    if (!day) return;
    const cur = new Date(view.getFullYear(), view.getMonth(), +day.dataset.day);
    // step one day at a time past Sundays; a week keeps the weekday; never before today
    const go = (n, skip = true) => {
      let d = addDays(cur, n);
      while (skip && d.getDay() === 0) d = addDays(d, Math.sign(n));
      if (d < today) return;
      focusOn(d);
    };
    const keys = {
      ArrowLeft: () => go(-1), ArrowRight: () => go(1), ArrowUp: () => go(-7, false), ArrowDown: () => go(7, false),
      Home: () => go(-((cur.getDay() + 6) % 7)), End: () => go(5 - ((cur.getDay() + 6) % 7)),
      PageUp: () => { const d = new Date(cur.getFullYear(), cur.getMonth() - 1, Math.min(cur.getDate(), 28)); if (new Date(d.getFullYear(), d.getMonth() + 1, 0) >= today) focusOn(firstOpen(d < today ? today : d)); },
      PageDown: () => focusOn(firstOpen(new Date(cur.getFullYear(), cur.getMonth() + 1, Math.min(cur.getDate(), 28))))
    };
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  });

  /* ------------------------------------------------------------ the time */
  const slots = [];
  for (let min = 9 * 60; min <= 16 * 60 + 30; min += 30) {
    const h = Math.floor(min / 60), mm = String(min % 60).padStart(2, '0');
    slots.push(`${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'am' : 'pm'}`);
  }
  const items = [{ label: 'Any time', value: '' }, ...slots.map(s => ({ label: s, value: s }))];
  list.innerHTML = items.map((it, i) =>
    `<li id="f-time-opt-${i}" role="option" data-i="${i}" aria-selected="false"${it.value ? '' : ' class="is-muted"'}>${icon.check}${it.label}</li>`
    + (i === 0 ? '<li class="picker__sep" role="presentation"></li>' : '')).join('');
  const opts = [...list.querySelectorAll('[role="option"]')];
  let active = 0;
  const listOpen = () => !list.hidden;

  const activate = (i, scroll = true) => {
    active = Math.max(0, Math.min(opts.length - 1, i));
    opts.forEach((o, k) => o.classList.toggle('is-active', k === active));
    timeIn.setAttribute('aria-activedescendant', opts[active].id);
    if (scroll) opts[active].scrollIntoView({ block: 'nearest' });
  };
  const openList = () => {
    if (listOpen()) return;
    closeCal(false);
    list.hidden = false;
    timeIn.setAttribute('aria-expanded', 'true');
    place(list, timeField);
    const cur = items.findIndex(it => it.value && it.value === timeIn.value);
    activate(cur > 0 ? cur : 1);
    timeIn.focus();
  };
  const closeList = () => {
    if (!listOpen()) return;
    list.hidden = true;
    timeIn.setAttribute('aria-expanded', 'false');
    timeIn.removeAttribute('aria-activedescendant');
  };
  const setTime = i => {
    const v = items[i].value;
    timeIn.value = v;
    opts.forEach((o, k) => o.setAttribute('aria-selected', String(!!v && k === i)));
    rule(); nudge(timeIn);
  };

  timeIn.addEventListener('click', () => (listOpen() ? closeList() : openList()));
  timeIn.addEventListener('keydown', e => {
    if (!listOpen()) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); openList(); }
      else if (['Backspace', 'Delete'].includes(e.key)) { e.preventDefault(); setTime(0); }
      return;
    }
    const keys = {
      ArrowDown: () => activate(active + 1), ArrowUp: () => activate(active - 1),
      Home: () => activate(0), End: () => activate(opts.length - 1),
      PageDown: () => activate(active + 6), PageUp: () => activate(active - 6),
      Enter: () => { setTime(active); closeList(); }, ' ': () => { setTime(active); closeList(); },
      Escape: () => closeList()
    };
    if (e.key === 'Tab') { closeList(); return; }
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  });
  list.addEventListener('pointermove', e => { const o = e.target.closest('[role="option"]'); if (o) activate(+o.dataset.i, false); });
  list.addEventListener('mousedown', e => e.preventDefault());   // the focus stays on the field
  list.addEventListener('click', e => { const o = e.target.closest('[role="option"]'); if (o) { setTime(+o.dataset.i); closeList(); timeIn.focus(); } });

  /* ------------------------------------------------------------ closing */
  document.addEventListener('pointerdown', e => {
    if (calOpen() && !dateField.contains(e.target)) closeCal(false);
    if (listOpen() && !timeField.contains(e.target)) closeList();
  });
  dateField.addEventListener('focusout', e => { if (calOpen() && !dateField.contains(e.relatedTarget) && e.relatedTarget) closeCal(false); });
  timeField.addEventListener('focusout', e => { if (listOpen() && !timeField.contains(e.relatedTarget)) closeList(); });
  addEventListener('resize', () => { if (calOpen()) place(calPop, dateField); if (listOpen()) place(list, timeField); });

  /* ------------------------------------------------------------ the "Book an appointment" box */
  const showBooking = () => {
    const on = booking();
    if (group) group.hidden = !on;
    book?.setAttribute('aria-expanded', String(on));
    dateIn.disabled = timeIn.disabled = !on;
    dateIn.setAttribute('aria-required', String(on));
    if (!on) {
      closeCal(false); closeList();
      setDate(null); setTime(0);
      dateIn.removeAttribute('aria-invalid');
      const err = document.getElementById('f-date-err'); if (err) err.hidden = true;
    }
    rule();
  };
  book?.addEventListener('change', showBooking);

  // a form sent and emptied (system.js resets it) empties the pickers too
  dateIn.form?.addEventListener('reset', () => setTimeout(() => {
    picked = null;
    opts.forEach(o => o.setAttribute('aria-selected', 'false'));
    closeCal(false); closeList(); showBooking();
  }));

  showBooking();
})();
