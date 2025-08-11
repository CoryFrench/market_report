const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { testConnection, dbQueries, pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

// Basic route - serve the landing page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Analysis view route - handles both old format (numbers) and new format (lastname-id)
app.get('/reports/:urlSlug', (req, res) => {
  res.sendFile(__dirname + '/public/report.html');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes for database operations

// Get all basic reports
app.get('/api/reports/basic', async (req, res) => {
  try {
    const result = await dbQueries.getReportBasic();
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching basic reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch basic reports',
      message: error.message
    });
  }
});

// Get specific basic report
app.get('/api/reports/basic/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await dbQueries.getReportBasic(reportId);
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching basic report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch basic report',
      message: error.message
    });
  }
});

// Get all report charts
app.get('/api/reports/charts', async (req, res) => {
  try {
    const result = await dbQueries.getReportCharts();
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching report charts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report charts',
      message: error.message
    });
  }
});

// Get specific report charts
app.get('/api/reports/charts/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await dbQueries.getReportCharts(reportId);
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching report charts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report charts',
      message: error.message
    });
  }
});

// Get FRED charts for a specific report
app.get('/api/reports/:reportId/fred-charts', async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await dbQueries.getFredCharts(reportId);
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching FRED charts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FRED charts',
      message: error.message
    });
  }
});

// Update FRED charts for a specific report
app.put('/api/reports/:reportId/fred-charts', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { leftSeriesId, rightSeriesId } = req.body;
    
    // Validate required fields
    if (!leftSeriesId || !rightSeriesId) {
      return res.status(400).json({
        success: false,
        error: 'Both leftSeriesId and rightSeriesId are required'
      });
    }
    
    const result = await dbQueries.upsertFredCharts(reportId, leftSeriesId, rightSeriesId);
    
    res.json({
      success: true,
      message: 'FRED charts updated successfully'
    });
  } catch (error) {
    console.error('Error updating FRED charts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update FRED charts',
      message: error.message
    });
  }
});

// Get area comparison for a specific report
app.get('/api/reports/:reportId/area-comparison', async (req, res) => {
  try {
    const { reportId: urlSlug } = req.params;
    
    // Validate URL slug and get report ID
    let reportId;
    if (/^\d+$/.test(urlSlug)) {
      // Old format: pure number
      reportId = urlSlug;
    } else {
      // New format: lastname-id - validate exact URL match
      const expectedUrl = `/reports/${urlSlug}`;
      const basicResult = await dbQueries.getReportBasic();
      const matchingReport = basicResult.rows.find(report => report.report_url === expectedUrl);
      
      if (!matchingReport) {
        return res.status(404).json({
          success: false,
          error: 'Report not found'
        });
      }
      
      reportId = matchingReport.report_id;
    }
    
    const result = await dbQueries.getAreaComparison(reportId);
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching area comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch area comparison',
      message: error.message
    });
  }
});

// Update area comparison for a specific report
app.put('/api/reports/:reportId/area-comparison', async (req, res) => {
  try {
    const { reportId: urlSlug } = req.params;
    const { seriesId, countyIds } = req.body;
    
    // Validate URL slug and get report ID
    let reportId;
    if (/^\d+$/.test(urlSlug)) {
      // Old format: pure number
      reportId = urlSlug;
    } else {
      // New format: lastname-id - validate exact URL match
      const expectedUrl = `/reports/${urlSlug}`;
      const basicResult = await dbQueries.getReportBasic();
      const matchingReport = basicResult.rows.find(report => report.report_url === expectedUrl);
      
      if (!matchingReport) {
        return res.status(404).json({
          success: false,
          error: 'Report not found'
        });
      }
      
      reportId = matchingReport.report_id;
    }
    
    // Validate required fields
    if (!seriesId || !countyIds || !Array.isArray(countyIds)) {
      return res.status(400).json({
        success: false,
        error: 'seriesId and countyIds (array) are required'
      });
    }
    
    const result = await dbQueries.upsertAreaComparison(reportId, seriesId, countyIds);
    
    res.json({
      success: true,
      message: 'Area comparison updated successfully'
    });
  } catch (error) {
    console.error('Error updating area comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update area comparison',
      message: error.message
    });
  }
});

// Get all report home info
app.get('/api/reports/home-info', async (req, res) => {
  try {
    const result = await dbQueries.getReportHomeInfo();
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching home info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch home info',
      message: error.message
    });
  }
});

// Get specific report home info
app.get('/api/reports/home-info/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await dbQueries.getReportHomeInfo(reportId);
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching home info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch home info',
      message: error.message
    });
  }
});

// Get all report interest areas
app.get('/api/reports/interest-areas', async (req, res) => {
  try {
    const result = await dbQueries.getReportInterestArea();
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching interest areas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interest areas',
      message: error.message
    });
  }
});

// Get specific report interest areas
app.get('/api/reports/interest-areas/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await dbQueries.getReportInterestArea(reportId);
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching interest areas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interest areas',
      message: error.message
    });
  }
});

// Get complete report with all related data - handles both old (ID) and new (lastname-id) formats
app.get('/api/reports/complete/:urlSlug', async (req, res) => {
  try {
    const { urlSlug } = req.params;
    
    if (!urlSlug) {
      return res.status(400).json({
        success: false,
        error: 'Report identifier is required'
      });
    }
    
    // Enforce exact URL slug matching for security; do not allow numeric ID bypass
    const result = await dbQueries.getReportByUrl(urlSlug);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching complete report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch complete report',
      message: error.message
    });
  }
});

// Get neighborhood sales data for a specific report
app.get('/api/reports/:urlSlug/neighborhood-sales', async (req, res) => {
  try {
    const { urlSlug } = req.params;
    
    if (!urlSlug) {
      return res.status(400).json({
        success: false,
        error: 'Report identifier is required'
      });
    }
    
    // Enforce exact slug matching; do not allow numeric fallback
    const reportResult = await dbQueries.getReportByUrl(urlSlug);
    if (reportResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    const reportId = reportResult.rows[0].report_id;
    
    const result = await dbQueries.getNeighborhoodSalesData(reportId);
    
    if (result.rowCount === 0) {
      return res.json({
        success: true,
        data: {
          total_sales_count: 0,
          development_name: null,
          earliest_sale_date: null,
          latest_sale_date: null,
          unique_parcels_with_sales: 0,
          message: 'No sales data found for this development'
        }
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching neighborhood sales data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch neighborhood sales data',
      message: error.message
    });
  }
});

// Create new report
app.post('/api/reports/create', async (req, res) => {
  try {
    const { 
      agentName, 
      firstName, 
      lastName, 
      addressLine1, 
      addressLine2, 
      city, 
      state, 
      zipCode, 
      development, 
      subdivision 
    } = req.body;
    
    // Validate required fields
    if (!agentName || !firstName || !lastName || !addressLine1 || !city || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['agentName', 'firstName', 'lastName', 'addressLine1', 'city', 'state', 'zipCode']
      });
    }
    
    // Create the report
    const result = await dbQueries.createReport({
      agentName: agentName.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2 ? addressLine2.trim() : null,
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      development: development ? development.trim() : null,
      subdivision: subdivision ? subdivision.trim() : null
    });
    
    res.status(201).json({
      success: true,
      message: 'Area analysis created successfully',
      reportId: result.reportId,
      reportUrl: result.reportUrl,
      createdAt: result.createdAt
    });
    
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create report',
      message: error.message
    });
  }
});

// Legacy endpoint - redirect to basic reports
app.get('/api/reports', async (req, res) => {
  try {
    const result = await dbQueries.getReportBasic();
    res.json({
      success: true,
      message: 'Market reports endpoint',
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
      message: error.message
    });
  }
});

// Development stats API endpoint for Home Stats panel
app.get('/api/development-stats/:developmentName', async (req, res) => {
  try {
    const { developmentName } = req.params;
    
    if (!developmentName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Development name is required' 
      });
    }

    // Query tax records database first (like county tax search), then enhance with MLS data
    // This mirrors the county tax search metrics system exactly
    
    const taxStatsQuery = `
      SELECT 
        COUNT(DISTINCT property_control_number) as total_tax_properties
      FROM tax.palm_beach_county_fl 
      WHERE development_name = $1
    `;
    
    const mlsStatsQuery = `
      WITH deduplicated_mls AS (
        SELECT 
          mls.*,
          ROW_NUMBER() OVER (
            PARTITION BY mls.listing_id
            ORDER BY 
              COALESCE(mls.status_change_date, mls.listing_date) DESC NULLS LAST,
              mls.status DESC
          ) as row_num
        FROM mls.vw_beaches_residential_developments mls
        WHERE mls.wf_development = $1
      )
      SELECT 
        COUNT(DISTINCT tax.property_control_number) as total_mls_properties,
        COUNT(DISTINCT CASE WHEN mls.status = 'Active' THEN tax.property_control_number END) as active_listings,
        COUNT(DISTINCT CASE WHEN mls.status = 'Active Under Contract' THEN tax.property_control_number END) as under_contract,
        COUNT(DISTINCT CASE WHEN mls.status = 'Pending' THEN tax.property_control_number END) as pending,
        COUNT(DISTINCT CASE 
          WHEN mls.status = 'Closed' 
            AND mls.sold_date IS NOT NULL 
            AND mls.sold_date <> '' 
            AND TO_DATE(mls.sold_date, 'YYYY-MM-DD') >= NOW() - INTERVAL '12 months' 
          THEN tax.property_control_number 
        END) as closed_12mo,
        COUNT(DISTINCT CASE 
          WHEN mls.status = 'Closed' 
            AND mls.sold_date IS NOT NULL 
            AND mls.sold_date <> '' 
            AND TO_DATE(mls.sold_date, 'YYYY-MM-DD') >= NOW() - INTERVAL '3 months' 
          THEN tax.property_control_number 
        END) as closed_3mo,
        COUNT(DISTINCT CASE 
          WHEN mls.status = 'Closed' 
            AND mls.sold_date IS NOT NULL 
            AND mls.sold_date <> '' 
            AND TO_DATE(mls.sold_date, 'YYYY-MM-DD') < NOW() - INTERVAL '12 months' 
          THEN tax.property_control_number 
        END) as closed_older,
        AVG(CASE 
          WHEN mls.status = 'Active' 
            AND mls.days_on_market IS NOT NULL 
            AND mls.days_on_market <> '' 
            AND LENGTH(TRIM(mls.days_on_market)) > 0
            AND mls.days_on_market ~ '^[0-9]+(\.[0-9]+)?$'
          THEN CAST(mls.days_on_market AS numeric)
        END) as avg_dom_active
      FROM tax.palm_beach_county_fl tax
      LEFT JOIN deduplicated_mls mls 
        ON tax.property_control_number = mls.parcel_id
        AND mls.row_num = 1
      WHERE tax.development_name = $1
    `;
    
    const medianPricesQuery = `
      WITH deduplicated_mls AS (
        SELECT 
          mls.*,
          ROW_NUMBER() OVER (
            PARTITION BY mls.listing_id
            ORDER BY 
              COALESCE(mls.status_change_date, mls.listing_date) DESC NULLS LAST,
              mls.status DESC
          ) as row_num
        FROM mls.vw_beaches_residential_developments mls
        WHERE mls.wf_development = $1
      )
      SELECT 
        EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) as sale_year,
        COUNT(*) as sale_count,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price::numeric) as median_price
      FROM deduplicated_mls mls
      WHERE mls.row_num = 1
        AND status = 'Closed'
        AND sold_date IS NOT NULL 
        AND sold_date <> ''
        AND sold_price IS NOT NULL 
        AND sold_price <> ''
        AND LENGTH(TRIM(sold_price)) > 0
        AND sold_price ~ '^[0-9]+(\.[0-9]+)?$'
        AND EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) IN (2023, 2024, 2025)
        AND (
          -- For current year: YTD (Jan 1 to current date)
          (EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) = EXTRACT(YEAR FROM NOW()) 
           AND TO_DATE(sold_date, 'YYYY-MM-DD') <= NOW()::date)
          OR
          -- For previous years: same period as current year (Jan 1 to same day/month)
          (EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) < EXTRACT(YEAR FROM NOW())
           AND TO_DATE(sold_date, 'YYYY-MM-DD') <= 
               (DATE_TRUNC('year', TO_DATE(sold_date, 'YYYY-MM-DD')) + 
                INTERVAL '1 day' * (EXTRACT(DOY FROM NOW()) - 1))::date)
        )
      GROUP BY EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD'))
      ORDER BY sale_year;
    `;

    try {
      const { query } = require('./db');
      
      // Use exact match instead of ILIKE pattern for more precise results
      // This should match the way county tax search filters development records
      const exactDevelopmentName = developmentName.trim();
      
      // Execute all three queries in parallel
      const [taxResult, statsResult, pricesResult] = await Promise.all([
        query(taxStatsQuery, [exactDevelopmentName]),
        query(mlsStatsQuery, [exactDevelopmentName]),
        query(medianPricesQuery, [exactDevelopmentName])
      ]);

      const taxStats = taxResult.rows[0] || {};
      const stats = statsResult.rows[0] || {};
      const priceData = pricesResult.rows || [];
      
      // Calculate active percentage
      const totalTaxProperties = parseInt(taxStats.total_tax_properties) || 0;
      const activeListings = parseInt(stats.active_listings) || 0;
      const activePercentage = totalTaxProperties > 0 ? 
        ((activeListings / totalTaxProperties) * 100).toFixed(2) : '0.00';
      
      // Calculate months of inventory
      const closed12Mo = parseInt(stats.closed_12mo) || 0;
      const closed3Mo = parseInt(stats.closed_3mo) || 0;
      
      const monthsInventory12 = closed12Mo > 0 ? 
        (activeListings / (closed12Mo / 12)).toFixed(1) : 'N/A';
      const monthsInventory3 = closed3Mo > 0 ? 
        (activeListings / (closed3Mo / 3)).toFixed(1) : 'N/A';
      
      // Format median prices by year
      const medianPrices = {};
      const saleCounts = {};
      
      priceData.forEach(row => {
        const year = row.sale_year;
        medianPrices[year] = Math.round(parseFloat(row.median_price) || 0);
        saleCounts[year] = parseInt(row.sale_count) || 0;
      });

      const developmentStats = {
        developmentName: developmentName,
        totalProperties: totalTaxProperties, // This is the "Tax" count from tax records
        activeListings: activeListings,
        activePercentage: parseFloat(activePercentage),
        underContract: parseInt(stats.under_contract) || 0,
        pending: parseInt(stats.pending) || 0,
        closedLast12Months: closed12Mo,
        closedLast3Months: closed3Mo,
        closedOlder: parseInt(stats.closed_older) || 0,
        medianPrices: medianPrices,
        saleCounts: saleCounts,
        avgDaysOnMarket: Math.round(parseFloat(stats.avg_dom_active) || 0),
        inventoryMonths: {
          twelveMonth: monthsInventory12,
          threeMonth: monthsInventory3
        }
      };

      res.json({
        success: true,
        data: developmentStats
      });
      
    } catch (dbError) {
      console.error('Database query error for development stats:', dbError);
      throw new Error(`Failed to fetch development statistics: ${dbError.message}`);
    }

  } catch (error) {
    console.error('Error fetching development stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch development statistics',
      message: error.message 
    });
  }
});

// Development chart data API endpoint - annual sales data for chart popup
app.get('/api/development-chart/:developmentName', async (req, res) => {
  try {
    const { developmentName } = req.params;
    
    if (!developmentName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Development name is required' 
      });
    }

    // Query to get annual sales data (count and average price)
    const chartDataQuery = `  
      WITH deduplicated_mls AS (
        SELECT 
          mls.*,
          ROW_NUMBER() OVER (
            PARTITION BY mls.listing_id
            ORDER BY 
              COALESCE(mls.status_change_date, mls.listing_date) DESC NULLS LAST,
              mls.status DESC
          ) as row_num
        FROM mls.vw_beaches_residential_developments mls
        WHERE mls.wf_development = $1
      )
      SELECT 
        EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) as sale_year,
        COUNT(*) as sales_count,
        AVG(sold_price::numeric) as avg_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price::numeric) as median_price,
        MIN(sold_price::numeric) as min_price,
        MAX(sold_price::numeric) as max_price
      FROM deduplicated_mls mls
      WHERE mls.row_num = 1
        AND status = 'Closed'
        AND sold_date IS NOT NULL 
        AND sold_date <> ''
        AND sold_price IS NOT NULL 
        AND sold_price <> ''
        AND LENGTH(TRIM(sold_price)) > 0
        AND sold_price ~ '^[0-9]+(\.[0-9]+)?$'
        AND EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) >= EXTRACT(YEAR FROM NOW()) - 10
      GROUP BY EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD'))
      ORDER BY sale_year ASC;
    `;

    try {
      const { query } = require('./db');
      const exactDevelopmentName = developmentName.trim();
      
      const chartResult = await query(chartDataQuery, [exactDevelopmentName]);
      
      res.json({
        success: true,
        data: {
          developmentName: exactDevelopmentName,
          chartData: chartResult.rows
        }
      });
      
    } catch (dbError) {
      console.error('Database query error for development chart data:', dbError);
      throw new Error(`Failed to fetch development chart data: ${dbError.message}`);
    }

  } catch (error) {
    console.error('Error fetching development chart data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch development chart data',
      message: error.message 
    });
  }
});

// Property lookup by address to enrich Home Stats
app.get('/api/property-lookup', async (req, res) => {
  try {
    const { address, city, zip, development, subdivision } = req.query;

    if (!address || String(address).trim().length === 0) {
      return res.status(400).json({ success: false, error: 'address query param is required' });
    }

    // Build normalized strings and helpful tokens for ranking
    const normalizedAddress = String(address).trim().replace(/\s+/g, ' ');
    const likePattern = `%${normalizedAddress.replace(/\s+/g, '%')}%`;

    // Extract house number prefix (e.g., "123 ") for anchored match
    const houseNumberMatch = normalizedAddress.match(/^\s*(\d+)\b/);
    const houseNumber = houseNumberMatch ? houseNumberMatch[1] : null;
    const housePrefix = houseNumber ? `${houseNumber} %` : null;

    // Derive a base street phrase (remove leading number and cut off at unit designators)
    const afterNumber = normalizedAddress.replace(/^\s*\d+\s*/, '');
    const streetUntilUnit = afterNumber.split(/\b(?:APT|APARTMENT|UNIT|STE|SUITE|#)\b/i)[0] || '';
    const streetTokens = streetUntilUnit.trim().split(/\s+/).filter(t => t.length > 2);
    const baseStreet = streetTokens.length > 0 ? streetTokens.slice(0, Math.min(2, streetTokens.length)).join(' ') : null;
    const streetLike = baseStreet ? `%${baseStreet}%` : null;

    // We will search tax records, optionally restricting by development via waterfrontdata.development_data
    // Build WHERE with placeholders offset after scoring params to keep numbering correct
    const whereClauses = [];
    const whereParams = [];
    const baseIndex = 7; // scoring params occupy $1..$7
    const makePlaceholder = () => `$${baseIndex + whereParams.length + 1}`;

    // Address pattern
    whereClauses.push(`t.situs_address ILIKE ${makePlaceholder()}::text`);
    whereParams.push(likePattern);

    if (city && String(city).trim().length > 0) {
      whereClauses.push(`t.situs_address_city_name ILIKE ${makePlaceholder()}::text`);
      whereParams.push(`%${String(city).trim()}%`);
    }
    if (zip && String(zip).trim().length > 0) {
      whereClauses.push(`t.situs_address_zip_code = ${makePlaceholder()}::text`);
      whereParams.push(String(zip).trim());
    }

    let joinClause = '';
    let ddScoreClause = '';
    if (development && String(development).trim().length > 0) {
      // Restrict to parcels in this development if provided
      joinClause = 'LEFT JOIN waterfrontdata.development_data dd ON dd.parcel_number = t.property_control_number';
      whereClauses.push(`dd.development_name = ${makePlaceholder()}::text`);
      whereParams.push(String(development).trim());
      // Only include dd score term when the join is present (uses scoring param $7)
      ddScoreClause = ` + (CASE WHEN COALESCE($7::text, '') <> '' AND dd.development_name = $7::text THEN 5 ELSE 0 END)`;
    }

    if (subdivision && String(subdivision).trim().length > 0) {
      // Also try to match subdivision when available
      whereClauses.push(`t.subdivision_name = ${makePlaceholder()}::text`);
      whereParams.push(String(subdivision).trim());
    }

    // Build ranking-aware query. We pass potential match parameters in fixed positions for CASE scoring.
    // Parameter order:
    //  1: exact normalizedAddress
    //  2: housePrefix (e.g., '123 %')
    //  3: streetLike (e.g., '%OCEAN BLVD%')
    //  4: zip (exact)
    //  5: city (ILIKE)
    //  6: subdivision (exact)
    //  7: development (exact; only used if join present)
    //  8+: dynamic filters built earlier (likePattern first, then optional city/zip filters, then dev/subdivision if not already positioned)

    // Prepare fixed scoring params
    const scoringParams = [
      String(normalizedAddress || ''),
      housePrefix ? String(housePrefix) : '',
      streetLike ? String(streetLike) : '',
      (zip && String(zip).trim().length > 0) ? String(zip).trim() : '',
      (city && String(city).trim().length > 0) ? `%${String(city).trim()}%` : '',
      (subdivision && String(subdivision).trim().length > 0) ? String(subdivision).trim() : '',
      (development && String(development).trim().length > 0) ? String(development).trim() : ''
    ];

    // Compose the full param list: scoring params first (1..7), then WHERE params ($8..)
    const fullParams = [...scoringParams, ...whereParams];

    const sql = `
      WITH candidates AS (
        SELECT 
          t.property_control_number,
          t.situs_address,
          t.situs_address_city_name,
          t.situs_address_zip_code,
          t.year_built,
          t.square_foot_living_area,
          t.number_of_bedrooms,
          t.number_of_full_bathrooms,
          t.number_of_half_bathrooms,
          t.total_market_value,
          (
            (CASE WHEN t.situs_address = $1::text THEN 100 ELSE 0 END)
          + (CASE WHEN COALESCE($2::text, '') <> '' AND t.situs_address ILIKE $2::text THEN 50 ELSE 0 END)
          + (CASE WHEN COALESCE($3::text, '') <> '' AND t.situs_address ILIKE $3::text THEN 30 ELSE 0 END)
          + (CASE WHEN COALESCE($4::text, '') <> '' AND t.situs_address_zip_code = $4::text THEN 20 ELSE 0 END)
          + (CASE WHEN COALESCE($5::text, '') <> '' AND t.situs_address_city_name ILIKE $5::text THEN 10 ELSE 0 END)
          + (CASE WHEN COALESCE($6::text, '') <> '' AND t.subdivision_name = $6::text THEN 5 ELSE 0 END)
          ${ddScoreClause}
          ) AS match_score
        FROM tax.palm_beach_county_fl t
        ${joinClause}
        WHERE ${whereClauses.join(' AND ')}
      )
      SELECT *
      FROM candidates
      ORDER BY match_score DESC, LENGTH(situs_address) ASC
      LIMIT 5;
    `;

    const { query } = require('./db');
    const { rows } = await query(sql, fullParams);

    if (!rows || rows.length === 0) {
      return res.json({ success: true, count: 0, data: [] });
    }

    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('Error in /api/property-lookup:', err);
    return res.status(500).json({ success: false, error: 'Failed to lookup property by address', message: err.message });
  }
});

// Get all distinct developments for comparison dropdowns
app.get('/api/developments', async (req, res) => {
  try {
    const developmentsQuery = `
      SELECT DISTINCT development_name
      FROM waterfrontdata.development_data
      WHERE development_name IS NOT NULL 
        AND development_name != ''
        AND LENGTH(TRIM(development_name)) > 0
      ORDER BY development_name ASC;
    `;

    try {
      const { query } = require('./db');
      const result = await query(developmentsQuery);
      
      // Normalize to { development_name }
      const rows = result.rows.map(r => ({ development_name: r.development_name }));
      res.json({ success: true, data: rows });
      
    } catch (dbError) {
      console.error('Database query error for developments:', dbError);
      throw new Error(`Failed to fetch developments: ${dbError.message}`);
    }

  } catch (error) {
    console.error('Error fetching developments:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch developments',
      message: error.message 
    });
  }
});

// Get all distinct zones for comparison dropdowns
app.get('/api/zones', async (req, res) => {
  try {
    const zonesQuery = `
      SELECT DISTINCT zone_name
      FROM waterfrontdata.development_data
      WHERE zone_name IS NOT NULL 
        AND zone_name != ''
        AND LENGTH(TRIM(zone_name)) > 0
      ORDER BY zone_name ASC;
    `;

    try {
      const { query } = require('./db');
      const result = await query(zonesQuery);

      // Normalize to { development_name }
      const rows = result.rows.map(r => ({ development_name: r.zone_name }));
      res.json({ success: true, data: rows });

    } catch (dbError) {
      console.error('Database query error for zones:', dbError);
      throw new Error(`Failed to fetch zones: ${dbError.message}`);
    }

  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch zones',
      message: error.message 
    });
  }
});

// Multi-development comparison chart data
app.get('/api/developments-comparison', async (req, res) => {
  try {
    const { developments } = req.query;
    
    if (!developments) {
      return res.status(400).json({ 
        success: false, 
        error: 'Development names are required' 
      });
    }

    // Parse development names (comma-separated)
    const developmentList = developments.split(',').map(d => d.trim()).filter(d => d.length > 0);
    
    if (developmentList.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least one development name is required' 
      });
    }

    // Query to get annual sales data for multiple developments
    const comparisonQuery = `  
      WITH deduplicated_mls AS (
        SELECT 
          mls.*,
          ROW_NUMBER() OVER (
            PARTITION BY mls.listing_id
            ORDER BY 
              COALESCE(mls.status_change_date, mls.listing_date) DESC NULLS LAST,
              mls.status DESC
          ) as row_num
        FROM mls.vw_beaches_residential_developments mls
        WHERE mls.wf_development = ANY($1)
      )
      SELECT 
        wf_development as development_name,
        EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) as sale_year,
        COUNT(*) as sales_count,
        AVG(sold_price::numeric) as avg_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price::numeric) as median_price,
        AVG(sqft_living::numeric) as avg_sqft
      FROM deduplicated_mls mls
      WHERE mls.row_num = 1
        AND status = 'Closed'
        AND sold_date IS NOT NULL 
        AND sold_date <> ''
        AND sold_price IS NOT NULL 
        AND sold_price <> ''
        AND LENGTH(TRIM(sold_price)) > 0
        AND sold_price ~ '^[0-9]+(\.[0-9]+)?$'
        AND sqft_living IS NOT NULL 
        AND sqft_living <> ''
        AND LENGTH(TRIM(sqft_living)) > 0
        AND sqft_living ~ '^[0-9]+(\.[0-9]+)?$'
        AND sqft_living::numeric > 0
        AND EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) >= EXTRACT(YEAR FROM NOW()) - 10
      GROUP BY wf_development, EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD'))
      ORDER BY development_name ASC, sale_year ASC;
    `;

    try {
      const { query } = require('./db');
      const result = await query(comparisonQuery, [developmentList]);
      
      res.json({
        success: true,
        data: {
          developments: developmentList,
          comparisonData: result.rows
        }
      });
      
    } catch (dbError) {
      console.error('Database query error for developments comparison:', dbError);
      throw new Error(`Failed to fetch developments comparison data: ${dbError.message}`);
    }

  } catch (error) {
    console.error('Error fetching developments comparison data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch developments comparison data',
      message: error.message 
    });
  }
});

// Multi-zone comparison chart data
app.get('/api/zones-comparison', async (req, res) => {
  try {
    const { zones } = req.query;

    if (!zones) {
      return res.status(400).json({ 
        success: false, 
        error: 'Zone names are required' 
      });
    }

    // Parse zone names (comma-separated)
    const zoneList = zones.split(',').map(z => z.trim()).filter(z => z.length > 0);

    if (zoneList.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least one zone name is required' 
      });
    }

    // Query to get annual sales data for multiple zones via development_data join
    const comparisonQuery = `  
      WITH combined AS (
        SELECT 
          d.parcel_number,
          d.zone_name,
          m.listing_id,
          m.status,
          m.status_change_date,
          m.listing_date,
          m.sold_date,
          m.sold_price,
          m.sqft_living
        FROM waterfrontdata.development_data d
        JOIN mls.vw_beaches_residential_developments m
          ON m.parcel_id = d.parcel_number
        WHERE d.zone_name = ANY($1)
      ),
      deduplicated_mls AS (
        SELECT 
          c.*,
          ROW_NUMBER() OVER (
            PARTITION BY c.listing_id
            ORDER BY COALESCE(c.status_change_date, c.listing_date) DESC NULLS LAST,
                     c.status DESC
          ) AS row_num
        FROM combined c
      )
      SELECT 
        zone_name AS development_name,
        EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) AS sale_year,
        COUNT(*) AS sales_count,
        AVG(sold_price::numeric) AS avg_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price::numeric) AS median_price,
        AVG(sqft_living::numeric) AS avg_sqft
      FROM deduplicated_mls
      WHERE row_num = 1
        AND status = 'Closed'
        AND sold_date IS NOT NULL 
        AND sold_date <> ''
        AND sold_price IS NOT NULL 
        AND sold_price <> ''
        AND LENGTH(TRIM(sold_price)) > 0
        AND sold_price ~ '^[0-9]+(\.[0-9]+)?$'
        AND sqft_living IS NOT NULL 
        AND sqft_living <> ''
        AND LENGTH(TRIM(sqft_living)) > 0
        AND sqft_living ~ '^[0-9]+(\.[0-9]+)?$'
        AND sqft_living::numeric > 0
        AND EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) >= EXTRACT(YEAR FROM NOW()) - 10
      GROUP BY zone_name, EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD'))
      ORDER BY development_name ASC, sale_year ASC;
    `;

    try {
      const { query } = require('./db');
      const result = await query(comparisonQuery, [zoneList]);

      res.json({
        success: true,
        data: {
          zones: zoneList,
          comparisonData: result.rows
        }
      });

    } catch (dbError) {
      console.error('Database query error for zones comparison:', dbError);
      throw new Error(`Failed to fetch zones comparison data: ${dbError.message}`);
    }

  } catch (error) {
    console.error('Error fetching zones comparison data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch zones comparison data',
      message: error.message 
    });
  }
});

// FRED API endpoint for fetching economic data
app.get('/api/fred-data', async (req, res) => {
  try {
    const { seriesId, startDate, endDate } = req.query;
    const response = await axios.get(`https://api.stlouisfed.org/fred/series/observations`, {
      params: {
        series_id: seriesId,
        api_key: process.env.FRED_API_KEY,
        file_type: 'json',
        observation_start: startDate,
        observation_end: endDate
      }
    });
    // console.log('FRED Data Response:', JSON.stringify(response.data, null, 2));

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching FRED data:', error);
    res.status(500).json({ error: 'Failed to fetch FRED data' });
  }
});

// FRED Series API endpoint for Areas of Interest comparison
app.get('/api/fred-series', async (req, res) => {
  try {
    const { level } = req.query;
    
    if (!level || !['NATIONAL', 'STATE', 'COUNTY'].includes(level.toUpperCase())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or missing level parameter. Must be NATIONAL, STATE, or COUNTY' 
      });
    }
    
    const result = await dbQueries.getFredSeries(level);
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching FRED series:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch FRED series',
      message: error.message 
    });
  }
});

// Counties API endpoint for Areas of Interest comparison
app.get('/api/counties', async (req, res) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).json({ 
        success: false, 
        error: 'State parameter is required' 
      });
    }
    
    const result = await dbQueries.getCountiesByState(state);
    
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching counties:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch counties',
      message: error.message 
    });
  }
});

// Get parcel geometry data for development map
app.get('/api/development-parcels/:developmentName', async (req, res) => {
  try {
    const developmentName = req.params.developmentName;
    
    if (!developmentName) {
      return res.status(400).json({
        success: false,
        error: 'Development name is required'
      });
    }

    console.log('Fetching parcels for development:', developmentName);

    // SQL query to get unique geometries in development (deduplicates condo buildings)
    // Additionally joins MLS data to include waterfrontage (matched on parcel/property control number)
    const query = `
      WITH deduplicated_mls AS (
        SELECT 
          mls.parcel_id,
          mls.waterfrontage,
          mls.status,
          mls.status_change_date,
          mls.sold_date,
          ROW_NUMBER() OVER (
            PARTITION BY mls.parcel_id
            ORDER BY COALESCE(mls.status_change_date, mls.listing_date) DESC NULLS LAST
          ) AS row_num
        FROM mls.vw_beaches_residential_developments mls
        WHERE mls.wf_development = $1
      ),
      unique_geometries AS (
        SELECT DISTINCT ON (p.geom)
          p.gid,
          p.parcelno,
          ST_AsGeoJSON(ST_Transform(p.geom, 4326)) as geometry,
          t.property_control_number,
          t.total_market_value,
          t.situs_address,
          t.situs_address_city_name,
          t.situs_address_zip_code,
          t.development_name,
          t.subdivision_name,
          t.owner_name,
          t.year_built,
          t.square_foot_living_area,
          t.number_of_bedrooms,
          t.number_of_full_bathrooms,
          t.number_of_half_bathrooms,
          t.sales_date_1,
          t.sales_price_1,
          t.land_use_description,
          COALESCE(mls.waterfrontage, NULL) AS waterfrontage,
          mls.status AS mls_status,
          mls.status_change_date AS mls_status_change_date,
          mls.sold_date AS mls_sold_date,
          COUNT(*) OVER (PARTITION BY p.geom) as unit_count
        FROM geodata.palm_beach_county_fl p
        INNER JOIN tax.palm_beach_county_fl t 
          ON p.parcelno = t.parcel_number
        LEFT JOIN deduplicated_mls mls
          ON mls.parcel_id = t.property_control_number
         AND mls.row_num = 1
        WHERE t.development_name = $1
          AND p.geom IS NOT NULL
        ORDER BY p.geom, t.property_control_number
      )
      SELECT * FROM unique_geometries
      ORDER BY parcelno;
    `;

    const result = await pool.query(query, [developmentName]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No parcels found for this development',
        data: []
      });
    }

    // Convert to GeoJSON format
    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: JSON.parse(row.geometry),
      properties: {
        gid: row.gid,
        parcelno: row.parcelno,
        property_control_number: row.property_control_number,
        unit_count: row.unit_count, // Number of units in this parcel
        // Tax record data (showing one representative unit per parcel)
        address: row.situs_address,
        city: row.situs_address_city_name,
        zip_code: row.situs_address_zip_code,
        development_name: row.development_name,
        subdivision_name: row.subdivision_name,
        owner_name: row.owner_name,
        year_built: row.year_built,
        sqft_living: row.square_foot_living_area,
        bedrooms: row.number_of_bedrooms,
        full_baths: row.number_of_full_bathrooms,
        half_baths: row.number_of_half_bathrooms,
        market_value: row.total_market_value,
        last_sale_date: row.sales_date_1,
        last_sale_price: row.sales_price_1,
        land_use_description: row.land_use_description,
        waterfrontage: row.waterfrontage,
        mls_status: row.mls_status,
        mls_status_change_date: row.mls_status_change_date,
        mls_sold_date: row.mls_sold_date
      }
    }));

    const geojson = {
      type: 'FeatureCollection',
      features: features
    };

    res.json({
      success: true,
      count: result.rows.length,
      data: geojson
    });

  } catch (error) {
    console.error('Error fetching development parcels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch development parcels',
      message: error.message 
    });
  }
});

// Get parcel geometry data for zone map
app.get('/api/zone-parcels/:zoneName', async (req, res) => {
  try {
    const zoneName = req.params.zoneName;

    if (!zoneName) {
      return res.status(400).json({
        success: false,
        error: 'Zone name is required'
      });
    }

    console.log('Fetching parcels for zone:', zoneName);

    // Query parcels linked to the requested zone via development_data table, including tax sale data and MLS status
    const query = `
      WITH zone_parcels AS (
        SELECT DISTINCT d.parcel_number
        FROM waterfrontdata.development_data d
        WHERE d.zone_name = $1
      ),
      combined AS (
        SELECT 
          p.gid,
          p.parcelno,
          p.geom,
          t.property_control_number,
          t.situs_address,
          t.situs_address_city_name,
          t.situs_address_zip_code,
          t.development_name,
          t.subdivision_name,
          t.total_market_value,
          t.sales_date_1,
          t.sales_price_1,
          t.land_use_description,
          t.year_built,
          t.square_foot_living_area,
          t.number_of_bedrooms,
          t.number_of_full_bathrooms,
          t.number_of_half_bathrooms,
          m.listing_id,
          m.status AS mls_status,
          m.status_change_date AS mls_status_change_date,
          m.sold_date AS mls_sold_date
        FROM geodata.palm_beach_county_fl p
        JOIN zone_parcels zp ON zp.parcel_number = p.parcelno
        LEFT JOIN tax.palm_beach_county_fl t ON t.parcel_number = p.parcelno
        LEFT JOIN mls.vw_beaches_residential_developments m
          ON m.parcel_id = t.property_control_number
      ),
      deduplicated AS (
        SELECT 
          c.*,
          ROW_NUMBER() OVER (
            PARTITION BY c.parcelno
            ORDER BY COALESCE(c.mls_status_change_date, c.mls_sold_date) DESC NULLS LAST
          ) AS row_num
        FROM combined c
      )
      SELECT 
        gid,
        parcelno,
        ST_AsGeoJSON(ST_Transform(geom, 4326)) as geometry,
        property_control_number,
        situs_address,
        situs_address_city_name,
        situs_address_zip_code,
        development_name,
        subdivision_name,
        total_market_value,
        sales_date_1,
        sales_price_1,
        land_use_description,
        year_built,
        square_foot_living_area,
        number_of_bedrooms,
        number_of_full_bathrooms,
        number_of_half_bathrooms,
        mls_status,
        mls_status_change_date,
        mls_sold_date
      FROM deduplicated
      WHERE geom IS NOT NULL AND row_num = 1
      ORDER BY parcelno;
    `;

    const result = await pool.query(query, [zoneName]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No parcels found for this zone',
        data: []
      });
    }

    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: JSON.parse(row.geometry),
      properties: {
        gid: row.gid,
        parcelno: row.parcelno,
        property_control_number: row.property_control_number,
        address: row.situs_address,
        city: row.situs_address_city_name,
        zip_code: row.situs_address_zip_code,
        development_name: row.development_name,
        subdivision_name: row.subdivision_name,
        last_sale_date: row.sales_date_1,
        last_sale_price: row.sales_price_1,
        land_use_description: row.land_use_description,
        market_value: row.total_market_value,
        year_built: row.year_built,
        sqft_living: row.square_foot_living_area,
        bedrooms: row.number_of_bedrooms,
        full_baths: row.number_of_full_bathrooms,
        half_baths: row.number_of_half_bathrooms,
        mls_status: row.mls_status,
        mls_status_change_date: row.mls_status_change_date,
        mls_sold_date: row.mls_sold_date
      }
    }));

    const geojson = { type: 'FeatureCollection', features };

    res.json({ success: true, count: result.rows.length, data: geojson });

  } catch (error) {
    console.error('Error fetching zone parcels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch zone parcels',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server with database connection test
app.listen(PORT, async () => {
  console.log(`🚀 Market Report Server running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}`);
  console.log(`💚 Health check at http://localhost:${PORT}/health`);
  
  // Test database connection on startup
  console.log('\n🔍 Testing database connection...');
  await testConnection();
  
  console.log('\n🌐 Web Interface:');
  console.log(`   Landing Page: http://localhost:${PORT}/`);
  console.log(`   Report View: http://localhost:${PORT}/reports/:reportId`);
  
  console.log('\n📋 Available API endpoints:');
  console.log(`   POST /api/reports/create - Create new report`);
  console.log(`   GET /api/reports - All basic reports`);
  console.log(`   GET /api/reports/basic - All basic report data`);
  console.log(`   GET /api/reports/basic/:reportId - Specific basic report data`);
  console.log(`   GET /api/reports/charts - All chart data`);
  console.log(`   GET /api/reports/charts/:reportId - Specific chart data`);
  console.log(`   GET /api/reports/home-info - All home info data`);
  console.log(`   GET /api/reports/home-info/:reportId - Specific home info data`);
  console.log(`   GET /api/reports/interest-areas - All interest area data`);
  console.log(`   GET /api/reports/interest-areas/:reportId - Specific interest area data`);
  console.log(`   GET /api/reports/complete/:reportId - Complete report with all data`);
  console.log(`   GET /api/reports/:reportId/fred-charts - Get FRED charts for report`);
  console.log(`   PUT /api/reports/:reportId/fred-charts - Update FRED charts for report`);
  console.log(`   GET /api/reports/:reportId/area-comparison - Get area comparison for report`);
  console.log(`   PUT /api/reports/:reportId/area-comparison - Update area comparison for report`);
  console.log(`   GET /api/development-stats/:developmentName - Development market statistics`);
  console.log(`   GET /api/development-parcels/:developmentName - Development parcel geometry for map`);
  console.log(`   GET /api/zone-parcels/:zoneName - Zone parcel geometry for map`);
  console.log(`   GET /api/fred-data?seriesId=&startDate=&endDate= - FRED economic data`);
  console.log(`   GET /api/fred-series?level=COUNTY - FRED series options for Areas of Interest`);
  console.log(`   GET /api/counties?state=StateName - Counties by state for FRED comparison`);
});
