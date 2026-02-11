/**
 * Generate Ed25519 key pair for OpenBadges 3.0 credential signing
 * Run with: npm run generate-keys
 */

import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keysDir = join(__dirname, '..', 'keys');

async function generateKeys() {
  console.log('Generating Ed25519 key pair for OpenBadges 3.0...\n');

  // Generate a new key pair
  const keyPair = await Ed25519VerificationKey2020.generate();

  // Set the controller (issuer DID) - using did:web for simplicity
  // In production, this should be your actual domain
  const issuerDid = 'did:web:example.university.edu';
  keyPair.controller = issuerDid;
  keyPair.id = `${issuerDid}#key-1`;

  // Export the key pair (includes private key)
  const exportedKeyPair = await keyPair.export({ publicKey: true, privateKey: true });

  // Create keys directory if it doesn't exist
  if (!existsSync(keysDir)) {
    mkdirSync(keysDir, { recursive: true });
  }

  // Save the full key pair (keep this secret!)
  const keyPairPath = join(keysDir, 'issuer-key.json');
  writeFileSync(keyPairPath, JSON.stringify(exportedKeyPair, null, 2));
  console.log(`Full key pair saved to: ${keyPairPath}`);
  console.log('WARNING: Keep this file secret! Do not commit to version control.\n');

  // Save public key only (for verification / DID document)
  const publicKeyOnly = {
    id: exportedKeyPair.id,
    type: exportedKeyPair.type,
    controller: exportedKeyPair.controller,
    publicKeyMultibase: exportedKeyPair.publicKeyMultibase
  };
  const publicKeyPath = join(keysDir, 'issuer-public-key.json');
  writeFileSync(publicKeyPath, JSON.stringify(publicKeyOnly, null, 2));
  console.log(`Public key saved to: ${publicKeyPath}`);
  console.log('This can be shared publicly and included in your DID document.\n');

  // Generate a sample DID document
  const didDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1'
    ],
    id: issuerDid,
    verificationMethod: [publicKeyOnly],
    assertionMethod: [publicKeyOnly.id],
    authentication: [publicKeyOnly.id]
  };
  const didDocPath = join(keysDir, 'did-document.json');
  writeFileSync(didDocPath, JSON.stringify(didDocument, null, 2));
  console.log(`Sample DID document saved to: ${didDocPath}`);
  console.log('Host this at: https://example.university.edu/.well-known/did.json\n');

  console.log('Key generation complete!');
  console.log('\nNext steps:');
  console.log('1. Update the issuer DID in generate-keys.js to your actual domain');
  console.log('2. Host the DID document at /.well-known/did.json on your domain');
  console.log('3. Add keys/ to .gitignore to protect your private key');
}

generateKeys().catch(console.error);
