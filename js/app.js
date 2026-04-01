/**
 * ════════════════════════════════════════════════════════════
 *  APP.JS — Lógica principal de la aplicación
 *  Maneja la interfaz de usuario, estado de la vista,
 *  y las interacciones del usuario.
 *  Toda la lógica de negocio y procesamiento de datos
 *  se delega al backend mediante API.js.
 * ════════════════════════════════════════════════════════════
 */

const App = (() => {
    'use strict';

    // ─── Estado de la aplicación ──────────────────────────
    const state = {
        classrooms: [],              // Datos de salones del servidor
        currentClassroom: null,      // Salón seleccionado
        attendanceRecords: new Map(), // Map<index, {status, reason}>
        isLoading: false,
        isSaving: false,
    };

    // ─── Referencias DOM (se cachean al iniciar) ──────────
    const dom = {};

    // ────────────────────────────────────────────────────────
    //  INICIALIZACIÓN
    // ────────────────────────────────────────────────────────

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
        // Fecha actual en el header
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const formatted = now.toLocaleDateString('es-PE', options);
        dom.headerDate.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);

        // Date picker con fecha de hoy
        dom.dateInput.value = now.toISOString().split('T')[0];
    }

    function bindEvents() {
        // Navegación de secciones
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => switchSection(tab.dataset.section));
        });

        // Acciones rápidas
        dom.btnAllPresent.addEventListener('click', markAllPresent);
        dom.btnReset.addEventListener('click', resetAttendance);
        dom.btnSave.addEventListener('click', handleSave);
        dom.btnRetry.addEventListener('click', loadData);

        // Modal
        dom.modalClose.addEventListener('click', closeModal);
        dom.modalCancel.addEventListener('click', closeModal);
        dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.modalOverlay) closeModal();
        });
    }

    // ────────────────────────────────────────────────────────
    //  CARGA DE DATOS
    // ────────────────────────────────────────────────────────

    async function loadData() {
        state.isLoading = true;
        showLoading(true);

        // Verificar conexión
        const connected = await API.checkConnection();
        updateConnectionStatus(connected);

        if (!connected) {
            showLoading(false);
            showEmptyState(true);
            showToast('No se pudo conectar con el servidor', 'error');
            return;
        }

        try {
            // Obtener todos los salones con estudiantes
            const data = await API.getClassrooms();

            if (!data.success || !data.classrooms || data.classrooms.length === 0) {
                showEmptyState(true);
                showToast('No se encontraron salones', 'warning');
                return;
            }

            state.classrooms = data.classrooms;
            renderClassroomTabs();
            showEmptyState(false);

            // Seleccionar el primer salón automáticamente
            selectClassroom(state.classrooms[0].classroom);

        } catch (error) {
            console.error('Error cargando datos:', error);
            showEmptyState(true);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            state.isLoading = false;
            showLoading(false);
        }
    }

    // ────────────────────────────────────────────────────────
    //  NAVEGACIÓN
    // ────────────────────────────────────────────────────────

    function switchSection(sectionName) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        document.getElementById(`section-${sectionName}`).classList.add('active');
    }

    // ────────────────────────────────────────────────────────
    //  SALONES
    // ────────────────────────────────────────────────────────

    function renderClassroomTabs() {
        dom.classroomTabs.innerHTML = '';

        state.classrooms.forEach(cr => {
            const btn = document.createElement('button');
            btn.className = 'classroom-tab';
            btn.dataset.classroom = cr.classroom;
            btn.innerHTML = `
                ${cr.classroom}
                <span class="tab-count">${cr.student_count}</span>
            `;
            btn.addEventListener('click', () => selectClassroom(cr.classroom));
            dom.classroomTabs.appendChild(btn);
        });
    }

    function selectClassroom(classroomName) {
        // Actualizar estado
        state.currentClassroom = state.classrooms.find(
            c => c.classroom === classroomName
        );

        if (!state.currentClassroom) return;

        // Actualizar tabs activos
        document.querySelectorAll('.classroom-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.classroom === classroomName);
        });

        // Resetear registros de asistencia
        state.attendanceRecords.clear();

        // Mostrar controles
        dom.dateWrapper.style.display = 'flex';
        dom.attendanceContainer.style.display = 'block';

        // Renderizar tabla
        renderAttendanceTable();
        updateStats();
        dom.btnSave.disabled = false;
    }

    // ────────────────────────────────────────────────────────
    //  TABLA DE ASISTENCIA
    // ────────────────────────────────────────────────────────

    function renderAttendanceTable() {
        const cr = state.currentClassroom;
        if (!cr) return;

        // Encabezado
        dom.tableTitle.textContent = cr.title || cr.classroom;
        dom.tableSubtitle.textContent = `${cr.student_count} estudiantes registrados`;

        // Cuerpo de la tabla
        dom.attendanceBody.innerHTML = '';

        cr.students.forEach((student, i) => {
            // Estado por defecto: Asistencia
            state.attendanceRecords.set(student.index, {
                status: 'A',
                reason: '',
                studentName: student.name,
                contact: student.contact,
            });

            const tr = document.createElement('tr');
            tr.id = `row-${student.index}`;
            tr.dataset.studentIndex = student.index;

            tr.innerHTML = `
                <td class="col-index">${i + 1}</td>
                <td class="col-name">
                    <span class="student-name">${escapeHTML(student.name)}</span>
                </td>
                <td class="col-status">
                    <div class="status-toggle" data-index="${student.index}">
                        <button class="status-option active-present" data-status="A"
                                title="Asistencia">A</button>
                        <button class="status-option" data-status="T"
                                title="Tardanza">T</button>
                        <button class="status-option" data-status="F"
                                title="Falta">F</button>
                    </div>
                </td>
                <td class="col-reason">
                    <input type="text" class="reason-input"
                           data-index="${student.index}"
                           placeholder="Motivo de inasistencia…"
                           disabled>
                </td>
            `;

            // Eventos de los botones de estado
            const toggleBtns = tr.querySelectorAll('.status-option');
            toggleBtns.forEach(btn => {
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

        // Actualizar botones visuales
        const toggle = rowElement.querySelector('.status-toggle');
        toggle.querySelectorAll('.status-option').forEach(btn => {
            btn.className = 'status-option';
            if (btn.dataset.status === status) {
                const classMap = { A: 'active-present', T: 'active-late', F: 'active-absent' };
                btn.classList.add(classMap[status]);
            }
        });

        // Estilo de fila
        rowElement.classList.remove('row-absent', 'row-late');
        if (status === 'F') rowElement.classList.add('row-absent');
        if (status === 'T') rowElement.classList.add('row-late');

        // Activar/desactivar campo de motivo
        const reasonInput = rowElement.querySelector('.reason-input');
        if (status === 'F') {
            reasonInput.disabled = false;
            reasonInput.focus();
            // Escuchar cambios en el motivo
            reasonInput.oninput = () => {
                record.reason = reasonInput.value;
            };
        } else {
            reasonInput.disabled = true;
            reasonInput.value = '';
            record.reason = '';
        }

        updateStats();
    }

    // ────────────────────────────────────────────────────────
    //  ACCIONES RÁPIDAS
    // ────────────────────────────────────────────────────────

    function markAllPresent() {
        state.attendanceRecords.forEach((record, index) => {
            const row = document.getElementById(`row-${index}`);
            if (row) setStudentStatus(index, 'A', row);
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

    // ────────────────────────────────────────────────────────
    //  ESTADÍSTICAS
    // ────────────────────────────────────────────────────────

    function updateStats() {
        let present = 0, late = 0, absent = 0;
        state.attendanceRecords.forEach(record => {
            if (record.status === 'A') present++;
            else if (record.status === 'T') late++;
            else if (record.status === 'F') absent++;
        });

        dom.statPresent.textContent = present;
        dom.statLate.textContent = late;
        dom.statAbsent.textContent = absent;
    }

    // ────────────────────────────────────────────────────────
    //  GUARDAR ASISTENCIA
    // ────────────────────────────────────────────────────────

    function handleSave() {
        if (state.isSaving || !state.currentClassroom) return;

        const date = dom.dateInput.value;
        if (!date) {
            showToast('Selecciona una fecha de registro', 'warning');
            return;
        }

        // Preparar datos para el modal de confirmación
        let present = 0, late = 0, absent = 0;
        const absentNames = [];
        const lateNames = [];

        state.attendanceRecords.forEach(record => {
            if (record.status === 'A') present++;
            else if (record.status === 'T') {
                late++;
                lateNames.push(record.studentName);
            }
            else if (record.status === 'F') {
                absent++;
                absentNames.push(record.studentName);
            }
        });

        // Construir contenido del modal
        let bodyHTML = `
            <p style="margin-bottom:.75rem;">¿Confirmar el registro de asistencia?</p>
            <div class="summary-line">
                <span>Salón</span>
                <span class="summary-value">${escapeHTML(state.currentClassroom.classroom)}</span>
            </div>
            <div class="summary-line">
                <span>Fecha</span>
                <span class="summary-value">${formatDate(date)}</span>
            </div>
            <div class="summary-line">
                <span>Total estudiantes</span>
                <span class="summary-value">${state.attendanceRecords.size}</span>
            </div>
            <div class="summary-line">
                <span>Presentes</span>
                <span class="summary-value" style="color:var(--green)">${present}</span>
            </div>
            <div class="summary-line">
                <span>Tardanzas</span>
                <span class="summary-value" style="color:var(--amber)">${late}</span>
            </div>
            <div class="summary-line">
                <span>Faltas</span>
                <span class="summary-value" style="color:var(--red)">${absent}</span>
            </div>
        `;

        if (absentNames.length > 0) {
            bodyHTML += `<p style="margin-top:.75rem;font-size:.82rem;color:var(--red)">
                <strong>Ausentes:</strong> ${absentNames.map(n => escapeHTML(n)).join(', ')}
            </p>`;
        }
        if (lateNames.length > 0) {
            bodyHTML += `<p style="margin-top:.35rem;font-size:.82rem;color:var(--amber)">
                <strong>Tardanzas:</strong> ${lateNames.map(n => escapeHTML(n)).join(', ')}
            </p>`;
        }

        bodyHTML += `<p style="margin-top:.85rem;font-size:.8rem;color:var(--ink-muted)">
            Se actualizará Google Drive y se enviarán notificaciones por WhatsApp.
        </p>`;

        showModal('Confirmar Asistencia', bodyHTML, () => submitAttendance(date));
    }

    async function submitAttendance(date) {
        closeModal();
        state.isSaving = true;
        dom.btnSave.classList.add('saving');
        dom.btnSave.querySelector('span').textContent = 'Guardando…';

        try {
            // Construir payload (solo datos, sin lógica)
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

            const payload = {
                classroom: state.currentClassroom.classroom,
                date: date,
                records: records,
            };

            // Enviar al servidor — toda la lógica la maneja el backend
            const result = await API.saveAttendance(payload);

            if (result.success) {
                showToast(
                    `Asistencia guardada: ${result.summary.attended} presentes, ` +
                    `${result.summary.late} tardanzas, ${result.summary.absent} faltas`,
                    'success'
                );
            } else {
                showToast('Error al guardar la asistencia', 'error');
            }

        } catch (error) {
            console.error('Error guardando asistencia:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            state.isSaving = false;
            dom.btnSave.classList.remove('saving');
            dom.btnSave.querySelector('span').textContent = 'Guardar Asistencia';
        }
    }

    // ────────────────────────────────────────────────────────
    //  UI HELPERS
    // ────────────────────────────────────────────────────────

    function showLoading(show) {
        if (show) {
            dom.loadingScreen.classList.remove('hidden');
        } else {
            dom.loadingScreen.classList.add('hidden');
        }
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

        // Rebind confirm button
        dom.modalConfirm.onclick = () => {
            if (typeof onConfirm === 'function') onConfirm();
        };
    }

    function closeModal() {
        dom.modalOverlay.classList.remove('active');
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            error:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01M10.29 3.86l-8.4 14.57A1 1 0 002.76 20h16.48a1 1 0 00.87-1.49L11.7 3.86a1 1 0 00-1.42-.08z"/></svg>',
            info:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
        };

        toast.innerHTML = `${icons[type] || icons.info}<span>${escapeHTML(message)}</span>`;
        dom.toastContainer.appendChild(toast);

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // ─── Utilidades ───────────────────────────────────────
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        const [year, month, day] = dateStr.split('-');
        const months = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        return `${parseInt(day)} de ${months[parseInt(month) - 1]} de ${year}`;
    }

    // ────────────────────────────────────────────────────────
    //  ARRANQUE
    // ────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);

    return { state, loadData };

})();
