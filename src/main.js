import './style.css';
import { setItem, setItemSync, getItem, removeItem, loadFromCloud, onAuthChange } from './db.js';
import { signInWithEmail, signOut, getCurrentUser, signInWithGoogle } from './supabase.js';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js';
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

// Make auth functions available to inline handlers
window.signInWithEmail = signInWithEmail;
window.signOut = signOut;

function showPhase(id) {
    document.querySelectorAll('.phase-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.phase-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
    if (id === 'dashboard') setTimeout(initDashboard, 50);
    if (id === 'progress') setTimeout(initProgressTab, 50);
  }

  function showMealsPhase(phaseId, btn) {
    document.querySelectorAll('.meals-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.meals-phase-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(phaseId).classList.add('active');
    btn.classList.add('active');
  }

  function showMealWeek(weekId, btn, phaseId) {
    const phase = document.getElementById(phaseId);
    phase.querySelectorAll('.meal-week-block').forEach(b => b.classList.remove('active'));
    phase.querySelectorAll('.week-pill').forEach(b => b.classList.remove('active'));
    document.getElementById(weekId).classList.add('active');
    btn.classList.add('active');
  }

  function toggleCheck(item) {
    item.classList.toggle('checked');
    const check = item.querySelector('.grocery-check');
    check.textContent = item.classList.contains('checked') ? '✓' : '';
  }

  function resetGroceryList(btn) {
    const section = btn.closest('.grocery-section');
    section.querySelectorAll('.grocery-item').forEach(item => {
      item.classList.remove('checked');
      item.querySelector('.grocery-check').textContent = '';
    });
  }

  function toggleWeek(id) {
    const block = document.getElementById(id);
    block.classList.toggle('open');
  }

  function toggleDay(id) {
    const card = document.getElementById(id);
    card.classList.toggle('open');
  }

  // Auto-open first week
  document.getElementById('w1').classList.add('open');


  // ===== EXERCISE TRACKER =====
  function initExerciseTables() {
    document.querySelectorAll('.ex-table').forEach(table => {
      // Add header columns if not already enhanced
      if (table.dataset.enhanced) return;
      table.dataset.enhanced = '1';

      const headerRow = table.querySelector('tr');
      if (!headerRow) return;

      // Add Done + Weight headers
      const thDone = document.createElement('th');
      thDone.className = 'th-done';
      thDone.textContent = 'Done';
      const thWeight = document.createElement('th');
      thWeight.className = 'th-weight';
      thWeight.textContent = 'Weight Used';
      headerRow.insertBefore(thDone, headerRow.firstChild);
      headerRow.appendChild(thWeight);

      // Add checkbox + weight input to each data row
      const rows = table.querySelectorAll('tr:not(:first-child)');
      rows.forEach((row, idx) => {
        const tdCheck = document.createElement('td');
        tdCheck.className = 'ex-check-cell';
        const cb = document.createElement('div');
        cb.className = 'ex-checkbox';
        cb.onclick = function() {
          cb.classList.toggle('checked');
          row.classList.toggle('ex-done', cb.classList.contains('checked'));
          updateDayProgress(table);
        };
        tdCheck.appendChild(cb);
        row.insertBefore(tdCheck, row.firstChild);

        const tdWeight = document.createElement('td');
        const wrap = document.createElement('div');
        wrap.className = 'weight-input-wrap';
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'weight-input';
        inp.placeholder = '0';
        inp.min = '0';
        inp.step = '2.5';
        // Load saved value
        const saveKey = 'ex_' + (table.closest('[id]') ? table.closest('[id]').id : 'x') + '_' + idx;
        inp.dataset.saveKey = saveKey;
        const saved = getItem(saveKey);
        if (saved) inp.value = saved;
        inp.addEventListener('input', () => {
          setItem(saveKey, inp.value);
        });
        const unit = document.createElement('span');
        unit.className = 'weight-unit';
        unit.textContent = 'lbs';
        wrap.appendChild(inp);
        wrap.appendChild(unit);
        tdWeight.appendChild(wrap);
        row.appendChild(tdWeight);
      });

      // Add progress bar + download button after the table
      const dayContent = table.closest('.day-content');
      if (dayContent && !dayContent.querySelector('.day-progress-bar')) {
        // Progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'day-progress-bar';
        progressBar.innerHTML = '<span>Progress</span><div class="day-progress-track"><div class="day-progress-fill"></div></div><span class="day-progress-label">0 / ' + rows.length + '</span>';
        table.insertAdjacentElement('afterend', progressBar);

        // Download PDF button
        const dlBtn = document.createElement('button');
        dlBtn.className = 'day-download-btn';
        const dayCard = table.closest('.day-card');
        const dayName = dayCard ? (dayCard.querySelector('.day-name') ? dayCard.querySelector('.day-name').textContent : 'Workout') : 'Workout';
        const dayType = dayCard ? (dayCard.querySelector('.day-type') ? dayCard.querySelector('.day-type').textContent : '') : '';
        dlBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Workout Log (PDF)';
        dlBtn.onclick = () => downloadDayPDF(dayCard, dayName, dayType);
        progressBar.insertAdjacentElement('afterend', dlBtn);
      }
    });
  }

  function updateDayProgress(table) {
    const dayContent = table.closest('.day-content');
    if (!dayContent) return;
    const total = table.querySelectorAll('tr:not(:first-child)').length;
    const done = table.querySelectorAll('.ex-checkbox.checked').length;
    const fill = dayContent.querySelector('.day-progress-fill');
    const label = dayContent.querySelector('.day-progress-label');
    if (fill) fill.style.width = (total ? (done / total * 100) : 0) + '%';
    if (label) label.textContent = done + ' / ' + total;
  }

  function downloadDayPDF(dayCard, dayName, dayType) {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Collect exercise data
    const rows = dayCard.querySelectorAll('.ex-table tr:not(:first-child)');
    let tableRows = '';
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return;
      const done = row.classList.contains('ex-done');
      const exercise = cells[1] ? cells[1].textContent.trim() : '';
      const sets = cells[2] ? cells[2].textContent.trim() : '';
      const reps = cells[3] ? cells[3].textContent.trim() : '';
      const rest = cells[4] ? cells[4].textContent.trim() : '';
      const notes = cells[5] ? cells[5].textContent.trim() : '';
      const weightInp = row.querySelector('.weight-input');
      const weight = weightInp ? (weightInp.value || '—') : '—';
      tableRows += `
        <tr style="background:${done ? '#f0fff4' : 'white'}">
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:600;color:${done ? '#888' : '#111'};${done ? 'text-decoration:line-through' : ''}">${exercise}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;color:#e63022;font-weight:700">${sets}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;color:#c9a84c;font-weight:700">${reps}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;color:#3dba74">${rest}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:#333">${weight} lbs</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#666;font-size:11px">${notes}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:16px">${done ? '✅' : '⬜'}</td>
        </tr>`;
    });

    // Collect cardio notes
    let cardioHtml = '';
    const cardioBlocks = dayCard.querySelectorAll('.cardio-block');
    cardioBlocks.forEach(block => {
      const rows = block.querySelectorAll('.cardio-row');
      let items = '';
      rows.forEach(r => { items += '<li style="margin:4px 0;color:#444">' + r.textContent.trim() + '</li>'; });
      if (items) cardioHtml += '<ul style="margin:0;padding-left:18px">' + items + '</ul>';
    });

    const completedCount = dayCard.querySelectorAll('.ex-checkbox.checked').length;
    const totalCount = dayCard.querySelectorAll('.ex-table tr:not(:first-child)').length;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${dayName} Workout Log</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #111; padding: 32px; background: white; }
  .header { border-bottom: 4px solid #e63022; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 11px; letter-spacing: 3px; color: #e63022; text-transform: uppercase; margin-bottom: 6px; }
  h1 { font-size: 28px; font-weight: 900; color: #0a0a0a; letter-spacing: 1px; }
  .sub { font-size: 13px; color: #666; margin-top: 4px; }
  .meta { display: flex; gap: 24px; margin: 16px 0 24px; flex-wrap: wrap; }
  .meta-item { background: #f5f5f5; border-radius: 6px; padding: 10px 16px; }
  .meta-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #999; }
  .meta-val { font-size: 18px; font-weight: 700; color: #111; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead { background: #0a0a0a; color: white; }
  thead th { padding: 10px 10px; text-align: left; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
  thead th:nth-child(2), thead th:nth-child(3), thead th:nth-child(4), thead th:nth-child(5), thead th:nth-child(7) { text-align: center; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .section-title { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #e63022; margin: 20px 0 8px; font-weight: 700; }
  .cardio-box { background: #f0fff4; border-left: 3px solid #3dba74; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 20px; }
  .notes-box { background: #fff8e7; border: 1px solid #f0d080; border-radius: 6px; padding: 16px; margin-top: 16px; }
  .notes-title { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #c9a84c; margin-bottom: 8px; }
  .notes-lines { display: flex; flex-direction: column; gap: 10px; }
  .notes-line { border-bottom: 1px solid #e0c878; height: 18px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #eee; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
  .print-btn { display:inline-flex;align-items:center;gap:8px;margin-top:24px;padding:12px 24px;background:#e63022;color:white;border:none;border-radius:6px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:0.5px; }
  .print-btn:hover { background:#b01f14; }
  @media print { .print-btn { display:none!important; } }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">12-Week Transformation Plan — Workout Log</div>
    <h1>${dayName} &mdash; ${dayType}</h1>
    <div class="sub">${today}</div>
  </div>

  <div class="meta">
    <div class="meta-item"><div class="meta-label">Exercises</div><div class="meta-val">${totalCount}</div></div>
    <div class="meta-item"><div class="meta-label">Completed</div><div class="meta-val" style="color:${completedCount === totalCount ? '#3dba74' : '#e63022'}">${completedCount} / ${totalCount}</div></div>
    <div class="meta-item"><div class="meta-label">Status</div><div class="meta-val"><span class="progress-pill">${completedCount === totalCount ? 'COMPLETE ✓' : completedCount + ' Done'}</span></div></div>
  </div>

  <div class="section-title">Exercises &amp; Weight Log</div>
  <table>
    <thead>
      <tr>
        <th>Exercise</th>
        <th>Sets</th>
        <th>Reps</th>
        <th>Rest</th>
        <th>Weight Used</th>
        <th>Notes</th>
        <th>Done</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  ${cardioHtml ? '<div class="section-title">Cardio / Finisher</div><div class="cardio-box">' + cardioHtml + '</div>' : ''}

  <div class="notes-box">
    <div class="notes-title">Session Notes &amp; How I Felt</div>
    <div class="notes-lines">
      <div class="notes-line"></div>
      <div class="notes-line"></div>
      <div class="notes-line"></div>
      <div class="notes-line"></div>
      <div class="notes-line"></div>
    </div>
  </div>

  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>

  <div class="footer">
    <span>12-Week Transformation Plan &mdash; Personal Training Log</span>
    <span>Printed: ${today}</span>
  </div>
<script>window.onload=function(){setTimeout(function(){window.print()},800)}<\/script>
</body>
</html>`;

    // Works on Chrome iOS, Safari iOS, desktop Chrome/Firefox/Edge
    // Opens the workout log in a full-screen overlay inside the same page.
    // User taps the red Print button (or uses browser Share > Print) to save as PDF.

    const existing = document.getElementById('pdf-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pdf-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#fff;overflow-y:auto;-webkit-overflow-scrolling:touch;';

    // Top action bar
    const bar = document.createElement('div');
    bar.id = 'pdf-bar';
    bar.style.cssText = 'position:sticky;top:0;background:#e63022;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;z-index:10;gap:10px;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);';

    const title = document.createElement('span');
    title.style.cssText = 'font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;flex:1;';
    title.textContent = 'WORKOUT LOG — Tap Print to save as PDF';

    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:8px;';

    const printBtn = document.createElement('button');
    printBtn.style.cssText = 'background:#fff;color:#e63022;border:none;border-radius:6px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer;font-family:Arial,sans-serif;';
    printBtn.textContent = '🖨 Print / Save PDF';
    printBtn.addEventListener('click', function() { window.print(); });

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:rgba(0,0,0,0.2);color:#fff;border:none;border-radius:6px;padding:9px 14px;font-weight:700;font-size:14px;cursor:pointer;';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', function() {
      overlay.remove();
      document.body.style.overflow = '';
    });

    btnWrap.appendChild(printBtn);
    btnWrap.appendChild(closeBtn);
    bar.appendChild(title);
    bar.appendChild(btnWrap);

    // Log body
    const logBody = document.createElement('div');
    logBody.style.cssText = 'padding:0;';
    logBody.innerHTML = html;
    logBody.querySelectorAll('script').forEach(function(s){ s.remove(); });
    logBody.querySelectorAll('.print-btn').forEach(function(b){ b.remove(); });

    overlay.appendChild(bar);
    overlay.appendChild(logBody);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Inject print styles so only the log prints (not the rest of the page)
    let ps = document.getElementById('pdf-print-style');
    if (!ps) {
      ps = document.createElement('style');
      ps.id = 'pdf-print-style';
      document.head.appendChild(ps);
    }
    ps.textContent = [
      '@media print {',
        'body > *:not(#pdf-overlay) { display:none !important; }',
        '#pdf-overlay { position:static !important; overflow:visible !important; height:auto !important; }',
        '#pdf-bar { display:none !important; }',
      '}'
    ].join('');
  }

  // Init tables whenever a day is opened
  document.addEventListener('click', function(e) {
    const header = e.target.closest('.day-header');
    if (header) {
      setTimeout(initExerciseTables, 50);
    }
    // Also init on week open
    const weekHeader = e.target.closest('.week-header');
    if (weekHeader) {
      setTimeout(initExerciseTables, 50);
    }
  });

  // Init any already-open tables on load
  setTimeout(initExerciseTables, 200);


  /* TODAY MODE */
  const DAY_MAP=[
    {phase:'p1',week:'w1',card:'w1-mon',label:'Push — Chest / Shoulders / Triceps'},
    {phase:'p1',week:'w1',card:'w1-tue',label:'Pull — Back / Biceps'},
    {phase:'p1',week:'w1',card:'w1-wed',label:'Legs — Quads / Hamstrings / Calves'},
    {phase:'p1',week:'w1',card:'w1-thu',label:'Cardio + Core'},
    {phase:'p1',week:'w1',card:'w1-fri',label:'Push — Repeat Monday'},
    {phase:'p1',week:'w1',card:'w1-sat',label:'Pull — Repeat Tuesday'},
    {phase:'p1',week:'w1',card:'w1-sun',label:'Active Rest'},
    {phase:'p1',week:'w2',card:'w2-mon',label:'Push — Chest / Shoulders / Triceps'},
    {phase:'p1',week:'w2',card:'w2-tue',label:'Pull — Back / Biceps'},
    {phase:'p1',week:'w2',card:'w2-wed',label:'Legs — Quads / Hamstrings / Glutes'},
    {phase:'p1',week:'w2',card:'w2-thu',label:'Cardio + Core'},
    {phase:'p1',week:'w2',card:'w2-fri',label:'Push — Repeat Monday'},
    {phase:'p1',week:'w2',card:'w2-sat',label:'Pull — Repeat Tuesday'},
    {phase:'p1',week:'w2',card:'w2-sun',label:'Active Rest'},
    {phase:'p1',week:'w3',card:'w3-mon',label:'Push — Chest / Shoulders / Triceps'},
    {phase:'p1',week:'w3',card:'w3-tue',label:'Pull — Back / Biceps'},
    {phase:'p1',week:'w3',card:'w3-wed',label:'Legs — Quads / Hamstrings / Glutes'},
    {phase:'p1',week:'w3',card:'w3-thu',label:'Cardio + Core'},
    {phase:'p1',week:'w3',card:'w3-fri',label:'Push — Repeat Monday'},
    {phase:'p1',week:'w3',card:'w3-sat',label:'Pull — Repeat Tuesday'},
    {phase:'p1',week:'w3',card:'w3-sun',label:'Active Rest'},
    {phase:'p1',week:'w4',card:'w4-mon',label:'Push — Deload'},
    {phase:'p1',week:'w4',card:'w4-tue',label:'Pull — Deload'},
    {phase:'p1',week:'w4',card:'w4-wed',label:'Legs — Deload'},
    {phase:'p1',week:'w4',card:'w4-thu',label:'Cardio + Mobility'},
    {phase:'p1',week:'w4',card:'w4-fri',label:'Push — Light Deload'},
    {phase:'p1',week:'w4',card:'w4-sat',label:'Pull — Light Deload'},
    {phase:'p1',week:'w4',card:'w4-sun',label:'Full Rest — Phase 1 Complete'},
    {phase:'p2',week:'w5',card:'w5-mon',label:'Push -- Chest / Shoulders / Triceps'},
    {phase:'p2',week:'w5',card:'w5-tue',label:'Pull -- Back / Biceps'},
    {phase:'p2',week:'w5',card:'w5-wed',label:'Legs Day 1 -- Quad Dominant'},
    {phase:'p2',week:'w5',card:'w5-thu',label:'HIIT Cardio + Core'},
    {phase:'p2',week:'w5',card:'w5-fri',label:'Push -- Repeat Monday'},
    {phase:'p2',week:'w5',card:'w5-sat',label:'Legs Day 2 -- Posterior Chain'},
    {phase:'p2',week:'w5',card:'w5-sun',label:'Active Rest'},
    {phase:'p2',week:'w6',card:'w6-mon',label:'Push -- Chest / Shoulders / Triceps'},
    {phase:'p2',week:'w6',card:'w6-tue',label:'Pull -- Back / Biceps'},
    {phase:'p2',week:'w6',card:'w6-wed',label:'Legs Day 1 -- Quad Dominant'},
    {phase:'p2',week:'w6',card:'w6-thu',label:'HIIT Cardio + Core'},
    {phase:'p2',week:'w6',card:'w6-fri',label:'Push -- Repeat Monday'},
    {phase:'p2',week:'w6',card:'w6-sat',label:'Legs Day 2 -- Posterior Chain'},
    {phase:'p2',week:'w6',card:'w6-sun',label:'Active Rest'},
    {phase:'p2',week:'w7',card:'w7-mon',label:'Push -- Chest / Shoulders / Triceps'},
    {phase:'p2',week:'w7',card:'w7-tue',label:'Pull -- Back / Biceps'},
    {phase:'p2',week:'w7',card:'w7-wed',label:'Legs Day 1 -- Quad Dominant'},
    {phase:'p2',week:'w7',card:'w7-thu',label:'HIIT Cardio + Core'},
    {phase:'p2',week:'w7',card:'w7-fri',label:'Push -- Repeat Monday'},
    {phase:'p2',week:'w7',card:'w7-sat',label:'Legs Day 2 -- Posterior Chain'},
    {phase:'p2',week:'w7',card:'w7-sun',label:'Active Rest'},
    {phase:'p2',week:'w8',card:'w8-mon',label:'Push -- Deload'},
    {phase:'p2',week:'w8',card:'w8-tue',label:'Pull -- Deload'},
    {phase:'p2',week:'w8',card:'w8-wed',label:'Legs -- Deload'},
    {phase:'p2',week:'w8',card:'w8-thu',label:'Active Recovery'},
    {phase:'p2',week:'w8',card:'w8-fri',label:'Push -- Light Deload'},
    {phase:'p2',week:'w8',card:'w8-sat',label:'Legs -- Light Deload'},
    {phase:'p2',week:'w8',card:'w8-sun',label:'Rest -- Phase 2 Complete'},
    {phase:'p3',week:'w9',card:'w9-mon',label:'Upper Body -- Power'},
    {phase:'p3',week:'w9',card:'w9-tue',label:'HIIT Cardio + Core'},
    {phase:'p3',week:'w9',card:'w9-wed',label:'Legs -- Full Protocol'},
    {phase:'p3',week:'w9',card:'w9-thu',label:'Zone 2 Cardio'},
    {phase:'p3',week:'w9',card:'w9-fri',label:'Upper Body -- Volume'},
    {phase:'p3',week:'w9',card:'w9-sat',label:'HIIT or Long Walk'},
    {phase:'p3',week:'w9',card:'w9-sun',label:'Active Rest'},
    {phase:'p3',week:'w10',card:'w10-mon',label:'Upper Body -- Power'},
    {phase:'p3',week:'w10',card:'w10-tue',label:'HIIT Cardio + Core'},
    {phase:'p3',week:'w10',card:'w10-wed',label:'Legs -- Full Protocol'},
    {phase:'p3',week:'w10',card:'w10-thu',label:'Zone 2 Cardio'},
    {phase:'p3',week:'w10',card:'w10-fri',label:'Upper Body -- Volume'},
    {phase:'p3',week:'w10',card:'w10-sat',label:'HIIT or Long Walk'},
    {phase:'p3',week:'w10',card:'w10-sun',label:'Active Rest'},
    {phase:'p3',week:'w11',card:'w11-mon',label:'Upper Body -- Power'},
    {phase:'p3',week:'w11',card:'w11-tue',label:'HIIT Cardio + Core'},
    {phase:'p3',week:'w11',card:'w11-wed',label:'Legs -- Full Protocol'},
    {phase:'p3',week:'w11',card:'w11-thu',label:'Zone 2 Cardio'},
    {phase:'p3',week:'w11',card:'w11-fri',label:'Upper Body -- Volume'},
    {phase:'p3',week:'w11',card:'w11-sat',label:'HIIT or Long Walk'},
    {phase:'p3',week:'w11',card:'w11-sun',label:'Active Rest'},
    {phase:'p3',week:'w12',card:'w12-mon',label:'Upper Body -- Peak (Low Carb Day 1)'},
    {phase:'p3',week:'w12',card:'w12-tue',label:'HIIT + Core (Low Carb Day 2)'},
    {phase:'p3',week:'w12',card:'w12-wed',label:'Legs -- Final Depletion'},
    {phase:'p3',week:'w12',card:'w12-thu',label:'Upper Body -- Carb Load Day 1'},
    {phase:'p3',week:'w12',card:'w12-fri',label:'Upper Body -- Carb Load Day 2'},
    {phase:'p3',week:'w12',card:'w12-sat',label:'PHOTO DAY -- Program Complete'},
    {phase:'p3',week:'w12',card:'w12-sun',label:'Program Complete'},
  ];

  function getStartDate(){const s=getItem('programStartDate');return s?new Date(s+'T00:00:00'):null;}
  function calcTodayInfo(){
    const start=getStartDate();if(!start)return null;
    const now=new Date();now.setHours(0,0,0,0);
    const d=Math.floor((now-start)/86400000);
    if(d<0)return{future:true,diffDays:d};
    if(d>=84)return{done:true,diffDays:d};
    return{weekNum:Math.floor(d/7)+1,phaseNum:d<28?1:d<56?2:3,daysLeft:83-d,diffDays:d,entry:DAY_MAP[d]||null};
  }
  function updateTodayStrip(){
    const info=calcTodayInfo();
    const wEl=document.getElementById('ts-week');
    const dEl=document.getElementById('ts-day');
    const phEl=document.getElementById('ts-phase');
    const remEl=document.getElementById('ts-remaining');
    const dot=document.getElementById('ts-dot-week');
    if(!info){if(remEl)remEl.textContent='Tap to set your program start date';return;}
    if(info.future){if(remEl)remEl.textContent='Program starts in '+Math.abs(info.diffDays)+' days';return;}
    if(info.done){if(wEl)wEl.textContent='12';if(dEl)dEl.textContent='84';if(phEl)phEl.textContent='COMPLETE';if(remEl)remEl.textContent='12 weeks complete';if(dot)dot.classList.remove('active');return;}
    if(wEl)wEl.textContent=info.weekNum;
    if(dEl)dEl.textContent=info.diffDays+1;
    if(phEl)phEl.textContent='PHASE '+info.phaseNum;
    if(remEl)remEl.textContent=(info.daysLeft)+' days left — '+(info.entry?info.entry.label:'');
    if(dot)dot.classList.add('active');
  }
  function openTodayModal(){
    const modal=document.getElementById('start-modal');
    const inp=document.getElementById('start-date-input');
    const saved=getItem('programStartDate');
    if(saved&&inp)inp.value=saved;
    if(modal)modal.classList.add('open');
  }
  function confirmStartDate(){
    const inp=document.getElementById('start-date-input');
    if(!inp||!inp.value)return;
    setItem('programStartDate',inp.value);
    const modal=document.getElementById('start-modal');
    if(modal)modal.classList.remove('open');
    updateTodayStrip();
    navigateToToday();
  }
  const startModal=document.getElementById('start-modal');
  if(startModal)startModal.addEventListener('click',function(e){if(e.target===this)this.classList.remove('open');});
  function navigateToToday(){
    const info=calcTodayInfo();
    if(!info||info.future||info.done||!info.entry)return;
    const{phase,week,card}=info.entry;
    document.querySelectorAll('.phase-section').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('.phase-btn').forEach(b=>b.classList.remove('active'));
    const phEl=document.getElementById(phase);if(phEl)phEl.classList.add('active');
    document.querySelectorAll('.phase-btn').forEach(b=>{const oc=b.getAttribute('onclick')||'';if(oc.includes("'"+phase+"'"))b.classList.add('active');});
    document.querySelectorAll('.week-block').forEach(w=>w.classList.remove('open'));
    const weekEl=document.getElementById(week);
    if(weekEl){weekEl.classList.add('open');setTimeout(()=>weekEl.scrollIntoView({behavior:'smooth',block:'start'}),100);}
    if(card){
      document.querySelectorAll('.day-card').forEach(d=>d.classList.remove('open'));
      const cardEl=document.getElementById(card);
      if(cardEl){cardEl.classList.add('open');setTimeout(()=>{initExerciseTables();cardEl.scrollIntoView({behavior:'smooth',block:'nearest'});},200);}
    }
  }
  updateTodayStrip();
  if(getItem('programStartDate'))setTimeout(navigateToToday,400);

  /* WEEK RINGS */
  const WEEK_DAYS_MAP={
    'w1':['w1-mon','w1-tue','w1-wed','w1-thu','w1-fri','w1-sat'],
    'w2':['w2-mon','w2-tue','w2-wed','w2-thu','w2-fri','w2-sat'],
    'w3':['w3-mon','w3-tue','w3-wed','w3-thu','w3-fri','w3-sat'],
    'w4':['w4-mon','w4-tue','w4-wed','w4-thu','w4-fri','w4-sat'],
    'w5':['w5-mon','w5-tue','w5-wed','w5-thu','w5-fri','w5-sat'],
    'w6':['w6-mon','w6-tue','w6-wed','w6-thu','w6-fri','w6-sat'],
    'w7':['w7-mon','w7-tue','w7-wed','w7-thu','w7-fri','w7-sat'],
    'w8':['w8-mon','w8-tue','w8-wed','w8-thu','w8-fri','w8-sat'],
    'w9':['w9-mon','w9-tue','w9-wed','w9-thu','w9-fri','w9-sat'],
    'w10':['w10-mon','w10-tue','w10-wed','w10-thu','w10-fri','w10-sat'],
    'w11':['w11-mon','w11-tue','w11-wed','w11-thu','w11-fri','w11-sat'],
    'w12':['w12-mon','w12-tue','w12-wed','w12-thu','w12-fri','w12-sat'],
  };
  function getWeekCompletion(weekId){
    const days=WEEK_DAYS_MAP[weekId]||[];
    if(!days.length)return{done:0,total:6};
    let done=0;days.forEach(id=>{if(getItem('wday_'+id)==='1')done++;});
    return{done,total:days.length};
  }
  function buildWeekRing(weekId){
    const header=document.querySelector('#'+weekId+' > .week-header');
    if(!header||header.querySelector('.week-ring-wrap'))return;
    const{done,total}=getWeekCompletion(weekId);
    const r=13,circ=2*Math.PI*r,offset=(circ-(done/total)*circ).toFixed(2);
    const wrap=document.createElement('div');wrap.className='week-ring-wrap';wrap.dataset.weekId=weekId;
    const isComplete=done===total&&total>0;
    wrap.innerHTML='<svg width="32" height="32" viewBox="0 0 32 32" style="transform:rotate(-90deg)"><circle class="week-ring-bg" cx="16" cy="16" r="'+r+'" stroke-width="2.5"/><circle class="week-ring-fill'+(isComplete?' complete':'')+(done===0?' zero':'')+'" cx="16" cy="16" r="'+r+'" stroke-width="2.5" stroke-dasharray="'+circ.toFixed(2)+'" stroke-dashoffset="'+offset+'"/></svg><span class="week-ring-count'+(isComplete?' complete':'')+'">'+done+'/'+total+'</span>';
    const arrow=header.querySelector('.week-arrow');
    if(arrow)header.insertBefore(wrap,arrow);else header.appendChild(wrap);
  }
  function updateWeekRing(weekId){
    const wrap=document.querySelector('.week-ring-wrap[data-week-id="'+weekId+'"]');
    if(!wrap)return;
    const{done,total}=getWeekCompletion(weekId);
    const r=13,circ=2*Math.PI*r,offset=(circ-(done/total)*circ).toFixed(2);
    const arc=wrap.querySelector('.week-ring-fill');
    const lbl=wrap.querySelector('.week-ring-count');
    const isComplete=done===total&&total>0;
    if(arc){arc.style.strokeDashoffset=offset;arc.classList.toggle('complete',isComplete);arc.classList.toggle('zero',done===0);}
    if(lbl){lbl.textContent=done+'/'+total;lbl.classList.toggle('complete',isComplete);}
    if(isComplete){const h=document.querySelector('#'+weekId+' > .week-header');if(h){h.classList.add('just-completed');setTimeout(()=>h.classList.remove('just-completed'),1400);}}
  }
  function markDayDone(cardId,complete){
    if(complete)setItem('wday_'+cardId,'1');else removeItem('wday_'+cardId);
    for(const[wId,days]of Object.entries(WEEK_DAYS_MAP)){if(days.includes(cardId)){updateWeekRing(wId);break;}}
  }
  function initWeekRings(){Object.keys(WEEK_DAYS_MAP).forEach(id=>{if(document.getElementById(id))buildWeekRing(id);});}
  setTimeout(initWeekRings,150);

  /* WEIGHT HISTORY */
  function getWHist(key){try{return JSON.parse(getItem(key+'_h')||'[]');}catch(e){return[];}}
  function pushWHist(key,val){
    if(!val||isNaN(parseFloat(val)))return;
    const h=getWHist(key);const n=parseFloat(val);
    if(h.length&&h[h.length-1]===n)return;
    h.push(n);if(h.length>5)h.shift();
    setItem(key+'_h',JSON.stringify(h));
  }
  function renderWHist(key,container){
    let old=container.querySelector('.weight-history');if(old)old.remove();
    const h=getWHist(key);if(!h.length)return;
    const wrap=document.createElement('div');wrap.className='weight-history';
    const maxV=Math.max(...h);
    const isPR=h.length>=2&&h[h.length-1]===maxV;
    h.forEach((w,i)=>{
      if(i>0){const a=document.createElement('span');a.className='wh-arrow';const d=h[i]-h[i-1];a.textContent=d>0?'↑':d<0?'↓':'→';a.classList.add(d>0?'up':d<0?'down':'same');wrap.appendChild(a);}
      const c=document.createElement('span');c.className='wh-chip'+(i===h.length-1?' wh-latest':'');c.textContent=w+'lbs';wrap.appendChild(c);
    });
    if(isPR){const p=document.createElement('span');p.className='wh-pr-badge';p.textContent='PR';wrap.appendChild(p);}
    container.appendChild(wrap);
  }

  /* Patch initExerciseTables to add history + ring wiring */
  const _baseInit=initExerciseTables;
  initExerciseTables=function(){
    _baseInit();
    document.querySelectorAll('.weight-input').forEach(inp=>{
      const key=inp.dataset.saveKey;if(!key||inp.dataset.hInited)return;
      inp.dataset.hInited='1';
      const td=inp.closest('td');if(!td)return;
      renderWHist(key,td);
      inp.addEventListener('change',function(){if(this.value){pushWHist(key,this.value);renderWHist(key,td);}});
    });
    document.querySelectorAll('.day-card').forEach(card=>{
      if(card.dataset.ringWired)return;card.dataset.ringWired='1';
      const cId=card.id;if(!cId)return;
      card.addEventListener('click',function(e){
        if(!e.target.closest('.ex-checkbox'))return;
        setTimeout(()=>{
          const total=card.querySelectorAll('.ex-checkbox').length;
          const done=card.querySelectorAll('.ex-checkbox.checked').length;
          markDayDone(cId,total>0&&done===total);
        },60);
      });
    });
  };

  /* REST TIMER */
  let _rtInt=null,_rtRem=0,_rtTot=0;
  function _parseRest(t){t=t.trim().toLowerCase();return t.includes('min')?Math.round(parseFloat(t)*60):parseInt(t)||60;}
  function startRestTimer(secs,exName){
    clearInterval(_rtInt);_rtTot=secs;_rtRem=secs;
    const timer=document.getElementById('rest-timer');
    const cd=document.getElementById('rt-countdown');
    const ex=document.getElementById('rt-exercise');
    const lbl=document.getElementById('rt-label');
    const arc=document.getElementById('rt-ring-arc');
    const C=94.25;
    if(!timer)return;
    timer.classList.add('visible');timer.classList.remove('pulsing');
    cd.classList.remove('done');
    ex.textContent=exName?'After: '+exName:'Rest';
    function tick(){
      const m=Math.floor(_rtRem/60),s=_rtRem%60;
      cd.textContent=m>0?m+':'+String(s).padStart(2,'0'):s+'s';
      lbl.textContent=_rtRem+'s';
      arc.style.strokeDashoffset=(C-(_rtRem/_rtTot)*C).toFixed(2);
      if(_rtRem<=0){
        clearInterval(_rtInt);cd.textContent='GO!';cd.classList.add('done');lbl.textContent='✓';arc.style.strokeDashoffset=C.toFixed(2);
        timer.classList.add('pulsing');
        document.querySelectorAll('.rest-badge.active-timer').forEach(b=>b.classList.remove('active-timer'));
        (function(){
          try{
            const ctx=new(window.AudioContext||window.webkitAudioContext)();
            function beep(freq,start,dur,vol){
              const o=ctx.createOscillator();const g=ctx.createGain();
              o.connect(g);g.connect(ctx.destination);
              o.type='sine';o.frequency.value=freq;
              g.gain.setValueAtTime(0,ctx.currentTime+start);
              g.gain.linearRampToValueAtTime(vol,ctx.currentTime+start+0.01);
              g.gain.linearRampToValueAtTime(0,ctx.currentTime+start+dur);
              o.start(ctx.currentTime+start);o.stop(ctx.currentTime+start+dur+0.05);
            }
            beep(880,0,0.12,0.6);
            beep(880,0.15,0.12,0.6);
            beep(1320,0.32,0.28,0.7);
          }catch(e){}
        })();
        return;
      }
      _rtRem--;
    }
    tick();_rtInt=setInterval(tick,1000);
  }
  function dismissTimer(){
    clearInterval(_rtInt);
    const t=document.getElementById('rest-timer');if(t){t.classList.remove('visible','pulsing');}
    document.querySelectorAll('.rest-badge.active-timer').forEach(b=>b.classList.remove('active-timer'));
  }
  document.addEventListener('click',function(e){
    const badge=e.target.closest('.rest-badge');if(!badge)return;
    e.stopPropagation();
    const row=badge.closest('tr');
    const exName=row&&row.cells[1]?row.cells[1].textContent.trim():'';
    const secs=_parseRest(badge.textContent);
    if(badge.classList.contains('active-timer')){dismissTimer();return;}
    document.querySelectorAll('.rest-badge.active-timer').forEach(b=>b.classList.remove('active-timer'));
    badge.classList.add('active-timer');
    startRestTimer(secs,exName);
  });


  /* ══════════════════════════════════════════════════════
     USER PROFILE ENGINE
  ══════════════════════════════════════════════════════ */

  const GOAL_CONFIG = {
    'fat-loss':   { label:'Fat Loss',    calAdj:-400, protMult:1.0, carbMult:0.8, fatMult:0.75, statLabel:'Lose Fat'   },
    'muscle':     { label:'Build Muscle',calAdj:+300, protMult:1.0, carbMult:1.2, fatMult:1.0,  statLabel:'Build Muscle'},
    'recomp':     { label:'Body Recomp', calAdj:-100, protMult:1.1, carbMult:0.9, fatMult:0.85, statLabel:'Recomposition'},
    'endurance':  { label:'Endurance',   calAdj:-200, protMult:0.9, carbMult:1.3, fatMult:0.8,  statLabel:'Endurance'  },
    'strength':   { label:'Raw Strength',calAdj:+100, protMult:1.0, carbMult:1.0, fatMult:1.0,  statLabel:'Max Strength'},
    'general':    { label:'General Fit', calAdj:-150, protMult:0.9, carbMult:1.0, fatMult:0.9,  statLabel:'Get Fit'    },
  };

  // ── Program customization by fitness level / profile ──────────────────────

  const EXERCISE_CAT = {
    'barbell bench press':'cup','incline dumbbell press':'cup','dumbbell bench press':'cup',
    'overhead dumbbell press':'cup','barbell overhead press':'cup','dumbbell shoulder press':'cup',
    'barbell bent-over row':'cupl','cable seated row':'cupl','dumbbell single-arm row':'cupl',
    'lat pulldown':'cupl','cable row':'cupl','t-bar row':'cupl',
    'barbell squat':'clo','back squat':'clo','front squat':'clo','deadlift':'clo',
    'romanian deadlift':'clo','sumo deadlift':'clo','barbell hip thrust':'clo',
    'bulgarian split squat':'clo','goblet squat':'clo',
    'leg press':'mlo','hack squat':'mlo','smith machine squat':'mlo',
    'pull-ups / assisted pull-ups':'bw','pull-ups':'bw','chin-ups':'bw',
    'push-ups':'bw','dips':'bw','walking lunges':'bw','lunges':'bw',
    'dumbbell lateral raise':'iso','cable tricep pushdown':'iso','overhead tricep extension':'iso',
    'barbell curl':'iso','hammer curl':'iso','preacher curl':'iso','incline curl':'iso',
    'leg curl':'iso','leg extension':'iso','calf raises':'iso','seated calf raise':'iso',
    'cable fly':'iso','pec deck':'iso','rear delt fly':'iso','face pulls':'iso',
  };

  // [beginner, intermediate, advanced] weight ranges as fraction of bodyweight
  const W_PCTS = {
    cup:  { male:[[0.30,0.45],[0.60,0.80],[0.90,1.15]], female:[[0.18,0.28],[0.35,0.50],[0.60,0.80]] },
    cupl: { male:[[0.28,0.42],[0.55,0.75],[0.85,1.10]], female:[[0.16,0.26],[0.30,0.48],[0.55,0.75]] },
    clo:  { male:[[0.45,0.65],[0.85,1.15],[1.25,1.65]], female:[[0.28,0.45],[0.55,0.85],[0.95,1.25]] },
    mlo:  { male:[[0.80,1.20],[1.40,1.90],[2.20,3.00]], female:[[0.60,0.90],[1.00,1.50],[1.80,2.50]] },
    iso:  { male:[[0.05,0.09],[0.10,0.17],[0.17,0.26]], female:[[0.03,0.06],[0.07,0.12],[0.11,0.18]] },
  };

  function getWeightSuggestion(exerciseName, p) {
    const cat = EXERCISE_CAT[exerciseName.toLowerCase().trim()];
    if (!cat || cat === 'bw') return null;
    const lvlIdx = { beginner:0, intermediate:1, advanced:2 }[p.fitnessLevel || 'intermediate'] ?? 1;
    const range = W_PCTS[cat]?.[p.sex === 'female' ? 'female' : 'male']?.[lvlIdx];
    if (!range) return null;
    const lo = Math.max(5, Math.round(p.weight * range[0] / 5) * 5);
    const hi = Math.round(p.weight * range[1] / 5) * 5;
    return [lo, hi];
  }

  function applyProgramCustomization(p) {
    if (!p) return;
    const level = p.fitnessLevel || 'intermediate';
    const isOlderAdult = (p.age || 30) >= 50;

    document.querySelectorAll('.ex-table tr:not(:first-child)').forEach(row => {
      const setsEl = row.querySelector('.sets-badge');
      const restEl = row.querySelector('.rest-badge');

      if (setsEl) {
        if (!setsEl.dataset.orig) setsEl.dataset.orig = setsEl.textContent;
        const origSets = parseInt(setsEl.dataset.orig) || 3;
        if (level === 'beginner')  setsEl.textContent = Math.max(2, origSets - 1);
        else if (level === 'advanced') setsEl.textContent = origSets + 1;
        else setsEl.textContent = setsEl.dataset.orig;
      }

      if (restEl) {
        if (!restEl.dataset.orig) restEl.dataset.orig = restEl.textContent;
        const origSec = parseInt(restEl.dataset.orig) || 90;
        let adjSec = origSec;
        if (level === 'beginner') adjSec = Math.min(origSec + 30, 150);
        else if (level === 'advanced') adjSec = Math.max(origSec - 15, 45);
        if (isOlderAdult) adjSec = Math.min(adjSec + 15, 180);
        restEl.textContent = restEl.dataset.orig === restEl.textContent
          ? adjSec + 's'
          : adjSec + 's';
        restEl.textContent = adjSec + 's';
      }

      // Weight suggestion: update input placeholder + add hint below
      const nameCell = row.querySelector('td:nth-child(2)');
      const weightInp = row.querySelector('.weight-input');
      if (nameCell && weightInp) {
        const suggestion = getWeightSuggestion(nameCell.textContent, p);
        if (suggestion) {
          const [lo, hi] = suggestion;
          weightInp.placeholder = lo + '-' + hi;
          const wrap = weightInp.closest('.weight-input-wrap');
          if (wrap) {
            // Restructure wrap to have an inner row for input+unit if not done yet
            if (!wrap.querySelector('.weight-input-row')) {
              const unit = wrap.querySelector('.weight-unit');
              const row2 = document.createElement('div');
              row2.className = 'weight-input-row';
              wrap.insertBefore(row2, weightInp);
              row2.appendChild(weightInp);
              if (unit) row2.appendChild(unit);
            }
            // Add or update hint
            let hint = wrap.querySelector('.weight-hint');
            if (!hint) {
              hint = document.createElement('div');
              hint.className = 'weight-hint';
              wrap.appendChild(hint);
            }
            hint.textContent = lo + '–' + hi + ' lbs';
          }
        }
      }
    });
  }

  function loadProfile() {
    try { return JSON.parse(getItem('userProfile') || 'null'); }
    catch(e) { return null; }
  }

  function getProfile() {
    return loadProfile() || { age:45, weight:200, sex:'male', heightFt:5, heightIn:10, activity:1.55, goal:'fat-loss', fitnessLevel:'intermediate' };
  }

  function calcMacros(p) {
    // Mifflin-St Jeor BMR
    const weightKg = p.weight * 0.453592;
    const heightCm = ((p.heightFt * 12) + p.heightIn) * 2.54;
    const bmr = p.sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * p.age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * p.age - 161;
    const tdee = Math.round(bmr * p.activity);
    const cfg = GOAL_CONFIG[p.goal] || GOAL_CONFIG['fat-loss'];
    const targetCal = Math.max(1200, tdee + cfg.calAdj);

    // Protein: ~0.8-1g per lb bodyweight scaled by goal
    const protG = Math.round(p.weight * 0.85 * cfg.protMult);
    // Fat: ~25-30% of calories
    const fatG = Math.round((targetCal * 0.27 * cfg.fatMult) / 9);
    // Carbs: remainder
    const carbG = Math.round(Math.max(80, (targetCal - protG * 4 - fatG * 9) / 4 * cfg.carbMult));

    // Max HR and Zone 2
    const maxHR = 220 - p.age;
    const z2Low = Math.round(maxHR * 0.65);
    const z2High = Math.round(maxHR * 0.70);

    return { tdee, targetCal, protG, carbG, fatG, maxHR, z2Low, z2High };
  }

  function selectGoal(tile) {
    document.querySelectorAll('.pm-goal-tile').forEach(t => t.classList.remove('selected'));
    tile.classList.add('selected');
    updateMacroPreview();
  }

  function updateMacroPreview() {
    const p = readFormValues();
    const m = calcMacros(p);
    const el = (id) => document.getElementById(id);
    if(el('pm-prev-cal'))  el('pm-prev-cal').textContent  = m.targetCal.toLocaleString();
    if(el('pm-prev-prot')) el('pm-prev-prot').textContent = m.protG + 'g';
    if(el('pm-prev-carb')) el('pm-prev-carb').textContent = m.carbG + 'g';
    if(el('pm-prev-fat'))  el('pm-prev-fat').textContent  = m.fatG + 'g';
  }

  function readFormValues() {
    const sel = document.querySelector('.pm-goal-tile.selected');
    return {
      age:          parseInt(document.getElementById('pm-age')?.value)          || 45,
      weight:       parseInt(document.getElementById('pm-weight')?.value)       || 200,
      sex:          document.getElementById('pm-sex')?.value                    || 'male',
      heightFt:     parseInt(document.getElementById('pm-height-ft')?.value)    || 5,
      heightIn:     parseInt(document.getElementById('pm-height-in')?.value)    || 10,
      activity:     parseFloat(document.getElementById('pm-activity')?.value)   || 1.55,
      fitnessLevel: document.getElementById('pm-fitness-level')?.value          || 'intermediate',
      goal:         sel ? sel.dataset.goal : 'fat-loss',
    };
  }

  function populateForm(p) {
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    set('pm-age', p.age);
    set('pm-weight', p.weight);
    set('pm-sex', p.sex);
    set('pm-height-ft', p.heightFt);
    set('pm-height-in', p.heightIn);
    set('pm-activity', p.activity);
    set('pm-fitness-level', p.fitnessLevel || 'intermediate');
    // Goal tiles
    document.querySelectorAll('.pm-goal-tile').forEach(t => {
      t.classList.toggle('selected', t.dataset.goal === p.goal);
    });
    updateMacroPreview();
  }

  function openProfileModal(isFirstTime) {
    const p = getProfile();
    populateForm(p);
    const desc = document.getElementById('pm-header-desc');
    if (desc) {
      desc.textContent = isFirstTime
        ? 'Welcome! Fill out your profile to get a personalized workout program tailored to your age, fitness level, and goal.'
        : 'Update your stats and goal. Macros, calorie targets, heart rate zones, and tips will recalculate instantly.';
    }
    document.getElementById('profile-modal').classList.add('open');
  }

  function closeProfileModal() {
    document.getElementById('profile-modal').classList.remove('open');
  }

  document.getElementById('profile-modal').addEventListener('click', function(e) {
    if(e.target === this) closeProfileModal();
  });

  async function saveProfile() {
    const p = readFormValues();
    applyProfileToUI(p);
    closeProfileModal();

    // Save locally + sync to cloud (awaited)
    const result = await setItemSync('userProfile', JSON.stringify(p));

    // Toast with sync status — show error reason if failed
    const toast = document.createElement('div');
    if (result.ok) {
      toast.textContent = '✓ Profile saved & synced to cloud';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#3dba74;color:#000;padding:11px 22px;border-radius:8px;font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;z-index:99999;max-width:90vw;text-align:center;';
    } else {
      toast.textContent = '⚠ Saved locally — cloud sync failed: ' + result.reason;
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#e63022;color:#fff;padding:11px 22px;border-radius:8px;font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;z-index:99999;max-width:90vw;text-align:center;';
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }

  function applyProfileToUI(p) {
    const m = calcMacros(p);
    const cfg = GOAL_CONFIG[p.goal] || GOAL_CONFIG['fat-loss'];
    const el = (id) => document.getElementById(id);
    const heightStr = p.heightFt + "'" + p.heightIn + '"';
    const sexLabel = p.sex === 'male' ? 'Male' : 'Female';

    // Hero subtitle
    const goalVerb = { 'fat-loss':'lose fat & build muscle', 'muscle':'build muscle & strength', 'recomp':'recomp body composition', 'endurance':'build endurance & stamina', 'strength':'maximize raw strength', 'general':'improve overall fitness' };
    const levelLabel = { beginner:'Beginner', intermediate:'Intermediate', advanced:'Advanced' }[p.fitnessLevel || 'intermediate'];
    if(el('hero-sub-text')) el('hero-sub-text').textContent =
      'A complete 12-week ' + levelLabel + ' program designed for a ' + p.age + '-year-old ' + sexLabel.toLowerCase() + ' at ' + p.weight + ' lbs (' + heightStr + ') to ' + (goalVerb[p.goal] || 'reach your goal') + '. Three progressive phases. Every session mapped. No guesswork.';

    // Stats bar
    if(el('stat-goal'))    el('stat-goal').textContent    = cfg.statLabel;
    if(el('stat-profile')) el('stat-profile').textContent = p.weight + ' lbs';

    // Profile chip
    const chipWrap = el('profile-chip-wrap');
    if(chipWrap) chipWrap.innerHTML =
      '<div class="profile-chip"><div class="profile-chip-dot"></div>' +
      p.age + 'y · ' + p.weight + 'lbs · ' + heightStr + ' · ' + sexLabel + ' · ' + cfg.label +
      '</div>';

    // Nutrition section
    if(el('nut-phase-desc')) el('nut-phase-desc').textContent =
      'You cannot out-train a bad diet. At ' + p.weight + ' lbs targeting ' + cfg.label.toLowerCase() + ', here are your daily targets.';
    if(el('nut-calories')) el('nut-calories').textContent = (m.targetCal - 100).toLocaleString() + '–' + (m.targetCal + 100).toLocaleString();
    if(el('nut-calories-note')) el('nut-calories-note').textContent =
      cfg.calAdj < 0 ? Math.abs(cfg.calAdj) + ' cal deficit for fat loss' : cfg.calAdj > 0 ? '+' + cfg.calAdj + ' cal surplus for muscle gain' : 'Maintenance calories';
    if(el('nut-protein')) el('nut-protein').textContent = (m.protG - 10) + '–' + (m.protG + 10) + 'g';
    if(el('nut-protein-note')) el('nut-protein-note').textContent = '~' + (m.protG / p.weight).toFixed(2) + 'g per lb bodyweight';
    if(el('nut-carbs')) el('nut-carbs').textContent = (m.carbG - 10) + '–' + (m.carbG + 20) + 'g';
    if(el('nut-fat')) el('nut-fat').textContent = (m.fatG - 5) + '–' + (m.fatG + 10) + 'g';
    if(el('nut-fat-note')) el('nut-fat-note').textContent = p.sex === 'male' ? 'Healthy fats for testosterone support' : 'Healthy fats for hormone support';

    // Zone 2 HR
    if(el('zone2-hr')) el('zone2-hr').textContent =
      '220 − ' + p.age + ' = ' + m.maxHR + ' max HR → target ' + m.z2Low + '–' + m.z2High + ' bpm';

    // Tips
    if(el('tip-sleep')) el('tip-sleep').textContent =
      p.age >= 40 ? 'At ' + p.age + ', sleep is when testosterone and growth hormone are released.' :
      'Quality sleep is critical for recovery and hormone production.';
    if(el('tip-warmup')) el('tip-warmup').textContent =
      p.age >= 40 ? 'At ' + p.age + ', this is non-negotiable for joint health and injury prevention.' :
      'Even younger athletes benefit enormously from proper warm-up.';
    if(el('tip-protein')) el('tip-protein').textContent = m.protG + 'g+';

    // Meal plan badge values
    const mpCalEl = document.querySelector('#meals .phase-badge .badge-val');
    if(mpCalEl) mpCalEl.textContent = (m.targetCal - 100).toLocaleString() + '-' + (m.targetCal + 100).toLocaleString() + ' cal';
    const mpProtEl = document.querySelectorAll('#meals .phase-badge .badge-val')[1];
    if(mpProtEl) mpProtEl.textContent = (m.protG - 10) + '-' + (m.protG + 10) + 'g / day';

    // Apply workout customization (delay to ensure exercise tables are initialized)
    setTimeout(() => applyProgramCustomization(p), 500);
  }

  // Apply saved profile on load
  (function initProfile() {
    const p = loadProfile();
    if(p) {
      applyProfileToUI(p);
    } else {
      // First time — apply defaults to show the chip
      applyProfileToUI(getProfile());
    }
  })();

// Expose functions to global scope for inline onclick handlers
window.showPhase = showPhase;
window.showMealsPhase = showMealsPhase;
window.showMealWeek = showMealWeek;
window.toggleCheck = toggleCheck;
window.resetGroceryList = resetGroceryList;
window.toggleWeek = toggleWeek;
window.toggleDay = toggleDay;
window.openTodayModal = openTodayModal;
window.confirmStartDate = confirmStartDate;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.saveProfile = saveProfile;
window.selectGoal = selectGoal;
window.updateMacroPreview = updateMacroPreview;
window.applyProgramCustomization = applyProgramCustomization;
window.dismissTimer = dismissTimer;

// ── Auth UI + Cloud Sync ──────────────────────────────────────────────────────

function refreshAllUI() {
  updateTodayStrip();
  if (getItem('programStartDate')) navigateToToday();
  const p = loadProfile();
  if (p) applyProfileToUI(p); else applyProfileToUI(getProfile());
  initWeekRings();
  setTimeout(initExerciseTables, 200);
  setTimeout(() => applyProgramCustomization(loadProfile() || getProfile()), 600);
}

function updateAuthUI(user) {
  const authModal  = document.getElementById('auth-modal');
  const authBar    = document.getElementById('auth-bar');
  const authStatus = document.getElementById('auth-status');

  if (user) {
    // Hide login modal, show top bar
    if (authModal) authModal.classList.add('hidden');
    if (authBar)   authBar.style.display = 'flex';
    if (authStatus) authStatus.textContent = user.email;
  } else {
    // Show login modal, hide top bar
    if (authModal) authModal.classList.remove('hidden');
    if (authBar)   authBar.style.display = 'none';
    // Reset form state
    const formDefault = document.getElementById('auth-form-default');
    const formSent    = document.getElementById('auth-form-sent');
    const btn         = document.getElementById('auth-modal-btn');
    if (formDefault) formDefault.style.display = 'block';
    if (formSent)    formSent.style.display    = 'none';
    if (btn)         { btn.textContent = 'Send Magic Link →'; btn.disabled = false; }
  }
}

function dismissAuthModal() {
  const authModal = document.getElementById('auth-modal');
  if (authModal) authModal.classList.add('hidden');
}

async function handleModalSignIn() {
  const input = document.getElementById('auth-modal-email');
  const email = input ? input.value.trim() : '';
  if (!email) { input && input.focus(); return; }
  const btn = document.getElementById('auth-modal-btn');
  let errEl = document.getElementById('auth-error-msg');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.id = 'auth-error-msg';
    errEl.style.cssText = 'color:#e63022;font-size:13px;margin-top:10px;text-align:center;';
    btn && btn.insertAdjacentElement('afterend', errEl);
  }
  errEl.textContent = '';
  if (btn) { btn.innerHTML = 'Sending…'; btn.disabled = true; }
  const { error } = await signInWithEmail(email);
  if (error) {
    errEl.textContent = error.message;
    if (btn) { btn.innerHTML = 'Send Magic Link <span class="auth-arrow">→</span>'; btn.disabled = false; }
  } else {
    const formDefault = document.getElementById('auth-form-default');
    const formSent    = document.getElementById('auth-form-sent');
    const sentEmail   = document.getElementById('auth-sent-email');
    if (formDefault) formDefault.style.display = 'none';
    if (formSent)    formSent.style.display    = 'block';
    if (sentEmail)   sentEmail.textContent     = email;
  }
}

async function handleSignOut() {
  await signOut();
  updateAuthUI(null);
}

window.handleModalSignIn = handleModalSignIn;
window.handleSignOut     = handleSignOut;
window.dismissAuthModal  = dismissAuthModal;

// On load: check auth state, pull cloud data if logged in
onAuthChange(async (event, user) => {
  updateAuthUI(user);
  if (user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
    const isFirstTime = !loadProfile();
    const loaded = await loadFromCloud(refreshAllUI);
    if (!loaded) refreshAllUI();
    // Open profile modal for first-time users after UI is ready
    if (isFirstTime && !loadProfile()) {
      setTimeout(() => openProfileModal(true), 800);
    }
  }
});

// ══════════════════════════════════════════════════════════════
// GOOGLE OAUTH
// ══════════════════════════════════════════════════════════════
async function handleGoogleSignIn() {
  const btn = document.getElementById('auth-google-btn');
  if (btn) { btn.textContent = 'Redirecting…'; btn.disabled = true; }
  const { error } = await signInWithGoogle();
  if (error) {
    let errEl = document.getElementById('auth-error-msg');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.id = 'auth-error-msg';
      errEl.style.cssText = 'color:#e63022;font-size:13px;margin-top:10px;text-align:center;';
      btn && btn.insertAdjacentElement('afterend', errEl);
    }
    errEl.textContent = error.message;
    if (btn) { btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg> Continue with Google'; btn.disabled = false; }
  }
}
window.handleGoogleSignIn = handleGoogleSignIn;

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════

function calcStreak() {
  if (!getItem('programStartDate')) return 0;
  const start = new Date(getItem('programStartDate'));
  const today = new Date();
  today.setHours(0,0,0,0);
  let streak = 0;
  let d = new Date(today);
  while (true) {
    const diff = Math.round((d - start) / 86400000);
    if (diff < 0) break;
    const entry = DAY_MAP[diff];
    if (!entry) break;
    const done = getItem('wday_' + entry.card) === '1';
    if (done) { streak++; d.setDate(d.getDate() - 1); }
    else if (d.getTime() === today.getTime()) { d.setDate(d.getDate() - 1); } // allow today incomplete
    else break;
  }
  return streak;
}

function getCompletionStats() {
  let done = 0;
  DAY_MAP.forEach(e => { if (getItem('wday_' + e.card) === '1') done++; });
  return { done, total: DAY_MAP.length };
}

function getRecentPRs() {
  const prs = [];
  document.querySelectorAll('.ex-table').forEach(table => {
    const dayCard = table.closest('.day-card');
    if (!dayCard) return;
    const rows = table.querySelectorAll('tr:not(:first-child)');
    rows.forEach((row, idx) => {
      const saveKey = 'ex_' + dayCard.id + '_' + idx;
      const hist = JSON.parse(getItem(saveKey + '_h') || '[]');
      if (hist.length < 2) return;
      const latest = hist[hist.length - 1];
      const prev = Math.max(...hist.slice(0, -1));
      if (latest > prev) {
        const exNameCell = row.querySelectorAll('td')[1];
        const name = exNameCell ? exNameCell.textContent.trim() : saveKey;
        prs.push({ name, weight: latest });
      }
    });
  });
  return prs.slice(-6).reverse();
}

function getBadges() {
  const { done } = getCompletionStats();
  const streak = calcStreak();
  const profile = loadProfile();
  return [
    { id: 'first-day',   icon: '🏋️', label: 'First Session',   earned: done >= 1 },
    { id: 'one-week',    icon: '7️⃣',  label: 'One Week Done',   earned: done >= 6 },
    { id: 'phase1',      icon: '1️⃣',  label: 'Phase 1 Complete', earned: done >= 24 },
    { id: 'phase2',      icon: '2️⃣',  label: 'Phase 2 Complete', earned: done >= 48 },
    { id: 'champion',    icon: '🏆', label: '12-Week Champion', earned: done >= 72 },
    { id: 'streak7',     icon: '🔥', label: '7-Day Streak',    earned: streak >= 7 },
    { id: 'streak30',    icon: '⚡',  label: '30-Day Streak',   earned: streak >= 30 },
    { id: 'profiled',    icon: '👤', label: 'Profile Set',     earned: !!profile },
    { id: 'halfway',     icon: '🎯', label: 'Halfway There',   earned: done >= 42 },
  ];
}

function initDashboard() {
  // Stats
  const { done, total } = getCompletionStats();
  const streak = calcStreak();
  const pct = Math.round(done / total * 100);
  const todayInfo = calcTodayInfo ? calcTodayInfo() : null;

  const el = id => document.getElementById(id);
  if (el('dash-streak')) el('dash-streak').textContent = streak;
  if (el('dash-days-done')) el('dash-days-done').textContent = done + ' / ' + total;
  if (el('dash-pct')) el('dash-pct').textContent = pct + '%';
  if (el('dash-phase-val')) {
    if (todayInfo && !todayInfo.future && !todayInfo.done) {
      el('dash-phase-val').textContent = 'Phase ' + todayInfo.phaseNum;
    } else { el('dash-phase-val').textContent = done > 0 ? '✓ Done' : '—'; }
  }

  // Today's workout
  const todayEl = el('dash-today');
  if (todayEl) {
    if (!getItem('programStartDate')) {
      todayEl.innerHTML = '<div class="dash-no-start">No start date set. <a onclick="openTodayModal()">Set your start date</a> to track your progress.</div>';
    } else if (todayInfo && todayInfo.future) {
      todayEl.innerHTML = '<div class="dash-no-start">Program hasn\'t started yet.</div>';
    } else if (todayInfo && todayInfo.done) {
      todayEl.innerHTML = '<div class="dash-done-msg">PROGRAM COMPLETE 🏆</div>';
    } else if (todayInfo && todayInfo.entry) {
      const e = todayInfo.entry;
      const typeClass = e.label.toLowerCase().includes('push') ? 'push' : e.label.toLowerCase().includes('pull') ? 'pull' : e.label.toLowerCase().includes('leg') ? 'legs' : e.label.toLowerCase().includes('rest') ? 'rest' : e.label.toLowerCase().includes('cardio') ? 'cardio' : 'full';
      todayEl.innerHTML = '<div class="dash-today-card" onclick="navigateToToday()"><div class="dash-today-type day-type ' + typeClass + '">' + typeClass.toUpperCase() + '</div><div class="dash-today-label">' + e.label + '</div><div class="dash-today-meta">Week ' + todayInfo.weekNum + ' · Day ' + (todayInfo.diffDays + 1) + ' of 84</div><button class="dash-today-go">GO TO WORKOUT →</button></div>';
    } else {
      todayEl.innerHTML = '<div class="dash-no-start">No workout data found.</div>';
    }
  }

  // Badges
  const badgesEl = el('dash-badges');
  if (badgesEl) {
    const badges = getBadges();
    if (badges.filter(b => b.earned).length === 0) {
      badgesEl.innerHTML = '<div class="dash-empty">Complete your first workout to earn badges.</div>';
    } else {
      badgesEl.innerHTML = badges.map(b =>
        '<div class="badge-pill ' + (b.earned ? 'earned' : 'locked') + '"><span class="badge-icon">' + b.icon + '</span>' + b.label + '</div>'
      ).join('');
    }
  }

  // PRs
  const prsEl = el('dash-prs');
  if (prsEl) {
    const prs = getRecentPRs();
    if (prs.length === 0) {
      prsEl.innerHTML = '<div class="dash-empty">No PRs yet. Log your weights and beat them next session!</div>';
    } else {
      prsEl.innerHTML = prs.map(p =>
        '<div class="pr-card"><div class="pr-exercise">' + p.name + '</div><div class="pr-weight">' + p.weight + '<span class="pr-unit"> lbs</span></div></div>'
      ).join('');
    }
  }
}

// ══════════════════════════════════════════════════════════════
// PROGRESS TAB — BODY WEIGHT CHART
// ══════════════════════════════════════════════════════════════
let bwChartInstance = null;
let strengthChartInstance = null;

function getBWLog() { return JSON.parse(getItem('bw_log') || '[]'); }
function saveBWLog(log) { setItem('bw_log', JSON.stringify(log)); }

function logBodyWeight() {
  const inp = document.getElementById('prog-bw-input');
  const dateInp = document.getElementById('prog-bw-date');
  const val = parseFloat(inp ? inp.value : '');
  if (!val || val < 50 || val > 600) { inp && inp.focus(); return; }
  const date = (dateInp && dateInp.value) ? dateInp.value : new Date().toISOString().slice(0,10);
  const log = getBWLog();
  const existing = log.findIndex(e => e.date === date);
  if (existing >= 0) log[existing].weight = val; else log.push({ date, weight: val });
  log.sort((a,b) => a.date.localeCompare(b.date));
  saveBWLog(log);
  if (inp) inp.value = '';
  renderBWChart();
}

function renderBWChart() {
  const log = getBWLog();
  const emptyEl = document.getElementById('bw-empty');
  const canvas = document.getElementById('bw-chart');
  if (!canvas) return;
  if (log.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    canvas.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  canvas.style.display = 'block';
  const labels = log.map(e => e.date.slice(5)); // MM-DD
  const data = log.map(e => e.weight);
  if (bwChartInstance) bwChartInstance.destroy();
  bwChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Body Weight (lbs)',
        data,
        borderColor: '#e63022',
        backgroundColor: 'rgba(230,48,34,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#e63022',
        pointRadius: 4,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      plugins: { tooltip: { callbacks: { label: ctx => ctx.parsed.y + ' lbs' } } },
      scales: {
        x: { ticks: { color: '#888', font: { size: 11 } }, grid: { color: '#222' } },
        y: { ticks: { color: '#888', font: { size: 11 }, callback: v => v + ' lbs' }, grid: { color: '#222' } }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
// PROGRESS TAB — MEASUREMENTS
// ══════════════════════════════════════════════════════════════
function getMeasurements() { return JSON.parse(getItem('measurements_log') || '[]'); }
function saveMeasurements_data(log) { setItem('measurements_log', JSON.stringify(log)); }

function openMeasurementsModal() {
  const modal = document.getElementById('measurements-modal');
  if (modal) { modal.style.display = 'flex'; }
  const dateInp = document.getElementById('mm-date');
  if (dateInp && !dateInp.value) dateInp.value = new Date().toISOString().slice(0,10);
}
function closeMeasurementsModal() {
  const modal = document.getElementById('measurements-modal');
  if (modal) modal.style.display = 'none';
}

function saveMeasurements() {
  const date = document.getElementById('mm-date')?.value || new Date().toISOString().slice(0,10);
  const entry = {
    date,
    chest:  parseFloat(document.getElementById('mm-chest')?.value) || null,
    waist:  parseFloat(document.getElementById('mm-waist')?.value) || null,
    hips:   parseFloat(document.getElementById('mm-hips')?.value) || null,
    arms:   parseFloat(document.getElementById('mm-arms')?.value) || null,
    thighs: parseFloat(document.getElementById('mm-thighs')?.value) || null,
  };
  const log = getMeasurements();
  const idx = log.findIndex(e => e.date === date);
  if (idx >= 0) log[idx] = entry; else log.push(entry);
  log.sort((a,b) => a.date.localeCompare(b.date));
  saveMeasurements_data(log);
  closeMeasurementsModal();
  renderMeasurementsTable();
}

function renderMeasurementsTable() {
  const log = getMeasurements();
  const emptyEl = document.getElementById('measurements-empty');
  const table = document.getElementById('measurements-table');
  const tbody = document.getElementById('measurements-tbody');
  if (!tbody) return;
  if (log.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (table) table.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (table) table.style.display = 'table';
  const fmt = v => v != null ? v + '"' : '—';
  tbody.innerHTML = [...log].reverse().map(e =>
    '<tr><td>' + e.date + '</td><td>' + fmt(e.chest) + '</td><td>' + fmt(e.waist) + '</td><td>' + fmt(e.hips) + '</td><td>' + fmt(e.arms) + '</td><td>' + fmt(e.thighs) + '</td></tr>'
  ).join('');
}

// ══════════════════════════════════════════════════════════════
// PROGRESS TAB — STRENGTH CHART
// ══════════════════════════════════════════════════════════════
function populateExerciseSelect() {
  const sel = document.getElementById('exercise-select');
  if (!sel) return;
  const exercises = [];
  document.querySelectorAll('.ex-table').forEach(table => {
    const dayCard = table.closest('.day-card');
    if (!dayCard) return;
    const rows = table.querySelectorAll('tr:not(:first-child)');
    rows.forEach((row, idx) => {
      const saveKey = 'ex_' + dayCard.id + '_' + idx;
      const hist = JSON.parse(getItem(saveKey + '_h') || '[]');
      if (hist.length === 0) return;
      const cells = row.querySelectorAll('td');
      const nameCell = cells[1] || cells[0];
      const name = nameCell ? nameCell.textContent.trim().slice(0,40) : saveKey;
      if (!exercises.find(e => e.key === saveKey))
        exercises.push({ key: saveKey, name });
    });
  });
  sel.innerHTML = '<option value="">— Select Exercise —</option>' +
    exercises.map(e => '<option value="' + e.key + '">' + e.name + '</option>').join('');
}

function renderStrengthChart() {
  const sel = document.getElementById('exercise-select');
  const key = sel ? sel.value : '';
  const emptyEl = document.getElementById('strength-empty');
  const canvas = document.getElementById('strength-chart');
  if (!canvas) return;
  if (!key) {
    if (emptyEl) emptyEl.style.display = 'block';
    canvas.style.display = 'none';
    return;
  }
  const hist = JSON.parse(getItem(key + '_h') || '[]');
  if (hist.length === 0) {
    if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = 'No data for this exercise yet.'; }
    canvas.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  canvas.style.display = 'block';
  const labels = hist.map((_, i) => 'Session ' + (i + 1));
  if (strengthChartInstance) strengthChartInstance.destroy();
  strengthChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Weight (lbs)',
        data: hist,
        borderColor: '#c9a84c',
        backgroundColor: 'rgba(201,168,76,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#c9a84c',
        pointRadius: 5,
        tension: 0.2,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      plugins: { tooltip: { callbacks: { label: ctx => ctx.parsed.y + ' lbs' } } },
      scales: {
        x: { ticks: { color: '#888', font: { size: 11 } }, grid: { color: '#222' } },
        y: { ticks: { color: '#888', font: { size: 11 }, callback: v => v + ' lbs' }, grid: { color: '#222' } }
      }
    }
  });
}

function initProgressTab() {
  renderBWChart();
  renderMeasurementsTable();
  populateExerciseSelect();
  const bwDate = document.getElementById('prog-bw-date');
  if (bwDate && !bwDate.value) bwDate.value = new Date().toISOString().slice(0,10);
}

// ══════════════════════════════════════════════════════════════
// EXPORT CSV
// ══════════════════════════════════════════════════════════════
function exportCSV() {
  const rows = [];
  // Body weight
  rows.push(['=== BODY WEIGHT ===']);
  rows.push(['Date', 'Weight (lbs)']);
  getBWLog().forEach(e => rows.push([e.date, e.weight]));
  rows.push([]);
  // Measurements
  rows.push(['=== MEASUREMENTS ===']);
  rows.push(['Date', 'Chest', 'Waist', 'Hips', 'Arms', 'Thighs']);
  getMeasurements().forEach(e => rows.push([e.date, e.chest||'', e.waist||'', e.hips||'', e.arms||'', e.thighs||'']));
  rows.push([]);
  // Exercise weights
  rows.push(['=== EXERCISE LOGS ===']);
  rows.push(['Exercise', 'Session 1', 'Session 2', 'Session 3', 'Session 4', 'Session 5']);
  document.querySelectorAll('.ex-table').forEach(table => {
    const dayCard = table.closest('.day-card');
    if (!dayCard) return;
    table.querySelectorAll('tr:not(:first-child)').forEach((row, idx) => {
      const saveKey = 'ex_' + dayCard.id + '_' + idx;
      const hist = JSON.parse(getItem(saveKey + '_h') || '[]');
      if (hist.length === 0) return;
      const cells = row.querySelectorAll('td');
      const nameCell = cells[1] || cells[0];
      const name = nameCell ? nameCell.textContent.trim().slice(0,40) : saveKey;
      rows.push([name, ...hist]);
    });
  });
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '12week-progress-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Expose all new functions
window.logBodyWeight = logBodyWeight;
window.openMeasurementsModal = openMeasurementsModal;
window.closeMeasurementsModal = closeMeasurementsModal;
window.saveMeasurements = saveMeasurements;
window.renderStrengthChart = renderStrengthChart;
window.exportCSV = exportCSV;

// Init dashboard on load
setTimeout(initDashboard, 300);

getCurrentUser().then(user => updateAuthUI(user));