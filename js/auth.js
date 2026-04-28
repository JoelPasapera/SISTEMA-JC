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
            @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap');

            #login-screen {
                position: fixed; inset: 0; z-index: 99999;
                background: #FAF6EC;
                display: flex; align-items: center; justify-content: center;
                font-family: 'IBM Plex Sans', sans-serif;
                padding: 2rem 1rem;
                overflow-y: auto;
            }
            #login-screen::before {
                content: '';
                position: fixed; inset: 0;
                pointer-events: none;
                opacity: 0.35;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.35 0 0 0 0 0.25 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
            }
            .login-stage {
                position: relative;
                width: 100%; max-width: 400px;
            }
            .login-corner {
                position: absolute;
                width: 30px; height: 30px;
                border: 1px solid #1A1814;
                opacity: 0.4;
            }
            .login-corner.tl { top: -8px; left: -8px; border-right: 0; border-bottom: 0; }
            .login-corner.tr { top: -8px; right: -8px; border-left: 0; border-bottom: 0; }
            .login-corner.bl { bottom: -8px; left: -8px; border-right: 0; border-top: 0; }
            .login-corner.br { bottom: -8px; right: -8px; border-left: 0; border-top: 0; }

            .login-card {
                background: #FAF6EC;
                border: 1px solid #C7BFA9;
                padding: 3rem 2.25rem 2.25rem;
                position: relative;
            }

            .login-mark {
                position: absolute;
                top: 1rem; left: 50%; transform: translateX(-50%);
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.62rem;
                color: #9A9285;
                letter-spacing: 0.12em;
                text-transform: uppercase;
            }

            .login-eyebrow {
                font-family: 'Fraunces', Georgia, serif;
                font-style: italic;
                font-size: 0.8rem;
                color: #8B2E2E;
                text-align: center;
                margin-bottom: 0.4rem;
                font-weight: 400;
                letter-spacing: 0.02em;
            }
            .login-title {
                font-family: 'Fraunces', Georgia, serif;
                font-size: 2.1rem;
                text-align: center;
                color: #1A1814;
                margin: 0 0 0.4rem;
                font-weight: 400;
                line-height: 1;
                letter-spacing: -0.02em;
            }
            .login-title em {
                font-style: italic;
                font-weight: 400;
            }
            .login-sub {
                text-align: center;
                font-size: 0.78rem;
                color: #6B6258;
                margin: 0 0 2rem;
                font-style: italic;
                font-family: 'Fraunces', Georgia, serif;
            }
            .login-divider {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin: 0 0 1.75rem;
            }
            .login-divider::before,
            .login-divider::after {
                content: '';
                flex: 1;
                height: 1px;
                background: #C7BFA9;
            }
            .login-divider-text {
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.6rem;
                color: #9A9285;
                letter-spacing: 0.15em;
                text-transform: uppercase;
            }
            .login-field {
                margin-bottom: 1rem;
            }
            .login-label {
                display: block;
                font-size: 0.7rem;
                font-weight: 500;
                color: #6B6258;
                margin-bottom: 0.4rem;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                font-family: 'IBM Plex Sans', sans-serif;
            }
            .login-input {
                width: 100%;
                padding: 0.7rem 0.85rem;
                border: 1px solid #C7BFA9;
                background: #FFFFFF;
                font-family: 'IBM Plex Sans', sans-serif;
                font-size: 0.88rem;
                color: #1A1814;
                outline: none;
                transition: all 0.2s ease;
                box-sizing: border-box;
                border-radius: 2px;
            }
            .login-input:focus {
                border-color: #1A1814;
                box-shadow: 0 0 0 3px #EDE6D3;
            }
            .login-btn {
                width: 100%;
                padding: 0.85rem;
                background: #1A1814;
                color: #FAF6EC;
                border: 1px solid #1A1814;
                font-family: 'IBM Plex Sans', sans-serif;
                font-size: 0.82rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                margin-top: 0.75rem;
                border-radius: 2px;
                letter-spacing: 0.04em;
                position: relative;
                overflow: hidden;
            }
            .login-btn:hover:not(:disabled) {
                background: #8B2E2E;
                border-color: #8B2E2E;
            }
            .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            .login-message {
                display: none;
                text-align: center;
                font-size: 0.78rem;
                color: #8B2E2E;
                margin-bottom: 1rem;
                padding: 0.6rem 0.75rem;
                background: #F4E0DC;
                border-left: 2px solid #8B2E2E;
                font-family: 'IBM Plex Sans', sans-serif;
            }
            .login-footer {
                text-align: center;
                margin-top: 1.5rem;
                font-size: 0.68rem;
                color: #9A9285;
                font-family: 'JetBrains Mono', monospace;
                letter-spacing: 0.08em;
                text-transform: uppercase;
            }
            .login-stamp {
                position: absolute;
                bottom: -25px;
                right: -10px;
                width: 80px;
                font-family: 'Fraunces', serif;
                font-style: italic;
                font-size: 0.65rem;
                color: #8B2E2E;
                opacity: 0.55;
                transform: rotate(-12deg);
                text-align: center;
                line-height: 1.2;
                pointer-events: none;
            }
            .login-stamp .stamp-border {
                border: 1px solid #8B2E2E;
                border-radius: 50%;
                padding: 0.5rem 0.3rem;
            }
        </style>
        <div class="login-stage">
            <div class="login-corner tl"></div>
            <div class="login-corner tr"></div>
            <div class="login-corner bl"></div>
            <div class="login-corner br"></div>

            <div class="login-card">
                <div class="login-mark">N° 001 — Acceso Privado</div>

                <p class="login-eyebrow">Año académico 2026</p>
                <h1 class="login-title">Sistema <em>JC</em></h1>
                <p class="login-sub">Registro académico — sólo personal autorizado</p>

                <div class="login-divider">
                    <span class="login-divider-text">Iniciar Sesión</span>
                </div>

                <div class="login-message" id="login-error"></div>
                <div class="login-field">
                    <label class="login-label" for="login-user">Usuario</label>
                    <input class="login-input" type="text" id="login-user" autocomplete="username" placeholder="admin">
                </div>
                <div class="login-field">
                    <label class="login-label" for="login-pass">Contraseña</label>
                    <input class="login-input" type="password" id="login-pass" autocomplete="current-password" placeholder="••••••••">
                </div>
                <button class="login-btn" id="login-btn">Ingresar al sistema</button>
                <p class="login-footer">Confidencial · MMXXVI</p>
            </div>

            <div class="login-stamp">
                <div class="stamp-border">
                    Acceso<br>Restringido
                </div>
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
        btn.textContent = 'Verificando...';
        errorEl.style.display = 'none';

        try {
            const result = await API.login(username, password);

            if (result.success) {
                hideLogin();
                // Recargar la página para inicializar todo con sesión
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
            btn.textContent = 'Iniciar Sesión';
        }
    }

    // Iniciar al cargar el DOM
    document.addEventListener('DOMContentLoaded', init);

    return { init, showLogin, hideLogin, checkSession };
})();
