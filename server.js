const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { testConnection, dbQueries } = require('./db');

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
    
    // Extract numeric report_id from URL slug (e.g., "thomson-4" -> "4")
    let reportId;
    if (/^\d+$/.test(urlSlug)) {
      // Old format: pure number
      reportId = urlSlug;
    } else {
      // New format: lastname-id
      const parts = urlSlug.split('-');
      reportId = parts[parts.length - 1]; // Last part should be the ID
      
      // Validate that the last part is actually a number
      if (!/^\d+$/.test(reportId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid report identifier format'
        });
      }
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
    
    // Extract numeric report_id from URL slug (e.g., "thomson-4" -> "4")
    let reportId;
    if (/^\d+$/.test(urlSlug)) {
      // Old format: pure number
      reportId = urlSlug;
    } else {
      // New format: lastname-id
      const parts = urlSlug.split('-');
      reportId = parts[parts.length - 1]; // Last part should be the ID
      
      // Validate that the last part is actually a number
      if (!/^\d+$/.test(reportId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid report identifier format'
        });
      }
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
    
    let result;
    
    // Check if it's a pure number (old format) or lastname-id format
    if (/^\d+$/.test(urlSlug)) {
      // Old format: pure number
      result = await dbQueries.getCompleteReport(urlSlug);
    } else {
      // New format: lastname-id
      result = await dbQueries.getReportByUrl(urlSlug);
    }
    
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
  console.log(`   GET /api/fred-data?seriesId=&startDate=&endDate= - FRED economic data`);
  console.log(`   GET /api/fred-series?level=COUNTY - FRED series options for Areas of Interest`);
  console.log(`   GET /api/counties?state=StateName - Counties by state for FRED comparison`);
});
