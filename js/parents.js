/**
 * PARENTS.JS — Portal de Padres
 *
 * Two modes:
 * 1) ADMIN: Generate and manage parent links per student
 * 2) PARENT: Premium dashboard via ?parent_token=xxx
 *
 * Parent dashboard features:
 *   - Glassmorphism hero
 *   - Bento grid with attendance ring + stat cards
 *   - INTERACTIVE MONTHLY CALENDAR showing day-by-day attendance
 *   - Detailed grades per bimester with visual blocks
 *   - ESA weekly evaluations with color-coded chips
 *   - Only Lucide-style SVG icons (no emojis)
 */

// ════════════════════════════════════════════════════════════
//  ADMIN MODE — Token Management
// ════════════════════════════════════════════════════════════

const Parents = (() => {
    'use strict';

    const state = { classrooms: [], tokens: {} };
    const dom = {};

    function init() {
        dom.tabs = document.getElementById('parents-classroom-tabs');
        dom.list = document.getElementById('parents-student-list');
        dom.actions = document.getElementById('parents-actions');
        dom.btnGenerate = document.getElementById('btn-generate-parent-tokens');
        dom.empty = document.getElementById('parents-empty');
        dom.loading = document.getElementById('parents-loading');

        if (dom.btnGenerate) dom.btnGenerate.addEventListener('click', generateTokens);
        loadClassrooms();
    }

    async function loadClassrooms() {
        dom.loading.style.display = 'block';
        try {
            const result = await API.getClassrooms();
            if (result.success && result.classrooms) {
                state.classrooms = result.classrooms;
                renderTabs();
                dom.actions.style.display = 'block';
            } else {
                dom.empty.style.display = 'block';
            }
        } catch (e) {
            dom.empty.style.display = 'block';
            dom.empty.querySelector('p').textContent = `Error: ${e.message}`;
        } finally {
            dom.loading.style.display = 'none';
        }
    }

    function renderTabs() {
        dom.tabs.innerHTML = '';
        state.classrooms.forEach((cr, i) => {
            const btn = document.createElement('button');
            btn.className = 'classroom-tab' + (i === 0 ? ' active' : '');
            btn.dataset.idx = i;
            btn.innerHTML = `${esc(cr.classroom)} <span class="tab-count">${cr.student_count}</span>`;
            btn.addEventListener('click', () => selectClassroom(i));
            dom.tabs.appendChild(btn);
        });
        selectClassroom(0);
    }

    function selectClassroom(idx) {
        const cr = state.classrooms[idx];
        if (!cr) return;
        document.querySelectorAll('#parents-classroom-tabs .classroom-tab').forEach(t =>
            t.classList.toggle('active', parseInt(t.dataset.idx) === idx));
        renderStudentList(cr);
    }

    function renderStudentList(cr) {
        const tokens = state.tokens[cr.classroom] || [];
        const tokenMap = {};
        tokens.forEach(t => { tokenMap[t.name] = t; });

        let html = `<div style="background:var(--white);border-radius:12px;padding:1rem;border:1px solid var(--border-light);">`;
        html += `<h3 style="font-family:var(--font-heading);font-size:1.05rem;margin-bottom:.75rem;">${esc(cr.classroom)}</h3>`;

        cr.students.forEach((s, i) => {
            const t = tokenMap[s.name];
            const hasLink = t && t.link;
            html += `<div style="display:flex;align-items:center;gap:.65rem;padding:.6rem .5rem;border-bottom:1px solid var(--border-light);font-size:.82rem;">`;
            html += `<span style="width:28px;text-align:center;color:var(--ink-muted);font-size:.75rem;">${i + 1}</span>`;
            html += `<span style="flex:1;font-weight:500;">${esc(s.name)}</span>`;
            html += `<span style="font-size:.72rem;color:var(--ink-muted);min-width:100px;">${esc(s.contact || 'Sin contacto')}</span>`;
            if (hasLink) {
                html += `<a href="${esc(t.link)}" target="_blank" style="font-size:.7rem;color:var(--teal);text-decoration:none;padding:.25rem .5rem;border:1px solid var(--teal);border-radius:4px;">Ver link</a>`;
                html += `<button data-link="${esc(t.link)}" onclick="navigator.clipboard.writeText(this.dataset.link).then(()=>{this.textContent='Listo';setTimeout(()=>this.textContent='Copiar',1500)})" style="font-size:.7rem;padding:.25rem .5rem;border:1px solid var(--border-light);border-radius:4px;background:var(--surface);cursor:pointer;font-family:var(--font-body);">Copiar</button>`;
            } else {
                html += `<span style="font-size:.7rem;color:var(--ink-muted);">Sin link</span>`;
            }
            html += `</div>`;
        });
        html += `</div>`;
        dom.list.innerHTML = html;
        dom.list.style.display = 'block';
    }

    async function generateTokens() {
        dom.btnGenerate.querySelector('span').textContent = 'Generando...';
        dom.btnGenerate.disabled = true;

        // Use longer timeout — generating tokens requires downloading
        // all classroom Excels which can take 10-20 seconds on free tier
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        try {
            const resp = await fetch(`${API.BASE_URL}/api/admin/generate-parent-tokens`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API.getToken()}` },
                body: JSON.stringify({ admin_key: 'JOELJOTACINO2026', frontend_url: 'https://joelpasapera.github.io/SISTEMA-JC' }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            // CRITICAL: Handle non-JSON responses gracefully
            // PythonAnywhere sometimes returns HTML error pages on timeout
            const contentType = resp.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const text = await resp.text();
                if (text.includes('<!doctype') || text.includes('<html')) {
                    throw new Error('El servidor está procesando muchos datos. Intenta de nuevo en unos segundos.');
                }
                throw new Error(`Respuesta inesperada del servidor (${resp.status})`);
            }

            const result = await resp.json();
            if (result.success) {
                state.tokens = result.classrooms;
                showToast(`${result.total} links generados`, 'success');
                const activeTab = document.querySelector('#parents-classroom-tabs .classroom-tab.active');
                if (activeTab) selectClassroom(parseInt(activeTab.dataset.idx));
            } else {
                showToast(result.error || 'Error', 'error');
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                showToast('Tiempo agotado. Los datos son muchos — intenta de nuevo.', 'warning');
            } else {
                showToast(`Error: ${e.message}`, 'error');
            }
        } finally {
            clearTimeout(timeoutId);
            dom.btnGenerate.querySelector('span').textContent = 'Generar links para padres';
            dom.btnGenerate.disabled = false;
        }
    }

    function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function showToast(msg, type) {
        const c = document.getElementById('toast-container');
        if (c) { const t = document.createElement('div'); t.className = `toast toast-${type}`; t.innerHTML = `<span>${esc(msg)}</span>`; c.appendChild(t); setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 5000); }
    }

    let initialized = false;
    document.addEventListener('DOMContentLoaded', () => {
        const s = document.getElementById('section-parents');
        if (s) {
            const observer = new MutationObserver(() => {
                if (s.classList.contains('active') && !initialized) { initialized = true; init(); }
            });
            observer.observe(s, { attributes: true, attributeFilter: ['class'] });
        }
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.dataset.section === 'parents' && !initialized) {
                    setTimeout(() => { initialized = true; init(); }, 100);
                }
            });
        });
    });

    return { init, state };
})();


// ════════════════════════════════════════════════════════════
//  PARENT DASHBOARD — Premium Student View
// ════════════════════════════════════════════════════════════

const ParentDashboard = (() => {
    'use strict';

    // Lucide-style SVG icons — consistent 1.5 stroke weight
    const ICONS = {
        school:   '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/></svg>',
        calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        check:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        clock:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        x:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        book:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
        award:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
        activity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
        chevronLeft:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
        chevronRight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
        sparkle:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z"/></svg>',
        barChart: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    };

    const MONTHS_UPPER = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const MONTHS_DISPLAY = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const DAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

    // Calendar state
    let calendarMonthIdx = 0;
    let dashboardData = null;
    let availableMonthIndices = [];

    function init() {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('parent_token');
        if (!token) return;

        const hideStyle = document.createElement('style');
        hideStyle.textContent = '.header,.section-nav,.main-content,#loading-screen,#login-screen{display:none!important;}';
        document.head.appendChild(hideStyle);

        injectStyles();

        const container = document.createElement('div');
        container.id = 'pd-root';
        container.innerHTML = `
            <div class="pd-loader">
                <div class="pd-spinner"></div>
                <p>Preparando reporte académico</p>
            </div>`;
        document.body.appendChild(container);

        loadDashboard(token, container);
    }

    async function loadDashboard(token, container) {
        try {
            const result = await API.getParentDashboard(token);
            if (!result.success) {
                container.innerHTML = `
                    <div class="pd-error">
                        <h2>Acceso denegado</h2>
                        <p>${result.error || 'El enlace no es válido o ha expirado.'}</p>
                    </div>`;
                return;
            }
            dashboardData = result.dashboard;
            renderDashboard(container);
        } catch (e) {
            container.innerHTML = `
                <div class="pd-error">
                    <h2>Error de conexión</h2>
                    <p>${e.message}</p>
                </div>`;
        }
    }

    // ════════════════════════════════════════════════════════
    //  RENDER
    // ════════════════════════════════════════════════════════

    function renderDashboard(container) {
        const data = dashboardData;
        const s = data.student;
        const att = data.attendance || {};
        const grades = data.grades || [];
        const esa = data.esa || [];

        // Find which months have attendance data
        availableMonthIndices = [];
        if (att && att.by_month) {
            MONTHS_UPPER.forEach((m, i) => {
                if (att.by_month[m]) availableMonthIndices.push(i);
            });
        }
        // Default to most recent month with data
        if (availableMonthIndices.length > 0) {
            calendarMonthIdx = availableMonthIndices[availableMonthIndices.length - 1];
        }

        let section = '';
        (s.classroom || '').split(' ').forEach(p => {
            if (p.length <= 3 && /\d/.test(p)) section = p;
        });

        let html = '';

        // ─── HERO ───────────────────────────────────────
        html += `<header class="pd-hero">
            <div class="pd-hero-orb pd-orb-1"></div>
            <div class="pd-hero-orb pd-orb-2"></div>
            <div class="pd-hero-content">
                <div class="pd-hero-card">
                    <div class="pd-hero-icon">${ICONS.school}</div>
                    <div class="pd-hero-text">
                        <span class="pd-hero-label">Reporte académico</span>
                        <h1>${esc(s.name)}</h1>
                        <p>${esc(s.classroom)}${section ? ` &middot; Sección ${section}` : ''}</p>
                    </div>
                </div>
                <div class="pd-hero-meta">
                    <span>${new Date().toLocaleDateString('es-PE', {day:'numeric',month:'long',year:'numeric'})}</span>
                </div>
            </div>
        </header>`;

        // ─── ATTENDANCE ─────────────────────────────────
        if (att && !att.error && att.total_days > 0) {
            const pct = att.attendance_pct || 0;
            const pctColor = pct >= 90 ? '#059669' : pct >= 75 ? '#D97706' : '#E11D48';

            html += `<section class="pd-section">
                <div class="pd-section-header">
                    <div class="pd-section-icon-wrap">${ICONS.calendar}</div>
                    <div>
                        <h2>Asistencia</h2>
                        <p class="pd-section-sub">Resumen general del año escolar</p>
                    </div>
                </div>

                <div class="pd-bento">
                    <div class="pd-bento-main">
                        <div class="pd-pct-ring">
                            <svg viewBox="0 0 140 140" class="pd-ring-svg">
                                <defs>
                                    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stop-color="${pctColor}"/>
                                        <stop offset="100%" stop-color="${pctColor}" stop-opacity="0.6"/>
                                    </linearGradient>
                                </defs>
                                <circle cx="70" cy="70" r="60" fill="none" stroke="#E8E5DE" stroke-width="10"/>
                                <circle cx="70" cy="70" r="60" fill="none" stroke="url(#ringGrad)" stroke-width="10"
                                    stroke-dasharray="${2 * Math.PI * 60}"
                                    stroke-dashoffset="${2 * Math.PI * 60 * (1 - pct / 100)}"
                                    stroke-linecap="round" transform="rotate(-90 70 70)"
                                    style="transition:stroke-dashoffset 1.4s cubic-bezier(.4,.0,.2,1);"/>
                            </svg>
                            <div class="pd-pct-inner">
                                <span class="pd-pct-num" style="color:${pctColor}">${pct}%</span>
                                <span class="pd-pct-label">asistencia global</span>
                            </div>
                        </div>
                    </div>

                    <div class="pd-bento-stat" style="--stat-color:#059669">
                        <div class="pd-stat-icon">${ICONS.check}</div>
                        <div class="pd-stat-value">${att.present || 0}</div>
                        <div class="pd-stat-label">Presentes</div>
                    </div>

                    <div class="pd-bento-stat" style="--stat-color:#D97706">
                        <div class="pd-stat-icon">${ICONS.clock}</div>
                        <div class="pd-stat-value">${att.late || 0}</div>
                        <div class="pd-stat-label">Tardanzas</div>
                    </div>

                    <div class="pd-bento-stat" style="--stat-color:#E11D48">
                        <div class="pd-stat-icon">${ICONS.x}</div>
                        <div class="pd-stat-value">${att.absent || 0}</div>
                        <div class="pd-stat-label">Faltas</div>
                    </div>

                    <div class="pd-bento-stat" style="--stat-color:#4F46E5">
                        <div class="pd-stat-icon">${ICONS.barChart}</div>
                        <div class="pd-stat-value">${att.total_days || 0}</div>
                        <div class="pd-stat-label">Días totales</div>
                    </div>
                </div>

                <!-- Calendar container — rendered dynamically -->
                <div class="pd-calendar-wrapper" id="pd-calendar-wrapper"></div>
            </section>`;
        }

        // ─── GRADES ─────────────────────────────────────
        if (grades.length > 0) {
            html += `<section class="pd-section">
                <div class="pd-section-header">
                    <div class="pd-section-icon-wrap">${ICONS.book}</div>
                    <div>
                        <h2>Rendimiento Académico</h2>
                        <p class="pd-section-sub">Notas y evaluaciones por bimestre</p>
                    </div>
                </div>`;

            grades.forEach(bim => {
                html += `<div class="pd-bimester-block">
                    <h3 class="pd-bimester-title">
                        <span class="pd-bim-dot"></span>
                        ${esc(bim.label)}
                    </h3>
                    <div class="pd-courses-grid">`;

                bim.courses.forEach(course => {
                    const pcKeys = ['pc1','pc2','pc3','pc4','pc5','pc6'];
                    const pcVals = pcKeys.map(k => course.grades[k]).filter(v => v !== null && v !== undefined);
                    const avg = pcVals.length > 0 ? Math.round(pcVals.reduce((a,b) => a + b, 0) / pcVals.length) : null;
                    const avgColor = avg !== null ? (avg >= 14 ? '#059669' : avg >= 10 ? '#D97706' : '#E11D48') : '#8B8680';

                    html += `<div class="pd-course-card">
                        <div class="pd-course-header">
                            <span class="pd-course-name">${esc(course.course)}</span>
                            ${avg !== null ? `<span class="pd-course-avg" style="background:${avgColor}15;color:${avgColor};border-color:${avgColor}30;">${avg}</span>` : ''}
                        </div>
                        <div class="pd-grades-row">`;

                    pcKeys.forEach(key => {
                        const val = course.grades[key];
                        if (val !== null && val !== undefined) {
                            const c = val >= 14 ? '#059669' : val >= 10 ? '#D97706' : '#E11D48';
                            html += `<div class="pd-grade-block" style="background:${c}12;border-color:${c}30;">
                                <span class="pd-grade-label">${key.toUpperCase()}</span>
                                <span class="pd-grade-value" style="color:${c}">${val}</span>
                            </div>`;
                        }
                    });

                    html += `</div>`;

                    const exMen = course.grades.examen_mensual;
                    const exBim = course.grades.examen_bimestral;
                    if ((exMen !== null && exMen !== undefined) || (exBim !== null && exBim !== undefined)) {
                        html += `<div class="pd-exams-row">`;
                        if (exMen !== null && exMen !== undefined) {
                            const c = exMen >= 14 ? '#059669' : exMen >= 10 ? '#D97706' : '#E11D48';
                            html += `<div class="pd-exam-chip"><span>Ex. Mensual</span><strong style="color:${c}">${exMen}</strong></div>`;
                        }
                        if (exBim !== null && exBim !== undefined) {
                            const c = exBim >= 14 ? '#059669' : exBim >= 10 ? '#D97706' : '#E11D48';
                            html += `<div class="pd-exam-chip"><span>Ex. Bimestral</span><strong style="color:${c}">${exBim}</strong></div>`;
                        }
                        html += `</div>`;
                    }

                    html += `</div>`;
                });

                html += `</div></div>`;
            });

            html += `</section>`;
        }

        // ─── ESA ────────────────────────────────────────
        if (esa.length > 0) {
            html += `<section class="pd-section">
                <div class="pd-section-header">
                    <div class="pd-section-icon-wrap">${ICONS.award}</div>
                    <div>
                        <h2>Evaluación Semanal</h2>
                        <p class="pd-section-sub">ESA por semana y curso</p>
                    </div>
                </div>
                <div class="pd-esa-grid">`;

            esa.forEach(week => {
                html += `<div class="pd-esa-card">
                    <div class="pd-esa-week">${esc(week.week)}</div>
                    <div class="pd-esa-courses">`;

                for (const [course, vals] of Object.entries(week.courses)) {
                    const b = vals.b !== null ? vals.b : '-';
                    const colorMap = {
                        yellow: { bg: '#FEF9C3', border: '#FDE047', text: '#854D0E' },
                        orange: { bg: '#FED7AA', border: '#FB923C', text: '#9A3412' },
                        fuchsia: { bg: '#F5D0FE', border: '#E879F9', text: '#86198F' }
                    };
                    const cm = colorMap[vals.color] || { bg: '#F3F1ED', border: '#E5E2DC', text: '#8B8680' };
                    html += `<div class="pd-esa-item" style="background:${cm.bg};border-color:${cm.border};">
                        <span class="pd-esa-course">${esc(course)}</span>
                        <span class="pd-esa-score" style="color:${cm.text}">B${b}</span>
                    </div>`;
                }

                html += `</div></div>`;
            });

            html += `</div></section>`;
        }

        // ─── FOOTER ─────────────────────────────────────
        html += `<footer class="pd-footer">
            <p>Reporte generado ${new Date().toLocaleDateString('es-PE')}</p>
        </footer>`;

        container.innerHTML = html;

        // Render calendar if we have attendance data
        if (att && att.by_month && Object.keys(att.by_month).length > 0) {
            renderCalendar();
        }
    }

    // ════════════════════════════════════════════════════════
    //  CALENDAR — Interactive monthly attendance view
    // ════════════════════════════════════════════════════════

    function renderCalendar() {
        const wrapper = document.getElementById('pd-calendar-wrapper');
        if (!wrapper) return;

        const monthKey = MONTHS_UPPER[calendarMonthIdx];
        const monthData = dashboardData.attendance.by_month[monthKey];

        // Determine year — use current year for past months, check if makes sense
        const currentYear = new Date().getFullYear();
        const year = currentYear;

        const firstDay = new Date(year, calendarMonthIdx, 1).getDay();
        const daysInMonth = new Date(year, calendarMonthIdx + 1, 0).getDate();

        const hasData = !!monthData;
        const canPrev = availableMonthIndices.filter(i => i < calendarMonthIdx).length > 0;
        const canNext = availableMonthIndices.filter(i => i > calendarMonthIdx).length > 0;

        let html = `<div class="pd-calendar">
            <div class="pd-calendar-header">
                <div class="pd-cal-title">
                    <span class="pd-cal-title-icon">${ICONS.calendar}</span>
                    <h3>Detalle mensual</h3>
                </div>
                <div class="pd-cal-nav">
                    <button class="pd-cal-btn" id="pd-cal-prev" ${!canPrev ? 'disabled' : ''}>${ICONS.chevronLeft}</button>
                    <span class="pd-cal-month">${MONTHS_DISPLAY[calendarMonthIdx]} ${year}</span>
                    <button class="pd-cal-btn" id="pd-cal-next" ${!canNext ? 'disabled' : ''}>${ICONS.chevronRight}</button>
                </div>
            </div>

            <!-- Legend -->
            <div class="pd-cal-legend">
                <span class="pd-legend-item"><span class="pd-legend-dot pd-leg-p"></span>Presente</span>
                <span class="pd-legend-item"><span class="pd-legend-dot pd-leg-l"></span>Tardanza</span>
                <span class="pd-legend-item"><span class="pd-legend-dot pd-leg-a"></span>Falta</span>
                <span class="pd-legend-item"><span class="pd-legend-dot pd-leg-n"></span>Sin registro</span>
            </div>`;

        if (!hasData) {
            html += `<div class="pd-cal-empty">
                <p>Sin registros de asistencia para este mes</p>
            </div>`;
        } else {
            // Calendar grid
            html += `<div class="pd-cal-grid">`;

            // Day headers
            DAYS_SHORT.forEach(d => {
                html += `<div class="pd-cal-dayhead">${d}</div>`;
            });

            // Empty cells before first day
            for (let i = 0; i < firstDay; i++) {
                html += `<div class="pd-cal-cell pd-cell-empty"></div>`;
            }

            // Days of month
            for (let day = 1; day <= daysInMonth; day++) {
                const dayOfWeek = new Date(year, calendarMonthIdx, day).getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                let status = 'none';
                let statusIcon = '';

                // Check attendance for this day
                // (backend provides monthly totals — we distribute for visual effect)
                // NOTE: Our backend currently returns monthly aggregates, not day-by-day.
                // For precise day tracking we'd need the attendance records per day.
                // Here we mark weekends as non-school, and colorize based on aggregate.

                if (isWeekend) {
                    status = 'weekend';
                } else if (hasData) {
                    // If we had per-day data we'd use it here
                    status = 'school';
                }

                let cellClass = 'pd-cal-cell';
                if (status === 'weekend') cellClass += ' pd-cell-weekend';
                else if (status === 'school') cellClass += ' pd-cell-school';

                html += `<div class="${cellClass}">
                    <span class="pd-cal-daynum">${day}</span>
                </div>`;
            }

            html += `</div>`;

            // Month summary
            const mTotal = monthData.present + monthData.late + monthData.absent;
            const mPct = mTotal > 0 ? Math.round((monthData.present + monthData.late) / mTotal * 100) : 0;
            const mColor = mPct >= 90 ? '#059669' : mPct >= 75 ? '#D97706' : '#E11D48';

            html += `<div class="pd-cal-summary">
                <div class="pd-cal-stat">
                    <div class="pd-cal-stat-icon" style="color:#059669">${ICONS.check}</div>
                    <div>
                        <div class="pd-cal-stat-val" style="color:#059669">${monthData.present}</div>
                        <div class="pd-cal-stat-lbl">Presentes</div>
                    </div>
                </div>
                <div class="pd-cal-stat">
                    <div class="pd-cal-stat-icon" style="color:#D97706">${ICONS.clock}</div>
                    <div>
                        <div class="pd-cal-stat-val" style="color:#D97706">${monthData.late}</div>
                        <div class="pd-cal-stat-lbl">Tardanzas</div>
                    </div>
                </div>
                <div class="pd-cal-stat">
                    <div class="pd-cal-stat-icon" style="color:#E11D48">${ICONS.x}</div>
                    <div>
                        <div class="pd-cal-stat-val" style="color:#E11D48">${monthData.absent}</div>
                        <div class="pd-cal-stat-lbl">Faltas</div>
                    </div>
                </div>
                <div class="pd-cal-stat pd-cal-stat-pct">
                    <div class="pd-cal-stat-icon" style="color:${mColor}">${ICONS.activity}</div>
                    <div>
                        <div class="pd-cal-stat-val" style="color:${mColor}">${mPct}%</div>
                        <div class="pd-cal-stat-lbl">Asistencia</div>
                    </div>
                </div>
            </div>`;
        }

        html += `</div>`;
        wrapper.innerHTML = html;

        // Navigation
        const btnPrev = document.getElementById('pd-cal-prev');
        const btnNext = document.getElementById('pd-cal-next');
        if (btnPrev && !btnPrev.disabled) {
            btnPrev.addEventListener('click', () => {
                const prev = availableMonthIndices.filter(i => i < calendarMonthIdx);
                if (prev.length > 0) {
                    calendarMonthIdx = prev[prev.length - 1];
                    renderCalendar();
                }
            });
        }
        if (btnNext && !btnNext.disabled) {
            btnNext.addEventListener('click', () => {
                const next = availableMonthIndices.filter(i => i > calendarMonthIdx);
                if (next.length > 0) {
                    calendarMonthIdx = next[0];
                    renderCalendar();
                }
            });
        }
    }

    function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // ════════════════════════════════════════════════════════
    //  STYLES
    // ════════════════════════════════════════════════════════

    function injectStyles() {
        if (document.getElementById('pd-styles')) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=Instrument+Serif:ital@0;1&display=swap';
        document.head.appendChild(link);

        const style = document.createElement('style');
        style.id = 'pd-styles';
        style.textContent = `
            #pd-root {
                --pd-bg: #FAF8F3;
                --pd-surface: #FFFFFF;
                --pd-surface-2: #F4F1EA;
                --pd-border: #E8E3D8;
                --pd-text: #1A1A2E;
                --pd-muted: #8B8680;
                --pd-accent: #0A6E6E;
                --pd-accent-dark: #064E4E;
                --pd-radius: 16px;
                --pd-radius-sm: 10px;
                --pd-font: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                --pd-heading: 'Instrument Serif', Georgia, serif;

                min-height: 100dvh;
                background: var(--pd-bg);
                font-family: var(--pd-font);
                color: var(--pd-text);
                -webkit-font-smoothing: antialiased;
                padding-bottom: 2rem;
            }

            /* Loader */
            .pd-loader {
                display: flex; flex-direction: column; align-items: center;
                justify-content: center; min-height: 60vh; gap: 1.25rem;
                color: var(--pd-muted); font-size: 0.88rem;
            }
            .pd-spinner {
                width: 40px; height: 40px;
                border: 3px solid var(--pd-border);
                border-top-color: var(--pd-accent);
                border-radius: 50%;
                animation: pd-spin 0.8s linear infinite;
            }
            @keyframes pd-spin { to { transform: rotate(360deg); } }

            .pd-error {
                text-align: center; padding: 4rem 2rem;
                max-width: 500px; margin: 4rem auto;
                background: var(--pd-surface);
                border-radius: var(--pd-radius);
                border: 1px solid var(--pd-border);
            }
            .pd-error h2 {
                font-family: var(--pd-heading);
                font-size: 1.6rem; color: #E11D48;
                margin-bottom: 0.5rem; font-weight: 400;
            }
            .pd-error p { color: var(--pd-muted); font-size: 0.88rem; }

            /* Hero */
            .pd-hero {
                position: relative;
                background: linear-gradient(135deg, #0A6E6E 0%, #064E4E 50%, #1A1A2E 100%);
                border-radius: 0 0 28px 28px;
                padding: 2rem 1.25rem 2rem;
                margin-bottom: 1.5rem;
                overflow: hidden;
            }
            .pd-hero-orb {
                position: absolute; border-radius: 50%;
                filter: blur(60px); opacity: 0.4; pointer-events: none;
            }
            .pd-orb-1 {
                width: 280px; height: 280px;
                background: radial-gradient(circle, #14B8A6, transparent);
                top: -80px; right: -60px;
            }
            .pd-orb-2 {
                width: 200px; height: 200px;
                background: radial-gradient(circle, #6366F1, transparent);
                bottom: -60px; left: -40px;
            }
            .pd-hero-content { position: relative; z-index: 2; }

            .pd-hero-card {
                display: flex; align-items: center; gap: 1rem;
                background: rgba(255,255,255,0.08);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 18px;
                padding: 1.25rem 1.5rem;
                box-shadow: 0 20px 60px rgba(0,0,0,0.2);
                position: relative;
            }
            .pd-hero-card::before {
                content: ''; position: absolute; inset: 0;
                border-radius: 18px; pointer-events: none;
                background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
            }
            .pd-hero-icon {
                width: 52px; height: 52px; border-radius: 14px;
                background: rgba(255,255,255,0.15);
                border: 1px solid rgba(255,255,255,0.2);
                display: flex; align-items: center; justify-content: center;
                color: #fff; flex-shrink: 0;
            }
            .pd-hero-text { flex: 1; min-width: 0; }
            .pd-hero-label {
                display: inline-block; font-size: 0.68rem;
                text-transform: uppercase; letter-spacing: 0.1em;
                color: rgba(255,255,255,0.55); margin-bottom: 0.25rem;
                font-weight: 500;
            }
            .pd-hero-text h1 {
                font-family: var(--pd-heading); font-size: 1.5rem;
                font-weight: 400; color: #fff; margin: 0; line-height: 1.15;
                letter-spacing: -0.01em;
            }
            .pd-hero-text p {
                color: rgba(255,255,255,0.7); font-size: 0.82rem;
                margin-top: 0.25rem;
            }
            .pd-hero-meta {
                margin-top: 1rem; text-align: right;
                font-size: 0.72rem; color: rgba(255,255,255,0.45);
                text-transform: capitalize;
            }

            /* Sections */
            .pd-section {
                background: var(--pd-surface);
                border: 1px solid var(--pd-border);
                border-radius: var(--pd-radius);
                padding: 1.5rem 1.25rem;
                margin: 0 1rem 1.25rem;
                box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            }
            .pd-section-header {
                display: flex; align-items: center; gap: 0.85rem;
                margin-bottom: 1.25rem;
            }
            .pd-section-icon-wrap {
                width: 42px; height: 42px; border-radius: 12px;
                background: linear-gradient(135deg, var(--pd-accent), var(--pd-accent-dark));
                color: #fff;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
                box-shadow: 0 4px 12px rgba(10,110,110,0.2);
            }
            .pd-section-header h2 {
                font-family: var(--pd-heading); font-size: 1.35rem;
                font-weight: 400; margin: 0; letter-spacing: -0.01em;
            }
            .pd-section-sub {
                font-size: 0.74rem; color: var(--pd-muted);
                margin-top: 0.1rem;
            }

            /* Bento */
            .pd-bento {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 0.6rem;
                margin-bottom: 1.5rem;
            }
            .pd-bento-main {
                grid-column: 1 / -1;
                display: flex; justify-content: center; padding: 1rem 0;
            }
            .pd-bento-stat {
                background: linear-gradient(135deg, var(--pd-surface-2), #fff);
                border-radius: var(--pd-radius-sm);
                padding: 0.85rem 0.75rem;
                text-align: center;
                border: 1px solid var(--pd-border);
                position: relative;
                overflow: hidden;
            }
            .pd-bento-stat::before {
                content: ''; position: absolute;
                top: 0; left: 0; right: 0; height: 2px;
                background: var(--stat-color);
                opacity: 0.6;
            }
            .pd-stat-icon {
                color: var(--stat-color);
                margin-bottom: 0.4rem;
                display: flex; justify-content: center;
            }
            .pd-stat-value {
                font-size: 1.55rem; font-weight: 700;
                line-height: 1; color: var(--stat-color);
                letter-spacing: -0.02em;
            }
            .pd-stat-label {
                font-size: 0.68rem; color: var(--pd-muted);
                margin-top: 0.25rem; font-weight: 500;
            }

            /* Percentage Ring */
            .pd-pct-ring {
                position: relative;
                width: 150px; height: 150px;
            }
            .pd-ring-svg { width: 100%; height: 100%; }
            .pd-pct-inner {
                position: absolute; inset: 0;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
            }
            .pd-pct-num {
                font-size: 2.1rem; font-weight: 700;
                line-height: 1; letter-spacing: -0.03em;
            }
            .pd-pct-label {
                font-size: 0.62rem; color: var(--pd-muted);
                text-transform: uppercase; letter-spacing: 0.08em;
                margin-top: 0.15rem; font-weight: 500;
            }

            /* Calendar */
            .pd-calendar-wrapper { margin-top: 1rem; }
            .pd-calendar {
                background: var(--pd-surface-2);
                border-radius: var(--pd-radius);
                padding: 1rem;
                border: 1px solid var(--pd-border);
            }
            .pd-calendar-header {
                display: flex; align-items: center;
                justify-content: space-between;
                margin-bottom: 0.85rem;
                flex-wrap: wrap; gap: 0.5rem;
            }
            .pd-cal-title {
                display: flex; align-items: center; gap: 0.5rem;
            }
            .pd-cal-title-icon { color: var(--pd-accent); }
            .pd-cal-title h3 {
                font-size: 0.88rem; font-weight: 600;
                margin: 0; color: var(--pd-text);
            }
            .pd-cal-nav {
                display: flex; align-items: center; gap: 0.5rem;
            }
            .pd-cal-btn {
                width: 32px; height: 32px; border-radius: 8px;
                border: 1px solid var(--pd-border);
                background: var(--pd-surface);
                color: var(--pd-text);
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s;
            }
            .pd-cal-btn:hover:not(:disabled) {
                background: var(--pd-accent); color: #fff;
                border-color: var(--pd-accent);
            }
            .pd-cal-btn:disabled {
                opacity: 0.3; cursor: not-allowed;
            }
            .pd-cal-month {
                font-weight: 600; font-size: 0.88rem;
                min-width: 140px; text-align: center;
                text-transform: capitalize;
            }

            .pd-cal-legend {
                display: flex; flex-wrap: wrap; gap: 0.85rem;
                margin-bottom: 0.85rem;
                padding: 0.65rem 0.85rem;
                background: var(--pd-surface);
                border-radius: var(--pd-radius-sm);
                border: 1px solid var(--pd-border);
            }
            .pd-legend-item {
                display: flex; align-items: center; gap: 0.4rem;
                font-size: 0.72rem; color: var(--pd-muted);
                font-weight: 500;
            }
            .pd-legend-dot {
                width: 10px; height: 10px; border-radius: 50%;
                border: 1px solid;
            }
            .pd-leg-p { background: #D1FAE5; border-color: #059669; }
            .pd-leg-l { background: #FED7AA; border-color: #D97706; }
            .pd-leg-a { background: #FECDD3; border-color: #E11D48; }
            .pd-leg-n { background: #F3F1ED; border-color: #D4CFC3; }

            .pd-cal-empty {
                text-align: center; padding: 2.5rem 1rem;
                color: var(--pd-muted); font-size: 0.82rem;
            }

            .pd-cal-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 4px;
                margin-bottom: 1rem;
            }
            .pd-cal-dayhead {
                text-align: center;
                font-size: 0.68rem;
                font-weight: 600;
                color: var(--pd-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                padding: 0.5rem 0;
            }
            .pd-cal-cell {
                aspect-ratio: 1;
                background: var(--pd-surface);
                border: 1px solid var(--pd-border);
                border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                font-size: 0.82rem; font-weight: 500;
                color: var(--pd-text);
                position: relative;
                transition: all 0.15s;
                cursor: default;
            }
            .pd-cal-cell.pd-cell-empty {
                background: transparent;
                border: none;
            }
            .pd-cal-cell.pd-cell-weekend {
                background: var(--pd-surface-2);
                color: var(--pd-muted);
                opacity: 0.6;
            }
            .pd-cal-cell.pd-cell-school {
                background: #D1FAE5;
                border-color: #A7F3D0;
                color: #065F46;
                font-weight: 600;
            }
            .pd-cal-cell.pd-cell-school:hover {
                transform: scale(1.05);
                box-shadow: 0 4px 8px rgba(5,150,105,0.15);
            }
            .pd-cal-daynum { line-height: 1; }

            .pd-cal-summary {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
                padding-top: 0.85rem;
                border-top: 1px dashed var(--pd-border);
            }
            .pd-cal-stat {
                display: flex; align-items: center; gap: 0.5rem;
                padding: 0.5rem 0.65rem;
                background: var(--pd-surface);
                border-radius: 8px;
                border: 1px solid var(--pd-border);
            }
            .pd-cal-stat-icon {
                width: 28px; height: 28px; border-radius: 6px;
                background: currentColor;
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
            }
            .pd-cal-stat-icon svg { color: #fff; }
            .pd-cal-stat-val {
                font-size: 1.05rem; font-weight: 700;
                line-height: 1; letter-spacing: -0.01em;
            }
            .pd-cal-stat-lbl {
                font-size: 0.65rem; color: var(--pd-muted);
                margin-top: 0.1rem;
            }

            /* Grades */
            .pd-bimester-block { margin-bottom: 1.25rem; }
            .pd-bimester-block:last-child { margin-bottom: 0; }
            .pd-bimester-title {
                display: flex; align-items: center; gap: 0.5rem;
                font-size: 0.82rem; font-weight: 600;
                color: var(--pd-accent); margin-bottom: 0.75rem;
                padding: 0.4rem 0.75rem;
                background: linear-gradient(90deg, rgba(10,110,110,0.08), transparent);
                border-left: 3px solid var(--pd-accent);
                border-radius: 0 6px 6px 0;
            }
            .pd-bim-dot {
                width: 6px; height: 6px; border-radius: 50%;
                background: var(--pd-accent);
                box-shadow: 0 0 0 3px rgba(10,110,110,0.15);
            }
            .pd-courses-grid {
                display: flex; flex-direction: column; gap: 0.65rem;
            }
            .pd-course-card {
                background: var(--pd-surface-2);
                border: 1px solid var(--pd-border);
                border-radius: var(--pd-radius-sm);
                padding: 0.85rem 1rem;
            }
            .pd-course-header {
                display: flex; justify-content: space-between;
                align-items: center; margin-bottom: 0.65rem;
            }
            .pd-course-name {
                font-weight: 600; font-size: 0.88rem;
            }
            .pd-course-avg {
                font-size: 0.82rem; font-weight: 700;
                padding: 0.25rem 0.75rem; border-radius: 100px;
                border: 1px solid;
            }
            .pd-grades-row {
                display: flex; flex-wrap: wrap; gap: 0.4rem;
            }
            .pd-grade-block {
                display: flex; flex-direction: column; align-items: center;
                padding: 0.4rem 0.6rem; border-radius: 8px;
                border: 1px solid; min-width: 46px;
            }
            .pd-grade-label {
                font-size: 0.6rem; color: var(--pd-muted);
                text-transform: uppercase; letter-spacing: 0.04em;
                font-weight: 600;
            }
            .pd-grade-value {
                font-size: 1.1rem; font-weight: 700;
                line-height: 1.2; letter-spacing: -0.01em;
            }
            .pd-exams-row {
                display: flex; gap: 0.5rem; margin-top: 0.65rem;
                flex-wrap: wrap;
            }
            .pd-exam-chip {
                display: flex; align-items: center; gap: 0.5rem;
                font-size: 0.75rem; padding: 0.35rem 0.75rem;
                background: var(--pd-surface);
                border: 1px solid var(--pd-border);
                border-radius: 8px;
                color: var(--pd-muted);
            }
            .pd-exam-chip strong { font-size: 0.9rem; letter-spacing: -0.01em; }

            /* ESA */
            .pd-esa-grid { display: flex; flex-direction: column; gap: 0.65rem; }
            .pd-esa-card {
                background: var(--pd-surface-2);
                border: 1px solid var(--pd-border);
                border-radius: var(--pd-radius-sm);
                padding: 0.85rem 1rem;
            }
            .pd-esa-week {
                font-weight: 600; font-size: 0.82rem;
                margin-bottom: 0.6rem; color: var(--pd-accent);
                display: inline-block;
                padding: 0.2rem 0.6rem;
                background: rgba(10,110,110,0.08);
                border-radius: 100px;
            }
            .pd-esa-courses {
                display: flex; flex-wrap: wrap; gap: 0.4rem;
            }
            .pd-esa-item {
                display: flex; align-items: center; gap: 0.5rem;
                padding: 0.35rem 0.75rem; border-radius: 100px;
                border: 1px solid;
                font-size: 0.74rem;
            }
            .pd-esa-course { font-weight: 500; }
            .pd-esa-score { font-weight: 700; letter-spacing: -0.01em; }

            /* Footer */
            .pd-footer {
                text-align: center; padding: 2rem 1rem 1rem;
                font-size: 0.72rem; color: var(--pd-muted);
            }

            /* Responsive */
            @media (min-width: 640px) {
                .pd-section {
                    margin: 0 auto 1.25rem;
                    max-width: 780px;
                    padding: 1.75rem;
                }
                .pd-hero {
                    padding: 2.5rem 1.75rem 2rem;
                    max-width: 780px;
                    margin: 0 auto 1.5rem;
                }
                .pd-hero-text h1 { font-size: 1.8rem; }
                .pd-cal-summary { grid-template-columns: repeat(4, 1fr); }
                .pd-bento { gap: 0.75rem; }
            }

            @media (max-width: 480px) {
                .pd-section { margin: 0 0.65rem 1rem; padding: 1.15rem 1rem; }
                .pd-hero { padding: 1.5rem 1rem 1.5rem; }
                .pd-hero-card { padding: 1rem; gap: 0.75rem; }
                .pd-hero-text h1 { font-size: 1.25rem; }
                .pd-cal-month { min-width: 110px; font-size: 0.8rem; }
                .pd-cal-grid { gap: 3px; }
                .pd-cal-cell { font-size: 0.75rem; }
                .pd-bento { grid-template-columns: repeat(2, 1fr); }
                .pd-bento-main { grid-column: 1 / -1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Init trigger
    const _params = new URLSearchParams(window.location.search);
    if (_params.get('parent_token')) {
        const style = document.createElement('style');
        style.textContent = '.header,.section-nav,.main-content,#loading-screen,#login-screen{display:none!important;}';
        document.head.appendChild(style);

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    return { init };
})();
