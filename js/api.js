/**
 * API.JS — Comunicación con el backend
 * Incluye autenticación en todas las peticiones.
 */

const API = (() => {
    'use strict';

    const BASE_URL = 'https://c48484518.pythonanywhere.com';
    const DEFAULT_TIMEOUT = 30000;

    // ─── TOKEN DE SESIÓN ──────────────────────────────────
    function getToken() {
        return sessionStorage.getItem('auth_token') || '';
    }

    function setToken(token) {
        sessionStorage.setItem('auth_token', token);
    }

    function clearToken() {
        sessionStorage.removeItem('auth_token');
    }

    function getAuthHeaders() {
        const token = getToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    // ─── UTILIDADES HTTP ──────────────────────────────────
    async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') throw new Error('Tiempo de espera agotado');
            throw error;
        }
    }

    async function handleResponse(response) {
        const data = await response.json();

        // Si el servidor dice que no está autorizado, redirigir al login
        if (response.status === 401) {
            const code = data.code || '';
            if (code === 'AUTH_REQUIRED' || code === 'SESSION_EXPIRED') {
                clearToken();
                if (typeof Auth !== 'undefined' && Auth.showLogin) {
                    Auth.showLogin(data.error || 'Sesión expirada');
                }
            }
            throw new Error(data.error || 'No autorizado');
        }

        if (!response.ok) {
            throw new Error(data.detail || data.error || `Error ${response.status}`);
        }
        return data;
    }

    // ─── AUTENTICACIÓN ────────────────────────────────────
    async function login(username, password) {
        const r = await fetchWithTimeout(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await r.json();
        if (data.success && data.token) {
            setToken(data.token);
        }
        return data;
    }

    async function logout() {
        try {
            await fetchWithTimeout(`${BASE_URL}/api/auth/logout`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
        } catch {}
        clearToken();
    }

    async function verifySession() {
        const token = getToken();
        if (!token) return false;
        try {
            const r = await fetchWithTimeout(`${BASE_URL}/api/auth/verify`, {
                headers: getAuthHeaders(),
            }, 10000);
            const data = await r.json();
            return data.valid === true;
        } catch {
            return false;
        }
    }

    // ─── CONEXIÓN ─────────────────────────────────────────
    async function checkConnection() {
        try {
            const r = await fetchWithTimeout(`${BASE_URL}/`, { method: 'GET' }, 10000);
            const d = await r.json();
            return d && d.version ? true : false;
        } catch { return false; }
    }

    // ─── ASISTENCIA ───────────────────────────────────────
    async function getClassrooms() {
        const r = await fetchWithTimeout(`${BASE_URL}/api/classrooms`, { headers: getAuthHeaders() });
        return await handleResponse(r);
    }

    async function getClassroomStudents(classroomName) {
        const r = await fetchWithTimeout(
            `${BASE_URL}/api/classrooms/${encodeURIComponent(classroomName)}`,
            { headers: getAuthHeaders() }
        );
        return await handleResponse(r);
    }

    async function getAttendanceForDate(classroomName, date) {
        const r = await fetchWithTimeout(
            `${BASE_URL}/api/attendance/${encodeURIComponent(classroomName)}/${date}`,
            { headers: getAuthHeaders() }
        );
        return await handleResponse(r);
    }

    async function saveAttendance(payload) {
        const r = await fetchWithTimeout(`${BASE_URL}/api/attendance`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        }, 60000);
        return await handleResponse(r);
    }

    // ─── NOTAS ────────────────────────────────────────────
    async function getGradeBooks() {
        const r = await fetchWithTimeout(`${BASE_URL}/api/grades/books`, { headers: getAuthHeaders() });
        return await handleResponse(r);
    }

    async function getGrades(fileId, sheetName) {
        const r = await fetchWithTimeout(
            `${BASE_URL}/api/grades/${encodeURIComponent(fileId)}/${encodeURIComponent(sheetName)}`,
            { headers: getAuthHeaders() }
        );
        return await handleResponse(r);
    }

    async function saveGrades(fileId, sheetName, updates) {
        const r = await fetchWithTimeout(
            `${BASE_URL}/api/grades/${encodeURIComponent(fileId)}/${encodeURIComponent(sheetName)}`,
            { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ updates }) },
            60000
        );
        return await handleResponse(r);
    }

    // ─── ESA ──────────────────────────────────────────────
    async function getESABooks() {
        const r = await fetchWithTimeout(`${BASE_URL}/api/esa/books`, { headers: getAuthHeaders() });
        return await handleResponse(r);
    }

    async function getESAData(fileId, sheetName) {
        const r = await fetchWithTimeout(
            `${BASE_URL}/api/esa/${encodeURIComponent(fileId)}/${encodeURIComponent(sheetName)}`,
            { headers: getAuthHeaders() }
        );
        return await handleResponse(r);
    }

    async function generateESA(fileId, sheetName) {
        const r = await fetchWithTimeout(
            `${BASE_URL}/api/esa/${encodeURIComponent(fileId)}/${encodeURIComponent(sheetName)}/generate`,
            { method: 'POST', headers: getAuthHeaders() },
            60000
        );
        return await handleResponse(r);
    }

    // ─── PADRES ────────────────────────────────────────────
    async function getParentDashboard(parentToken) {
        const r = await fetchWithTimeout(
            `${BASE_URL}/api/parent/token/${parentToken}`,
            {}, 30000
        );
        return await handleResponse(r);
    }

    // ─── CACHE ─────────────────────────────────────────────
    async function refreshCache() {
        const r = await fetchWithTimeout(`${BASE_URL}/api/cache/refresh`, {
            method: 'POST',
            headers: getAuthHeaders(),
        }, 15000);
        return await handleResponse(r);
    }

    return {
        BASE_URL,
        login, logout, verifySession, getToken, clearToken,
        checkConnection, getClassrooms, getClassroomStudents,
        getAttendanceForDate, saveAttendance,
        getGradeBooks, getGrades, saveGrades,
        getESABooks, getESAData, generateESA,
        getParentDashboard, refreshCache
    };
})();
