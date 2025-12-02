        (function() {
            const STORAGE_PREFIX = 'marketTrendsSelections:';
            const MAX_SLOTS = 5;
            const METRIC_PAGES = [
                {
                    label: 'Price Change',
                    headers: (currentYear, previousYear) => [
                        'Price Change %',
                        `Median Sale Price ${currentYear}`,
                        `Median Sale Price ${previousYear}`
                    ],
                    cells: (row) => [
                        formatPercentage(row?.Median_Sale_Price_Percent),
                        formatDollar(row?.Median_Sale_Price_This_Year),
                        formatDollar(row?.Median_Sale_Price_Last_Year)
                    ]
                },
                {
                    label: 'Inventory',
                    headers: (currentYear, previousYear) => [
                        'Inventory Change %',
                        `Inventory ${currentYear}`,
                        `Inventory ${previousYear}`
                    ],
                    cells: (row) => [
                        formatPercentage(row?.Total_Active_Percent),
                        formatNumber(row?.Total_Active_This_Year),
                        formatNumber(row?.Total_Active_Last_Year)
                    ]
                },
                {
                    label: 'New Listings',
                    headers: (currentYear, previousYear) => [
                        'New Listings % Change',
                        `New Listings ${currentYear}`,
                        `New Listings ${previousYear}`
                    ],
                    cells: (row) => [
                        formatPercentage(row?.New_Listings_Percent),
                        formatNumber(row?.New_Listings_This_Year),
                        formatNumber(row?.New_Listings_Last_Year)
                    ]
                },
                {
                    label: 'Under Contract',
                    headers: (currentYear, previousYear) => [
                        'Under Contract % Change',
                        `Under Contract ${currentYear}`,
                        `Under Contract ${previousYear}`
                    ],
                    cells: (row) => [
                        formatPercentage(row?.Number_Under_Contract_Percent),
                        formatNumber(row?.Number_Under_Contract_This_Year),
                        formatNumber(row?.Number_Under_Contract_Last_Year)
                    ]
                },
                {
                    label: 'Closed Listings',
                    headers: (currentYear, previousYear) => [
                        'Closed Listings % Change',
                        `Closed Listings ${currentYear}`,
                        `Closed Listings ${previousYear}`
                    ],
                    cells: (row) => [
                        formatPercentage(row?.Number_Sold_Percent),
                        formatNumber(row?.Number_Sold_This_Year),
                        formatNumber(row?.Number_Sold_Last_Year)
                    ]
                }
            ];

            const state = {
                propertyType: 'waterfront',
                priceRange: 'all',
                pageIndex: 0,
                currentYear: new Date().getFullYear(),
                previousYear: new Date().getFullYear() - 1,
                rows: [],
                selectedCities: Array(MAX_SLOTS).fill(null),
                reportSlug: null,
                reportData: window.currentReportPayload || null,
                container: null,
                lastUpdatedEl: null,
                pageLabelEl: null,
                propertySelect: null,
                prevButton: null,
                nextButton: null,
                isLoading: false
            };

            const MARKET_TRENDS_CHART_METRICS = [
                { label: 'Median Sale Price', field: 'Median_Sale_Price_This_Year', axisLabel: 'Median Sale Price', format: formatDollar },
                { label: 'Active Inventory', field: 'Total_Active_This_Year', axisLabel: 'Active Listings', format: formatNumber },
                { label: 'New Listings', field: 'New_Listings_This_Year', axisLabel: 'New Listings', format: formatNumber },
                { label: 'Under Contract', field: 'Number_Under_Contract_This_Year', axisLabel: 'Under Contract', format: formatNumber },
                { label: 'Closed Listings', field: 'Number_Sold_This_Year', axisLabel: 'Closed Listings', format: formatNumber }
            ];

            const PRICE_RANGE_CONFIGS = [
                { key: 'all', param: 'all', label: 'All Prices', color: '#1f4f9a' },
                { key: 'under', param: 'under_1m', label: '$1M and Under', color: '#2e9d90' },
                { key: 'over', param: 'over_3m', label: '$3M+', color: '#f4b63f' }
            ];

            const marketTrendsChartModal = {
                overlay: null,
                closeBtn: null,
                prevBtn: null,
                nextBtn: null,
                titleEl: null,
                metricLabelEl: null,
                loadingEl: null,
                errorEl: null,
                canvas: null,
                chartInstance: null,
                currentCity: '',
                propertyType: 'waterfront',
                metricIndex: 0,
                historyData: null,
                isOpen: false,
                lastKeyHandler: null
            };

            document.addEventListener('DOMContentLoaded', initializeMarketTrends);
            document.addEventListener('report-data-ready', (event) => {
                state.reportData = event?.detail || null;
                seedCitiesFromReport();
                renderMarketTrends();
            });

            function initializeMarketTrends() {
                const section = document.getElementById('market-trends-section');
                if (!section) return;

                state.container = document.getElementById('market-trends-container');
                state.lastUpdatedEl = document.getElementById('last-modified-date');
                state.pageLabelEl = document.getElementById('market-trends-page-label');
                state.propertySelect = document.getElementById('property-type');
                state.prevButton = document.getElementById('prev-page');
                state.nextButton = document.getElementById('next-page');
                state.reportSlug = getReportSlug();
                state.selectedCities = loadSelectedCities();
                initializeMarketTrendsChartModal();

                if (!state.container || !state.propertySelect) return;

                state.propertyType = state.propertySelect.value;
                state.priceRange = 'all';

                state.propertySelect.addEventListener('change', () => {
                    state.propertyType = state.propertySelect.value;
                    fetchMarketTrends();
                });

                state.prevButton?.addEventListener('click', () => changePage(state.pageIndex - 1));
                state.nextButton?.addEventListener('click', () => changePage(state.pageIndex + 1));

                updatePageLabel();
                updateNavButtons();
                renderMarketTrends();
                fetchMarketTrends();
            }

            function changePage(nextIndex) {
                if (nextIndex < 0 || nextIndex >= METRIC_PAGES.length) return;
                state.pageIndex = nextIndex;
                updatePageLabel();
                updateNavButtons();
                renderMarketTrends();
            }

            function updatePageLabel() {
                if (!state.pageLabelEl) return;
                const config = METRIC_PAGES[state.pageIndex] || METRIC_PAGES[0];
                state.pageLabelEl.textContent = config.label;
            }

            function updateNavButtons() {
                if (state.prevButton) state.prevButton.disabled = state.pageIndex === 0;
                if (state.nextButton) state.nextButton.disabled = state.pageIndex === METRIC_PAGES.length - 1;
            }

            async function fetchMarketTrends() {
                if (!state.container) return;
                state.isLoading = true;
                state.container.innerHTML = `<div class="market-trends-empty">Loading market data...</div>`;
                try {
                    const params = new URLSearchParams({
                        propertyType: state.propertyType,
                        priceRange: state.priceRange
                    });
                    const response = await fetch(`${API_BASE}/market-trends?${params.toString()}`, { headers: { 'Accept': 'application/json' } });
                    if (!response.ok) throw new Error('Unable to load market trends data.');
                    const payload = await response.json();
                    if (!payload || !Array.isArray(payload.data)) throw new Error('Market trends payload is invalid.');

                    state.rows = payload.data
                        .map(row => ({ ...row }))
                        .sort((a, b) => String(a.City || '').localeCompare(String(b.City || '')));

                    updateYearMarkers(payload.lastModifiedDate);
                    validateSelectedCities();
                    seedCitiesFromReport();
                    state.isLoading = false;
                    renderMarketTrends();
                } catch (error) {
                    console.error('Market trends fetch error:', error);
                    state.isLoading = false;
                    state.container.innerHTML = `<div class="market-trends-empty market-trends-error">${escapeHtml(error.message || 'Failed to load market trends.')}</div>`;
                }
            }

            function renderMarketTrends() {
                if (!state.container) return;
                if (state.isLoading) return;
                if (!state.rows.length) {
                    state.container.innerHTML = `<div class="market-trends-empty">No market data available for the selected filters.</div>`;
                    return;
                }

                const config = METRIC_PAGES[state.pageIndex] || METRIC_PAGES[0];
                const headers = typeof config.headers === 'function'
                    ? config.headers(state.currentYear, state.previousYear)
                    : config.headers;
                const headerHtml = `
                    <div class="market-trends-header">
                        ${headers.map(text => `<div class="market-trends-cell">${escapeHtml(text)}</div>`).join('')}
                    </div>
                `;

                const bodyHtml = state.selectedCities.map((cityName, slotIndex) => {
                    const row = findRowByCity(cityName);
                    const cityLabel = row?.City
                        ? `
                            <span class="market-trends-city-name">${escapeHtml(row.City)}</span>
                            <button type="button" class="market-trends-chart-btn" data-city="${escapeHtml(row.City)}" aria-label="View historical market trends for ${escapeHtml(row.City)}">
                                <span aria-hidden="true">📈</span>
                            </button>
                        `
                        : '<div class="add-city">+</div>';
                    const cells = config.cells(row).map(value => `<div class="market-trends-cell">${value}</div>`).join('');
                    return `
                        <div class="market-trends-city" data-slot="${slotIndex}">${cityLabel}</div>
                        <div class="market-trends-row">${cells}</div>
                    `;
                }).join('');

                state.container.innerHTML = headerHtml + bodyHtml;
                state.container.querySelectorAll('.market-trends-city').forEach(el => {
                    const slot = Number(el.getAttribute('data-slot'));
                    el.addEventListener('click', () => openCitySelectionPopup(slot));
                });
                state.container.querySelectorAll('.market-trends-chart-btn').forEach(btn => {
                    btn.addEventListener('click', (event) => {
                        event.stopPropagation();
                        const targetCity = btn.getAttribute('data-city');
                        openMarketTrendsChartModal(targetCity);
                    });
                });
            }

            function findRowByCity(cityName) {
                if (!cityName) return null;
                const normalized = normalizeCity(cityName);
                return state.rows.find(row => normalizeCity(row.City) === normalized) || null;
            }

            function validateSelectedCities() {
                let changed = false;
                state.selectedCities = state.selectedCities.map(city => {
                    if (!city) return null;
                    return findRowByCity(city) ? city : (changed = true, null);
                });
                if (changed) saveSelectedCities();
            }

            function seedCitiesFromReport() {
                if (!state.rows.length) return;
                const hasSelection = state.selectedCities.some(city => city);
                if (!hasSelection) {
                    const candidates = [];
                    const report = state.reportData;
                    if (report) {
                        const subjectCity = report.home_city || report.city;
                        if (subjectCity) candidates.push(subjectCity);
                        if (Array.isArray(report.interest_areas)) {
                            report.interest_areas.forEach(area => {
                                if (area?.city) candidates.push(area.city);
                            });
                        }
                    }
                    fillSlotsWithCities(candidates, false);
                }
                fillSlotsWithCities(state.rows.map(row => row.City), false);
                saveSelectedCities();
            }

            function fillSlotsWithCities(candidates, save = true) {
                if (!Array.isArray(candidates)) return;
                const normalizedSelected = new Set(state.selectedCities.filter(Boolean).map(normalizeCity));
                let updated = false;
                candidates.forEach(candidate => {
                    if (!candidate) return;
                    if (normalizedSelected.has(normalizeCity(candidate))) return;
                    const slotIndex = state.selectedCities.findIndex(city => !city);
                    if (slotIndex === -1) return;
                    if (!findRowByCity(candidate)) return;
                    state.selectedCities[slotIndex] = candidate;
                    normalizedSelected.add(normalizeCity(candidate));
                    updated = true;
                });
                if (updated && save) saveSelectedCities();
            }

            function openCitySelectionPopup(slotIndex) {
                if (!state.rows.length) return;
                const popup = document.createElement('div');
                popup.className = 'city-selection-popup';
                popup.innerHTML = `
                    <div class="popup-content">
                        <div class="popup-header">
                            <h3>Select a City</h3>
                            <span class="close-popup" role="button" aria-label="Close selection">&times;</span>
                        </div>
                        <input type="text" class="city-search" placeholder="Search cities...">
                        <div class="city-list"></div>
                        <div style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 10px;">
                            <button class="nav-button" data-action="clear-slot">Clear Slot</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(popup);

                const cityListEl = popup.querySelector('.city-list');
                const searchInput = popup.querySelector('.city-search');
                const closeButtons = popup.querySelectorAll('.close-popup, .nav-button[data-action="clear-slot"]');

                const availableCities = state.rows
                    .map(row => row.City)
                    .filter(name => !!name)
                    .filter(name => !state.selectedCities.includes(name) || state.selectedCities[slotIndex] === name)
                    .sort((a, b) => a.localeCompare(b));

                const renderCityList = (term = '') => {
                    const searchTerm = term.trim().toLowerCase();
                    cityListEl.innerHTML = '';
                    let rendered = 0;
                    availableCities.forEach(name => {
                        if (!name.toLowerCase().includes(searchTerm)) return;
                        const item = document.createElement('div');
                        item.className = 'city-item';
                        item.textContent = name;
                        item.addEventListener('click', () => {
                            state.selectedCities[slotIndex] = name;
                            saveSelectedCities();
                            renderMarketTrends();
                            document.body.removeChild(popup);
                        });
                        cityListEl.appendChild(item);
                        rendered++;
                    });
                    if (rendered === 0) {
                        const empty = document.createElement('div');
                        empty.className = 'city-item';
                        empty.textContent = 'No cities match your search.';
                        empty.style.cursor = 'default';
                        cityListEl.appendChild(empty);
                    }
                };

                renderCityList();
                searchInput.addEventListener('input', () => renderCityList(searchInput.value));
                closeButtons.forEach(btn => {
                    if (btn.matches('[data-action="clear-slot"]')) {
                        btn.addEventListener('click', () => {
                            state.selectedCities[slotIndex] = null;
                            saveSelectedCities();
                            renderMarketTrends();
                            document.body.removeChild(popup);
                        });
                    } else {
                        btn.addEventListener('click', () => document.body.removeChild(popup));
                    }
                });

                popup.addEventListener('click', (event) => {
                    if (event.target === popup) {
                        document.body.removeChild(popup);
                    }
                });
            }

            function loadSelectedCities() {
                const key = `${STORAGE_PREFIX}${state.reportSlug || 'default'}`;
                try {
                    const raw = localStorage.getItem(key);
                    if (!raw) return Array(MAX_SLOTS).fill(null);
                    const parsed = JSON.parse(raw);
                    if (!Array.isArray(parsed)) return Array(MAX_SLOTS).fill(null);
                    const trimmed = parsed.slice(0, MAX_SLOTS).map(value => (typeof value === 'string' && value.trim().length ? value.trim() : null));
                    while (trimmed.length < MAX_SLOTS) trimmed.push(null);
                    return trimmed;
                } catch {
                    return Array(MAX_SLOTS).fill(null);
                }
            }

            function saveSelectedCities() {
                const key = `${STORAGE_PREFIX}${state.reportSlug || 'default'}`;
                try {
                    localStorage.setItem(key, JSON.stringify(state.selectedCities));
                } catch (error) {
                    console.warn('Unable to persist selected cities:', error);
                }
            }

            function getReportSlug() {
                const parts = window.location.pathname.split('/').filter(Boolean);
                const reportsIndex = parts.findIndex(part => part.toLowerCase() === 'reports');
                if (reportsIndex !== -1 && parts[reportsIndex + 1]) {
                    return parts[reportsIndex + 1];
                }
                return parts.pop() || 'default';
            }

            function updateYearMarkers(lastModified) {
                if (lastModified) {
                    const parsed = new Date(lastModified);
                    if (!Number.isNaN(parsed.getTime())) {
                        state.currentYear = parsed.getFullYear();
                        state.previousYear = state.currentYear - 1;
                        if (state.lastUpdatedEl) {
                            state.lastUpdatedEl.textContent = `${parsed.getMonth() + 1}/1/${parsed.getFullYear()}`;
                        }
                        return;
                    }
                }
                if (state.lastUpdatedEl) {
                    const now = new Date();
                    state.lastUpdatedEl.textContent = `${now.getMonth() + 1}/1/${now.getFullYear()}`;
                }
            }

            function formatPercentage(value) {
                if (value === null || value === undefined || value === '') return 'N/A';
                const num = Number(value);
                if (!Number.isFinite(num)) return 'N/A';
                const decimals = Math.abs(num) < 10 ? 1 : 0;
                return `${num.toFixed(decimals)}%`;
            }

            function formatDollar(value) {
                if (value === null || value === undefined || value === '') return 'N/A';
                const num = Number(value);
                if (!Number.isFinite(num)) return 'N/A';
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0
                }).format(num);
            }

            function formatNumber(value) {
                if (value === null || value === undefined || value === '') return 'N/A';
                const num = Number(value);
                if (!Number.isFinite(num)) return 'N/A';
                return num.toLocaleString();
            }

            function normalizeCity(name) {
                if (!name) return '';
                return String(name).trim().toLowerCase();
            }

            function initializeMarketTrendsChartModal() {
                if (marketTrendsChartModal.overlay) return;
                const overlay = document.getElementById('marketTrendsChartModal');
                if (!overlay) return;
                marketTrendsChartModal.overlay = overlay;
                marketTrendsChartModal.closeBtn = document.getElementById('marketTrendsChartClose');
                marketTrendsChartModal.prevBtn = document.getElementById('marketTrendsChartPrev');
                marketTrendsChartModal.nextBtn = document.getElementById('marketTrendsChartNext');
                marketTrendsChartModal.titleEl = document.getElementById('marketTrendsChartTitle');
                marketTrendsChartModal.metricLabelEl = document.getElementById('marketTrendsChartMetricLabel');
                marketTrendsChartModal.loadingEl = document.getElementById('marketTrendsChartLoading');
                marketTrendsChartModal.errorEl = document.getElementById('marketTrendsChartError');
                marketTrendsChartModal.canvas = document.getElementById('marketTrendsChartCanvas');

                overlay.setAttribute('aria-hidden', 'true');
                toggleChartModalLoading(false);
                showChartModalError('');

                marketTrendsChartModal.closeBtn?.addEventListener('click', () => closeMarketTrendsChartModal());
                marketTrendsChartModal.prevBtn?.addEventListener('click', () => changeMarketTrendsChartMetric(marketTrendsChartModal.metricIndex - 1));
                marketTrendsChartModal.nextBtn?.addEventListener('click', () => changeMarketTrendsChartMetric(marketTrendsChartModal.metricIndex + 1));
                overlay.addEventListener('click', (event) => {
                    if (event.target === overlay) {
                        closeMarketTrendsChartModal();
                    }
                });

                if (!marketTrendsChartModal.lastKeyHandler) {
                    marketTrendsChartModal.lastKeyHandler = (event) => {
                        if (event.key === 'Escape' && marketTrendsChartModal.isOpen) {
                            closeMarketTrendsChartModal();
                        }
                    };
                    document.addEventListener('keydown', marketTrendsChartModal.lastKeyHandler);
                }
            }

            function openMarketTrendsChartModal(cityName) {
                if (!cityName || !marketTrendsChartModal.overlay) return;
                marketTrendsChartModal.currentCity = cityName;
                marketTrendsChartModal.propertyType = state.propertyType;
                marketTrendsChartModal.metricIndex = state.pageIndex;
                marketTrendsChartModal.historyData = null;
                marketTrendsChartModal.isOpen = true;
                marketTrendsChartModal.overlay.setAttribute('aria-hidden', 'false');
                if (marketTrendsChartModal.titleEl) {
                    const typeLabel = state.propertyType === 'condos' ? 'Condos' : 'Single Family Homes';
                    marketTrendsChartModal.titleEl.textContent = `${cityName} • ${typeLabel}`;
                }
                updateChartModalControls();
                toggleChartModalLoading(true);
                showChartModalError('');
                const targetCity = cityName;
                const targetType = marketTrendsChartModal.propertyType;
                fetchMarketTrendsHistoryBundle(cityName, marketTrendsChartModal.propertyType)
                    .then((history) => {
                        if (!marketTrendsChartModal.isOpen || marketTrendsChartModal.currentCity !== targetCity || marketTrendsChartModal.propertyType !== targetType) {
                            return;
                        }
                        marketTrendsChartModal.historyData = history;
                        renderMarketTrendsHistoryChart(marketTrendsChartModal.metricIndex);
                    })
                    .catch((error) => {
                        console.error('Market trends chart fetch failed:', error);
                        if (!marketTrendsChartModal.isOpen || marketTrendsChartModal.currentCity !== targetCity || marketTrendsChartModal.propertyType !== targetType) {
                            return;
                        }
                        showChartModalError('Unable to load market history for this city.');
                        toggleChartModalLoading(false);
                    });
            }

            function closeMarketTrendsChartModal() {
                if (!marketTrendsChartModal.overlay) return;
                marketTrendsChartModal.overlay.setAttribute('aria-hidden', 'true');
                marketTrendsChartModal.isOpen = false;
                toggleChartModalLoading(false);
                showChartModalError('');
                if (marketTrendsChartModal.chartInstance) {
                    try {
                        marketTrendsChartModal.chartInstance.destroy();
                    } catch (_) {}
                    marketTrendsChartModal.chartInstance = null;
                }
            }

            function toggleChartModalLoading(isLoading) {
                if (marketTrendsChartModal.loadingEl) {
                    marketTrendsChartModal.loadingEl.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
                }
                if (marketTrendsChartModal.canvas) {
                    marketTrendsChartModal.canvas.style.visibility = isLoading ? 'hidden' : 'visible';
                }
            }

            function showChartModalError(message) {
                if (!marketTrendsChartModal.errorEl) return;
                if (message) {
                    marketTrendsChartModal.errorEl.textContent = message;
                    marketTrendsChartModal.errorEl.setAttribute('aria-hidden', 'false');
                    if (marketTrendsChartModal.canvas) {
                        marketTrendsChartModal.canvas.style.visibility = 'hidden';
                    }
                } else {
                    marketTrendsChartModal.errorEl.textContent = '';
                    marketTrendsChartModal.errorEl.setAttribute('aria-hidden', 'true');
                    if (marketTrendsChartModal.canvas) {
                        marketTrendsChartModal.canvas.style.visibility = 'visible';
                    }
                }
            }

            function updateChartModalControls() {
                const metric = MARKET_TRENDS_CHART_METRICS[marketTrendsChartModal.metricIndex] || MARKET_TRENDS_CHART_METRICS[0];
                if (marketTrendsChartModal.metricLabelEl) {
                    marketTrendsChartModal.metricLabelEl.textContent = metric.label;
                }
                if (marketTrendsChartModal.prevBtn) {
                    marketTrendsChartModal.prevBtn.disabled = marketTrendsChartModal.metricIndex <= 0;
                }
                if (marketTrendsChartModal.nextBtn) {
                    marketTrendsChartModal.nextBtn.disabled = marketTrendsChartModal.metricIndex >= MARKET_TRENDS_CHART_METRICS.length - 1;
                }
            }

            function changeMarketTrendsChartMetric(nextIndex) {
                if (nextIndex < 0 || nextIndex >= MARKET_TRENDS_CHART_METRICS.length) return;
                marketTrendsChartModal.metricIndex = nextIndex;
                updateChartModalControls();
                if (marketTrendsChartModal.historyData) {
                    renderMarketTrendsHistoryChart(marketTrendsChartModal.metricIndex);
                }
            }

            async function fetchMarketTrendsHistoryBundle(city, propertyType) {
                const bundle = {};
                await Promise.all(PRICE_RANGE_CONFIGS.map(async (config) => {
                    bundle[config.key] = await fetchMarketTrendsHistory(city, propertyType, config.param);
                }));
                return bundle;
            }

            async function fetchMarketTrendsHistory(city, propertyType, priceRangeParam) {
                try {
                    const query = new URLSearchParams({
                        propertyType: propertyType || 'waterfront',
                        priceRange: priceRangeParam
                    });
                    const response = await fetch(`${API_BASE}/market-trends/history/${encodeURIComponent(city)}?${query.toString()}`, {
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!response.ok) {
                        console.warn('Market trends history request failed', { city, propertyType, priceRange: priceRangeParam, status: response.status });
                        return [];
                    }
                    const payload = await response.json();
                    if (payload && Array.isArray(payload.data)) {
                        return payload.data;
                    }
                    if (payload && Array.isArray(payload.rows)) {
                        return payload.rows;
                    }
                    return [];
                } catch (error) {
                    console.warn('Market trends history fetch error', { city, priceRange: priceRangeParam, error });
                    return [];
                }
            }

            function renderMarketTrendsHistoryChart(metricIndex) {
                if (!marketTrendsChartModal.canvas) return;
                const metric = MARKET_TRENDS_CHART_METRICS[metricIndex] || MARKET_TRENDS_CHART_METRICS[0];
                const includeRanges = metricIndex === 1 ? PRICE_RANGE_CONFIGS.slice(0, 1) : PRICE_RANGE_CONFIGS;
                const datasets = includeRanges.map((config, idx) => {
                    const rows = marketTrendsChartModal.historyData?.[config.key] || [];
                    const points = convertHistoryRowsToPoints(rows, metric.field);
                    if (!points.length) return null;
                    return {
                        label: config.label,
                        data: points,
                        borderColor: config.color,
                        backgroundColor: 'transparent',
                        pointRadius: window.innerWidth <= 768 ? 0 : 3,
                        pointHoverRadius: window.innerWidth <= 768 ? 3 : 5,
                        borderWidth: idx === 0 ? 3 : 2,
                        tension: 0.15,
                        hidden: config.key !== 'all'
                    };
                }).filter(Boolean);

                if (!datasets.length) {
                    showChartModalError('No historical data available for this metric.');
                    if (marketTrendsChartModal.chartInstance) {
                        try { marketTrendsChartModal.chartInstance.destroy(); } catch (_) {}
                        marketTrendsChartModal.chartInstance = null;
                    }
                    toggleChartModalLoading(false);
                    return;
                }

                toggleChartModalLoading(false);
                showChartModalError('');

                if (marketTrendsChartModal.chartInstance) {
                    try { marketTrendsChartModal.chartInstance.destroy(); } catch (_) {}
                }

                const ctx = marketTrendsChartModal.canvas.getContext('2d');
                marketTrendsChartModal.chartInstance = new Chart(ctx, {
                    type: 'line',
                    data: { datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const value = context.parsed?.y;
                                        if (value == null) return `${context.dataset.label}: No data`;
                                        return `${context.dataset.label}: ${metric.format(value)}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                time: { unit: 'month', tooltipFormat: 'MMM yyyy' },
                                ticks: { maxTicksLimit: 10 }
                            },
                            y: {
                                beginAtZero: metricIndex !== 0,
                                title: { display: true, text: metric.axisLabel },
                                ticks: {
                                    callback: (value) => metric.format(value)
                                }
                            }
                        }
                    }
                });
            }

            function convertHistoryRowsToPoints(rows, field) {
                if (!Array.isArray(rows)) return [];
                return rows.map(entry => {
                    const rawDate = entry?.Date || entry?.date;
                    if (!rawDate) return null;
                    const parsedDate = new Date(rawDate);
                    if (Number.isNaN(parsedDate.getTime())) return null;
                    const numericValue = normalizeNumericValue(entry?.[field]);
                    if (numericValue === null) return null;
                    return { x: parsedDate, y: numericValue };
                }).filter(Boolean).sort((a, b) => (a.x?.getTime?.() || 0) - (b.x?.getTime?.() || 0));
            }

            function normalizeNumericValue(value) {
                if (value === null || value === undefined) return null;
                if (typeof value === 'number' && Number.isFinite(value)) return value;
                const cleaned = String(value).replace(/[^0-9.+-]/g, '');
                if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
                const parsed = Number(cleaned);
                return Number.isFinite(parsed) ? parsed : null;
            }
        })();
    
