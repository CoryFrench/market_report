const { Pool } = require('pg');

// Create a connection pool
const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  // Connection pool settings
  max: 20, // max number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // return error after 2 seconds if connection could not be established
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    return false;
  }
};

// Generic query function
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executed:', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
};

// Database query functions for each table
const dbQueries = {
  // Get all basic report data
  getReportBasic: async (reportId = null) => {
    const baseQuery = `
      SELECT report_id, created_at, last_updated, report_url, agent_name, first_name, last_name
      FROM customer.report_basic
    `;
    
    if (reportId) {
      return await query(`${baseQuery} WHERE report_id = $1`, [reportId]);
    }
    return await query(baseQuery);
  },

  // Get report charts data
  getReportCharts: async (reportId = null) => {
    const baseQuery = `
      SELECT report_id, chart_id, chart_type, series_id, stats_category, locations
      FROM customer.report_charts
    `;
    
    if (reportId) {
      return await query(`${baseQuery} WHERE report_id = $1`, [reportId]);
    }
    return await query(baseQuery);
  },

  // Get report home info
  getReportHomeInfo: async (reportId = null) => {
    const baseQuery = `
      SELECT report_id, address_line_1, address_line_2, city, state, zip_code, development, subdivision
      FROM customer.report_home_info
    `;
    
    if (reportId) {
      return await query(`${baseQuery} WHERE report_id = $1`, [reportId]);
    }
    return await query(baseQuery);
  },

  // Get report interest areas
  getReportInterestArea: async (reportId = null) => {
    const baseQuery = `
      SELECT report_id, interest_id, city, state
      FROM customer.report_interest_area
    `;
    
    if (reportId) {
      return await query(`${baseQuery} WHERE report_id = $1`, [reportId]);
    }
    return await query(baseQuery);
  },

  // Get complete report data (joins all tables)
  getCompleteReport: async (reportId) => {
    const queryText = `
      SELECT 
        rb.report_id,
        rb.created_at,
        rb.last_updated,
        rb.report_url,
        rb.agent_name,
        rb.first_name,
        rb.last_name,
        rhi.address_line_1,
        rhi.address_line_2,
        rhi.city as home_city,
        rhi.state as home_state,
        rhi.zip_code,
        rhi.development,
        rhi.subdivision,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'chart_id', rc.chart_id,
              'chart_type', rc.chart_type,
              'series_id', rc.series_id,
              'stats_category', rc.stats_category,
              'locations', rc.locations
            )
          ) FILTER (WHERE rc.chart_id IS NOT NULL), 
          '[]'::json
        ) as charts,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'interest_id', ria.interest_id,
              'city', ria.city,
              'state', ria.state
            )
          ) FILTER (WHERE ria.interest_id IS NOT NULL), 
          '[]'::json
        ) as interest_areas
      FROM customer.report_basic rb
      LEFT JOIN customer.report_home_info rhi ON rb.report_id = rhi.report_id
      LEFT JOIN customer.report_charts rc ON rb.report_id = rc.report_id
      LEFT JOIN customer.report_interest_area ria ON rb.report_id = ria.report_id
      WHERE rb.report_id = $1
      GROUP BY rb.report_id, rb.created_at, rb.last_updated, rb.report_url, 
               rb.agent_name, rb.first_name, rb.last_name,
               rhi.address_line_1, rhi.address_line_2, rhi.city, rhi.state, 
               rhi.zip_code, rhi.development, rhi.subdivision
    `;
    
    return await query(queryText, [reportId]);
  },

  // Create new report with basic info and home info
  createReport: async (reportData) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert into report_basic and get the generated report_id
      const basicInsertQuery = `
        INSERT INTO customer.report_basic (agent_name, first_name, last_name, created_at, last_updated)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING report_id, created_at
      `;
      
      const basicResult = await client.query(basicInsertQuery, [
        reportData.agentName,
        reportData.firstName,
        reportData.lastName
      ]);
      
      const reportId = basicResult.rows[0].report_id;
      const createdAt = basicResult.rows[0].created_at;
      
      // Insert into report_home_info using the generated report_id
      const homeInfoInsertQuery = `
        INSERT INTO customer.report_home_info (
          report_id, address_line_1, address_line_2, city, state, zip_code, development, subdivision
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      await client.query(homeInfoInsertQuery, [
        reportId,
        reportData.addressLine1,
        reportData.addressLine2,
        reportData.city,
        reportData.state,
        reportData.zipCode,
        reportData.development,
        reportData.subdivision
      ]);
      
      // Update report_basic with report_url
      const reportUrl = `/reports/${reportId}`;
      await client.query(
        'UPDATE customer.report_basic SET report_url = $1 WHERE report_id = $2',
        [reportUrl, reportId]
      );
      
      await client.query('COMMIT');
      
      return {
        reportId,
        reportUrl,
        createdAt
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing database pool...');
  pool.end();
});

module.exports = {
  query,
  testConnection,
  dbQueries,
  pool
};
