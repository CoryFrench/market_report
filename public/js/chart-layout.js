        // Improve canvas rendering quality on mobile by ensuring a reasonable device pixel ratio
        (function() {
            if (window.Chart) {
                Chart.defaults.responsive = true;
                Chart.defaults.maintainAspectRatio = false;
                // Cap DPR to avoid massive buffers, but keep crispness to prevent pixelation
                Chart.defaults.devicePixelRatio = function() { return Math.min(window.devicePixelRatio || 1, 2); };
                // Debug plugin removed; disable chart layout logging

                const angledTickDefaults = {
                    maxRotation: 48,
                    minRotation: 48,
                    autoSkipPadding: 12,
                    align: 'end'
                };

                function applyAngledTicks(scaleKey) {
                    Chart.defaults.scales = Chart.defaults.scales || {};
                    const scale = Chart.defaults.scales[scaleKey] = Chart.defaults.scales[scaleKey] || {};
                    const existing = scale.ticks || {};
                    scale.ticks = Object.assign({}, existing, angledTickDefaults);
                }

                ['category', 'time', 'timeseries'].forEach(applyAngledTicks);
            }
        })();

        // Dynamic container sizing using ResizeObserver (prevents clipping without fixed heights)
        function computeChartHeight(containerEl) {
            const width = containerEl.clientWidth || window.innerWidth;
            const vh = window.innerHeight || 360;
            const landscape = window.innerWidth > window.innerHeight;
            const isMobile = window.innerWidth <= 768;
            const ratio = isMobile ? (landscape ? 2.2 : 1.45) : (landscape ? 1.8 : 1.6); // width / height
            const byWidth = Math.round(width / ratio);
            const byViewport = Math.round(vh * (isMobile ? (landscape ? 0.55 : 0.50) : (landscape ? 0.60 : 0.65)));
            const height = Math.max(180, Math.min(byWidth, byViewport));
            // debug disabled
            return height;
        }

        function sizeChartContainer(container) {
            if (!container) return;
            const newHeight = computeChartHeight(container);
            container.style.height = newHeight + 'px';
            // debug disabled
        }

        let wealthChartLastHeight = null;
        function sizeWealthChartContainer() {
            const container = document.getElementById('wealth-migration-chart-container');
            if (!container) return;
            const parentWidth = container.parentElement ? container.parentElement.clientWidth : 0;
            const width = container.clientWidth || parentWidth || window.innerWidth;
            if (!width || !Number.isFinite(width)) return;
            const viewportWidth = window.innerWidth || width;
            const isCompact = viewportWidth <= 520;
            const isTablet = viewportWidth <= 1024;
            const ratio = isCompact ? 1.05 : (isTablet ? 1.25 : 1.5);
            const rawHeight = Math.round(width / ratio);
            const height = Math.max(240, Math.min(520, rawHeight));
            if (wealthChartLastHeight !== null && Math.abs(wealthChartLastHeight - height) < 1) {
                return;
            }
            wealthChartLastHeight = height;
            container.style.height = `${height}px`;
        }

        function getNationalWrappers() {
            const left = document.getElementById('leftChart');
            const right = document.getElementById('rightChart');
            return [left && left.parentElement, right && right.parentElement].filter(Boolean);
        }

        function updateChartContainers() {
            try {
                const targets = [
                    document.getElementById('comparison-chart-container'),
                    document.getElementById('dev-comparison-chart-container'),
                    ...getNationalWrappers()
                ].filter(Boolean);
                targets.forEach(sizeChartContainer);
                sizeWealthChartContainer();
                syncWealthMigrationListHeight();
                // Ask charts to reflow
                [window.leftChartInstance, window.rightChartInstance, window.comparisonChartInstance, window.developmentChart]
                    .forEach(c => { if (c && c.resize) c.resize(); });
            } catch {}
        }

        function syncWealthMigrationListHeight() {
            try {
                const card = document.getElementById('wealthMigrationListCard');
                const scroll = document.getElementById('wealthMigrationScroll');
                const chart = document.getElementById('wealth-migration-chart-container');
                if (!card || !scroll) return;

                if (!chart || window.innerWidth <= 1200) {
                    card.style.removeProperty('height');
                    scroll.style.removeProperty('max-height');
                    return;
                }

                const chartHeight = chart.getBoundingClientRect().height;
                if (!chartHeight || Number.isNaN(chartHeight)) return;

                card.style.height = `${chartHeight}px`;

                const cardStyles = window.getComputedStyle(card);
                const paddingY = parseFloat(cardStyles.paddingTop || '0') + parseFloat(cardStyles.paddingBottom || '0');
                const header = document.getElementById('wealthMigrationListTitle');
                const headerHeight = header ? header.getBoundingClientRect().height : 0;
                const headerStyles = header ? window.getComputedStyle(header) : null;
                const headerMargin = headerStyles ? parseFloat(headerStyles.marginBottom || '0') : 0;
                const available = chartHeight - paddingY - headerHeight - headerMargin;
                const heightBudget = Math.max(0, chartHeight - paddingY);
                const safeAvailable = Math.max(0, available);
                const desired = Math.max(120, safeAvailable);
                const finalHeight = Math.min(desired, heightBudget);
                if (finalHeight > 0) {
                    scroll.style.maxHeight = `${finalHeight}px`;
                } else {
                    scroll.style.removeProperty('max-height');
                }
            } catch {}
        }

        document.addEventListener('DOMContentLoaded', () => {
            sizeWealthChartContainer();
            updateChartContainers();
            syncWealthMigrationListHeight();
            const ro = new ResizeObserver(() => updateChartContainers());
            const watchEls = [
                document.getElementById('comparison-chart-container'),
                document.getElementById('dev-comparison-chart-container'),
                ...getNationalWrappers()
            ].filter(Boolean);
            watchEls.forEach(el => ro.observe(el));
            window.addEventListener('resize', () => {
                updateChartContainers();
            });
        });
    
