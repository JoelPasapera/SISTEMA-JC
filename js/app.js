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
        addRefreshButton();
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

    function addRefreshButton() {
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) return;

        const btn = document.createElement('button');
        btn.id = 'btn-refresh';
        btn.title = 'Sincronizar datos desde Google Drive';
        btn.style.cssText = 'padding:.35rem .75rem;border:1px solid #d8d5cf;border-radius:6px;background:transparent;font-family:inherit;font-size:.78rem;color:#6b6b8d;cursor:pointer;margin-right:.5rem;display:flex;align-items:center;gap:.35rem;';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Sincronizar';

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin .8s linear infinite"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Sincronizando...';
            try {
                await API.refreshCache();
                showToast('Datos sincronizados desde Google Drive', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (e) {
                showToast('Error: ' + e.message, 'error');
                btn.disabled = false;
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Sincronizar';
            }
        });

        headerActions.insertBefore(btn, headerActions.firstChild);
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
        showToast(`Cargando asistencia del ${formatDate(date)}...`, 'info');

        try {
            const classroomName = state.currentClassroom.classroom;
            const url = `${classroomName}/${date}`;

            const result = await API.getAttendanceForDate(classroomName, date);

            if (!result || !result.success) {
                showToast('El servidor no devolvió datos válidos', 'warning');
                return;
            }

            const data = result.data;

            // Actualizar título si viene
            if (data.sheet_title) {
                dom.tableTitle.textContent = data.sheet_title;
            }

            if (data.found && data.records) {
                const records = data.records;
                const recordKeys = Object.keys(records);
                let applied = 0;
                let notFound = 0;

                state.attendanceRecords.forEach((record, index) => {
                    const row = document.getElementById(`row-${index}`);
                    if (!row) return;

                    // Buscar el estudiante en los registros del backend
                    const studentName = record.studentName;
                    let existingStatus = records[studentName] || null;

                    // Si no se encontró, intentar búsqueda flexible (ignorar mayúsculas/espacios extra)
                    if (!existingStatus) {
                        const nameLower = studentName.toLowerCase().trim();
                        for (const [key, val] of Object.entries(records)) {
                            if (key.toLowerCase().trim() === nameLower) {
                                existingStatus = val;
                                break;
                            }
                        }
                    }

                    if (existingStatus && ['A', 'T', 'F'].includes(existingStatus)) {
                        setStudentStatus(index, existingStatus, row);
                        applied++;
                    } else {
                        setStudentStatus(index, 'A', row);
                        notFound++;
                    }
                });

                showToast(`${data.month} día ${data.day}: ${applied} registros cargados`, 'success');

            } else {
                // No hay datos para esta fecha
                state.attendanceRecords.forEach((record, index) => {
                    const row = document.getElementById(`row-${index}`);
                    if (row) setStudentStatus(index, 'A', row);
                });
                showToast(`Sin registros para ${formatDate(date)} (${data.month})`, 'warning');
            }

        } catch (error) {
            showToast(`Error cargando asistencia: ${error.message}`, 'error');
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

                // Mostrar panel de WhatsApp con links directos
                if (result.whatsapp && result.whatsapp.total_absent > 0) {
                    showWhatsAppPanel(result.whatsapp, state.currentClassroom.classroom);
                } else if (result.whatsapp) {
                    // Solo mostrar botón de copiar resumen para el grupo
                    showWhatsAppPanel(result.whatsapp, state.currentClassroom.classroom);
                }
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

    function showWhatsAppPanel(waData, classroom) {
        let html = '';

        // ─── Resumen para el grupo ────────────────────────
        html += `<div style="margin-bottom:1.25rem;">`;
        html += `<p style="font-weight:600;font-size:.85rem;margin-bottom:.5rem;">📋 Resumen para el grupo</p>`;
        html += `<div style="background:var(--surface-2);padding:.75rem;border-radius:8px;font-size:.82rem;white-space:pre-line;line-height:1.6;font-family:var(--font-body);" id="wa-summary-text">${escapeHTML(waData.summary_text)}</div>`;
        html += `<div style="margin-top:.5rem;display:flex;align-items:center;gap:.5rem;">`;
        html += `<button id="wa-copy-btn" style="padding:.4rem .85rem;border:1.5px solid var(--teal);border-radius:6px;background:transparent;color:var(--teal);font-family:var(--font-body);font-size:.78rem;font-weight:500;cursor:pointer;">Copiar mensaje</button>`;
        html += `<span id="wa-copy-status" style="font-size:.72rem;color:var(--green);display:none;">✓ Copiado al portapapeles</span>`;
        html += `</div></div>`;

        // ─── Links individuales para padres ────────────────
        if (waData.parent_links && waData.parent_links.length > 0) {
            html += `<p style="font-weight:600;font-size:.85rem;margin-bottom:.25rem;">📱 Avisos de inasistencia (${waData.total_absent})</p>`;

            if (waData.with_phone > 0) {
                html += `<div id="wa-auto-status" style="font-size:.78rem;color:var(--teal);margin-bottom:.65rem;padding:.4rem .65rem;background:var(--teal-soft);border-radius:6px;font-weight:500;">
                    ⏳ Abriendo mensajes automáticamente...
                </div>`;
            }

            html += `<div style="display:flex;flex-direction:column;gap:.35rem;" id="wa-links-container">`;

            waData.parent_links.forEach((p, i) => {
                if (p.has_phone) {
                    html += `<a href="${p.link}" target="_blank" rel="noopener" class="wa-parent-link" data-idx="${i}"
                        style="display:flex;align-items:center;gap:.65rem;padding:.55rem .85rem;
                               border-radius:8px;background:#dcf8c6;text-decoration:none;
                               color:#1a1a2e;font-size:.82rem;transition:all .2s;border:1px solid #b5e4a0;">
                        <span class="wa-link-icon" style="font-size:1.1rem;">💬</span>
                        <span style="flex:1;">
                            <strong>${escapeHTML(p.name)}</strong>
                            <span style="font-size:.72rem;color:#6b6b8d;margin-left:.35rem;">${p.phone_display}</span>
                        </span>
                        <span class="wa-link-status" style="font-size:.7rem;color:#25d366;font-weight:600;">Pendiente</span>
                    </a>`;
                } else {
                    html += `<div style="display:flex;align-items:center;gap:.65rem;padding:.55rem .85rem;
                               border-radius:8px;background:var(--red-soft);font-size:.82rem;border:1px solid #f5c4b3;">
                        <span style="font-size:1.1rem;">⚠️</span>
                        <span><strong>${escapeHTML(p.name)}</strong>
                        <span style="font-size:.72rem;color:var(--red);">— Sin número de contacto</span></span>
                    </div>`;
                }
            });

            html += `</div>`;

            // Botón manual por si el auto-open falla (popups bloqueados)
            if (waData.with_phone > 0) {
                html += `<button id="wa-manual-btn" style="display:none;margin-top:.85rem;padding:.5rem 1rem;border:none;border-radius:8px;
                         background:#25d366;color:#fff;font-family:var(--font-body);
                         font-size:.82rem;font-weight:600;cursor:pointer;width:100%;">
                    Abrir todos manualmente (${waData.with_phone})
                </button>`;
            }
        } else {
            html += `<p style="font-size:.82rem;color:var(--green);margin-top:.5rem;">✓ No hubo inasistencias — asistencia perfecta 🎉</p>`;
        }

        showModal('WhatsApp — Notificaciones', html, closeModal);

        dom.modalConfirm.textContent = 'Cerrar';
        dom.modalCancel.style.display = 'none';

        // ─── AUTO-ACCIONES ────────────────────────────────
        // 1) Auto-copiar resumen al portapapeles
        setTimeout(() => {
            const summaryEl = document.getElementById('wa-summary-text');
            const copyBtn = document.getElementById('wa-copy-btn');
            const copyStatus = document.getElementById('wa-copy-status');

            if (summaryEl) {
                navigator.clipboard.writeText(summaryEl.innerText).then(() => {
                    if (copyStatus) {
                        copyStatus.style.display = 'inline';
                    }
                    if (copyBtn) {
                        copyBtn.textContent = 'Copiado ✓';
                        copyBtn.style.borderColor = 'var(--green)';
                        copyBtn.style.color = 'var(--green)';
                    }
                }).catch(() => {});
            }

            // Botón copiar manual por si falla el auto-copy
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(summaryEl.innerText).then(() => {
                        copyBtn.textContent = 'Copiado ✓';
                        copyBtn.style.borderColor = 'var(--green)';
                        copyBtn.style.color = 'var(--green)';
                        if (copyStatus) copyStatus.style.display = 'inline';
                    });
                });
            }
        }, 500);

        // 2) Auto-abrir links de padres uno por uno
        if (waData.with_phone > 0) {
            const links = [];
            waData.parent_links.forEach(p => {
                if (p.has_phone && p.link) links.push(p);
            });

            let opened = 0;
            let blocked = false;

            function openNextLink() {
                if (opened >= links.length) {
                    // Terminado
                    const statusEl = document.getElementById('wa-auto-status');
                    if (statusEl) {
                        statusEl.textContent = `✓ ${opened} mensajes abiertos en WhatsApp`;
                        statusEl.style.background = '#dcf8c6';
                        statusEl.style.color = '#1a7a1a';
                    }
                    return;
                }

                const link = links[opened];
                const linkEl = document.querySelector(`.wa-parent-link[data-idx="${waData.parent_links.indexOf(link)}"]`);

                // Intentar abrir
                const win = window.open(link.link, '_blank');

                if (!win || win.closed) {
                    // Popup bloqueado — parar y mostrar botón manual
                    blocked = true;
                    const statusEl = document.getElementById('wa-auto-status');
                    if (statusEl) {
                        statusEl.innerHTML = '⚠️ Tu navegador bloqueó las ventanas. Haz clic en cada nombre para enviar, o permite popups para este sitio.';
                        statusEl.style.background = 'var(--amber-soft)';
                        statusEl.style.color = 'var(--amber)';
                    }
                    const manualBtn = document.getElementById('wa-manual-btn');
                    if (manualBtn) {
                        manualBtn.style.display = 'block';
                        manualBtn.addEventListener('click', () => {
                            const allLinks = document.querySelectorAll('.wa-parent-link');
                            let j = 0;
                            function manualOpen() {
                                if (j < allLinks.length) {
                                    window.open(allLinks[j].href, '_blank');
                                    j++;
                                    setTimeout(manualOpen, 1500);
                                }
                            }
                            manualOpen();
                            manualBtn.textContent = 'Abriendo...';
                            manualBtn.disabled = true;
                        });
                    }
                    return;
                }

                // Marcar como abierto visualmente
                if (linkEl) {
                    const icon = linkEl.querySelector('.wa-link-icon');
                    const status = linkEl.querySelector('.wa-link-status');
                    if (icon) icon.textContent = '✅';
                    if (status) { status.textContent = 'Abierto'; status.style.color = '#1a7a1a'; }
                    linkEl.style.background = '#f0fff0';
                    linkEl.style.borderColor = '#a0d8a0';
                }

                opened++;
                const statusEl = document.getElementById('wa-auto-status');
                if (statusEl) {
                    statusEl.textContent = `⏳ Abriendo ${opened}/${links.length}...`;
                }

                // Siguiente con delay
                setTimeout(openNextLink, 1500);
            }

            // Empezar después de 1.5s (dar tiempo a ver el panel)
            setTimeout(openNextLink, 1500);
        }
    }

    function closeModal() {
        dom.modalOverlay.classList.remove('active');
        dom.modalCancel.style.display = '';
        dom.modalConfirm.textContent = 'Confirmar';
    }

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
