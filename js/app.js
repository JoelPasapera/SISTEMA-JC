/**
 * APP.JS — Logica de la interfaz de usuario
 */

const App = (() => {
    'use strict';

    const state = {
        classrooms: [],
        currentClassroom: null,
        attendanceRecords: new Map(),
        isLoading: false,
        isSaving: false,
        isLoadingAttendance: false,
    };

    const dom = {};

    function init() {
        cacheDOM();
        setupDate();
        bindEvents();
        loadData();
    }

    function cacheDOM() {
        dom.loadingScreen     = document.getElementById('loading-screen');
        dom.headerDate        = document.getElementById('header-date');
        dom.connectionStatus  = document.getElementById('connection-status');
        dom.statusText        = dom.connectionStatus.querySelector('.status-text');
        dom.classroomTabs     = document.getElementById('classroom-tabs');
        dom.dateWrapper       = document.getElementById('date-picker-wrapper');
        dom.dateInput         = document.getElementById('attendance-date');
        dom.attendanceContainer = document.getElementById('attendance-container');
        dom.tableTitle        = document.getElementById('table-title');
        dom.tableSubtitle     = document.getElementById('table-subtitle');
        dom.attendanceBody    = document.getElementById('attendance-body');
        dom.statPresent       = document.getElementById('stat-present');
        dom.statLate          = document.getElementById('stat-late');
        dom.statAbsent        = document.getElementById('stat-absent');
        dom.btnAllPresent     = document.getElementById('btn-all-present');
        dom.btnReset          = document.getElementById('btn-reset');
        dom.btnSave           = document.getElementById('btn-save');
        dom.btnRetry          = document.getElementById('btn-retry');
        dom.emptyState        = document.getElementById('empty-state');
        dom.modalOverlay      = document.getElementById('modal-overlay');
        dom.modalTitle        = document.getElementById('modal-title');
        dom.modalBody         = document.getElementById('modal-body');
        dom.modalClose        = document.getElementById('modal-close');
        dom.modalCancel       = document.getElementById('modal-cancel');
        dom.modalConfirm      = document.getElementById('modal-confirm');
        dom.toastContainer    = document.getElementById('toast-container');
    }

    function setupDate() {
        const now = new Date();
        const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const f = now.toLocaleDateString('es-PE', opts);
        dom.headerDate.textContent = f.charAt(0).toUpperCase() + f.slice(1);
        dom.dateInput.value = now.toISOString().split('T')[0];
    }

    function bindEvents() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => switchSection(tab.dataset.section));
        });
        dom.btnAllPresent.addEventListener('click', markAllPresent);
        dom.btnReset.addEventListener('click', resetAttendance);
        dom.btnSave.addEventListener('click', handleSave);
        dom.btnRetry.addEventListener('click', loadData);
        dom.modalClose.addEventListener('click', closeModal);
        dom.modalCancel.addEventListener('click', closeModal);
        dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.modalOverlay) closeModal();
        });

        // Al cambiar la fecha, cargar la asistencia existente
        dom.dateInput.addEventListener('change', () => {
            if (state.currentClassroom) {
                loadAttendanceForDate();
            }
        });
    }

    // ─── CARGA DE DATOS ───────────────────────────────────
    async function loadData() {
        state.isLoading = true;
        showLoading(true);

        const connected = await API.checkConnection();
        updateConnectionStatus(connected);

        if (!connected) {
            showLoading(false);
            showEmptyState(true);
            showToast('No se pudo conectar con el servidor', 'error');
            return;
        }

        try {
            const data = await API.getClassrooms();
            if (!data.success || !data.classrooms || data.classrooms.length === 0) {
                showEmptyState(true);
                showToast('No se encontraron salones', 'warning');
                return;
            }

            state.classrooms = data.classrooms;
            renderClassroomTabs();
            showEmptyState(false);
            selectClassroom(state.classrooms[0].classroom);

        } catch (error) {
            showEmptyState(true);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            state.isLoading = false;
            showLoading(false);
        }
    }

    // ─── NAVEGACION ───────────────────────────────────────
    function switchSection(sectionName) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        document.getElementById(`section-${sectionName}`).classList.add('active');
    }

    // ─── SALONES ──────────────────────────────────────────
    function renderClassroomTabs() {
        dom.classroomTabs.innerHTML = '';
        state.classrooms.forEach(cr => {
            const btn = document.createElement('button');
            btn.className = 'classroom-tab';
            btn.dataset.classroom = cr.classroom;
            btn.innerHTML = `${escapeHTML(cr.classroom)}<span class="tab-count">${cr.student_count}</span>`;
            btn.addEventListener('click', () => selectClassroom(cr.classroom));
            dom.classroomTabs.appendChild(btn);
        });
    }

    function selectClassroom(classroomName) {
        state.currentClassroom = state.classrooms.find(c => c.classroom === classroomName);
        if (!state.currentClassroom) return;

        document.querySelectorAll('.classroom-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.classroom === classroomName);
        });

        state.attendanceRecords.clear();
        dom.dateWrapper.style.display = 'flex';
        dom.attendanceContainer.style.display = 'block';

        renderAttendanceTable();
        updateStats();
        dom.btnSave.disabled = false;

        // Cargar asistencia existente para la fecha actual
        loadAttendanceForDate();
    }

    // ─── TABLA DE ASISTENCIA ──────────────────────────────
    function renderAttendanceTable() {
        const cr = state.currentClassroom;
        if (!cr) return;

        dom.tableTitle.textContent = cr.title || cr.classroom;
        dom.tableSubtitle.textContent = `${cr.student_count} estudiantes registrados`;
        dom.attendanceBody.innerHTML = '';

        cr.students.forEach((student, i) => {
            state.attendanceRecords.set(student.index, {
                status: 'A',
                reason: '',
                studentName: student.name,
                contact: student.contact,
            });

            const tr = document.createElement('tr');
            tr.id = `row-${student.index}`;
            tr.dataset.studentIndex = student.index;
            tr.dataset.studentName = student.name;

            tr.innerHTML = `
                <td class="col-index">${i + 1}</td>
                <td class="col-name"><span class="student-name">${escapeHTML(student.name)}</span></td>
                <td class="col-status">
                    <div class="status-toggle" data-index="${student.index}">
                        <button class="status-option active-present" data-status="A" title="Asistencia">A</button>
                        <button class="status-option" data-status="T" title="Tardanza">T</button>
                        <button class="status-option" data-status="F" title="Falta">F</button>
                    </div>
                </td>
                <td class="col-reason">
                    <input type="text" class="reason-input" data-index="${student.index}"
                           placeholder="Motivo de inasistencia…" disabled>
                </td>
            `;

            tr.querySelectorAll('.status-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    setStudentStatus(student.index, btn.dataset.status, tr);
                });
            });

            dom.attendanceBody.appendChild(tr);
        });
    }

    function setStudentStatus(studentIndex, status, rowElement) {
        const record = state.attendanceRecords.get(studentIndex);
        if (!record) return;

        record.status = status;

        const toggle = rowElement.querySelector('.status-toggle');
        toggle.querySelectorAll('.status-option').forEach(btn => {
            btn.className = 'status-option';
            if (btn.dataset.status === status) {
                const classMap = { A: 'active-present', T: 'active-late', F: 'active-absent' };
                btn.classList.add(classMap[status]);
            }
        });

        rowElement.classList.remove('row-absent', 'row-late');
        if (status === 'F') rowElement.classList.add('row-absent');
        if (status === 'T') rowElement.classList.add('row-late');

        const reasonInput = rowElement.querySelector('.reason-input');
        if (status === 'F') {
            reasonInput.disabled = false;
            reasonInput.oninput = () => { record.reason = reasonInput.value; };
        } else {
            reasonInput.disabled = true;
            reasonInput.value = '';
            record.reason = '';
        }

        updateStats();
    }

    // ─── CARGAR ASISTENCIA EXISTENTE PARA UNA FECHA ───────
    async function loadAttendanceForDate() {
        if (!state.currentClassroom || state.isLoadingAttendance) return;

        const date = dom.dateInput.value;
        if (!date) return;

        state.isLoadingAttendance = true;

        try {
            const result = await API.getAttendanceForDate(
                state.currentClassroom.classroom, date
            );

            if (result.success && result.data && result.data.found && result.data.records) {
                const records = result.data.records;
                let applied = 0;

                // Actualizar titulo con el de la hoja del mes
                if (result.data.sheet_title) {
                    dom.tableTitle.textContent = result.data.sheet_title;
                }

                // Aplicar los valores A/T/F existentes a la tabla
                state.attendanceRecords.forEach((record, index) => {
                    const existingStatus = records[record.studentName];
                    const row = document.getElementById(`row-${index}`);
                    if (!row) return;

                    if (existingStatus && (existingStatus === 'A' || existingStatus === 'T' || existingStatus === 'F')) {
                        setStudentStatus(index, existingStatus, row);
                        applied++;
                    } else {
                        // Sin dato → dejar en A por defecto
                        setStudentStatus(index, 'A', row);
                    }
                });

                if (applied > 0) {
                    showToast(`Asistencia cargada: ${applied} registros del ${formatDate(date)}`, 'info');
                }
            } else {
                // No hay datos para esta fecha, resetear todo a A
                state.attendanceRecords.forEach((record, index) => {
                    const row = document.getElementById(`row-${index}`);
                    if (row) setStudentStatus(index, 'A', row);
                });

                if (result.data && result.data.sheet_title) {
                    dom.tableTitle.textContent = result.data.sheet_title;
                }
            }

        } catch (error) {
            console.warn('No se pudo cargar asistencia existente:', error.message);
        } finally {
            state.isLoadingAttendance = false;
            updateStats();
        }
    }

    // ─── ACCIONES RAPIDAS ─────────────────────────────────
    function markAllPresent() {
        state.attendanceRecords.forEach((_, idx) => {
            const row = document.getElementById(`row-${idx}`);
            if (row) setStudentStatus(idx, 'A', row);
        });
        showToast('Todos marcados como presentes', 'info');
    }

    function resetAttendance() {
        if (state.currentClassroom) {
            renderAttendanceTable();
            updateStats();
            showToast('Registros reseteados', 'info');
        }
    }

    // ─── ESTADISTICAS ─────────────────────────────────────
    function updateStats() {
        let present = 0, late = 0, absent = 0;
        state.attendanceRecords.forEach(r => {
            if (r.status === 'A') present++;
            else if (r.status === 'T') late++;
            else if (r.status === 'F') absent++;
        });
        dom.statPresent.textContent = present;
        dom.statLate.textContent = late;
        dom.statAbsent.textContent = absent;
    }

    // ─── GUARDAR ──────────────────────────────────────────
    function handleSave() {
        if (state.isSaving || !state.currentClassroom) return;

        const date = dom.dateInput.value;
        if (!date) { showToast('Selecciona una fecha', 'warning'); return; }

        let present = 0, late = 0, absent = 0;
        const absentN = [], lateN = [];

        state.attendanceRecords.forEach(r => {
            if (r.status === 'A') present++;
            else if (r.status === 'T') { late++; lateN.push(r.studentName); }
            else if (r.status === 'F') { absent++; absentN.push(r.studentName); }
        });

        let html = `
            <p style="margin-bottom:.75rem">¿Confirmar registro de asistencia?</p>
            <div class="summary-line"><span>Salón</span><span class="summary-value">${escapeHTML(state.currentClassroom.classroom)}</span></div>
            <div class="summary-line"><span>Fecha</span><span class="summary-value">${formatDate(date)}</span></div>
            <div class="summary-line"><span>Total</span><span class="summary-value">${state.attendanceRecords.size}</span></div>
            <div class="summary-line"><span>Presentes</span><span class="summary-value" style="color:var(--green)">${present}</span></div>
            <div class="summary-line"><span>Tardanzas</span><span class="summary-value" style="color:var(--amber)">${late}</span></div>
            <div class="summary-line"><span>Faltas</span><span class="summary-value" style="color:var(--red)">${absent}</span></div>
        `;
        if (absentN.length) html += `<p style="margin-top:.75rem;font-size:.82rem;color:var(--red)"><strong>Ausentes:</strong> ${absentN.map(n=>escapeHTML(n)).join(', ')}</p>`;
        if (lateN.length) html += `<p style="margin-top:.35rem;font-size:.82rem;color:var(--amber)"><strong>Tardanzas:</strong> ${lateN.map(n=>escapeHTML(n)).join(', ')}</p>`;
        html += `<p style="margin-top:.85rem;font-size:.8rem;color:var(--ink-muted)">Se actualizará el archivo en Google Drive.</p>`;

        showModal('Confirmar Asistencia', html, () => submitAttendance(date));
    }

    async function submitAttendance(date) {
        closeModal();
        state.isSaving = true;
        dom.btnSave.classList.add('saving');
        dom.btnSave.querySelector('span').textContent = 'Guardando…';

        try {
            const records = [];
            state.attendanceRecords.forEach((record, index) => {
                records.push({
                    student_name: record.studentName,
                    student_index: index,
                    status: record.status,
                    reason: record.reason || null,
                    contact: record.contact || null,
                });
            });

            const result = await API.saveAttendance({
                classroom: state.currentClassroom.classroom,
                date: date,
                records: records,
            });

            if (result.success) {
                showToast(
                    `Asistencia guardada: ${result.summary.attended} presentes, ` +
                    `${result.summary.late} tardanzas, ${result.summary.absent} faltas`,
                    'success'
                );
            } else {
                showToast('Error al guardar', 'error');
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            state.isSaving = false;
            dom.btnSave.classList.remove('saving');
            dom.btnSave.querySelector('span').textContent = 'Guardar Asistencia';
        }
    }

    // ─── UI HELPERS ───────────────────────────────────────
    function showLoading(show) {
        dom.loadingScreen.classList.toggle('hidden', !show);
    }

    function showEmptyState(show) {
        dom.emptyState.style.display = show ? 'block' : 'none';
    }

    function updateConnectionStatus(connected) {
        dom.connectionStatus.classList.remove('connected', 'error');
        if (connected) {
            dom.connectionStatus.classList.add('connected');
            dom.statusText.textContent = 'Conectado';
        } else {
            dom.connectionStatus.classList.add('error');
            dom.statusText.textContent = 'Sin conexión';
        }
    }

    function showModal(title, bodyHTML, onConfirm) {
        dom.modalTitle.textContent = title;
        dom.modalBody.innerHTML = bodyHTML;
        dom.modalOverlay.classList.add('active');
        dom.modalConfirm.onclick = () => { if (typeof onConfirm === 'function') onConfirm(); };
    }

    function closeModal() { dom.modalOverlay.classList.remove('active'); }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = {
            success:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            error:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            warning:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01"/></svg>',
            info:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
        };
        toast.innerHTML = `${icons[type]||icons.info}<span>${escapeHTML(message)}</span>`;
        dom.toastContainer.appendChild(toast);
        setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 5000);
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        const [y, m, d] = dateStr.split('-');
        const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        return `${parseInt(d)} de ${months[parseInt(m)-1]} de ${y}`;
    }

    document.addEventListener('DOMContentLoaded', init);
    return { state, loadData };
})();
