/**
 * OpenBadges 3.0 Credential Issuer
 * Issues credentials in OpenBadges 3.0 format with Ed25519 signature
 */

import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keysPath = join(__dirname, '..', '..', 'keys', 'issuer-key.json');

/**
 * Load the issuer's key pair from file or environment variable
 */
async function loadKeyPair() {
  // Try environment variable first (for production deployment)
  if (process.env.ISSUER_KEY_JSON) {
    const keyData = JSON.parse(process.env.ISSUER_KEY_JSON);
    const keyPair = await Ed25519VerificationKey2020.from(keyData);
    return keyPair;
  }

  // Fall back to file (for local development)
  if (!existsSync(keysPath)) {
    throw new Error(
      'Issuer key not found. Set ISSUER_KEY_JSON env var or run "npm run generate-keys" first.'
    );
  }

  const keyData = JSON.parse(readFileSync(keysPath, 'utf8'));
  const keyPair = await Ed25519VerificationKey2020.from(keyData);
  return keyPair;
}

/**
 * Create a simple hash-based signature (for demo purposes)
 * In production, use proper Ed25519 signing
 */
async function signCredential(credential, keyPair) {
  // Create a canonical string representation of the credential
  const credentialCopy = { ...credential };
  delete credentialCopy.proof; // Remove any existing proof

  const canonicalString = JSON.stringify(credentialCopy, Object.keys(credentialCopy).sort());

  // Sign using the key pair
  const signer = keyPair.signer();
  const data = new TextEncoder().encode(canonicalString);
  const signatureBytes = await signer.sign({ data });

  // Convert to base64
  const proofValue = Buffer.from(signatureBytes).toString('base64');

  return {
    type: 'Ed25519Signature2020',
    created: new Date().toISOString(),
    verificationMethod: keyPair.id,
    proofPurpose: 'assertionMethod',
    proofValue: proofValue
  };
}

/**
 * Issue an OpenBadges 3.0 credential
 *
 * @param {Object} params - Credential parameters
 * @returns {Object} The signed verifiable credential
 */
export async function issueCredential({
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
}) {
  // Load key to get issuer DID
  const keyPair = await loadKeyPair();
  const issuerDid = keyPair.controller;

  // Generate unique IDs
  const credentialId = `urn:uuid:${uuidv4()}`;
  const achievementId = `urn:uuid:${uuidv4()}`;
  const subjectId = `urn:uuid:${uuidv4()}`;

  // Build the OpenBadges 3.0 credential
  const credential = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'
    ],
    id: credentialId,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    issuer: {
      id: issuerDid,
      type: ['Profile'],
      name: issuerName
    },
    validFrom: new Date().toISOString(),
    name: achievementName,
    credentialSubject: {
      id: subjectId,
      type: ['AchievementSubject'],
      name: recipientName,
      achievement: {
        id: achievementId,
        type: ['Achievement'],
        name: achievementName,
        description: achievementDescription,
        criteria: {
          narrative: `${courseName || achievementName}を修了し、必要な評価基準を満たしたことを証明します。`
        }
      }
    }
  };

  // Add optional fields if provided
  if (courseName) {
    credential.credentialSubject.achievement.fieldOfStudy = courseName;
  }

  if (courseCode) {
    credential.credentialSubject.achievement.humanCode = courseCode;
  }

  // Add result (grade/credits) if provided
  if (grade || credits) {
    credential.credentialSubject.result = [];

    if (grade) {
      credential.credentialSubject.result.push({
        type: ['Result'],
        resultDescription: {
          id: `urn:uuid:${uuidv4()}`,
          type: ['ResultDescription'],
          name: '成績評価',
          resultType: 'GradeLevel'
        },
        value: grade
      });
    }

    if (credits) {
      credential.credentialSubject.result.push({
        type: ['Result'],
        resultDescription: {
          id: `urn:uuid:${uuidv4()}`,
          type: ['ResultDescription'],
          name: '単位数',
          resultType: 'CreditHours'
        },
        value: String(credits)
      });
    }
  }

  // Add completion date as achievement date
  if (completionDate) {
    credential.credentialSubject.achievedDate = completionDate;
  }

  // Sign the credential
  const proof = await signCredential(credential, keyPair);
  credential.proof = proof;

  return credential;
}
