/**
 * OpenBadges 3.0 Credential Verifier
 * Verifies signed OpenBadge credentials
 */

import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keysDir = join(__dirname, '..', '..', 'keys');

/**
 * Load public key for verification
 */
async function loadPublicKey(keyId) {
  // Try environment variable first (for production deployment)
  if (process.env.ISSUER_PUBLIC_KEY_JSON) {
    try {
      const publicKeyData = JSON.parse(process.env.ISSUER_PUBLIC_KEY_JSON);
      if (publicKeyData.id === keyId) {
        return await Ed25519VerificationKey2020.from(publicKeyData);
      }
    } catch (e) {
      console.warn('Failed to load public key from env:', e.message);
    }
  }

  // Try local public key first
  const publicKeyPath = join(keysDir, 'issuer-public-key.json');
  if (existsSync(publicKeyPath)) {
    try {
      const publicKeyData = JSON.parse(readFileSync(publicKeyPath, 'utf8'));
      // Check if this key matches
      if (publicKeyData.id === keyId) {
        return await Ed25519VerificationKey2020.from(publicKeyData);
      }
    } catch (e) {
      console.warn('Failed to load local public key:', e.message);
    }
  }

  // Try loading from DID document
  const didDocPath = join(keysDir, 'did-document.json');
  if (existsSync(didDocPath)) {
    try {
      const didDoc = JSON.parse(readFileSync(didDocPath, 'utf8'));
      const keyData = didDoc.verificationMethod?.find(
        vm => vm.id === keyId || `${didDoc.id}#${vm.id.split('#')[1]}` === keyId
      );
      if (keyData) {
        return await Ed25519VerificationKey2020.from(keyData);
      }
    } catch (e) {
      console.warn('Failed to load key from DID document:', e.message);
    }
  }

  throw new Error(`Unable to find public key: ${keyId}`);
}

/**
 * Verify an OpenBadges 3.0 credential
 *
 * @param {Object} credential - The credential to verify
 * @returns {Object} Verification result with verified boolean and details
 */
export async function verifyCredential(credential) {
  try {
    // Check if proof exists
    if (!credential.proof) {
      return {
        verified: false,
        results: [],
        error: 'No proof found in credential'
      };
    }

    const proof = credential.proof;

    // Get the verification method
    const keyId = proof.verificationMethod;
    if (!keyId) {
      return {
        verified: false,
        results: [],
        error: 'No verification method specified in proof'
      };
    }

    // Load the public key
    let publicKey;
    try {
      publicKey = await loadPublicKey(keyId);
    } catch (e) {
      return {
        verified: false,
        results: [],
        error: `Failed to load public key: ${e.message}`
      };
    }

    // Recreate the credential without proof for verification
    const credentialCopy = { ...credential };
    delete credentialCopy.proof;

    const canonicalString = JSON.stringify(credentialCopy, Object.keys(credentialCopy).sort());
    const data = new TextEncoder().encode(canonicalString);

    // Decode the proof value
    const signatureBytes = Buffer.from(proof.proofValue, 'base64');

    // Verify the signature
    const verifier = publicKey.verifier();
    const verified = await verifier.verify({ data, signature: signatureBytes });

    return {
      verified,
      results: [{
        proof,
        verified,
        verificationMethod: keyId
      }],
      error: verified ? null : 'Signature verification failed'
    };

  } catch (error) {
    return {
      verified: false,
      results: [],
      error: error.message
    };
  }
}

/**
 * Extract and validate credential metadata
 *
 * @param {Object} credential - The credential to analyze
 * @returns {Object} Extracted metadata
 */
export function extractCredentialInfo(credential) {
  const info = {
    id: credential.id,
    type: credential.type,
    issuer: null,
    subject: null,
    achievement: null,
    validFrom: credential.validFrom,
    validUntil: credential.validUntil
  };

  // Extract issuer info
  if (credential.issuer) {
    if (typeof credential.issuer === 'string') {
      info.issuer = { id: credential.issuer };
    } else {
      info.issuer = {
        id: credential.issuer.id,
        name: credential.issuer.name,
        type: credential.issuer.type
      };
    }
  }

  // Extract subject info
  if (credential.credentialSubject) {
    const subject = credential.credentialSubject;
    info.subject = {
      id: subject.id,
      name: subject.name,
      type: subject.type
    };

    // Extract achievement
    if (subject.achievement) {
      info.achievement = {
        id: subject.achievement.id,
        name: subject.achievement.name,
        description: subject.achievement.description,
        fieldOfStudy: subject.achievement.fieldOfStudy,
        humanCode: subject.achievement.humanCode
      };
    }

    // Extract results (grades, credits)
    if (subject.result && Array.isArray(subject.result)) {
      info.results = subject.result.map(r => ({
        name: r.resultDescription?.name,
        value: r.value
      }));
    }

    // Extract achievement date
    if (subject.achievedDate) {
      info.achievedDate = subject.achievedDate;
    }
  }

  return info;
}
