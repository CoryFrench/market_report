        // Get report identifier from URL (could be lastname-id format or just ID)
        const urlParams = new URLSearchParams(window.location.search);
        let urlSlug = urlParams.get('id');
        
        // If no query parameter, extract from path
        if (!urlSlug) {
            const pathParts = window.location.pathname.split('/');
            urlSlug = pathParts[pathParts.length - 1]; // Get last part of path
        }
        
        // If still no slug or it's empty, show error
        if (!urlSlug || urlSlug === 'report.html') {
            console.error('No report identifier found in URL');
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
        }

        async function loadReport() {
            // Don't load if no URL slug
            if (!urlSlug || urlSlug === 'report.html') {
                return;
            }
            
            try {
                console.log('Loading report with slug:', urlSlug);
                const response = await fetch(`${API_BASE}/reports/complete/${urlSlug}`);
                const result = await response.json();

                console.log('API Response:', { status: response.status, result });
                document.getElementById('loading').style.display = 'none';

                if (response.ok && result.success) {
                    displayReport(result.data);
                } else {
                    console.error('API Error:', result.error || 'Unknown error');
                    document.getElementById('error').style.display = 'block';
                }
            } catch (error) {
                console.error('Error loading report:', error);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').style.display = 'block';
            }
        }
        window.loadReport = loadReport;

        function displayReport(data) {
            try {
                window.currentReportPayload = data;
                document.dispatchEvent(new CustomEvent('report-data-ready', { detail: data }));
            } catch (_) {}
            console.log('Displaying report data:', data);
            document.getElementById('reportContent').style.display = 'flex';
            try { delete window._zipOnlyDefault; } catch (_) {}
            let zipFallback = String(data.zip_code || '').trim();
            if (!/^\d{5}$/.test(zipFallback)) {
                zipFallback = '33477';
                try { window._zipOnlyDefault = true; } catch (_) {}
            }
            data.__zipFallback = zipFallback;
            
            // Update header information
            document.getElementById('agentName').textContent = data.agent_name || 'Agent Name';
            (function updateAgentPhone() {
                const phoneEl = document.getElementById('agentPhone');
                if (!phoneEl) return;
                const rawPhone = data.agent_cell_phone || data.agent_direct_phone || '';
                const formatted = formatPhoneNumber(rawPhone);
                if (formatted) {
                    phoneEl.textContent = formatted;
                    phoneEl.style.display = 'block';
                } else {
                    phoneEl.textContent = '';
                    phoneEl.style.display = 'none';
                }
            })();
            document.getElementById('buyerName').textContent = `${data.first_name} ${data.last_name}` || 'Buyer Name';
            (function() {
                const city = String(data.home_city || data.city || '').trim();
                const state = String(data.home_state || data.state || '').trim();
                const zip = String(data.zip_code || '').trim();
                const isPalmBeach = /palm\s*beach/i.test(String(data.county || ''));
                let headerValue = 'ZIP Code';
                if (!isPalmBeach && zip) {
                    if (city && state) headerValue = `${city}, ${state.toUpperCase()} ${zip}`;
                    else if (state) headerValue = `${state.toUpperCase()} ${zip}`;
                    else if (city) headerValue = `${city} ${zip}`;
                    else headerValue = `ZIP ${zip}`;
                } else if (zip) {
                    headerValue = `ZIP ${zip}`;
                }
                document.getElementById('zipCode').textContent = headerValue;
            })();
            
            // Determine if property is out-of-state (non-Florida)
            try {
                const stateValue = String(data.home_state || '').trim().toLowerCase();
                window.isOutOfState = !(stateValue === 'fl' || stateValue === 'florida');
            } catch (_) { window.isOutOfState = false; }
            
            // Update Home Info map button UI based on state
            try {
                const mapButton = document.getElementById('mapButton');
                if (mapButton) {
                    if (window.isOutOfState) {
                        mapButton.style.opacity = '0.5';
                        mapButton.style.cursor = 'not-allowed';
                        mapButton.style.pointerEvents = 'none';
                        mapButton.title = 'Map is unavailable for out-of-state properties';
                    } else {
                        mapButton.style.opacity = '';
                        mapButton.style.cursor = 'pointer';
                        mapButton.style.pointerEvents = '';
                        mapButton.title = '';
                    }
                }
            } catch (_) {}
            
            // Charts - Skip overwriting chartsContent since it now contains FRED interface
            // Chart data is now handled by the FRED comparison interface in Area Charts section
            
            // Interest areas
            if (data.interest_areas && data.interest_areas.length > 0) {
                const areasHtml = data.interest_areas.map(area => `
                    <div class="info-item">
                        <div class="info-label">Interest ${area.interest_id}</div>
                        <div class="info-value">${area.city}, ${area.state}</div>
                    </div>
                `).join('');
                document.getElementById('interestAreasContent').innerHTML = `<div class="info-grid">${areasHtml}</div>`;
            }
            
            // Home Stats - Display property information
            displayHomeStats(data);
            initializeWealthMigrationSection(data);
            // Enable interactive lookup (prefill with current report values)
            setupHomeLookup(data);
            
            // FRED Charts - Load the charts after displaying the report
            loadFredCharts(data.report_id);
            setupNationalInfoToggles();

            // ZIP Insights: always show zipcode insights section
            try {
                const section = document.getElementById('county-insights-section');
                if (section) {
                    section.style.display = 'flex';
                    // Always initialize ZIP insights; backend supplies default when missing
                    initCountyInsights(data || {});
                }

                // Keep Development/Zone sections visibility unchanged
            } catch (_) {}
        }
        
        function displayHomeStats(data) {
            // Helpers to normalize casing for display
            const DIRECTIONALS = new Set(['N','S','E','W','NE','NW','SE','SW']);
            const ROMAN_NUMERALS = new Set(['I','II','III','IV','V','VI','VII','VIII','IX','X']);
            function capitalizeWord(word) {
                if (!word) return word;
                const raw = String(word);
                const alnum = raw.replace(/[^A-Za-z0-9]/g, '');
                if (alnum.length === 0) return raw; // punctuation-only
                if (/^\d+$/.test(alnum)) return raw; // numbers
                if (DIRECTIONALS.has(alnum.toUpperCase())) return alnum.toUpperCase();
                if (ROMAN_NUMERALS.has(alnum.toUpperCase())) return alnum.toUpperCase();
                const lower = raw.toLowerCase();
                return lower.replace(/([A-Za-zÀ-ÖØ-öø-ÿ])(\S*)/, (_m, a, b) => a.toUpperCase() + b);
            }
            function toTitleCaseSmart(str) {
                if (!str) return str;
                return String(str)
                    .split(' ')
                    .map(part => part.split('-').map(capitalizeWord).join('-'))
                    .join(' ');
            }
            // Format address with each component on separate lines
            let addressLines = [];
            
            // Address Line 1 (title case for display)
            if (data.address_line_1 && data.address_line_1.trim()) {
                addressLines.push(toTitleCaseSmart(data.address_line_1.trim()));
            }
            
            // Address Line 2 (if exists)
            if (data.address_line_2 && data.address_line_2.trim()) {
                addressLines.push(toTitleCaseSmart(data.address_line_2.trim()));
            }
            
            // City, State, Zip
            let cityStateZip = [];
            if (data.home_city) cityStateZip.push(toTitleCaseSmart(data.home_city));
            if (data.home_state) cityStateZip.push(data.home_state);
            if (data.zip_code) cityStateZip.push(data.zip_code);
            if (cityStateZip.length > 0) {
                addressLines.push(cityStateZip.join(', '));
            }
            
            // Development & Subdivision (avoid duplicate when identical)
            const devName = (data.development && data.development.trim()) ? toTitleCaseSmart(data.development.trim()) : '';
            const subName = (data.subdivision && data.subdivision.trim()) ? toTitleCaseSmart(data.subdivision.trim()) : '';
            if (devName) {
                addressLines.push(devName);
            }
            if (subName && subName.toLowerCase() !== devName.toLowerCase()) {
                addressLines.push(subName);
            }
            
            // Update property details with styled formatting
            const addressElement = document.getElementById('propertyAddress');
            if (addressLines.length > 0) {
                let styledAddress = '';
                addressLines.forEach((line, index) => {
                    // Determine line type based on content pattern rather than position
                    const isCityStateZip = line.includes(',') && /\d{5}/.test(line); // Contains comma and 5-digit zip
                    const isStreetAddress = index === 0 || (index === 1 && !isCityStateZip);
                    
                    if (isStreetAddress) {
                        // Street address lines - larger and bolder
                        styledAddress += `<div style="font-size: 18px; font-weight: 600; color: #2c3e50; margin-bottom: 4px; line-height: 1.3;">${line}</div>`;
                    } else if (isCityStateZip) {
                        // City, State, Zip line - medium weight
                        styledAddress += `<div style="font-size: 20px; font-weight: 500; color: #34495e; margin-bottom: 8px; line-height: 1.3;">${line}</div>`;
                    } else {
                        // Development/Subdivision - lighter styling with subtle separation
                        styledAddress += `<div style="font-size: 18px; font-weight: 400; color: #7f8c8d; margin-bottom: 3px; line-height: 1.4; font-style: italic;">${line}</div>`;
                    }
                });
                addressElement.innerHTML = styledAddress;
            } else {
                addressElement.innerHTML = `<div style="font-size: 16px; color: #95a5a6; font-style: italic;">Address information not available</div>`;
            }
            
            // Hide the development and subdivision elements since they're now in the address
            document.getElementById('propertyDevelopment').style.display = 'none';
            document.getElementById('propertySubdivision').style.display = 'none';

            // Gate PB-only sections (Development/Zone comparisons & parcels) to Palm Beach only
            try {
                const countyName = String(data.county || '').toLowerCase();
                const isPalmBeach = countyName.includes('palm beach');
                try { window.isPalmBeachCounty = isPalmBeach; } catch (_) {}
                const devSectionTitle = document.getElementById('dev-comp-title');
                const devControls = document.getElementById('dev-controls-section');
                const devChartSection = document.getElementById('dev-chart-section');
                if (!isPalmBeach) {
                    // Hide the entire Neighbourhood Charts section when not Palm Beach County
                    if (devSectionTitle) {
                        const sectionEl = devSectionTitle.closest('.section');
                        if (sectionEl) sectionEl.style.display = 'none';
                    }
                    if (devControls) devControls.style.display = 'none';
                    if (devChartSection) devChartSection.style.display = 'none';
                }
            } catch (_) {}
            
            // Enrich Home Stats via property lookup (address → parcel → tax fields)
            (async () => {
                try {
                    const params = new URLSearchParams();
                    const hasStreet = typeof data.address_line_1 === 'string' && data.address_line_1.trim().length >= 6;
                    if (hasStreet) params.set('address', data.address_line_1);
                    if (data.home_city) params.set('city', data.home_city);
                    if (data.zip_code) params.set('zip', data.zip_code);
                    if (data.development) params.set('development', data.development);
                    if (data.subdivision) params.set('subdivision', data.subdivision);
                    const query = params.toString();
                    // Require a street address for property-lookup; ZIP-only is not supported by backend
                    if (!hasStreet || (typeof window !== 'undefined' && window._zipOnlyDefault === true)) {
                        // Nothing to lookup; skip request
                        return;
                    }
                    const resp = await fetch(`${API_BASE}/property-lookup?${query}`);
                    if (resp.ok) {
                        const result = await resp.json();
                        if (result && result.success && Array.isArray(result.data) && result.data.length > 0) {
                            const best = result.data[0];
                            const container = document.getElementById('homeStatsContent');
                            if (container) {
                                const infoBlock = document.createElement('div');
                                infoBlock.style.marginTop = '12px';

                                // Helpers to format numeric values from tax table safely
                                const formatInt = (value) => {
                                    if (value === null || value === undefined) return 'N/A';
                                    const trimmed = String(value).trim();
                                    if (trimmed.length === 0) return 'N/A';
                                    const parsed = parseInt(trimmed, 10);
                                    return Number.isNaN(parsed) ? 'N/A' : String(parsed);
                                };

                                const formatQuantity = (value) => {
                                    if (value === null || value === undefined) return 'N/A';
                                    const trimmed = String(value).trim();
                                    if (trimmed.length === 0) return 'N/A';
                                    const parsed = parseInt(trimmed, 10);
                                    return Number.isNaN(parsed) ? 'N/A' : parsed.toLocaleString('en-US');
                                };

                                const formatCurrency0 = (value) => {
                                    if (value === null || value === undefined) return 'N/A';
                                    const cleaned = String(value).replace(/[^0-9.\-]/g, '');
                                    const num = Number(cleaned);
                                    return Number.isFinite(num)
                                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num)
                                        : 'N/A';
                                };

                                const yearBuilt = formatInt(best.year_built);
                                const livingSqFt = formatQuantity(best.square_foot_living_area);
                                const bedrooms = formatInt(best.number_of_bedrooms);
                                const fullBaths = formatInt(best.number_of_full_bathrooms);
                                const halfBaths = formatInt(best.number_of_half_bathrooms);
                                const halfBathsHtml = (halfBaths !== 'N/A' && parseInt(halfBaths, 10) > 0)
                                    ? `<div><span style=\"color:#7f8c8d\">🚿 Half Bath:</span> <strong>${halfBaths}</strong></div>`
                                    : '';
                                const marketValue = formatCurrency0(best.total_market_value);

                                // Build address content to merge into one unified card
                                let addressHtml = addressLines.length > 0
                                    ? addressLines.map((line, idx) => {
                                        const isCityStateZip = line.includes(',') && /\d{5}/.test(line);
                                        const isPrimary = idx === 0 || (idx === 1 && !isCityStateZip);
                                        const style = isPrimary
                                            ? 'font-size:18px;font-weight:600;color:#2c3e50;margin-bottom:4px;line-height:1.3;'
                                            : (isCityStateZip
                                                ? 'font-size:20px;font-weight:500;color:#34495e;margin-bottom:6px;line-height:1.3;'
                                                : 'font-size:16px;font-weight:400;color:#7f8c8d;margin-bottom:3px;line-height:1.4;font-style:italic;');
                                        return `<div style="${style}">${line}</div>`;
                                    }).join('')
                                    : '<div style="font-size:16px;color:#95a5a6;font-style:italic;">Address information not available</div>';

                                // If development was not provided but inferred from lookup, reflect it in UI and globals
                                if ((!data.development || String(data.development).trim().length === 0) && best.development_name) {
                                    try { window._inferredDevelopment = best.development_name; } catch {}
                                    try { currentDevelopmentName = best.development_name; } catch {}
                                    try { setupChartButton(best.development_name); } catch {}
                                    const devLine = `<div style=\"font-size:16px;font-weight:400;color:#7f8c8d;margin-bottom:3px;line-height:1.4;font-style:italic;\">${best.development_name}</div>`;
                                    addressHtml = addressHtml + devLine;
                                }

                                infoBlock.innerHTML = `
                                    <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e9ecef; border-radius: 10px; padding: 16px;">
                                        <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:12px;">
                                            <div style="font-size:20px; line-height:1;">📍</div>
                                            <div style="flex:1;">${addressHtml}</div>
                                        </div>
                                        <div style="height:1px; background:#e9ecef; margin:10px 0 14px 0;"></div>
                                        <div class="home-detail-grid">
                                            <div><span style=\"color:#7f8c8d\">🛏️ Bedrooms:</span> <strong>${bedrooms}</strong></div>
                                            <div><span style=\"color:#7f8c8d\">📐 Living SqFt:</span> <strong>${livingSqFt}</strong></div>
                                            <div><span style=\"color:#7f8c8d\">🛁 Bath:</span> <strong>${fullBaths}</strong></div>
                                            <div><span style=\"color:#7f8c8d\">🏗️ Year Built:</span> <strong>${yearBuilt}</strong></div>
                                            ${halfBathsHtml}
                                            <div><span style=\"color:#7f8c8d\">💲 Tax Value:</span> <strong>${marketValue}</strong></div>
                                        </div>
                                    </div>
                                `;

                                const leftPanel = container.firstElementChild;
                                if (leftPanel) {
                                    const buttonsRow = leftPanel.querySelector('#mapButton') ? leftPanel.querySelector('#mapButton').parentElement : null;
                                    if (buttonsRow) {
                                        leftPanel.insertBefore(infoBlock, buttonsRow);
                                    } else {
                                        leftPanel.appendChild(infoBlock);
                                    }
                                    // Hide the original separate address block to avoid duplication
                                    const addressBlock = leftPanel.querySelector('#propertyAddress');
                                    if (addressBlock) addressBlock.style.display = 'none';
                                }
                                // If no development was provided and we are in Palm Beach, try to auto-load stats from inferred development
                                if (window.isPalmBeachCounty !== false && (!data.development || String(data.development).trim().length === 0) && best.development_name) {
                                    try { await loadDevelopmentStats(best.development_name); } catch {}
                                } else if (window.isPalmBeachCounty === false && data.zip_code) {
                                    try { await loadZipStats(String(data.zip_code)); } catch {}
                                }
                                // For non-Palm Beach, also augment left-side Home Info details via RentCast property profile
                                if (window.isPalmBeachCounty === false) {
                                    try {
                                        const addrParts = [];
                                        if (hasStreet) addrParts.push(String(data.address_line_1).trim());
                                        if (data.home_city || data.home_state || data.zip_code) {
                                            const cityStateZip = [String(data.home_city || '').trim(), String(data.home_state || '').trim(), String(data.zip_code || '').trim()].filter(Boolean).join(', ');
                                            if (cityStateZip) addrParts.push(cityStateZip);
                                        }
                                        const fullAddress = addrParts.join(', ');
                                        // Require a true street address, not ZIP-only
                                        const hasTrueStreet = hasStreet && /\s/.test(String(data.address_line_1));
                                        if (hasTrueStreet && fullAddress.length >= 8) {
                                            const resp = await fetch(`${API_BASE}/property-profile?address=${encodeURIComponent(fullAddress)}`);
                                            const pr = await resp.json();
                                            if (resp.ok && pr && pr.success && pr.data) {
                                                const p = pr.data;
                                                const detailsCard = document.createElement('div');
                                                detailsCard.style.marginTop = '12px';
                                                const fmtQty = (v) => {
                                                    const n = Number(v);
                                                    return Number.isFinite(n) ? n.toLocaleString() : 'N/A';
                                                };
                                                const fmtCurr0 = (v) => {
                                                    const n = Number(v);
                                                    return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) : 'N/A';
                                                };
                                                detailsCard.innerHTML = `
                                                    <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e9ecef; border-radius: 10px; padding: 16px;">
                                                        <div class="home-detail-grid">
                                                            <div><span style=\"color:#7f8c8d\">🛏️ Bedrooms:</span> <strong>${fmtQty(p.bedrooms)}</strong></div>
                                                            <div><span style=\"color:#7f8c8d\">🛁 Bathrooms:</span> <strong>${fmtQty(p.bathrooms)}</strong></div>
                                                            <div><span style=\"color:#7f8c8d\">📐 Living SqFt:</span> <strong>${fmtQty(p.squareFootage)}</strong></div>
                                                            <div><span style=\"color:#7f8c8d\">📏 Lot Size:</span> <strong>${fmtQty(p.lotSize)}</strong></div>
                                                            <div><span style=\"color:#7f8c8d\">🏗️ Year Built:</span> <strong>${fmtQty(p.yearBuilt)}</strong></div>
                                                            <div><span style=\"color:#7f8c8d\">💲 Tax Assessment:</span> <strong>${fmtCurr0(p.taxAssessmentValue)}</strong></div>
                                                        </div>
                                                    </div>
                                                `;
                                                if (leftPanel) {
                                                    leftPanel.appendChild(detailsCard);
                                                }
                                            }
                                        }
                                    } catch (_) { /* ignore profile errors */ }
                                }
                            }
                        }
                    }
                } catch (lookupErr) {
                    console.warn('Property lookup failed:', lookupErr);
                }
            })();
            
            // Load development stats in Palm Beach, else load ZIP stats when available
            if (window.isPalmBeachCounty !== false) {
                if (data.development && data.development.trim()) {
                    loadDevelopmentStats(data.development.trim());
                }
            } else {
                const zipForStats = (typeof data.__zipFallback === 'string' && /^\d{5}$/.test(data.__zipFallback))
                    ? data.__zipFallback
                    : (typeof data.zip_code === 'string' ? data.zip_code.trim() : '');
                if (zipForStats && /^\d{5}$/.test(zipForStats)) {
                    loadZipStats(String(zipForStats));
                }
            }
            
            // Setup chart button click handler
            setupChartButton(data.development && data.development.trim() ? data.development.trim() : null);

            // For non-Palm Beach, augment Home Info with RentCast property profile regardless of county tax lookup result
            if (window.isPalmBeachCounty === false) {
                try { console.log('Non-PB: preparing RentCast profile fetch. isPalmBeachCounty=', window.isPalmBeachCounty); } catch (_) {}
                (async () => {
                    try {
                        const leftPanelHost = document.querySelector('#homeStatsContent > div:first-child');
                        if (!leftPanelHost) return;
                        // Avoid duplicate injection
                        if (leftPanelHost.querySelector('[data-rentcast-profile="1"]')) return;
                        const parts = [];
                        const hasStreet = typeof data.address_line_1 === 'string' && data.address_line_1.trim().length >= 6 && /\s/.test(String(data.address_line_1));
                        if (typeof window !== 'undefined' && window._zipOnlyDefault === true) return;
                        if (hasStreet) parts.push(String(data.address_line_1).trim());
                        const cityStateZip = [String(data.home_city || '').trim(), String(data.home_state || '').trim(), String(data.zip_code || '').trim()].filter(Boolean).join(', ');
                        if (hasStreet && cityStateZip) parts.push(cityStateZip);
                        const fullAddress = parts.join(', ');
                        try { console.log('Non-PB: fullAddress built for RentCast:', fullAddress); } catch (_) {}
                        if (!hasStreet || fullAddress.length < 8) return;
                        const endpoint = `${API_BASE}/property-profile?address=${encodeURIComponent(fullAddress)}`;
                        try { console.log('Non-PB: fetching RentCast profile:', endpoint); } catch (_) {}
                        const resp = await fetch(endpoint);
                        const pr = await resp.json();
                        try { console.log('Non-PB: RentCast profile response ok=', resp.ok, 'success=', pr && pr.success); } catch (_) {}
                        if (!resp.ok || !pr || !pr.success || !pr.data) return;
                        const p = pr.data;
                        const detailsCard = document.createElement('div');
                        detailsCard.setAttribute('data-rentcast-profile', '1');
                        detailsCard.style.marginTop = '12px';
                        const fmtQty = (v) => {
                            const n = Number(v);
                            return Number.isFinite(n) ? n.toLocaleString() : 'N/A';
                        };
                        const fmtCurr0 = (v) => {
                            const n = Number(v);
                            return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) : 'N/A';
                        };
                        detailsCard.innerHTML = `
                            <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e9ecef; border-radius: 10px; padding: 16px;">
                                <div class="home-detail-grid">
                                    <div><span style=\"color:#7f8c8d\">🛏️ Bedrooms:</span> <strong>${fmtQty(p.bedrooms)}</strong></div>
                                    <div><span style=\"color:#7f8c8d\">🛁 Bathrooms:</span> <strong>${fmtQty(p.bathrooms)}</strong></div>
                                    <div><span style=\"color:#7f8c8d\">📐 Living SqFt:</span> <strong>${fmtQty(p.squareFootage)}</strong></div>
                                    <div><span style=\"color:#7f8c8d\">📏 Lot Size:</span> <strong>${fmtQty(p.lotSize)}</strong></div>
                                    <div><span style=\"color:#7f8c8d\">🏗️ Year Built:</span> <strong>${fmtQty(p.yearBuilt)}</strong></div>
                                    <div><span style=\"color:#7f8c8d\">💲 Tax Assessment:</span> <strong>${fmtCurr0(p.taxAssessmentValue)}</strong></div>
                                </div>
                            </div>
                        `;
                        const mapButton = document.getElementById('mapButton');
                        const buttonsRow = mapButton ? mapButton.parentElement : null;
                        if (buttonsRow && buttonsRow.parentElement === leftPanelHost) {
                            leftPanelHost.insertBefore(detailsCard, buttonsRow);
                        } else {
                            leftPanelHost.appendChild(detailsCard);
                        }
                    } catch (_) {}
                })();
            }
        }
        // Interactive Home Lookup using RentCast proxy endpoints
        function setupHomeLookup(initialData) {
            try {
                const form = document.getElementById('homeLookupForm');
                if (!form) return;
                const inputAddress = document.getElementById('hl_address');
                const inputCity = document.getElementById('hl_city');
                const inputState = document.getElementById('hl_state');
                const inputZip = document.getElementById('hl_zip');
                const resultsHost = document.getElementById('homeLookupResults');
                // Prefill from report data when available
                if (initialData) {
                    if (initialData.address_line_1) inputAddress.value = String(initialData.address_line_1);
                    if (initialData.home_city) inputCity.value = String(initialData.home_city);
                    if (initialData.home_state) inputState.value = String(initialData.home_state);
                    if (initialData.zip_code) inputZip.value = String(initialData.zip_code);
                }
                form.addEventListener('submit', async (ev) => {
                    ev.preventDefault();
                    const addr = String(inputAddress.value || '').trim();
                    const city = String(inputCity.value || '').trim();
                    const state = String(inputState.value || '').trim();
                    const zip = String(inputZip.value || '').trim();
                    // Update the address display immediately
                    const lines = [];
                    if (addr) lines.push(addr);
                    const csz = [city, state, zip].filter(Boolean).join(', ');
                    if (csz) lines.push(csz);
                    const addressElement = document.getElementById('propertyAddress');
                    if (addressElement) {
                        addressElement.innerHTML = lines.length > 0
                            ? lines.map((line, idx) => {
                                const isCSZ = /\d{5}$/.test(line) || line.includes(',');
                                const isPrimary = idx === 0 && !isCSZ;
                                const style = isPrimary
                                    ? 'font-size:18px;font-weight:600;color:#2c3e50;margin-bottom:4px;line-height:1.3;'
                                    : (isCSZ
                                        ? 'font-size:20px;font-weight:500;color:#34495e;margin-bottom:6px;line-height:1.3;'
                                        : 'font-size:16px;font-weight:400;color:#7f8c8d;margin-bottom:3px;line-height:1.4;font-style:italic;');
                                return `<div style="${style}">${line}</div>`;
                              }).join('')
                            : '<div style="font-size:16px;color:#95a5a6;font-style:italic;">Enter an address to view details</div>';
                    }
                    // Clear previous results and show a small loader
                    if (resultsHost) {
                        resultsHost.innerHTML = `
                            <div style="display:flex;align-items:center;gap:10px;color:#7f8c8d;">
                                <div style="border:3px solid #f3f3f3;border-top:3px solid #3498db;border-radius:50%;width:18px;height:18px;animation:spin 2s linear infinite;"></div>
                                <span>Fetching property details…</span>
                            </div>`;
                    }
                    // If ZIP provided, refresh right-side stats
                    if (zip) {
                        try { await loadZipStats(zip); } catch (_) { /* ignore */ }
                    }
                    // Only call RentCast property profile when we have a plausible street address
                    const hasStreet = addr && /\s/.test(addr) && addr.length >= 6;
                    const fullAddress = [addr, [city, state, zip].filter(Boolean).join(', ')].filter(Boolean).join(', ');
                    if (!hasStreet || fullAddress.length < 8) {
                        if (resultsHost) resultsHost.innerHTML = '';
                        return;
                    }
                    try {
                        const endpoint = `${API_BASE}/property-profile?address=${encodeURIComponent(fullAddress)}`;
                        const resp = await fetch(endpoint);
                        const pr = await resp.json();
                        if (!resp.ok || !pr || !pr.success || !pr.data) {
                            if (resultsHost) resultsHost.innerHTML = '';
                            return;
                        }
                        const p = pr.data;
                        const fmtQty = (v) => {
                            const n = Number(v);
                            return Number.isFinite(n) ? n.toLocaleString() : 'N/A';
                        };
                        const fmtCurr0 = (v) => {
                            const n = Number(v);
                            return Number.isFinite(n)
                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
                                : 'N/A';
                        };
                        const card = `
                            <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e9ecef; border-radius: 10px; padding: 16px;">
                                <div class="home-detail-grid">
                                    <div><span style=\"color:#7f8c8d\">🛏️ Bedrooms:</span> <strong>${fmtQty(p.bedrooms)}</strong></div>
                                    <div><span style=\"color:#7f8c8d\">🛁 Bathrooms:</span> <strong>${fmtQty(p.bathrooms)}</strong></div>
                                    <div><span style=\"color:#7f8c8d\">📐 Living SqFt:</span> <strong>${fmtQty(p.squareFootage)}</strong></div>
                                    <div><span style=\"color:#7f8c8d\">📏 Lot Size:</span> <strong>${fmtQty(p.lotSize)}</strong></div>
                                    <div><span style=\"color:#7f8c8d\">🏗️ Year Built:</span> <strong>${fmtQty(p.yearBuilt)}</strong></div>
                                    <div><span style=\"color:#7f8c8d\">💲 Tax Assessment:</span> <strong>${fmtCurr0(p.taxAssessmentValue)}</strong></div>
                                </div>
                            </div>`;
                        if (resultsHost) resultsHost.innerHTML = card;
                    } catch (_) {
                        if (resultsHost) resultsHost.innerHTML = '';
                    }
                });
            } catch (_) { /* no-op */ }
        }
        
        // Function to display stats error
        function displayStatsError(message) {
            const statsSection = document.querySelector('#homeStatsContent > div:last-child');
            if (statsSection) {
                statsSection.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 150px;">
                        <div style="text-align: center;">
                            <div style="color: #e74c3c; font-size: 32px; margin-bottom: 15px;">📊</div>
                            <h3 style="margin: 0; color: #2c3e50; font-size: 18px; font-weight: 300; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">Stats</h3>
                            <div style="width: 60px; height: 2px; background: linear-gradient(90deg, #3498db, #27ae60); margin: 8px auto 15px;"></div>
                            <p style="margin: 0; color: #e74c3c; font-size: 13px;">${message}</p>
                        </div>
                    </div>
                `;
            }
        }
    
