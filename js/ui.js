'use strict';

const UI = (() => {

    // ─── Toast ─────────────────────────────────
    let _toastTimer = null;
    function showToast(msg, type = 'info') {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.className = `toast show toast-${type}`;
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
    }

    // ─── Sync Status ───────────────────────────
    function setSyncStatus(status) {
        const el = document.getElementById('sync-status');
        if (!el) return;
        const s = {
            offline: ['sync-offline', '🟡', 'Sin Gist'],
            syncing: ['sync-syncing', '🔄', 'Sincronizando'],
            synced: ['sync-synced', '🟢', 'Sincronizado'],
            error: ['sync-error', '🔴', 'Error Gist'],
        }[status] || ['sync-offline', '🟡', 'Sin Gist'];
        el.className = `sync-status ${s[0]}`;
        el.innerHTML = `<span class="sync-icon">${s[1]}</span><span class="sync-text">${s[2]}</span>`;
    }

    function showPreSyncLoader() { document.documentElement.classList.add('is-sync-loading'); }
    function hidePreSyncLoader() {
        const el = document.getElementById('pre-sync-loader');
        if (!el) return;
        el.style.transition = 'opacity .4s ease';
        el.style.opacity = '0';
        setTimeout(() => {
            document.documentElement.classList.remove('is-sync-loading');
            el.style.opacity = '';
            el.style.transition = '';
        }, 420);
    }

    // ─── Helpers ───────────────────────────────
    function fmtDate(iso, includeTime = false) {
        if (!iso) return '—';
        const hasTime = iso.includes('T');
        const d = new Date(hasTime ? iso : iso + 'T12:00:00');
        const opts = { day: '2-digit', month: '2-digit', year: '2-digit' };
        if (hasTime && includeTime) {
            opts.hour = '2-digit'; opts.minute = '2-digit'; opts.second = '2-digit';
            return d.toLocaleString('es-ES', opts).replace(',', '');
        }
        return d.toLocaleDateString('es-ES', opts);
    }

    function fmtN(val, dec = 1) {
        if (val === null || val === undefined || val === '') return '—';
        const n = parseFloat(val);
        return isNaN(n) ? '—' : n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    }

    function diffHtml(curr, prev) {
        if (prev === null || curr === null || isNaN(parseFloat(curr)) || isNaN(parseFloat(prev))) return '';
        const d = parseFloat(curr) - parseFloat(prev);
        if (d === 0) return '';
        const cls = d < 0 ? 'diff-good' : 'diff-bad';
        const arrow = d < 0 ? '▼' : '▲';
        return `<span class="stat-card-diff ${cls}">${arrow} ${Math.abs(d).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>`;
    }

    // ─── Stats Cards ────────────────────────────
    function renderStats(person, entries) {
        const el = document.getElementById(`stats-${person}`);
        if (!el) return;
        if (!entries || entries.length === 0) { el.innerHTML = ''; return; }

        const sorted = [...entries].sort((a, b) => a.fecha.localeCompare(b.fecha));
        const last = sorted[sorted.length - 1];
        const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
        const first = sorted[0];
        const keyField = person === 'gema' ? 'musloIzq' : 'musloDer';
        const keyLabel = person === 'gema' ? 'Muslo Izq.' : 'Muslo Der.';

        let pesoDelta = null;
        if (sorted.length > 1 && !isNaN(parseFloat(last.peso)) && !isNaN(parseFloat(first.peso)))
            pesoDelta = parseFloat(last.peso) - parseFloat(first.peso);

        const cards = [
            { label: 'Peso actual', val: fmtN(last.peso) + ' kg', diff: prev ? diffHtml(last.peso, prev.peso) : '', cls: `card-key-${person}` },
            { label: keyLabel, val: fmtN(last[keyField]) + ' cm', diff: prev ? diffHtml(last[keyField], prev[keyField]) : '' },
            { label: 'Cintura', val: fmtN(last.cintura) + ' cm', diff: prev ? diffHtml(last.cintura, prev.cintura) : '' },
            { label: 'Cadera', val: fmtN(last.cadera) + ' cm', diff: prev ? diffHtml(last.cadera, prev.cadera) : '' },
            { label: 'Pecho', val: fmtN(last.pecho) + ' cm', diff: prev ? diffHtml(last.pecho, prev.pecho) : '' },
            { label: 'Entradas', val: entries.length, diff: '' },
        ];

        if (pesoDelta !== null) {
            const sign = pesoDelta > 0 ? '+' : '';
            const cls = pesoDelta < 0 ? 'card-good' : 'card-bad';
            cards.push({ label: 'Δ Peso total', val: sign + fmtN(pesoDelta) + ' kg', diff: '', cls });
        }

        el.innerHTML = cards.map((c, i) => `
            <div class="stat-card ${c.cls || ''}" style="animation-delay:${i * 0.04}s">
                <span class="stat-card-label">${c.label}</span>
                <span class="stat-card-value">${c.val}</span>
                ${c.diff || ''}
            </div>
        `).join('');
    }

    // ─── Chart instances ────────────────────────
    const _charts = {};          // key: `${person}-${chartId}`
    const _chartTypes = {};      // key: `${person}-${chartId}` → 'line'|'bar'
    const _chartVisibility = {}; // key: person → { field: bool }

    function _chartKey(person, chartId) { return `${person}-${chartId}`; }

    function resizeChart(person) {
        ['peso', 'medidas'].forEach(id => {
            const c = _charts[_chartKey(person, id)];
            if (c) c.resize();
        });
    }

    // ─── Chart.js shared config ─────────────────
    function _isDark() { return document.documentElement.getAttribute('data-theme') !== 'light'; }
    function _gridColor() { return _isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'; }
    function _tickColor() { return _isDark() ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)'; }

    function _tooltipConfig() {
        const dark = _isDark();
        return {
            backgroundColor: dark ? '#1a2540' : '#ffffff',
            titleColor: dark ? '#f1f5f9' : '#0f172a',
            bodyColor: dark ? '#94a3b8' : '#475569',
            borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderWidth: 1, padding: 12, cornerRadius: 10,
        };
    }

    function _scalesConfig(unit) {
        return {
            x: {
                grid: { color: _gridColor() },
                ticks: { color: _tickColor(), font: { size: 11, family: 'Inter' }, maxRotation: 45 },
            },
            y: {
                grid: { color: _gridColor() },
                ticks: {
                    color: _tickColor(),
                    font: { size: 11, family: 'Inter' },
                    callback: v => v + (unit ? ` ${unit}` : ''),
                },
            },
        };
    }

    function _emptyOverlay(canvasParent, msg) {
        const old = canvasParent.querySelector('.chart-empty-overlay');
        if (old) old.remove();
        if (!msg) return;
        const o = document.createElement('div');
        o.className = 'chart-empty-overlay';
        o.innerHTML = `<span>${msg}</span>`;
        canvasParent.style.position = 'relative';
        canvasParent.appendChild(o);
    }

    // ─── PESO CHART ────────────────────────────
    const PESO_COLOR = '#10b981';

    function _buildPesoChart(person, sorted, type = 'line') {
        const key = _chartKey(person, 'peso');
        const canvas = document.getElementById(`canvas-peso-${person}`);
        if (!canvas || typeof Chart === 'undefined') return;

        if (_charts[key]) { _charts[key].destroy(); delete _charts[key]; }

        const labels = sorted.map(e => fmtDate(e.fecha));
        const data = sorted.map(e => { const v = parseFloat(e.peso); return isNaN(v) ? null : v; });
        const hasData = data.some(v => v !== null);

        _emptyOverlay(canvas.parentElement, hasData ? null : 'Añade datos de peso para ver la gráfica');
        if (!hasData) return;

        _charts[key] = new Chart(canvas, {
            type,
            data: {
                labels,
                datasets: [{
                    label: 'Peso (kg)',
                    data,
                    borderColor: PESO_COLOR,
                    backgroundColor: type === 'bar' ? PESO_COLOR + '55' : PESO_COLOR + '18',
                    pointBackgroundColor: PESO_COLOR,
                    pointRadius: sorted.length > 10 ? 3 : 5,
                    pointHoverRadius: 7,
                    tension: 0.35,
                    fill: type === 'line',
                    spanGaps: true,
                    borderRadius: type === 'bar' ? 6 : 0,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        ...(_tooltipConfig()),
                        callbacks: { label: ctx => ` ${ctx.parsed.y?.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg` },
                    },
                },
                scales: _scalesConfig('kg'),
                animation: { duration: 500, easing: 'easeInOutQuart' },
            },
        });
    }

    // ─── MEDIDAS CHART ──────────────────────────
    const MEDIDAS_DEFS = [
        { field: 'musloIzq', label: 'Muslo Izq.', color: '#ec4899', persons: ['gema'] },
        { field: 'musloDer', label: 'Muslo Der.', color: '#3b82f6', persons: ['jorge'] },
        { field: 'cintura', label: 'Cintura', color: '#f59e0b', persons: ['gema', 'jorge'] },
        { field: 'cadera', label: 'Cadera', color: '#8b5cf6', persons: ['gema', 'jorge'] },
        { field: 'pecho', label: 'Pecho', color: '#06b6d4', persons: ['gema', 'jorge'] },
    ];

    function _buildMedidasChart(person, sorted, type = 'line') {
        const key = _chartKey(person, 'medidas');
        const canvas = document.getElementById(`canvas-medidas-${person}`);
        if (!canvas || typeof Chart === 'undefined') return;

        if (_charts[key]) { _charts[key].destroy(); delete _charts[key]; }

        if (!_chartVisibility[person]) {
            _chartVisibility[person] = {};
            MEDIDAS_DEFS.filter(d => d.persons.includes(person)).forEach(d => _chartVisibility[person][d.field] = true);
        }

        const labels = sorted.map(e => fmtDate(e.fecha));
        const defs = MEDIDAS_DEFS.filter(d => d.persons.includes(person));
        const hasData = sorted.length > 0;

        _emptyOverlay(canvas.parentElement, hasData ? null : 'Añade medidas para ver la gráfica');
        if (!hasData) return;

        const datasets = defs.map(d => ({
            label: d.label,
            data: sorted.map(e => { const v = parseFloat(e[d.field]); return isNaN(v) ? null : v; }),
            borderColor: d.color,
            backgroundColor: type === 'bar' ? d.color + '55' : d.color + '18',
            pointBackgroundColor: d.color,
            pointRadius: sorted.length > 10 ? 3 : 5,
            pointHoverRadius: 7,
            tension: 0.35,
            fill: false,
            spanGaps: true,
            borderRadius: type === 'bar' ? 4 : 0,
            hidden: !_chartVisibility[person][d.field],
        }));

        _charts[key] = new Chart(canvas, {
            type,
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        ...(_tooltipConfig()),
                        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? '—'} cm` },
                    },
                },
                scales: _scalesConfig('cm'),
                animation: { duration: 500, easing: 'easeInOutQuart' },
            },
        });
    }

    // ─── Toggle individual dataset (medidas) ────
    function toggleDataset(person, field, color, btn) {
        const key = _chartKey(person, 'medidas');
        if (!_charts[key]) return;
        if (!_chartVisibility[person]) _chartVisibility[person] = {};
        const vis = !(_chartVisibility[person][field] !== false);
        _chartVisibility[person][field] = vis;

        const chart = _charts[key];
        const dsIdx = chart.data.datasets.findIndex(d => {
            const def = MEDIDAS_DEFS.find(dd => dd.field === field);
            return def && d.label === def.label;
        });
        if (dsIdx >= 0) { chart.data.datasets[dsIdx].hidden = !vis; chart.update(); }

        btn.classList.toggle('active', vis);
        btn.style.background = vis ? color + '22' : '';
        btn.style.borderColor = vis ? color + '66' : '';
        btn.style.color = vis ? color : '';
    }

    // ─── Switch chart type (line ↔ bar) ─────────
    function switchChartType(person, chartId, type, btn) {
        const key = _chartKey(person, chartId);
        _chartTypes[key] = type;

        // Update button active state in the switcher
        const switcherEl = btn.closest('.chart-type-switcher');
        if (switcherEl) {
            switcherEl.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }

        // Rebuild the appropriate chart
        const currentEntries = _currentEntries[person] || [];
        const sorted = [...currentEntries].sort((a, b) => a.fecha.localeCompare(b.fecha));
        if (chartId === 'peso') {
            _buildPesoChart(person, sorted, type);
        } else {
            _buildMedidasChart(person, sorted, type);
            _buildMedidasToggles(person);
        }
    }

    // ─── Toggle buttons (medidas) ───────────────
    function _buildMedidasToggles(person) {
        const container = document.getElementById(`chart-toggles-${person}`);
        if (!container) return;
        const defs = MEDIDAS_DEFS.filter(d => d.persons.includes(person));
        container.innerHTML = defs.map(d => {
            const active = _chartVisibility[person]?.[d.field] !== false ? 'active' : '';
            return `<button class="chart-toggle-btn ${active}" data-person="${person}" data-field="${d.field}"
                style="${active ? `background:${d.color}22;border-color:${d.color}66;color:${d.color}` : ''}"
                onclick="UI.toggleDataset('${person}','${d.field}','${d.color}',this)">
                <span class="dot" style="background:${d.color}"></span>${d.label}
            </button>`;
        }).join('');
    }

    // ─── Cache of current entries (for chart type switch) ─
    const _currentEntries = {};

    // ─── Main render ────────────────────────────
    function renderTable(person, entries) {
        const tbody = document.getElementById(`tbody-${person}`);
        const empty = document.getElementById(`empty-${person}`);
        const tableWrapper = document.getElementById(`table-wrapper-${person}`);
        if (!tbody) return;

        _currentEntries[person] = entries || [];

        const sorted = [...(entries || [])].sort((a, b) => a.fecha.localeCompare(b.fecha));

        const typePeso = _chartTypes[_chartKey(person, 'peso')] || 'line';
        const typeMedidas = _chartTypes[_chartKey(person, 'medidas')] || 'line';

        // Always render both charts
        _buildPesoChart(person, sorted, typePeso);
        _buildMedidasToggles(person);
        _buildMedidasChart(person, sorted, typeMedidas);

        if (!entries || entries.length === 0) {
            if (empty) empty.style.display = 'flex';
            if (tableWrapper) tableWrapper.style.display = 'none';
            return;
        }

        if (empty) empty.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'block';

        const keyField = person === 'gema' ? 'musloIzq' : 'musloDer';
        const tdKeyCls = `td-key-${person}`;
        const badgeCls = person;
        const latestFecha = sorted[sorted.length - 1].fecha;

        tbody.innerHTML = [...sorted].reverse().map(e => `
            <tr class="${e.fecha === latestFecha ? 'latest-row' : ''}">
                <td>${fmtDate(e.fecha, true)}${e.fecha === latestFecha ? `<span class="badge-latest badge-${badgeCls}">Último</span>` : ''}</td>
                <td class="${tdKeyCls}">${fmtN(e.peso)}</td>
                <td>${fmtN(e[keyField])}</td>
                <td>${fmtN(e.cintura)}</td>
                <td>${fmtN(e.cadera)}</td>
                <td>${fmtN(e.pecho)}</td>
                <td style="text-align:center; white-space:nowrap">
                    <button class="btn-icon btn-edit" title="Editar" onclick="App.editEntry('${person}','${e.fecha}')">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="btn-icon btn-danger" title="Eliminar" onclick="App.deleteEntry('${person}','${e.fecha}')">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    return {
        showToast, setSyncStatus, showPreSyncLoader, hidePreSyncLoader,
        renderStats, renderTable,
        toggleDataset, switchChartType,
        resizeChart,
        fmtDate, fmtN,
    };
})();
