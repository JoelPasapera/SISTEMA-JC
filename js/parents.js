/**
 * PARENTS.JS — Portal de Padres
 *
 * Two modes:
 * 1) ADMIN: Generate and manage parent links per student
 * 2) PARENT: View student dashboard via ?parent_token=xxx
 */

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
                html += `<a href="${esc(t.link)}" target="_blank" style="font-size:.7rem;color:var(--teal);text-decoration:none;padding:.25rem .5rem;border:1px solid var(--teal);border-radius:4px;">Ver link ↗</a>`;
                html += `<button onclick="navigator.clipboard.writeText('${esc(t.link)}').then(()=>{this.textContent='✓';setTimeout(()=>this.textContent='Copiar',1500)})" style="font-size:.7rem;padding:.25rem .5rem;border:1px solid var(--border-light);border-radius:4px;background:var(--surface);cursor:pointer;font-family:var(--font-body);">Copiar</button>`;
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
                body: JSON.stringify({
                    admin_key: 'JOELJOTACINO2026',
                    frontend_url: 'https://joelpasapera.github.io/SISTEMA-JC'
                }),
            });
            const result = await resp.json();

            if (result.success) {
                state.tokens = result.classrooms;
                showToast(`${result.total} links generados`, 'success');
                // Re-render current classroom
                const activeTab = document.querySelector('#parents-classroom-tabs .classroom-tab.active');
                if (activeTab) selectClassroom(parseInt(activeTab.dataset.idx));
            } else {
                showToast(result.error || 'Error', 'error');
            }
        } catch (e) {
            showToast(`Error: ${e.message}`, 'error');
        } finally {
            dom.btnGenerate.querySelector('span').textContent = 'Generar links para padres';
            dom.btnGenerate.disabled = false;
        }
    }

    function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function showToast(msg, type) {
        const c = document.getElementById('toast-container');
        if (c) { const t = document.createElement('div'); t.className = `toast toast-${type}`; t.innerHTML = `<span>${esc(msg)}</span>`; c.appendChild(t); setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 5000); }
    }

    // Auto-init
    let initialized = false;
    const observer = new MutationObserver(() => {
        const s = document.getElementById('section-parents');
        if (s && s.classList.contains('active') && !initialized) { initialized = true; init(); }
    });
    document.addEventListener('DOMContentLoaded', () => {
        const s = document.getElementById('section-parents');
        if (s) observer.observe(s, { attributes: true, attributeFilter: ['class'] });
    });

    return { init, state };
})();


// ════════════════════════════════════════════════════════════
//  PARENT DASHBOARD (when ?parent_token=xxx)
// ════════════════════════════════════════════════════════════

const ParentDashboard = (() => {
    'use strict';

    function init() {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('parent_token');
        if (!token) return;

        // Hide absolutely everything: header, nav, all sections, loading, login
        const hideSelectors = [
            '.header', '.section-nav', '.main-content',
            '#loading-screen', '#login-screen',
            '#section-attendance', '#section-grades',
            '#section-esa', '#section-parents'
        ];
        hideSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (el) el.style.display = 'none';
            });
        });

        // Also hide body's direct children that aren't ours
        document.body.style.background = '#fafaf7';

        const container = document.createElement('div');
        container.id = 'parent-dashboard';
        container.style.cssText = 'max-width:900px;margin:0 auto;padding:1.5rem;font-family:"DM Sans",-apple-system,sans-serif;';
        container.innerHTML = '<div style="text-align:center;padding:3rem;color:#6b6b8d;"><p>Cargando datos del estudiante...</p></div>';
        document.body.appendChild(container);

        loadDashboard(token, container);
    }

    async function loadDashboard(token, container) {
        try {
            const result = await API.getParentDashboard(token);
            if (!result.success) {
                container.innerHTML = `<div style="text-align:center;padding:3rem;"><h2 style="color:#c0392b;">Acceso denegado</h2><p>${result.error || 'Token inválido'}</p></div>`;
                return;
            }
            renderDashboard(result.dashboard, container);
        } catch (e) {
            container.innerHTML = `<div style="text-align:center;padding:3rem;"><h2 style="color:#c0392b;">Error</h2><p>${e.message}</p></div>`;
        }
    }

    function renderDashboard(data, container) {
        const s = data.student;
        const att = data.attendance || {};

        let html = '';

        // ─── Header ─────────────────────────────────────
        html += `<div style="background:linear-gradient(135deg,#0d7377,#095456);color:#fff;border-radius:16px;padding:1.75rem;margin-bottom:1.5rem;">`;
        html += `<h1 style="font-family:'Instrument Serif',Georgia,serif;font-size:1.6rem;font-weight:400;margin-bottom:.25rem;">${esc(s.name)}</h1>`;
        html += `<p style="opacity:.8;font-size:.85rem;">${esc(s.classroom)}</p>`;
        html += `</div>`;

        // ─── Attendance summary ─────────────────────────
        if (att && !att.error) {
            html += `<div style="background:#fff;border-radius:12px;padding:1.25rem;border:1px solid #e5e2dc;margin-bottom:1.25rem;">`;
            html += `<h2 style="font-size:1rem;font-weight:600;margin-bottom:1rem;">📋 Asistencia</h2>`;

            html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1rem;">`;
            html += statCard('Total días', att.total_days || 0, '#0d7377');
            html += statCard('Asistencia', att.present || 0, '#16a34a');
            html += statCard('Tardanzas', att.late || 0, '#d97706');
            html += statCard('Faltas', att.absent || 0, '#dc2626');
            html += `</div>`;

            // Attendance percentage bar
            const pct = att.attendance_pct || 0;
            const barColor = pct >= 90 ? '#16a34a' : pct >= 75 ? '#d97706' : '#dc2626';
            html += `<div style="background:#f3f1ed;border-radius:100px;height:10px;overflow:hidden;">`;
            html += `<div style="width:${pct}%;height:100%;background:${barColor};border-radius:100px;transition:width .5s;"></div>`;
            html += `</div>`;
            html += `<p style="text-align:center;font-size:.78rem;color:#6b6b8d;margin-top:.35rem;">${pct}% de asistencia</p>`;

            // By month
            if (att.by_month && Object.keys(att.by_month).length > 0) {
                html += `<div style="margin-top:1rem;font-size:.78rem;">`;
                for (const [month, md] of Object.entries(att.by_month)) {
                    html += `<div style="display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid #f3f1ed;">`;
                    html += `<span style="font-weight:500;">${month}</span>`;
                    html += `<span>✅${md.present} ⏰${md.late} ❌${md.absent}</span>`;
                    html += `</div>`;
                }
                html += `</div>`;
            }

            html += `</div>`;
        }

        // ─── Grades ─────────────────────────────────────
        if (data.grades && data.grades.length > 0) {
            html += `<div style="background:#fff;border-radius:12px;padding:1.25rem;border:1px solid #e5e2dc;margin-bottom:1.25rem;">`;
            html += `<h2 style="font-size:1rem;font-weight:600;margin-bottom:1rem;">📝 Notas</h2>`;

            data.grades.forEach(bim => {
                html += `<h3 style="font-size:.88rem;font-weight:600;color:#0d7377;margin-bottom:.65rem;margin-top:1rem;">${esc(bim.label)}</h3>`;

                bim.courses.forEach(course => {
                    html += `<div style="margin-bottom:.75rem;padding:.65rem;background:#fafaf7;border-radius:8px;border:1px solid #e5e2dc;">`;
                    html += `<p style="font-weight:600;font-size:.82rem;margin-bottom:.5rem;">${esc(course.course)}</p>`;

                    // Show key grades in a compact grid
                    const keyGrades = ['pc1','pc2','pc3','pc4','pc5','pc6','examen_mensual','examen_bimestral'];
                    const labels = { pc1:'PC1',pc2:'PC2',pc3:'PC3',pc4:'PC4',pc5:'PC5',pc6:'PC6',examen_mensual:'Ex.Mensual',examen_bimestral:'Ex.Bimestral' };

                    html += `<div style="display:flex;flex-wrap:wrap;gap:.35rem;">`;
                    keyGrades.forEach(key => {
                        const val = course.grades[key];
                        if (val !== null && val !== undefined) {
                            const color = val >= 14 ? '#16a34a' : val >= 10 ? '#d97706' : '#dc2626';
                            html += `<span style="padding:.2rem .5rem;border-radius:4px;font-size:.72rem;background:${color}15;color:${color};font-weight:600;">${labels[key] || key}: ${val}</span>`;
                        }
                    });
                    html += `</div></div>`;
                });
            });

            html += `</div>`;
        }

        // ─── ESA ────────────────────────────────────────
        if (data.esa && data.esa.length > 0) {
            html += `<div style="background:#fff;border-radius:12px;padding:1.25rem;border:1px solid #e5e2dc;">`;
            html += `<h2 style="font-size:1rem;font-weight:600;margin-bottom:1rem;">✍🏼 ESA</h2>`;

            data.esa.forEach(week => {
                html += `<div style="margin-bottom:.75rem;">`;
                html += `<p style="font-weight:600;font-size:.82rem;margin-bottom:.35rem;">${esc(week.week)}</p>`;
                html += `<div style="display:flex;flex-wrap:wrap;gap:.35rem;">`;

                for (const [course, vals] of Object.entries(week.courses)) {
                    const b = vals.b !== null ? vals.b : '-';
                    const m = vals.m !== null ? vals.m : '-';
                    const bgColors = { yellow: '#FFFF00', orange: '#FF9900', fuchsia: '#FF00FF' };
                    const bg = bgColors[vals.color] || '#f3f1ed';
                    const fg = vals.color === 'yellow' ? '#333' : vals.color ? '#fff' : '#333';
                    html += `<span style="padding:.25rem .55rem;border-radius:4px;font-size:.72rem;background:${bg};color:${fg};font-weight:600;">${course}: B${b} M${m}</span>`;
                }

                html += `</div></div>`;
            });

            html += `</div>`;
        }

        // ─── Footer ─────────────────────────────────────
        html += `<p style="text-align:center;font-size:.7rem;color:#a5a2a0;margin-top:2rem;">Sistema de Registro Académico — ${new Date().getFullYear()}</p>`;

        container.innerHTML = html;
    }

    function statCard(label, value, color) {
        return `<div style="text-align:center;padding:.65rem;background:${color}10;border-radius:8px;">
            <div style="font-size:1.4rem;font-weight:700;color:${color};">${value}</div>
            <div style="font-size:.7rem;color:#6b6b8d;">${label}</div>
        </div>`;
    }

    function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // Run as early as possible to avoid flash of login/main content
    const _params = new URLSearchParams(window.location.search);
    if (_params.get('parent_token')) {
        // Immediate hide attempt (before DOM ready)
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
