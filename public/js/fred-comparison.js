        // FRED series configuration
        const FRED_SERIES = {
            'GDP': 'GDP',
            'CPIAUCSL': 'CPI',
            'PPIACO': 'PPI',
            'FEDFUNDS': 'Fed Funds Rate',
            'MORTGAGE30US': '30-Year Mortgage',
            'MORTGAGE15US': '15-Year Mortgage',
            'RHVRUSQ156N': 'Vacancy Rate',
            'LREM64TTUSM156S': 'Employment',
            'POPTHM': 'Population',
            'M2REAL': 'Money Stock',
            'FPCPITOTLZGUSA': 'Inflation',
            'GFDEBTN': 'Government Debt',
            'DGS10': '10-Year Treasury',
            'DGS2': '2-Year Treasury',
            'ACTLISCOUUS': 'Active Listings',
            'MSPUS': 'Median Sale Price',
            'NEWLISCOUUS': 'New Listings',
            'MEDDAYONMARUS': 'Median Days on Market',
            'USSTHPI': 'Housing Price Index',
            'UNRATE': 'Unemployment Rate',
            'DJIA': 'Dow Jones Industrial Average'
        };

        // National chart explanations (1–2 sentences each)
        const FRED_SERIES_DESCRIPTIONS = {
            'GDP': 'Total output of the U.S. economy. Rising GDP signals economic expansion; declines can indicate slowdowns or recessions.',
            'CPIAUCSL': 'Consumer price index measuring average price changes for urban consumers. Higher CPI indicates stronger inflation.',
            'PPIACO': 'Producer Price Index for all commodities. Tracks prices received by domestic producers and can lead consumer inflation.',
            'FEDFUNDS': 'Effective federal funds rate targeted by the Federal Reserve. Influences borrowing costs across the economy.',
            'MORTGAGE30US': 'Average interest rate on 30‑year fixed mortgages. Affects home affordability and buyer demand.',
            'MORTGAGE15US': 'Average interest rate on 15‑year fixed mortgages. Lower terms often have lower rates than 30‑year loans.',
            'RHVRUSQ156N': 'National rental vacancy rate. Higher values suggest looser rental markets; lower values indicate tighter supply.',
            'LREM64TTUSM156S': 'Total U.S. employment level. Growth points to a strengthening labor market and economy.',
            'POPTHM': 'Estimated U.S. population. Long‑term growth supports housing demand and economic activity.',
            'M2REAL': 'Inflation‑adjusted broad money supply (Real M2). Changes can reflect liquidity conditions in the economy.',
            'FPCPITOTLZGUSA': 'Annual consumer price inflation (World Bank). Indicates the pace of general price increases.',
            'GFDEBTN': 'Total U.S. federal public debt outstanding. Useful for context on fiscal conditions and interest costs.',
            'DGS10': '10‑year U.S. Treasury yield. Key benchmark for long‑term borrowing costs and mortgage rates.',
            'DGS2': '2‑year U.S. Treasury yield. Closely tracks expectations for Fed policy over the near term.',
            'ACTLISCOUUS': 'Number of homes actively listed for sale nationwide. Lower inventory often supports price growth.',
            'MSPUS': 'Median sale price of U.S. homes. Reflects typical transaction prices and market trends.',
            'NEWLISCOUUS': 'New residential listings entering the market. A gauge of seller activity and fresh supply.',
            'MEDDAYONMARUS': 'Median number of days homes spend on the market. Fewer days indicate stronger buyer demand.',
            'USSTHPI': 'FHFA national home price index. Measures changes in single‑family home values over time.',
            'UNRATE': 'U.S. unemployment rate. Lower rates indicate a tighter labor market and stronger economy.',
            'DJIA': 'Dow Jones Industrial Average stock index. A snapshot of large U.S. companies and market sentiment.'
        };

        function getSeriesDescription(seriesId) {
            return FRED_SERIES_DESCRIPTIONS[seriesId] || '';
        }

        function updateNationalChartUI() {
            try {
                const leftId = document.getElementById('leftChartSelect')?.value;
                const rightId = document.getElementById('rightChartSelect')?.value;
                const leftTitleEl = document.getElementById('leftChartTitleText');
                const rightTitleEl = document.getElementById('rightChartTitleText');
                const leftInfoIcon = document.getElementById('leftInfoIcon');
                const rightInfoIcon = document.getElementById('rightInfoIcon');
                const leftDescEl = document.getElementById('leftChartDescription');
                const rightDescEl = document.getElementById('rightChartDescription');

                if (leftId && leftTitleEl) leftTitleEl.textContent = (FRED_SERIES[leftId] || leftId);
                if (rightId && rightTitleEl) rightTitleEl.textContent = (FRED_SERIES[rightId] || rightId);
                const leftSub = document.getElementById('leftChartSubtitle');
                const rightSub = document.getElementById('rightChartSubtitle');
                if (leftSub) leftSub.textContent = 'Source: Federal Reserve';
                if (rightSub) rightSub.textContent = 'Source: Federal Reserve';

                const leftDesc = leftId ? getSeriesDescription(leftId) : '';
                const rightDesc = rightId ? getSeriesDescription(rightId) : '';
                // Do not set native title to avoid hover popups
                // Close any open popovers when changing series
                if (leftInfoIcon && leftInfoIcon._popover) { leftInfoIcon._popover.remove(); leftInfoIcon._popover = null; }
                if (rightInfoIcon && rightInfoIcon._popover) { rightInfoIcon._popover.remove(); rightInfoIcon._popover = null; }
                if (leftDescEl) leftDescEl.textContent = leftDesc;
                if (rightDescEl) rightDescEl.textContent = rightDesc;
            } catch {}
        }

        function setupNationalInfoToggles() {
            try {
                const leftIcon = document.getElementById('leftInfoIcon');
                const rightIcon = document.getElementById('rightInfoIcon');
                const leftDescEl = document.getElementById('leftChartDescription');
                const rightDescEl = document.getElementById('rightChartDescription');

                const createPopover = (anchorEl, content, side = 'bottom') => {
                    // Remove an existing popover first
                    const existing = anchorEl._popover;
                    if (existing) { existing.remove(); anchorEl._popover = null; }
                    // Create popover container
                    const pop = document.createElement('div');
                    pop.className = 'chart-popover';
                    pop.setAttribute('data-side', side);
                    pop.textContent = content;
                    const arrow = document.createElement('div');
                    arrow.className = 'chart-popover-arrow';
                    pop.appendChild(arrow);
                    document.body.appendChild(pop);
                    // Positioning
                    const rect = anchorEl.getBoundingClientRect();
                    const popRect = pop.getBoundingClientRect();
                    let top = rect.bottom + window.scrollY + 8;
                    let left = rect.left + window.scrollX + Math.round(rect.width / 2 - popRect.width / 2);
                    // Clamp within viewport with 8px margin
                    const margin = 8;
                    const maxLeft = window.scrollX + document.documentElement.clientWidth - popRect.width - margin;
                    const minLeft = window.scrollX + margin;
                    left = Math.max(minLeft, Math.min(maxLeft, left));
                    const maxTop = window.scrollY + document.documentElement.clientHeight - popRect.height - margin;
                    const minTop = window.scrollY + margin;
                    top = Math.max(minTop, Math.min(maxTop, top));
                    pop.style.top = `${top}px`;
                    pop.style.left = `${left}px`;
                    // Position arrow relative to anchor center but within pop width
                    const anchorCenter = rect.left + window.scrollX + rect.width / 2;
                    let arrowLeft = Math.round(anchorCenter - left - 5);
                    arrowLeft = Math.max(6, Math.min(popRect.width - 16, arrowLeft));
                    arrow.style.top = `-5px`;
                    arrow.style.left = `${arrowLeft}px`;
                    anchorEl._popover = pop;
                    // Dismiss on outside click or Escape
                    const onDocClick = (e) => {
                        if (!pop.contains(e.target) && e.target !== anchorEl) {
                            destroyPopover(anchorEl);
                            document.removeEventListener('click', onDocClick);
                        }
                    };
                    setTimeout(() => document.addEventListener('click', onDocClick), 0);
                    const onKey = (e) => { if (e.key === 'Escape') destroyPopover(anchorEl); };
                    document.addEventListener('keydown', onKey, { once: true });
                };

                const destroyPopover = (anchorEl) => {
                    if (anchorEl && anchorEl._popover) {
                        anchorEl._popover.remove();
                        anchorEl._popover = null;
                    }
                };

                const makeInteractive = (iconEl, descEl) => {
                    if (!iconEl || !descEl) return;
                    iconEl.setAttribute('tabindex', '0');
                    const show = () => createPopover(iconEl, descEl.textContent || iconEl.title || '');
                    const hide = () => destroyPopover(iconEl);
                    iconEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (iconEl._popover) hide(); else show();
                    });
                    iconEl.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (iconEl._popover) hide(); else show();
                        }
                    });
                };

                makeInteractive(leftIcon, leftDescEl);
                makeInteractive(rightIcon, rightDescEl);
            } catch {}
        }

        // Function to fetch and display FRED charts
        async function loadFredCharts(reportId) {
            let leftSeriesId = 'USSTHPI';  // Default
            let rightSeriesId = 'DJIA';    // Default
            
            try {
                // Load saved FRED charts from database
                const response = await fetch(`${API_BASE}/reports/${reportId}/fred-charts`);
                const result = await response.json();
                
                if (response.ok && result.success && result.data.length > 0) {
                    // Find left and right charts by chart_id (smaller = left, larger = right)
                    const sortedCharts = result.data.sort((a, b) => a.chart_id - b.chart_id);
                    const leftChart = sortedCharts[0];
                    const rightChart = sortedCharts[1];
                    
                    if (leftChart) leftSeriesId = leftChart.series_id;
                    if (rightChart) rightSeriesId = rightChart.series_id;
                }
            } catch (error) {
                console.error('Error loading FRED charts from database:', error);
                // Continue with defaults
            }
            
            // Set dropdown values and titles/descriptions
            document.getElementById('leftChartSelect').value = leftSeriesId;
            document.getElementById('rightChartSelect').value = rightSeriesId;
            updateNationalChartUI();
            
            // Setup dropdown event listeners with save functionality
            document.getElementById('leftChartSelect').addEventListener('change', async function() {
                const seriesId = this.value;
                const title = FRED_SERIES[seriesId] || seriesId;
                updateNationalChartUI();
                loadChartData('leftChart', seriesId, '#2E8B57');
                
                // Save to database
                await saveFredCharts(reportId);
            });
            
            document.getElementById('rightChartSelect').addEventListener('change', async function() {
                const seriesId = this.value;
                const title = FRED_SERIES[seriesId] || seriesId;
                updateNationalChartUI();
                loadChartData('rightChart', seriesId, '#1E90FF');
                
                // Save to database
                await saveFredCharts(reportId);
            });

            // Load initial charts
            loadChartData('leftChart', leftSeriesId, '#2E8B57');
            loadChartData('rightChart', rightSeriesId, '#1E90FF');
        }
        // Function to save FRED charts to database
        async function saveFredCharts(reportId) {
            try {
                const leftSeriesId = document.getElementById('leftChartSelect').value;
                const rightSeriesId = document.getElementById('rightChartSelect').value;
                
                const response = await fetch(`${API_BASE}/reports/${reportId}/fred-charts`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        leftSeriesId: leftSeriesId,
                        rightSeriesId: rightSeriesId
                    })
                });
                
                const result = await response.json();
                if (!response.ok || !result.success) {
                    console.error('Error saving FRED charts:', result.error);
                }
            } catch (error) {
                console.error('Error saving FRED charts:', error);
            }
        }

        // Function to load chart data
        function loadChartData(containerId, seriesId, color) {
            const currentDate = new Date();
            const fiveYearsAgo = new Date(currentDate.getFullYear() - 5, currentDate.getMonth(), currentDate.getDate());
            
            const startDate = fiveYearsAgo.toISOString().split('T')[0];
            const endDate = currentDate.toISOString().split('T')[0];
            
            const title = FRED_SERIES[seriesId] || seriesId;
            loadFredChart(seriesId, containerId, startDate, endDate, title, color);

            // Update inline descriptions and tooltips after data load trigger
            updateNationalChartUI();
        }
        // Function to load individual FRED chart
        async function loadFredChart(seriesId, containerId, startDate, endDate, title, color) {
            try {
                const response = await fetch(`${API_BASE}/fred-data?seriesId=${seriesId}&startDate=${startDate}&endDate=${endDate}`);
                const data = await response.json();
                
                if (data.observations && data.observations.length > 0) {
                    renderChart(containerId, data.observations, title, color);
                } else {
                    // Show no data message
                    const canvas = document.getElementById(containerId);
                    const loadingDiv = document.getElementById(containerId + '-loading');
                    if (loadingDiv) {
                        loadingDiv.style.display = 'none';
                    }
                    if (canvas) {
                        const parent = canvas.parentElement;
                        parent.innerHTML = `
                            <div style="display: flex; align-items: center; justify-content: center; height: 100%; text-align: center; color: #666;">
                                <p>No data available for ${title}</p>
                            </div>
                        `;
                    }
                }
            } catch (error) {
                console.error(`Error loading ${seriesId} data:`, error);
                const canvas = document.getElementById(containerId);
                const loadingDiv = document.getElementById(containerId + '-loading');
                if (loadingDiv) {
                    loadingDiv.style.display = 'none';
                }
                if (canvas) {
                    const parent = canvas.parentElement;
                    parent.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center; height: 100%; text-align: center; color: #e74c3c;">
                            <p>Error loading ${title} data</p>
                        </div>
                    `;
                }
            }
        }
        // Function to render a simple line chart using Chart.js
        function renderChart(containerId, observations, title, color) {
            const canvas = document.getElementById(containerId);
            const loadingDiv = document.getElementById(containerId + '-loading');
            
            if (!canvas) {
                console.error(`Canvas element ${containerId} not found`);
                return;
            }
            
            // Hide loading spinner
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }
            
            const validData = observations.filter(obs => obs.value !== '.' && !isNaN(parseFloat(obs.value)));
            
            if (validData.length === 0) {
                // Show error message
                const parent = canvas.parentElement;
                parent.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; text-align: center; color: #666;">
                        <p>No valid data available for ${title}</p>
                    </div>
                `;
                return;
            }

            // Get chart instance based on container ID
            let chartInstance;
            if (containerId === 'leftChart') {
                chartInstance = leftChartInstance;
            } else if (containerId === 'rightChart') {
                chartInstance = rightChartInstance;
            }

            // Destroy existing chart if it exists
            if (chartInstance) {
                chartInstance.destroy();
            }

            // Prepare data for Chart.js
            const chartData = validData.map(obs => ({
                x: obs.date,
                y: parseFloat(obs.value)
            }));

            const ctx = canvas.getContext('2d');
            
            // Create Chart.js configuration
            const config = {
                type: 'line',
                data: {
                    datasets: [{
                        label: title,
                        data: chartData,
                        backgroundColor: color + '20', // 20% opacity for fill
                        borderColor: color,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: color,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: (window.innerWidth <= 768 ? 0 : 3),
                        pointHoverRadius: (window.innerWidth <= 768 ? 0 : 6),
                        pointHoverBackgroundColor: color,
                        pointHoverBorderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                title: function(tooltipItems) {
                                    const date = new Date(tooltipItems[0].parsed.x);
                                    return date.toLocaleDateString();
                                },
                                label: function(context) {
                                    return `${title}: ${context.parsed.y.toLocaleString()}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'month',
                                displayFormats: {
                                    month: 'MMM yyyy'
                                }
                            },
                            grid: {
                                display: true,
                                color: '#f0f0f0'
                            },
                            ticks: {
                                color: '#666',
                                font: {
                                    size: 11
                                }
                            }
                        },
                        y: {
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
                                    return value.toLocaleString();
                                }
                            }
                        }
                    },
                    interaction: {
                        intersect: false
                    },
                    elements: {
                        line: {
                            tension: 0.4
                        }
                    }
                }
            };

            // Create the chart and store the instance
            const newChart = new Chart(ctx, config);
            
            if (containerId === 'leftChart') {
                leftChartInstance = newChart;
            } else if (containerId === 'rightChart') {
                rightChartInstance = newChart;
            }
        }

        // FRED Comparison Functionality for Area Charts
        let seriesOptionsCache = null;
        let selectionCount = 1;
        const maxSelections = 5;
        
        // Chart.js instances for FRED charts
        let leftChartInstance = null;
        let rightChartInstance = null;
        let comparisonChartInstance = null;
        
        // Chart.js instances for popup charts
        let salesCountChartInstance = null;
        let avgPriceChartInstance = null;
        
        // Available states for county selection (alphabetically sorted)
        const availableStates = [
            'Alabama', 'Arizona', 'California', 'Colorado', 'Connecticut', 'Florida',
            'Georgia', 'Illinois', 'Indiana', 'Kentucky', 'Louisiana', 'Maryland',
            'Massachusetts', 'Michigan', 'Minnesota', 'Missouri', 'New Jersey', 'New York',
            'North Carolina', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'South Carolina',
            'Tennessee', 'Texas', 'Utah', 'Virginia', 'Washington', 'Wisconsin'
        ];
        
        // Initialize FRED comparison functionality
        async function initializeFredComparison() {
            try {
                // Load series options
                await loadSeriesOptions();
                
                // Load saved comparison data for this report
                await loadSavedComparison();
                
                // Setup event listeners
                setupEventListeners();
                
            } catch (error) {
                console.error('Error initializing FRED comparison:', error);
                document.getElementById('chartsContent').innerHTML = `
                    <div class="info-item">
                        <div class="info-label">Area Charts</div>
                        <div class="info-value">Unable to load comparison tools. Please try refreshing the page.</div>
                    </div>
                `;
            }
        }
        
        // Load available FRED series from database
        async function loadSeriesOptions() {
            const seriesSelect = document.getElementById('series-select');
            if (!seriesSelect) {
                console.error('series-select element not found');
                throw new Error('series-select element not found in DOM');
            }
            seriesSelect.innerHTML = '';
            seriesOptionsCache = {};

            REALTOR_METRICS.forEach(metric => {
                seriesOptionsCache[metric.key] = metric;
                const option = document.createElement('option');
                option.value = metric.key;
                option.textContent = metric.label;
                seriesSelect.appendChild(option);
            });

            seriesSelect.value = DEFAULT_COUNTY_METRIC;
        }
        
        // Load saved comparison data for this report
        async function loadSavedComparison() {
            try {
                console.log('Loading saved comparison for report:', urlSlug);
                const response = await fetch(`${API_BASE}/reports/${urlSlug}/area-comparison`);
                const result = await response.json();
                
                if (response.ok && result.success && result.data) {
                    const savedData = result.data;
                    console.log('Found saved comparison:', savedData);
                    
                    // Set the series selection
                    if (savedData.series_id) {
                        document.getElementById('series-select').value = savedData.series_id;
                    }
                    
                    // Load the county locations and populate dropdowns
                    if (savedData.locations && savedData.locations.length > 0) {
                        await loadSavedLocations(savedData.locations);
                        // Auto-generate the chart with the loaded data
                        await generateComparison();
                    } else {
                        // No saved data, initialize with default Palm Beach County
                        resetToDefault();
                    }
                } else {
                    console.log('No saved comparison found, using defaults');
                    // No saved data, initialize with default Palm Beach County
                    resetToDefault();
                }
            } catch (error) {
                console.error('Error loading saved comparison:', error);
                // Fallback to default
                resetToDefault();
            }
        }
        
        // Load saved locations and populate the dropdowns
        async function loadSavedLocations(countyIds) {
            try {
                if (!window.__savedCountyNames) window.__savedCountyNames = {};
                if (!window.__savedCountyMetadata) window.__savedCountyMetadata = {};
                // Set the selection count based on saved locations
                selectionCount = countyIds.length;
                
                // Update the location selections UI
                await updateLocationSelections();
                
                // For each saved county ID, we need to find the state and set the dropdowns
                for (let i = 0; i < countyIds.length; i++) {
                    const countyId = countyIds[i];
                    const selectionIndex = i + 1;
                    
                    const countyInfo = await loadCountyById(countyId, selectionIndex);
                    if (countyInfo && countyInfo.name) {
                        window.__savedCountyNames[countyId] = countyInfo.name;
                        window.__savedCountyMetadata[countyId] = countyInfo;
                    }
                }
                
                updateButtons();
                
            } catch (error) {
                console.error('Error loading saved locations:', error);
                await resetToDefault();
            }
        }
        
        // Load county info by ID and set the appropriate dropdowns
        async function loadCountyById(countyId, selectionIndex) {
            try {
                // We need to find which state this county belongs to
                // We'll try each state until we find the county
                for (const state of availableStates) {
                    const response = await fetch(`${API_BASE}/counties?state=${encodeURIComponent(state)}`);
                    const result = await response.json();
                    
                    if (response.ok && result.success) {
                        const county = result.data.find(c => c.id === countyId);
                        if (county) {
                            const stateSelect = document.getElementById(`state-select-${selectionIndex}`);
                            const countySelect = document.getElementById(`county-select-${selectionIndex}`);

                            if (stateSelect && countySelect) {
                                stateSelect.value = state;
                                countySelect.innerHTML = '<option value="">Select County</option>';
                                const sortedCounties = result.data.sort((a, b) => a.name.localeCompare(b.name));
                                sortedCounties.forEach(countyOption => {
                                    const option = document.createElement('option');
                                    option.value = countyOption.id;
                                    option.textContent = countyOption.name;
                                    if (countyOption.id === countyId) {
                                        option.selected = true;
                                    }
                                    countySelect.appendChild(option);
                                });
                            }

                            return { state, name: county.name, id: county.id };
                        }
                    }
                }
                
                console.warn(`County ID ${countyId} not found in any state`);
            } catch (error) {
                console.error(`Error loading county by ID ${countyId}:`, error);
            }
        }
        
        // Setup event listeners for the comparison controls
        function setupEventListeners() {
            document.getElementById('add-location-btn').addEventListener('click', async () => {
                await addLocationSelection();
            });
            document.getElementById('remove-location-btn').addEventListener('click', async () => {
                await removeLocationSelection();
            });
            document.getElementById('compare-btn').addEventListener('click', async () => {
                const seriesSelect = document.getElementById('series-select');
                if (seriesSelect && (!seriesSelect.value || !realtorSeriesKeys.has(seriesSelect.value))) {
                    seriesSelect.value = DEFAULT_COUNTY_METRIC;
                }
                await generateComparison();
                showChartView(true);
            });
            document.getElementById('reset-comparison-btn').addEventListener('click', resetToDefault);
            document.getElementById('back-to-controls-btn').addEventListener('click', showControlsView);
            document.getElementById('chart-series-select').addEventListener('change', refreshChartWithNewIndicator);
        }
        
        // Show the controls view and hide the chart view
        function showControlsView() {
            document.getElementById('controls-section').style.display = 'block';
            document.getElementById('chart-section').style.display = 'none';
        }
        // Show the chart view and hide the controls view  
        function showChartView(autoGenerated) {
            document.getElementById('controls-section').style.display = 'none';
            document.getElementById('chart-section').style.display = 'block';
            populateChartSeriesSelector();
            if (!autoGenerated) {
                const seriesSelect = document.getElementById('series-select');
                const chartSeriesSelect = document.getElementById('chart-series-select');
                if (seriesSelect && (!seriesSelect.value || !realtorSeriesKeys.has(seriesSelect.value))) {
                    seriesSelect.value = DEFAULT_COUNTY_METRIC;
                    if (chartSeriesSelect) {
                        chartSeriesSelect.value = DEFAULT_COUNTY_METRIC;
                    }
                }
            }
        }
        
        // Add a new location selection dropdown
        async function addLocationSelection() {
            if (selectionCount >= maxSelections) return;
            
            selectionCount++;
            await updateLocationSelections();
            updateButtons();
        }
        
        // Remove the last location selection
        async function removeLocationSelection() {
            if (selectionCount <= 1) return;
            
            selectionCount--;
            await updateLocationSelections();
            updateButtons();
        }
        // Update the location selection interface
        async function updateLocationSelections() {
            const container = document.getElementById('location-selections');
            
            // Store current selections before updating
            const currentSelections = {};
            for (let i = 1; i <= Math.max(selectionCount, container.children.length); i++) {
                const stateSelect = document.getElementById(`state-select-${i}`);
                const countySelect = document.getElementById(`county-select-${i}`);
                if (stateSelect && countySelect) {
                    currentSelections[i] = {
                        state: stateSelect.value,
                        county: countySelect.value
                    };
                }
            }
            
            // Only rebuild if we need more elements or fewer elements
            const currentCount = container.children.length;
            
            if (selectionCount > currentCount) {
                // Add new location selections
                for (let i = currentCount + 1; i <= selectionCount; i++) {
                    const locationDiv = document.createElement('div');
                    locationDiv.className = 'location-selection';
                    locationDiv.id = `location-${i}`;
                    locationDiv.innerHTML = `
                        <div>
                            <label>State Selection</label>
                            <select id="state-select-${i}">
                                <option value="">Choose State</option>
                                ${availableStates.map(state => 
                                    `<option value="${state}"${state === 'Florida' && i === 1 ? ' selected' : ''}>${state}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div>
                            <label>County Selection</label>
                            <select id="county-select-${i}">
                                <option value="">Choose County</option>
                            </select>
                        </div>
                    `;
                    container.appendChild(locationDiv);
                    const stateEl = document.getElementById(`state-select-${i}`);
                    if (stateEl) {
                        stateEl.addEventListener('change', () => updateCounties(i));
                    }
                }
            } else if (selectionCount < currentCount) {
                // Remove excess location selections
                for (let i = currentCount; i > selectionCount; i--) {
                    const locationDiv = document.getElementById(`location-${i}`);
                    if (locationDiv) {
                        locationDiv.remove();
                    }
                }
            }
            
            // Restore previous selections
            for (let i = 1; i <= selectionCount; i++) {
                const stateSelect = document.getElementById(`state-select-${i}`);
                const countySelect = document.getElementById(`county-select-${i}`);
                const savedMeta = Object.values(window.__savedCountyMetadata || {}).find(meta => meta.id === currentSelections[i]?.county);
                
                if (currentSelections[i] && currentSelections[i].state) {
                    // Restore state selection
                    stateSelect.value = currentSelections[i].state;
                    
                    // Load counties for this state and then restore county selection
                    await updateCounties(i);
                    
                    // Restore county selection
                    if (currentSelections[i].county) {
                        countySelect.value = currentSelections[i].county;
                    }
                } else if (savedMeta) {
                    stateSelect.value = savedMeta.state;
                    await updateCounties(i);
                    countySelect.value = savedMeta.id;
                } else if (i === 1 && !currentSelections[i]) {
                    // Default first selection to Florida if no previous selection
                    stateSelect.value = 'Florida';
                    await updateCounties(i);
                    countySelect.value = '12099';
                }

                if (window.__savedZipCodes && window.__savedZipCodes[i - 1]) {
                    const zipInput = document.getElementById(`zip-input-${i}`);
                    if (zipInput) {
                        zipInput.value = window.__savedZipCodes[i - 1];
                    }
                }
            }
        }
        
        // Update counties dropdown when state changes
        async function updateCounties(selectionIndex) {
            const stateSelect = document.getElementById(`state-select-${selectionIndex}`);
            const countySelect = document.getElementById(`county-select-${selectionIndex}`);
            
            if (!stateSelect.value) {
                countySelect.innerHTML = '<option value="">Select County</option>';
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/counties?state=${encodeURIComponent(stateSelect.value)}`);
                const result = await response.json();
                
                if (!response.ok || !result.success) {
                    throw new Error('Failed to fetch counties');
                }
                
                countySelect.innerHTML = '<option value="">Select County</option>';
                
                // Sort counties alphabetically by name
                const sortedCounties = result.data.sort((a, b) => a.name.localeCompare(b.name));
                
                sortedCounties.forEach(county => {
                    const option = document.createElement('option');
                    option.value = county.id;
                    option.textContent = county.name;
                    
                    // Default Palm Beach County for Florida
                    if (selectionIndex === 1 && stateSelect.value === 'Florida' && county.name === 'Palm Beach County' && !countySelect.value) {
                        option.selected = true;
                    }
                    
                    countySelect.appendChild(option);
                });
                
            } catch (error) {
                console.error('Error fetching counties:', error);
                countySelect.innerHTML = '<option value="">Error loading counties</option>';
            }
        }
        
        // Delegate change events for dynamically created state selects (CSP-safe)
        (function attachStateChangeDelegation() {
            const container = document.getElementById('location-selections');
            if (container && !container._delegated) {
                container.addEventListener('change', (e) => {
                    const target = e.target;
                    if (target && target.id && target.id.indexOf('state-select-') === 0) {
                        const parts = String(target.id).split('-');
                        const idxStr = parts[parts.length - 1];
                        const idx = parseInt(idxStr, 10);
                        if (Number.isFinite(idx)) {
                            updateCounties(idx);
                        }
                    }
                });
                container._delegated = true;
            }
        })();
        
        // Update button visibility
        function updateButtons() {
            const addBtn = document.getElementById('add-location-btn');
            const removeBtn = document.getElementById('remove-location-btn');
            
            addBtn.style.display = selectionCount >= maxSelections ? 'none' : 'inline-block';
            removeBtn.style.display = selectionCount <= 1 ? 'none' : 'inline-block';
        }
        
        // Reset to default (Palm Beach County only)
        async function resetToDefault() {
            selectionCount = 1;
            await updateLocationSelections();
            updateButtons();
            
            // Clear any existing chart, header, and notices
            if (comparisonChartInstance) {
                comparisonChartInstance.destroy();
                comparisonChartInstance = null;
            }
            document.getElementById('chart-loading').style.display = 'none';
            document.getElementById('chart-error').style.display = 'none';
            document.getElementById('comparison-chart-header').style.display = 'none';
            document.getElementById('data-availability-notice').style.display = 'none';
            
            // Reset series selection to default
            const seriesSelect = document.getElementById('series-select');
            const defaultSeries = 'ACTIVE_COUNTY_INVENTORY';
            if (seriesOptionsCache && seriesOptionsCache[defaultSeries]) {
                seriesSelect.value = defaultSeries;
            } else if (seriesSelect.options.length > 1) {
                seriesSelect.selectedIndex = 1; // First non-empty option
            }
            
            // Clear saved comparison data
            await clearSavedComparison();
            
            // Switch back to controls view
            showControlsView();
        }
        
        // Clear saved comparison data from database
        async function clearSavedComparison() {
            try {
                // Save empty data to effectively clear the comparison
                const response = await fetch(`${API_BASE}/reports/${urlSlug}/area-comparison`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        seriesId: 'ACTIVE_COUNTY_INVENTORY',
                        countyIds: ['12099'] // Default Palm Beach County
                    })
                });
                
                if (!response.ok) {
                    console.warn('Failed to clear saved comparison data');
                }
            } catch (error) {
                console.error('Error clearing saved comparison data:', error);
            }
        }
        
        // Generate the comparison chart
        async function generateComparison() {
            const seriesSelect = document.getElementById('series-select');
            const selectedSeries = seriesSelect.value;
            
            if (!selectedSeries || !seriesOptionsCache || !realtorSeriesKeys.has(selectedSeries)) {
                document.getElementById('chart-loading').style.display = 'none';
                document.getElementById('chart-error').style.display = 'flex';
                document.getElementById('comparison-chart-header').style.display = 'none';
                return;
            }
            
            // Collect all selections  
            const selections = [];
            let hasValidSelections = false;
            
            for (let i = 1; i <= selectionCount; i++) {
                const stateSelect = document.getElementById(`state-select-${i}`);
                const countySelect = document.getElementById(`county-select-${i}`);
                
                if (stateSelect && countySelect && stateSelect.value && countySelect.value) {
                    const countyId = countySelect.value.trim();
                    selections.push({
                        state: stateSelect.value,
                        county: countyId,
                        countyName: (window.__savedCountyNames && window.__savedCountyNames[countyId]) || countySelect.options[countySelect.selectedIndex]?.text || countyId
                    });
                    hasValidSelections = true;
                }
            }
            
            if (!hasValidSelections) {
                alert('Please select at least one location to compare');
                return;
            }
            
            // Save the comparison data before generating chart
            await saveComparisonData(selectedSeries, selections);
            
            // Switch to chart view and show loading state
            showChartView();
            document.getElementById('chart-loading').style.display = 'flex';
            document.getElementById('chart-error').style.display = 'none';
            if (comparisonChartInstance) {
                comparisonChartInstance.destroy();
                comparisonChartInstance = null;
            }
            
            try {
                const seriesOption = seriesOptionsCache[selectedSeries];
                if (!seriesOption || !realtorSeriesKeys.has(selectedSeries)) {
                    alert('Selected metric is not available. Please choose another option.');
                    return;
                }
                const chartData = {};
                const countyNames = {};
                const unavailableLocations = [];

            const countyData = await fetchCountySeriesData(selections.map(sel => sel.county), selectedSeries);
                console.debug('Transforming countyData for chart', { selectedSeries, countyDataSample: countyData.slice(0, 5) });
            countyData.forEach(({ county, name, points }) => {
                chartData[county] = points;
                countyNames[county] = name;
            });
                selections.forEach(sel => {
                    if (!chartData[sel.county]) {
                        unavailableLocations.push({ name: sel.countyName, seriesId: selectedSeries });
                    }
                });

                document.getElementById('chart-loading').style.display = 'none';

                if (Object.keys(chartData).length === 0) {
                document.getElementById('chart-error').style.display = 'flex';
                document.getElementById('comparison-chart-header').style.display = 'none';
                    return;
                }

                document.getElementById('comparison-chart-header').style.display = 'block';
                console.debug('Rendering chart with data', { seriesOption, chartData });
                createSimpleComparisonChart(chartData, countyNames, seriesOption.label, seriesOption);

            displayDataAvailabilityNotice(unavailableLocations, seriesOption.label);

            } catch (error) {
                console.error('Error generating comparison:', error);
                document.getElementById('chart-loading').style.display = 'none';
                document.getElementById('chart-error').style.display = 'flex';
            }
        }
        // Save comparison data to database
        async function saveComparisonData(seriesId, selections) {
            try {
                console.log('Saving comparison data:', { seriesId, selections });
                
                // Extract county IDs from selections
                const countyIds = selections.map(selection => selection.county);

                const response = await fetch(`${API_BASE}/reports/${urlSlug}/area-comparison`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        seriesId: seriesId,
                        countyIds: countyIds
                    })
                });
                
                const result = await response.json();
                if (!response.ok || !result.success) {
                    console.error('Error saving comparison data:', result.error);
                } else {
                    console.log('Comparison data saved successfully');
                }
            } catch (error) {
                console.error('Error saving comparison data:', error);
                // Don't block the chart generation if save fails
            }
        }
        // Fetch FRED data for a specific series
        async function fetchFredData(seriesId) {
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 5))
                .toISOString().split('T')[0];
            
            const response = await fetch(`${API_BASE}/fred-data?seriesId=${seriesId}&startDate=${startDate}&endDate=${endDate}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch FRED data');
            }
            
            return data.observations || [];
        }
        // Create a simple comparison chart using Chart.js
        function createSimpleComparisonChart(chartData, countyNames, title, seriesOption) {
            const canvas = document.getElementById('comparison-chart');
            
            if (!canvas) {
                console.error('Comparison chart canvas not found');
                return;
            }
            
            // Function to get color for a county
            function getCountyColor(countyId) {
                const countyName = countyNames[countyId] || '';
                if (countyId === '12099' || countyName.includes('Palm Beach')) {
                    return '#003366';
                }
                const otherColors = ['#e74c3c', '#f39c12', '#27ae60', '#9b59b6', '#3498db', '#e67e22', '#1abc9c', '#34495e', '#f1c40f', '#8e44ad'];
                const nonPalmBeachIds = Object.keys(countyNames).filter(id => id !== '12099' && !countyNames[id].includes('Palm Beach'));
                const colorIndex = nonPalmBeachIds.indexOf(countyId);
                return otherColors[colorIndex % otherColors.length];
            }
            
            if (comparisonChartInstance) {
                comparisonChartInstance.destroy();
            }
            
            const datasets = Object.entries(chartData).map(([countyId, series]) => {
                const color = getCountyColor(countyId);
                const countyName = countyNames[countyId] || `County ${countyId}`;
                const seriesPoints = Array.isArray(series) ? series : (series && Array.isArray(series.points) ? series.points : []);
                
                return {
                    label: countyName.replace(' County', ''),
                    data: seriesPoints.map(point => ({
                        x: point?.x,
                        y: (point?.y === null || point?.y === undefined || isNaN(point?.y)) ? null : point.y
                    })),
                    backgroundColor: color + '20',
                    borderColor: color,
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: color,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: color,
                    pointHoverBorderColor: '#ffffff',
                    clip: 0
                };
            });
            
            console.debug('County chart datasets', {
                title,
                seriesOption,
                datasetCount: datasets.length,
                samples: datasets.map(ds => ({
                    label: ds.label,
                    points: ds.data.slice(0, 5)
                }))
            });
            
            const ctx = canvas.getContext('2d');
            
            // Compute y padding so series do not hug edges
            const flatValues = datasets.flatMap(ds => (ds.data || []).map(d => d && d.y).filter(v => v != null && !isNaN(v)));
            const yMin = flatValues.length ? Math.min(...flatValues) : 0;
            const yMax = flatValues.length ? Math.max(...flatValues) : 1;
            const yPad = (yMax - yMin) * 0.08;
            const suggestedMin = Math.max(0, yMin - yPad);
            const suggestedMax = yMax + yPad * 0.5;

            // Create Chart.js configuration
            const config = {
                type: 'line',
                data: {
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { left: 16, right: 16, top: 8, bottom: 12 } },
                    plugins: {
                        title: {
                            display: true,
                            text: title,
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            color: '#333'
                        },
                        legend: {
                            display: true,
                            position: 'right',
                            labels: {
                                usePointStyle: false,
                                boxWidth: 14,
                                boxHeight: 4,
                                font: {
                                    size: 11
                                },
                                color: '#333'
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                title: function(tooltipItems) {
                                    const date = new Date(tooltipItems[0].parsed.x);
                                    return date.toLocaleDateString();
                                },
                                label: function(context) {
                                    return `${context.dataset.label}: ${formatMetricValue(context.parsed.y, seriesOption)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'month',
                                displayFormats: {
                                    month: 'MMM yyyy'
                                }
                            },
                            offset: true,
                            grid: {
                                display: true,
                                color: '#f0f0f0'
                            },
                            ticks: {
                                color: '#666',
                                font: {
                                    size: 11
                                }
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
                                    return formatMetricValue(value, seriesOption);
                                }
                            }
                        }, computeYAxisConfig(seriesOption, datasets))
                    },
                    interaction: {
                        intersect: false
                    },
                    elements: {
                        line: {
                            tension: 0.4
                        },
                        point: {
                            radius: (window.innerWidth <= 768 ? 0 : 3),
                            hitRadius: (window.innerWidth <= 768 ? 4 : 6),
                            hoverRadius: (window.innerWidth <= 768 ? 0 : 4)
                        }
                    }
                }
            };

            // Create the chart and store the instance
            comparisonChartInstance = new Chart(ctx, config);
        }
        
        // Display professional notice for unavailable data series
        function displayDataAvailabilityNotice(unavailableLocations, seriesName) {
            const noticeContainer = document.getElementById('data-availability-notice');
            
            if (unavailableLocations.length === 0) {
                noticeContainer.style.display = 'none';
                return;
            }
            
            const locationsList = unavailableLocations.map(location => 
                `<li>${location.name}</li>`
            ).join('');
            
            const pluralText = unavailableLocations.length === 1 ? 'location' : 'locations';
            const verbText = unavailableLocations.length === 1 ? 'is' : 'are';
            
            noticeContainer.innerHTML = `
                <div class="data-notice-header">
                    <svg class="data-notice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h4 class="data-notice-title">Data Availability Notice</h4>
                </div>
                <p class="data-notice-content">
                    The <strong>${seriesName}</strong> indicator ${verbText} currently unavailable for the following ${pluralText}. 
                    This may be due to data collection schedules or regional reporting variations. 
                    The analysis above reflects all available data sources.
                </p>
                <ul class="unavailable-locations">
                    ${locationsList}
                </ul>
            `;
            
            noticeContainer.style.display = 'block';
        }
        
        // Populate the chart view series selector with the same options as the main selector
        function populateChartSeriesSelector() {
            const mainSeriesSelect = document.getElementById('series-select');
            const chartSeriesSelect = document.getElementById('chart-series-select');
            
            if (!mainSeriesSelect || !chartSeriesSelect) {
                console.error('Series select elements not found');
                return;
            }
            
            chartSeriesSelect.innerHTML = '<option value="">Select Indicator...</option>';
            REALTOR_METRICS.forEach(metric => {
                const opt = document.createElement('option');
                opt.value = metric.key;
                opt.textContent = metric.label;
                chartSeriesSelect.appendChild(opt);
            });
            chartSeriesSelect.value = mainSeriesSelect.value && realtorSeriesKeys.has(mainSeriesSelect.value)
                ? mainSeriesSelect.value
                : DEFAULT_COUNTY_METRIC;
        }
        // Handle indicator change in chart view - refresh the chart with new indicator
        async function refreshChartWithNewIndicator() {
            const chartSeriesSelect = document.getElementById('chart-series-select');
            const selectedSeries = chartSeriesSelect.value;
            
            if (!selectedSeries || !seriesOptionsCache) {
                return;
            }
            
            // Also update the main series selector to keep them in sync
            const mainSeriesSelect = document.getElementById('series-select');
            if (mainSeriesSelect) {
                mainSeriesSelect.value = selectedSeries;
            }
            
            // Get current location selections (they should still be available from the previous generation)
            const selections = [];
            
            for (let i = 1; i <= selectionCount; i++) {
                const stateSelect = document.getElementById(`state-select-${i}`);
                const countySelect = document.getElementById(`county-select-${i}`);
                
                if (stateSelect && countySelect && stateSelect.value && countySelect.value) {
                    selections.push({
                        state: stateSelect.value,
                        county: countySelect.value,
                        countyName: countySelect.options[countySelect.selectedIndex].text
                    });
                }
            }
            
            if (selections.length === 0) {
                console.error('No location selections found for chart refresh');
                return;
            }
            
            // Save the new comparison data
            await saveComparisonData(selectedSeries, selections);
            
            // Show loading state
            document.getElementById('chart-loading').style.display = 'flex';
            document.getElementById('chart-error').style.display = 'none';
            if (comparisonChartInstance) {
                comparisonChartInstance.destroy();
                comparisonChartInstance = null;
            }
            
            try {
                const seriesOption = seriesOptionsCache[selectedSeries];
                if (!seriesOption) {
                    alert('Selected metric is not available. Please choose another option.');
                    return;
                }
                const chartData = {};
                const countyNames = {};
                const unavailableLocations = [];

                const countyData = await fetchCountySeriesData(selections.map(sel => sel.county), selectedSeries);
                countyData.forEach(({ county, name, points }) => {
                    chartData[county] = points;
                    countyNames[county] = name;
                });
                selections.forEach(sel => {
                    if (!chartData[sel.county]) {
                        unavailableLocations.push({ name: sel.countyName, seriesId: selectedSeries });
                    }
                });

                document.getElementById('chart-loading').style.display = 'none';

                if (Object.keys(chartData).length === 0) {
                    document.getElementById('chart-error').style.display = 'flex';
                    document.getElementById('comparison-chart-header').style.display = 'none';
                    return;
                }

                document.getElementById('comparison-chart-header').style.display = 'block';
                createSimpleComparisonChart(chartData, countyNames, seriesOption.label, seriesOption);

                if (unavailableLocations.length > 0) {
                    displayDataAvailabilityNotice(unavailableLocations, seriesOption.label);
                } else {
                    // Hide the notice if all data is available
                    document.getElementById('data-availability-notice').style.display = 'none';
                }
                
            } catch (error) {
                console.error('Error refreshing chart with new indicator:', error);
                document.getElementById('chart-loading').style.display = 'none';
                document.getElementById('chart-error').style.display = 'flex';
            }
        }
        
        // Map functionality
        let map = null;
        let currentDevelopmentName = null;
        
        // Initialize map button click handler
        function initializeMapButton() {
            const mapButton = document.getElementById('mapButton');
            if (mapButton) {
                mapButton.addEventListener('click', openDevelopmentMap);
            }
        }
        
        // Open development map in modal
        async function openDevelopmentMap() {
            const modal = document.getElementById('mapModal');
            const loading = document.getElementById('mapLoading');
            const error = document.getElementById('mapError');
            const subtitle = document.getElementById('mapSubtitle');
            
            // Guard: disable map for out-of-state properties
            try {
                if (window.isOutOfState === true) {
                    showMapError('Map is available only for Florida properties.');
                    return;
                }
            } catch (_) {}
            
            // Get development name from current report data
            const reportData = getCurrentReportData();
            if (!reportData || !reportData.development) {
                showMapError('No development information available for this property.');
                return;
            }
            
            currentDevelopmentName = reportData.development.trim();
            subtitle.textContent = `Showing parcels for ${currentDevelopmentName}`;
            
            // Show modal and loading state
            modal.style.display = 'block';
            loading.style.display = 'flex';
            error.style.display = 'none';
            
            try {
                // Fetch parcel data
                const response = await fetch(`${API_BASE}/development-parcels/${encodeURIComponent(currentDevelopmentName)}`);
                const result = await response.json();
                
                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Failed to load parcel data');
                }
                
                if (!result.data || !result.data.features || result.data.features.length === 0) {
                    throw new Error('No parcels found for this development');
                }
                
                // Initialize map
                await initializeMap(result.data);
                
            } catch (error) {
                console.error('Error loading development map:', error);
                showMapError(error.message);
            } finally {
                loading.style.display = 'none';
            }
        }
        // Initialize Leaflet map with parcel data
        async function initializeMap(geojsonData) {
            const mapContainer = document.getElementById('developmentMap');
            
            // Clear existing map
            if (map) {
                map.remove();
                map = null;
            }
            
            // Create new map
            map = L.map('developmentMap', {
                zoomControl: true,
                scrollWheelZoom: true
            });
            
            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            
            // Color mode state and helpers
            let colorMode = 'none';
            let valueThresholds = null; // used for price/value modes
            let valueMin = null;
            let valueMax = null;
            const COLOR_MAP = {
                gray: '#6c757d',
                yellow: '#FFD54F',
                green: '#2ECC71',
                blue: '#3498DB',
                red: '#E74C3C',
                orange: '#F39C12',
                darkGreen: '#006400',
                lightGreen: '#90EE90',
                purple: '#8E44AD'
            };

            function parseDateSafe(value) {
                if (!value) return null;
                let v = String(value).trim();
                if (!v) return null;
                // Normalize common formats: YYYYMMDD, MM/DD/YYYY, YYYY-MM-DD
                if (/^\d{8}$/.test(v)) {
                    // Assume YYYYMMDD
                    v = `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`;
                } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) {
                    const [m, d, y] = v.split('/');
                    const year = y.length === 2 ? `20${y}` : y;
                    v = `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                }
                const d = new Date(v);
                return isNaN(d.getTime()) ? null : d;
            }

            function monthsBetween(fromDate, toDate) {
                const years = toDate.getFullYear() - fromDate.getFullYear();
                const months = toDate.getMonth() - fromDate.getMonth();
                const total = years * 12 + months + (toDate.getDate() >= fromDate.getDate() ? 0 : -1);
                return total;
            }

            function currencyFormat(n) {
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
            }

            function computeQuantileThresholds(values) {
                const nums = values.filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
                if (nums.length === 0) return null;
                function quantile(p) {
                    const idx = Math.floor((nums.length - 1) * p);
                    return nums[idx];
                }
                return {
                    q50: quantile(0.50),
                    q75: quantile(0.75),
                    q85: quantile(0.85),
                    q95: quantile(0.95)
                };
            }

            function colorByTaxSaleDate(props) {
                const now = new Date();
                const d = parseDateSafe(props.last_sale_date);
                if (!d) return COLOR_MAP.gray;
                const m = monthsBetween(d, now);
                if (m < 6) return COLOR_MAP.yellow;
                if (m < 12) return COLOR_MAP.green;
                if (m < 24) return COLOR_MAP.blue;
                if (m < 60) return COLOR_MAP.red;
                return COLOR_MAP.orange; // 5+ years
            }

            function colorBySoldSinceCovid(props) {
                const d = parseDateSafe(props.last_sale_date);
                if (!d) return COLOR_MAP.gray;
                const covid = new Date('2020-01-01');
                return d >= covid ? COLOR_MAP.green : COLOR_MAP.gray;
            }

            function colorByValue(value) {
                if (value == null) return COLOR_MAP.gray;
                const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[$,]/g, ''));
                if (isNaN(num) || !valueThresholds) return COLOR_MAP.gray;
                const { q50, q75, q85, q95 } = valueThresholds;
                if (num >= q95) return COLOR_MAP.darkGreen;   // top 5%
                if (num >= q85) return COLOR_MAP.lightGreen;  // top 15%
                if (num >= q75) return COLOR_MAP.yellow;      // top 25%
                if (num >= q50) return COLOR_MAP.orange;      // top 50%
                return COLOR_MAP.red;                           // remaining
            }

            function colorByMlsStatus(props) {
                const status = (props.mls_status || '').toLowerCase();
                if (!status) return COLOR_MAP.gray;
                if (status === 'coming soon') return COLOR_MAP.purple;
                if (status === 'active') return COLOR_MAP.green;
                if (status === 'active under contract') return COLOR_MAP.orange;
                if (status === 'pending') return COLOR_MAP.blue;
                if (status === 'closed') {
                    // last 6 months yellow, older red
                    const sd = parseDateSafe(props.mls_sold_date);
                    if (!sd) return COLOR_MAP.gray;
                    const m = monthsBetween(sd, new Date());
                    return m <= 6 ? COLOR_MAP.yellow : COLOR_MAP.red;
                }
                return COLOR_MAP.gray;
            }

            function defaultLandUseStyle(props) {
                const landUse = (props.land_use_description || '').toString();
                const isCondo = landUse.toUpperCase().includes('CONDOMINIUM');
                return {
                    color: isCondo ? COLOR_MAP.purple : '#3498db',
                    weight: 2,
                    fillColor: isCondo ? COLOR_MAP.purple : '#3498db',
                    fillOpacity: 0.6
                };
            }

            function computeStyleByMode(props) {
                if (colorMode === 'none') {
                    return defaultLandUseStyle(props);
                }
                let outline = '#333';
                let fill = COLOR_MAP.blue;
                switch (colorMode) {
                    case 'tax_sale_date':
                        fill = colorByTaxSaleDate(props);
                        break;
                    case 'tax_sale_price':
                        fill = colorByValue(parseFloat(props.last_sale_price));
                        break;
                    case 'tax_market_value':
                        fill = colorByValue(parseFloat(props.market_value));
                        break;
                    case 'sold_since_covid':
                        fill = colorBySoldSinceCovid(props);
                        break;
                    case 'mls_status':
                        fill = colorByMlsStatus(props);
                        break;
                    default:
                        break;
                }
                return { color: outline, weight: 2, fillColor: fill, fillOpacity: 0.75 };
            }

            // Clean up any existing legend/control from prior sessions
            const parentEl = mapContainer.parentElement;
            const oldLegend = parentEl.querySelector('#mapLegend');
            if (oldLegend) { try { oldLegend.remove(); } catch(_) {} }
            const oldControl = parentEl.querySelector('#colorModeControl');
            if (oldControl) { try { oldControl.remove(); } catch(_) {} }

            // Legend UI
            const legend = document.createElement('div');
            legend.id = 'mapLegend';
            legend.style.position = 'absolute';
            legend.style.bottom = '16px';
            legend.style.right = '16px';
            legend.style.background = 'rgba(255,255,255,0.95)';
            legend.style.border = '1px solid #dee2e6';
            legend.style.borderRadius = '8px';
            legend.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
            legend.style.padding = '12px 14px';
            legend.style.minWidth = '220px';
            legend.style.fontSize = '12px';
            legend.style.zIndex = '1200';
            legend.innerHTML = '';
            parentEl.appendChild(legend);

            function renderLegend() {
                function swatch(color, label) {
                    return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
                        <span style="display:inline-block;width:14px;height:14px;background:${color};border:1px solid #999;border-radius:3px;"></span>
                        <span>${label}</span>
                    </div>`;
                }

                if (colorMode === 'none') {
                    legend.innerHTML = '';
                    return;
                }

                if (colorMode === 'tax_sale_date') {
                    legend.innerHTML = `
                        <div style="font-weight:600;margin-bottom:6px;">Legend: Tax Last Sale Date</div>
                        ${swatch(COLOR_MAP.yellow, 'Less than 6 months')}
                        ${swatch(COLOR_MAP.green, '6 months to 1 year')}
                        ${swatch(COLOR_MAP.blue, '1 to 2 years')}
                        ${swatch(COLOR_MAP.red, '2 to 5 years')}
                        ${swatch(COLOR_MAP.orange, 'More than 5 years')}
                        ${swatch(COLOR_MAP.gray, 'No data')}
                    `;
                } else if (colorMode === 'sold_since_covid') {
                    const features = (geojsonData && geojsonData.features) ? geojsonData.features : [];
                    const totalCount = features.length;
                    let yesCount = 0;
                    for (let i = 0; i < features.length; i++) {
                        const props = features[i] && features[i].properties ? features[i].properties : {};
                        const d = parseDateSafe(props.last_sale_date);
                        if (d && d >= new Date('2020-01-01')) yesCount++;
                    }
                    const noCount = Math.max(0, totalCount - yesCount);
                    const pct = (n) => totalCount > 0 ? (Math.round((n / totalCount) * 1000) / 10).toFixed(1) : '0.0';
                    legend.innerHTML = `
                        <div style="font-weight:600;margin-bottom:6px;">Legend: Sold Since Covid</div>
                        ${swatch(COLOR_MAP.green, `Sold since Covid — ${yesCount} (${pct(yesCount)}%)`)}
                        ${swatch(COLOR_MAP.gray, `Not sold since Covid — ${noCount} (${pct(noCount)}%)`)}
                    `;
                } else if (colorMode === 'tax_sale_price' || colorMode === 'tax_market_value') {
                    if (!valueThresholds || valueMin == null || valueMax == null) { legend.innerHTML = ''; return; }
                    const { q50, q75, q85, q95 } = valueThresholds;
                    const range = (a, b) => `${currencyFormat(a)} - ${currencyFormat(b)}`;
                    legend.innerHTML = `
                        <div style="font-weight:600;margin-bottom:6px;">Legend: ${colorMode === 'tax_sale_price' ? 'Tax Last Sale Price' : 'Tax Market Value'}</div>
                        ${swatch(COLOR_MAP.darkGreen, range(q95, valueMax))}
                        ${swatch(COLOR_MAP.lightGreen, range(q85, q95))}
                        ${swatch(COLOR_MAP.yellow, range(q75, q85))}
                        ${swatch(COLOR_MAP.orange, range(q50, q75))}
                        ${swatch(COLOR_MAP.red, range(valueMin, q50))}
                        ${swatch(COLOR_MAP.gray, 'No data')}
                    `;
                } else if (colorMode === 'mls_status') {
                    legend.innerHTML = `
                        <div style="font-weight:600;margin-bottom:6px;">Legend: MLS Status</div>
                        ${swatch(COLOR_MAP.green, 'Active')}
                        ${swatch(COLOR_MAP.orange, 'Active Under Contract')}
                        ${swatch(COLOR_MAP.yellow, 'Closed (Last 6 months)')}
                        ${swatch(COLOR_MAP.red, 'Closed (Older)')}
                        ${swatch(COLOR_MAP.purple, 'Coming Soon')}
                        ${swatch(COLOR_MAP.blue, 'Pending')}
                        ${swatch(COLOR_MAP.gray, 'No Data')}
                    `;
                } else {
                    legend.innerHTML = '';
                }
            }

            function recomputeThresholdsIfNeeded(features) {
                if (colorMode === 'tax_sale_price') {
                    const vals = features.map(f => parseFloat(String(f.properties.last_sale_price || '').toString().replace(/[$,]/g, ''))).filter(v => !isNaN(v));
                    valueThresholds = computeQuantileThresholds(vals);
                    if (vals.length > 0) { valueMin = Math.min(...vals); valueMax = Math.max(...vals); } else { valueMin = valueMax = null; }
                } else if (colorMode === 'tax_market_value') {
                    const vals = features.map(f => parseFloat(String(f.properties.market_value || '').toString().replace(/[$,]/g, ''))).filter(v => !isNaN(v));
                    valueThresholds = computeQuantileThresholds(vals);
                    if (vals.length > 0) { valueMin = Math.min(...vals); valueMax = Math.max(...vals); } else { valueMin = valueMax = null; }
                } else {
                    valueThresholds = null; valueMin = valueMax = null;
                }
            }

            function updateParcelStyles() {
                parcelLayer.eachLayer(function(layer) {
                    const props = layer.feature.properties;
                    const style = computeStyleByMode(props);
                    layer.setStyle(style);
                });
                renderLegend();
            }

            // Add parcel polygons
            const parcelLayer = L.geoJSON(geojsonData, {
                style: function(feature) {
                    return computeStyleByMode(feature.properties);
                },
                onEachFeature: function(feature, layer) {
                    // Create popup content using tax record template
                    const props = feature.properties;
                    const landUse = props.land_use_description || '';
                    const isCondominium = landUse.toUpperCase().includes('CONDOMINIUM');
                    
                    let popupContent;
                    
                    if (isCondominium) {
                        // Simplified popup for condominiums - subdivision info (no MLS waterfrontage shown)
                        popupContent = `
                            <div style="min-width: 280px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.4;">
                                <div style="margin-bottom: 8px; font-size: 16px; font-weight: 600; color: #8e44ad;">Condominium Building</div>
                                <div style="margin-bottom: 8px;"><strong>Development:</strong> ${props.development_name || 'N/A'}</div>
                                <div style="margin-bottom: 8px;"><strong>Subdivision:</strong> ${props.subdivision_name || 'N/A'}</div>
                        `;
                        
                        // Add unit count info
                        if (props.unit_count && props.unit_count > 1) {
                            popupContent += `<div style="margin-top: 12px; padding: 8px; background-color: #f8f4ff; border-left: 3px solid #8e44ad; font-size: 12px; color: #666;">
                                <strong>Building Info:</strong> This building contains ${props.unit_count} condominium units
                            </div>`;
                        }
                        
                        popupContent += '</div>';
                    } else {
                        // Full popup for non-condominium properties
                        
                        // Format address
                        let address = 'N/A';
                        if (props.address) {
                            let fullAddress = props.address;
                            if (props.city) fullAddress += ` ${props.city}`;
                            if (props.zip_code) fullAddress += `, FL ${props.zip_code}`;
                            address = fullAddress;
                        }
                        
                        // Format market value
                        let marketValue = 'N/A';
                        if (props.market_value) {
                            marketValue = new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 0
                            }).format(props.market_value);
                        }
                        
                        // Format last sale price
                        let lastSalePrice = 'N/A';
                        if (props.last_sale_price) {
                            lastSalePrice = new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 0
                            }).format(props.last_sale_price);
                        }
                        
                        // Format bathrooms (convert to numbers to remove leading zeros)
                        let bathrooms = 'N/A';
                        if (props.full_baths || props.half_baths) {
                            const full = parseInt(props.full_baths) || 0;
                            const half = parseInt(props.half_baths) || 0;
                            if (half > 0) {
                                bathrooms = `${full} full, ${half} half`;
                            } else {
                                bathrooms = `${full} full`;
                            }
                        }

                        const listingIdRaw = String(props.listing_id || '').trim();
                        const listingIdLink = listingIdRaw
                            ? `https://www.waterfront-properties.com/listing/${listingIdRaw.toLowerCase()}`
                            : '';
                        const showListingLink = listingIdRaw.length > 0
                            && String(props.mls_status || '').trim().toLowerCase() === 'active';
                        const listingLinkHtml = showListingLink
                            ? `<div style="margin-bottom: 8px;"><strong>Listing ID:</strong> <a href="${listingIdLink}" target="_blank" rel="noopener" style="color:#1d4ed8; text-decoration:underline;">${listingIdRaw}</a></div>`
                            : '';

                        popupContent = `
                            <div style="min-width: 280px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.4;">
                                <div style="margin-bottom: 8px;"><strong>Address:</strong> ${address}</div>
                                <div style="margin-bottom: 8px;"><strong>Parcel ID:</strong> ${props.property_control_number || 'N/A'}</div>
                                ${listingLinkHtml}
                                <div style="margin-bottom: 8px;"><strong>Year Built:</strong> ${props.year_built || 'N/A'}</div>
                                <div style="margin-bottom: 8px;"><strong>Development:</strong> ${props.development_name || 'N/A'}</div>
                                <div style="margin-bottom: 8px;"><strong>Subdivision:</strong> ${props.subdivision_name || 'N/A'}</div>
                                <div style="margin-bottom: 8px;"><strong>Bedrooms:</strong> ${props.bedrooms ? parseInt(props.bedrooms) : 'N/A'}</div>
                                <div style="margin-bottom: 8px;"><strong>Bathrooms:</strong> ${bathrooms}</div>
                                <div style="margin-bottom: 8px;"><strong>Market Value:</strong> <span style="color: #27ae60; font-weight: 600;">${marketValue}</span></div>
                                <div style="margin-bottom: 8px;"><strong>Last Sale Date:</strong> ${props.last_sale_date || 'N/A'}</div>
                                <div style="margin-bottom: 8px;"><strong>Last Sale Price:</strong> ${lastSalePrice}</div>
                                <div style="margin-bottom: 0;"><strong>Waterfrontage (MLS):</strong> ${props.waterfrontage || 'N/A'}</div>
                        `;
                        
                        // Add unit count info for multi-unit buildings
                        if (props.unit_count && props.unit_count > 1) {
                            popupContent += `<div style="margin-top: 12px; padding: 8px; background-color: #f8f9fa; border-left: 3px solid #3498db; font-size: 12px; color: #666;">
                                <strong>Building Info:</strong> This building contains ${props.unit_count} units
                            </div>`;
                        }
                        
                        popupContent += '</div>';
                    }
                    
                    layer.bindPopup(popupContent);
                    
                    // Add hover effects
                    layer.on('mouseover', function() {
                        this.setStyle({
                            weight: 3,
                            fillOpacity: 0.9
                        });
                    });
                    
                    layer.on('mouseout', function() {
                        // Restore style based on current mode
                        this.setStyle(computeStyleByMode(this.feature.properties));
                    });
                }
            }).addTo(map);
            
            // Fit map to parcel bounds
            map.fitBounds(parcelLayer.getBounds(), {
                padding: [20, 20]
            });

            // Create color mode selector UI
            const selectorWrap = document.createElement('div');
            selectorWrap.id = 'colorModeControl';
            selectorWrap.style.position = 'absolute';
            selectorWrap.style.top = '16px';
            selectorWrap.style.right = '16px';
            selectorWrap.style.background = 'rgba(255,255,255,0.95)';
            selectorWrap.style.border = '1px solid #dee2e6';
            selectorWrap.style.borderRadius = '8px';
            selectorWrap.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
            selectorWrap.style.padding = '8px 12px';
            selectorWrap.style.zIndex = '1200';
            selectorWrap.style.display = 'flex';
            selectorWrap.style.gap = '8px';
            selectorWrap.style.alignItems = 'center';

            const select = document.createElement('select');
            select.id = 'colorModeSelect';
            select.style.fontSize = '12px';
            select.style.padding = '6px 8px';
            select.style.border = '1px solid #ced4da';
            select.style.borderRadius = '6px';
            select.style.background = '#fff';

            const options = [
                { value: 'none', label: 'View Metric' },
                { value: 'tax_sale_date', label: 'Tax Last Sale Date' },
                { value: 'tax_sale_price', label: 'Tax Last Sale Price' },
                { value: 'tax_market_value', label: 'Tax Market Value' },
                { value: 'sold_since_covid', label: 'Sold Since Covid' },
                { value: 'mls_status', label: 'MLS Status' }
            ];
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                select.appendChild(o);
            });
            select.value = colorMode;

            select.addEventListener('change', function() {
                colorMode = this.value;
                recomputeThresholdsIfNeeded(geojsonData.features);
                updateParcelStyles();
            });

            selectorWrap.appendChild(select);
            parentEl.appendChild(selectorWrap);

            // Initial thresholds + legend render
            recomputeThresholdsIfNeeded(geojsonData.features);
            renderLegend();
        }
        
        // Get status color for styling
        function getStatusColor(status) {
            if (!status) return '#6c757d';
            
            const statusLower = status.toLowerCase();
            if (statusLower.includes('active')) return '#e74c3c';
            if (statusLower.includes('sold') || statusLower.includes('closed')) return '#27ae60';
            if (statusLower.includes('pending') || statusLower.includes('contract')) return '#f39c12';
            return '#6c757d';
        }
        
        // Show map error
        function showMapError(message) {
            const modal = document.getElementById('mapModal');
            const loading = document.getElementById('mapLoading');
            const error = document.getElementById('mapError');
            const errorMessage = document.getElementById('mapErrorMessage');
            
            modal.style.display = 'block';
            loading.style.display = 'none';
            error.style.display = 'flex';
            errorMessage.textContent = message;
        }
        // Get current report data
        function getCurrentReportData() {
            // Prefer inferred development from lookup or current selection
            try {
                if (window._inferredDevelopment && String(window._inferredDevelopment).trim().length > 0) {
                    return { development: String(window._inferredDevelopment).trim() };
                }
            } catch {}
            try {
                if (typeof currentDevelopmentName === 'string' && currentDevelopmentName.trim().length > 0) {
                    return { development: currentDevelopmentName.trim() };
                }
            } catch {}
            // Fallback: try to extract development from the styled address block
            const developmentElement = document.querySelector('#propertyAddress');
            if (developmentElement) {
                // Try to extract development name from the styled address
                const addressHtml = developmentElement.innerHTML;
                const italicMatches = addressHtml.match(/<div[^>]*font-style:\s*italic[^>]*>([^<]+)<\/div>/g);
                if (italicMatches && italicMatches.length > 0) {
                    // Get the first italic line (development)
                    const developmentMatch = italicMatches[0].match(/>([^<]+)</);
                    if (developmentMatch) {
                        return { development: developmentMatch[1].trim() };
                    }
                }
            }
            
            // Fallback: return null if no development found
            return null;
        }
        
        // Close map modal
        function closeMapModal() {
            const modal = document.getElementById('mapModal');
            modal.style.display = 'none';
            
            // Clean up map
            if (map) {
                map.remove();
                map = null;
            }

            // Reset color mode UI and legend to avoid sticky state
            try {
                const container = document.getElementById('developmentMap');
                const parentEl = container ? container.parentElement : null;
                if (parentEl) {
                    const oldLegend = parentEl.querySelector('#mapLegend');
                    if (oldLegend) oldLegend.remove();
                    const oldControl = parentEl.querySelector('#colorModeControl');
                    if (oldControl) oldControl.remove();
                }
            } catch (_) {}
        }
        
        // Initialize map modal close handler
        function initializeMapModal() {
            const closeButton = document.getElementById('closeMapModal');
            if (closeButton) {
                closeButton.addEventListener('click', closeMapModal);
            }
            
            // Close modal when clicking outside
            const modal = document.getElementById('mapModal');
            if (modal) {
                modal.addEventListener('click', function(e) {
                    if (e.target === modal) {
                        closeMapModal();
                    }
                });
            }
            
            // Close modal with Escape key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && modal.style.display === 'block') {
                    closeMapModal();
                }
            });
        }
        
        // Global function to update counties (called from inline onchange)
        window.updateCounties = updateCounties;
        
        // Load report once core loader is available
        (function runLoadReportWhenReady() {
            if (typeof window.loadReport === 'function') {
                try {
                    window.loadReport();
                } catch (err) {
                    console.error('Error invoking loadReport:', err);
                }
            } else {
                setTimeout(runLoadReportWhenReady, 100);
            }
        })();
        
        // Initialize map functionality
        initializeMapButton();
        
        // Initialize map modal after DOM is fully loaded
        document.addEventListener('DOMContentLoaded', function() {
            initializeMapModal();
        });
        
        // Also try initializing immediately in case DOMContentLoaded already fired
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeMapModal);
        } else {
            // DOM is already loaded
            setTimeout(initializeMapModal, 100);
        }
        
        // Initialize FRED comparison after report loads
        function waitForElements() {
            const seriesSelect = document.getElementById('series-select');
            if (seriesSelect) {
                initializeFredComparison();
            } else {
                console.log('Waiting for FRED elements to load...');
                setTimeout(waitForElements, 500);
            }
        }
        setTimeout(waitForElements, 1000);

        // API base path (supports reverse-proxy /report prefix)
        // Already defined at top; reuse to avoid redeclaration
        // const API_BASE = window.location.pathname.startsWith('/report/') ? '/report/api' : '/api';
