/**
 * GRADES.JS — Module de Notas organizado por Bimestres.
 *
 * Structure:
 *   [Primer Bimestre ▼] [Segundo Bimestre] [Tercer Bimestre] [Cuarto Bimestre]
 *     → Tabs: Salon 2D | Salon 2E
 *       → Dropdown: Álgebra, Aritmética, etc.
 *         → Table with grades
 */

const Grades = (() => {
    'use strict';

    const state = {
        bimesters: {},
        currentBimester: null,
        currentBook: null,
        currentCourse: null,
        currentData: null,
        hasChanges: false,
        changes: {},
        professorToken: null,
    };

    const dom = {};

    function init() {
        dom.classroomSelector = document.getElementById('grades-classroom-selector');
        dom.classroomTabs = document.getElementById('grades-classroom-tabs');
        dom.courseWrapper  = document.getElementById('grades-course-wrapper');
        dom.courseSelect   = document.getElementById('grades-course-select');
        dom.info           = document.getElementById('grades-info');
        dom.infoSalon      = document.getElementById('grades-info-salon');
        dom.infoCurso      = document.getElementById('grades-info-curso');
        dom.infoPeriodo    = document.getElementById('grades-info-periodo');
        dom.infoProfesor   = document.getElementById('grades-info-profesor');
        dom.container      = document.getElementById('grades-container');
        dom.title          = document.getElementById('grades-title');
        dom.subtitle       = document.getElementById('grades-subtitle');
        dom.thead          = document.getElementById('grades-thead');
        dom.tbody          = document.getElementById('grades-body');
        dom.btnSave        = document.getElementById('btn-save-grades');
        dom.empty          = document.getElementById('grades-empty');
        dom.loading        = document.getElementById('grades-loading');

        dom.courseSelect.addEventListener('change', onCourseChange);
        dom.btnSave.addEventListener('click', handleSave);

        // Check for professor token
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (token) {
            state.professorToken = token;
            loadCourseByToken(token);
        } else {
            loadBooks();
        }
    }

    // ─── LOAD WITH PROFESSOR TOKEN ────────────────────────
    async function loadCourseByToken(token) {
        dom.loading.style.display = 'block';

        const header = document.querySelector('.header');
        const nav = document.querySelector('.section-nav');
        const sectionAttendance = document.getElementById('section-attendance');
        const sectionEsa = document.getElementById('section-esa');
        const sectionParents = document.getElementById('section-parents');
        if (header) header.style.display = 'none';
        if (nav) nav.style.display = 'none';
        if (sectionAttendance) sectionAttendance.style.display = 'none';
        if (sectionEsa) sectionEsa.style.display = 'none';
        if (sectionParents) sectionParents.style.display = 'none';

        const sectionGrades = document.getElementById('section-grades');
        if (sectionGrades) { sectionGrades.classList.add('active'); sectionGrades.style.display = 'block'; }

        try {
            const resp = await fetch(`${API.BASE_URL}/api/course/token/${token}`);
            const result = await resp.json();

            if (!result.success) {
                dom.loading.style.display = 'none';
                dom.empty.style.display = 'block';
                dom.empty.querySelector('p').textContent = result.error || 'Token inválido.';
                return;
            }

            const course = result.course;
            dom.courseWrapper.style.display = 'none';
            dom.classroomTabs.style.display = 'none';

            const selectorTitle = dom.classroomSelector.querySelector('.selector-title');
            if (selectorTitle) {
                selectorTitle.innerHTML = `<span style="font-size:.85rem;color:var(--ink-muted);display:block;margin-bottom:.25rem;">Registro Auxiliar</span>${course.classroom} — ${course.course_name}`;
            }

            state.currentBook = { file_id: course.file_id, classroom: course.classroom };
            state.currentCourse = course.sheet_name;

            await loadGradesDirect(course.file_id, course.sheet_name, token);
        } catch (error) {
            dom.loading.style.display = 'none';
            dom.empty.style.display = 'block';
            dom.empty.querySelector('p').textContent = `Error: ${error.message}`;
        }
    }

    async function loadGradesDirect(fileId, sheetName, token) {
        try {
            let url = `${API.BASE_URL}/api/grades/${encodeURIComponent(fileId)}/${encodeURIComponent(sheetName)}`;
            if (token) url += `?token=${token}`;
            const resp = await fetch(url);
            const result = await resp.json();
            if (result.success && result.data) {
                state.currentData = result.data;
                renderGradesInfo();
                renderGradesTable();
                dom.container.style.display = 'block';
                dom.btnSave.disabled = true;
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            dom.loading.style.display = 'none';
        }
    }

    // ─── LOAD ALL BOOKS BY BIMESTER ───────────────────────
    async function loadBooks() {
        dom.loading.style.display = 'block';
        dom.empty.style.display = 'none';

        try {
            const result = await API.getGradeBooks();

            if (result.success && result.bimesters) {
                state.bimesters = result.bimesters;
                renderBimesterTabs();
                dom.loading.style.display = 'none';
            } else {
                dom.loading.style.display = 'none';
                dom.empty.style.display = 'block';
            }
        } catch (error) {
            dom.loading.style.display = 'none';
            dom.empty.style.display = 'block';
            dom.empty.querySelector('p').textContent = `Error: ${error.message}`;
        }
    }

    // ─── BIMESTER TABS ────────────────────────────────────
    function renderBimesterTabs() {
        // Create bimester tab bar above classroom tabs
        let bimBar = document.getElementById('bimester-tabs');
        if (!bimBar) {
            bimBar = document.createElement('div');
            bimBar.id = 'bimester-tabs';
            bimBar.style.cssText = 'display:flex;gap:.35rem;margin-bottom:1rem;flex-wrap:wrap;';
            dom.classroomSelector.insertBefore(bimBar, dom.classroomTabs);
        }

        bimBar.innerHTML = '';
        const bimLabels = { 1: '1er Bimestre', 2: '2do Bimestre', 3: '3er Bimestre', 4: '4to Bimestre' };
        const bimColors = { 1: '#0d7377', 2: '#2563eb', 3: '#7c3aed', 4: '#dc2626' };

        let firstBim = null;

        for (const [num, data] of Object.entries(state.bimesters)) {
            if (!firstBim) firstBim = num;
            const bookCount = data.books ? data.books.length : 0;

            const btn = document.createElement('button');
            btn.dataset.bimester = num;
            btn.style.cssText = `padding:.5rem 1.1rem;border:2px solid ${bimColors[num] || '#0d7377'};border-radius:8px;background:transparent;color:${bimColors[num] || '#0d7377'};font-family:var(--font-body);font-size:.82rem;font-weight:600;cursor:pointer;transition:all .2s;`;
            btn.innerHTML = `${bimLabels[num] || data.label} <span style="font-size:.7rem;opacity:.7;">(${bookCount})</span>`;
            btn.addEventListener('click', () => selectBimester(num));
            bimBar.appendChild(btn);
        }

        if (firstBim) selectBimester(firstBim);
    }

    function selectBimester(bimNum) {
        state.currentBimester = bimNum;
        state.currentBook = null;
        state.currentCourse = null;
        state.currentData = null;
        state.hasChanges = false;
        state.changes = {};

        const bimColors = { 1: '#0d7377', 2: '#2563eb', 3: '#7c3aed', 4: '#dc2626' };
        const color = bimColors[bimNum] || '#0d7377';

        document.querySelectorAll('#bimester-tabs button').forEach(btn => {
            const isActive = btn.dataset.bimester == bimNum;
            btn.style.background = isActive ? color : 'transparent';
            btn.style.color = isActive ? '#fff' : color;
        });

        const bimData = state.bimesters[bimNum];
        if (!bimData || !bimData.books || bimData.books.length === 0) {
            dom.classroomTabs.innerHTML = '<p style="color:var(--ink-muted);font-size:.82rem;">Sin registros para este bimestre.</p>';
            dom.courseWrapper.style.display = 'none';
            dom.container.style.display = 'none';
            dom.info.style.display = 'none';
            return;
        }

        renderClassroomTabs(bimData.books);
    }

    // ─── CLASSROOM TABS ───────────────────────────────────
    function renderClassroomTabs(books) {
        dom.classroomTabs.innerHTML = '';
        books.forEach((book, i) => {
            const btn = document.createElement('button');
            btn.className = 'classroom-tab' + (i === 0 ? ' active' : '');
            btn.dataset.idx = i;
            btn.innerHTML = `${esc(book.classroom)} <span class="tab-count">${book.course_count}</span>`;
            btn.addEventListener('click', () => selectBook(books, i));
            dom.classroomTabs.appendChild(btn);
        });
        selectBook(books, 0);
    }

    function selectBook(books, idx) {
        const book = books[idx];
        if (!book) return;

        state.currentBook = book;
        state.currentCourse = null;
        state.currentData = null;
        state.hasChanges = false;
        state.changes = {};

        document.querySelectorAll('#grades-classroom-tabs .classroom-tab').forEach(t => {
            t.classList.toggle('active', parseInt(t.dataset.idx) === idx);
        });

        dom.courseSelect.innerHTML = '<option value="">Seleccionar curso...</option>';
        book.courses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.sheet_name;
            opt.textContent = c.course_name;
            dom.courseSelect.appendChild(opt);
        });

        dom.courseWrapper.style.display = 'flex';
        dom.container.style.display = 'none';
        dom.info.style.display = 'none';
    }

    // ─── COURSE CHANGE ────────────────────────────────────
    async function onCourseChange() {
        const sheetName = dom.courseSelect.value;
        if (!sheetName || !state.currentBook) return;

        state.currentCourse = sheetName;
        state.hasChanges = false;
        state.changes = {};
        dom.container.style.display = 'none';
        dom.loading.style.display = 'block';

        try {
            let url = `${API.BASE_URL}/api/grades/${encodeURIComponent(state.currentBook.file_id)}/${encodeURIComponent(sheetName)}`;
            if (state.professorToken) url += `?token=${state.professorToken}`;

            const resp = await fetch(url, { headers: state.professorToken ? {} : { 'Authorization': `Bearer ${API.getToken()}` } });
            const result = await resp.json();

            if (result.success && result.data) {
                state.currentData = result.data;
                renderGradesInfo();
                renderGradesTable();
                dom.container.style.display = 'block';
                dom.btnSave.disabled = true;
            } else {
                showToast(result.error || 'Error', 'error');
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            dom.loading.style.display = 'none';
        }
    }

    function renderGradesInfo() {
        const d = state.currentData;
        dom.infoSalon.textContent = d.salon || '';
        dom.infoCurso.textContent = d.curso || '';
        dom.infoPeriodo.textContent = d.periodo || '';
        dom.infoProfesor.textContent = d.profesor ? `Prof: ${d.profesor}` : 'Sin profesor';
        dom.info.style.display = 'block';
        dom.title.textContent = `${d.salon} — ${d.curso}`;
        dom.subtitle.textContent = `${d.student_count} estudiantes · ${d.periodo}`;
    }

    function renderGradesTable() {
        const d = state.currentData;
        if (!d) return;

        const columns = d.columns;
        const groups = [];
        let lastGroup = null;
        columns.forEach(col => {
            if (col.group !== lastGroup) { groups.push({ name: col.group, cols: [col] }); lastGroup = col.group; }
            else { groups[groups.length - 1].cols.push(col); }
        });

        const gColors = { 'Promedio': 'var(--teal-soft)', 'Tareas': '#e8f0fe', 'Revisión en Clase': '#fef3e2', 'Exámenes': 'var(--red-soft)' };

        let h1 = '<tr><th rowspan="2" style="position:sticky;left:0;z-index:10;background:var(--surface);min-width:35px;">#</th>';
        h1 += '<th rowspan="2" style="position:sticky;left:35px;z-index:10;background:var(--surface);min-width:180px;">Estudiante</th>';
        groups.forEach(g => { const bg = gColors[g.name] || 'var(--surface-2)'; h1 += `<th colspan="${g.cols.length}" style="text-align:center;background:${bg};font-size:.7rem;padding:.4rem .3rem;">${esc(g.name)}</th>`; });
        h1 += '</tr>';

        let h2 = '<tr>';
        groups.forEach(g => { const bg = gColors[g.name] || 'var(--surface-2)'; g.cols.forEach(col => { h2 += `<th style="background:${bg};font-size:.65rem;padding:.35rem .25rem;text-align:center;min-width:42px;">${esc(col.label)}</th>`; }); });
        h2 += '</tr>';
        dom.thead.innerHTML = h1 + h2;

        dom.tbody.innerHTML = '';
        d.students.forEach((student, i) => {
            const tr = document.createElement('tr');
            let html = `<td style="position:sticky;left:0;background:var(--white);z-index:5;text-align:center;font-size:.75rem;">${i + 1}</td>`;
            html += `<td style="position:sticky;left:35px;background:var(--white);z-index:5;font-size:.8rem;font-weight:500;white-space:nowrap;">${esc(student.name)}</td>`;

            columns.forEach(col => {
                const val = student.grades[col.key];
                const displayVal = val !== null && val !== undefined ? val : '';
                html += `<td style="padding:2px;text-align:center;">
                    <input type="number" step="1" min="0" max="20" class="grade-input"
                        data-student="${esc(student.name)}" data-key="${col.key}" value="${displayVal}"
                        style="width:42px;padding:3px 2px;border:1px solid var(--border-light);border-radius:4px;text-align:center;font-size:.78rem;font-family:var(--font-body);background:var(--white);">
                </td>`;
            });
            tr.innerHTML = html;
            dom.tbody.appendChild(tr);
        });

        dom.tbody.querySelectorAll('.grade-input').forEach(input => {
            input.addEventListener('input', () => { state.hasChanges = true; dom.btnSave.disabled = false; input.style.background = '#fef9e7'; });
            input.addEventListener('blur', onGradeBlur);
            input.addEventListener('focus', function() { this.select(); this.style.borderColor = 'var(--teal)'; });
        });
    }

    function onGradeBlur(e) {
        const input = e.target;
        input.style.borderColor = 'var(--border-light)';
        input.style.boxShadow = 'none';
        let val = input.value.trim();
        if (val === '') { registerChange(input, ''); return; }
        let num = parseInt(val, 10);
        if (isNaN(num)) { input.value = ''; return; }
        if (num < 0) num = 0;
        if (num > 20) num = 20;
        input.value = num;
        registerChange(input, num);
    }

    function registerChange(input, value) {
        const n = input.dataset.student, k = input.dataset.key;
        if (!state.changes[n]) state.changes[n] = {};
        state.changes[n][k] = value === '' ? null : value;
    }

    async function handleSave() {
        if (!state.hasChanges || !state.currentBook || !state.currentCourse) return;
        dom.tbody.querySelectorAll('.grade-input').forEach(input => {
            if (input.style.background === 'rgb(254, 249, 231)') registerChange(input, input.value === '' ? null : parseInt(input.value, 10));
        });
        dom.btnSave.querySelector('span').textContent = 'Guardando...';
        dom.btnSave.disabled = true;

        try {
            const updates = Object.entries(state.changes).map(([name, grades]) => ({ student_name: name, grades }));
            let url = `${API.BASE_URL}/api/grades/${encodeURIComponent(state.currentBook.file_id)}/${encodeURIComponent(state.currentCourse)}`;
            if (state.professorToken) url += `?token=${state.professorToken}`;

            const resp = await fetch(url, {
                method: 'POST',
                headers: state.professorToken ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API.getToken()}` },
                body: JSON.stringify({ updates }),
            });
            const result = await resp.json();

            if (result.success) {
                showToast(`Notas guardadas: ${result.result.students_updated} estudiantes`, 'success');
                state.hasChanges = false; state.changes = {};
                dom.tbody.querySelectorAll('.grade-input').forEach(i => i.style.background = 'var(--white)');
                await onCourseChange();
            } else {
                showToast(result.error || 'Error', 'error'); dom.btnSave.disabled = false;
            }
        } catch (error) { showToast(`Error: ${error.message}`, 'error'); dom.btnSave.disabled = false; }
        finally { dom.btnSave.querySelector('span').textContent = 'Guardar Notas'; }
    }

    function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function showToast(msg, type) {
        const c = document.getElementById('toast-container');
        if (c) { const t = document.createElement('div'); t.className = `toast toast-${type}`; t.innerHTML = `<span>${esc(msg)}</span>`; c.appendChild(t); setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 5000); }
    }

    let initialized = false;
    const observer = new MutationObserver(() => {
        const s = document.getElementById('section-grades');
        if (s && s.classList.contains('active') && !initialized) { initialized = true; init(); }
    });
    document.addEventListener('DOMContentLoaded', () => {
        const s = document.getElementById('section-grades');
        if (s) {
            observer.observe(s, { attributes: true, attributeFilter: ['class'] });
            const params = new URLSearchParams(window.location.search);
            if (params.get('token')) { const ls = document.getElementById('loading-screen'); if (ls) ls.classList.add('hidden'); initialized = true; init(); }
        }
    });

    return { init, loadBooks, state };
})();
