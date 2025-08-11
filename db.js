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

  // Get neighbourhood comparison (developments/zones) for a specific report
  getNeighborhoodComparison: async (reportId) => {
    const queryText = `
      SELECT report_id, chart_id, series_id, stats_category, locations
      FROM customer.report_charts
      WHERE report_id = $1 AND chart_type = 'neighbourhood_comparison'
      LIMIT 1
    `;
    return await query(queryText, [reportId]);
  },

  // Upsert neighbourhood comparison for a report
  upsertNeighborhoodComparison: async (reportId, mode, names, chartType) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(`
        SELECT chart_id
        FROM customer.report_charts
        WHERE report_id = $1 AND chart_type = 'neighbourhood_comparison'
      `, [reportId]);

      if (existing.rowCount > 0) {
        const chartId = existing.rows[0].chart_id;
        await client.query(`
          UPDATE customer.report_charts
          SET series_id = $1, stats_category = $2, locations = $3::text[]
          WHERE chart_id = $4
        `, [chartType || null, mode || null, names, chartId]);
      } else {
        const maxChartIdResult = await client.query(`
          SELECT COALESCE(MAX(chart_id), 0) as max_chart_id
          FROM customer.report_charts
        `);
        const nextChartId = maxChartIdResult.rows[0].max_chart_id + 1;

        await client.query(`
          INSERT INTO customer.report_charts (chart_id, report_id, chart_type, series_id, stats_category, locations)
          VALUES ($1, $2, 'neighbourhood_comparison', $3, $4, $5::text[])
        `, [nextChartId, reportId, chartType || null, mode || null, names]);
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
          ) FILTER (WHERE rc.chart_id IS NOT NULL AND rc.chart_type != 'fred'), 
          '[]'::json
        ) as charts,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'chart_id', rfc.chart_id,
              'series_id', rfc.series_id
            )
          ) FILTER (WHERE rfc.chart_id IS NOT NULL), 
          '[]'::json
        ) as fred_charts,
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
      LEFT JOIN customer.report_charts rc ON rb.report_id = rc.report_id AND rc.chart_type != 'fred'
      LEFT JOIN customer.report_charts rfc ON rb.report_id = rfc.report_id AND rfc.chart_type = 'fred'
      LEFT JOIN customer.report_interest_area ria ON rb.report_id = ria.report_id
      WHERE rb.report_id = $1
      GROUP BY rb.report_id, rb.created_at, rb.last_updated, rb.report_url, 
               rb.agent_name, rb.first_name, rb.last_name,
               rhi.address_line_1, rhi.address_line_2, rhi.city, rhi.state, 
               rhi.zip_code, rhi.development, rhi.subdivision
    `;
    
    return await query(queryText, [reportId]);
  },

  // Get report by lastname-id URL format (e.g., "smith-1234")
  getReportByUrl: async (urlSlug) => {
    // Query for report that matches the exact URL slug
    const expectedUrl = `/reports/${urlSlug}`;
    
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
          ) FILTER (WHERE rc.chart_id IS NOT NULL AND rc.chart_type != 'fred'), 
          '[]'::json
        ) as charts,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'chart_id', rfc.chart_id,
              'series_id', rfc.series_id
            )
          ) FILTER (WHERE rfc.chart_id IS NOT NULL), 
          '[]'::json
        ) as fred_charts,
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
      LEFT JOIN customer.report_charts rc ON rb.report_id = rc.report_id AND rc.chart_type != 'fred'
      LEFT JOIN customer.report_charts rfc ON rb.report_id = rfc.report_id AND rfc.chart_type = 'fred'
      LEFT JOIN customer.report_interest_area ria ON rb.report_id = ria.report_id
      WHERE rb.report_url = $1
      GROUP BY rb.report_id, rb.created_at, rb.last_updated, rb.report_url, 
               rb.agent_name, rb.first_name, rb.last_name,
               rhi.address_line_1, rhi.address_line_2, rhi.city, rhi.state, 
               rhi.zip_code, rhi.development, rhi.subdivision
    `;
    
    return await query(queryText, [expectedUrl]);
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
      
      // Create lastname-id URL format
      const cleanLastName = reportData.lastName.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')  // Replace non-alphanumeric with hyphens
        .replace(/-+/g, '-')         // Replace multiple hyphens with single
        .replace(/^-|-$/g, '');      // Remove leading/trailing hyphens
      
      const reportUrl = `/reports/${cleanLastName}-${reportId}`;
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
  },

  // Get FRED charts for a specific report
  getFredCharts: async (reportId) => {
    const queryText = `
      SELECT report_id, chart_id, series_id
      FROM customer.report_charts
      WHERE report_id = $1 AND chart_type = 'fred'
      ORDER BY chart_id ASC
    `;
    return await query(queryText, [reportId]);
  },

  // Update/Insert FRED charts for a report (uses existing chart_ids)
  upsertFredCharts: async (reportId, leftSeriesId, rightSeriesId) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get existing FRED charts for this report
      const existingCharts = await client.query(`
        SELECT chart_id, series_id
        FROM customer.report_charts 
        WHERE report_id = $1 AND chart_type = 'fred'
        ORDER BY chart_id ASC
      `, [reportId]);

      if (existingCharts.rowCount === 2) {
        // Update existing charts - smaller chart_id = left, larger chart_id = right
        const leftChartId = existingCharts.rows[0].chart_id;
        const rightChartId = existingCharts.rows[1].chart_id;

        await client.query(`
          UPDATE customer.report_charts 
          SET series_id = $1
          WHERE chart_id = $2
        `, [leftSeriesId, leftChartId]);

        await client.query(`
          UPDATE customer.report_charts 
          SET series_id = $1
          WHERE chart_id = $2
        `, [rightSeriesId, rightChartId]);

      } else {
        // Need to create new charts - get next available chart_ids
        const maxChartIdResult = await client.query(`
          SELECT COALESCE(MAX(chart_id), 0) as max_chart_id
          FROM customer.report_charts
        `);
        
        const nextChartId = maxChartIdResult.rows[0].max_chart_id + 1;
        const leftChartId = nextChartId;
        const rightChartId = nextChartId + 1;

        // Insert new charts
        await client.query(`
          INSERT INTO customer.report_charts (chart_id, report_id, chart_type, series_id, stats_category, locations)
          VALUES ($1, $2, 'fred', $3, null, null)
        `, [leftChartId, reportId, leftSeriesId]);

        await client.query(`
          INSERT INTO customer.report_charts (chart_id, report_id, chart_type, series_id, stats_category, locations)
          VALUES ($1, $2, 'fred', $3, null, null)
        `, [rightChartId, reportId, rightSeriesId]);
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Get FRED series options for comparison
  getFredSeries: async (level = 'COUNTY') => {
    const queryText = `
      SELECT id, key_name, display_name, series_pattern, lead_zero, value_type, sort_order, description
      FROM fred.series
      WHERE level = $1 AND is_active = TRUE
      ORDER BY sort_order
    `;
    return await query(queryText, [level.toUpperCase()]);
  },

  // Get counties by state for FRED comparison
  getCountiesByState: async (state) => {
    const queryText = `
      SELECT 
        countyname as name,
        LPAD(statefips::text, 2, '0') || LPAD(countyfips::text, 3, '0') as id
      FROM irs.county_fips_xref
      WHERE state = $1
      ORDER BY countyname
    `;
    return await query(queryText, [state]);
  },

  // Get area comparison for a specific report
  getAreaComparison: async (reportId) => {
    const queryText = `
      SELECT report_id, chart_id, series_id, locations
      FROM customer.report_charts
      WHERE report_id = $1 AND chart_type = 'county_comparison'
      LIMIT 1
    `;
    return await query(queryText, [reportId]);
  },

  // Update/Insert area comparison for a report
  upsertAreaComparison: async (reportId, seriesId, countyIds) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get existing area comparison for this report
      const existingComparison = await client.query(`
        SELECT chart_id
        FROM customer.report_charts 
        WHERE report_id = $1 AND chart_type = 'county_comparison'
      `, [reportId]);

      if (existingComparison.rowCount > 0) {
        // Update existing comparison
        const chartId = existingComparison.rows[0].chart_id;

        await client.query(`
          UPDATE customer.report_charts 
          SET series_id = $1, locations = $2
          WHERE chart_id = $3
        `, [seriesId, countyIds, chartId]);

      } else {
        // Create new comparison - get next available chart_id
        const maxChartIdResult = await client.query(`
          SELECT COALESCE(MAX(chart_id), 0) as max_chart_id
          FROM customer.report_charts
        `);
        
        const nextChartId = maxChartIdResult.rows[0].max_chart_id + 1;

        // Insert new comparison
        await client.query(`
          INSERT INTO customer.report_charts (chart_id, report_id, chart_type, series_id, stats_category, locations)
          VALUES ($1, $2, 'county_comparison', $3, null, $4)
        `, [nextChartId, reportId, seriesId, countyIds]);
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Get neighborhood sales data for a specific development
  getNeighborhoodSalesData: async (reportId) => {
    const queryText = `
      WITH report_development AS (
        SELECT development 
        FROM customer.report_home_info 
        WHERE report_id = $1
      ),
      recent_sales AS (
        SELECT mbr.*
        FROM mls.beaches_residential mbr
        INNER JOIN waterfrontdata.development_data dd 
          ON mbr.parcel_id = dd.parcel_number
        WHERE dd.development_name = (SELECT development FROM report_development)
          AND mbr.sold_date IS NOT NULL 
          AND mbr.sold_date != ''
          AND mbr.sold_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          AND EXTRACT(YEAR FROM mbr.sold_date::DATE) >= EXTRACT(YEAR FROM CURRENT_DATE) - 10
          AND mbr.sold_price IS NOT NULL
          AND mbr.sold_price != ''
          AND mbr.sold_price ~ '^[0-9]+(\\.[0-9]+)?$'
      )
      SELECT 
        COUNT(*) as total_sales_count,
        (SELECT development FROM report_development) as development_name,
        MIN(sold_date::DATE) as earliest_sale_date,
        MAX(sold_date::DATE) as latest_sale_date,
        COUNT(DISTINCT parcel_id) as unique_parcels_with_sales
      FROM recent_sales;
    `;
    
    return await query(queryText, [reportId]);
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
