/**
 * Database service for badge storage
 */

import pg from 'pg';
const { Pool } = pg;

let pool = null;

/**
 * Initialize database connection
 */
export async function initDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not set, running without database');
    return false;
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test connection
    const client = await pool.connect();
    console.log('Database connected successfully');

    // Create tables if not exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS badges (
        id SERIAL PRIMARY KEY,
        credential_id VARCHAR(255) UNIQUE NOT NULL,
        recipient_name VARCHAR(255) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        achievement_name VARCHAR(255) NOT NULL,
        issuer_name VARCHAR(255) NOT NULL,
        credential_json JSONB NOT NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS verifications (
        id SERIAL PRIMARY KEY,
        credential_id VARCHAR(255) NOT NULL,
        verified_by VARCHAR(255),
        verified BOOLEAN NOT NULL,
        verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_badges_email ON badges(recipient_email);
      CREATE INDEX IF NOT EXISTS idx_badges_credential_id ON badges(credential_id);
    `);

    client.release();
    console.log('Database tables initialized');
    return true;
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    return false;
  }
}

/**
 * Save issued badge to database
 */
export async function saveBadge(credential) {
  if (!pool) return null;

  try {
    const result = await pool.query(
      `INSERT INTO badges (credential_id, recipient_name, recipient_email, achievement_name, issuer_name, credential_json)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (credential_id) DO NOTHING
       RETURNING id`,
      [
        credential.id,
        credential.credentialSubject?.name || 'Unknown',
        credential.credentialSubject?.email || '',
        credential.credentialSubject?.achievement?.name || credential.name || 'Unknown',
        credential.issuer?.name || 'Unknown',
        JSON.stringify(credential)
      ]
    );
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('Failed to save badge:', error.message);
    return null;
  }
}

/**
 * Get badges by recipient email
 */
export async function getBadgesByEmail(email) {
  if (!pool) return [];

  try {
    const result = await pool.query(
      `SELECT credential_id, recipient_name, achievement_name, issuer_name, credential_json, issued_at
       FROM badges
       WHERE recipient_email = $1
       ORDER BY issued_at DESC`,
      [email]
    );
    return result.rows.map(row => ({
      ...row,
      credential: row.credential_json
    }));
  } catch (error) {
    console.error('Failed to get badges:', error.message);
    return [];
  }
}

/**
 * Get all issued badges (for issuer dashboard)
 */
export async function getAllBadges(limit = 50) {
  if (!pool) return [];

  try {
    const result = await pool.query(
      `SELECT credential_id, recipient_name, recipient_email, achievement_name, issuer_name, issued_at
       FROM badges
       ORDER BY issued_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Failed to get all badges:', error.message);
    return [];
  }
}

/**
 * Get badge by credential ID
 */
export async function getBadgeById(credentialId) {
  if (!pool) return null;

  try {
    const result = await pool.query(
      `SELECT credential_json FROM badges WHERE credential_id = $1`,
      [credentialId]
    );
    return result.rows[0]?.credential_json || null;
  } catch (error) {
    console.error('Failed to get badge:', error.message);
    return null;
  }
}

/**
 * Log verification attempt
 */
export async function logVerification(credentialId, verified, verifiedBy = null) {
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO verifications (credential_id, verified, verified_by)
       VALUES ($1, $2, $3)`,
      [credentialId, verified, verifiedBy]
    );
  } catch (error) {
    console.error('Failed to log verification:', error.message);
  }
}

/**
 * Get database statistics
 */
export async function getStats() {
  if (!pool) return { dbConnected: false };

  try {
    const badgeCount = await pool.query('SELECT COUNT(*) FROM badges');
    const verificationCount = await pool.query('SELECT COUNT(*) FROM verifications');

    return {
      dbConnected: true,
      totalBadges: parseInt(badgeCount.rows[0].count),
      totalVerifications: parseInt(verificationCount.rows[0].count)
    };
  } catch (error) {
    return { dbConnected: false, error: error.message };
  }
}
