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
  console.log(`   GET /api/fred-data?seriesId=&startDate=&endDate= - FRED economic data`);
});
