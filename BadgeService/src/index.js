/**
 * OpenBadges 3.0 Badge Service
 * Issuance and verification of OpenBadge credentials
 */

import express from 'express';
import cors from 'cors';
import { issueCredential } from './services/issuer.js';
import { verifyCredential, extractCredentialInfo } from './services/verifier.js';
import { initDatabase, saveBadge, getBadgesByEmail, getAllBadges, getBadgeById, logVerification, getStats } from './services/database.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', async (req, res) => {
  const stats = await getStats();
  res.json({
    status: 'ok',
    service: 'badge-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: stats
  });
});

/**
 * POST /api/badge/issue
 * Issue an OpenBadges 3.0 credential
 */
app.post('/api/badge/issue', async (req, res) => {
  try {
    const {
      recipientName,
      recipientEmail,
      achievementName,
      achievementDescription,
      issuerName,
      courseName,
      courseCode,
      completionDate,
      grade,
      credits
    } = req.body;

    // Validate required fields
    if (!recipientName || !recipientEmail || !achievementName || !issuerName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['recipientName', 'recipientEmail', 'achievementName', 'issuerName']
      });
    }

    console.log(`Issuing badge "${achievementName}" to ${recipientName}...`);

    // Issue the credential
    const credential = await issueCredential({
      recipientName,
      recipientEmail,
      achievementName,
      achievementDescription: achievementDescription || `${achievementName}の修了証明`,
      issuerName,
      courseName,
      courseCode,
      completionDate: completionDate || new Date().toISOString().split('T')[0],
      grade,
      credits
    });

    // Save to database
    const dbId = await saveBadge({ ...credential, credentialSubject: { ...credential.credentialSubject, email: recipientEmail } });
    if (dbId) {
      console.log(`Badge saved to database with ID: ${dbId}`);
    }

    console.log(`Badge issued successfully: ${credential.id}`);

    res.json({
      success: true,
      credential,
      message: 'OpenBadge credential issued successfully'
    });

  } catch (error) {
    console.error('Error issuing credential:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to issue credential',
      details: error.message
    });
  }
});

/**
 * POST /api/badge/verify
 * Verify an OpenBadges 3.0 credential
 */
app.post('/api/badge/verify', async (req, res) => {
  try {
    const { credential, verifiedBy } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        error: 'Missing credential in request body'
      });
    }

    console.log(`Verifying credential: ${credential.id || 'unknown'}...`);

    // Verify the credential signature
    const verificationResult = await verifyCredential(credential);

    // Extract credential information
    const credentialInfo = extractCredentialInfo(credential);

    // Log verification to database
    await logVerification(credential.id, verificationResult.verified, verifiedBy);

    console.log(`Verification result: ${verificationResult.verified ? 'VALID' : 'INVALID'}`);

    res.json({
      success: true,
      verified: verificationResult.verified,
      credentialInfo,
      verificationDetails: {
        proofVerified: verificationResult.verified,
        error: verificationResult.error
      },
      message: verificationResult.verified
        ? 'Credential signature is valid'
        : 'Credential verification failed'
    });

  } catch (error) {
    console.error('Error verifying credential:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify credential',
      details: error.message
    });
  }
});

/**
 * GET /api/badge/wallet/:email
 * Get all badges for a student by email
 */
app.get('/api/badge/wallet/:email', async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log(`Fetching badges for: ${email}`);

    const badges = await getBadgesByEmail(email);

    res.json({
      success: true,
      email,
      count: badges.length,
      badges
    });

  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch badges',
      details: error.message
    });
  }
});

/**
 * GET /api/badge/issued
 * Get all issued badges (for issuer dashboard)
 */
app.get('/api/badge/issued', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    console.log(`Fetching issued badges (limit: ${limit})`);

    const badges = await getAllBadges(limit);

    res.json({
      success: true,
      count: badges.length,
      badges
    });

  } catch (error) {
    console.error('Error fetching issued badges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch issued badges',
      details: error.message
    });
  }
});

/**
 * GET /api/badge/:id
 * Get a specific badge by credential ID
 */
app.get('/api/badge/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Handle URL-encoded URN
    const credentialId = decodeURIComponent(id);

    console.log(`Fetching badge: ${credentialId}`);

    const credential = await getBadgeById(credentialId);

    if (!credential) {
      return res.status(404).json({
        success: false,
        error: 'Badge not found'
      });
    }

    res.json({
      success: true,
      credential
    });

  } catch (error) {
    console.error('Error fetching badge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch badge',
      details: error.message
    });
  }
});

/**
 * GET /api/badge/sample
 * Get a sample badge request structure for testing
 */
app.get('/api/badge/sample', (req, res) => {
  res.json({
    sampleRequest: {
      recipientName: '山田 太郎',
      recipientEmail: 'taro.yamada@example.com',
      achievementName: 'データサイエンス基礎',
      achievementDescription: 'データサイエンスの基礎的な知識とスキルを習得し、実践的な分析ができることを証明します。',
      issuerName: '○○大学',
      courseName: 'データサイエンス入門',
      courseCode: 'DS101',
      completionDate: '2025-01-15',
      grade: '優',
      credits: '2'
    },
    endpoints: {
      issue: 'POST /api/badge/issue',
      verify: 'POST /api/badge/verify',
      wallet: 'GET /api/badge/wallet/:email',
      issued: 'GET /api/badge/issued',
      badge: 'GET /api/badge/:id',
      health: 'GET /health'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: err.message
  });
});

// Initialize database and start server
async function start() {
  const dbConnected = await initDatabase();

  app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  OpenBadges 3.0 Badge Service');
    console.log('='.repeat(50));
    console.log(`  Server running on http://localhost:${PORT}`);
    console.log(`  Database: ${dbConnected ? 'Connected' : 'Not configured'}`);
    console.log('');
    console.log('  Endpoints:');
    console.log(`    GET  /health              - Health check`);
    console.log(`    POST /api/badge/issue     - Issue a badge`);
    console.log(`    POST /api/badge/verify    - Verify a badge`);
    console.log(`    GET  /api/badge/wallet/:email - Get student badges`);
    console.log(`    GET  /api/badge/issued    - Get all issued badges`);
    console.log(`    GET  /api/badge/:id       - Get badge by ID`);
    console.log(`    GET  /api/badge/sample    - Sample request`);
    console.log('');
    console.log('='.repeat(50));
  });
}

start();
