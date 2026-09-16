/**
 * La forma de los datos que cruzan la frontera de este paquete.
 *
 * Es lo que más gana con TypeScript. Mientras el motor vivía dentro de la SPA,
 * la forma del JSON de la bóveda se conocía leyendo el código que lo produce;
 * con dos consumidores en dos repositorios distintos, esa forma es contrato y
 * conviene que esté declarada.
 *
 * El caso que lo justifica solo: los parámetros del KDF llegan como CADENA
 * desde la API de Ellysia y como NÚMERO desde el generador de vectores de
 * AcheronCore. Las dos formas son válidas y producen la misma clave. Eso vivía
 * en un comentario y ahora vive en el tipo.
 */

/** Un parámetro numérico del KDF, tal y como puede venir en el JSON. */
export type KdfParameter = string | number

/** Los KDF que el formato admite. */
export type KdfName = 'Argon2' | 'PBKDF2'

/**
 * El bloque `algorithm` de una bóveda: cómo se derivó su clave maestra.
 *
 * La bóveda declara sus propios parámetros, así que un cliente antiguo abriendo
 * una bóveda nueva falla de forma limpia en vez de descifrar basura.
 */
export interface AlgorithmBlock {
  /** Siempre `AES/GCM/NoPadding` en el formato actual. */
  transformation?: string
  /** Se compara sin distinguir mayúsculas; ausente equivale a Argon2id. */
  kdf?: KdfName | string
  /** Base64 estándar, mismo alfabeto que `java.util.Base64`. */
  salt: string
  kdfIterations?: KdfParameter
  /** Solo Argon2id. */
  kdfMemoryKiB?: KdfParameter
  /** Solo Argon2id. */
  kdfParallelism?: KdfParameter
  /** Solo PBKDF2. */
  kdfKeyLength?: KdfParameter
}

/**
 * Un storable tal y como viaja dentro del JSON de la bóveda.
 *
 * Los metadatos van en claro; el título y los campos propios del tipo van
 * cifrados, cada uno como `Base64(IV ‖ ciphertext+tag)`. Por eso el índice es
 * `string`: qué claves concretas trae depende del tipo, y eso lo dice el
 * catálogo de storables, no este tipo.
 */
export interface EncryptedStorable {
  id: string
  /** Cifrado, como el resto de campos propios del tipo. */
  title: string
  createdAt?: string
  updatedAt?: string
  allowedUsers?: string[]
  [field: string]: unknown
}

/** Un storable ya descifrado: los mismos campos, en claro. */
export interface PlainStorable {
  title: string
  createdAt?: string
  updatedAt?: string
  [field: string]: unknown
}

/**
 * El cuerpo de `GET /acheron/vault`.
 *
 * Las listas de storables cuelgan de la clave PLURAL de cada tipo
 * (`accounts`, `creditcards`…), que es lo que el catálogo llama `category`.
 */
export interface VaultJson {
  version?: number
  /** `AES-GCM(derivedKey)` de `hex(SHA-256(username))`. */
  checker: string
  /** La clave AES de la bóveda, envuelta con la clave derivada. */
  vaultKey: string
  algorithm: AlgorithmBlock
  [category: string]: unknown
}

/** Lo que devuelve crear una bóveda o rotar su contraseña. */
export interface VaultSecrets {
  checker: string
  vaultKey: string
  algorithm: AlgorithmBlock
}

/** Un storable listo para `POST /acheron/storables`. */
export interface StorablePayload {
  kind: string
  internalId: string
  title: string
  createdAt: string
  updatedAt: string
  [field: string]: unknown
}

/* ── Concurrencia optimista con la API ── */

/** El `apiFetch` que el consumidor inyecta; este paquete no elige cliente HTTP. */
export type ApiFetch = (path: string, options?: RequestInit) => Promise<Response | null>

/**
 * Estado de revisión que `vaultWrite` lee y actualiza in situ.
 *
 * `refresh` recarga la bóveda y debe dejar `revision` al día; devuelve `false`
 * si no pudo, y entonces la escritura se abandona en vez de reintentarse a
 * ciegas.
 */
export interface RevisionContext {
  revision: number | null
  refresh: () => Promise<boolean>
}

/** Resultado de una escritura del vault. */
export interface VaultWriteResult {
  res: Response | null
  /** Hubo conflicto y el estado local ya se releyó: no lo parchees a mano. */
  refreshed: boolean
}

/* ── Medidor de robustez de contraseñas ── */

/** Veredicto del medidor, listo para pintar una barra. */
export interface PasswordStrength {
  /** De 0 (muy débil) a 4 (muy fuerte). */
  score: number
  /** El mismo score en porcentaje, para el ancho de la barra. */
  percent: number
  label: string
  color: string
}
