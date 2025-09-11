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
      SELECT report_id, created_at, last_updated, report_url, agent_name, first_name, last_name, email
      FROM customer.report_basic
    `;
    
    if (reportId) {
      return await query(`${baseQuery} WHERE report_id = $1`, [reportId]);
    }
    return await query(baseQuery);
  },

  // Resolve primary county FIPS by ZIP (uses otherdata.zip_city_county_xref)
  getPrimaryCountyFipsByZip: async (zip) => {
    const queryText = `
      SELECT DISTINCT
        LPAD(zip::text, 5, '0') AS zip5,
        LPAD(county_fips::text, 5, '0') AS fips,
        county_name,
        state_id,
        state_name
      FROM otherdata.zip_city_county_xref
      WHERE LPAD(zip::text, 5, '0') = LPAD($1::text, 5, '0')
      LIMIT 1
    `;
    return await query(queryText, [ String(zip || '').trim() ]);
  },
  
  // Resolve a county FIPS from county name and state input (2-letter or full name)
  getCountyFipsByNameState: async (countyName, stateInput) => {
    const normalizedCounty = String(countyName || '').trim().replace(/\s+county$/i, '');
    const stateParam = stateInput ? String(stateInput).trim() : null;

    // Primary: IRS crosswalk, matching contains and handling state resolution from 2-letter code
    const primaryQuery = `
      WITH state_resolved AS (
        SELECT 
          CASE 
            WHEN COALESCE($2::text, '') = '' THEN NULL
            WHEN length(trim($2::text)) = 2 THEN (
              SELECT DISTINCT state_name 
              FROM otherdata.zip_city_county_xref 
              WHERE upper(state_id) = upper($2::text)
              LIMIT 1
            )
            ELSE $2::text
          END AS state_name
      )
      SELECT DISTINCT 
        LPAD(c.countyfips::text, 3, '0') AS countyfips,
        LPAD(c.statefips::text, 2, '0') AS statefips,
        LPAD(c.statefips::text, 2, '0') || LPAD(c.countyfips::text, 3, '0') AS fips,
        c.countyname,
        c.state AS state_name
      FROM irs.county_fips_xref c
      CROSS JOIN state_resolved s
      WHERE c.countyname ILIKE ('%' || $1 || '%')
        AND (
          s.state_name IS NULL
          OR c.state = s.state_name
          OR c.state ILIKE s.state_name
        )
      ORDER BY c.countyname ASC, c.state ASC
      LIMIT 1
    `;
    const primary = await query(primaryQuery, [ normalizedCounty, stateParam ]);
    if (primary.rowCount > 0) return primary;

    // Fallback: use ZIP/County xref (distinct county_fips by name/state)
    const fallbackQuery = `
      WITH state_resolved AS (
        SELECT 
          CASE 
            WHEN COALESCE($2::text, '') = '' THEN NULL
            WHEN length(trim($2::text)) = 2 THEN (
              SELECT DISTINCT state_name 
              FROM otherdata.zip_city_county_xref 
              WHERE upper(state_id) = upper($2::text)
              LIMIT 1
            )
            ELSE $2::text
          END AS state_name
      )
      SELECT DISTINCT 
        LPAD(z.county_fips::text, 5, '0') AS fips,
        z.county_name AS countyname,
        z.state_name
      FROM otherdata.zip_city_county_xref z
      CROSS JOIN state_resolved s
      WHERE z.county_name ILIKE ('%' || $1 || '%')
        AND (
          s.state_name IS NULL
          OR z.state_name = s.state_name
          OR z.state_name ILIKE s.state_name
        )
      ORDER BY z.county_name ASC, z.state_name ASC
      LIMIT 1
    `;
    const fallback = await query(fallbackQuery, [ normalizedCounty, stateParam ]);
    return fallback;
  },

  // County time series aggregated from otherdata.realtor_historic by county FIPS
  getCountySeriesByFips: async (countyFips, months = 24) => {
    const queryText = `
      WITH params AS (
        SELECT 
          LPAD($1::text, 5, '0') AS county_fips,
          GREATEST(1, LEAST(120, $2::int)) AS months_back,
          to_char(date_trunc('month', now()) - ($2::int || ' months')::interval, 'YYYYMM')::int AS min_yyyymm
      ), zx AS (
        SELECT LPAD(zip::text, 5, '0') AS zip5, county_fips, county_name, state_id
        FROM otherdata.zip_city_county_xref
      ), rh AS (
        SELECT 
          month_date_yyyymm::int AS yyyymm,
          LPAD(postal_code::text, 5, '0') AS zip5,
          NULLIF(average_listing_price, -1) AS avg_listing_price,
          NULLIF(median_listing_price, -1) AS med_listing_price,
          NULLIF(median_days_on_market, -1) AS median_days_on_market,
          NULLIF(median_listing_price_per_square_foot, -1) AS median_price_per_sqft,
          GREATEST(COALESCE(NULLIF(total_listing_count, -1), 0), 0) AS total_listing_count,
          GREATEST(COALESCE(NULLIF(active_listing_count, -1), 0), 0) AS active_listing_count,
          GREATEST(COALESCE(NULLIF(new_listing_count, -1), 0), 0) AS new_listing_count,
          GREATEST(COALESCE(NULLIF(pending_listing_count, -1), 0), 0) AS pending_listing_count,
          GREATEST(COALESCE(NULLIF(price_increased_count, -1), 0), 0) AS price_increased_count,
          GREATEST(COALESCE(NULLIF(price_reduced_count, -1), 0), 0) AS price_reduced_count,
          quality_flag
        FROM otherdata.realtor_historic
      ), joined AS (
        SELECT 
          rh.*, zx.county_fips AS zx_fips, zx.county_name, zx.state_id
        FROM rh
        JOIN zx USING (zip5)
      )
      SELECT 
        j.zx_fips AS county_fips,
        MIN(j.county_name) AS county_name,
        MIN(j.state_id) AS state_id,
        j.yyyymm AS month_date_yyyymm,
        SUM(j.active_listing_count) AS active_listing_count,
        SUM(j.new_listing_count) AS new_listing_count,
        SUM(j.pending_listing_count) AS pending_listing_count,
        SUM(j.total_listing_count) AS total_listing_count,
        SUM(j.price_increased_count) AS price_increased_count,
        SUM(j.price_reduced_count) AS price_reduced_count,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(COALESCE(j.avg_listing_price, 0) * j.total_listing_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS avg_listing_price,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(COALESCE(j.med_listing_price, 0) * j.total_listing_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS median_listing_price_proxy,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(COALESCE(j.median_days_on_market, 0) * j.total_listing_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS avg_days_on_market,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(COALESCE(j.median_price_per_sqft, 0) * j.total_listing_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS avg_price_per_sqft,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(j.pending_listing_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS pending_ratio,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(j.price_increased_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS price_increased_share,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(j.price_reduced_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS price_reduced_share
      FROM joined j, params p
      WHERE j.zx_fips = p.county_fips
        AND j.quality_flag = 1
        AND j.yyyymm >= p.min_yyyymm
      GROUP BY j.zx_fips, j.yyyymm
      ORDER BY j.yyyymm ASC
    `;
    return await query(queryText, [ String(countyFips || '').trim(), Number(months || 24) ]);
  },

  // ZIP time series from otherdata.realtor_historic by ZIP (no aggregation)
  getZipSeriesByZip: async (zip, months = 24) => {
    const queryText = `
      WITH params AS (
        SELECT 
          LPAD($1::text, 5, '0') AS zip5,
          GREATEST(1, LEAST(120, $2::int)) AS months_back,
          to_char(date_trunc('month', now()) - ($2::int || ' months')::interval, 'YYYYMM')::int AS min_yyyymm
      ), rh AS (
        SELECT 
          month_date_yyyymm::int AS yyyymm,
          LPAD(postal_code::text, 5, '0') AS zip5,
          zip_name,
          NULLIF(average_listing_price, -1) AS avg_listing_price,
          NULLIF(median_listing_price, -1) AS med_listing_price,
          NULLIF(median_listing_price_mm, -1) AS med_listing_price_mm,
          NULLIF(median_listing_price_yy, -1) AS med_listing_price_yy,
          NULLIF(median_days_on_market, -1) AS median_days_on_market,
          NULLIF(median_days_on_market_mm, -1) AS median_days_on_market_mm,
          NULLIF(median_days_on_market_yy, -1) AS median_days_on_market_yy,
          NULLIF(median_listing_price_per_square_foot, -1) AS median_price_per_sqft,
          NULLIF(median_listing_price_per_square_foot_mm, -1) AS median_price_per_sqft_mm,
          NULLIF(median_listing_price_per_square_foot_yy, -1) AS median_price_per_sqft_yy,
          NULLIF(median_square_feet, -1) AS median_square_feet,
          NULLIF(median_square_feet_mm, -1) AS median_square_feet_mm,
          NULLIF(median_square_feet_yy, -1) AS median_square_feet_yy,
          GREATEST(COALESCE(NULLIF(total_listing_count, -1), 0), 0) AS total_listing_count,
          NULLIF(total_listing_count_mm, -1) AS total_listing_count_mm,
          NULLIF(total_listing_count_yy, -1) AS total_listing_count_yy,
          GREATEST(COALESCE(NULLIF(active_listing_count, -1), 0), 0) AS active_listing_count,
          NULLIF(active_listing_count_mm, -1) AS active_listing_count_mm,
          NULLIF(active_listing_count_yy, -1) AS active_listing_count_yy,
          GREATEST(COALESCE(NULLIF(new_listing_count, -1), 0), 0) AS new_listing_count,
          NULLIF(new_listing_count_mm, -1) AS new_listing_count_mm,
          NULLIF(new_listing_count_yy, -1) AS new_listing_count_yy,
          GREATEST(COALESCE(NULLIF(pending_listing_count, -1), 0), 0) AS pending_listing_count,
          NULLIF(pending_listing_count_mm, -1) AS pending_listing_count_mm,
          NULLIF(pending_listing_count_yy, -1) AS pending_listing_count_yy,
          GREATEST(COALESCE(NULLIF(price_increased_count, -1), 0), 0) AS price_increased_count,
          NULLIF(price_increased_count_mm, -1) AS price_increased_count_mm,
          NULLIF(price_increased_count_yy, -1) AS price_increased_count_yy,
          GREATEST(COALESCE(NULLIF(price_reduced_count, -1), 0), 0) AS price_reduced_count,
          NULLIF(price_reduced_count_mm, -1) AS price_reduced_count_mm,
          NULLIF(price_reduced_count_yy, -1) AS price_reduced_count_yy,
          NULLIF(price_increased_share, -1) AS price_increased_share,
          NULLIF(price_increased_share_mm, -1) AS price_increased_share_mm,
          NULLIF(price_increased_share_yy, -1) AS price_increased_share_yy,
          NULLIF(price_reduced_share, -1) AS price_reduced_share,
          NULLIF(price_reduced_share_mm, -1) AS price_reduced_share_mm,
          NULLIF(price_reduced_share_yy, -1) AS price_reduced_share_yy,
          NULLIF(pending_ratio, -1) AS pending_ratio,
          NULLIF(pending_ratio_mm, -1) AS pending_ratio_mm,
          NULLIF(pending_ratio_yy, -1) AS pending_ratio_yy,
          quality_flag
        FROM otherdata.realtor_historic
      ), zx AS (
        SELECT LPAD(zip::text, 5, '0') AS zip5, city, state_id
        FROM otherdata.zip_city_county_xref
      ), joined AS (
        SELECT rh.*, zx.city, zx.state_id
        FROM rh
        JOIN zx USING (zip5)
      )
      SELECT 
        j.zip5 AS zip5,
        MIN(COALESCE(j.zip_name, j.city)) AS city,
        MIN(j.state_id) AS state_id,
        j.yyyymm AS month_date_yyyymm,
        MAX(j.active_listing_count) AS active_listing_count,
        MAX(j.active_listing_count_mm) AS active_listing_count_mm,
        MAX(j.active_listing_count_yy) AS active_listing_count_yy,
        MAX(j.new_listing_count) AS new_listing_count,
        MAX(j.new_listing_count_mm) AS new_listing_count_mm,
        MAX(j.new_listing_count_yy) AS new_listing_count_yy,
        MAX(j.pending_listing_count) AS pending_listing_count,
        MAX(j.pending_listing_count_mm) AS pending_listing_count_mm,
        MAX(j.pending_listing_count_yy) AS pending_listing_count_yy,
        MAX(j.total_listing_count) AS total_listing_count,
        MAX(j.total_listing_count_mm) AS total_listing_count_mm,
        MAX(j.total_listing_count_yy) AS total_listing_count_yy,
        MAX(j.price_increased_count) AS price_increased_count,
        MAX(j.price_increased_count_mm) AS price_increased_count_mm,
        MAX(j.price_increased_count_yy) AS price_increased_count_yy,
        MAX(j.price_reduced_count) AS price_reduced_count,
        MAX(j.price_reduced_count_mm) AS price_reduced_count_mm,
        MAX(j.price_reduced_count_yy) AS price_reduced_count_yy,
        MAX(j.price_increased_share) AS price_increased_share,
        MAX(j.price_increased_share_mm) AS price_increased_share_mm,
        MAX(j.price_increased_share_yy) AS price_increased_share_yy,
        MAX(j.price_reduced_share) AS price_reduced_share,
        MAX(j.price_reduced_share_mm) AS price_reduced_share_mm,
        MAX(j.price_reduced_share_yy) AS price_reduced_share_yy,
        MAX(j.avg_listing_price) AS avg_listing_price,
        MAX(j.med_listing_price) AS median_listing_price_proxy,
        MAX(j.med_listing_price) AS median_listing_price,
        MAX(j.median_days_on_market) AS avg_days_on_market,
        MAX(j.median_days_on_market_mm) AS avg_days_on_market_mm,
        MAX(j.median_days_on_market_yy) AS avg_days_on_market_yy,
        MAX(j.median_price_per_sqft) AS avg_price_per_sqft,
        MAX(j.median_price_per_sqft_mm) AS avg_price_per_sqft_mm,
        MAX(j.median_price_per_sqft_yy) AS avg_price_per_sqft_yy,
        MAX(j.median_square_feet) AS median_square_feet,
        MAX(j.median_square_feet_mm) AS median_square_feet_mm,
        MAX(j.median_square_feet_yy) AS median_square_feet_yy,
        CASE WHEN MAX(j.total_listing_count) > 0 THEN MAX(j.pending_listing_count)::numeric / NULLIF(MAX(j.total_listing_count), 0) ELSE NULL END AS pending_ratio,
        CASE WHEN MAX(j.total_listing_count) > 0 THEN MAX(j.price_increased_count)::numeric / NULLIF(MAX(j.total_listing_count), 0) ELSE NULL END AS price_increased_share,
        CASE WHEN MAX(j.total_listing_count) > 0 THEN MAX(j.price_reduced_count)::numeric / NULLIF(MAX(j.total_listing_count), 0) ELSE NULL END AS price_reduced_share
      FROM joined j, params p
      WHERE j.zip5 = p.zip5
        AND j.quality_flag = 1
        AND j.yyyymm >= p.min_yyyymm
      GROUP BY j.zip5, j.yyyymm
      ORDER BY j.yyyymm ASC
    `;
    return await query(queryText, [ String(zip || '').trim(), Number(months || 24) ]);
  },

  // Multi-ZIP comparison: time series for an array of ZIPs
  getZipSeriesMultiByZip: async (zipArray, months = 24) => {
    const queryText = `
      WITH params AS (
        SELECT 
          ARRAY(SELECT DISTINCT LPAD(TRIM(x)::text, 5, '0') FROM unnest($1::text[]) x) AS zips_list,
          GREATEST(1, LEAST(120, $2::int)) AS months_back,
          to_char(date_trunc('month', now()) - ($2::int || ' months')::interval, 'YYYYMM')::int AS min_yyyymm
      ), rh AS (
        SELECT 
          month_date_yyyymm::int AS yyyymm,
          LPAD(postal_code::text, 5, '0') AS zip5,
          NULLIF(average_listing_price, -1) AS avg_listing_price,
          NULLIF(median_listing_price, -1) AS med_listing_price,
          NULLIF(median_days_on_market, -1) AS median_days_on_market,
          NULLIF(median_listing_price_per_square_foot, -1) AS median_price_per_sqft,
          GREATEST(COALESCE(NULLIF(total_listing_count, -1), 0), 0) AS total_listing_count,
          GREATEST(COALESCE(NULLIF(active_listing_count, -1), 0), 0) AS active_listing_count,
          GREATEST(COALESCE(NULLIF(new_listing_count, -1), 0), 0) AS new_listing_count,
          GREATEST(COALESCE(NULLIF(pending_listing_count, -1), 0), 0) AS pending_listing_count,
          GREATEST(COALESCE(NULLIF(price_increased_count, -1), 0), 0) AS price_increased_count,
          GREATEST(COALESCE(NULLIF(price_reduced_count, -1), 0), 0) AS price_reduced_count,
          quality_flag
        FROM otherdata.realtor_historic
      ), zx AS (
        SELECT LPAD(zip::text, 5, '0') AS zip5, city, state_id
        FROM otherdata.zip_city_county_xref
      ), joined AS (
        SELECT rh.*, zx.city, zx.state_id
        FROM rh JOIN zx USING (zip5)
      )
      SELECT 
        j.zip5 AS zip5,
        MIN(j.city) AS city,
        MIN(j.state_id) AS state_id,
        j.yyyymm AS month_date_yyyymm,
        MAX(j.active_listing_count) AS active_listing_count,
        MAX(j.new_listing_count) AS new_listing_count,
        MAX(j.pending_listing_count) AS pending_listing_count,
        MAX(j.total_listing_count) AS total_listing_count,
        MAX(j.price_increased_count) AS price_increased_count,
        MAX(j.price_reduced_count) AS price_reduced_count,
        MAX(j.avg_listing_price) AS avg_listing_price,
        MAX(j.med_listing_price) AS median_listing_price_proxy,
        MAX(j.median_days_on_market) AS avg_days_on_market,
        MAX(j.median_price_per_sqft) AS avg_price_per_sqft,
        CASE WHEN MAX(j.total_listing_count) > 0 THEN MAX(j.pending_listing_count)::numeric / NULLIF(MAX(j.total_listing_count), 0) ELSE NULL END AS pending_ratio,
        CASE WHEN MAX(j.total_listing_count) > 0 THEN MAX(j.price_increased_count)::numeric / NULLIF(MAX(j.total_listing_count), 0) ELSE NULL END AS price_increased_share,
        CASE WHEN MAX(j.total_listing_count) > 0 THEN MAX(j.price_reduced_count)::numeric / NULLIF(MAX(j.total_listing_count), 0) ELSE NULL END AS price_reduced_share
      FROM joined j, params p
      WHERE j.zip5 = ANY(p.zips_list)
        AND j.quality_flag = 1
        AND j.yyyymm >= p.min_yyyymm
      GROUP BY j.zip5, j.yyyymm
      ORDER BY j.zip5 ASC, j.yyyymm ASC
    `;
    const zipList = Array.isArray(zipArray) ? zipArray : String(zipArray || '').split(',');
    const cleaned = zipList.map(v => String(v || '').trim()).filter(v => v.length > 0);
    if (cleaned.length === 0) {
      return { rows: [], rowCount: 0 };
    }
    return await query(queryText, [ cleaned, Number(months || 24) ]);
  },

  // Latest single row for a ZIP from otherdata.realtor_historic
  getZipLatestByZip: async (zip) => {
    const queryText = `
      WITH latest AS (
        SELECT 
          month_date_yyyymm::int AS month_date_yyyymm,
          LPAD(postal_code::text, 5, '0') AS zip5,
          zip_name,
          NULLIF(median_listing_price, -1) AS median_listing_price,
          NULLIF(median_days_on_market, -1) AS median_days_on_market,
          NULLIF(median_listing_price_per_square_foot, -1) AS median_listing_price_per_square_foot,
          GREATEST(COALESCE(NULLIF(active_listing_count, -1), 0), 0) AS active_listing_count,
          GREATEST(COALESCE(NULLIF(new_listing_count, -1), 0), 0) AS new_listing_count,
          GREATEST(COALESCE(NULLIF(pending_listing_count, -1), 0), 0) AS pending_listing_count,
          GREATEST(COALESCE(NULLIF(total_listing_count, -1), 0), 0) AS total_listing_count,
          quality_flag
        FROM otherdata.realtor_historic
        WHERE LPAD(postal_code::text, 5, '0') = LPAD($1::text, 5, '0')
          AND quality_flag = 1
        ORDER BY month_date_yyyymm DESC
        LIMIT 1
      )
      SELECT 
        l.*, z.city, z.state_id
      FROM latest l
      LEFT JOIN otherdata.zip_city_county_xref z
        ON z.zip::text = l.zip5
      LIMIT 1
    `;
    return await query(queryText, [ String(zip || '').trim() ]);
  },

  // Multi-county comparison: time series for an array of county FIPS
  getCountySeriesMultiByFips: async (countyFipsArray, months = 24) => {
    const queryText = `
      WITH params AS (
        SELECT 
          ARRAY(SELECT DISTINCT LPAD(TRIM(x)::text, 5, '0') FROM unnest($1::text[]) x) AS fips_list,
          GREATEST(1, LEAST(120, $2::int)) AS months_back,
          to_char(date_trunc('month', now()) - ($2::int || ' months')::interval, 'YYYYMM')::int AS min_yyyymm
      ), zx AS (
        SELECT LPAD(zip::text, 5, '0') AS zip5, county_fips, county_name, state_id
        FROM otherdata.zip_city_county_xref
      ), rh AS (
        SELECT 
          month_date_yyyymm::int AS yyyymm,
          LPAD(postal_code::text, 5, '0') AS zip5,
          NULLIF(average_listing_price, -1) AS avg_listing_price,
          NULLIF(median_listing_price, -1) AS med_listing_price,
          NULLIF(median_days_on_market, -1) AS median_days_on_market,
          NULLIF(median_listing_price_per_square_foot, -1) AS median_price_per_sqft,
          GREATEST(COALESCE(NULLIF(total_listing_count, -1), 0), 0) AS total_listing_count,
          GREATEST(COALESCE(NULLIF(active_listing_count, -1), 0), 0) AS active_listing_count,
          GREATEST(COALESCE(NULLIF(new_listing_count, -1), 0), 0) AS new_listing_count,
          GREATEST(COALESCE(NULLIF(pending_listing_count, -1), 0), 0) AS pending_listing_count,
          GREATEST(COALESCE(NULLIF(price_increased_count, -1), 0), 0) AS price_increased_count,
          GREATEST(COALESCE(NULLIF(price_reduced_count, -1), 0), 0) AS price_reduced_count,
          quality_flag
        FROM otherdata.realtor_historic
      ), joined AS (
        SELECT rh.*, zx.county_fips AS zx_fips, zx.county_name, zx.state_id
        FROM rh JOIN zx USING (zip5)
      )
      SELECT 
        j.zx_fips AS county_fips,
        MIN(j.county_name) AS county_name,
        MIN(j.state_id) AS state_id,
        j.yyyymm AS month_date_yyyymm,
        SUM(j.active_listing_count) AS active_listing_count,
        SUM(j.new_listing_count) AS new_listing_count,
        SUM(j.pending_listing_count) AS pending_listing_count,
        SUM(j.total_listing_count) AS total_listing_count,
        SUM(j.price_increased_count) AS price_increased_count,
        SUM(j.price_reduced_count) AS price_reduced_count,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(COALESCE(j.avg_listing_price, 0) * j.total_listing_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS avg_listing_price,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(COALESCE(j.med_listing_price, 0) * j.total_listing_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS median_listing_price_proxy,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(COALESCE(j.median_days_on_market, 0) * j.total_listing_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS avg_days_on_market,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(COALESCE(j.median_price_per_sqft, 0) * j.total_listing_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS avg_price_per_sqft,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(j.pending_listing_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS pending_ratio,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(j.price_increased_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS price_increased_share,
        CASE WHEN SUM(j.total_listing_count) > 0 THEN
          SUM(j.price_reduced_count)::numeric / NULLIF(SUM(j.total_listing_count), 0)
        ELSE NULL END AS price_reduced_share
      FROM joined j, params p
      WHERE j.zx_fips = ANY(p.fips_list)
        AND j.quality_flag = 1
        AND j.yyyymm >= p.min_yyyymm
      GROUP BY j.zx_fips, j.yyyymm
      ORDER BY j.zx_fips ASC, j.yyyymm ASC
    `;
    const fipsArray = Array.isArray(countyFipsArray) ? countyFipsArray : String(countyFipsArray || '').split(',');
    const cleaned = fipsArray.map(v => String(v || '').trim()).filter(v => v.length > 0);
    if (cleaned.length === 0) {
      return { rows: [], rowCount: 0 };
    }
    return await query(queryText, [ cleaned, Number(months || 24) ]);
  },

  // Get report charts data (legacy compatibility if needed)
  getReportCharts: async (reportId = null) => {
    // Return an empty set; callers now use specific tables per chart type
    const empty = { rows: [], rowCount: 0 };
    if (reportId) return empty;
    return empty;
  },

  // Get report home info
  getReportHomeInfo: async (reportId = null) => {
    const baseQuery = `
      SELECT report_id, address_line_1, address_line_2, city, state, zip_code, development, subdivision, county
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
        rb.email,
        rhi.address_line_1,
        rhi.address_line_2,
        rhi.city as home_city,
        rhi.state as home_state,
        rhi.zip_code,
        rhi.development,
        rhi.subdivision,
        rhi.county,
        -- Aggregate non-FRED charts from new tables
        (
          SELECT (
            COALESCE(county_data.county_json, '[]'::jsonb) || COALESCE(neigh_data.neigh_json, '[]'::jsonb)
          )::json
          FROM (
            SELECT jsonb_agg(
              jsonb_build_object(
                'chart_id', cc.chart_id,
                'chart_type', 'county_comparison',
                'series_id', cc.series_id,
                'locations', cc.locations
              )
            ) AS county_json
            FROM (
              SELECT chart_id, series_id, array_agg(county_name ORDER BY county_name) AS locations
              FROM customer.report_charts_county
              WHERE report_id = rb.report_id
              GROUP BY chart_id, series_id
            ) cc
          ) county_data,
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'chart_id', nc.chart_id,
                'chart_type', 'neighbourhood_comparison',
                'series_id', nc.series,
                'locations', nc.locations
              )
            ) AS neigh_json
            FROM (
              SELECT chart_id, series, array_agg(location ORDER BY location) AS locations
              FROM customer.report_charts_neighborhood
              WHERE report_id = rb.report_id
              GROUP BY chart_id, series
            ) nc
          ) neigh_data
        ) as charts,
        -- Aggregate FRED charts from new table
        COALESCE(
          (
            SELECT json_agg(jsonb_build_object('chart_id', f.chart_id, 'series_id', f.series_id) ORDER BY f.chart_id)
            FROM customer.report_charts_fred f
            WHERE f.report_id = rb.report_id
          ),
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
      LEFT JOIN customer.report_interest_area ria ON rb.report_id = ria.report_id
      WHERE rb.report_id = $1
      GROUP BY rb.report_id, rb.created_at, rb.last_updated, rb.report_url, 
               rb.agent_name, rb.first_name, rb.last_name, rb.email,
               rhi.address_line_1, rhi.address_line_2, rhi.city, rhi.state, 
               rhi.zip_code, rhi.development, rhi.subdivision, rhi.county
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
        rb.email,
        rhi.address_line_1,
        rhi.address_line_2,
        rhi.city as home_city,
        rhi.state as home_state,
        rhi.zip_code,
        rhi.development,
        rhi.subdivision,
        rhi.county,
        (
          SELECT (
            COALESCE(county_data.county_json, '[]'::jsonb) || COALESCE(neigh_data.neigh_json, '[]'::jsonb)
          )::json
          FROM (
            SELECT jsonb_agg(
              jsonb_build_object(
                'chart_id', cc.chart_id,
                'chart_type', 'county_comparison',
                'series_id', cc.series_id,
                'locations', cc.locations
              )
            ) AS county_json
            FROM (
              SELECT chart_id, series_id, array_agg(county_name ORDER BY county_name) AS locations
              FROM customer.report_charts_county
              WHERE report_id = rb.report_id
              GROUP BY chart_id, series_id
            ) cc
          ) county_data,
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'chart_id', nc.chart_id,
                'chart_type', 'neighbourhood_comparison',
                'series_id', nc.series,
                'locations', nc.locations
              )
            ) AS neigh_json
            FROM (
              SELECT chart_id, series, array_agg(location ORDER BY location) AS locations
              FROM customer.report_charts_neighborhood
              WHERE report_id = rb.report_id
              GROUP BY chart_id, series
            ) nc
          ) neigh_data
        ) as charts,
        COALESCE(
          (
            SELECT json_agg(jsonb_build_object('chart_id', f.chart_id, 'series_id', f.series_id) ORDER BY f.chart_id)
            FROM customer.report_charts_fred f
            WHERE f.report_id = rb.report_id
          ),
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
      LEFT JOIN customer.report_interest_area ria ON rb.report_id = ria.report_id
      WHERE rb.report_url = $1
      GROUP BY rb.report_id, rb.created_at, rb.last_updated, rb.report_url, 
               rb.agent_name, rb.first_name, rb.last_name, rb.email,
               rhi.address_line_1, rhi.address_line_2, rhi.city, rhi.state, 
               rhi.zip_code, rhi.development, rhi.subdivision, rhi.county
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
        INSERT INTO customer.report_basic (agent_name, first_name, last_name, email, created_at, last_updated)
        VALUES ($1, $2, $3, LOWER($4), NOW(), NOW())
        RETURNING report_id, created_at
      `;
      
      const basicResult = await client.query(basicInsertQuery, [
        reportData.agentName,
        reportData.firstName,
        reportData.lastName,
        reportData.email || null
      ]);
      
      const reportId = basicResult.rows[0].report_id;
      const createdAt = basicResult.rows[0].created_at;
      
      // Insert into report_home_info using the generated report_id
      const homeInfoInsertQuery = `
        INSERT INTO customer.report_home_info (
          report_id, address_line_1, address_line_2, city, state, county, zip_code, development, subdivision
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      await client.query(homeInfoInsertQuery, [
        reportId,
        reportData.addressLine1,
        reportData.addressLine2,
        reportData.city,
        reportData.state,
        reportData.county,
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

  // Get FRED charts for a specific report (new table)
  getFredCharts: async (reportId) => {
    const queryText = `
      SELECT report_id, chart_id, series_id
      FROM customer.report_charts_fred
      WHERE report_id = $1
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
        FROM customer.report_charts_fred
        WHERE report_id = $1
        ORDER BY chart_id ASC
      `, [reportId]);

      if (existingCharts.rowCount === 2) {
        // Update existing charts - smaller chart_id = left, larger chart_id = right
        const leftChartId = existingCharts.rows[0].chart_id;
        const rightChartId = existingCharts.rows[1].chart_id;

        await client.query(`
          UPDATE customer.report_charts_fred
          SET series_id = $1
          WHERE report_id = $2 AND chart_id = $3
        `, [leftSeriesId, reportId, leftChartId]);

        await client.query(`
          UPDATE customer.report_charts_fred
          SET series_id = $1
          WHERE report_id = $2 AND chart_id = $3
        `, [rightSeriesId, reportId, rightChartId]);

      } else {
        // Need to create new charts - get next available chart_ids
        const maxChartIdResult = await client.query(`
          SELECT COALESCE(MAX(chart_id), 0) as max_chart_id
          FROM customer.report_charts_fred
        `);
        
        const nextChartId = maxChartIdResult.rows[0].max_chart_id + 1;
        const leftChartId = nextChartId;
        const rightChartId = nextChartId + 1;

        // Insert new charts
        await client.query(`
          INSERT INTO customer.report_charts_fred (report_id, chart_id, series_id)
          VALUES ($1, $2, $3)
        `, [reportId, leftChartId, leftSeriesId]);

        await client.query(`
          INSERT INTO customer.report_charts_fred (report_id, chart_id, series_id)
          VALUES ($1, $2, $3)
        `, [reportId, rightChartId, rightSeriesId]);
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

  // Get area (county) comparison for a specific report (new table)
  getAreaComparison: async (reportId) => {
    const queryText = `
      SELECT $1::bigint as report_id,
             MIN(chart_id) as chart_id,
             series_id,
             array_agg(county_name ORDER BY county_name) as locations
      FROM customer.report_charts_county
      WHERE report_id = $1
      GROUP BY series_id
      LIMIT 1
    `;
    return await query(queryText, [reportId]);
  },

  // Update/Insert area comparison for a report (new table)
  upsertAreaComparison: async (reportId, seriesId, countyIds) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Find existing chart_id for this report in county table
      const existingChart = await client.query(`
        SELECT chart_id
        FROM customer.report_charts_county
        WHERE report_id = $1
        LIMIT 1
      `, [reportId]);

      let chartId;
      if (existingChart.rowCount > 0) {
        chartId = existingChart.rows[0].chart_id;
        // Remove existing rows for this chart
        await client.query(`DELETE FROM customer.report_charts_county WHERE report_id = $1 AND chart_id = $2`, [reportId, chartId]);
      } else {
        const maxChartIdResult = await client.query(`SELECT COALESCE(MAX(chart_id), 0) as max_chart_id FROM customer.report_charts_county`);
        chartId = maxChartIdResult.rows[0].max_chart_id + 1;
      }

      // Insert one row per county
      for (const countyName of countyIds) {
        await client.query(`
          INSERT INTO customer.report_charts_county (report_id, chart_id, series_id, county_name)
          VALUES ($1, $2, $3, $4)
        `, [reportId, chartId, seriesId, countyName]);
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
  ,

  // Neighbourhood comparison persistence (supports mixed types)
  upsertNeighbourhoodComparison: async (reportId, seriesId, items) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT chart_id FROM customer.report_charts_neighborhood WHERE report_id = $1 LIMIT 1`,
        [reportId]
      );
      let chartId;
      if (existing.rowCount > 0) {
        chartId = existing.rows[0].chart_id;
        await client.query(`DELETE FROM customer.report_charts_neighborhood WHERE report_id = $1 AND chart_id = $2`, [reportId, chartId]);
      } else {
        const maxChartIdResult = await client.query(`SELECT COALESCE(MAX(chart_id), 0) as max_chart_id FROM customer.report_charts_neighborhood`);
        chartId = maxChartIdResult.rows[0].max_chart_id + 1;
      }

      // Normalize items: accept array of strings (assume development) or objects { name, type }
      const normalized = Array.isArray(items) ? items : [];
      for (const raw of normalized) {
        let name, type;
        if (typeof raw === 'string') {
          name = raw;
          type = 'development';
        } else if (raw && typeof raw === 'object') {
          name = raw.name || raw.location || raw.development || raw.zone;
          type = (raw.type || raw.location_type || '').toLowerCase();
          if (type !== 'development' && type !== 'zone') type = 'development';
        }
        if (!name || String(name).trim().length === 0) continue;
        await client.query(
          `INSERT INTO customer.report_charts_neighborhood (report_id, chart_id, series, location, location_type)
           VALUES ($1, $2, $3, $4, $5)`,
          [reportId, chartId, seriesId || 'sales', String(name).trim(), type]
        );
      }
      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  ,

  // Fetch neighbourhood comparison (new table)
  getNeighbourhoodComparison: async (reportId) => {
    const queryText = `
      SELECT
        $1::bigint as report_id,
        COALESCE(MIN(chart_id), 1) AS chart_id,
        COALESCE(MAX(series), 'sales') AS series_id,
        json_agg(jsonb_build_object('name', location, 'type', location_type) ORDER BY location_type, location) AS items,
        array_agg(location ORDER BY location) FILTER (WHERE location_type = 'development') AS development_names,
        array_agg(location ORDER BY location) FILTER (WHERE location_type = 'zone') AS zone_names
      FROM customer.report_charts_neighborhood
      WHERE report_id = $1
      GROUP BY report_id
      LIMIT 1
    `;
    return await query(queryText, [reportId]);
  }
  ,

  // Retrieve most recent report(s) by email
  getLatestReportByEmail: async (email, limit = 1) => {
    const queryText = `
      SELECT report_id, report_url, first_name, last_name, created_at
      FROM customer.report_basic
      WHERE LOWER(email) = LOWER($1)
      ORDER BY created_at DESC
      LIMIT $2
    `;
    return await query(queryText, [email, Math.max(1, Math.min(10, Number(limit) || 1))]);
  },

  // Zip/City/County lookups from otherdata.zip_city_county_xref
  lookupZipCityByZip: async (zip, state) => {
    const params = [String(zip || '')];
    const where = [
      `LPAD(zip::text, 5, '0') = LPAD($1::text, 5, '0')`
    ];
    if (state && String(state).trim().length > 0) {
      params.push(String(state).trim());
      where.push(`(state_id = $2 OR state_name ILIKE $2)`);
    }

    const queryText = `
      SELECT 
        LPAD(zip::text, 5, '0') AS zip5,
        city,
        state_id,
        state_name,
        county_fips AS primary_county_fips,
        county_name AS primary_county_name,
        COALESCE(NULLIF(county_names_all, ''), county_name) AS county_names_all,
        COALESCE(NULLIF(county_fips_all, ''), county_fips) AS county_fips_all,
        string_to_array(COALESCE(NULLIF(county_names_all, ''), county_name), '|') AS county_names,
        string_to_array(COALESCE(NULLIF(county_fips_all, ''), county_fips), '|') AS county_fips
      FROM otherdata.zip_city_county_xref
      WHERE ${where.join(' AND ')}
      LIMIT 50
    `;
    return await query(queryText, params);
  },

  lookupZipCityByCity: async (city, state) => {
    const params = [ `%${String(city || '').trim()}%` ];
    const where = [ `city ILIKE $1` ];
    if (state && String(state).trim().length > 0) {
      params.push(String(state).trim());
      where.push(`(state_id = $2 OR state_name ILIKE $2)`);
    }

    const queryText = `
      SELECT DISTINCT
        LPAD(zip::text, 5, '0') AS zip5,
        city,
        state_id,
        state_name,
        county_fips AS primary_county_fips,
        county_name AS primary_county_name,
        COALESCE(NULLIF(county_names_all, ''), county_name) AS county_names_all,
        COALESCE(NULLIF(county_fips_all, ''), county_fips) AS county_fips_all,
        string_to_array(COALESCE(NULLIF(county_names_all, ''), county_name), '|') AS county_names,
        string_to_array(COALESCE(NULLIF(county_fips_all, ''), county_fips), '|') AS county_fips
      FROM otherdata.zip_city_county_xref
      WHERE ${where.join(' AND ')}
      ORDER BY state_id, city, zip5
      LIMIT 50
    `;
    return await query(queryText, params);
  },

  lookupZipCityByCounty: async (county, state) => {
    const params = [ `%${String(county || '').trim()}%` ];
    const where = [
      `(county_name ILIKE $1 OR county_names_all ILIKE $1)`
    ];
    if (state && String(state).trim().length > 0) {
      params.push(String(state).trim());
      where.push(`(state_id = $2 OR state_name ILIKE $2)`);
    }

    const queryText = `
      SELECT DISTINCT
        LPAD(zip::text, 5, '0') AS zip5,
        city,
        state_id,
        state_name,
        county_fips AS primary_county_fips,
        county_name AS primary_county_name,
        COALESCE(NULLIF(county_names_all, ''), county_name) AS county_names_all,
        COALESCE(NULLIF(county_fips_all, ''), county_fips) AS county_fips_all,
        string_to_array(COALESCE(NULLIF(county_names_all, ''), county_name), '|') AS county_names,
        string_to_array(COALESCE(NULLIF(county_fips_all, ''), county_fips), '|') AS county_fips
      FROM otherdata.zip_city_county_xref
      WHERE ${where.join(' AND ')}
      ORDER BY state_id, city, zip5
      LIMIT 50
    `;
    return await query(queryText, params);
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
