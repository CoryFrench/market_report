const express = require('express');
const cors = require('cors');
const axios = require('axios');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { /* optional */ }
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

// Duplicate entry pages for agent and customer flows (serve same UI for now)
app.get('/agent-signup', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// New signup route (customer implied)
app.get('/signup', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Backward compatibility
app.get('/customer-signup', (req, res) => {
  res.redirect(302, '/signup');
});

// Analysis view route - handles both old format (numbers) and new format (lastname-id)
app.get('/reports/:urlSlug', (req, res) => {
  res.sendFile(__dirname + '/public/report.html');
});

// Retrieve page (future: enter last_name-report_id)
app.get('/retrieve', (req, res) => {
  res.sendFile(__dirname + '/public/retrieve.html');
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

// Get county comparison for a specific report
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

// Update county comparison for a specific report
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

// Minimal save API for neighbourhood comparison
app.put('/api/reports/:reportId/neighbourhood-comparison', async (req, res) => {
  try {
    const { reportId: urlSlug } = req.params;
    const { seriesId, names, items } = req.body;
    const payload = Array.isArray(items) ? items : (Array.isArray(names) ? names : []);
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ success: false, error: 'names (array) or items (array) required' });
    }
    let reportId;
    if (/^\d+$/.test(urlSlug)) {
      reportId = urlSlug;
    } else {
      const expectedUrl = `/reports/${urlSlug}`;
      const basicResult = await dbQueries.getReportBasic();
      const matchingReport = basicResult.rows.find(r => r.report_url === expectedUrl);
      if (!matchingReport) return res.status(404).json({ success: false, error: 'Report not found' });
      reportId = matchingReport.report_id;
    }
    await dbQueries.upsertNeighbourhoodComparison(reportId, seriesId || null, payload);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving neighbourhood comparison:', error);
    res.status(500).json({ success: false, error: 'Failed to save neighbourhood comparison', message: error.message });
  }
});

// Fetch neighbourhood comparison for a report (new table)
app.get('/api/reports/:reportId/neighbourhood-comparison', async (req, res) => {
  try {
    const { reportId: urlSlug } = req.params;
    let reportId;
    if (/^\d+$/.test(urlSlug)) {
      reportId = urlSlug;
    } else {
      const expectedUrl = `/reports/${urlSlug}`;
      const basicResult = await dbQueries.getReportBasic();
      const matchingReport = basicResult.rows.find(r => r.report_url === expectedUrl);
      if (!matchingReport) return res.status(404).json({ success: false, error: 'Report not found' });
      reportId = matchingReport.report_id;
    }
    const result = await dbQueries.getNeighbourhoodComparison(reportId);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'No neighbourhood comparison' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching neighbourhood comparison:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch neighbourhood comparison', message: error.message });
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
      county,
      zipCode, 
      development, 
      subdivision,
      email
    } = req.body;
    
    // Validate required fields
    if (!agentName || !firstName || !lastName || !addressLine1 || !city || !state || !county || !zipCode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['agentName', 'firstName', 'lastName', 'addressLine1', 'city', 'state', 'county', 'zipCode']
      });
    }
    
    // Normalize and guard against duplicate emails
    const normalizedEmail = email && String(email).trim().length > 0
      ? String(email).trim().toLowerCase()
      : null;

    if (normalizedEmail) {
      try {
        const existing = await dbQueries.getLatestReportByEmail(normalizedEmail, 1);
        if (existing && existing.rowCount > 0) {
          return res.status(409).json({
            success: false,
            error: 'An account already exists for this email',
            // Intentionally not returning report link or ID to avoid disclosure
          });
        }
      } catch (lookupErr) {
        // Fall through on lookup error; creation may still proceed
        console.error('Email lookup failed:', lookupErr.message || lookupErr);
      }
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
      county: county.trim(),
      zipCode: zipCode.trim(),
      development: development ? development.trim() : null,
      subdivision: subdivision ? subdivision.trim() : null,
      email: normalizedEmail
    });
    
    // Send confirmation email if provided and mailer configured
    if (normalizedEmail && normalizedEmail.length > 3) {
      try {
        await sendReportEmail({
          toEmail: normalizedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          reportUrl: result.reportUrl,
          reportId: result.reportId,
          emailType: 'created'
        });
      } catch (mailErr) {
        console.error('Email send failed:', mailErr.message || mailErr);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Area analysis created successfully',
      reportId: result.reportId,
      reportUrl: result.reportUrl,
      createdAt: result.createdAt
    });
    
  } catch (error) {
    console.error('Error creating report:', error);
    if (error && error.code === '23505') { // unique_violation (if a DB constraint exists)
      return res.status(409).json({ success: false, error: 'An account already exists for this email' });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create report',
      message: error.message
    });
  }
});

// Resend report link via email (no storage; requires last name and id)
app.post('/api/reports/resend', async (req, res) => {
  try {
    const { lastName, reportId, email } = req.body;
    if (!lastName || !reportId || !email) {
      return res.status(400).json({ success: false, error: 'lastName, reportId, and email are required' });
    }
    const cleanLast = String(lastName).toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const slug = `${cleanLast}-${reportId}`;
    const reportUrl = `/reports/${slug}`;
    await sendReportEmail({
      toEmail: String(email).trim(),
      firstName: '',
      lastName: String(lastName).trim(),
      reportUrl,
      reportId
    });
    res.json({ success: true, reportUrl });
  } catch (error) {
    console.error('Error resending report email:', error);
    res.status(500).json({ success: false, error: 'Failed to resend report email', message: error.message });
  }
});

// Retrieve by email (send most recent report link)
app.post('/api/reports/retrieve-by-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || String(email).trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await dbQueries.getLatestReportByEmail(normalizedEmail, 1);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'No report found for this email' });
    }
    const row = result.rows[0];
    await sendReportEmail({
      toEmail: normalizedEmail,
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      reportUrl: row.report_url,
      reportId: row.report_id,
      emailType: 'retrieve'
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error retrieving by email:', error);
    res.status(500).json({ success: false, error: 'Failed to process request', message: error.message });
  }
});

// Helper to send email (optional nodemailer)
// emailType: 'created' | 'retrieve'
async function sendReportEmail({ toEmail, firstName, lastName, reportUrl, reportId, emailType = 'created' }) {
  const origin = (process.env.PUBLIC_ORIGIN && process.env.PUBLIC_ORIGIN.trim().length > 0)
    ? process.env.PUBLIC_ORIGIN.trim()
    : 'https://services.waterfront-ai.com/report';
  const isAbsolute = typeof reportUrl === 'string' && /^(https?:)?\/\//i.test(reportUrl);
  const fullUrl = isAbsolute ? String(reportUrl) : `${origin}${reportUrl || ''}`;
  const stub = String(reportUrl || '').split('/').pop() || String(reportId || '');

  const { subject, plain, html } = buildEmailContent({
    emailType,
    firstName: firstName || '',
    lastName: lastName || '',
    stub,
    fullUrl
  });

  // Prefer Mandrill (Mailchimp Transactional) API if available
  const MANDRILL_API_KEY = process.env.MANDRILL_API_KEY || '';
  const EMAIL_FROM = process.env.EMAIL_FROM || process.env.FROM_EMAIL || process.env.SMTP_FROM || '';
  if (MANDRILL_API_KEY) {
    await sendViaMandrill({
      apiKey: MANDRILL_API_KEY,
      fromEmail: EMAIL_FROM || process.env.SMTP_USER || 'no-reply@example.com',
      toEmail,
      subject,
      text: plain,
      html
    });
    return;
  }

  // Resolve SMTP config with aliases for compatibility
  const SMTP_HOST = process.env.SMTP_HOST || '';
  const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
  const SMTP_SECURE = !!(process.env.SMTP_SECURE === 'true');
  const SMTP_USER = process.env.SMTP_USER || '';
  const SMTP_PASS = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
  const SMTP_FROM = process.env.SMTP_FROM || process.env.FROM_EMAIL || EMAIL_FROM || SMTP_USER;

  // If nodemailer not installed or no SMTP config, just log
  if (!nodemailer || !SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log('[Email disabled] Would send to', toEmail, 'subject:', subject, 'url:', fullUrl);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  await transporter.sendMail({
    from: SMTP_FROM,
    to: toEmail,
    subject,
    text: plain,
    html
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
function escapeAttr(s) { return escapeHtml(s); }

function buildEmailContent({ emailType, firstName, lastName, stub, fullUrl }) {
  const recipientName = firstName || lastName || '';
  if (emailType === 'retrieve') {
    const subject = `Link to Your Area Analysis (Report ID: ${stub})`;
    const plain = `Hello ${recipientName},\n\nHere’s the link to the Area Analysis you requested:\n\nReport ID: ${stub}\n\n${fullUrl}\n\nIf you did not request this link, you can safely ignore this email.\n\n— Waterfront Properties Area Insights Team`;
    const html = `
      <div style="background:#f7fafc;padding:24px 0;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-family:-apple-system, Segoe UI, Roboto, Arial, sans-serif;color:#1a202c;">
          <div style="border-top:5px solid #ccb27a;padding:24px 24px 12px;">
            <p style="margin:0 0 12px 0;">Hello ${escapeHtml(recipientName)},</p>
            <p style="margin:0 0 10px 0;color:#4a5568;">Here’s the link to the Area Analysis you requested:</p>
            <p style="margin:0 0 10px 0;color:#4a5568;"><strong>Report ID:</strong> ${escapeHtml(stub)}</p>
            <p style="margin:0 0 12px 0;"><a href="${escapeAttr(fullUrl)}" target="_blank" rel="noopener noreferrer" style="color:#1a365d;text-decoration:underline;">${escapeHtml(fullUrl)}</a></p>
            <p style="margin:14px 0 0 0;color:#718096;font-size:14px;">If you did not request this link, you can safely ignore this email.</p>
          </div>
          <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#4a5568;font-size:14px;">
            — Waterfront Properties Area Insights Team
          </div>
        </div>
      </div>
    `;
    return { subject, plain, html };
  }

  // created (first-time)
  const subject = 'Your Area Analysis is Ready';
  const plain = `Hello ${recipientName},\n\nYour Area Analysis has been created and is ready to view.\n\nReport ID: ${stub}\n\nView your report here:\n${fullUrl}\n\nKeep this Report ID for future access — you can request this link again anytime using it.\n\nIf you did not request this report, you can safely ignore this email.\n\n— Waterfront Properties Area Insights Team`;
  const html = `
    <div style="background:#f7fafc;padding:24px 0;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-family:-apple-system, Segoe UI, Roboto, Arial, sans-serif;color:#1a202c;">
        <div style="border-top:5px solid #ccb27a;padding:24px 24px 12px;">
          <p style="margin:0 0 12px 0;">Hello ${escapeHtml(recipientName)},</p>
          <p style="margin:0 0 10px 0;color:#4a5568;">Your Area Analysis has been created and is ready to view.</p>
          <p style="margin:0 0 10px 0;color:#4a5568;"><strong>Report ID:</strong> ${escapeHtml(stub)}</p>
          <p style="margin:0 0 6px 0;color:#4a5568;">View your report here:</p>
          <p style="margin:0 0 12px 0;"><a href="${escapeAttr(fullUrl)}" target="_blank" rel="noopener noreferrer" style="color:#1a365d;text-decoration:underline;">${escapeHtml(fullUrl)}</a></p>
          <p style="margin:14px 0 0 0;color:#718096;font-size:14px;">Keep this Report ID for future access — you can request this link again anytime using it.</p>
          <p style="margin:8px 0 0 0;color:#718096;font-size:14px;">If you did not request this report, you can safely ignore this email.</p>
        </div>
        <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#4a5568;font-size:14px;">
          — Waterfront Properties Area Insights Team
        </div>
      </div>
    </div>
  `;
  return { subject, plain, html };
}

// Mandrill (Mailchimp Transactional) send helper
async function sendViaMandrill({ apiKey, fromEmail, toEmail, subject, text, html }) {
  try {
    const payload = {
      key: apiKey,
      message: {
        from_email: fromEmail,
        to: [{ email: toEmail, type: 'to' }],
        subject,
        text,
        html
      }
    };
    await axios.post('https://mandrillapp.com/api/1.0/messages/send.json', payload, {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Mandrill send error:', err.response?.data || err.message || err);
    throw err;
  }
}

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
      WHERE TRIM(development_name) = TRIM($1)
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
      WHERE TRIM(tax.development_name) = TRIM($1)
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

// Zone chart data API endpoint - mirrors development chart but filters by zone
app.get('/api/zone-chart/:zoneName', async (req, res) => {
  try {
    const { zoneName } = req.params;
    if (!zoneName) {
      return res.status(400).json({ success: false, error: 'Zone name is required' });
    }
    const chartDataQuery = `
      WITH combined AS (
        SELECT 
          d.parcel_number,
          d.zone_name,
          m.listing_id,
          m.status,
          m.status_change_date,
          m.listing_date,
          m.sold_date,
          m.sold_price
        FROM waterfrontdata.development_data d
        JOIN mls.vw_beaches_residential_developments m
          ON m.parcel_id = d.parcel_number
        WHERE d.zone_name = $1
      )
      SELECT 
        EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) as sale_year,
        COUNT(*) as sales_count,
        AVG(sold_price::numeric) as avg_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price::numeric) as median_price,
        MIN(sold_price::numeric) as min_price,
        MAX(sold_price::numeric) as max_price
      FROM combined
      WHERE status = 'Closed'
        AND sold_date IS NOT NULL 
        AND sold_date <> ''
        AND sold_price IS NOT NULL 
        AND sold_price <> ''
        AND LENGTH(TRIM(sold_price)) > 0
        AND sold_price ~ '^[0-9]+(\\.[0-9]+)?$'
        AND EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD')) >= EXTRACT(YEAR FROM NOW()) - 10
      GROUP BY EXTRACT(YEAR FROM TO_DATE(sold_date, 'YYYY-MM-DD'))
      ORDER BY sale_year ASC;`;

    const { query } = require('./db');
    const exactZoneName = zoneName.trim();
    const chartResult = await query(chartDataQuery, [exactZoneName]);
    res.json({ success: true, data: { zoneName: exactZoneName, chartData: chartResult.rows } });
  } catch (error) {
    console.error('Error fetching zone chart data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch zone chart data', message: error.message });
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
    const addressNoPunct = normalizedAddress.replace(/[.,]/g, '');
    const suffixTokens = new Set([
      'DR', 'DRIVE', 'RD', 'ROAD', 'AVE', 'AV', 'AVENUE', 'ST', 'STREET',
      'BLVD', 'BOULEVARD', 'CT', 'COURT', 'LN', 'LANE', 'TER', 'TERRACE',
      'PL', 'PLACE', 'PKWY', 'PARKWAY', 'HWY', 'HIGHWAY', 'CIR', 'CIRCLE',
      'WAY', 'TRL', 'TRAIL'
    ]);
    const addressTokens = addressNoPunct.split(/\s+/);
    const addressTokensNoSuffix = addressTokens.filter(t => !suffixTokens.has(String(t).toUpperCase()));
    const likePattern = addressTokensNoSuffix.length > 0
      ? `%${addressTokensNoSuffix.join('%')}%`
      : `%${normalizedAddress.replace(/\s+/g, '%')}%`;

    // Extract house number prefix (e.g., "123 ") for anchored match
    const houseNumberMatch = normalizedAddress.match(/^\s*(\d+)\b/);
    const houseNumber = houseNumberMatch ? houseNumberMatch[1] : null;
    const housePrefix = houseNumber ? `${houseNumber} %` : null;

    // Derive a base street phrase (remove leading number and cut off at unit designators)
    const afterNumber = normalizedAddress.replace(/^\s*\d+\s*/, '');
    const streetUntilUnit = afterNumber.split(/\b(?:APT|APARTMENT|UNIT|STE|SUITE|#)\b/i)[0] || '';
    const rawStreetTokens = streetUntilUnit.trim().split(/\s+/).filter(t => t.length > 1);
    const streetTokens = rawStreetTokens.filter(t => !suffixTokens.has(String(t).toUpperCase()));
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

    // Always join development_data so we can return inferred development even when not provided
    let joinClause = 'LEFT JOIN waterfrontdata.development_data dd ON dd.parcel_number = t.property_control_number';
    let ddScoreClause = ` + (CASE WHEN COALESCE($7::text, '') <> '' AND dd.development_name = $7::text THEN 5 ELSE 0 END)`;
    if (development && String(development).trim().length > 0) {
      // Restrict to parcels in this development if provided
      whereClauses.push(`dd.development_name = ${makePlaceholder()}::text`);
      whereParams.push(String(development).trim());
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
          dd.development_name,
          (
            (CASE WHEN t.situs_address = $1::text THEN 100 ELSE 0 END)
          + (CASE WHEN COALESCE($2::text, '') <> '' AND t.situs_address ILIKE $2::text THEN 50 ELSE 0 END)
          + (CASE WHEN COALESCE($3::text, '') <> '' AND t.situs_address ILIKE $3::text THEN 30 ELSE 0 END)
          + (CASE WHEN COALESCE($4::text, '') <> '' AND t.situs_address_zip_code = $4::text THEN 20 ELSE 0 END)
          + (CASE WHEN COALESCE($5::text, '') <> '' AND t.situs_address_city_name ILIKE $5::text THEN 10 ELSE 0 END)
          + (CASE WHEN COALESCE($6::text, '') <> '' AND t.subdivision_name = $6::text THEN 5 ELSE 0 END)
          ${ddScoreClause}
          ) AS match_score
          , COALESCE($7::text, '') AS __dev_param_anchor
        FROM tax.palm_beach_county_fl t
        ${joinClause}
        WHERE ${whereClauses.join(' AND ')}
      ),
      merged AS (
        SELECT
          property_control_number,
          MAX(situs_address)               FILTER (WHERE situs_address IS NOT NULL)               AS situs_address,
          MAX(situs_address_city_name)     FILTER (WHERE situs_address_city_name IS NOT NULL)     AS situs_address_city_name,
          MAX(situs_address_zip_code)      FILTER (WHERE situs_address_zip_code IS NOT NULL)      AS situs_address_zip_code,
          MAX(year_built)                  FILTER (WHERE year_built IS NOT NULL)                  AS year_built,
          MAX(square_foot_living_area)     FILTER (WHERE square_foot_living_area IS NOT NULL)     AS square_foot_living_area,
          MAX(number_of_bedrooms)          FILTER (WHERE number_of_bedrooms IS NOT NULL)          AS number_of_bedrooms,
          MAX(number_of_full_bathrooms)    FILTER (WHERE number_of_full_bathrooms IS NOT NULL)    AS number_of_full_bathrooms,
          MAX(number_of_half_bathrooms)    FILTER (WHERE number_of_half_bathrooms IS NOT NULL)    AS number_of_half_bathrooms,
          MAX(total_market_value)          FILTER (WHERE total_market_value IS NOT NULL)          AS total_market_value,
          MAX(development_name)            FILTER (WHERE development_name IS NOT NULL)            AS development_name,
          MAX(match_score) AS best_match_score
        FROM candidates
        GROUP BY property_control_number
      )
      SELECT *
      FROM merged
      ORDER BY best_match_score DESC
      LIMIT 1;
    `;

    const { query } = require('./db');
    const { rows } = await query(sql, fullParams);

    if (!rows || rows.length === 0) {
      return res.json({ success: true, count: 0, data: [] });
    }

    // Return a single consolidated row in an array for backward compatibility
    return res.json({ success: true, count: 1, data: [rows[0]] });
  } catch (err) {
    console.error('Error in /api/property-lookup:', err);
    return res.status(500).json({ success: false, error: 'Failed to lookup property by address', message: err.message });
  }
});

// Get all distinct developments for comparison dropdowns
app.get('/api/developments', async (req, res) => {
  try {
    const developmentsQuery = `
      SELECT DISTINCT TRIM(development_name) AS development_name
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

// Get subdivisions for a given development (cascading dropdown)
app.get('/api/subdivisions', async (req, res) => {
  try {
    const { development } = req.query;
    if (!development || String(development).trim().length === 0) {
      return res.status(400).json({ success: false, error: 'development query parameter is required' });
    }

    const subdivisionsQuery = `
      SELECT DISTINCT TRIM(subdivision_name) AS subdivision_name
      FROM tax.palm_beach_county_fl
      WHERE TRIM(development_name) = TRIM($1)
        AND subdivision_name IS NOT NULL
        AND subdivision_name <> ''
        AND LENGTH(TRIM(subdivision_name)) > 0
      ORDER BY subdivision_name ASC;
    `;

    try {
      const { query } = require('./db');
      const result = await query(subdivisionsQuery, [String(development).trim()]);
      const rows = result.rows.map(r => ({ subdivision_name: r.subdivision_name }));
      res.json({ success: true, data: rows });
    } catch (dbError) {
      console.error('Database query error for subdivisions:', dbError);
      throw new Error(`Failed to fetch subdivisions: ${dbError.message}`);
    }
  } catch (error) {
    console.error('Error fetching subdivisions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subdivisions', message: error.message });
  }
});

// Get all distinct zones for comparison dropdowns
app.get('/api/zones', async (req, res) => {
  try {
    const zonesQuery = `
      SELECT DISTINCT TRIM(zone_name) AS zone_name
      FROM waterfrontdata.development_data
      WHERE zone_name IS NOT NULL 
        AND zone_name != ''
        AND LENGTH(TRIM(zone_name)) > 0
      ORDER BY zone_name ASC;
    `;

    try {
      const { query } = require('./db');
      const result = await query(zonesQuery);

      // Normalize to { zone_name }
      const rows = result.rows.map(r => ({ zone_name: r.zone_name }));
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
        WHERE TRIM(mls.wf_development) = ANY(SELECT TRIM(x) FROM unnest($1::text[]) x)
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
        WHERE TRIM(d.zone_name) = ANY(SELECT TRIM(x) FROM unnest($1::text[]) x)
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

// County-level series from realtor.com (ZIP-aggregated) — supports county_fips or county+state
app.get('/api/county-series', async (req, res) => {
  try {
    const { county_fips, county, state, months, zip } = req.query;
    let targetFips = String(county_fips || '').trim();

    if (!targetFips) {
      if (zip) {
        const zipLookup = await dbQueries.getPrimaryCountyFipsByZip(String(zip));
        if (!zipLookup || zipLookup.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'ZIP not found' });
        }
        targetFips = zipLookup.rows[0].fips;
      } else if (county) {
        const lookup = await dbQueries.getCountyFipsByNameState(String(county), state ? String(state) : null);
        if (!lookup || lookup.rowCount === 0) {
          return res.status(404).json({ success: false, error: 'County not found' });
        }
        const row = lookup.rows[0];
        targetFips = row.fips || `${row.statefips || ''}${row.countyfips || ''}`;
      } else {
        return res.status(400).json({ success: false, error: 'county_fips or (county[,state]) or zip is required' });
      }
    }

    const monthsBack = months ? Number(months) : 24;
    const result = await dbQueries.getCountySeriesByFips(targetFips, monthsBack);

    return res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (error) {
    console.error('Error fetching county series:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch county series', message: error.message });
  }
});

// Multi-county comparison time series — county_fips is CSV string, optional months
app.get('/api/county-comparison', async (req, res) => {
  try {
    const { county_fips, months } = req.query;
    if (!county_fips || String(county_fips).trim().length === 0) {
      return res.status(400).json({ success: false, error: 'county_fips (CSV) is required' });
    }
    const list = String(county_fips).split(',').map(s => s.trim()).filter(Boolean);
    const monthsBack = months ? Number(months) : 24;
    const result = await dbQueries.getCountySeriesMultiByFips(list, monthsBack);
    return res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (error) {
    console.error('Error fetching county comparison series:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch county comparison', message: error.message });
  }
});

// ZIP-level series from realtor.com — by ZIP code
app.get('/api/zip-series', async (req, res) => {
  try {
    const { zip, months } = req.query;
    if (!zip || String(zip).trim().length === 0) {
      return res.status(400).json({ success: false, error: 'zip is required' });
    }
    const monthsBack = months ? Number(months) : 24;
    const result = await dbQueries.getZipSeriesByZip(String(zip).trim(), monthsBack);
    return res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (error) {
    console.error('Error fetching ZIP series:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch ZIP series', message: error.message });
  }
});

// Latest ZIP snapshot — single most recent row for a given ZIP
app.get('/api/zip-latest', async (req, res) => {
  try {
    const { zip } = req.query;
    if (!zip || String(zip).trim().length === 0) {
      return res.status(400).json({ success: false, error: 'zip is required' });
    }
    const result = await dbQueries.getZipLatestByZip(String(zip).trim());
    if (!result || result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'ZIP not found' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching ZIP latest:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch ZIP latest', message: error.message });
  }
});

// RentCast ZIP market snapshot (non-Palm Beach fallback)
// Proxies RentCast API to avoid exposing API key to the client
app.get('/api/zip-market', async (req, res) => {
  try {
    const { zip, history } = req.query;
    if (!zip || String(zip).trim().length === 0) {
      return res.status(400).json({ success: false, error: 'zip is required' });
    }

    const apiKey = process.env.RENTCAST_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'RentCast API key not configured' });
    }

    const params = {
      zipCode: String(zip).trim(),
      dataType: 'Sale'
    };
    const historyRange = Number(history);
    if (Number.isFinite(historyRange) && historyRange > 0) {
      params.historyRange = historyRange;
    }

    const rcResp = await axios.get('https://api.rentcast.io/v1/markets', {
      params,
      headers: { 'X-Api-Key': apiKey },
      timeout: 20000
    });

    if (!rcResp || !rcResp.data || typeof rcResp.data !== 'object') {
      return res.status(502).json({ success: false, error: 'Invalid response from RentCast' });
    }

    const payload = rcResp.data || {};
    const sale = payload.saleData || {};

    // Normalize snapshot fields to align with UI expectations where possible
    const snapshot = {
      zipCode: payload.zipCode || String(zip).trim(),
      lastUpdatedDate: sale.lastUpdatedDate || null,
      medianPrice: sale.medianPrice ?? null,
      medianPricePerSquareFoot: sale.medianPricePerSquareFoot ?? null,
      medianDaysOnMarket: sale.medianDaysOnMarket ?? null,
      newListings: sale.newListings ?? null,
      totalListings: sale.totalListings ?? null
      // Note: RentCast does not provide pending or active listing counts
    };

    // Optional history (flatten to array of points)
    let historyData = [];
    if (sale.history && typeof sale.history === 'object') {
      historyData = Object.entries(sale.history).map(([period, entry]) => ({
        period,
        date: entry?.date ?? null,
        medianPrice: entry?.medianPrice ?? null,
        medianPricePerSquareFoot: entry?.medianPricePerSquareFoot ?? null,
        medianDaysOnMarket: entry?.medianDaysOnMarket ?? null,
        newListings: entry?.newListings ?? null,
        totalListings: entry?.totalListings ?? null
      })).sort((a, b) => String(a.period).localeCompare(String(b.period)));
    }

    return res.json({ success: true, data: snapshot, history: historyData });
  } catch (error) {
    console.error('Error fetching RentCast market data:', error?.response?.data || error.message || error);
    return res.status(500).json({ success: false, error: 'Failed to fetch RentCast market data', message: error.message });
  }
});

// RentCast property profile lookup by full address (non-Palm Beach fallback)
// Returns minimal profile fields for Home Info card augmentation
app.get('/api/property-profile', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address || String(address).trim().length < 5) {
      return res.status(400).json({ success: false, error: 'address is required' });
    }

    const apiKey = process.env.RENTCAST_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'RentCast API key not configured' });
    }

    const rcResp = await axios.get('https://api.rentcast.io/v1/properties', {
      params: { address: String(address).trim() },
      headers: { 'X-Api-Key': apiKey },
      timeout: 25000
    });

    let list = rcResp?.data;
    if (list && list.data && Array.isArray(list.data)) list = list.data;
    if (!Array.isArray(list)) list = [];

    if (list.length === 0) {
      return res.json({ success: true, data: null });
    }

    const rec = list[0] || {};

    // Prefer 2024 then 2023 for tax assessment
    const preferredYears = ['2024', '2023'];
    let taxAssessmentValue = null;
    const ta = rec?.taxAssessments;
    if (ta && typeof ta === 'object') {
      for (const y of preferredYears) {
        if (ta[y] && typeof ta[y] === 'object' && ta[y] !== null) {
          taxAssessmentValue = ta[y].value ?? null;
          if (taxAssessmentValue !== null) break;
        }
        const yi = Number(y);
        if (Number.isFinite(yi) && ta[yi] && typeof ta[yi] === 'object' && ta[yi] !== null) {
          taxAssessmentValue = ta[yi].value ?? null;
          if (taxAssessmentValue !== null) break;
        }
      }
    }

    const minimal = {
      address: rec.formattedAddress || rec.address || String(address).trim(),
      bedrooms: rec.bedrooms ?? null,
      bathrooms: rec.bathrooms ?? null,
      squareFootage: rec.squareFootage ?? null,
      lotSize: rec.lotSize ?? null,
      yearBuilt: rec.yearBuilt ?? null,
      taxAssessmentValue
    };

    return res.json({ success: true, data: minimal });
  } catch (error) {
    console.error('Error fetching RentCast property profile:', error?.response?.data || error.message || error);
    return res.status(500).json({ success: false, error: 'Failed to fetch RentCast property profile', message: error.message });
  }
});

// Multi-ZIP comparison time series — zips is CSV string, optional months
app.get('/api/zip-comparison', async (req, res) => {
  try {
    const { zips, months } = req.query;
    if (!zips || String(zips).trim().length === 0) {
      return res.status(400).json({ success: false, error: 'zips (CSV) is required' });
    }
    const list = String(zips).split(',').map(s => s.trim()).filter(Boolean);
    const monthsBack = months ? Number(months) : 24;
    const result = await dbQueries.getZipSeriesMultiByZip(list, monthsBack);
    return res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (error) {
    console.error('Error fetching ZIP comparison series:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch ZIP comparison', message: error.message });
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

// Zip/City/County lookup endpoints to support autofill/suggestions
app.get('/api/zipcity/by-zip', async (req, res) => {
  try {
    const { zip, state } = req.query;
    if (!zip || String(zip).trim().length < 3) {
      return res.status(400).json({ success: false, error: 'zip (min 3 chars) is required' });
    }
    const result = await dbQueries.lookupZipCityByZip(String(zip).trim(), state ? String(state).trim() : undefined);
    return res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (error) {
    console.error('Error in /api/zipcity/by-zip:', error);
    return res.status(500).json({ success: false, error: 'Failed to lookup by zip', message: error.message });
  }
});

app.get('/api/zipcity/by-city', async (req, res) => {
  try {
    const { city, state } = req.query;
    if (!city || String(city).trim().length < 2) {
      return res.status(400).json({ success: false, error: 'city (min 2 chars) is required' });
    }
    const result = await dbQueries.lookupZipCityByCity(String(city).trim(), state ? String(state).trim() : undefined);
    return res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (error) {
    console.error('Error in /api/zipcity/by-city:', error);
    return res.status(500).json({ success: false, error: 'Failed to lookup by city', message: error.message });
  }
});

app.get('/api/zipcity/by-county', async (req, res) => {
  try {
    const { county, state } = req.query;
    if (!county || String(county).trim().length < 2) {
      return res.status(400).json({ success: false, error: 'county (min 2 chars) is required' });
    }
    const result = await dbQueries.lookupZipCityByCounty(String(county).trim(), state ? String(state).trim() : undefined);
    return res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (error) {
    console.error('Error in /api/zipcity/by-county:', error);
    return res.status(500).json({ success: false, error: 'Failed to lookup by county', message: error.message });
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

    // SQL query to get unique parcels by parcel id and merge attributes from duplicates
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
      base AS (
        SELECT 
          p.gid,
          p.parcelno,
          p.geom,
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
          mls.sold_date AS mls_sold_date
        FROM geodata.palm_beach_county_fl p
        INNER JOIN tax.palm_beach_county_fl t 
          ON p.parcelno = t.parcel_number
        LEFT JOIN deduplicated_mls mls
          ON mls.parcel_id = t.property_control_number
         AND mls.row_num = 1
        WHERE TRIM(t.development_name) = TRIM($1)
          AND p.geom IS NOT NULL
      ),
      merged AS (
        SELECT
          property_control_number,
          MIN(gid) AS gid,
          MIN(parcelno) AS parcelno,
          (ARRAY_AGG(geom))[1] AS geom,
          MAX(total_market_value)            FILTER (WHERE total_market_value IS NOT NULL)            AS total_market_value,
          MAX(situs_address)                 FILTER (WHERE situs_address IS NOT NULL)                 AS situs_address,
          MAX(situs_address_city_name)       FILTER (WHERE situs_address_city_name IS NOT NULL)       AS situs_address_city_name,
          MAX(situs_address_zip_code)        FILTER (WHERE situs_address_zip_code IS NOT NULL)        AS situs_address_zip_code,
          MAX(development_name)              FILTER (WHERE development_name IS NOT NULL)              AS development_name,
          MAX(subdivision_name)              FILTER (WHERE subdivision_name IS NOT NULL)              AS subdivision_name,
          MAX(owner_name)                    FILTER (WHERE owner_name IS NOT NULL)                    AS owner_name,
          MAX(year_built)                    FILTER (WHERE year_built IS NOT NULL)                    AS year_built,
          MAX(square_foot_living_area)       FILTER (WHERE square_foot_living_area IS NOT NULL)       AS square_foot_living_area,
          MAX(number_of_bedrooms)            FILTER (WHERE number_of_bedrooms IS NOT NULL)            AS number_of_bedrooms,
          MAX(number_of_full_bathrooms)      FILTER (WHERE number_of_full_bathrooms IS NOT NULL)      AS number_of_full_bathrooms,
          MAX(number_of_half_bathrooms)      FILTER (WHERE number_of_half_bathrooms IS NOT NULL)      AS number_of_half_bathrooms,
          MAX(sales_date_1)                  FILTER (WHERE sales_date_1 IS NOT NULL)                  AS sales_date_1,
          MAX(sales_price_1)                 FILTER (WHERE sales_price_1 IS NOT NULL)                 AS sales_price_1,
          MAX(land_use_description)          FILTER (WHERE land_use_description IS NOT NULL)          AS land_use_description,
          MAX(waterfrontage)                 FILTER (WHERE waterfrontage IS NOT NULL)                 AS waterfrontage,
          MAX(mls_status)                    FILTER (WHERE mls_status IS NOT NULL)                    AS mls_status,
          MAX(mls_status_change_date)        FILTER (WHERE mls_status_change_date IS NOT NULL)        AS mls_status_change_date,
          MAX(mls_sold_date)                 FILTER (WHERE mls_sold_date IS NOT NULL)                 AS mls_sold_date
        FROM base
        GROUP BY property_control_number
      )
      SELECT 
        MIN(gid) AS gid,
        MIN(parcelno) AS parcelno,
        ST_AsGeoJSON(ST_Transform((ARRAY_AGG(geom))[1], 4326)) as geometry,
        property_control_number,
        total_market_value,
        situs_address,
        situs_address_city_name,
        situs_address_zip_code,
        development_name,
        subdivision_name,
        owner_name,
        year_built,
        square_foot_living_area,
        number_of_bedrooms,
        number_of_full_bathrooms,
        number_of_half_bathrooms,
        sales_date_1,
        sales_price_1,
        land_use_description,
        waterfrontage,
        mls_status,
        mls_status_change_date,
        mls_sold_date,
        1 AS unit_count
      FROM merged
      GROUP BY 
        property_control_number,
        total_market_value,
        situs_address,
        situs_address_city_name,
        situs_address_zip_code,
        development_name,
        subdivision_name,
        owner_name,
        year_built,
        square_foot_living_area,
        number_of_bedrooms,
        number_of_full_bathrooms,
        number_of_half_bathrooms,
        sales_date_1,
        sales_price_1,
        land_use_description,
        waterfrontage,
        mls_status,
        mls_status_change_date,
        mls_sold_date
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

    // Query parcels linked to the requested zone and merge duplicate parcel rows into a single record
    const query = `
      WITH zone_parcels AS (
        SELECT DISTINCT d.parcel_number
        FROM waterfrontdata.development_data d
        WHERE TRIM(d.zone_name) = TRIM($1)
      ),
      base AS (
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
      merged AS (
        SELECT
          property_control_number,
          MIN(gid) AS gid,
          MIN(parcelno) AS parcelno,
          (ARRAY_AGG(geom))[1] AS geom,
          MAX(situs_address)                 FILTER (WHERE situs_address IS NOT NULL)                 AS situs_address,
          MAX(situs_address_city_name)       FILTER (WHERE situs_address_city_name IS NOT NULL)       AS situs_address_city_name,
          MAX(situs_address_zip_code)        FILTER (WHERE situs_address_zip_code IS NOT NULL)        AS situs_address_zip_code,
          MAX(development_name)              FILTER (WHERE development_name IS NOT NULL)              AS development_name,
          MAX(subdivision_name)              FILTER (WHERE subdivision_name IS NOT NULL)              AS subdivision_name,
          MAX(total_market_value)            FILTER (WHERE total_market_value IS NOT NULL)            AS total_market_value,
          MAX(sales_date_1)                  FILTER (WHERE sales_date_1 IS NOT NULL)                  AS sales_date_1,
          MAX(sales_price_1)                 FILTER (WHERE sales_price_1 IS NOT NULL)                 AS sales_price_1,
          MAX(land_use_description)          FILTER (WHERE land_use_description IS NOT NULL)          AS land_use_description,
          MAX(year_built)                    FILTER (WHERE year_built IS NOT NULL)                    AS year_built,
          MAX(square_foot_living_area)       FILTER (WHERE square_foot_living_area IS NOT NULL)       AS square_foot_living_area,
          MAX(number_of_bedrooms)            FILTER (WHERE number_of_bedrooms IS NOT NULL)            AS number_of_bedrooms,
          MAX(number_of_full_bathrooms)      FILTER (WHERE number_of_full_bathrooms IS NOT NULL)      AS number_of_full_bathrooms,
          MAX(number_of_half_bathrooms)      FILTER (WHERE number_of_half_bathrooms IS NOT NULL)      AS number_of_half_bathrooms,
          MAX(mls_status)                    FILTER (WHERE mls_status IS NOT NULL)                    AS mls_status,
          MAX(mls_status_change_date)        FILTER (WHERE mls_status_change_date IS NOT NULL)        AS mls_status_change_date,
          MAX(mls_sold_date)                 FILTER (WHERE mls_sold_date IS NOT NULL)                 AS mls_sold_date
        FROM base
        GROUP BY property_control_number
      )
      SELECT 
        MIN(gid) AS gid,
        MIN(parcelno) AS parcelno,
        ST_AsGeoJSON(ST_Transform((ARRAY_AGG(geom))[1], 4326)) as geometry,
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
      FROM merged
      GROUP BY 
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

// ZIP comparison persistence (mirrors county, per report)
app.get('/api/reports/:reportId/zip-comparison', async (req, res) => {
  try {
    const { reportId } = req.params;
    console.log('GET /api/reports/%s/zip-comparison', reportId);
    const result = await dbQueries.getZipComparison(Number(reportId));
    if (!result || result.rowCount === 0) {
      // Default when no record: series avg_listing_price, zip 33477
      return res.json({ success: true, data: { report_id: Number(reportId), series_id: 'avg_listing_price', zip_codes: ['33477'] } });
    }
    const row = result.rows[0];
    const zips = Array.isArray(row.zip_codes) ? row.zip_codes.map(z => String(z || '').padStart(5, '0')) : [];
    return res.json({ success: true, data: { report_id: row.report_id, series_id: row.series_id || 'avg_listing_price', zip_codes: zips } });
  } catch (error) {
    console.error('Error fetching report_charts_zip:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch saved ZIP comparison', message: error.message });
  }
});

app.put('/api/reports/:reportId/zip-comparison', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { seriesId, zipIds } = req.body || {};
    const cleanedZips = Array.isArray(zipIds) ? zipIds.map(z => String(z || '').trim()).filter(Boolean) : [];
    console.log('PUT /api/reports/%s/zip-comparison', reportId, cleanedZips);
    await dbQueries.saveZipComparison(Number(reportId), seriesId || 'avg_listing_price', cleanedZips);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error saving report_charts_zip:', error);
    return res.status(500).json({ success: false, error: 'Failed to save ZIP comparison', message: error.message });
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
