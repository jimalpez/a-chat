"use client";

const DB_NAME = "chat-e2ee";
const STORE_NAME = "keys";

// ─── Key Generation ─────────────────────────────────────────

export async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"],
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    "spki",
    bytes.buffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
}

// ─── Key Derivation ─────────────────────────────────────────

export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ─── Encrypt / Decrypt ──────────────────────────────────────

export async function encryptMessage(
  plaintext: string,
  sharedSecret: CryptoKey,
): Promise<{ ciphertext: string; nonce: string }> {
  const encoder = new TextEncoder();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    sharedSecret,
    encoder.encode(plaintext),
  );
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    nonce: btoa(String.fromCharCode(...nonce)),
  };
}

export async function decryptMessage(
  ciphertext: string,
  nonce: string,
  sharedSecret: CryptoKey,
): Promise<string> {
  const decoder = new TextDecoder();
  const cipherBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const nonceBytes = Uint8Array.from(atob(nonce), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonceBytes },
    sharedSecret,
    cipherBytes,
  );
  return decoder.decode(decrypted);
}

// ─── IndexedDB Key Store ────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error("Failed to open IndexedDB"));
  });
}

export async function storePrivateKey(userId: string, privateKey: CryptoKey) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(privateKey, `private-${userId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error("Failed to store private key"));
  });
}

export async function getPrivateKey(userId: string): Promise<CryptoKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(`private-${userId}`);
    req.onsuccess = () => resolve((req.result as CryptoKey | undefined) ?? null);
    req.onerror = () => reject(new Error("Failed to get private key"));
  });
}

// Cache derived shared secrets
const secretCache = new Map<string, CryptoKey>();

export async function getOrDeriveSecret(
  myUserId: string,
  theirPublicKeyBase64: string,
): Promise<CryptoKey | null> {
  const cacheKey = `${myUserId}:${theirPublicKeyBase64.slice(0, 20)}`;
  if (secretCache.has(cacheKey)) return secretCache.get(cacheKey)!;

  const privateKey = await getPrivateKey(myUserId);
  if (!privateKey) return null;

  const publicKey = await importPublicKey(theirPublicKeyBase64);
  const secret = await deriveSharedSecret(privateKey, publicKey);
  secretCache.set(cacheKey, secret);
  return secret;
}
