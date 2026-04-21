/**
 * PARENTS.JS — Portal de Padres
 *
 * Two modes:
 * 1) ADMIN: Generate and manage parent links per student
 * 2) PARENT: View student dashboard via ?parent_token=xxx
 *
 * Dashboard design: Bento grid, glassmorphism header,
 * interactive calendar, data-rich grade cards.
 * No emojis — SVG icons only.
 */

// ════════════════════════════════════════════════════════════
//  ADMIN — Token management
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
                html += `<button onclick="navigator.clipboard.writeText('${esc(t.link)}').then(()=>{this.textContent='Listo';setTimeout(()=>this.textContent='Copiar',1500)})" style="font-size:.7rem;padding:.25rem .5rem;border:1px solid var(--border-light);border-radius:4px;background:var(--surface);cursor:pointer;font-family:var(--font-body);">Copiar</button>`;
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
        try {
            const resp = await fetch(`${API.BASE_URL}/api/admin/generate-parent-tokens`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API.getToken()}` },
                body: JSON.stringify({ admin_key: 'JOELJOTACINO2026', frontend_url: 'https://joelpasapera.github.io/SISTEMA-JC' }),
            });
            const result = await resp.json();
            if (result.success) {
                state.tokens = result.classrooms;
                showToast(`${result.total} links generados`, 'success');
                const activeTab = document.querySelector('#parents-classroom-tabs .classroom-tab.active');
                if (activeTab) selectClassroom(parseInt(activeTab.dataset.idx));
            } else { showToast(result.error || 'Error', 'error'); }
        } catch (e) { showToast(`Error: ${e.message}`, 'error'); }
        finally { dom.btnGenerate.querySelector('span').textContent = 'Generar links para padres'; dom.btnGenerate.disabled = false; }
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

    // ── SVG ICONS (Lucide-inspired, consistent stroke style) ──
    const ICONS = {
        user: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
        calendar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>`,
        clock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        book: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
        award: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
        activity: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
        school: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/></svg>`,
        trending: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
        barChart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    };

    const MONTH_NAMES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const MONTH_NAMES_FULL = {
        ENERO:0, FEBRERO:1, MARZO:2, ABRIL:3, MAYO:4, JUNIO:5,
        JULIO:6, AGOSTO:7, SEPTIEMBRE:8, OCTUBRE:9, NOVIEMBRE:10, DICIEMBRE:11
    };

    function init() {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('parent_token');
        if (!token) return;

        // Inject hide-all styles immediately
        const hideStyle = document.createElement('style');
        hideStyle.textContent = `.header,.section-nav,.main-content,#loading-screen,#login-screen{display:none!important;}`;
        document.head.appendChild(hideStyle);

        // Inject dashboard styles
        injectStyles();

        const container = document.createElement('div');
        container.id = 'pd-root';
        container.innerHTML = `<div class="pd-loader"><div class="pd-spinner"></div><p>Cargando reporte acad\u00e9mico</p></div>`;
        document.body.appendChild(container);

        loadDashboard(token, container);
    }

    async function loadDashboard(token, container) {
        try {
            const result = await API.getParentDashboard(token);
            if (!result.success) {
                container.innerHTML = `<div class="pd-error"><h2>Acceso denegado</h2><p>${result.error || 'El enlace no es v\u00e1lido o ha expirado.'}</p></div>`;
                return;
            }
            renderDashboard(result.dashboard, container);
        } catch (e) {
            container.innerHTML = `<div class="pd-error"><h2>Error de conexi\u00f3n</h2><p>${e.message}</p></div>`;
        }
    }

    // ════════════════════════════════════════════════════════
    //  RENDER DASHBOARD
    // ════════════════════════════════════════════════════════

    function renderDashboard(data, container) {
        const s = data.student;
        const att = data.attendance || {};
        const grades = data.grades || [];
        const esa = data.esa || [];

        // Extract section code for display
        let section = '';
        (s.classroom || '').split(' ').forEach(p => {
            if (p.length <= 3 && /\d/.test(p)) section = p;
        });

        let html = '';

        // ── HERO HEADER ─────────────────────────────────
        html += `<header class="pd-hero">
            <div class="pd-hero-glass">
                <div class="pd-hero-icon">${ICONS.school}</div>
                <div class="pd-hero-text">
                    <h1>${esc(s.name)}</h1>
                    <p>${esc(s.classroom)}${section ? ` &middot; Secci\u00f3n ${section}` : ''}</p>
                </div>
            </div>
            <div class="pd-hero-meta">
                <span>Reporte generado: ${new Date().toLocaleDateString('es-PE', {day:'numeric',month:'long',year:'numeric'})}</span>
            </div>
        </header>`;

        // ── ATTENDANCE SECTION ──────────────────────────
        if (att && !att.error && att.total_days > 0) {
            const pct = att.attendance_pct || 0;
            const pctColor = pct >= 90 ? '#059669' : pct >= 75 ? '#D97706' : '#E11D48';

            // Stat cards — Bento grid
            html += `<section class="pd-section">
                <div class="pd-section-header">
                    <span class="pd-section-icon">${ICONS.calendar}</span>
                    <h2>Asistencia</h2>
                </div>

                <div class="pd-bento">
                    <div class="pd-bento-main">
                        <div class="pd-pct-ring">
                            <svg viewBox="0 0 120 120" class="pd-ring-svg">
                                <circle cx="60" cy="60" r="52" fill="none" stroke="#E8E5DE" stroke-width="8"/>
                                <circle cx="60" cy="60" r="52" fill="none" stroke="${pctColor}" stroke-width="8"
                                    stroke-dasharray="${2 * Math.PI * 52}"
                                    stroke-dashoffset="${2 * Math.PI * 52 * (1 - pct / 100)}"
                                    stroke-linecap="round" transform="rotate(-90 60 60)"
                                    style="transition:stroke-dashoffset 1.2s ease;"/>
                            </svg>
                            <div class="pd-pct-value">
                                <span class="pd-pct-num" style="color:${pctColor}">${pct}%</span>
                                <span class="pd-pct-label">asistencia</span>
                            </div>
                        </div>
                    </div>

                    <div class="pd-bento-stat pd-stat-present">
                        <div class="pd-stat-icon" style="color:#059669">${ICONS.check}</div>
                        <div class="pd-stat-value">${att.present || 0}</div>
                        <div class="pd-stat-label">Presentes</div>
                    </div>

                    <div class="pd-bento-stat pd-stat-late">
                        <div class="pd-stat-icon" style="color:#D97706">${ICONS.clock}</div>
                        <div class="pd-stat-value">${att.late || 0}</div>
                        <div class="pd-stat-label">Tardanzas</div>
                    </div>

                    <div class="pd-bento-stat pd-stat-absent">
                        <div class="pd-stat-icon" style="color:#E11D48">${ICONS.x}</div>
                        <div class="pd-stat-value">${att.absent || 0}</div>
                        <div class="pd-stat-label">Faltas</div>
                    </div>

                    <div class="pd-bento-stat pd-stat-total">
                        <div class="pd-stat-icon" style="color:#6366F1">${ICONS.barChart}</div>
                        <div class="pd-stat-value">${att.total_days || 0}</div>
                        <div class="pd-stat-label">D\u00edas totales</div>
                    </div>
                </div>`;

            // Monthly calendar heatmap
            if (att.by_month && Object.keys(att.by_month).length > 0) {
                html += `<div class="pd-calendar-section">
                    <h3 class="pd-subsection-title">${ICONS.activity} Detalle mensual</h3>
                    <div class="pd-months-grid">`;

                for (const [month, md] of Object.entries(att.by_month)) {
                    const mTotal = md.present + md.late + md.absent;
                    const mPct = mTotal > 0 ? Math.round((md.present + md.late) / mTotal * 100) : 0;
                    const mColor = mPct >= 90 ? '#059669' : mPct >= 75 ? '#D97706' : '#E11D48';

                    html += `<div class="pd-month-card">
                        <div class="pd-month-name">${month.charAt(0) + month.slice(1).toLowerCase()}</div>
                        <div class="pd-month-bar-track">
                            <div class="pd-month-bar-fill" style="width:${mPct}%;background:${mColor};"></div>
                        </div>
                        <div class="pd-month-stats">
                            <span class="pd-month-stat" style="color:#059669" title="Presentes">${ICONS.check} ${md.present}</span>
                            <span class="pd-month-stat" style="color:#D97706" title="Tardanzas">${ICONS.clock} ${md.late}</span>
                            <span class="pd-month-stat" style="color:#E11D48" title="Faltas">${ICONS.x} ${md.absent}</span>
                        </div>
                        <div class="pd-month-pct" style="color:${mColor}">${mPct}%</div>
                    </div>`;
                }

                html += `</div></div>`;
            }

            html += `</section>`;
        }

        // ── GRADES SECTION ──────────────────────────────
        if (grades.length > 0) {
            html += `<section class="pd-section">
                <div class="pd-section-header">
                    <span class="pd-section-icon">${ICONS.book}</span>
                    <h2>Rendimiento Acad\u00e9mico</h2>
                </div>`;

            grades.forEach(bim => {
                html += `<div class="pd-bimester-block">
                    <h3 class="pd-bimester-title">${esc(bim.label)}</h3>
                    <div class="pd-courses-grid">`;

                bim.courses.forEach(course => {
                    // Calculate average from PC grades
                    const pcKeys = ['pc1','pc2','pc3','pc4','pc5','pc6'];
                    const pcVals = pcKeys.map(k => course.grades[k]).filter(v => v !== null && v !== undefined);
                    const avg = pcVals.length > 0 ? Math.round(pcVals.reduce((a,b) => a + b, 0) / pcVals.length) : null;
                    const avgColor = avg !== null ? (avg >= 14 ? '#059669' : avg >= 10 ? '#D97706' : '#E11D48') : '#8B8680';

                    html += `<div class="pd-course-card">
                        <div class="pd-course-header">
                            <span class="pd-course-name">${esc(course.course)}</span>
                            ${avg !== null ? `<span class="pd-course-avg" style="background:${avgColor}15;color:${avgColor};">${avg}</span>` : ''}
                        </div>
                        <div class="pd-grades-row">`;

                    // PC grades as visual blocks
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

                    // Exams
                    const exMen = course.grades.examen_mensual;
                    const exBim = course.grades.examen_bimestral;
                    if (exMen !== null || exBim !== null) {
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

        // ── ESA SECTION ─────────────────────────────────
        if (esa.length > 0) {
            html += `<section class="pd-section">
                <div class="pd-section-header">
                    <span class="pd-section-icon">${ICONS.award}</span>
                    <h2>Evaluaci\u00f3n Semanal (ESA)</h2>
                </div>
                <div class="pd-esa-grid">`;

            esa.forEach(week => {
                html += `<div class="pd-esa-card">
                    <div class="pd-esa-week">${esc(week.week)}</div>
                    <div class="pd-esa-courses">`;

                for (const [course, vals] of Object.entries(week.courses)) {
                    const b = vals.b !== null ? vals.b : '-';
                    const colorMap = { yellow: { bg: '#FEF9C3', border: '#FDE047', text: '#854D0E' },
                                       orange: { bg: '#FED7AA', border: '#FB923C', text: '#9A3412' },
                                       fuchsia: { bg: '#F5D0FE', border: '#E879F9', text: '#86198F' } };
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

        // ── FOOTER ──────────────────────────────────────
        html += `<footer class="pd-footer">
            <p>Sistema de Registro Acad\u00e9mico ${new Date().getFullYear()}</p>
        </footer>`;

        container.innerHTML = html;
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
                --pd-bg: #F7F5F0;
                --pd-card: #FFFFFF;
                --pd-border: #E5E2DC;
                --pd-text: #1A1A2E;
                --pd-muted: #8B8680;
                --pd-accent: #0A6E6E;
                --pd-radius: 14px;
                --pd-font: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                --pd-heading: 'Instrument Serif', Georgia, serif;

                min-height: 100dvh;
                background: var(--pd-bg);
                font-family: var(--pd-font);
                color: var(--pd-text);
                -webkit-font-smoothing: antialiased;
            }

            /* Loader */
            .pd-loader {
                display: flex; flex-direction: column; align-items: center;
                justify-content: center; min-height: 60vh; gap: 1rem; color: var(--pd-muted);
            }
            .pd-spinner {
                width: 36px; height: 36px; border: 3px solid var(--pd-border);
                border-top-color: var(--pd-accent); border-radius: 50%;
                animation: pd-spin 0.8s linear infinite;
            }
            @keyframes pd-spin { to { transform: rotate(360deg); } }

            .pd-error {
                text-align: center; padding: 4rem 2rem;
            }
            .pd-error h2 { font-family: var(--pd-heading); font-size: 1.5rem; color: #E11D48; margin-bottom: 0.5rem; }

            /* Hero */
            .pd-hero {
                background: linear-gradient(135deg, #0A6E6E 0%, #064E4E 60%, #1A1A2E 100%);
                border-radius: 0 0 24px 24px;
                padding: 2rem 1.5rem 1.5rem;
                margin-bottom: 1.5rem;
            }
            .pd-hero-glass {
                display: flex; align-items: center; gap: 1rem;
                background: rgba(255,255,255,0.08);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 16px;
                padding: 1.25rem 1.5rem;
            }
            .pd-hero-icon {
                width: 48px; height: 48px; border-radius: 12px;
                background: rgba(255,255,255,0.12);
                display: flex; align-items: center; justify-content: center;
                color: #fff; flex-shrink: 0;
            }
            .pd-hero-text h1 {
                font-family: var(--pd-heading); font-size: 1.45rem;
                font-weight: 400; color: #fff; margin: 0; line-height: 1.2;
            }
            .pd-hero-text p {
                color: rgba(255,255,255,0.65); font-size: 0.82rem; margin-top: 0.2rem;
            }
            .pd-hero-meta {
                text-align: right; margin-top: 0.75rem;
                font-size: 0.7rem; color: rgba(255,255,255,0.4);
            }

            /* Sections */
            .pd-section {
                background: var(--pd-card);
                border: 1px solid var(--pd-border);
                border-radius: var(--pd-radius);
                padding: 1.5rem;
                margin: 0 1rem 1.25rem;
            }
            .pd-section-header {
                display: flex; align-items: center; gap: 0.6rem;
                margin-bottom: 1.25rem;
            }
            .pd-section-icon { color: var(--pd-accent); flex-shrink: 0; }
            .pd-section-header h2 {
                font-family: var(--pd-heading); font-size: 1.15rem;
                font-weight: 400; margin: 0;
            }

            /* Bento Grid */
            .pd-bento {
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: auto auto;
                gap: 0.65rem;
            }
            .pd-bento-main {
                grid-column: 1 / -1;
                display: flex; justify-content: center; padding: 1rem 0;
            }
            .pd-bento-stat {
                background: var(--pd-bg);
                border-radius: 12px;
                padding: 0.85rem;
                text-align: center;
                border: 1px solid var(--pd-border);
            }
            .pd-stat-icon { margin-bottom: 0.35rem; }
            .pd-stat-value { font-size: 1.6rem; font-weight: 700; line-height: 1; }
            .pd-stat-label { font-size: 0.7rem; color: var(--pd-muted); margin-top: 0.2rem; }

            /* Percentage Ring */
            .pd-pct-ring { position: relative; width: 130px; height: 130px; }
            .pd-ring-svg { width: 100%; height: 100%; }
            .pd-pct-value {
                position: absolute; inset: 0;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
            }
            .pd-pct-num { font-size: 1.8rem; font-weight: 700; line-height: 1; }
            .pd-pct-label { font-size: 0.65rem; color: var(--pd-muted); text-transform: uppercase; letter-spacing: 0.05em; }

            /* Calendar / Monthly */
            .pd-calendar-section { margin-top: 1.25rem; }
            .pd-subsection-title {
                display: flex; align-items: center; gap: 0.5rem;
                font-size: 0.82rem; font-weight: 600; color: var(--pd-muted);
                margin-bottom: 0.75rem;
            }
            .pd-months-grid { display: flex; flex-direction: column; gap: 0.5rem; }
            .pd-month-card {
                display: grid; grid-template-columns: 80px 1fr auto auto;
                align-items: center; gap: 0.65rem;
                padding: 0.65rem 0.85rem;
                background: var(--pd-bg);
                border-radius: 10px;
                border: 1px solid var(--pd-border);
            }
            .pd-month-name { font-weight: 600; font-size: 0.82rem; }
            .pd-month-bar-track {
                height: 6px; background: var(--pd-border);
                border-radius: 100px; overflow: hidden;
            }
            .pd-month-bar-fill {
                height: 100%; border-radius: 100px;
                transition: width 0.8s ease;
            }
            .pd-month-stats { display: flex; gap: 0.5rem; }
            .pd-month-stat {
                display: flex; align-items: center; gap: 2px;
                font-size: 0.72rem; font-weight: 600;
            }
            .pd-month-stat svg { width: 12px; height: 12px; }
            .pd-month-pct { font-size: 0.78rem; font-weight: 700; min-width: 36px; text-align: right; }

            /* Grades */
            .pd-bimester-block { margin-bottom: 1.25rem; }
            .pd-bimester-title {
                font-size: 0.85rem; font-weight: 600;
                color: var(--pd-accent); margin-bottom: 0.65rem;
                padding-bottom: 0.35rem;
                border-bottom: 2px solid var(--pd-accent);
                display: inline-block;
            }
            .pd-courses-grid { display: flex; flex-direction: column; gap: 0.65rem; }
            .pd-course-card {
                background: var(--pd-bg);
                border: 1px solid var(--pd-border);
                border-radius: 12px;
                padding: 0.85rem 1rem;
            }
            .pd-course-header {
                display: flex; justify-content: space-between;
                align-items: center; margin-bottom: 0.65rem;
            }
            .pd-course-name { font-weight: 600; font-size: 0.88rem; }
            .pd-course-avg {
                font-size: 0.85rem; font-weight: 700;
                padding: 0.2rem 0.65rem; border-radius: 100px;
            }
            .pd-grades-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
            .pd-grade-block {
                display: flex; flex-direction: column; align-items: center;
                padding: 0.35rem 0.55rem; border-radius: 8px;
                border: 1px solid; min-width: 42px;
            }
            .pd-grade-label { font-size: 0.6rem; color: var(--pd-muted); text-transform: uppercase; letter-spacing: 0.03em; }
            .pd-grade-value { font-size: 1.05rem; font-weight: 700; line-height: 1.2; }
            .pd-exams-row { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
            .pd-exam-chip {
                display: flex; align-items: center; gap: 0.4rem;
                font-size: 0.75rem; padding: 0.3rem 0.65rem;
                background: var(--pd-card); border: 1px solid var(--pd-border);
                border-radius: 8px;
            }
            .pd-exam-chip strong { font-size: 0.88rem; }

            /* ESA */
            .pd-esa-grid { display: flex; flex-direction: column; gap: 0.65rem; }
            .pd-esa-card {
                background: var(--pd-bg);
                border: 1px solid var(--pd-border);
                border-radius: 12px;
                padding: 0.85rem 1rem;
            }
            .pd-esa-week {
                font-weight: 600; font-size: 0.82rem;
                margin-bottom: 0.5rem; color: var(--pd-accent);
            }
            .pd-esa-courses { display: flex; flex-wrap: wrap; gap: 0.35rem; }
            .pd-esa-item {
                display: flex; align-items: center; gap: 0.35rem;
                padding: 0.3rem 0.6rem; border-radius: 6px;
                border: 1px solid; font-size: 0.75rem;
            }
            .pd-esa-course { font-weight: 500; }
            .pd-esa-score { font-weight: 700; }

            /* Footer */
            .pd-footer {
                text-align: center; padding: 2rem 1rem 1.5rem;
                font-size: 0.7rem; color: var(--pd-muted);
            }

            /* Responsive */
            @media (min-width: 640px) {
                .pd-section { margin: 0 auto 1.25rem; max-width: 720px; }
                .pd-hero { max-width: 720px; margin: 0 auto 1.5rem; border-radius: 0 0 24px 24px; }
                .pd-bento { grid-template-columns: repeat(4, 1fr); }
                .pd-bento-main { grid-column: 1 / -1; }
                .pd-month-card { grid-template-columns: 90px 1fr auto auto; }
            }

            @media (max-width: 480px) {
                .pd-hero { padding: 1.25rem 1rem 1rem; }
                .pd-hero-glass { padding: 1rem; }
                .pd-hero-text h1 { font-size: 1.2rem; }
                .pd-section { margin: 0 0.5rem 1rem; padding: 1rem; }
                .pd-month-card { grid-template-columns: 1fr; gap: 0.35rem; }
                .pd-month-pct { text-align: left; }
            }
        `;
        document.head.appendChild(style);
    }

    // ── INIT TRIGGER ────────────────────────────────────
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
