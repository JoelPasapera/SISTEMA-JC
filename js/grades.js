/**
 * GRADES.JS — Módulo de Notas con acceso por profesor
 *
 * Modos de acceso:
 * 1. Admin (sin token): ve todos los salones y cursos
 * 2. Profesor (con token en URL): ve SOLO sus cursos asignados
 *
 * URL directa para profesor: tudominio.com/?token=abc123&tab=grades
 */

const Grades = (() => {
    'use strict';

    const state = {
        books: [],
        currentBook: null,
        currentCourse: null,
        currentData: null,
        hasChanges: false,
        changes: {},
        professorToken: null,
        professorName: null,
        professorCourses: null,
    };

    const dom = {};

    function init() {
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

        // Detectar token en URL → abrir directamente ese curso
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (token) {
            state.professorToken = token;
            loadCourseByToken(token);
        } else {
            loadBooks();
        }
    }

    // ─── MODO DIRECTO (1 token = 1 curso) ─────────────────
    async function loadCourseByToken(token) {
        dom.loading.style.display = 'block';

        try {
            const resp = await fetch(`${getBaseUrl()}/api/course/token/${token}`);
            const result = await resp.json();

            if (!result.success) {
                dom.loading.style.display = 'none';
                dom.empty.style.display = 'block';
                dom.empty.querySelector('p').textContent =
                    result.error || 'Token inválido. Contacta al administrador.';
                return;
            }

            const course = result.course;

            // Ocultar selectors — este token da acceso directo a un solo curso
            document.getElementById('grades-classroom-selector').style.display = 'none';
            dom.courseWrapper.style.display = 'none';

            // Guardar datos para carga
            state.currentBook = { file_id: course.file_id, classroom: course.classroom };
            state.currentCourse = course.sheet_name;

            // Mostrar info
            const selectorTitle = document.querySelector('#grades-classroom-selector .selector-title');
            if (selectorTitle) {
                selectorTitle.textContent = `${course.classroom} — ${course.course_name}`;
                selectorTitle.style.display = 'block';
                document.getElementById('grades-classroom-selector').style.display = 'block';
                dom.classroomTabs.style.display = 'none';
            }

            // Cargar las notas directamente
            await loadGradesDirect(course.file_id, course.sheet_name, token);

        } catch (error) {
            dom.loading.style.display = 'none';
            dom.empty.style.display = 'block';
            dom.empty.querySelector('p').textContent = `Error: ${error.message}`;
        }
    }

    async function loadGradesDirect(fileId, sheetName, token) {
        try {
            let url = `${getBaseUrl()}/api/grades/${encodeURIComponent(fileId)}/${encodeURIComponent(sheetName)}`;
            if (token) url += `?token=${token}`;

            const resp = await fetch(url);
            const result = await resp.json();

            if (result.success && result.data) {
                state.currentData = result.data;
                renderGradesInfo();
                renderGradesTable();
                dom.container.style.display = 'block';
                dom.btnSave.disabled = true;
            } else {
                showToast(result.error || 'No tienes acceso a este curso', 'error');
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            dom.loading.style.display = 'none';
        }
    }

    function getBaseUrl() {
        return typeof API !== 'undefined' && API._BASE_URL
            ? API._BASE_URL
            : 'https://c48484518.pythonanywhere.com';
    }

    // ─── MODO ADMIN (sin token) ───────────────────────────
    async function loadBooks() {
        dom.loading.style.display = 'block';
        dom.empty.style.display = 'none';

        try {
            const result = await API.getGradeBooks();
            if (result.success && result.books && result.books.length > 0) {
                state.books = result.books;
                renderClassroomTabs();
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

    // ─── TABS DE SALONES ──────────────────────────────────
    function renderClassroomTabs() {
        dom.classroomTabs.innerHTML = '';
        state.books.forEach((book, i) => {
            const btn = document.createElement('button');
            btn.className = 'classroom-tab' + (i === 0 ? ' active' : '');
            btn.dataset.idx = i;
            btn.innerHTML = `${esc(book.classroom)} <span class="tab-count">${book.course_count}</span>`;
            btn.addEventListener('click', () => selectBook(i));
            dom.classroomTabs.appendChild(btn);
        });
        selectBook(0);
    }

    function selectBook(idx) {
        const book = state.books[idx];
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

    // ─── CAMBIAR CURSO ────────────────────────────────────
    async function onCourseChange() {
        const sheetName = dom.courseSelect.value;
        if (!sheetName || !state.currentBook) return;

        state.currentCourse = sheetName;
        state.hasChanges = false;
        state.changes = {};

        dom.container.style.display = 'none';
        dom.loading.style.display = 'block';

        try {
            let url = `${getBaseUrl()}/api/grades/${encodeURIComponent(state.currentBook.file_id)}/${encodeURIComponent(sheetName)}`;
            if (state.professorToken) {
                url += `?token=${state.professorToken}`;
            }

            const resp = await fetch(url);
            const result = await resp.json();

            if (result.success && result.data) {
                state.currentData = result.data;
                renderGradesInfo();
                renderGradesTable();
                dom.container.style.display = 'block';
                dom.btnSave.disabled = true;
            } else {
                showToast(result.error || 'Error cargando notas', 'error');
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            dom.loading.style.display = 'none';
        }
    }

    // ─── INFO DEL CURSO ───────────────────────────────────
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

    // ─── TABLA DE NOTAS ───────────────────────────────────
    function renderGradesTable() {
        const d = state.currentData;
        if (!d) return;

        const columns = d.columns;
        const groups = [];
        let lastGroup = null;

        columns.forEach(col => {
            if (col.group !== lastGroup) {
                groups.push({ name: col.group, cols: [col] });
                lastGroup = col.group;
            } else {
                groups[groups.length - 1].cols.push(col);
            }
        });

        // Row 1: Group headers
        let h1 = '<tr><th rowspan="2" style="position:sticky;left:0;z-index:10;background:var(--surface);min-width:35px;">#</th>';
        h1 += '<th rowspan="2" style="position:sticky;left:35px;z-index:10;background:var(--surface);min-width:180px;">Estudiante</th>';

        const gColors = {
            'Promedio': 'var(--teal-soft)',
            'Tareas': '#e8f0fe',
            'Revisión en Clase': '#fef3e2',
            'Exámenes': 'var(--red-soft)',
        };

        groups.forEach(g => {
            const bg = gColors[g.name] || 'var(--surface-2)';
            h1 += `<th colspan="${g.cols.length}" style="text-align:center;background:${bg};font-size:.7rem;padding:.4rem .3rem;white-space:nowrap;">${esc(g.name)}</th>`;
        });
        h1 += '</tr>';

        // Row 2: Sub-headers
        let h2 = '<tr>';
        groups.forEach(g => {
            const bg = gColors[g.name] || 'var(--surface-2)';
            g.cols.forEach(col => {
                h2 += `<th style="background:${bg};font-size:.65rem;padding:.35rem .25rem;text-align:center;min-width:42px;white-space:nowrap;">${esc(col.label)}</th>`;
            });
        });
        h2 += '</tr>';

        dom.thead.innerHTML = h1 + h2;

        // Body
        dom.tbody.innerHTML = '';
        d.students.forEach((student, i) => {
            const tr = document.createElement('tr');
            let html = `<td style="position:sticky;left:0;background:var(--white);z-index:5;text-align:center;font-size:.75rem;">${i + 1}</td>`;
            html += `<td style="position:sticky;left:35px;background:var(--white);z-index:5;font-size:.8rem;font-weight:500;white-space:nowrap;">${esc(student.name)}</td>`;

            columns.forEach(col => {
                const val = student.grades[col.key];
                const displayVal = val !== null && val !== undefined ? val : '';

                if (col.editable) {
                    html += `<td style="padding:2px;text-align:center;">
                        <input type="number" step="1" min="0" max="20"
                            class="grade-input"
                            data-student="${esc(student.name)}"
                            data-key="${col.key}"
                            value="${displayVal}"
                            style="width:42px;padding:3px 2px;border:1px solid var(--border-light);
                                   border-radius:4px;text-align:center;font-size:.78rem;
                                   font-family:var(--font-body);background:var(--white);">
                    </td>`;
                } else {
                    const isAvg = col.key.includes('promedio') || col.key.includes('prom');
                    const style = isAvg
                        ? 'font-weight:600;color:var(--teal);background:var(--teal-soft);'
                        : 'color:var(--ink-muted);background:var(--surface);';
                    html += `<td style="text-align:center;font-size:.78rem;padding:4px 3px;${style}">${displayVal}</td>`;
                }
            });

            tr.innerHTML = html;
            dom.tbody.appendChild(tr);
        });

        // Input events
        dom.tbody.querySelectorAll('.grade-input').forEach(input => {
            input.addEventListener('input', onGradeInput);
            input.addEventListener('blur', onGradeBlur);
            input.addEventListener('focus', function() {
                this.select();
                this.style.borderColor = 'var(--teal)';
                this.style.boxShadow = '0 0 0 2px rgba(13,115,119,.15)';
            });
        });
    }

    function onGradeInput(e) {
        const input = e.target;
        state.hasChanges = true;
        dom.btnSave.disabled = false;
        input.style.background = '#fef9e7';
    }

    function onGradeBlur(e) {
        const input = e.target;
        input.style.borderColor = 'var(--border-light)';
        input.style.boxShadow = 'none';

        let val = input.value.trim();

        if (val === '') {
            // Vacío es válido (borrar nota)
            registerChange(input, '');
            return;
        }

        let num = parseInt(val, 10);

        // Validar: entero, 0-20
        if (isNaN(num)) {
            input.value = '';
            input.style.background = 'var(--white)';
            return;
        }

        if (num < 0) num = 0;
        if (num > 20) num = 20;

        input.value = num;
        registerChange(input, num);
    }

    function registerChange(input, value) {
        const studentName = input.dataset.student;
        const key = input.dataset.key;

        if (!state.changes[studentName]) {
            state.changes[studentName] = {};
        }
        state.changes[studentName][key] = value === '' ? null : value;
    }

    // ─── GUARDAR ──────────────────────────────────────────
    async function handleSave() {
        if (!state.hasChanges || !state.currentBook || !state.currentCourse) return;

        // Capturar todos los cambios al momento de guardar
        dom.tbody.querySelectorAll('.grade-input').forEach(input => {
            if (input.style.background === 'rgb(254, 249, 231)') {
                // Solo registrar los que fueron modificados
                registerChange(input, input.value === '' ? null : parseInt(input.value, 10));
            }
        });

        dom.btnSave.querySelector('span').textContent = 'Guardando...';
        dom.btnSave.disabled = true;

        try {
            const updates = Object.entries(state.changes).map(([name, grades]) => ({
                student_name: name,
                grades: grades,
            }));

            let url = `${getBaseUrl()}/api/grades/${encodeURIComponent(state.currentBook.file_id)}/${encodeURIComponent(state.currentCourse)}`;
            if (state.professorToken) {
                url += `?token=${state.professorToken}`;
            }

            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates }),
            });
            const result = await resp.json();

            if (result.success) {
                showToast(`Notas guardadas: ${result.result.students_updated} estudiantes`, 'success');
                if (result.result.errors && result.result.errors.length > 0) {
                    showToast(`Advertencias: ${result.result.errors.join(', ')}`, 'warning');
                }
                state.hasChanges = false;
                state.changes = {};
                dom.tbody.querySelectorAll('.grade-input').forEach(input => {
                    input.style.background = 'var(--white)';
                });
                await onCourseChange();
            } else {
                showToast(result.error || 'Error al guardar', 'error');
                dom.btnSave.disabled = false;
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
            dom.btnSave.disabled = false;
        } finally {
            dom.btnSave.querySelector('span').textContent = 'Guardar Notas';
        }
    }

    // ─── UTILIDADES ───────────────────────────────────────
    function esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(message, type) {
        const container = document.getElementById('toast-container');
        if (container) {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `<span>${esc(message)}</span>`;
            container.appendChild(toast);
            setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 5000);
        }
    }

    // Auto-init
    let initialized = false;
    const observer = new MutationObserver(() => {
        const section = document.getElementById('section-grades');
        if (section && section.classList.contains('active') && !initialized) {
            initialized = true;
            init();
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const section = document.getElementById('section-grades');
        if (section) {
            observer.observe(section, { attributes: true, attributeFilter: ['class'] });

            // Si hay token en URL, activar pestaña de notas automáticamente
            const params = new URLSearchParams(window.location.search);
            if (params.get('token') && params.get('tab') === 'grades') {
                const gradesTab = document.querySelector('[data-section="grades"]');
                if (gradesTab) gradesTab.click();
            }
        }
    });

    return { init, loadBooks, state };
})();
