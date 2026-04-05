/**
 * ESA.JS — Módulo de Evaluación Semanal Académica
 *
 * Muestra la tabla ESA con valores B/M por curso,
 * coloreados según la tabla de conversión.
 * Permite generar ESA automáticamente desde las notas.
 */

const ESA = (() => {
    'use strict';

    const COURSES = ['Aritmética', 'Álgebra', 'H.M', 'Geometría', 'Trigonometría'];

    const state = {
        books: [],
        currentBook: null,
        currentSheet: null,
        currentData: null,
    };

    const dom = {};

    function init() {
        dom.classroomTabs = document.getElementById('esa-classroom-tabs');
        dom.sheetWrapper  = document.getElementById('esa-sheet-wrapper');
        dom.sheetSelect   = document.getElementById('esa-sheet-select');
        dom.btnGenerate   = document.getElementById('btn-generate-esa');
        dom.legend        = document.getElementById('esa-legend');
        dom.container     = document.getElementById('esa-container');
        dom.title         = document.getElementById('esa-title');
        dom.subtitle      = document.getElementById('esa-subtitle');
        dom.thead         = document.getElementById('esa-thead');
        dom.tbody         = document.getElementById('esa-tbody');
        dom.empty         = document.getElementById('esa-empty');
        dom.loading       = document.getElementById('esa-loading');

        dom.sheetSelect.addEventListener('change', onSheetChange);
        dom.btnGenerate.addEventListener('click', handleGenerate);

        loadBooks();
    }

    // ─── CARGAR LIBROS ESA ────────────────────────────────
    async function loadBooks() {
        dom.loading.style.display = 'block';
        dom.empty.style.display = 'none';

        try {
            const result = await API.getESABooks();
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
            btn.innerHTML = `${esc(book.classroom)} <span class="tab-count">${book.sheet_count}</span>`;
            btn.addEventListener('click', () => selectBook(i));
            dom.classroomTabs.appendChild(btn);
        });
        selectBook(0);
    }

    function selectBook(idx) {
        const book = state.books[idx];
        if (!book) return;

        state.currentBook = book;
        state.currentSheet = null;
        state.currentData = null;

        document.querySelectorAll('#esa-classroom-tabs .classroom-tab').forEach(t => {
            t.classList.toggle('active', parseInt(t.dataset.idx) === idx);
        });

        dom.sheetSelect.innerHTML = '<option value="">Seleccionar semana...</option>';
        book.sheets.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = `Semana ${s.replace('PC', '')} (${s})`;
            dom.sheetSelect.appendChild(opt);
        });

        dom.sheetWrapper.style.display = 'flex';
        dom.container.style.display = 'none';
        dom.legend.style.display = 'none';
    }

    // ─── CAMBIAR SEMANA/PC ────────────────────────────────
    async function onSheetChange() {
        const sheet = dom.sheetSelect.value;
        if (!sheet || !state.currentBook) return;

        state.currentSheet = sheet;
        dom.container.style.display = 'none';
        dom.loading.style.display = 'block';

        try {
            const result = await API.getESAData(state.currentBook.file_id, sheet);

            if (result.success && result.data) {
                state.currentData = result.data;
                renderESATable();
                dom.container.style.display = 'block';
                dom.legend.style.display = 'block';
            } else {
                showToast(result.error || 'Error cargando ESA', 'error');
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            dom.loading.style.display = 'none';
        }
    }

    // ─── RENDERIZAR TABLA ─────────────────────────────────
    function renderESATable() {
        const d = state.currentData;
        if (!d) return;

        dom.title.textContent = `${d.classroom} — ${d.sheet_name}`;
        dom.subtitle.textContent = `${d.student_count} estudiantes · ${d.school_name}`;

        // Header row 1: grouped courses
        let h1 = '<tr>';
        h1 += '<th rowspan="2" style="position:sticky;left:0;z-index:10;background:var(--surface);min-width:40px;text-align:center;">Item</th>';
        h1 += '<th rowspan="2" style="position:sticky;left:40px;z-index:10;background:var(--surface);min-width:200px;">Apellidos</th>';

        const courseColors = ['#e8f0fe', '#fef3e2', '#e4f5ed', '#f3e8fd', '#fde8e6'];

        COURSES.forEach((course, i) => {
            const bg = courseColors[i % courseColors.length];
            h1 += `<th colspan="2" style="text-align:center;background:${bg};font-size:.75rem;padding:.5rem .3rem;">${esc(course)}</th>`;
        });
        h1 += '</tr>';

        // Header row 2: B/M sub-columns
        let h2 = '<tr>';
        COURSES.forEach((_, i) => {
            const bg = courseColors[i % courseColors.length];
            h2 += `<th style="text-align:center;background:${bg};font-size:.7rem;padding:.35rem;min-width:36px;font-weight:600;">B</th>`;
            h2 += `<th style="text-align:center;background:${bg};font-size:.7rem;padding:.35rem;min-width:36px;font-weight:600;">M</th>`;
        });
        h2 += '</tr>';

        dom.thead.innerHTML = h1 + h2;

        // Body
        dom.tbody.innerHTML = '';
        d.students.forEach((student, i) => {
            const tr = document.createElement('tr');
            let html = '';

            html += `<td style="position:sticky;left:0;background:var(--white);z-index:5;text-align:center;font-size:.78rem;">${i + 1}</td>`;
            html += `<td style="position:sticky;left:40px;background:var(--white);z-index:5;font-size:.82rem;font-weight:500;white-space:nowrap;">${esc(student.name)}</td>`;

            COURSES.forEach(course => {
                const data = student.courses[course] || { b: null, m: null, color: '' };
                const bVal = data.b !== null && data.b !== undefined ? data.b : '';
                const mVal = data.m !== null && data.m !== undefined ? data.m : '';

                const bgStyle = getCellBackground(data.color);

                html += `<td style="text-align:center;font-size:.82rem;font-weight:600;padding:4px 3px;${bgStyle}">${bVal}</td>`;
                html += `<td style="text-align:center;font-size:.82rem;font-weight:600;padding:4px 3px;${bgStyle}">${mVal}</td>`;
            });

            tr.innerHTML = html;
            dom.tbody.appendChild(tr);
        });
    }

    function getCellBackground(colorName) {
        switch (colorName) {
            case 'yellow':
                return 'background:#FFFF00;color:#333;';
            case 'orange':
                return 'background:#FF9900;color:#fff;';
            case 'fuchsia':
                return 'background:#FF00FF;color:#fff;';
            default:
                return 'background:var(--white);color:var(--ink);';
        }
    }

    // ─── GENERAR ESA DESDE NOTAS ──────────────────────────
    async function handleGenerate() {
        if (!state.currentBook || !state.currentSheet) {
            showToast('Selecciona un salón y una semana primero', 'warning');
            return;
        }

        dom.btnGenerate.disabled = true;
        dom.btnGenerate.textContent = 'Generando...';
        showToast(`Generando ESA desde notas (${state.currentSheet})...`, 'info');

        try {
            const result = await API.generateESA(
                state.currentBook.file_id,
                state.currentSheet
            );

            if (result.success) {
                showToast(
                    `ESA generado: ${result.result.cells_updated} celdas actualizadas`,
                    'success'
                );
                // Recargar tabla
                await onSheetChange();
            } else {
                showToast(result.error || 'Error generando ESA', 'error');
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            dom.btnGenerate.disabled = false;
            dom.btnGenerate.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Generar desde Notas
            `;
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
            setTimeout(() => {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        }
    }

    // Auto-init cuando la pestaña ESA se activa
    let initialized = false;
    const observer = new MutationObserver(() => {
        const section = document.getElementById('section-esa');
        if (section && section.classList.contains('active') && !initialized) {
            initialized = true;
            init();
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const section = document.getElementById('section-esa');
        if (section) {
            observer.observe(section, { attributes: true, attributeFilter: ['class'] });
        }
    });

    return { init, state };
})();
