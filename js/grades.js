/**
 * GRADES.JS — Módulo de Notas (Registro Auxiliar)
 * Maneja la interfaz del registro de notas.
 */

const Grades = (() => {
    'use strict';

    const state = {
        books: [],
        currentBook: null,
        currentCourse: null,
        currentData: null,
        hasChanges: false,
        changes: {},  // {studentName: {key: value}}
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

        loadBooks();
    }

    // ─── CARGAR LIBROS ────────────────────────────────────
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
            btn.dataset.fileId = book.file_id;
            btn.innerHTML = `${esc(book.classroom)} <span class="tab-count">${book.course_count}</span>`;
            btn.addEventListener('click', () => selectBook(book));
            dom.classroomTabs.appendChild(btn);
        });
        selectBook(state.books[0]);
    }

    function selectBook(book) {
        state.currentBook = book;
        state.currentCourse = null;
        state.currentData = null;
        state.hasChanges = false;
        state.changes = {};

        document.querySelectorAll('#grades-classroom-tabs .classroom-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.fileId === book.file_id);
        });

        // Llenar dropdown de cursos
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
            const result = await API.getGrades(state.currentBook.file_id, sheetName);

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

    // ─── INFO DEL CURSO ───────────────────────────────────
    function renderGradesInfo() {
        const d = state.currentData;
        dom.infoSalon.textContent = d.salon || '';
        dom.infoCurso.textContent = d.curso || '';
        dom.infoPeriodo.textContent = d.periodo || '';
        dom.infoProfesor.textContent = d.profesor ? `Prof: ${d.profesor}` : 'Sin profesor';
        dom.info.style.display = 'block';

        dom.title.textContent = d.titulo || `${d.salon} — ${d.curso}`;
        dom.subtitle.textContent = `${d.student_count} estudiantes · ${d.periodo}`;
    }

    // ─── TABLA DE NOTAS ───────────────────────────────────
    function renderGradesTable() {
        const d = state.currentData;
        if (!d) return;

        // Build grouped headers
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
        let headerRow1 = '<tr><th rowspan="2" style="position:sticky;left:0;z-index:10;background:var(--surface);min-width:35px;">#</th>';
        headerRow1 += '<th rowspan="2" style="position:sticky;left:35px;z-index:10;background:var(--surface);min-width:180px;">Estudiante</th>';

        const groupColors = {
            'Promedio': 'var(--teal-soft)',
            'Tareas': '#e8f0fe',
            'Trabajo en Clase': '#fef3e2',
            'Rev. Libro': '#fef3e2',
            'Prácticas': '#e4f5ed',
            'Orales': '#f3e8fd',
            'Promedio Final': 'var(--teal-soft)',
            'Exámenes': 'var(--red-soft)',
        };

        groups.forEach(g => {
            const bg = groupColors[g.name] || 'var(--surface-2)';
            headerRow1 += `<th colspan="${g.cols.length}" style="text-align:center;background:${bg};font-size:.7rem;padding:.4rem .3rem;white-space:nowrap;">${esc(g.name)}</th>`;
        });
        headerRow1 += '</tr>';

        // Row 2: Column sub-headers
        let headerRow2 = '<tr>';
        groups.forEach(g => {
            const bg = groupColors[g.name] || 'var(--surface-2)';
            g.cols.forEach(col => {
                const style = `background:${bg};font-size:.65rem;padding:.35rem .25rem;text-align:center;min-width:42px;white-space:nowrap;`;
                headerRow2 += `<th style="${style}">${esc(col.label)}</th>`;
            });
        });
        headerRow2 += '</tr>';

        dom.thead.innerHTML = headerRow1 + headerRow2;

        // Body rows
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
                        <input type="number" step="0.1" min="0" max="20"
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

        // Bind input events
        dom.tbody.querySelectorAll('.grade-input').forEach(input => {
            input.addEventListener('input', onGradeInput);
            input.addEventListener('focus', function() {
                this.select();
                this.style.borderColor = 'var(--teal)';
                this.style.boxShadow = '0 0 0 2px rgba(13,115,119,.15)';
            });
            input.addEventListener('blur', function() {
                this.style.borderColor = 'var(--border-light)';
                this.style.boxShadow = 'none';
            });
        });
    }

    function onGradeInput(e) {
        const input = e.target;
        const studentName = input.dataset.student;
        const key = input.dataset.key;
        const value = input.value;

        if (!state.changes[studentName]) {
            state.changes[studentName] = {};
        }
        state.changes[studentName][key] = value;
        state.hasChanges = true;
        dom.btnSave.disabled = false;

        // Visual feedback
        input.style.background = '#fef9e7';
    }

    // ─── GUARDAR ──────────────────────────────────────────
    async function handleSave() {
        if (!state.hasChanges || !state.currentBook || !state.currentCourse) return;

        dom.btnSave.querySelector('span').textContent = 'Guardando...';
        dom.btnSave.disabled = true;

        try {
            const updates = Object.entries(state.changes).map(([name, grades]) => ({
                student_name: name,
                grades: grades,
            }));

            const result = await API.saveGrades(
                state.currentBook.file_id,
                state.currentCourse,
                updates
            );

            if (result.success) {
                showToast(`Notas guardadas: ${result.result.students_updated} estudiantes`, 'success');
                state.hasChanges = false;
                state.changes = {};

                // Reset visual feedback
                dom.tbody.querySelectorAll('.grade-input').forEach(input => {
                    input.style.background = 'var(--white)';
                });

                // Reload to get computed values
                await onCourseChange();
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
        // Reutilizar el toast del módulo principal si existe
        if (typeof App !== 'undefined' && App.state) {
            const container = document.getElementById('toast-container');
            if (container) {
                const toast = document.createElement('div');
                toast.className = `toast toast-${type}`;
                toast.innerHTML = `<span>${esc(message)}</span>`;
                container.appendChild(toast);
                setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 5000);
                return;
            }
        }
        alert(message);
    }

    // Auto-init cuando la pestaña de notas se activa
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
        }
    });

    return { init, loadBooks, state };
})();
