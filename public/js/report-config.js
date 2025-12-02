        // Define API_BASE early so all subsequent scripts can use it
        (function(){
            const p = window.location.pathname || '/';
            const firstSeg = '/' + (p.split('/')[1] || '');
            if (firstSeg === '/wealth') {
                window.API_BASE = '/wealth/api';
            } else if (firstSeg === '/report') {
                window.API_BASE = '/report/api';
            } else {
                window.API_BASE = '/api';
            }
        })();
        const API_BASE = window.API_BASE;

        const HTML_ESCAPE_MAP = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#47;'
        };

        function escapeHtml(value) {
            if (value === null || value === undefined) return '';
            return String(value).replace(/[&<>"'/]/g, char => HTML_ESCAPE_MAP[char] || char);
        }

        function formatPhoneNumber(value) {
            if (!value) return '';
            const digits = String(value).replace(/\D+/g, '');
            if (digits.length === 0) return '';
            if (digits.length === 11 && digits.startsWith('1')) {
                return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
            }
            if (digits.length === 10) {
                return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
            }
            if (digits.length === 7) {
                return `${digits.slice(0, 3)}-${digits.slice(3)}`;
            }
            return String(value).trim();
        }

        const REALTOR_METRICS = [
            { key: 'avg_listing_price', label: 'Average Listing Price', valueType: 'currency', decimals: 0 },
            { key: 'median_listing_price_proxy', label: 'Median Listing Price (proxy)', valueType: 'currency', decimals: 0 },
            { key: 'avg_price_per_sqft', label: 'Average Price per Sq Ft', valueType: 'currency', decimals: 0 },
            { key: 'avg_days_on_market', label: 'Average Days on Market', valueType: 'number', decimals: 0 },
            { key: 'active_listing_count', label: 'Active Listings', valueType: 'number', decimals: 0 },
            { key: 'new_listing_count', label: 'New Listings', valueType: 'number', decimals: 0 },
            { key: 'total_listing_count', label: 'Total Listings', valueType: 'number', decimals: 0 },
            { key: 'pending_ratio', label: 'Pending Ratio', valueType: 'ratio', percentDecimals: 1 },
            { key: 'price_increased_share', label: 'Price Increased Share', valueType: 'ratio', percentDecimals: 1 },
            { key: 'price_reduced_share', label: 'Price Reduced Share', valueType: 'ratio', percentDecimals: 1 }
        ];
        const DEFAULT_COUNTY_METRIC = REALTOR_METRICS[0]?.key || 'avg_listing_price';
        const realtorSeriesKeys = new Set(REALTOR_METRICS.map(m => m.key));
        const DEVELOPMENT_CHART_TYPES = {
            sales: { dataKey: 'sales_count', title: 'Sales Count', axisLabel: 'Number of Sales', valueType: 'number' },
            sales_yoy: { dataKey: 'sales_count', title: 'Sales Count YoY % Change', axisLabel: 'YoY % Change', valueType: 'percent', decimals: 1, yoy: true },
            price: { dataKey: 'avg_price', title: 'Average Sale Price', axisLabel: 'Average Sale Price', valueType: 'currency', decimals: 0 },
            price_yoy: { dataKey: 'avg_price', title: 'Average Sale Price YoY % Change', axisLabel: 'YoY % Change', valueType: 'percent', decimals: 1, yoy: true },
            price_per_sqft: { dataKey: 'avg_price_per_sqft', title: 'Average Price Per Square Foot', axisLabel: 'Average Price Per Square Foot', valueType: 'currency', decimals: 0, requiresPricePerSqft: true },
            price_per_sqft_yoy: { dataKey: 'avg_price_per_sqft', title: 'Price Per Square Foot YoY % Change', axisLabel: 'YoY % Change', valueType: 'percent', decimals: 1, yoy: true, requiresPricePerSqft: true }
        };
        const STATE_ABBR_TO_NAME = {
            AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
            CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
            IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
            ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
            MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
            NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
            ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
            RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
            UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
            WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia'
        };
        function formatMetricValue(value, meta) {
            if (value == null || Number.isNaN(value)) return '-';
            if (!meta || meta.valueType === 'number') {
                return Number(value).toLocaleString();
            }
            if (meta.valueType === 'currency') {
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: meta.decimals ?? 0,
                    minimumFractionDigits: meta.decimals ?? 0
                }).format(value);
            }
            if (meta.valueType === 'ratio') {
                const percent = Number(value) * 100;
                const decimals = meta.percentDecimals ?? 1;
                return `${percent.toFixed(decimals)}%`;
            }
            if (meta.valueType === 'percent') {
                const decimals = meta.decimals ?? meta.percentDecimals ?? 1;
                return `${Number(value).toFixed(decimals)}%`;
            }
            return Number(value).toLocaleString();
        }

        function computeYAxisConfig(meta, datasets) {
            const values = datasets.flatMap(ds => (ds.data || []).map(point => {
                if (point == null) return null;
                if (typeof point === 'number') return point;
                if (typeof point === 'object' && typeof point.y === 'number') return point.y;
                if (typeof point === 'object' && typeof point.value === 'number') return point.value;
                return null;
            }).filter(v => v != null && !Number.isNaN(v)));
            if (values.length === 0) {
                return {};
            }
            if (meta && meta.valueType === 'ratio') {
                return {
                    beginAtZero: true,
                    suggestedMax: Math.min(1, Math.max(...values) * 1.05 || 0.5),
                    ticks: {
                        callback: (v) => `${Math.round(v * 100)}%`
                    }
                };
            }
            if (meta && meta.valueType === 'percent') {
                const min = Math.min(...values);
                const max = Math.max(...values);
                const pad = (max - min) * 0.1 || 5;
                const suggestedMin = Math.min(0, min - pad);
                const suggestedMax = Math.max(0, max + pad);
                return {
                    suggestedMin,
                    suggestedMax,
                    ticks: {
                        callback: (v) => `${Number(v).toFixed(meta.decimals ?? 0)}%`
                    }
                };
            }
            const decimals = meta && meta.valueType === 'currency' ? (meta.decimals ?? 0) : 0;
            const min = Math.min(...values);
            const max = Math.max(...values);
            const pad = (max - min) * 0.08 || (meta && meta.valueType === 'currency' ? 1000 : 10);
            return {
                suggestedMin: Math.max(0, min - pad),
                suggestedMax: max + pad * 0.5,
                ticks: {
                    callback: (v) => {
                        if (meta && meta.valueType === 'currency') {
                            return new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                maximumFractionDigits: decimals,
                                minimumFractionDigits: decimals
                            }).format(v);
                        }
                        return Number(v).toLocaleString();
                    }
                }
            };
        }

        async function fetchCountySeriesData(countyIds, metricKey) {
            if (!Array.isArray(countyIds) || countyIds.length === 0) {
                return [];
            }
            const metricMeta = REALTOR_METRICS.find(m => m.key === metricKey) || null;
            console.debug('Fetch county comparison start', { countyIds, metricKey, apiBase: API_BASE });
            const params = new URLSearchParams();
            params.set('county_fips', countyIds.join(','));
            params.set('months', '60');
            const response = await fetch(`${API_BASE}/county-comparison?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Failed to fetch county comparison data');
            }
            const json = await response.json();
            if (!json.success || !Array.isArray(json.data)) {
                return [];
            }
            console.debug('County comparison API payload', {
                metric: metricKey,
                count: json.data.length,
                sample: json.data.slice(0, 5)
            });
            const grouped = {};
            json.data.forEach(row => {
                const countyId = row.county_fips;
                if (!row || row[metricKey] === undefined) {
                    console.warn('Missing metric in row for county comparison', { metricKey, row });
                }
                if (!grouped[countyId]) {
                    grouped[countyId] = {
                        county: countyId,
                        name: row.county_name,
                        points: []
                    };
                }
                const parsedDate = parseYyyymmToDate(row.month_date_yyyymm);
                const parsedValue = toNumberOrNull(row[metricKey]);
                if (!parsedDate || parsedValue === null) {
                    console.warn('Skipping data point due to invalid value or date', {
                        countyId,
                        metricKey,
                        rawValue: row[metricKey],
                        parsedDate,
                        parsedValue,
                        row
                    });
                }
                grouped[countyId].points.push({
                    x: parsedDate,
                    y: parsedValue
                });
            });
            return Object.values(grouped).map(entry => {
                entry.points.sort((a, b) => (a.x?.getTime?.() || 0) - (b.x?.getTime?.() || 0));
                entry.meta = metricMeta;
                return entry;
            });
        }
    
