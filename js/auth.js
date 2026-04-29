/**
 * AUTH.JS — Sistema de autenticación del frontend
 * Muestra pantalla de login, gestiona sesión.
 * Debe cargarse ANTES de app.js, grades.js, esa.js
 */

const Auth = (() => {
    'use strict';

    function init() {
        const params = new URLSearchParams(window.location.search);

        // Professor token: inject hide-all CSS immediately to prevent flash
        if (params.get('token')) {
            const style = document.createElement('style');
            style.id = 'professor-token-style';
            style.textContent = `
                .header, .section-nav, #loading-screen, #login-screen,
                #section-attendance, #section-esa, #section-parents {
                    display: none !important;
                }
                #section-grades {
                    display: block !important;
                }
            `;
            document.head.appendChild(style);
            hideLogin();
            return;
        }

        // Parent token: skip login entirely (CSS injected by parents.js)
        if (params.get('parent_token')) {
            hideLogin();
            return;
        }

        // Normal flow: verify session
        checkSession();
    }

    async function checkSession() {
        const hasToken = API.getToken();
        if (!hasToken) {
            showLogin();
            return;
        }

        const valid = await API.verifySession();
        if (valid) {
            hideLogin();
        } else {
            API.clearToken();
            showLogin('Tu sesión expiró. Inicia sesión de nuevo.');
        }
    }

    function showLogin(message) {
        // Ocultar todo el contenido
        const header = document.querySelector('.header');
        const nav = document.querySelector('.section-nav');
        const main = document.querySelector('.main-content');
        const loading = document.getElementById('loading-screen');

        if (header) header.style.display = 'none';
        if (nav) nav.style.display = 'none';
        if (main) main.style.display = 'none';
        if (loading) loading.classList.add('hidden');

        // Mostrar pantalla de login
        let loginScreen = document.getElementById('login-screen');
        if (!loginScreen) {
            loginScreen = createLoginScreen();
            document.body.appendChild(loginScreen);
        }

        loginScreen.style.display = 'flex';

        if (message) {
            const msgEl = loginScreen.querySelector('.login-message');
            if (msgEl) {
                msgEl.textContent = message;
                msgEl.style.display = 'block';
            }
        }
    }

    function hideLogin() {
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.style.display = 'none';

        // If professor or parent token is in URL, DON'T show header/nav
        // — the token-specific CSS handles visibility.
        const params = new URLSearchParams(window.location.search);
        if (params.get('token') || params.get('parent_token')) {
            // Only show main-content so the section JS can render into it
            const main = document.querySelector('.main-content');
            if (main) main.style.display = '';
            return;
        }

        // Normal admin login — show everything
        const header = document.querySelector('.header');
        const nav = document.querySelector('.section-nav');
        const main = document.querySelector('.main-content');

        if (header) header.style.display = '';
        if (nav) nav.style.display = '';
        if (main) main.style.display = '';
    }

    function createLoginScreen() {
        const div = document.createElement('div');
        div.id = 'login-screen';
        div.innerHTML = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@500&display=swap');

            #login-screen {
                position: fixed; inset: 0; z-index: 99999;
                background: #F2F4F8;
                display: flex; align-items: center; justify-content: center;
                font-family: 'Plus Jakarta Sans', sans-serif;
                padding: 2rem 1rem;
                overflow: hidden;
            }

            #login-screen::before,
            #login-screen::after {
                content: '';
                position: absolute;
                width: 600px; height: 600px;
                border-radius: 50%;
                filter: blur(100px);
                pointer-events: none;
            }
            #login-screen::before {
                top: -200px; left: -150px;
                background: radial-gradient(circle, #818CF8 0%, transparent 70%);
                opacity: 0.5;
                animation: orb-float-1 14s ease-in-out infinite alternate;
            }
            #login-screen::after {
                bottom: -200px; right: -180px;
                background: radial-gradient(circle, #F472B6 0%, transparent 70%);
                opacity: 0.45;
                animation: orb-float-2 18s ease-in-out infinite alternate;
            }
            @keyframes orb-float-1 {
                0% { transform: translate(0, 0) scale(1); }
                100% { transform: translate(80px, 60px) scale(1.15); }
            }
            @keyframes orb-float-2 {
                0% { transform: translate(0, 0) scale(1); }
                100% { transform: translate(-60px, -80px) scale(1.1); }
            }

            .login-card {
                position: relative;
                width: 100%; max-width: 420px;
                background: rgba(255, 255, 255, 0.65);
                backdrop-filter: blur(40px) saturate(180%);
                -webkit-backdrop-filter: blur(40px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.8);
                border-radius: 26px;
                padding: 2.5rem 2rem 2rem;
                box-shadow: 0 30px 80px rgba(15, 23, 42, 0.12),
                            0 8px 24px rgba(15, 23, 42, 0.06),
                            inset 0 1px 0 rgba(255, 255, 255, 0.9);
                animation: card-entrance 0.7s cubic-bezier(0.16, 1, 0.3, 1);
            }

            @keyframes card-entrance {
                from { opacity: 0; transform: translateY(30px) scale(0.96); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            .login-glow {
                position: absolute;
                top: -50%; left: 10%; right: 10%;
                height: 120%;
                background: radial-gradient(ellipse at top, rgba(129, 140, 248, 0.3), transparent 60%);
                pointer-events: none;
                z-index: 0;
            }

            .login-content {
                position: relative;
                z-index: 1;
            }

            .login-icon-wrap {
                width: 64px; height: 64px;
                margin: 0 auto 1.5rem;
                background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
                border-radius: 18px;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 12px 30px rgba(79, 70, 229, 0.3),
                            inset 0 1px 0 rgba(255, 255, 255, 0.25);
                position: relative;
            }
            .login-icon-wrap::before {
                content: '';
                position: absolute; inset: -2px;
                background: linear-gradient(135deg, rgba(129, 140, 248, 0.5), transparent);
                border-radius: 20px;
                z-index: -1;
                filter: blur(8px);
            }

            .login-eyebrow {
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.68rem;
                color: #4F46E5;
                text-align: center;
                font-weight: 600;
                letter-spacing: 0.18em;
                text-transform: uppercase;
                margin-bottom: 0.65rem;
            }

            .login-title {
                font-family: 'Instrument Serif', Georgia, serif;
                font-size: 2.4rem;
                text-align: center;
                color: #0F172A;
                margin: 0 0 0.4rem;
                font-weight: 400;
                line-height: 1;
                letter-spacing: -0.02em;
            }
            .login-title em {
                font-style: italic;
                background: linear-gradient(135deg, #4F46E5, #7C3AED);
                -webkit-background-clip: text;
                background-clip: text;
                color: transparent;
            }

            .login-sub {
                text-align: center;
                font-size: 0.84rem;
                color: #64748B;
                margin: 0 0 2rem;
                font-weight: 400;
            }

            .login-field {
                margin-bottom: 0.85rem;
            }
            .login-label {
                display: block;
                font-size: 0.72rem;
                font-weight: 600;
                color: #1E293B;
                margin-bottom: 0.4rem;
                letter-spacing: 0.02em;
            }
            .login-input {
                width: 100%;
                padding: 0.8rem 1rem;
                border: 1px solid rgba(15, 23, 42, 0.1);
                background: rgba(255, 255, 255, 0.7);
                font-family: 'Plus Jakarta Sans', sans-serif;
                font-size: 0.9rem;
                font-weight: 500;
                color: #0F172A;
                outline: none;
                transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                box-sizing: border-box;
                border-radius: 12px;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            .login-input::placeholder {
                color: #94A3B8;
                font-weight: 400;
            }
            .login-input:focus {
                border-color: #4F46E5;
                background: rgba(255, 255, 255, 0.95);
                box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.15);
            }

            .login-btn {
                width: 100%;
                padding: 0.95rem;
                background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
                color: #fff;
                border: none;
                font-family: 'Plus Jakarta Sans', sans-serif;
                font-size: 0.9rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                margin-top: 1rem;
                border-radius: 12px;
                letter-spacing: 0.01em;
                position: relative;
                overflow: hidden;
                box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18),
                            inset 0 1px 0 rgba(255, 255, 255, 0.1);
            }
            .login-btn::before {
                content: '';
                position: absolute; inset: 0;
                background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .login-btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 14px 36px rgba(79, 70, 229, 0.35),
                            inset 0 1px 0 rgba(255, 255, 255, 0.2);
            }
            .login-btn:hover:not(:disabled)::before { opacity: 1; }
            .login-btn span {
                position: relative; z-index: 1;
                display: inline-flex; align-items: center; gap: 0.45rem;
                justify-content: center; width: 100%;
            }
            .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }

            .login-message {
                display: none;
                text-align: center;
                font-size: 0.8rem;
                color: #BE123C;
                margin-bottom: 1rem;
                padding: 0.7rem 0.9rem;
                background: rgba(254, 226, 226, 0.7);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(244, 63, 94, 0.15);
                border-radius: 10px;
                font-weight: 500;
            }

            .login-footer {
                text-align: center;
                margin-top: 1.5rem;
                padding-top: 1.25rem;
                border-top: 1px solid rgba(15, 23, 42, 0.06);
                font-size: 0.72rem;
                color: #94A3B8;
                font-weight: 500;
            }
        </style>

        <div class="login-card">
            <div class="login-glow"></div>
            <div class="login-content">
                <div class="login-icon-wrap">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                        <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/>
                    </svg>
                </div>

                <p class="login-eyebrow">Acceso Privado</p>
                <h1 class="login-title">Sistema <em>JC</em></h1>
                <p class="login-sub">Plataforma académica · Año 2026</p>

                <div class="login-message" id="login-error"></div>

                <div class="login-field">
                    <label class="login-label" for="login-user">Usuario</label>
                    <input class="login-input" type="text" id="login-user" autocomplete="username" placeholder="admin">
                </div>
                <div class="login-field">
                    <label class="login-label" for="login-pass">Contraseña</label>
                    <input class="login-input" type="password" id="login-pass" autocomplete="current-password" placeholder="••••••••">
                </div>

                <button class="login-btn" id="login-btn">
                    <span>
                        Acceder al sistema
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </span>
                </button>

                <p class="login-footer">Acceso restringido a personal autorizado</p>
            </div>
        </div>
        `;

        // Bind events
        const btn = div.querySelector('#login-btn');
        const userInput = div.querySelector('#login-user');
        const passInput = div.querySelector('#login-pass');
        const errorEl = div.querySelector('#login-error');

        btn.addEventListener('click', () => doLogin(userInput, passInput, btn, errorEl));

        passInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doLogin(userInput, passInput, btn, errorEl);
        });

        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') passInput.focus();
        });

        return div;
    }

    async function doLogin(userInput, passInput, btn, errorEl) {
        const username = userInput.value.trim();
        const password = passInput.value;

        if (!username || !password) {
            errorEl.textContent = 'Completa ambos campos';
            errorEl.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span>Verificando...</span>';
        errorEl.style.display = 'none';

        try {
            const result = await API.login(username, password);

            if (result.success) {
                hideLogin();
                window.location.reload();
            } else {
                errorEl.textContent = result.error || 'Credenciales incorrectas';
                errorEl.style.display = 'block';
                passInput.value = '';
                passInput.focus();
            }
        } catch (error) {
            errorEl.textContent = `Error de conexión: ${error.message}`;
            errorEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Acceder al sistema <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>';
        }
    }

    // Iniciar al cargar el DOM
    document.addEventListener('DOMContentLoaded', init);

    return { init, showLogin, hideLogin, checkSession };
})();
