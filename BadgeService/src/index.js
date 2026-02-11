/**
 * OpenBadges 3.0 Badge Service
 * Issuance and verification of OpenBadge credentials
 */

import express from 'express';
import cors from 'cors';
import { issueCredential } from './services/issuer.js';
import { verifyCredential, extractCredentialInfo } from './services/verifier.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'badge-service',
    version: '1.0.0',
    timestamp: new Date().toISOString()
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
    const { credential } = req.body;

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

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(50));
  console.log('  OpenBadges 3.0 Badge Service');
  console.log('='.repeat(50));
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('  Endpoints:');
  console.log(`    GET  /health          - Health check`);
  console.log(`    POST /api/badge/issue - Issue a badge`);
  console.log(`    POST /api/badge/verify - Verify a badge`);
  console.log(`    GET  /api/badge/sample - Sample request`);
  console.log('');
  console.log('='.repeat(50));
});
