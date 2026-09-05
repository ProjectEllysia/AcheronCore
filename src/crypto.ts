/**
 * Primitivas criptográficas del cliente web de Acheron.
 *
 * Es el espejo en JavaScript de `VaultEncryptingStrategy.java` (y de las
 * estrategias Argon2/PBKDF2). No comparte código con AcheronCore: implementa
 * EXACTAMENTE el mismo formato de cable para ser interoperable.
 *
 *   - AES-GCM 256: IV de 12 bytes aleatorio, tag de 128 bits,
 *     salida = Base64(IV ‖ ciphertext+tag).
 *   - KDF declarado por el propio vault: Argon2id (via hash-wasm) o
 *     PBKDF2-HMAC-SHA256 (nativo, Web Crypto).
 *   - vaultKey: clave AES de 32 bytes envuelta cifrando su base64 con la
 *     derivedKey.
 *   - checker: AES-GCM(derivedKey) de hex(SHA-256(username)).
 *
 * Todo corre en el navegador (Web Crypto API). El servidor es zero-knowledge:
 * nunca ve el master password ni el texto plano.
 */

import { argon2id } from 'hash-wasm'

import type { AlgorithmBlock, KdfParameter } from './types.js'

const IV_LENGTH = 12 // bytes
const TAG_LENGTH = 128 // bits

const subtle = globalThis.crypto.subtle

/** Los parámetros numéricos que un bloque `algorithm` puede declarar. */
type KdfParameterName = 'kdfIterations' | 'kdfMemoryKiB' | 'kdfParallelism' | 'kdfKeyLength'

/* ── helpers de codificación ─────────────────────────────────────────── */

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/** UTF-8: string → Uint8Array */
export function utf8(str: string): Uint8Array<ArrayBuffer> {
  return textEncoder.encode(str)
}

/** UTF-8: Uint8Array → string */
export function fromUtf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes)
}

/** Uint8Array → string Base64 (estándar, mismo alfabeto que java.util.Base64). */
export function b64encode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

/** string Base64 → Uint8Array */
export function b64decode(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

/** n bytes criptográficamente aleatorios. */
export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(n))
}

/**
 * Genera un salt aleatorio en Base64. Espejo de `CryptoUtils.generateSalt`
 * (16 bytes = 128 bits por defecto).
 *
 * @param {number} length  longitud en bytes (mínimo 16 recomendado)
 * @returns {string} salt Base64
 */
export function generateSaltB64(length = 16): string {
  return b64encode(randomBytes(length))
}

/* ── derivación de clave (KDF) ───────────────────────────────────────── */

/**
 * Deriva la clave maestra (derivedKey) desde el master password y el bloque
 * `algorithm` del vault JSON. Devuelve un CryptoKey de AES-GCM utilizable
 * para envolver/desenvolver la vaultKey y el checker.
 *
 * Despacha por `algorithm.kdf` igual que `VaultFactory.buildStrategy`.
 *
 * @param {string} masterPassword
 * @param {object} algorithm  bloque `algorithm` del vault JSON
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(masterPassword: string, algorithm: AlgorithmBlock): Promise<CryptoKey> {
  const saltBytes = b64decode(algorithm.salt)
  const kdf = String(algorithm.kdf || '').toUpperCase()

  let rawKey: Uint8Array<ArrayBuffer> // 32 bytes
  if (kdf === 'PBKDF2') {
    rawKey = await deriveKeyPbkdf2(
      masterPassword, saltBytes, kdfParameter(algorithm, 'kdfIterations', 600000),
    )
  } else {
    // Argon2id v1.3 con los mismos defaults que AcheronCore.
    // hash-wasm declara su salida como Uint8Array<ArrayBufferLike>; con
    // outputType 'binary' siempre respalda en un ArrayBuffer normal, que es lo
    // que Web Crypto exige.
    rawKey = (await argon2id({
      password: utf8(masterPassword),
      salt: saltBytes,
      iterations: kdfParameter(algorithm, 'kdfIterations', 3),
      memorySize: kdfParameter(algorithm, 'kdfMemoryKiB', 65536), // KiB
      parallelism: kdfParameter(algorithm, 'kdfParallelism', 1),
      hashLength: 32,
      outputType: 'binary',
    })) as Uint8Array<ArrayBuffer>
  }

  return subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/**
 * Lee un parámetro del KDF del bloque `algorithm`, exigiendo que sea un entero
 * positivo si viene, y usando el default documentado solo si NO viene.
 *
 * La distinción es la que importa. Un vault antiguo puede no traer el campo, y
 * ahí el default es correcto. Pero un campo presente y corrupto significa que
 * no sabemos con qué parámetros se cifró ese vault, y caer al default en ese
 * caso deriva una clave DISTINTA de la real: el vault no abre y al usuario se
 * le dice que su contraseña maestra es incorrecta, que es mentira y le lleva a
 * intentar recuperarla en vez de a mirar sus datos.
 *
 * Fallar aquí, ruidosamente, convierte ese callejón sin salida en un error que
 * apunta al sitio.
 *
 * Nótese que la API exporta estos parámetros como STRING, no como número; el
 * motor Java los emite como número. Ambas formas se aceptan a propósito.
 *
 * @throws {Error} si el campo viene y no es un entero positivo
 */
function kdfParameter(algorithm: AlgorithmBlock, key: KdfParameterName, fallback: number): number {
  const raw = algorithm?.[key]
  if (raw === undefined || raw === null || raw === '') return fallback

  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `El vault declara ${key} = ${JSON.stringify(raw)}, que no es un entero positivo. ` +
        'El bloque `algorithm` está corrupto: derivar con el valor por defecto daría ' +
        'una clave distinta y el vault parecería tener otra contraseña.',
    )
  }
  return value
}

async function deriveKeyPbkdf2(
  masterPassword: string,
  saltBytes: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const baseKey = await subtle.importKey('raw', utf8(masterPassword), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    baseKey,
    256, // bits → AES-256
  )
  return new Uint8Array(bits)
}

/* ── AES-GCM (cifrado de datos) ──────────────────────────────────────── */

/**
 * Cifra texto plano con AES-GCM y la clave dada.
 * Salida = Base64(IV(12) ‖ ciphertext+tag). Espejo de `encryptWithKey`.
 *
 * @param {CryptoKey} key
 * @param {string} plainText
 * @returns {Promise<string>}
 */
export async function aesGcmEncrypt(key: CryptoKey, plainText: string): Promise<string> {
  const iv = randomBytes(IV_LENGTH)
  const ct = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: TAG_LENGTH }, key, utf8(plainText)),
  )
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv, 0)
  out.set(ct, iv.length)
  return b64encode(out)
}

/**
 * Descifra Base64(IV ‖ ciphertext+tag) con AES-GCM. Espejo de `decryptWithKey`.
 *
 * @param {CryptoKey} key
 * @param {string} ivAndCiphertextB64
 * @returns {Promise<string>}
 * @throws si el tag no valida (clave/IV incorrectos)
 */
export async function aesGcmDecrypt(key: CryptoKey, ivAndCiphertextB64: string): Promise<string> {
  const buf = b64decode(ivAndCiphertextB64)
  const iv = buf.slice(0, IV_LENGTH)
  const ct = buf.slice(IV_LENGTH)
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv, tagLength: TAG_LENGTH }, key, ct)
  return fromUtf8(new Uint8Array(plain))
}

/* ── vaultKey (envoltura de la clave del vault) ──────────────────────── */

/**
 * Desenvuelve la vaultKey: descifra el blob con la derivedKey (lo que se
 * obtiene es el base64 de la clave AES cruda), lo decodifica e importa como
 * CryptoKey de AES-GCM. Espejo de `importVaultKey`.
 *
 * @param {CryptoKey} derivedKey
 * @param {string} vaultKeyB64  campo `vaultKey` del vault JSON
 * @returns {Promise<CryptoKey>}
 */
export async function importVaultKey(derivedKey: CryptoKey, vaultKeyB64: string): Promise<CryptoKey> {
  const rawKeyB64 = await aesGcmDecrypt(derivedKey, vaultKeyB64)
  const rawKey = b64decode(rawKeyB64)
  return subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/* ── checker (validación del master password) ────────────────────────── */

/** hex(SHA-256(str)). Espejo del hash que produce AcheronCore para el checker. */
export async function sha256Hex(str: string): Promise<string> {
  const digest = new Uint8Array(await subtle.digest('SHA-256', utf8(str)))
  let hex = ''
  for (const byte of digest) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Valida el master password: descifra el `checker` con la derivedKey y lo
 * compara con hex(SHA-256(username)). Espejo de `VaultFactory.checkMasterPassword`.
 *
 * @param {CryptoKey} derivedKey
 * @param {string} checker  campo `checker` del vault JSON
 * @param {string} username validator (username del usuario logueado)
 * @returns {Promise<boolean>}
 */
export async function validateChecker(
  derivedKey: CryptoKey,
  checker: string,
  username: string,
): Promise<boolean> {
  let decrypted
  try {
    decrypted = await aesGcmDecrypt(derivedKey, checker)
  } catch {
    // Tag inválido = master password incorrecto, no un error genérico.
    return false
  }
  return decrypted === (await sha256Hex(username))
}
