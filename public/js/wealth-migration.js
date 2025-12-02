const DEFAULT_WEALTH_MIGRATION_STATE = 'New York';
const DEFAULT_WEALTH_MIGRATION_STATE_FIPS = '36';
const DEFAULT_WEALTH_MIGRATION_COUNTY_NAME = 'New York County';
const DEFAULT_WEALTH_MIGRATION_COUNTY_CODE = '061';
const WEALTH_MIGRATION_LIMIT = 15;
let wealthMigrationChartInstance = null;
let wealthMigrationDirection = 'outflow';
let wealthMigrationState = DEFAULT_WEALTH_MIGRATION_STATE;
let wealthMigrationCountyFips = `${DEFAULT_WEALTH_MIGRATION_STATE_FIPS || ''}${DEFAULT_WEALTH_MIGRATION_COUNTY_CODE || ''}`.replace(/^\s+|\s+$/g, '') || null;
let wealthMigrationCountyName = DEFAULT_WEALTH_MIGRATION_COUNTY_NAME;
let wealthMigrationPayload = {
    stateName: DEFAULT_WEALTH_MIGRATION_STATE,
    countyName: DEFAULT_WEALTH_MIGRATION_COUNTY_NAME,
    countyFips: wealthMigrationCountyFips,
    latestYear: null,
    inflow: [],
    outflow: []
};
let wealthMigrationStateOptions = [];
let wealthMigrationStateLookup = new Map();
let wealthMigrationStateFips = DEFAULT_WEALTH_MIGRATION_STATE_FIPS;
const WEALTH_MIGRATION_EXCLUDE_PATTERNS = [
    /non-?migrant/i,
    /total migration\s*-\s*same state/i,
    /total migration\s*-\s*different state/i,
    /total migration\s*-\s*us(?: and foreign)?/i,
    /total migration-?us/i,
    /total migration/i,
    /within county/i
];

        function determineStateForWealthMigration(reportData) {
            if (!reportData) {
                return DEFAULT_WEALTH_MIGRATION_STATE;
            }
            const candidates = [
                reportData.home_state,
                reportData.state,
                reportData.county_state,
                reportData.zip_state
            ];
            for (const candidate of candidates) {
                if (!candidate) continue;
                const trimmed = String(candidate).trim();
                if (!trimmed) continue;
                if (trimmed.length === 2) {
                    return STATE_ABBR_TO_NAME[trimmed.toUpperCase()] || trimmed.toUpperCase();
                }
                return trimmed;
            }
            return DEFAULT_WEALTH_MIGRATION_STATE;
        }

        async function loadWealthMigrationStates() {
            try {
                const response = await fetch(`${API_BASE}/states`);
                const payload = await response.json();
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || 'Unable to load states');
                }
                const states = Array.isArray(payload.data) ? payload.data : [];
                wealthMigrationStateOptions = states
                    .map(entry => ({
                        name: entry.stateName || entry.state || entry.State || '',
                        fips: String(entry.stateFips || entry.fips || entry.FipsCode || '').padStart(2, '0')
                    }))
                    .filter(entry => entry.name && /^\d{2}$/.test(entry.fips))
                    .sort((a, b) => a.name.localeCompare(b.name));
                wealthMigrationStateLookup = new Map(
                    wealthMigrationStateOptions.map(entry => [entry.fips, entry.name])
                );
                return wealthMigrationStateOptions;
            } catch (error) {
                console.error('Wealth migration states load error:', error);
                wealthMigrationStateOptions = [];
                wealthMigrationStateLookup = new Map();
                return [];
            }
        }

        function resolveWealthMigrationStateOption(preferredName) {
            if (!wealthMigrationStateOptions.length) {
                return null;
            }
            const normalizedName = String(preferredName || '').trim().toLowerCase();
            if (normalizedName) {
                const match = wealthMigrationStateOptions.find(
                    option => option.name.toLowerCase() === normalizedName
                );
                if (match) {
                    return match;
                }
            }
            return wealthMigrationStateOptions.find(option => option.name === DEFAULT_WEALTH_MIGRATION_STATE)
                || wealthMigrationStateOptions[0];
        }

        async function setupWealthMigrationSelectors(reportData) {
            const stateSelect = document.getElementById('wealthMigrationStateSelect');
            const countySelect = document.getElementById('wealthMigrationCountySelect');
            if (!stateSelect || !countySelect) return;

            stateSelect.innerHTML = '<option value="">Loading states...</option>';
            const states = await loadWealthMigrationStates();
            if (!states.length) {
                stateSelect.innerHTML = '<option value="">States unavailable</option>';
                countySelect.innerHTML = '<option value="">Counties unavailable</option>';
                showWealthMigrationFallback('Wealth migration controls are unavailable.');
                return;
            }

            const preferredStateName = DEFAULT_WEALTH_MIGRATION_STATE;
            const defaultStateOption = resolveWealthMigrationStateOption(preferredStateName);

            stateSelect.innerHTML = states.map(option => `
                <option value="${option.fips}">${option.name}</option>
            `).join('');
            stateSelect.value = defaultStateOption?.fips || states[0].fips;
            wealthMigrationStateFips = stateSelect.value;
            wealthMigrationState = wealthMigrationStateLookup.get(wealthMigrationStateFips) || DEFAULT_WEALTH_MIGRATION_STATE;

            stateSelect.addEventListener('change', async (event) => {
                const selectedFips = event.target.value;
                wealthMigrationStateFips = selectedFips;
                wealthMigrationState = wealthMigrationStateLookup.get(selectedFips) || DEFAULT_WEALTH_MIGRATION_STATE;
                await loadWealthMigrationCounties(selectedFips);
            });

            countySelect.addEventListener('change', () => {
                const selectedCountyFips = countySelect.value;
                wealthMigrationCountyFips = selectedCountyFips ? `${wealthMigrationStateFips}${selectedCountyFips}` : null;
                wealthMigrationCountyName = selectedCountyFips
                    ? (countySelect.selectedOptions[0]?.textContent?.trim() || '')
                    : '';
                if (selectedCountyFips) {
                    fetchWealthMigrationData(wealthMigrationStateFips, selectedCountyFips);
                } else {
                    showWealthMigrationFallback('Select a county to view wealth migration trends.');
                }
            });

            await loadWealthMigrationCounties(
                wealthMigrationStateFips,
                reportData?.county || reportData?.county_name || DEFAULT_WEALTH_MIGRATION_COUNTY_NAME,
                reportData?.county_fips || `${DEFAULT_WEALTH_MIGRATION_STATE_FIPS}${DEFAULT_WEALTH_MIGRATION_COUNTY_CODE}`
            );
        }

        async function loadWealthMigrationCounties(stateFips, preferCountyName = '', preferCountyFips = '') {
            const countySelect = document.getElementById('wealthMigrationCountySelect');
            if (!countySelect) return;
            countySelect.disabled = true;
            countySelect.innerHTML = '<option value="">Loading counties...</option>';

            try {
                if (!stateFips) {
                    throw new Error('State FIPS is required to load counties');
                }
                const response = await fetch(`${API_BASE}/migration/counties?stateFips=${encodeURIComponent(stateFips)}`);
                const payload = await response.json();
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || `Failed to load counties for ${stateFips}`);
                }
                const counties = Array.isArray(payload.data) ? payload.data : [];
                if (counties.length === 0) {
                    throw new Error(`No counties available for ${stateFips}`);
                }

                countySelect.innerHTML = '<option value="">Select County</option>';
                counties.forEach(county => {
                    const option = document.createElement('option');
                    const optionValue = String(
                        county.CountyFips || county.countyFips || county.county_fips || county.id || ''
                    ).replace(/\D/g, '').padStart(3, '0');
                    const optionLabel = county.CountyName || county.countyName || county.county_name || county.name || '';
                    if (!optionValue || !optionLabel) return;
                    option.value = optionValue;
                    option.textContent = optionLabel;
                    countySelect.appendChild(option);
                });

                const preferLabel = normalizeCountyLabel(preferCountyName);
                let normalizedPreferFips = String(preferCountyFips || '').replace(/\D/g, '');
                if (normalizedPreferFips.length === 5) {
                    normalizedPreferFips = normalizedPreferFips.slice(-3);
                }
                if (normalizedPreferFips && normalizedPreferFips.length !== 3) {
                    normalizedPreferFips = '';
                }

                let selectedCountyCode = '';
                if (normalizedPreferFips && Array.from(countySelect.options).some(opt => opt.value === normalizedPreferFips)) {
                    selectedCountyCode = normalizedPreferFips;
                }
                if (!selectedCountyCode && preferLabel) {
                    const match = Array.from(countySelect.options).find(option =>
                        normalizeCountyLabel(option.textContent) === preferLabel
                    );
                    if (match) {
                        selectedCountyCode = match.value;
                    }
                }
                if (!selectedCountyCode && wealthMigrationCountyFips?.startsWith(stateFips)) {
                    selectedCountyCode = wealthMigrationCountyFips.slice(-3);
                }
                if (!selectedCountyCode && stateFips === DEFAULT_WEALTH_MIGRATION_STATE_FIPS) {
                    const defaultCountyNormalized = normalizeCountyLabel(DEFAULT_WEALTH_MIGRATION_COUNTY_NAME);
                    const defaultCountyOption = Array.from(countySelect.options).find(option =>
                        normalizeCountyLabel(option.textContent) === defaultCountyNormalized
                    );
                    if (defaultCountyOption) {
                        selectedCountyCode = defaultCountyOption.value;
                    }
                }
                if (!selectedCountyCode) {
                    selectedCountyCode = countySelect.options[1]?.value || countySelect.options[0]?.value || '';
                }

                countySelect.value = selectedCountyCode;
                wealthMigrationCountyFips = selectedCountyCode ? `${stateFips}${selectedCountyCode}` : null;
                wealthMigrationCountyName = countySelect.selectedOptions[0]?.textContent?.trim() || '';
                countySelect.disabled = false;
                if (selectedCountyCode) {
                    await fetchWealthMigrationData(stateFips, selectedCountyCode);
                } else {
                    showWealthMigrationFallback('Select a county to view wealth migration trends.');
                }
            } catch (error) {
                console.error('Wealth migration counties load error:', error);
                countySelect.innerHTML = '<option value="">Counties unavailable</option>';
                wealthMigrationCountyFips = null;
                wealthMigrationCountyName = '';
                showWealthMigrationFallback('County list unavailable for this state.');
            } finally {
                countySelect.disabled = countySelect.options.length <= 1;
            }
        }

        function initializeWealthMigrationSection(reportData) {
            const section = document.getElementById('wealth-migration-section');
            if (!section) return;

            setupWealthMigrationSelectors(reportData).catch(error => {
                console.error('Wealth migration initialization failed:', error);
                showWealthMigrationFallback('Wealth migration controls are unavailable.');
            });

            const toggleButtons = section.querySelectorAll('.wealth-toggle-btn');
            toggleButtons.forEach(button => {
                button.addEventListener('click', () => {
                    if (button.classList.contains('active')) return;
                    toggleButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    wealthMigrationDirection = button.dataset.direction === 'outflow' ? 'outflow' : 'inflow';
                    updateWealthMigrationHeader();
                    renderWealthMigrationChart(wealthMigrationDirection);
                    renderWealthMigrationList(wealthMigrationDirection);
                });
            });
        }

        async function fetchWealthMigrationData(stateFips, countyFips, limit = WEALTH_MIGRATION_LIMIT) {
            const loadingEl = document.getElementById('wealthMigrationChartLoading');
            if (loadingEl) {
                loadingEl.style.display = 'flex';
            }
            const normalizedStateFips = String(stateFips || '').replace(/\D/g, '').padStart(2, '0');
            const normalizedCountyFips = String(countyFips || '').replace(/\D/g, '').padStart(3, '0');
            if (!/^\d{2}$/.test(normalizedStateFips) || !/^\d{3}$/.test(normalizedCountyFips)) {
                showWealthMigrationFallback('Select a county to view wealth migration trends.');
                if (loadingEl) loadingEl.style.display = 'none';
                return;
            }
            try {
                const params = new URLSearchParams({
                    stateFips: normalizedStateFips,
                    countyFips: normalizedCountyFips
                });
                const response = await fetch(`${API_BASE}/county-migration?${params.toString()}`);
                const payload = await response.json();
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || `Status ${response.status}`);
                }

                const normalizeMigrationRows = (rows) => {
                    if (!Array.isArray(rows)) {
                        return { rows: [], latest: null };
                    }
                    const prepared = rows.map(row => ({
                        partner_county: row.partner_county || row.countyName || row.county_name || '',
                        partner_state: row.partner_state || row.stateName || row.state_name || '',
                        returns: Number(row.returns) || 0,
                        individuals: Number(row.individuals) || 0,
                        agi: Number(row.agi) || 0,
                        toYear: Number(row.toYear || row.to_year || row.tax_year || row.year2year || row.latestYear || row.latest_year || null) || null
                    })).filter(row => {
                        const label = `${row.partner_county} ${row.partner_state}`.trim();
                        return row.partner_county &&
                            !WEALTH_MIGRATION_EXCLUDE_PATTERNS.some(pattern => pattern.test(label));
                    });
                    const latest = prepared.reduce((max, row) => row.toYear && row.toYear > max ? row.toYear : max, 0);
                    const seen = new Set();
                    const deduped = [];
                    prepared
                        .filter(row => !latest || row.toYear === latest)
                        .forEach(row => {
                            const key = `${row.partner_county}|${row.partner_state}`;
                            if (seen.has(key)) {
                                return;
                            }
                            seen.add(key);
                            deduped.push(row);
                        });
                    return { rows: deduped.slice(0, limit), latest: latest || null };
                };

                const inflowResult = normalizeMigrationRows(payload.inflow);
                const outflowResult = normalizeMigrationRows(payload.outflow);
                const resolvedCountyName = payload.countyName || wealthMigrationCountyName || '';
                const resolvedStateName = payload.stateName
                    || wealthMigrationStateLookup.get(normalizedStateFips)
                    || wealthMigrationState
                    || DEFAULT_WEALTH_MIGRATION_STATE;
                wealthMigrationCountyFips = `${normalizedStateFips}${normalizedCountyFips}`;
                wealthMigrationCountyName = resolvedCountyName;
                wealthMigrationPayload = {
                    stateName: resolvedStateName,
                    countyName: resolvedCountyName,
                    countyFips: `${normalizedStateFips}${normalizedCountyFips}`,
                    latestYear: inflowResult.latest || outflowResult.latest || payload.latestYear || null,
                    inflow: inflowResult.rows,
                    outflow: outflowResult.rows
                };

                updateWealthMigrationHeader();
                renderWealthMigrationChart(wealthMigrationDirection);
                renderWealthMigrationList(wealthMigrationDirection);
                updateChartContainers();
            } catch (error) {
                console.error('Wealth migration load error:', error);
                showWealthMigrationFallback('Wealth migration data is unavailable right now.');
            } finally {
                if (loadingEl) {
                    loadingEl.style.display = 'none';
                }
            }
        }

        function updateWealthMigrationHeader() {
            const yearEl = document.getElementById('wealthMigrationYear');
            if (yearEl) {
                yearEl.textContent = wealthMigrationPayload.latestYear
                    ? `Tax Year ${wealthMigrationPayload.latestYear}`
                    : 'Latest available tax year';
            }
            const listTitle = document.getElementById('wealthMigrationListTitle');
            if (listTitle) {
                listTitle.textContent = wealthMigrationDirection === 'outflow'
                    ? 'Top Destinations (Counties)'
                    : 'Top Origins (Counties)';
            }
        }

        function getWealthDataset(direction) {
            const dir = direction === 'outflow' ? 'outflow' : 'inflow';
            const rows = wealthMigrationPayload[dir] || [];
            return rows.slice(0, WEALTH_MIGRATION_LIMIT);
        }

        function renderWealthMigrationChart(direction) {
            const canvas = document.getElementById('wealthMigrationChart');
            const fallbackEl = document.getElementById('wealthMigrationChartFallback');
            if (!canvas) return;

            const dataset = getWealthDataset(direction);
            if (wealthMigrationChartInstance) {
                wealthMigrationChartInstance.destroy();
                wealthMigrationChartInstance = null;
            }

            if (!dataset.length) {
                if (fallbackEl) {
                    fallbackEl.hidden = false;
                    fallbackEl.style.display = 'flex';
                }
                sizeWealthChartContainer();
                syncWealthMigrationListHeight();
                return;
            }

            if (fallbackEl) {
                fallbackEl.hidden = true;
                fallbackEl.style.display = 'none';
            }

            const ctx = canvas.getContext('2d');
            wealthMigrationChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dataset.map(row => {
                        const parts = [];
                        if (row.partner_county) parts.push(row.partner_county);
                        if (row.partner_state) parts.push(row.partner_state);
                        return parts.length > 0 ? parts.join(', ') : 'Unknown';
                    }),
                    datasets: [{
                        label: 'Tax Returns',
                        data: dataset.map(row => Number(row.returns) || 0),
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        borderRadius: 8,
                        barThickness: 18
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: context => {
                                    const entry = dataset[context.dataIndex];
                                    const lines = [`Returns: ${formatWealthCount(context.raw)}`];
                                    if (entry && Number(entry.returns) > 0) {
                                        const avgIncome = Number(entry.agi || 0) / Number(entry.returns);
                                        if (avgIncome > 0) {
                                            lines.push(`Avg AGI: ${formatWealthCurrency(avgIncome)}`);
                                        }
                                    }
                                    return lines;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(15, 23, 42, 0.08)'
                            },
                            ticks: {
                                callback: value => formatWealthCount(value)
                            }
                        },
                        y: {
                            grid: {
                                display: false
                            },
                            // Keep every county label visible and upright only for wealth migration rows
                            ticks: {
                                autoSkip: false,
                                maxRotation: 0,
                                minRotation: 0,
                                font: {
                                    style: 'normal'
                                }
                            }
                        }
                    }
                }
            });
            sizeWealthChartContainer();
            syncWealthMigrationListHeight();
        }

        function renderWealthMigrationList(direction) {
            const list = document.getElementById('wealthMigrationList');
            const placeholder = document.getElementById('wealthMigrationListEmpty');
            if (!list) return;
            list.innerHTML = '';

            const dataset = getWealthDataset(direction);
            if (!dataset.length) {
                if (placeholder) {
                    placeholder.style.display = 'block';
                }
                syncWealthMigrationListHeight();
                return;
            }
            if (placeholder) {
                placeholder.style.display = 'none';
            }

            dataset.forEach((row, index) => {
                const li = document.createElement('li');
                li.className = 'wealth-list-item';
                const avgIncome = Number(row.returns) > 0 ? Number(row.agi || 0) / Number(row.returns) : 0;
                li.innerHTML = `
                    <div class="wealth-list-rank">#${index + 1}</div>
                    <div class="wealth-list-details">
                        <p class="wealth-list-state">${escapeHtml(row.partner_county || 'Unknown')}</p>
                        <p class="wealth-list-substate">${escapeHtml(row.partner_state || '')}</p>
                        <div class="wealth-list-meta">
                            <span>Returns: ${formatWealthCount(row.returns)}</span>
                            <span>Individuals: ${formatWealthCount(row.individuals)}</span>
                            <span>AGI: ${formatWealthCurrency(row.agi)}</span>
                            ${avgIncome ? `<span>Avg AGI: ${formatWealthCurrency(avgIncome)}</span>` : ''}
                        </div>
                    </div>
                `;
                list.appendChild(li);
            });
            syncWealthMigrationListHeight();
        }

        function showWealthMigrationFallback(message) {
            if (wealthMigrationChartInstance) {
                wealthMigrationChartInstance.destroy();
                wealthMigrationChartInstance = null;
            }
            const fallbackEl = document.getElementById('wealthMigrationChartFallback');
            if (fallbackEl) {
                fallbackEl.hidden = false;
                fallbackEl.style.display = 'flex';
                fallbackEl.textContent = message || 'Wealth migration data is unavailable right now.';
            }
            const placeholder = document.getElementById('wealthMigrationListEmpty');
            if (placeholder) {
                placeholder.style.display = 'block';
                placeholder.textContent = message || 'Wealth migration data is unavailable right now.';
            }
            const list = document.getElementById('wealthMigrationList');
            if (list) {
                list.innerHTML = '';
            }
        }

        function formatWealthCurrency(value) {
            const num = Number(value);
            if (!Number.isFinite(num) || num <= 0) {
                return 'N/A';
            }
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0
            }).format(num);
        }

        function formatWealthCount(value) {
            const num = Number(value);
            if (!Number.isFinite(num)) {
                return 'N/A';
            }
            return num.toLocaleString();
        }
        
