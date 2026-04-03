/**
 * API.JS — Comunicacion con el backend FastAPI/Flask
 */

const API = (() => {
    'use strict';

    const BASE_URL = 'https://c48484518.pythonanywhere.com';
    const DEFAULT_TIMEOUT = 30000;

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
        if (!response.ok) {
            let msg = `Error ${response.status}`;
            try { const d = await response.json(); msg = d.detail || d.error || msg; } catch {}
            throw new Error(msg);
        }
        return await response.json();
    }

    async function checkConnection() {
        try {
            const r = await fetchWithTimeout(`${BASE_URL}/`, { method: 'GET' }, 10000);
            const d = await r.json();
            return d && d.version ? true : false;
        } catch { return false; }
    }

    async function getClassrooms() {
        const r = await fetchWithTimeout(`${BASE_URL}/api/classrooms`);
        return await handleResponse(r);
    }

    async function getClassroomStudents(classroomName) {
        const r = await fetchWithTimeout(`${BASE_URL}/api/classrooms/${encodeURIComponent(classroomName)}`);
        return await handleResponse(r);
    }

    async function getAttendanceForDate(classroomName, date) {
        const r = await fetchWithTimeout(
            `${BASE_URL}/api/attendance/${encodeURIComponent(classroomName)}/${date}`
        );
        return await handleResponse(r);
    }

    async function saveAttendance(payload) {
        const r = await fetchWithTimeout(
            `${BASE_URL}/api/attendance`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            },
            60000
        );
        return await handleResponse(r);
    }

    return { checkConnection, getClassrooms, getClassroomStudents, getAttendanceForDate, saveAttendance };
})();
