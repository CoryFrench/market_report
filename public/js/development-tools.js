        // Development/Zone Comparison Functionality
        let selectionMode = 'development'; // 'development' | 'zone'
        // Maintain independent selections for developments and zones
        window.selectedDevelopments = window.selectedDevelopments || [];
        window.selectedZones = window.selectedZones || [];
        // Track last mouse position as a reliable fallback for popup placement
        (function trackLastMousePosition(){
            try {
                window.__lastMouse = { x: 0, y: 0 };
                document.addEventListener('mousemove', function(e){
                    if (e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
                        window.__lastMouse.x = e.clientX;
                        window.__lastMouse.y = e.clientY;
                    }
                }, { passive: true });
            } catch (err) {
                console.warn('Unable to attach mousemove listener for popup placement fallback:', err);
            }
        })();

        let developmentSelectionCount = 1;
        let developmentsList = [];
        let zonesList = [];
        let __suppressNextDocumentClick = false;

        // Helper: Try direct-render neighbourhood from complete endpoint (fallback)
        async function tryRenderFromComplete(slug) {
            try {
                const resp = await fetch(`${API_BASE}/reports/complete/${slug}`);
                if (!resp.ok) return false;
                const json = await resp.json();
                const charts = json && json.data && Array.isArray(json.data.charts) ? json.data.charts : [];
                const saved = charts.find(c => c && (c.chart_type === 'neighbourhood_comparison' || c.chart_type === 'neighborhood_comparison'));
                if (!saved || !Array.isArray(saved.locations) || saved.locations.length === 0) return false;

        const selections = saved.locations;
        // Attempt to split types from saved payload if available, else treat all as developments for fetch but keep labels distinct
        const devs = Array.isArray(saved.development_names) ? saved.development_names : selections;
        const zones = Array.isArray(saved.zone_names) ? saved.zone_names : [];

        // Fetch both types where possible
        const reqs = [];
        if (Array.isArray(devs) && devs.length > 0) {
            reqs.push(fetch(`${API_BASE}/developments-comparison?developments=${encodeURIComponent(devs.join(','))}`));
        }
        if (Array.isArray(zones) && zones.length > 0) {
            reqs.push(fetch(`${API_BASE}/zones-comparison?zones=${encodeURIComponent(zones.join(','))}`));
        }
        const resps = await Promise.all(reqs);
        const jsons = await Promise.all(resps.map(r => r.ok ? r.json() : Promise.resolve(null)));
        let merged = [];
        jsons.forEach(j => {
            if (!j || !j.success) return;
            if (Array.isArray(j.data)) merged.push(...j.data);
            else if (Array.isArray(j.data?.comparisonData)) merged.push(...j.data.comparisonData);
        });

        // Build labels and mappings
        const devSetLower = new Set((devs || []).map(n => String(n).toLowerCase()));
        const overlapLower = new Set((zones || []).map(n => String(n).toLowerCase()).filter(n => devSetLower.has(n)));
        const entityLabelMap = {};
        const entityKeyToLabel = {};
        const labels = [];
        (devs || []).forEach(name => {
            const label = String(name);
            labels.push(label);
            entityLabelMap[label] = { name: String(name), type: 'development' };
            entityKeyToLabel[`development:${String(name).toLowerCase()}`] = label;
        });
        (zones || []).forEach(name => {
            const lower = String(name).toLowerCase();
            const label = overlapLower.has(lower) ? `${name} (Zone)` : String(name);
            labels.push(label);
            entityLabelMap[label] = { name: String(name), type: 'zone' };
            entityKeyToLabel[`zone:${lower}`] = label;
        });
        window.entityLabelMap = entityLabelMap;
        window.entityKeyToLabel = entityKeyToLabel;

        displayDevelopmentComparisonChart(merged, labels);
                showDevelopmentChartView();
                const chartControls = document.getElementById('development-chart-controls');
                if (chartControls) chartControls.style.display = 'block';
                const chartHeader = document.getElementById('dev-comparison-chart-header');
                if (chartHeader) chartHeader.style.display = 'block';
                // Restore chart type (no auto-regenerate)
                if (saved.series_id) {
                    const type = String(saved.series_id);
                    if (type === 'sales' || type === 'price' || type === 'price_per_sqft') {
                        switchDevelopmentChart(type);
                    }
                }
                return true;
            } catch (e) {
                console.warn('tryRenderFromComplete failed:', e);
                return false;
            }
        }
        let countyInsightsChart = null;
        async function initCountyInsights(reportData) {
            try {
                let zipFromReport = String(reportData.__zipFallback || reportData.zip_code || '').trim();
                if (!/^\d{5}$/.test(zipFromReport)) {
                    zipFromReport = '33477';
                }

                const metricSelect = document.getElementById('county-insights-metric-select');
                metricSelect.innerHTML = '';
                REALTOR_METRICS.forEach(metric => {
                    const option = document.createElement('option');
                    option.value = metric.key;
                    option.textContent = metric.label;
                    metricSelect.appendChild(option);
                });

                const chartSection = document.getElementById('county-insights');
                const loadingEl = document.getElementById('county-insights-loading');
                const errorEl = document.getElementById('county-insights-error');

                const ciLocations = document.getElementById('ci-location-selections');
                const ciAddBtn = document.getElementById('ci-add-location-btn');
                const ciRemoveBtn = document.getElementById('ci-remove-location-btn');
                const ciCompareBtn = document.getElementById('ci-compare-btn');
                window.ciSelectionCount = 1;

                function selectedZips() {
                    const list = [];
                    for (let i = 1; i <= (window.ciSelectionCount || 1); i++) {
                        const input = document.getElementById(`ci-zip-input-${i}`);
                        if (input && input.value && /^\d{5}$/.test(input.value.trim())) {
                            list.push({ zip: input.value.trim(), name: input.value.trim() });
                        }
                    }
                    return list;
                }

                function ciShowControlsView() {
                    document.getElementById('ci-controls-section').style.display = 'block';
                    document.getElementById('ci-chart-controls').style.display = 'none';
                    document.getElementById('county-insights-chart-container').style.display = 'none';
                }
                function ciShowChartView() {
                    document.getElementById('ci-controls-section').style.display = 'none';
                    document.getElementById('ci-chart-controls').style.display = 'block';
                    document.getElementById('county-insights-chart-container').style.display = 'block';
                }

                function formatCityState(city, state) {
                    try {
                        const rawCity = String(city || '').trim();
                        const rawState = String(state || '').trim();
                        const state2 = rawState.length === 2
                            ? rawState.toUpperCase()
                            : (rawState ? rawState.split(/\s+/).map(p => p[0]?.toUpperCase()).join('') : '');

                        // Remove any trailing ", <state>" already present in city (e.g., "Jupiter, fl")
                        let cityClean = rawCity;
                        if (state2) {
                            const reAbbr = new RegExp(`\\s*,\\s*${state2}$`, 'i');
                            cityClean = cityClean.replace(reAbbr, '');
                        }
                        if (rawState) {
                            const reFull = new RegExp(`\\s*,\\s*${rawState}$`, 'i');
                            cityClean = cityClean.replace(reFull, '');
                        }
                        // Generic cleanup: strip any trailing ", XX"
                        cityClean = cityClean.replace(/,\s*[A-Za-z]{2}\s*$/, '');

                        // Title-case city
                        const titled = cityClean.replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ])(\S*)/g, (_m, a, b) => a.toUpperCase() + b.toLowerCase());

                        // Append state if not already present
                        if (state2 && !new RegExp(`,\\s*${state2}$`, 'i').test(titled)) {
                            return `${titled}, ${state2}`;
                        }
                        return titled;
                    } catch { return city || ''; }
                }

                async function rebuildCiSelections() {
                    const prev = [];
                    for (let i = 1; i <= (window.ciSelectionCount || 1); i++) {
                        const input = document.getElementById(`ci-zip-input-${i}`);
                        if (input) prev.push(input.value.trim());
                    }
                    ciLocations.innerHTML = '';
                    for (let i = 1; i <= (window.ciSelectionCount || 1); i++) {
                        const wrap = document.createElement('div');
                        wrap.className = 'location-selection';
                        wrap.id = `ci-location-${i}`;
                        wrap.innerHTML = `
                            <div>
                                <label>ZIP or City</label>
                                <input id="ci-zip-input-${i}" type="text" placeholder="Enter ZIP or City, ST" maxlength="64" style="width: 200px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px;" />
                            </div>
                            <div>
                                <label id="ci-zip-dropdown-label-${i}" style="display:none;">Select ZIP</label>
                                <select id="ci-zip-dropdown-${i}" style="display:none; min-width: 220px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; background:white;"></select>
                            </div>
                        `;
                        ciLocations.appendChild(wrap);
                        const input = document.getElementById(`ci-zip-input-${i}`);
                        const dropdown = document.getElementById(`ci-zip-dropdown-${i}`);
                        const dropdownLabel = document.getElementById(`ci-zip-dropdown-label-${i}`);
                        if (prev[i-1]) {
                            input.value = prev[i-1];
                        } else if (Array.isArray(window.__savedZipCodes) && window.__savedZipCodes[i-1]) {
                            input.value = String(window.__savedZipCodes[i-1]).padStart(5, '0');
                        } else if (i === 1 && zipFromReport && /^\d{5}$/.test(zipFromReport)) {
                            input.value = zipFromReport;
                        }

                        let debounceTimer = null;
                        input.addEventListener('input', () => {
                            const val = String(input.value || '').trim();
                            if (/^\d{5}$/.test(val)) {
                                dropdown.style.display = 'none';
                                dropdownLabel.style.display = 'none';
                                return;
                            }
                            if (val.length < 2) {
                                dropdown.style.display = 'none';
                                dropdownLabel.style.display = 'none';
                                return;
                            }
                            if (debounceTimer) clearTimeout(debounceTimer);
                            debounceTimer = setTimeout(async () => {
                                try {
                                    const url = new URL(`${API_BASE}/zipcity/by-city`, window.location.origin);
                                    // Parse optional state hint like "City, ST" or "City, State Name"
                                    let cityQuery = val;
                                    let stateHint = null;
                                    const m = val.match(/^(.*?),(.*)$/);
                                    if (m) {
                                        cityQuery = m[1].trim();
                                        stateHint = m[2].trim();
                                    }
                                    url.searchParams.set('city', cityQuery);
                                    if (stateHint && stateHint.length > 0) {
                                        const two = stateHint.match(/^\s*([A-Za-z]{2})\s*$/);
                                        url.searchParams.set('state', two ? two[1].toUpperCase() : stateHint);
                                    }
                                    const resp = await fetch(url.toString().replace(window.location.origin, ''));
                                    const json = await resp.json();
                                    if (!resp.ok || !json.success) throw new Error('Lookup failed');
                                    const rows = Array.isArray(json.data) ? json.data : [];
                                    if (rows.length === 0) {
                                        dropdown.style.display = 'none';
                                        dropdownLabel.style.display = 'none';
                                        return;
                                    }
                                    dropdown.innerHTML = '<option value="">Select ZIP</option>';
                                    const seen = new Set();
                                    for (const r of rows) {
                                        const zip5 = String(r.zip5 || r.zip || '').padStart(5, '0');
                                        if (!/^\d{5}$/.test(zip5) || seen.has(zip5)) continue;
                                        seen.add(zip5);
                                        const opt = document.createElement('option');
                                        const stateDisp = r.state_id || r.state_name || '';
                                        opt.value = zip5;
                                        opt.textContent = `${zip5} - ${r.city || ''}${stateDisp ? ', ' + stateDisp : ''}`;
                                        dropdown.appendChild(opt);
                                    }
                                    if (dropdown.options.length > 1) {
                                        dropdown.style.display = 'inline-block';
                                        dropdownLabel.style.display = 'inline-block';
                                    } else {
                                        dropdown.style.display = 'none';
                                        dropdownLabel.style.display = 'none';
                                    }
                                } catch (_) {
                                    dropdown.style.display = 'none';
                                    dropdownLabel.style.display = 'none';
                                }
                            }, 400);
                        });
                        dropdown.addEventListener('change', () => {
                            const z = String(dropdown.value || '').trim();
                            if (/^\d{5}$/.test(z)) {
                                input.value = z;
                                dropdown.style.display = 'none';
                                dropdownLabel.style.display = 'none';
                            }
                        });
                    }
                    ciRemoveBtn.style.display = (window.ciSelectionCount || 1) > 1 ? 'inline-block' : 'none';
                }

                ciAddBtn.addEventListener('click', async () => {
                    window.ciSelectionCount = Math.min(5, (window.ciSelectionCount || 1) + 1);
                    await rebuildCiSelections();
                });
                ciRemoveBtn.addEventListener('click', async () => {
                    window.ciSelectionCount = Math.max(1, (window.ciSelectionCount || 1) - 1);
                    await rebuildCiSelections();
                });

                const fetchAndRender = async () => {
                    try {
                        console.debug('ZIP insights initial fetch start', { zipFromReport, apiBase: API_BASE });
                        chartSection.style.display = 'block';
                        loadingEl.style.display = 'flex';
                        errorEl.style.display = 'none';

                        let rows = null;
                        const url2 = new URL(`${API_BASE}/zip-series`, window.location.origin);
                        if (zipFromReport) url2.searchParams.set('zip', zipFromReport);
                        url2.searchParams.set('months', '36');
                        const resp2 = await fetch(url2.toString().replace(window.location.origin, ''));
                        const json2 = await resp2.json();
                        console.debug('ZIP insights initial API response', { status: resp2.status, success: json2.success, count: json2.data?.length, sample: json2.data?.slice?.(0, 5) });
                        if (!resp2.ok || !json2.success || !Array.isArray(json2.data) || json2.data.length === 0) {
                            throw new Error(json2.error || 'No data');
                        }
                        rows = json2.data.map(r => ({
                            zip5: String(r.zip5 || zipFromReport || '').padStart(5, '0'),
                            city: r.city || r.zip_name || r.county_name || '',
                            month_date_yyyymm: r.month_date_yyyymm || r.yyyymm,
                            avg_listing_price: r.avg_listing_price,
                            med_listing_price: r.median_listing_price,
                            median_listing_price_proxy: r.median_listing_price_proxy || r.median_listing_price,
                            median_days_on_market: r.avg_days_on_market || r.median_days_on_market,
                            avg_days_on_market: r.avg_days_on_market,
                            median_price_per_sqft: r.avg_price_per_sqft,
                            avg_price_per_sqft: r.avg_price_per_sqft,
                            active_listing_count: r.active_listing_count,
                            new_listing_count: r.new_listing_count,
                            pending_listing_count: r.pending_listing_count,
                            total_listing_count: r.total_listing_count,
                            pending_ratio: r.pending_ratio,
                            price_increased_share: r.price_increased_share,
                            price_reduced_share: r.price_reduced_share
                        }));

                        const metric = metricSelect.value || 'avg_listing_price';
                        const cityName = formatCityState(rows[0].city || '', rows[0].state_id || rows[0].state || rows[0].state_name);
                        const zipLabel = String(rows[0].zip5 || '').padStart(5, '0');
                        const title = `${metricLabel(metric)}`;
                        const effectiveMetric = (metric === 'med_listing_price' && rows[0].median_listing_price) ? 'median_listing_price' : metric;
                        const series = [{ key: effectiveMetric, label: `${zipLabel}${cityName ? ' - ' + cityName : ''}`, data: rows.map(r => ({ x: parseYyyymmToDate(r.month_date_yyyymm), y: toNumberOrNull(r[effectiveMetric]) })) }];
                        console.debug('ZIP insights initial dataset', { metric, effectiveMetric, series });
                        renderCountyInsightsChart(series, title);
                        ciShowChartView();
                        loadingEl.style.display = 'none';
                    } catch (err) {
                        console.warn('ZIP insights error:', err);
                        loadingEl.style.display = 'none';
                        errorEl.style.display = 'flex';
                    }
                };

                async function ciRenderForSelections(metric, selections) {
                    try {
                        console.debug('zip comparison request', { metric, selections });
                        chartSection.style.display = 'block';
                        loadingEl.style.display = 'flex';
                        errorEl.style.display = 'none';
                        const zipList = selections.map(s => s.zip).join(',');
                        const url = new URL(`${API_BASE}/zip-comparison`, window.location.origin);
                        url.searchParams.set('zips', zipList);
                        url.searchParams.set('months', '36');
                        const resp = await fetch(url.toString().replace(window.location.origin, ''));
                        const json = await resp.json();
                        console.debug('zip comparison API response', { status: resp.status, success: json.success, count: json.data?.length, sample: json.data?.slice?.(0, 5) });
                        if (!resp.ok || !json.success || !Array.isArray(json.data) || json.data.length === 0) throw new Error(json.error || 'No data');
                        const byZip = {}; const names = {};
                        for (const r of json.data) {
                            const id = String(r.zip5).padStart(5, '0');
                            if (!byZip[id]) byZip[id] = [];
                            byZip[id].push({ x: parseYyyymmToDate(r.month_date_yyyymm), y: toNumberOrNull(r[metric]) });
                            const city = r.city || '';
                            const state = r.state_id || r.state || r.state_name || '';
                            const disp = (city || state) ? formatCityState(city, state) : '';
                            names[id] = `${id}${disp ? ' - ' + disp : ''}`;
                        }
                        const series = Object.keys(byZip).map((id) => ({ key: metric, label: `${names[id]}`, data: byZip[id] }));
                        console.debug('zip comparison datasets', { metric, series });
                        renderCountyInsightsChart(series, metricLabel(metric));
                        ciShowChartView();
                        loadingEl.style.display = 'none';
                    } catch (e) {
                        console.warn('ZIP insights comparison error:', e);
                        loadingEl.style.display = 'none';
                        errorEl.style.display = 'flex';
                    }
                }

                function resolveZipReportId() {
                    try {
                        const candidates = [reportData?.report_id, reportData?.reportId, reportData?.id, reportData?.reportid];
                        for (const value of candidates) {
                            const num = Number(value);
                            if (Number.isFinite(num) && num > 0) return num;
                        }
                    } catch (_) {}
                    try {
                        if (typeof urlSlug === 'string' && urlSlug.length > 0) {
                            const m = urlSlug.match(/(\d+)/);
                            if (m) {
                                const num = Number(m[1]);
                                if (Number.isFinite(num) && num > 0) return num;
                            }
                        }
                    } catch (_) {}
                    return null;
                }
                function sanitizeZipList(list) {
                    return Array.isArray(list)
                        ? list.map(z => String(z || '').trim()).filter(z => /^\d{5}$/.test(z)).slice(0, 5)
                        : [];
                }
                async function loadSavedZipComparison() {
                    const reportId = resolveZipReportId();
                    if (!reportId) return null;
                    try {
                        const resp = await fetch(`${API_BASE}/reports/${reportId}/zip-comparison`);
                        const json = await resp.json();
                        if (!resp.ok || !json.success || !json.data) return null;
                        const zips = sanitizeZipList(json.data.zip_codes);
                        return { series_id: json.data.series_id || 'avg_listing_price', zip_codes: zips };
                    } catch (_) { return null; }
                }
                function applySavedZipComparison(saved) {
                    if (!saved || !Array.isArray(saved.zip_codes) || saved.zip_codes.length === 0) return;
                    if (saved.series_id && metricSelect.querySelector(`option[value="${saved.series_id}"]`)) {
                        metricSelect.value = saved.series_id;
                    }
                    try { window.__savedZipCodes = saved.zip_codes.slice(); } catch (_) {}
                    window.ciSelectionCount = Math.min(5, saved.zip_codes.length || 1);
                }
                async function saveZipComparison(metric, selections) {
                    const reportId = resolveZipReportId();
                    if (!reportId) return;
                    const payloadZips = sanitizeZipList((selections || []).map(s => s.zip));
                    if (payloadZips.length === 0) return;
                    try {
                        await fetch(`${API_BASE}/reports/${reportId}/zip-comparison`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ seriesId: metric || 'avg_listing_price', zipIds: payloadZips })
                        });
                    } catch (_) {}
                }

                metricSelect.addEventListener('change', async () => {
                    const selections = selectedZips();
                    const metric = metricSelect.value || 'avg_listing_price';
                    if (selections.length > 0) {
                        await ciRenderForSelections(metric, selections);
                        await saveZipComparison(metric, selections);
                    } else {
                        await fetchAndRender();
                    }
                });
                await rebuildCiSelections();
                const savedZipComparison = await loadSavedZipComparison();
                applySavedZipComparison(savedZipComparison);
                await rebuildCiSelections();
                if (savedZipComparison && Array.isArray(savedZipComparison.zip_codes) && savedZipComparison.zip_codes.length > 0) {
                    const metric = savedZipComparison.series_id || (metricSelect.value || 'avg_listing_price');
                    const selections = savedZipComparison.zip_codes.map(zip => ({ zip, label: zip }));
                    await ciRenderForSelections(metric, selections);
                } else {
                    await fetchAndRender();
                }
                ciCompareBtn.addEventListener('click', async () => {
                     const selections = selectedZips();
                     const metric = metricSelect.value || 'avg_listing_price';
                     if (selections.length > 0) {
                         await ciRenderForSelections(metric, selections);
                         await saveZipComparison(metric, selections);
                         try { window.__savedZipCodes = selections.map(s => String(s.zip || '').padStart(5,'0')); } catch (_) {}
                     } else if (zipFromReport) {
                         await fetchAndRender();
                     }
                 });
                 const ciBackBtn = document.getElementById('ci-back-to-controls-btn');
                 ciBackBtn.addEventListener('click', async () => {
                     ciShowControlsView();
                     try { await rebuildCiSelections(); } catch (_) {}
                 });
             } catch (e) {
                 console.warn('initCountyInsights failed:', e);
             }
         }
        function renderCountyInsightsChart(series, title) {
             const canvas = document.getElementById('county-insights-chart');
             if (!canvas) return;
             if (countyInsightsChart) {
                 countyInsightsChart.destroy();
                 countyInsightsChart = null;
             }
             const basePalette = ['#e83e8c', '#28a745', '#fd7e14', '#6f42c1', '#20c997', '#ffc107', '#6610f2', '#d63384', '#adb5bd'];
             const jupiterColor = '#003366';
             const isJupiterLabel = (label) => {
                 const text = String(label || '');
                 return /jupiter/i.test(text) && /\bfl\b/i.test(text);
             };
             let paletteIndex = 0;
             const nextPaletteColor = () => {
                 if (basePalette.length === 0) return '#999999';
                 const color = basePalette[paletteIndex % basePalette.length];
                 paletteIndex += 1;
                 return color;
             };
             const ctx = canvas.getContext('2d');
             const datasets = series.map((s) => {
                 const label = s.label;
                 const isJupiter = isJupiterLabel(label);
                 const color = isJupiter ? jupiterColor : nextPaletteColor();
                 return {
                     label: label,
                     data: s.data,
                     yAxisID: isRatioMetric(s.key) ? 'y2' : 'y',
                     backgroundColor: color + '20',
                     borderColor: color,
                     borderWidth: 3,
                     fill: false,
                     tension: 0.3,
                     pointRadius: 0
                 };
             });
             countyInsightsChart = new Chart(ctx, {
                 type: 'line',
                 data: { datasets },
                 options: {
                     responsive: true,
                     maintainAspectRatio: false,
                     interaction: { mode: 'index', intersect: false },
                     plugins: {
                         legend: { display: true },
                         title: { display: true, text: title }
                     },
                     scales: {
                         x: { type: 'time', time: { unit: 'month' } },
                         y: { beginAtZero: false },
                         y2: {
                             position: 'right',
                             grid: { drawOnChartArea: false },
                             suggestedMin: 0,
                             suggestedMax: 1,
                             ticks: { callback: (v) => `${Math.round(v * 100)}%` }
                         }
                     }
                 }
             });
         }

         function parseYyyymmToDate(yyyymm) {
             try {
                 const s = String(yyyymm || '');
                 const y = Number(s.slice(0,4));
                 const m = Number(s.slice(4,6));
                 if (!y || !m) return null;
                 return new Date(Date.UTC(y, m - 1, 1));
             } catch { return null; }
         }
         function toNumberOrNull(v) {
             const n = Number(v);
             return isFinite(n) ? n : null;
         }
         function metricLabel(key) {
             switch (key) {
                 case 'avg_listing_price': return 'Average Listing Price';
                 case 'median_listing_price_proxy': return 'Median Listing Price (proxy)';
                 case 'avg_price_per_sqft': return 'Average Price per Sq Ft';
                 case 'avg_days_on_market': return 'Average Days on Market';
                 case 'active_listing_count': return 'Active Listings';
                 case 'new_listing_count': return 'New Listings';
                 case 'pending_ratio': return 'Pending Ratio';
                 case 'price_increased_share': return 'Price Increased Share';
                 case 'price_reduced_share': return 'Price Reduced Share';
                 default: return key;
             }
         }
         function isRatioMetric(key) {
             return key === 'pending_ratio' || key === 'price_increased_share' || key === 'price_reduced_share';
         }
         // Initialize development comparison
         async function initializeDevelopmentComparison() {
             if (window.isPalmBeachCounty === false) {
                 return;
             }
             const t0 = performance.now();
             try {
                 // 1) Try direct-render from saved neighbourhood comparison first (no dropdown population)
                 try {
                     const slugEl = document.getElementById('reportContent');
                     const slug = (typeof urlSlug !== 'undefined') ? urlSlug : (window.location.pathname.split('/').pop());
                     let rendered = false;
                     try {
                         const resp = await fetch(`${API_BASE}/reports/${slug}/neighbourhood-comparison`);
                         if (resp.ok) {
                             const saved = await resp.json();
                             const payload = saved && saved.data ? saved.data : null;
                             // Prefer explicit development/zone arrays from API to avoid misclassification
                             const devs = Array.isArray(payload?.development_names) ? payload.development_names : [];
                             const zonesSaved = Array.isArray(payload?.zone_names) ? payload.zone_names : [];
                             window.selectedDevelopments = devs;
                             window.selectedZones = zonesSaved;

                             // Fetch both data sets in parallel and merge, tagging source type for disambiguation
                             const reqs = [];
                             const reqTypes = [];
                             if (devs.length > 0) {
                                 reqs.push(fetch(`${API_BASE}/developments-comparison?developments=${encodeURIComponent(devs.join(','))}`));
                                 reqTypes.push('development');
                             }
                             if (zonesSaved.length > 0) {
                                 reqs.push(fetch(`${API_BASE}/zones-comparison?zones=${encodeURIComponent(zonesSaved.join(','))}`));
                                 reqTypes.push('zone');
                             }
                             const resps = await Promise.all(reqs);
                             const jsons = await Promise.all(resps.map(r => r.ok ? r.json() : Promise.resolve(null)));
                             let mergedData = [];
                             jsons.forEach((j, idx) => {
                                 if (!j || !j.success) return;
                                 const srcType = reqTypes[idx] || 'development';
                                 if (Array.isArray(j.data)) mergedData.push(...j.data.map(row => ({ ...row, sourceType: srcType })));
                                 else if (Array.isArray(j.data?.comparisonData)) mergedData.push(...j.data.comparisonData.map(row => ({ ...row, sourceType: srcType })));
                             });

                             // Build label mapping and disambiguated labels (mirror Generate Analysis path)
                             const devSetLower = new Set(devs.map(n => String(n).toLowerCase()));
                             const overlapLower = new Set((zonesSaved || []).map(n => String(n).toLowerCase()).filter(n => devSetLower.has(n)));
                             const entityLabelMap = {}; // label -> { name, type }
                             const entityKeyToLabel = {}; // `${type}:${lowerName}` -> label
                             const labels = [];
                             devs.forEach(name => {
                                 const label = String(name);
                                 labels.push(label);
                                 entityLabelMap[label] = { name: String(name), type: 'development' };
                                 entityKeyToLabel[`development:${String(name).toLowerCase()}`] = label;
                             });
                             (zonesSaved || []).forEach(name => {
                                 const lower = String(name).toLowerCase();
                                 const label = overlapLower.has(lower) ? `${name} (Zone)` : String(name);
                                 labels.push(label);
                                 entityLabelMap[label] = { name: String(name), type: 'zone' };
                                 entityKeyToLabel[`zone:${lower}`] = label;
                             });
                             window.entityLabelMap = entityLabelMap;
                             window.entityKeyToLabel = entityKeyToLabel;
                             try {
                                 window.knownDevNamesLower = new Set(devs.map(n => String(n).toLowerCase()));
                                 window.knownZoneNamesLower = new Set((zonesSaved || []).map(n => String(n).toLowerCase()));
                             } catch {}

                             if (mergedData.length > 0) {
                                 displayDevelopmentComparisonChart(mergedData, labels);
                                 showDevelopmentChartView();
                                 const chartControls = document.getElementById('development-chart-controls');
                                 if (chartControls) chartControls.style.display = 'block';
                                 const chartHeader = document.getElementById('dev-comparison-chart-header');
                                 if (chartHeader) chartHeader.style.display = 'block';
                                 if (payload.series_id) {
                                     const type = String(payload.series_id);
                                     if (type === 'sales' || type === 'price' || type === 'price_per_sqft') {
                                         switchDevelopmentChart(type);
                                     }
                                 }
                                 rendered = true;
                             }
                         }
                         else if (resp.status === 404) {
                             // Fallback to complete endpoint
                             rendered = await tryRenderFromComplete(slug);
                         }
                     } catch (e) {
                         // If endpoint missing, try fallback
                         rendered = await tryRenderFromComplete(slug);
                     }
                 } catch (e) {
                     console.warn('Direct-render from saved neighbourhood comparison skipped:', e);
                 }

                 // 2) Prepare controls lazily for edits
                 // Load lists without blocking the main thread
                 loadDevelopmentsList().then(() => {
                     try { populateInitialDevelopmentDropdowns(); } catch {}
                 });
                 // Zones are loaded on demand when toggled
                 createSelectionModeToggle();
                 // Initial dropdown will be populated when developments list resolves above
                 if (selectionMode === 'development') {
                     setTimeout(() => { try { autoSelectReportDevelopment(); } catch {} }, 0);
                 }
                 setupDevelopmentComparisonEventHandlers();
             } catch (error) {
                 console.error('Error initializing development comparison:', error);
             }
             const t1 = performance.now();
             console.log('initializeDevelopmentComparison ms:', Math.round(t1 - t0));
         }

         // Load available developments (full list, once)
         async function loadDevelopmentsList() {
             try {
                 const response = await fetch(`${API_BASE}/developments`);
                 if (!response.ok) {
                     throw new Error(`Failed to load developments: ${response.status}`);
                 }
                 const result = await response.json();
                 
                 // Handle different response structures
                 if (result && result.success && Array.isArray(result.data)) {
                     developmentsList = result.data.map(r => {
                         const name = r.development_name || r.name || r.Development;
                         return { development_name: String(name || '').trim() };
                     }).filter(r => r.development_name.length > 0);
                 } else if (Array.isArray(result)) {
                     developmentsList = result.map(v => ({ development_name: String(v || '').trim() }))
                                               .filter(r => r.development_name.length > 0);
                 } else {
                     developmentsList = [];
                 }
                 
                 console.log('Loaded developments:', developmentsList ? developmentsList.length : 0);
             } catch (error) {
                 console.error('Error loading developments:', error);
                 developmentsList = [];
             }
         }

         // Load available zones (full list, once)
         async function loadZonesList() {
             try {
                 const response = await fetch(`${API_BASE}/zones`);
                 if (!response.ok) {
                     throw new Error(`Failed to load zones: ${response.status}`);
                 }
                 const result = await response.json();

                 if (result && result.success && Array.isArray(result.data)) {
                     zonesList = result.data.map(r => {
                         const name = r.zone_name || r.name || r.Zone;
                         return { zone_name: String(name || '').trim() };
                     }).filter(r => r.zone_name.length > 0);
                 } else if (Array.isArray(result)) {
                     zonesList = result.map(v => ({ zone_name: String(v || '').trim() }))
                                       .filter(r => r.zone_name.length > 0);
                 } else {
                     zonesList = [];
                 }

                 console.log('Loaded zones:', zonesList ? zonesList.length : 0);
             } catch (error) {
                 console.error('Error loading zones:', error);
                 zonesList = [];
             }
         }

         // Create Development/Zone toggle UI
         function createSelectionModeToggle() {
             const controls = document.getElementById('dev-controls-section');
             const container = document.getElementById('development-selections');
             if (!controls && !container) return;

             // Avoid duplicate creation
             if (document.getElementById('selection-mode-toggle')) return;

             const host = controls || container.parentElement;
             const toggleWrap = document.createElement('div');
             toggleWrap.id = 'selection-mode-toggle';
             toggleWrap.style.display = 'flex';
             toggleWrap.style.alignItems = 'center';
             toggleWrap.style.gap = '10px';
             toggleWrap.style.marginBottom = '12px';

             const label = document.createElement('div');
             label.textContent = 'Compare by:';
             label.style.fontWeight = '600';

             const btnGroup = document.createElement('div');
             btnGroup.style.display = 'inline-flex';
             btnGroup.style.border = '1px solid #ced4da';
             btnGroup.style.borderRadius = '6px';
             btnGroup.style.overflow = 'hidden';

             function makeButton(text, mode) {
                 const btn = document.createElement('button');
                 btn.type = 'button';
                 btn.textContent = text;
                 btn.style.padding = '6px 10px';
                 btn.style.fontSize = '12px';
                 btn.style.border = 'none';
                 btn.style.cursor = 'pointer';
                 btn.style.background = (selectionMode === mode) ? '#0d6efd' : '#ffffff';
                 btn.style.color = (selectionMode === mode) ? '#ffffff' : '#333333';
                 btn.addEventListener('click', async () => {
                     if (selectionMode === mode) return;
                     // Capture current UI selections into the correct persisted list BEFORE switching mode
                     try { persistCurrentModeSelections(); } catch (e) { console.warn('persistCurrentModeSelections failed:', e); }
                     selectionMode = mode;
                     // Update visual state
                     devBtn.style.background = (selectionMode === 'development') ? '#0d6efd' : '#ffffff';
                     devBtn.style.color = (selectionMode === 'development') ? '#ffffff' : '#333333';
                     zoneBtn.style.background = (selectionMode === 'zone') ? '#0d6efd' : '#ffffff';
                     zoneBtn.style.color = (selectionMode === 'zone') ? '#ffffff' : '#333333';

                     // Ensure data is loaded
                     if (selectionMode === 'zone' && zonesList.length === 0) {
                         await loadZonesList();
                     }

                     // Rebuild UI for current mode without discarding other mode's selections
                     rebuildSelectionsUIForCurrentMode();

                     // Update any static labels/titles to match mode
                     updateDevZoneStaticLabels();
                 });
                 return btn;
             }

             const devBtn = makeButton('Development', 'development');
             const zoneBtn = makeButton('Waterfront Zone', 'zone');

             btnGroup.appendChild(devBtn);
             btnGroup.appendChild(zoneBtn);

             toggleWrap.appendChild(label);
             toggleWrap.appendChild(btnGroup);

             // Insert above the selections container
             if (controls) {
                 controls.insertBefore(toggleWrap, controls.firstChild);
             } else if (container && container.parentElement) {
                 container.parentElement.insertBefore(toggleWrap, container);
             }
         }

         // Read current dropdown selections from the UI
         function readCurrentSelectionsFromUI() {
             const values = [];
             for (let i = 1; i <= developmentSelectionCount; i++) {
                 const sel = document.getElementById(`development-select-${i}`);
                 if (sel && sel.value) values.push(sel.value);
             }
             return values;
         }

         // Persist the currently displayed tab's selections (development or zone) into the corresponding list
         function persistCurrentModeSelections() {
             const values = readCurrentSelectionsFromUI();
             if (selectionMode === 'development') {
                 window.selectedDevelopments = values.slice();
             } else {
                 window.selectedZones = values.slice();
             }
         }

         // Update static labels and button text between Development and Waterfront Zone
         function updateDevZoneStaticLabels() {
             const noun = (selectionMode === 'development') ? 'Development' : 'Waterfront Zone';
             const nounPlural = (selectionMode === 'development') ? 'developments' : 'waterfront zones';

             const compTitle = document.getElementById('dev-comp-title');
             if (compTitle) compTitle.textContent = `${noun} Comparison Analysis`;

             const controlsTitle = document.getElementById('dev-controls-title');
             if (controlsTitle) controlsTitle.textContent = `${noun} Comparison Analysis`;

             const addBtn = document.getElementById('add-development-btn');
             if (addBtn) addBtn.textContent = `Add ${noun}`;

             const removeBtn = document.getElementById('remove-development-btn');
             if (removeBtn) removeBtn.textContent = `Remove ${noun}`;

             const chartHeaderTitle = document.getElementById('dev-chart-title');
             if (chartHeaderTitle) chartHeaderTitle.textContent = `${noun} Sales Comparison`;

             const chartHeaderSubtitle = document.getElementById('dev-chart-subtitle');
             if (chartHeaderSubtitle) chartHeaderSubtitle.textContent = `Comparative analysis of sales volume and pricing across selected ${nounPlural}`;

             const loadingText = document.getElementById('dev-chart-loading-text');
             if (loadingText) loadingText.textContent = `Generating ${noun.toLowerCase()} comparison analysis...`;
         }

         // Populate initial development dropdowns
         function populateInitialDevelopmentDropdowns() {
             // Create the first development selection
             const container = document.getElementById('development-selections');
             if (container) {
                 const selectionDiv = document.createElement('div');
                 selectionDiv.className = 'location-selection';
                 selectionDiv.id = `development-selection-1`;
                 
                 selectionDiv.innerHTML = `
                     <div class="location-row">
                         <div class="location-field">
                             <label for="development-select-1">${selectionMode === 'development' ? 'Development' : 'Waterfront Zone'} 1</label>
                             <select id="development-select-1" class="fred-select">
                                 <option value="">Select ${selectionMode === 'development' ? 'Development' : 'Waterfront Zone'}...</option>
                             </select>
                         </div>
                     </div>
                 `;
                 
                 container.appendChild(selectionDiv);
                 
                 // Populate the dropdown only if list is ready; otherwise defer
                 const selectEl = document.getElementById('development-select-1');
                 if (selectEl) {
                     const ready = (selectionMode === 'development') ? ((developmentsList||[]).length > 0)
                                                                   : ((zonesList||[]).length > 0);
                     const ensure = () => populateDevelopmentDropdown(selectEl);
                     if (ready) {
                         ensure();
                     } else {
                         let retries = 0;
                         const waitAndPopulate = () => {
                             const nowReady = (selectionMode === 'development') ? ((developmentsList||[]).length > 0)
                                                                             : ((zonesList||[]).length > 0);
                             if (nowReady) {
                                 ensure();
                             } else if (retries < 50) {
                                 retries += 1;
                                 setTimeout(waitAndPopulate, 100);
                             }
                         };
                         setTimeout(waitAndPopulate, 100);
                     }
                 }
             }
         }

         // Populate a single development dropdown (chunked to avoid blocking the UI)
         function populateDevelopmentDropdown(selectElement) {
             const t0 = performance.now();
             if (selectElement.__populating) {
                 // Skip if a population cycle is already in progress for this select
                 console.log('populateDevelopmentDropdown skipped: already populating');
                 return;
             }
             selectElement.__populating = true;
             if (!selectElement) return;

             // Clear existing options and add placeholder
             selectElement.innerHTML = `<option value="">Select ${selectionMode === 'development' ? 'Development' : 'Waterfront Zone'}...</option>`;

             let list;
             if (selectionMode === 'development') {
                 list = (developmentsList || []).map(r => r.development_name);
             } else {
                 list = (zonesList || []).map(r => r.zone_name);
             }
             if (!list || !Array.isArray(list) || list.length === 0) {
                 console.warn('No options available to populate dropdown for mode:', selectionMode);
                 return;
             }

             const CHUNK_SIZE = 100; // smaller chunks for smoother rendering
             let index = 0;

             function addChunk() {
                 const frag = document.createDocumentFragment();
                 const upper = Math.min(index + CHUNK_SIZE, list.length);
                 for (let i = index; i < upper; i++) {
                     const name = list[i];
                     if (!name) continue;
                     const opt = document.createElement('option');
                     opt.value = name;
                     opt.textContent = name;
                     frag.appendChild(opt);
                 }
                 selectElement.appendChild(frag);
                 index = upper;

                 if (index < list.length) {
                     // Yield to the browser to keep UI responsive
                     requestAnimationFrame(addChunk);
                 } else {
                     const t1 = performance.now();
                     console.log('populateDevelopmentDropdown options:', list.length, 'ms:', Math.round(t1 - t0));
                     // Finalize: apply any preselect value if provided
                     const desired = selectElement.dataset && selectElement.dataset.preselect ? String(selectElement.dataset.preselect) : '';
                     if (desired) {
                         for (let j = 0; j < selectElement.options.length; j++) {
                             if (selectElement.options[j].value === desired) {
                                 selectElement.selectedIndex = j;
                                 break;
                             }
                         }
                     }
                     // Mark as done to prevent re-entry
                     selectElement.__populating = false;
                 }
             }

             // Kick off chunked population
             addChunk();
         }
        // Auto-select the development from the report's property address
        function autoSelectReportDevelopment() {
            try {
                // Get the current report's development name
                const reportData = getCurrentReportData();
                if (!reportData || !reportData.development) {
                    console.log('No development found in report data for auto-selection');
                    return;
                }

                const reportDevelopment = reportData.development.trim();
                console.log('Attempting to auto-select development:', reportDevelopment);

                // Find the first development dropdown
                const firstDropdown = document.getElementById('development-select-1');
                if (!firstDropdown) {
                    console.warn('First development dropdown not found');
                    return;
                }

                // Look for exact match or partial match
                let matchFound = false;
                for (let i = 0; i < firstDropdown.options.length; i++) {
                    const option = firstDropdown.options[i];
                    if (option.value === reportDevelopment) {
                        // Exact match
                        firstDropdown.selectedIndex = i;
                        matchFound = true;
                        console.log('Exact match found and selected:', reportDevelopment);
                        break;
                    }
                }

                // If no exact match, try partial match
                if (!matchFound) {
                    for (let i = 0; i < firstDropdown.options.length; i++) {
                        const option = firstDropdown.options[i];
                        if (option.value && (
                            option.value.toLowerCase().includes(reportDevelopment.toLowerCase()) ||
                            reportDevelopment.toLowerCase().includes(option.value.toLowerCase())
                        )) {
                            firstDropdown.selectedIndex = i;
                            matchFound = true;
                            console.log('Partial match found and selected:', option.value, 'for report development:', reportDevelopment);
                            break;
                        }
                    }
                }

                if (!matchFound) {
                    console.log('No matching development found in dropdown for:', reportDevelopment);
                }

            } catch (error) {
                console.error('Error auto-selecting report development:', error);
            }
        }

        // Setup event handlers for development comparison
        function setupDevelopmentComparisonEventHandlers() {
            // Add development button
            const addDevelopmentBtn = document.getElementById('add-development-btn');
            if (addDevelopmentBtn) {
                addDevelopmentBtn.addEventListener('click', addDevelopmentSelection);
            }

            // Remove development button
            const removeDevelopmentBtn = document.getElementById('remove-development-btn');
            if (removeDevelopmentBtn) {
                removeDevelopmentBtn.addEventListener('click', () => {
                    // Remove the last development selection
                    const container = document.getElementById('development-selections');
                    if (container && container.children.length > 1) {
                        const lastChild = container.lastElementChild;
                        lastChild.remove();
                        updateDevelopmentButtons();
                    }
                });
            }

            // Reset button
            const resetDevelopmentBtn = document.getElementById('reset-development-comparison-btn');
            if (resetDevelopmentBtn) {
                resetDevelopmentBtn.addEventListener('click', resetDevelopmentComparison);
            }

            // Generate comparison button
            const generateDevelopmentBtn = document.getElementById('compare-developments-btn');
            if (generateDevelopmentBtn) {
                generateDevelopmentBtn.addEventListener('click', generateDevelopmentComparison);
            }

            // Back to controls button
            const backToDevControlsBtn = document.getElementById('back-to-dev-controls-btn');
            if (backToDevControlsBtn) {
                backToDevControlsBtn.addEventListener('click', showDevelopmentControlsView);
            }

            // Handle chart type dropdown changes
            const chartTypeSelect = document.getElementById('development-chart-type-select');
            if (chartTypeSelect) {
                chartTypeSelect.addEventListener('change', (e) => switchDevelopmentChart(e.target.value));
            }
        }

        // Add new development selection
        function addDevelopmentSelection() {
            developmentSelectionCount++;
            const container = document.getElementById('development-selections');
            
            const selectionDiv = document.createElement('div');
            selectionDiv.className = 'location-selection';
            selectionDiv.id = `development-selection-${developmentSelectionCount}`;
            
            selectionDiv.innerHTML = `
                <div class="location-row">
                    <div class="location-field">
                        <label for="development-select-${developmentSelectionCount}">${selectionMode === 'development' ? 'Development' : 'Waterfront Zone'} ${developmentSelectionCount}</label>
                        <select id="development-select-${developmentSelectionCount}" class="fred-select">
                            <option value="">Select ${selectionMode === 'development' ? 'Development' : 'Waterfront Zone'}...</option>
                        </select>
                    </div>
                    <button type="button" id="remove-development-btn-${developmentSelectionCount}" class="remove-location-btn" style="margin-left: 10px;">
                        Remove
                    </button>
                </div>
            `;
            
            container.appendChild(selectionDiv);
            const removeBtn = document.getElementById(`remove-development-btn-${developmentSelectionCount}`);
            if (removeBtn) {
                const currentId = developmentSelectionCount;
                removeBtn.addEventListener('click', () => removeDevelopmentSelection(currentId));
            }
            
            // Populate the new dropdown without blocking; defer if list not ready
            const newSelect = document.getElementById(`development-select-${developmentSelectionCount}`);
            if (newSelect) {
                if (developmentsList && developmentsList.length > 0) {
                    setTimeout(() => populateDevelopmentDropdown(newSelect), 0);
                } else {
                    let retries = 0;
                    const waitAndPopulateNew = () => {
                        if (developmentsList && developmentsList.length > 0) {
                            populateDevelopmentDropdown(newSelect);
                        } else if (retries < 50) {
                            retries += 1;
                            setTimeout(waitAndPopulateNew, 100);
                        }
                    };
                    setTimeout(waitAndPopulateNew, 100);
                }
            }
            
            // Update button visibility
            updateDevelopmentButtons();
        }

        // Render a development selection at a specific index WITHOUT incrementing global count
        function renderDevelopmentSelectionAt(index, preselectName) {
            const container = document.getElementById('development-selections');
            if (!container) return;

            // If already exists, skip
            if (document.getElementById(`development-selection-${index}`)) return;

            const selectionDiv = document.createElement('div');
            selectionDiv.className = 'location-selection';
            selectionDiv.id = `development-selection-${index}`;

            selectionDiv.innerHTML = `
                <div class="location-row">
                    <div class="location-field">
                        <label for="development-select-${index}">${selectionMode === 'development' ? 'Development' : 'Waterfront Zone'} ${index}</label>
                        <select id="development-select-${index}" class="fred-select">
                            <option value="">Select ${selectionMode === 'development' ? 'Development' : 'Waterfront Zone'}...</option>
                        </select>
                    </div>
                </div>
            `;

            container.appendChild(selectionDiv);

            const selectEl = document.getElementById(`development-select-${index}`);
            if (selectEl) {
                if (preselectName) selectEl.dataset.preselect = String(preselectName);
                // Populate list based on current mode; use zones list for zone mode
                const ready = (selectionMode === 'development') ? (developmentsList && developmentsList.length > 0)
                                                               : (zonesList && zonesList.length > 0);
                const ensurePopulate = () => populateDevelopmentDropdown(selectEl);
                if (ready) {
                    setTimeout(ensurePopulate, 0);
                } else {
                    let retries = 0;
                    const waitAndPopulate = () => {
                        const nowReady = (selectionMode === 'development') ? (developmentsList && developmentsList.length > 0)
                                                                          : (zonesList && zonesList.length > 0);
                        if (nowReady) {
                            ensurePopulate();
                        } else if (retries < 50) {
                            retries += 1;
                            setTimeout(waitAndPopulate, 100);
                        }
                    };
                    setTimeout(waitAndPopulate, 100);
                }
            }
        }

        // Remove development selection
        function removeDevelopmentSelection(selectionId) {
            const selectionDiv = document.getElementById(`development-selection-${selectionId}`);
            if (selectionDiv) {
                selectionDiv.remove();
            }
            
            // Update button visibility
            updateDevelopmentButtons();
        }

        // Update development button visibility
        function updateDevelopmentButtons() {
            const addBtn = document.getElementById('add-development-btn');
            const removeBtn = document.getElementById('remove-development-btn');
            const container = document.getElementById('development-selections');
            const currentSelections = container ? container.children.length : 0;
            
            if (addBtn) {
                addBtn.style.display = currentSelections >= 10 ? 'none' : 'inline-block';
            }
            if (removeBtn) {
                removeBtn.style.display = currentSelections <= 1 ? 'none' : 'inline-block';
            }
        }
        // Rebuild the selections UI to reflect the current mode using persisted lists
        function rebuildSelectionsUIForCurrentMode() {
            const container = document.getElementById('development-selections');
            if (!container) return;
            container.innerHTML = '';

            const list = (selectionMode === 'development') ? (window.selectedDevelopments || []) : (window.selectedZones || []);
            const targetCount = Math.max(1, list.length);
            let i = 1;
            function addNext() {
                if (i <= targetCount) {
                    const pre = list[i - 1] || '';
                    renderDevelopmentSelectionAt(i, pre);
                    i += 1;
                    requestAnimationFrame(addNext);
                } else {
                    developmentSelectionCount = targetCount;
                    updateDevelopmentButtons();
                }
            }
            requestAnimationFrame(addNext);
        }

        // Reset development comparison to default
        function resetDevelopmentComparison() {
            developmentSelectionCount = 1;
            const container = document.getElementById('development-selections');
            
            // Clear all selections
            if (container) {
                container.innerHTML = '';
            }
            
            // Recreate the first selection
            populateInitialDevelopmentDropdowns();
            updateDevelopmentButtons();

            // Also update static labels to current mode
            updateDevZoneStaticLabels();
            
            // Clear any existing chart and hide chart view
            if (window.developmentChart) {
                window.developmentChart.destroy();
                window.developmentChart = null;
            }
            
            // Clear stored data
            window.developmentComparisonData = null;
            window.selectedDevelopments = null;
            
            // Hide chart elements
            const chartControls = document.getElementById('development-chart-controls');
            if (chartControls) chartControls.style.display = 'none';
            
            const chartHeader = document.getElementById('dev-comparison-chart-header');
            if (chartHeader) chartHeader.style.display = 'none';
            
            // Show controls view
            showDevelopmentControlsView();
        }

        // Generate development comparison
        async function generateDevelopmentComparison() {
            // Collect current-mode selections
            const selections = [];
            let hasValidSelections = false;
            
            for (let i = 1; i <= developmentSelectionCount; i++) {
                const developmentSelect = document.getElementById(`development-select-${i}`);
                
                if (developmentSelect && developmentSelect.value) {
                    selections.push(developmentSelect.value);
                    hasValidSelections = true;
                }
            }
            
            if (!hasValidSelections) {
                alert(`Please select at least one ${selectionMode === 'development' ? 'development' : 'zone'} to compare`);
                return;
            }
            
            // Show loading state
            const loadingDiv = document.getElementById('dev-chart-loading');
            const errorDiv = document.getElementById('dev-chart-error');
            const chartContainer = document.getElementById('dev-comparison-chart');
            
            if (loadingDiv) loadingDiv.style.display = 'flex';
            if (errorDiv) errorDiv.style.display = 'none';
            if (chartContainer) chartContainer.innerHTML = '';
            
            try {
                // Persist the currently displayed tab's selections
                persistCurrentModeSelections();
                // Combine both sets to render a single chart (distinct lists). Do not coerce types.
                const devs = Array.isArray(window.selectedDevelopments) ? window.selectedDevelopments.slice() : [];
                const zones = Array.isArray(window.selectedZones) ? window.selectedZones.slice() : [];

                // Build label mapping to disambiguate identical names across types
                const devSetLower = new Set(devs.map(n => String(n).toLowerCase()));
                const overlapLower = new Set(zones.map(n => String(n).toLowerCase()).filter(n => devSetLower.has(n)));
                const entityLabelMap = {}; // label -> { name, type }
                const entityKeyToLabel = {}; // `${type}:${lowerName}` -> label
                const labels = [];
                devs.forEach(name => {
                    const label = String(name);
                    labels.push(label);
                    entityLabelMap[label] = { name: String(name), type: 'development' };
                    entityKeyToLabel[`development:${String(name).toLowerCase()}`] = label;
                });
                zones.forEach(name => {
                    const lower = String(name).toLowerCase();
                    const label = overlapLower.has(lower) ? `${name} (Zone)` : String(name);
                    labels.push(label);
                    entityLabelMap[label] = { name: String(name), type: 'zone' };
                    entityKeyToLabel[`zone:${lower}`] = label;
                });
                window.entityLabelMap = entityLabelMap;
                window.entityKeyToLabel = entityKeyToLabel;

                // Fetch both groups in parallel and tag with sourceType
                const requests = [];
                const requestTypes = [];
                if (devs.length > 0) {
                    requests.push(fetch(`${API_BASE}/developments-comparison?developments=${encodeURIComponent(devs.join(','))}`));
                    requestTypes.push('development');
                }
                if (zones.length > 0) {
                    requests.push(fetch(`${API_BASE}/zones-comparison?zones=${encodeURIComponent(zones.join(','))}`));
                    requestTypes.push('zone');
                }
                const responses = await Promise.all(requests);
                const jsons = await Promise.all(responses.map(r => r.ok ? r.json() : Promise.resolve(null)));
                let merged = [];
                jsons.forEach((j, idx) => {
                    if (!j || !j.success) return;
                    const srcType = requestTypes[idx] || 'development';
                    if (Array.isArray(j.data)) merged.push(...j.data.map(row => ({ ...row, sourceType: srcType })));
                    else if (Array.isArray(j.data?.comparisonData)) merged.push(...j.data.comparisonData.map(row => ({ ...row, sourceType: srcType })));
                });

                // Display merged data; order labels as devs then zones (with suffixes as needed)
                displayDevelopmentComparisonChart(merged, labels);
                
                // Switch to chart view and show chart elements
                showDevelopmentChartView();
                
                // Show chart controls
                const chartControls = document.getElementById('development-chart-controls');
                if (chartControls) {
                    chartControls.style.display = 'block';
                }
                
                // Show chart header
                const chartHeader = document.getElementById('dev-comparison-chart-header');
                if (chartHeader) {
                    chartHeader.style.display = 'block';
                }

                // Non-blocking save to DB (neighbourhood) — persist mixed items (developments + zones)
                try {
                    const slug = (typeof urlSlug !== 'undefined') ? urlSlug : (window.location.pathname.split('/').pop());
                    const seriesIdToSave = (typeof currentDevelopmentChart === 'string' && currentDevelopmentChart) ? currentDevelopmentChart : 'sales';
                    const items = [
                        ...devs.map(name => ({ name, type: 'development' })),
                        ...zones.map(name => ({ name, type: 'zone' }))
                    ];
                    await fetch(`${API_BASE}/reports/${slug}/neighbourhood-comparison`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ series_id: seriesIdToSave, items })
                    });
                } catch (persistErr) {
                    console.warn('Neighbourhood save failed:', persistErr);
                }
                
            } catch (error) {
                console.error('Error generating development comparison:', error);
                if (errorDiv) {
                    errorDiv.style.display = 'block';
                    errorDiv.innerHTML = `
                        <p>Failed to generate comparison chart</p>
                        <p class="error-details">${error.message}</p>
                    `;
                }
            } finally {
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
        }

        // Global variable to store chart data
        let developmentChartData = null;
        let currentDevelopmentChart = 'sales';

        // Display development comparison chart
        function displayDevelopmentComparisonChart(data, developments) {
            console.log('displayDevelopmentComparisonChart called with:', { data, developments });
            // Process rows by type-aware label so dev and zone with same name remain separate
            const keyToLabel = (typeof window.entityKeyToLabel === 'object') ? window.entityKeyToLabel : {};
            const processedByLabel = {};

            data.forEach(row => {
                const baseName = row.development_name || row.zone_name || row.name;
                const lower = String(baseName || '').toLowerCase();
                // Enhanced type detection: prefer explicit sourceType, then explicit fields, then known name sets
                const knownDev = (window.knownDevNamesLower && typeof window.knownDevNamesLower.has === 'function') ? window.knownDevNamesLower.has(lower) : false;
                const knownZone = (window.knownZoneNamesLower && typeof window.knownZoneNamesLower.has === 'function') ? window.knownZoneNamesLower.has(lower) : false;
                const sourceType = (typeof row.sourceType === 'string') ? row.sourceType : null;
                const isZone = (sourceType === 'zone') || (!!row.zone_name && (!row.development_name || row.development_name.length === 0)) || (knownZone && !knownDev);
                const key = `${isZone ? 'zone' : 'development'}:${lower}`;
                const label = keyToLabel[key] || (isZone ? `${baseName} (Zone)` : String(baseName));
                const year = row.sale_year || row.year;

                if (!processedByLabel[label]) {
                    processedByLabel[label] = {};
                }

                const avgPrice = parseFloat(row.avg_price ?? row.average_price) || 0;
                const avgSqft = parseFloat(row.avg_sqft ?? row.average_sqft) || 0;
                const pricePerSqft = avgSqft > 0 ? avgPrice / avgSqft : 0;

                processedByLabel[label][year] = {
                    sales_count: parseInt(row.sales_count) || 0,
                    avg_price: avgPrice,
                    avg_price_per_sqft: pricePerSqft
                };
            });

            console.log('Processed data (by label):', Object.keys(processedByLabel));

            // Store processed data globally (do not mutate persisted selections here)
            window.developmentComparisonData = processedByLabel;
            // Track the exact entities (developments and/or zones) used for this chart render
            try { window.comparisonEntities = Array.isArray(developments) ? developments.slice() : []; } catch {}
            
            // Check if we have any price per sqft data available
            let hasPricePerSqftData = false;
            Object.values(processedByLabel).forEach(devData => {
                Object.values(devData).forEach(yearData => {
                    if (yearData.avg_price_per_sqft > 0) {
                        hasPricePerSqftData = true;
                    }
                });
            });
            
            // Store data availability for UI decisions
            window.hasPricePerSqftData = hasPricePerSqftData;
            
            // Update dropdown options based on data availability
            updateChartTypeDropdown();
            
            // Display initial chart (sales)
            console.log('About to call renderDevelopmentChart');
            renderDevelopmentChart('sales');
        }

        // Global Chart.js instance
        let developmentChart = null;
        // Render custom two-line HTML legend with ( Map | Stats ) per series
        function renderDevelopmentHtmlLegend() {
            try {
                const legendContainer = document.getElementById('devLegend');
                if (!legendContainer || !developmentChart) return;

                // Clear any existing items
                legendContainer.innerHTML = '';

                const datasets = developmentChart.data && developmentChart.data.datasets
                    ? developmentChart.data.datasets
                    : [];

                datasets.forEach((dataset, index) => {
                    const item = document.createElement('div');
                    item.className = 'legend-item';

                    // Row 1: dot + name (click toggles visibility)
                    const nameRow = document.createElement('div');
                    nameRow.className = 'legend-name';

                    const dot = document.createElement('span');
                    dot.className = 'legend-dot';
                    dot.style.backgroundColor = dataset.borderColor || '#3498db';

                    const nameText = document.createElement('span');
                    nameText.textContent = dataset.label || `Series ${index + 1}`;

                    nameRow.appendChild(dot);
                    nameRow.appendChild(nameText);

                    nameRow.addEventListener('click', () => {
                        const currentlyVisible = developmentChart.isDatasetVisible(index);
                        developmentChart.setDatasetVisibility(index, !currentlyVisible);
                        developmentChart.update();
                        renderDevelopmentHtmlLegend();
                    });

                    // Apply hidden styling
                    if (!developmentChart.isDatasetVisible(index)) {
                        nameRow.style.opacity = '0.5';
                        nameRow.style.textDecoration = 'line-through';
                    }

                    // Row 2: ( Map | Stats ) actions
                    const actionsRow = document.createElement('div');
                    actionsRow.className = 'legend-actions';

                    const openParen = document.createTextNode('( ');
                    const pipeText = document.createTextNode(' | ');
                    const closeParen = document.createTextNode(' )');

                    const mapLink = document.createElement('a');
                    mapLink.href = '#';
                    mapLink.textContent = 'Map';
                    mapLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        const label = dataset.label || '';
                        if (label) {
                            const entity = (window.entityLabelMap && window.entityLabelMap[label]) || { name: label, type: (Array.isArray(window.selectedZones) && window.selectedZones.includes(label)) ? 'zone' : 'development' };
                            openDevelopmentMapForName(entity.name, entity.type);
                        }
                    });

                    const statsLink = document.createElement('a');
                    statsLink.href = '#';
                    statsLink.textContent = 'Stats';
                    statsLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        const label = dataset.label || '';
                        if (label) {
                            const entity = (window.entityLabelMap && window.entityLabelMap[label]) || { name: label, type: (Array.isArray(window.selectedZones) && window.selectedZones.includes(label)) ? 'zone' : 'development' };
                            showChartOverlay(entity.name, entity.type);
                        }
                    });

                    actionsRow.appendChild(openParen);
                    actionsRow.appendChild(mapLink);
                    actionsRow.appendChild(pipeText);
                    actionsRow.appendChild(statsLink);
                    actionsRow.appendChild(closeParen);

                    item.appendChild(nameRow);
                    item.appendChild(actionsRow);

                    legendContainer.appendChild(item);
                });
            } catch (legendErr) {
                console.warn('Failed to render custom development legend:', legendErr);
            }
        }

        // Render development chart based on type using Chart.js
                function renderDevelopmentChart(chartType, chartMetaOverride) {
            console.log('renderDevelopmentChart called with chartType:', chartType);
            const chartCanvas = document.getElementById('dev-comparison-chart');
            console.log('Chart canvas found:', !!chartCanvas);
            console.log('Development comparison data exists:', !!window.developmentComparisonData);
            
            if (!chartCanvas || !window.developmentComparisonData) {
                console.log('Early return - missing canvas or data');
                return;
            }
            
            const data = window.developmentComparisonData;
            const labelToEntity = (typeof window.entityLabelMap === 'object') ? window.entityLabelMap : {};
            const developments = Array.isArray(window.comparisonEntities) && window.comparisonEntities.length > 0
                ? window.comparisonEntities
                : (Array.isArray(window.selectedDevelopments) ? window.selectedDevelopments : []);
            console.log('About to process chart with data:', data, 'entities:', developments);
            
            const chartMeta = chartMetaOverride || DEVELOPMENT_CHART_TYPES[chartType] || DEVELOPMENT_CHART_TYPES.sales;
            const dataKey = chartMeta.dataKey || 'sales_count';
            const chartTitleLabel = chartMeta.title || 'Sales Count';
            const isYoYChart = !!chartMeta.yoy;
            
            const allYears = new Set();
            Object.values(data).forEach(devData => {
                Object.keys(devData).forEach(year => allYears.add(parseInt(year)));
            });
            const years = Array.from(allYears).sort((a, b) => a - b);
            console.log('Years found:', years);
            
            if (developmentChart) {
                developmentChart.destroy();
            }
            
            const datasets = developments.map((label, index) => {
                const entity = labelToEntity[label] || { name: label, type: 'development' };
                const dataKeyForEntity = data[label] || data[entity.name] || {};
                let developmentData = years.map(year => {
                    const yearData = dataKeyForEntity[year] ? dataKeyForEntity[year][dataKey] : null;
                    if (yearData == null || yearData === 0 || isNaN(yearData)) return null;
                    return yearData;
                });
                
                if (isYoYChart) {
                    let lastValue = null;
                    let hasAnchor = false;
                    developmentData = developmentData.map(value => {
                        if (!Number.isFinite(value)) {
                            return hasAnchor ? null : null;
                        }
                        if (!hasAnchor) {
                            hasAnchor = true;
                            lastValue = value;
                            return 0;
                        }
                        if (!Number.isFinite(lastValue) || lastValue === 0) {
                            lastValue = value;
                            return null;
                        }
                        const change = ((value - lastValue) / lastValue) * 100;
                        lastValue = value;
                        return Number.isFinite(change) ? Number(change.toFixed(chartMeta.decimals ?? 1)) : null;
                    });
                }
                
                const colors = [
                    '#3498db',
                    '#e74c3c',
                    '#2ecc71',
                    '#f39c12',
                    '#9b59b6',
                    '#1abc9c',
                    '#34495e',
                    '#e67e22',
                    '#95a5a6',
                    '#8e44ad'
                ];
                
                return {
                    label,
                    data: developmentData,
                    backgroundColor: colors[index % colors.length] + '20',
                    borderColor: colors[index % colors.length],
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: colors[index % colors.length],
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: (window.innerWidth <= 768 ? 0 : 5),
                    pointHoverRadius: (window.innerWidth <= 768 ? 0 : 7),
                    pointHoverBackgroundColor: colors[index % colors.length],
                    pointHoverBorderColor: '#ffffff',
                    clip: 0
                };
            });
            
            const flatValues = datasets.flatMap(ds => (ds.data || []).filter(v => v != null && !isNaN(v)));
            const yMin = flatValues.length ? Math.min(...flatValues) : 0;
            const yMax = flatValues.length ? Math.max(...flatValues) : 1;
            const yPad = (yMax - yMin) * 0.08;
            const allowNegative = chartMeta.valueType === 'percent';
            const suggestedMin = allowNegative ? (yMin - yPad) : Math.max(0, yMin - yPad);
            const suggestedMax = yMax + yPad * 0.5;

            const config = {
                type: 'line',
                data: {
                    labels: years,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    elements: {
                        point: {
                            radius: (window.innerWidth <= 768 ? 0 : 3),
                            hitRadius: (window.innerWidth <= 768 ? 4 : 6),
                            hoverRadius: (window.innerWidth <= 768 ? 0 : 4)
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: `${selectionMode === 'development' ? 'Development' : 'Waterfront Zone'} Trends - ${chartTitleLabel}`,
                            font: {
                                size: 16,
                                weight: 'bold'
                            }
                        },
                        legend: { display: false },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: '#ffffff',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    return `${context.dataset.label}: ${formatMetricValue(context.parsed.y, chartMeta)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            offset: true,
                            title: {
                                display: true,
                                text: 'Year'
                            },
                            grid: {
                                display: true,
                                color: '#f0f0f0',
                                borderDash: [2, 2]
                            }
                        },
                        y: Object.assign({
                            grid: {
                                display: true,
                                color: '#f0f0f0'
                            },
                            ticks: {
                                color: '#666',
                                font: {
                                    size: 11
                                },
                                callback: function(value) {
                                    return formatMetricValue(value, chartMeta);
                                }
                            }
                        }, computeYAxisConfig(chartMeta, datasets))
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    },
                    animation: {
                        duration: 1000,
                        easing: 'easeInOutQuart'
                    }
                }
            };
            
            config.options.scales.y.suggestedMin = suggestedMin;
            config.options.scales.y.suggestedMax = suggestedMax;
            
            const ctx = chartCanvas.getContext('2d');
            developmentChart = new Chart(ctx, config);

            renderDevelopmentHtmlLegend();
            
            console.log('Chart.js chart created successfully');
        }
        // Show the development actions popup
        function showDevelopmentActionsPopup(event, developmentName) {
            console.log('showDevelopmentActionsPopup called:', { event, developmentName });
            
            // Remove the link emoji from the development name if it exists
            const cleanDevelopmentName = String(developmentName || '').replace(/^🔗\s*/, '').trim();
            console.log('Clean development name:', cleanDevelopmentName);
            
            const popup = document.getElementById('developmentActionsPopup');
            const title = document.getElementById('developmentPopupTitle');
            const mapBtn = document.getElementById('developmentPopupMapBtn');
            const chartBtn = document.getElementById('developmentPopupChartBtn');
            
            console.log('Popup elements found:', { popup: !!popup, title: !!title, mapBtn: !!mapBtn, chartBtn: !!chartBtn });
            
            if (!popup || !title || !mapBtn || !chartBtn) {
                console.error('Missing popup elements');
                return;
            }
            
            // Set the development name
            title.textContent = cleanDevelopmentName;

            // Always show Map button (works for Development and Zone)
            try {
                mapBtn.style.display = 'flex';
            } catch (err) {
                console.warn('Error adjusting Map button visibility:', err);
            }
            
            // Position the popup near the mouse click (use clientX/Y for fixed positioning)
            let x = (typeof event.clientX === 'number' ? event.clientX : (typeof event.pageX === 'number' ? (event.pageX - window.pageXOffset) : (window.__lastMouse ? window.__lastMouse.x : 200))) + 10; // Default to 200 if no coordinates
            let y = (typeof event.clientY === 'number' ? event.clientY : (typeof event.pageY === 'number' ? (event.pageY - window.pageYOffset) : (window.__lastMouse ? window.__lastMouse.y : 200))) - 50; // Default to 200 if no coordinates
            
            // For debugging: always show at a visible location
            if (x < 50 || y < 50) {
                console.log('Using fallback position due to invalid coordinates');
                x = 200;
                y = 200;
            }
            
            // Ensure popup stays within viewport boundaries
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const popupWidth = 180; // Approximate popup width
            const popupHeight = 120; // Approximate popup height
            
            if (x + popupWidth > viewportWidth) {
                x = viewportWidth - popupWidth - 10;
            }
            if (y < 0) {
                y = 10;
            }
            if (y + popupHeight > viewportHeight) {
                y = viewportHeight - popupHeight - 10;
            }
            
            console.log('Final popup position:', { x, y });
            
            popup.style.left = Math.round(x) + 'px';
            popup.style.top = Math.round(y) + 'px';
            popup.style.display = 'block';
            popup.style.position = 'fixed';
            popup.style.zIndex = '9999';
            
            console.log('Popup should now be visible at:', popup.style.left, popup.style.top);
            
            // Debug: Check computed styles
            const computedStyle = window.getComputedStyle(popup);
            console.log('Popup computed styles:', {
                display: computedStyle.display,
                position: computedStyle.position,
                zIndex: computedStyle.zIndex,
                left: computedStyle.left,
                top: computedStyle.top,
                visibility: computedStyle.visibility,
                opacity: computedStyle.opacity
            });
            
            // Debug: Check if popup is actually in the DOM
            console.log('Popup in DOM:', document.contains(popup));
            console.log('Popup dimensions:', {
                offsetWidth: popup.offsetWidth,
                offsetHeight: popup.offsetHeight,
                clientWidth: popup.clientWidth,
                clientHeight: popup.clientHeight
            });
            
            // Add event listeners for the buttons
            mapBtn.onclick = function() {
                hideDevelopmentActionsPopup();
                openDevelopmentMapForName(cleanDevelopmentName);
            };
            
            chartBtn.onclick = function() {
                hideDevelopmentActionsPopup();
                showChartOverlay(cleanDevelopmentName);
            };
            
            // Add hover effects
            [mapBtn, chartBtn].forEach(btn => {
                btn.onmouseenter = function() {
                    this.style.backgroundColor = '#f8f9fa';
                    this.style.transform = 'translateY(-1px)';
                };
                
                btn.onmouseleave = function() {
                    this.style.backgroundColor = '#ffffff';
                    this.style.transform = 'translateY(0)';
                };
            });
        }
        
        // Hide the development actions popup
        function hideDevelopmentActionsPopup() {
            const popup = document.getElementById('developmentActionsPopup');
            popup.style.display = 'none';
        }
        // Open development map for a specific development name
        async function openDevelopmentMapForName(developmentName, typeHint) {
            const modal = document.getElementById('mapModal');
            const loading = document.getElementById('mapLoading');
            const error = document.getElementById('mapError');
            const subtitle = document.getElementById('mapSubtitle');
            const title = document.getElementById('mapTitle');
            const loadingText = document.getElementById('mapLoadingText');
            const errorContext = document.getElementById('mapErrorContext');
            
            if (!developmentName || !developmentName.trim()) {
                showMapError('No development name provided.');
                return;
            }
            
            const cleanDevelopmentName = developmentName.trim();
            const inZoneMode = (typeof typeHint === 'string')
                ? (typeHint === 'zone')
                : (typeof selectionMode !== 'undefined' && selectionMode === 'zone');
            title.textContent = inZoneMode ? 'Waterfront Zone Parcels Map' : 'Development Parcels Map';
            subtitle.textContent = `Showing parcels for ${cleanDevelopmentName}`;
            loadingText.textContent = inZoneMode ? 'Loading waterfront zone parcels...' : 'Loading development parcels...';
            errorContext.textContent = inZoneMode ? 'Could not load parcel data for this waterfront zone.' : 'Could not load parcel data for this development.';
            
            // Show modal and loading state
            modal.style.display = 'block';
            loading.style.display = 'flex';
            error.style.display = 'none';
            
            try {
                // Fetch parcel data
                const url = inZoneMode
                    ? `${API_BASE}/zone-parcels/${encodeURIComponent(cleanDevelopmentName)}`
                    : `${API_BASE}/development-parcels/${encodeURIComponent(cleanDevelopmentName)}`;
                const response = await fetch(url);
                const result = await response.json();
                
                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Failed to load parcel data');
                }
                
                if (!result.data || !result.data.features || result.data.features.length === 0) {
                    throw new Error(inZoneMode ? 'No parcel data found for this zone' : 'No parcel data found for this development');
                }
                
                // Hide loading
                loading.style.display = 'none';
                
                // Initialize or update map with the new development
                currentDevelopmentName = cleanDevelopmentName;
                initializeMap(result.data);
                
            } catch (error) {
                console.error('Error loading development map:', error);
                showMapError(error.message || 'Unable to load map data for this development.');
            }
        }

        // Update chart type dropdown based on data availability
        function updateChartTypeDropdown() {
            const chartTypeSelect = document.getElementById('development-chart-type-select');
            if (!chartTypeSelect) return;
            
            const sqftOptionValues = ['price_per_sqft', 'price_per_sqft_yoy'];
            sqftOptionValues.forEach(value => {
                const optionEl = chartTypeSelect.querySelector(`option[value="${value}"]`);
                if (!optionEl) return;
                if (window.hasPricePerSqftData) {
                    optionEl.disabled = false;
                    optionEl.style.color = '';
                    optionEl.textContent = value === 'price_per_sqft'
                        ? 'Price Per Square Foot'
                        : 'Price Per Square Foot (YoY %)';
                } else {
                    optionEl.disabled = true;
                    optionEl.style.color = '#999';
                    optionEl.textContent = value === 'price_per_sqft'
                        ? 'Price Per Square Foot (No Data Available)'
                        : 'Price Per Square Foot (YoY % - No Data)';
                }
            });
        }

            // Switch between chart types
        function switchDevelopmentChart(chartType) {
            let resolvedType = chartType;
            let chartMeta = DEVELOPMENT_CHART_TYPES[resolvedType] || DEVELOPMENT_CHART_TYPES.sales;
            if (chartMeta.requiresPricePerSqft && !window.hasPricePerSqftData) {
                console.warn('Price per sqft data not available, falling back to sales chart');
                resolvedType = 'sales';
                chartMeta = DEVELOPMENT_CHART_TYPES[resolvedType];
            }
            
            currentDevelopmentChart = resolvedType;
            
            // Update dropdown selection
            const chartTypeSelect = document.getElementById('development-chart-type-select');
            if (chartTypeSelect && chartTypeSelect.value !== resolvedType) {
                chartTypeSelect.value = resolvedType;
            }
            
            // Render the appropriate chart
            renderDevelopmentChart(resolvedType, chartMeta);
            // Update legend for new datasets
            renderDevelopmentHtmlLegend();
        }

        // Show the development controls view and hide the chart view
        function showDevelopmentControlsView() {
            document.getElementById('dev-controls-section').style.display = 'block';
            document.getElementById('dev-chart-section').style.display = 'none';
            // Rebuild strictly from current mode's persisted list to avoid cross-mode pollution
            rebuildSelectionsUIForCurrentMode();
        }
        
        // Show the development chart view and hide the controls view  
        function showDevelopmentChartView() {
            document.getElementById('dev-controls-section').style.display = 'none';
            document.getElementById('dev-chart-section').style.display = 'block';
        }

        // Initialize development comparison when page loads
        document.addEventListener('DOMContentLoaded', function() {
            if (window.isPalmBeachCounty !== false) {
                setTimeout(initializeDevelopmentComparison, 1500);
            }
        });
        // Function to setup chart button click handler (idempotent and re-runnable)
        function setupChartButton(developmentName) {
            const chartButton = document.getElementById('chartButton');
            if (!chartButton) return;
            const hasDev = typeof developmentName === 'string' && developmentName.trim().length > 0;
            if (hasDev) {
                const dev = developmentName.trim();
                // Enable styles
                chartButton.style.opacity = '';
                chartButton.style.cursor = 'pointer';
                chartButton.title = '';
                chartButton.style.backgroundColor = '#ffffff';
                chartButton.style.borderColor = '#dee2e6';
                // Replace handlers idempotently
                chartButton.onclick = function() { showChartOverlay(dev); };
                chartButton.onmouseenter = function() {
                    this.style.backgroundColor = '#f8f9fa';
                    this.style.borderColor = '#27ae60';
                    this.style.transform = 'translateY(-1px)';
                };
                chartButton.onmouseleave = function() {
                    this.style.backgroundColor = '#ffffff';
                    this.style.borderColor = '#dee2e6';
                    this.style.transform = 'translateY(0)';
                };
            } else {
                // Disable and remove handlers
                chartButton.onclick = null;
                chartButton.onmouseenter = null;
                chartButton.onmouseleave = null;
                chartButton.style.opacity = '0.5';
                chartButton.style.cursor = 'not-allowed';
                chartButton.title = 'Chart data not available for this property';
            }
        }
        // Function to show chart overlay
        async function showChartOverlay(entityName, typeHint) {
            const overlay = document.getElementById('chartOverlay');
            const title = document.getElementById('chartOverlayTitle');
            const content = document.getElementById('chartOverlayContent');
            
            // Show overlay
            overlay.style.display = 'flex';
            title.textContent = `${entityName} - Sales Analysis`;
            
            // Show loading state
            content.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto 20px;"></div>
                    <p style="color: #7f8c8d; font-size: 16px;">Loading sales chart data...</p>
                </div>
            `;
            
            try {
                // Fetch chart data (zones currently use same endpoint if supported; adjust if separate)
                // Fetch appropriate chart endpoint based on type
                const endpoint = (typeHint === 'zone')
                    ? `${API_BASE}/zone-chart/${encodeURIComponent(entityName)}`
                    : `${API_BASE}/development-chart/${encodeURIComponent(entityName)}`;
                const response = await fetch(endpoint);
                const result = await response.json();
                
                if (response.ok && result.success) {
                    displayChartData(result.data);
                } else {
                    throw new Error(result.error || 'Failed to load chart data');
                }
            } catch (error) {
                console.error('Error loading chart data:', error);
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <div style="color: #e74c3c; font-size: 48px; margin-bottom: 20px;">📊</div>
                        <h3 style="color: #2c3e50; margin-bottom: 10px;">Chart Data Unavailable</h3>
                        <p style="color: #7f8c8d;">Unable to load sales data for this development.</p>
                    </div>
                `;
            }
        }
        
        // Function to display chart data
        function displayChartData(data) {
            const content = document.getElementById('chartOverlayContent');
            const chartData = data.chartData;
            
            if (!chartData || chartData.length === 0) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <div style="color: #f39c12; font-size: 48px; margin-bottom: 20px;">📈</div>
                        <h3 style="color: #2c3e50; margin-bottom: 10px;">No Sales Data</h3>
                        <p style="color: #7f8c8d;">No recorded sales found for ${data.developmentName} in the last 10 years.</p>
                    </div>
                `;
                return;
            }
            
            // Create chart HTML
            let chartHtml = `
                <div style="margin-bottom: 30px;">
                    <h3 style="text-align: center; color: #2c3e50; margin-bottom: 20px;">Annual Sales Summary - Last 10 Years</h3>
                    <div style="display: flex; gap: 30px;">
                        <!-- Sales Count Chart -->
                        <div style="flex: 1;">
                            <h4 style="text-align: center; color: #34495e; margin-bottom: 15px;">Number of Sales per Year</h4>
                            <div style="height: 300px; position: relative;">
                                <canvas id="salesCountChart" style="width: 100%; height: 100%;"></canvas>
                            </div>
                        </div>
                        
                        <!-- Price Chart -->
                        <div style="flex: 1;">
                            <h4 style="text-align: center; color: #34495e; margin-bottom: 10px; display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <span style="font-weight: 500;">Sale Price per Year</span>
                                <label for="priceMetricSelect" style="font-weight: 500; color: #4b5563; display: flex; align-items: center; gap: 6px;">
                                    <span></span>
                                    <select id="priceMetricSelect" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 15px; color: #1f2937; background: #ffffff; min-width: 160px; cursor: pointer;">
                                    <option value="avg" selected>Average</option>
                                    <option value="median">Median</option>
                                    </select>
                                </label>
                            </h4>
                            <div style="height: 300px; position: relative;">
                                <canvas id="avgPriceChart" style="width: 100%; height: 100%;"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Data Table -->
                <div style="margin-top: 20px;">
                    <h4 style="color: #2c3e50; margin-bottom: 15px;">Detailed Sales Data</h4>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
                            <thead>
                                <tr style="background: #f8f9fa;">
                                    <th style="padding: 12px; text-align: left; border: 1px solid #ddd; color: #2c3e50;">Year</th>
                                    <th style="padding: 12px; text-align: right; border: 1px solid #ddd; color: #2c3e50;">Sales Count</th>
                                    <th style="padding: 12px; text-align: right; border: 1px solid #ddd; color: #2c3e50;">Average Price</th>
                                    <th style="padding: 12px; text-align: right; border: 1px solid #ddd; color: #2c3e50;">Median Price</th>
                                    <th style="padding: 12px; text-align: right; border: 1px solid #ddd; color: #2c3e50;">Price Range</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            // Sort chartData by year in descending order (newest first)
            const sortedChartData = [...chartData].sort((a, b) => parseInt(b.sale_year) - parseInt(a.sale_year));
            
            sortedChartData.forEach(row => {
                const avgPrice = row.avg_price ? `$${parseInt(row.avg_price).toLocaleString()}` : 'N/A';
                const medianPrice = row.median_price ? `$${parseInt(row.median_price).toLocaleString()}` : 'N/A';
                const minPrice = row.min_price ? `$${parseInt(row.min_price).toLocaleString()}` : 'N/A';
                const maxPrice = row.max_price ? `$${parseInt(row.max_price).toLocaleString()}` : 'N/A';
                const priceRange = (row.min_price && row.max_price) ? `${minPrice} - ${maxPrice}` : 'N/A';
                
                chartHtml += `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; font-weight: 500;">${row.sale_year}</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${row.sales_count}</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${avgPrice}</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${medianPrice}</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-size: 12px;">${priceRange}</td>
                    </tr>
                `;
            });
            
            chartHtml += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            content.innerHTML = chartHtml;
            
            // Render Chart.js charts
            const priceMetricOptions = {
                avg: { field: 'avg_price', label: 'Average Sale Price', color: '#27ae60' },
                median: { field: 'median_price', label: 'Median Sale Price', color: '#8e44ad' }
            };

            function renderPriceChart(metricKey) {
                const config = priceMetricOptions[metricKey] || priceMetricOptions.avg;
                renderPopupChart('avgPriceChart', chartData, config.field, config.color, config.label);
            }

            setTimeout(() => {
                renderPopupChart('salesCountChart', chartData, 'sales_count', '#3498db', 'Number of Sales');
                const selectEl = document.getElementById('priceMetricSelect');
                renderPriceChart(selectEl?.value || 'avg');
                if (selectEl) {
                    selectEl.addEventListener('change', (event) => {
                        renderPriceChart(event.target.value);
                    }, { once: false });
                }
            }, 100);
        }
        // Function to render simple bar chart
        function renderBarChart(data, valueField, color, prefix = '') {
            if (!data || data.length === 0) return '<p>No data available</p>';
            
            const maxValue = Math.max(...data.map(d => parseFloat(d[valueField]) || 0));
            const minValue = Math.min(...data.map(d => parseFloat(d[valueField]) || 0));
            
            let chartHtml = `
                <div style="display: flex; align-items: end; height: 100%; gap: 8px; padding: 20px 10px 30px;">
            `;
            
            data.forEach(item => {
                const value = parseFloat(item[valueField]) || 0;
                const height = maxValue > 0 ? (value / maxValue) * 200 : 0;
                const displayValue = valueField === 'avg_price' ? 
                    `${prefix}${Math.round(value).toLocaleString()}` : 
                    `${value}${prefix}`;
                
                chartHtml += `
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                        <div style="position: relative; margin-bottom: 8px;">
                            <div style="
                                width: 100%; 
                                height: ${height}px; 
                                background: ${color}; 
                                border-radius: 4px 4px 0 0;
                                min-height: 2px;
                                position: relative;
                                display: flex;
                                align-items: end;
                                justify-content: center;
                                padding-bottom: 5px;
                            ">
                                <span style="
                                    color: white; 
                                    font-size: 10px; 
                                    font-weight: bold;
                                    text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
                                    writing-mode: vertical-rl;
                                    text-orientation: mixed;
                                ">${displayValue}</span>
                            </div>
                        </div>
                        <div style="font-size: 12px; font-weight: 500; color: #2c3e50;">${item.sale_year}</div>
                    </div>
                `;
            });
            
            chartHtml += `</div>`;
            return chartHtml;
        }
        
        // Function to render popup charts using Chart.js
        function renderPopupChart(canvasId, data, valueField, color, label) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.error(`Canvas ${canvasId} not found`);
                return;
            }
            
            // Destroy existing chart instance
            if (canvasId === 'salesCountChart' && salesCountChartInstance) {
                salesCountChartInstance.destroy();
            } else if (canvasId === 'avgPriceChart' && avgPriceChartInstance) {
                avgPriceChartInstance.destroy();
            }
            
            // Prepare data for Chart.js
            const chartData = data.map(item => ({
                x: item.sale_year.toString(),
                y: parseFloat(item[valueField]) || 0
            }));
            
            const ctx = canvas.getContext('2d');
            
            // Determine if this is a price chart for formatting
            const isPrice = /price/i.test(valueField);
            
            // Create Chart.js configuration
            const config = {
                type: 'line',
                data: {
                    datasets: [{
                        label: label,
                        data: chartData,
                        backgroundColor: color + '20', // 20% opacity for fill
                        borderColor: color,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: color,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointHoverBackgroundColor: color,
                        pointHoverBorderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { left: 16, right: 16, top: 8, bottom: 12 } },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                title: function(tooltipItems) {
                                    return `Year ${tooltipItems[0].label}`;
                                },
                                label: function(context) {
                                    const value = context.parsed.y;
                                    if (isPrice) {
                                        return `${label}: $${Math.round(value).toLocaleString()}`;
                                    } else {
                                        return `${label}: ${value}`;
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'category',
                            title: {
                                display: true,
                                text: 'Year',
                                color: '#2c3e50',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#2c3e50',
                                font: {
                                    weight: '500'
                                }
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: label,
                                color: '#2c3e50',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                color: '#f0f0f0'
                            },
                            ticks: {
                                color: '#666',
                                callback: function(value) {
                                    if (isPrice) {
                                        return '$' + Math.round(value).toLocaleString();
                                    } else {
                                        return value;
                                    }
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 800,
                        easing: 'easeOutQuart'
                    }
                }
            };
            
            // Create the chart and store the instance
            const newChart = new Chart(ctx, config);
            
            if (canvasId === 'salesCountChart') {
                salesCountChartInstance = newChart;
            } else if (canvasId === 'avgPriceChart') {
                avgPriceChartInstance = newChart;
            }
        }
        
        // Function to close chart overlay and clean up chart instances
        function closeChartOverlay() {
            const overlay = document.getElementById('chartOverlay');
            overlay.style.display = 'none';
            
            // Destroy chart instances to free memory
            if (salesCountChartInstance) {
                salesCountChartInstance.destroy();
                salesCountChartInstance = null;
            }
            if (avgPriceChartInstance) {
                avgPriceChartInstance.destroy();
                avgPriceChartInstance = null;
            }
        }
        
        // Setup chart overlay close handlers
        document.addEventListener('DOMContentLoaded', function() {
            const overlay = document.getElementById('chartOverlay');
            const closeButton = document.getElementById('closeChartOverlay');
            
            // Close overlay when clicking close button
            closeButton.addEventListener('click', () => {
                closeChartOverlay();
            });
            
            // Close overlay when clicking outside the content
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeChartOverlay();
                }
            });
            
            // Close overlay with Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && overlay.style.display === 'flex') {
                    closeChartOverlay();
                }
            });
            
            // Initialize development actions popup
            initializeDevelopmentActionsPopup();
        });
        // Initialize development actions popup functionality
        function initializeDevelopmentActionsPopup() {
            const popup = document.getElementById('developmentActionsPopup');
            
            // Close popup when clicking outside
            document.addEventListener('click', function(e) {
                if (__suppressNextDocumentClick) {
                    // Skip one document click that originated from legend click
                    __suppressNextDocumentClick = false;
                    return;
                }
                if (popup && popup.style.display !== 'none' && !popup.contains(e.target)) {
                    // Check if the click was on the chart legend (which should open the popup)
                    const isLegendClick = e.target.closest('.chartjs-legend') || 
                                         e.target.closest('canvas') || 
                                         e.target.tagName === 'CANVAS';
                    
                    if (!isLegendClick) {
                        hideDevelopmentActionsPopup();
                    }
                }
            });
            
            // Close popup with Escape key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && popup && popup.style.display !== 'none') {
                    hideDevelopmentActionsPopup();
                }
            });
        }
        
        // Function to load development statistics
        async function loadDevelopmentStats(developmentName) {
            try {
                console.log('Loading stats for development:', developmentName);
                
                // Show loading state in stats section
                const statsSection = document.querySelector('#homeStatsContent > div:last-child');
                if (statsSection) {
                    statsSection.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 150px;">
                            <div style="text-align: center;">
                                <div style="border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 2s linear infinite; margin: 0 auto 15px;"></div>
                                <p style="margin: 0; color: #7f8c8d; font-size: 14px;">Loading ${developmentName} statistics...</p>
                            </div>
                        </div>
                    `;
                }
                
                const response = await fetch(`${API_BASE}/development-stats/${encodeURIComponent(developmentName)}`);
                const result = await response.json();
                
                if (response.ok && result.success) {
                    displayDevelopmentStats(result.data);
                } else {
                    console.error('Error loading development stats:', result.error);
                    displayStatsError('Unable to load development statistics');
                }
            } catch (error) {
                console.error('Error fetching development stats:', error);
                displayStatsError('Error loading statistics');
            }
        }
        
        // Function to display development statistics
        function displayDevelopmentStats(stats) {
            const statsSection = document.querySelector('#homeStatsContent > div:last-child');
            if (!statsSection) return;
            
            // Format large numbers for display
            const formatPrice = (price) => {
                if (!price || price === 0) return 'N/A';
                if (price >= 1000000) {
                    return `$${(price / 1000000).toFixed(1)}M`;
                } else if (price >= 1000) {
                    return `$${(price / 1000).toFixed(0)}K`;
                } else {
                    return `$${price.toLocaleString()}`;
                }
            };
            
            statsSection.innerHTML = `
                <div style="padding: 20px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h3 style="margin: 0; color: #2c3e50; font-size: 22px; font-weight: 600; margin-bottom: 5px;">${stats.developmentName}</h3>
                        <div style="width: 60px; height: 2px; background: linear-gradient(90deg, #3498db, #27ae60); margin: 8px auto;"></div>
                        <p style="margin: 0; color: #7f8c8d; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Development Statistics</p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 18px;">
                        <!-- Left Column -->
                        <div>
                            <div style="margin-bottom: 8px;">
                                <strong>Parcels in Development:</strong> <span style="color: #2c3e50;">${stats.totalProperties}</span>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>Active:</strong> <span style="color: #e74c3c;">${stats.activeListings}</span>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>Active Under Contract:</strong> <span style="color: #f39c12;">${stats.underContract}</span>
                            </div>
                            ${stats.pending > 0 ? `<div style="margin-bottom: 8px;"><strong>Pending:</strong> <span style="color: #8e44ad;">${stats.pending}</span></div>` : ''}
                            <div style="margin-bottom: 8px;">
                                <strong>Closed (&lt; 3 Mos.):</strong> <span style="color: #27ae60;">${stats.closedLast3Months}</span>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>Closed (&lt; 12 Mos.):</strong> <span style="color: #27ae60;">${stats.closedLast12Months}</span>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>Active %:</strong> <span style="color: #2c3e50;">${stats.activePercentage}%</span>
                            </div>
                        </div>
                        
                        <!-- Right Column -->
                        <div>
                            <div style="margin-bottom: 12px;">
                                <strong>MLS Median Sale Price (YTD):</strong>
                            </div>
                            ${Object.keys(stats.medianPrices).length > 0 ? 
                                Object.entries(stats.medianPrices)
                                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                    .map(([year, price]) => {
                                        const count = stats.saleCounts[year] || 0;
                                        return `<div style="margin-bottom: 6px; margin-left: 10px;">
                                            <strong>${year}:</strong> <span style="color: ${year === '2025' ? '#3498db' : '#2c3e50'};">${formatPrice(price)} (${count})</span>
                                        </div>`;
                                    }).join('') 
                                : '<div style="margin-left: 10px; color: #95a5a6; font-style: italic;">No recent sales data</div>'
                            }
                            
                            <div style="margin-top: 15px;">
                                <div style="margin-bottom: 6px;">
                                    <strong>Months of Inventory (3mo):</strong> <span style="color: #8e44ad;">${stats.inventoryMonths.threeMonth}</span>
                                </div>
                                <div style="margin-bottom: 6px;">
                                    <strong>Months of Inventory (12mo):</strong> <span style="color: #8e44ad;">${stats.inventoryMonths.twelveMonth}</span>
                                </div>
                            </div>
                            
                            ${stats.avgDaysOnMarket > 0 ? `
                            <div style="margin-top: 10px;">
                                <strong>Avg DOM (Active):</strong> <span style="color: #34495e;">${stats.avgDaysOnMarket} days</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Function to load ZIP-level statistics (fallback outside Palm Beach)
        async function loadZipStats(zipCode) {
            try {
                const statsSection = document.querySelector('#homeStatsContent > div:last-child');
                if (statsSection) {
                    statsSection.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 150px;">
                            <div style="text-align: center;">
                                <div style="border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 2s linear infinite; margin: 0 auto 15px;"></div>
                                <p style="margin: 0; color: #7f8c8d; font-size: 14px;">Loading ZIP ${zipCode} market statistics...</p>
                            </div>
                        </div>
                    `;
                }
                // Use RentCast proxy endpoint (no county fallback for Home Info panel)
                const respLatest = await fetch(`${API_BASE}/zip-market?zip=${encodeURIComponent(String(zipCode))}`);
                const latestResp = await respLatest.json();
                if (!respLatest.ok || !latestResp.success || !latestResp.data) {
                    throw new Error(latestResp.error || 'No ZIP market data');
                }
                const latest = latestResp.data;
                let metaCity = '';
                let metaState = '';
                try {
                    const metaResp = await fetch(`${API_BASE}/zip-latest?zip=${encodeURIComponent(String(zipCode))}`);
                    if (metaResp.ok) {
                        const metaJson = await metaResp.json();
                        if (metaJson && metaJson.success && metaJson.data) {
                            metaCity = String(metaJson.data.city || '').trim();
                            metaState = String(metaJson.data.state_id || '').trim();
                        }
                    }
                } catch (_) {}
                // Fallback to zipcity lookup if needed
                if ((!metaCity || !metaState)) {
                    try {
                        const zcUrl = new URL(`${API_BASE}/zipcity/by-zip`, window.location.origin);
                        zcUrl.searchParams.set('zip', String(zipCode));
                        const zcResp = await fetch(zcUrl.toString().replace(window.location.origin, ''));
                        if (zcResp.ok) {
                            const zcJson = await zcResp.json();
                            const row = Array.isArray(zcJson?.data) ? zcJson.data[0] : null;
                            if (row) {
                                if (!metaCity) metaCity = String(row.city || '').trim();
                                if (!metaState) metaState = String(row.state_id || '').trim();
                            }
                        }
                    } catch (_) {}
                }
                const zipStats = {
                    zip5: String(zipCode),
                    city: metaCity,
                    state_id: metaState,
                    median_listing_price: (Number(latest.medianPrice) || null),
                    median_days_on_market: Number.isFinite(Number(latest.medianDaysOnMarket)) ? Math.max(0, Math.round(Number(latest.medianDaysOnMarket))) : null,
                    new_listing_count: Math.max(0, Math.floor(Number(latest.newListings) || 0)),
                    median_listing_price_per_sqft: (Number(latest.medianPricePerSquareFoot) || null),
                    total_listing_count: Math.max(0, Math.floor(Number(latest.totalListings) || 0))
                };
                displayZipStats(zipStats);
            } catch (error) {
                console.error('Error loading ZIP stats:', error);
                displayStatsError('Unable to load ZIP market statistics');
            }
        }

        // Function to display ZIP-level statistics
        function displayZipStats(stats) {
            const statsSection = document.querySelector('#homeStatsContent > div:last-child');
            if (!statsSection) return;
            const formatPrice = (price) => {
                if (price === null || price === undefined || Number(price) === 0) return 'N/A';
                const num = Number(price);
                if (!Number.isFinite(num)) return 'N/A';
                if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
                if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
                return `$${num.toLocaleString()}`;
            };
            const __city = String(stats.city || '').trim();
            const __state = String(stats.state_id || '').trim();
            const __titleGeo = (__city || __state)
                ? `${__city}${__city && __state ? ', ' : ''}${__state ? __state.toUpperCase() : ''} ${stats.zip5}`
                : `ZIP ${stats.zip5}`;
            statsSection.innerHTML = `
                <div style="padding: 20px; box-sizing: border-box;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h3 style="margin: 0; color: #2c3e50; font-size: 22px; font-weight: 600; margin-bottom: 5px;">${__titleGeo}</h3>
                        <div style="width: 60px; height: 2px; background: linear-gradient(90deg, #3498db, #27ae60); margin: 8px auto;"></div>
                        <p style="margin: 0; color: #7f8c8d; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Market Statistics</p>
                    </div>
                    <div style="display: flex; gap: 24px; font-size: 18px; align-items: flex-start; justify-content: stretch; margin: 0;">
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 8px; margin: 0;">
                            <div><strong>New Listings (mo):</strong> <span style="color: #f39c12;">${stats.new_listing_count}</span></div>
                            <div><strong>Total Listings:</strong> <span style="color: #2c3e50;">${stats.total_listing_count}</span></div>
                        </div>
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 8px; margin: 0;">
                            <div><strong>Median Listing Price:</strong> <span style="color:#2c3e50;">${formatPrice(stats.median_listing_price)}</span></div>
                            <div><strong>Median Price per SqFt:</strong> <span style="color:#2c3e50;">${Number.isFinite(Number(stats.median_listing_price_per_sqft)) ? `$${Number(stats.median_listing_price_per_sqft).toFixed(0).toLocaleString?.() || Number(stats.median_listing_price_per_sqft).toLocaleString()}` : 'N/A'}</span></div>
                            <div><strong>Median Days on Market:</strong> <span style="color:#34495e;">${Number.isFinite(Number(stats.median_days_on_market)) ? `${Number(stats.median_days_on_market)} days` : 'N/A'}</span></div>
                        </div>
                    </div>
                </div>
            `;
        }

        function normalizeCountyLabel(value) {
            return String(value || '')
                .toLowerCase()
                .replace(/county$/i, '')
                .replace(/\s+/g, ' ')
                .trim();
        }
