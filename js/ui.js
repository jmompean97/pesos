/* =============================================
   js/ui.js — Capa de presentación
   Renderizado de tablas, gráficas, toasts y sync
   ============================================= */

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
        _toastTimer = setTimeout(() => {
            el.classList.remove('show');
        }, 3200);
    }

    // ─── Sync Status ───────────────────────────
    function setSyncStatus(status) {
        const el = document.getElementById('sync-status');
        if (!el) return;
        const states = {
            offline: { cls: 'sync-offline', icon: '🟡', text: 'Sin Gist' },
            syncing: { cls: 'sync-syncing', icon: '🔄', text: 'Sincronizando' },
            synced:  { cls: 'sync-synced',  icon: '🟢', text: 'Sincronizado' },
            error:   { cls: 'sync-error',   icon: '🔴', text: 'Error Gist' },
        };
        const s = states[status] || states.offline;
        el.className = `sync-status ${s.cls}`;
        el.innerHTML = `<span class="sync-icon">${s.icon}</span><span class="sync-text">${s.text}</span>`;
    }

    // ─── Pre-sync Loader ───────────────────────
    function showPreSyncLoader() {
        document.documentElement.classList.add('is-sync-loading');
    }

    function hidePreSyncLoader() {
        const el = document.getElementById('pre-sync-loader');
        if (!el) return;
        el.style.transition = 'opacity 0.4s ease';
        el.style.opacity = '0';
        setTimeout(() => {
            document.documentElement.classList.remove('is-sync-loading');
            el.style.opacity = '';
            el.style.transition = '';
        }, 420);
    }

    // ─── Format date ───────────────────────────
    function fmtDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso + 'T12:00:00');
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    // ─── Format number ─────────────────────────
    function fmtN(val, decimals = 1) {
        if (val === null || val === undefined || val === '') return '—';
        const n = parseFloat(val);
        if (isNaN(n)) return '—';
        return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }

    // ─── Diff badge ────────────────────────────
    function diffBadge(curr, prev, lowerIsBetter = true) {
        if (prev === null || curr === null) return '';
        const d = parseFloat(curr) - parseFloat(prev);
        if (isNaN(d) || d === 0) return '';
        const good = lowerIsBetter ? d < 0 : d > 0;
        const cls = good ? 'diff-good' : 'diff-bad';
        const sign = d > 0 ? '+' : '';
        return `<span class="stat-diff ${cls}">${sign}${fmtN(d, 1)}</span>`;
    }

    // ─── Stats Row ────────────────────────────
    function renderStats(person, entries) {
        const el = document.getElementById(`stats-${person}`);
        if (!el) return;

        if (!entries || entries.length === 0) {
            el.style.display = 'none';
            return;
        }
        el.style.display = 'flex';

        const latest = entries[entries.length - 1];
        const prev = entries.length > 1 ? entries[entries.length - 2] : null;
        const first = entries[0];

        const colorCls = person === 'gema' ? 'gema-color' : 'jorge-color';
        const keyField = person === 'gema' ? 'musloIzq' : 'musloDer';

        const statData = [
            {
                label: 'Peso actual',
                val: fmtN(latest.peso, 1) + ' kg',
                diff: prev ? diffBadge(latest.peso, prev.peso) : '',
            },
            {
                label: person === 'gema' ? 'Muslo Izq.' : 'Muslo Der.',
                val: fmtN(latest[keyField], 1) + ' cm',
                diff: prev ? diffBadge(latest[keyField], prev[keyField]) : '',
            },
            {
                label: 'Cintura',
                val: fmtN(latest.cintura, 1) + ' cm',
                diff: prev ? diffBadge(latest.cintura, prev.cintura) : '',
            },
            {
                label: 'Total entradas',
                val: entries.length,
                diff: '',
            },
        ];

        if (entries.length > 1) {
            const pesoTotal = parseFloat(latest.peso) - parseFloat(first.peso);
            if (!isNaN(pesoTotal)) {
                statData.push({
                    label: 'Δ Peso total',
                    val: (pesoTotal > 0 ? '+' : '') + fmtN(pesoTotal, 1) + ' kg',
                    diff: '',
                });
            }
        }

        el.innerHTML = statData.map(s => `
            <div class="stat-item">
                <span class="stat-label">${s.label}</span>
                <span class="stat-value ${colorCls}">${s.val} ${s.diff}</span>
            </div>
        `).join('');
    }

    // ─── Progress Bars ─────────────────────────
    function renderProgressBars(person, entries) {
        const el = document.getElementById(`progress-${person}`);
        if (!el) return;

        if (!entries || entries.length < 2) {
            el.style.display = 'none';
            return;
        }

        const keyField = person === 'gema' ? 'musloIzq' : 'musloDer';
        const fillCls = person === 'gema' ? 'fill-gema' : 'fill-jorge';

        const first = entries[0];
        const latest = entries[entries.length - 1];

        const metrics = [
            { label: person === 'gema' ? 'Muslo Izq.' : 'Muslo Der.', field: keyField },
            { label: 'Cintura', field: 'cintura' },
            { label: 'Cadera', field: 'cadera' },
            { label: 'Pecho', field: 'pecho' },
            { label: 'Peso (kg)', field: 'peso' },
        ];

        const items = metrics.filter(m => {
            const f = parseFloat(first[m.field]);
            const l = parseFloat(latest[m.field]);
            return !isNaN(f) && !isNaN(l);
        });

        if (items.length === 0) {
            el.style.display = 'none';
            return;
        }

        el.style.display = 'block';
        el.innerHTML = `<p class="progress-title">Progreso desde inicio</p>` + items.map(m => {
            const f = parseFloat(first[m.field]);
            const l = parseFloat(latest[m.field]);
            const diff = l - f;
            const pct = f > 0 ? Math.max(0, Math.min(100, Math.abs(diff) / f * 100 * 5)) : 0;
            const sign = diff > 0 ? '+' : '';
            const diffCls = diff <= 0 ? 'diff-good' : 'diff-bad';
            return `
                <div class="progress-item">
                    <span class="progress-label">${m.label}</span>
                    <div class="progress-bar-track">
                        <div class="progress-bar-fill ${fillCls}" style="width:${pct}%"></div>
                    </div>
                    <span class="progress-val ${diffCls}">${sign}${fmtN(diff, 1)}</span>
                </div>
            `;
        }).join('');
    }

    // ─── Render table ──────────────────────────
    function renderTable(person, entries) {
        const tbody = document.getElementById(`tbody-${person}`);
        const empty = document.getElementById(`empty-${person}`);
        const tableWrapper = document.getElementById(`table-wrapper-${person}`);
        if (!tbody) return;

        const keyField = person === 'gema' ? 'musloIzq' : 'musloDer';
        const keyLabel = person === 'gema' ? 'Muslo Izq.' : 'Muslo Der.';
        const badgeCls = `badge-latest-${person}`;
        const colHighlight = `col-highlight-${person}`;

        if (!entries || entries.length === 0) {
            if (empty) empty.style.display = 'flex';
            if (tableWrapper) tableWrapper.style.display = 'none';
            return;
        }

        if (empty) empty.style.display = 'none';
        if (tableWrapper) tableWrapper.style.display = 'block';

        const sorted = [...entries].sort((a, b) => a.fecha.localeCompare(b.fecha));
        const latestDate = sorted[sorted.length - 1].fecha;

        tbody.innerHTML = sorted.map((e, i) => {
            const isLatest = e.fecha === latestDate;
            const prev = i > 0 ? sorted[i - 1] : null;
            return `
            <tr class="${isLatest ? 'latest-row' : ''}">
                <td>
                    ${fmtDate(e.fecha)}
                    ${isLatest ? `<span class="badge-latest ${badgeCls}">Último</span>` : ''}
                </td>
                <td>${fmtN(e.peso, 1)}</td>
                <td class="${colHighlight}"><strong>${fmtN(e[keyField], 1)}</strong></td>
                <td>${fmtN(e.cintura, 1)}</td>
                <td>${fmtN(e.cadera, 1)}</td>
                <td>${fmtN(e.pecho, 1)}</td>
                <td class="td-actions">
                    <button class="btn-icon btn-danger" title="Eliminar entrada"
                        onclick="App.deleteEntry('${person}', '${e.fecha}')">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M3 6H5H21M8 6V4C8 3.47 8.21 2.96 8.59 2.59C8.96 2.21 9.47 2 10 2H14C14.53 2 15.04 2.21 15.41 2.59C15.79 2.96 16 3.47 16 4V6M19 6V20C19 20.53 18.79 21.04 18.41 21.41C18.04 21.79 17.53 22 17 22H7C6.47 22 5.96 21.79 5.59 21.41C5.21 21.04 5 20.53 5 20V6H19Z"
                                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </td>
            </tr>
            `;
        }).join('');
    }

    // ─── Render chart (lightweight sparkline) ──
    function renderChart(person, entries) {
        const canvas = document.getElementById(`chart-${person}`);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const sorted = [...entries].sort((a, b) => a.fecha.localeCompare(b.fecha));

        if (sorted.length < 2) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const keyField = person === 'gema' ? 'musloIzq' : 'musloDer';
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

        const datasets = [
            { field: keyField, color: person === 'gema' ? '#ec4899' : '#3b82f6', label: person === 'gema' ? 'Muslo Izq.' : 'Muslo Der.' },
            { field: 'cintura', color: '#f59e0b', label: 'Cintura' },
            { field: 'peso', color: '#10b981', label: 'Peso' },
        ];

        const W = canvas.offsetWidth || 400;
        const H = 160;
        canvas.width = W;
        canvas.height = H;

        const PAD = { top: 16, right: 16, bottom: 32, left: 40 };
        const plotW = W - PAD.left - PAD.right;
        const plotH = H - PAD.top - PAD.bottom;

        ctx.clearRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        for (let g = 0; g <= 4; g++) {
            const y = PAD.top + (plotH / 4) * g;
            ctx.beginPath();
            ctx.moveTo(PAD.left, y);
            ctx.lineTo(PAD.left + plotW, y);
            ctx.stroke();
        }

        // X axis labels (dates)
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const step = Math.max(1, Math.floor(sorted.length / 5));
        sorted.forEach((e, i) => {
            if (i % step === 0 || i === sorted.length - 1) {
                const x = PAD.left + (i / (sorted.length - 1)) * plotW;
                ctx.fillText(fmtDate(e.fecha), x, H - 8);
            }
        });

        // Draw each line
        datasets.forEach(ds => {
            const vals = sorted.map(e => {
                const v = parseFloat(e[ds.field]);
                return isNaN(v) ? null : v;
            });
            const nonNull = vals.filter(v => v !== null);
            if (nonNull.length < 2) return;

            const minV = Math.min(...nonNull);
            const maxV = Math.max(...nonNull);
            const range = maxV - minV || 1;

            ctx.beginPath();
            ctx.strokeStyle = ds.color;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            let started = false;
            vals.forEach((v, i) => {
                if (v === null) return;
                const x = PAD.left + (i / (sorted.length - 1)) * plotW;
                const y = PAD.top + plotH - ((v - minV) / range) * plotH;
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Dots on last point
            const lastIdx = vals.map((v, i) => v !== null ? i : -1).filter(i => i >= 0).pop();
            if (lastIdx !== undefined) {
                const x = PAD.left + (lastIdx / (sorted.length - 1)) * plotW;
                const y = PAD.top + plotH - ((vals[lastIdx] - minV) / range) * plotH;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = ds.color;
                ctx.fill();
            }
        });
    }

    return {
        showToast,
        setSyncStatus,
        showPreSyncLoader,
        hidePreSyncLoader,
        renderStats,
        renderProgressBars,
        renderTable,
        renderChart,
        fmtDate,
        fmtN,
    };
})();
