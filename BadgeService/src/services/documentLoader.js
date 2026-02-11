/**
 * Document Loader for JSON-LD contexts
 * Resolves JSON-LD contexts and DID documents for credential processing
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keysDir = join(__dirname, '..', '..', 'keys');

// Cache for fetched contexts
const contextCache = new Map();

// Minimal context definitions that work with digitalbazaar/vc
const CONTEXTS = {
  // W3C Credentials v2
  'https://www.w3.org/ns/credentials/v2': {
    "@context": {
      "@version": 1.1,
      "id": "@id",
      "type": "@type",
      "VerifiableCredential": {
        "@id": "https://www.w3.org/2018/credentials#VerifiableCredential"
      },
      "credentialSubject": {
        "@id": "https://www.w3.org/2018/credentials#credentialSubject",
        "@type": "@id"
      },
      "issuer": {
        "@id": "https://www.w3.org/2018/credentials#issuer",
        "@type": "@id"
      },
      "validFrom": {
        "@id": "https://www.w3.org/2018/credentials#validFrom",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "validUntil": {
        "@id": "https://www.w3.org/2018/credentials#validUntil",
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
      },
      "name": "https://schema.org/name",
      "description": "https://schema.org/description"
    }
  },

  // OpenBadges 3.0
  'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json': {
    "@context": {
      "@version": 1.1,
      "id": "@id",
      "type": "@type",
      "OpenBadgeCredential": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#OpenBadgeCredential",
      "AchievementCredential": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#AchievementCredential",
      "Achievement": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#Achievement",
      "AchievementSubject": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#AchievementSubject",
      "Profile": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#Profile",
      "Result": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#Result",
      "ResultDescription": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#ResultDescription",
      "Criteria": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#Criteria",
      "achievement": {
        "@id": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#achievement",
        "@type": "@id"
      },
      "achievedDate": {
        "@id": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#achievedDate",
        "@type": "http://www.w3.org/2001/XMLSchema#date"
      },
      "criteria": {
        "@id": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#criteria",
        "@type": "@id"
      },
      "fieldOfStudy": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#fieldOfStudy",
      "humanCode": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#humanCode",
      "narrative": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#narrative",
      "result": {
        "@id": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#result"
      },
      "resultDescription": {
        "@id": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#resultDescription",
        "@type": "@id"
      },
      "resultType": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#resultType",
      "value": "https://purl.imsglobal.org/spec/ob/v3p0/vocab#value",
      "name": "https://schema.org/name",
      "description": "https://schema.org/description"
    }
  },

  // Ed25519 2020 suite
  'https://w3id.org/security/suites/ed25519-2020/v1': {
    "@context": {
      "@version": 1.1,
      "id": "@id",
      "type": "@type",
      "Ed25519VerificationKey2020": "https://w3id.org/security#Ed25519VerificationKey2020",
      "Ed25519Signature2020": {
        "@id": "https://w3id.org/security#Ed25519Signature2020",
        "@context": {
          "created": {
            "@id": "http://purl.org/dc/terms/created",
            "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
          },
          "proofPurpose": {
            "@id": "https://w3id.org/security#proofPurpose",
            "@type": "@vocab"
          },
          "proofValue": "https://w3id.org/security#proofValue",
          "verificationMethod": {
            "@id": "https://w3id.org/security#verificationMethod",
            "@type": "@id"
          }
        }
      },
      "controller": {
        "@id": "https://w3id.org/security#controller",
        "@type": "@id"
      },
      "publicKeyMultibase": "https://w3id.org/security#publicKeyMultibase",
      "assertionMethod": {
        "@id": "https://w3id.org/security#assertionMethod",
        "@type": "@id",
        "@container": "@set"
      },
      "authentication": {
        "@id": "https://w3id.org/security#authenticationMethod",
        "@type": "@id",
        "@container": "@set"
      },
      "proof": {
        "@id": "https://w3id.org/security#proof",
        "@type": "@id",
        "@container": "@graph"
      }
    }
  }
};

// Also map alternative URLs to same contexts
CONTEXTS['https://www.w3.org/2018/credentials/v1'] = CONTEXTS['https://www.w3.org/ns/credentials/v2'];
CONTEXTS['https://purl.imsglobal.org/spec/ob/v3p0/context.json'] = CONTEXTS['https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'];

/**
 * Load local DID document if available
 */
function loadLocalDidDocument(did) {
  const didDocPath = join(keysDir, 'did-document.json');
  if (existsSync(didDocPath)) {
    try {
      const didDoc = JSON.parse(readFileSync(didDocPath, 'utf8'));
      if (didDoc.id === did) {
        return didDoc;
      }
    } catch (e) {
      console.warn('Failed to load local DID document:', e.message);
    }
  }
  return null;
}

/**
 * Load local public key if available
 */
function loadLocalPublicKey(keyId) {
  const publicKeyPath = join(keysDir, 'issuer-public-key.json');
  if (existsSync(publicKeyPath)) {
    try {
      const publicKey = JSON.parse(readFileSync(publicKeyPath, 'utf8'));
      if (publicKey.id === keyId) {
        return publicKey;
      }
    } catch (e) {
      console.warn('Failed to load local public key:', e.message);
    }
  }
  return null;
}

/**
 * Custom document loader that resolves contexts and DIDs
 */
export async function documentLoader(url) {
  // Check static contexts first
  if (CONTEXTS[url]) {
    return {
      contextUrl: null,
      documentUrl: url,
      document: CONTEXTS[url]
    };
  }

  // Check cache
  if (contextCache.has(url)) {
    return {
      contextUrl: null,
      documentUrl: url,
      document: contextCache.get(url)
    };
  }

  // Handle DID URLs
  if (url.startsWith('did:')) {
    // Extract the DID (without fragment)
    const [did, fragment] = url.split('#');

    // Try to load local DID document
    const localDidDoc = loadLocalDidDocument(did);
    if (localDidDoc) {
      // If requesting a specific key, find it in verificationMethod
      if (fragment && localDidDoc.verificationMethod) {
        const key = localDidDoc.verificationMethod.find(
          vm => vm.id === url || vm.id === `#${fragment}` || vm.id === `${did}#${fragment}`
        );
        if (key) {
          return {
            contextUrl: null,
            documentUrl: url,
            document: key
          };
        }
      }
      return {
        contextUrl: null,
        documentUrl: url,
        document: localDidDoc
      };
    }

    // Try loading local public key directly
    const localKey = loadLocalPublicKey(url);
    if (localKey) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: localKey
      };
    }

    // For did:web, try to resolve remotely
    if (did.startsWith('did:web:')) {
      try {
        const domain = did.replace('did:web:', '').replace(/:/g, '/');
        const didDocUrl = `https://${domain}/.well-known/did.json`;

        const response = await fetch(didDocUrl);
        if (response.ok) {
          const didDoc = await response.json();
          contextCache.set(did, didDoc);

          if (fragment) {
            const key = didDoc.verificationMethod?.find(
              vm => vm.id === url || vm.id === `#${fragment}` || vm.id === `${did}#${fragment}`
            );
            if (key) {
              return {
                contextUrl: null,
                documentUrl: url,
                document: key
              };
            }
          }

          return {
            contextUrl: null,
            documentUrl: url,
            document: didDoc
          };
        }
      } catch (e) {
        console.warn(`Failed to resolve DID ${did}:`, e.message);
      }
    }

    throw new Error(`Unable to resolve DID: ${url}`);
  }

  // Try to fetch remote context
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/ld+json, application/json'
      }
    });

    if (response.ok) {
      const document = await response.json();
      contextCache.set(url, document);
      return {
        contextUrl: null,
        documentUrl: url,
        document
      };
    }
  } catch (e) {
    console.warn(`Failed to fetch context ${url}:`, e.message);
  }

  throw new Error(`Unable to load document: ${url}`);
}
