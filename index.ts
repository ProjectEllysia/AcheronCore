/**
 * Superficie pública de AcheronCoreWeb.
 *
 * El motor criptográfico de la bóveda de Acheron para JavaScript. Es el espejo
 * de `AcheronCore` (Java, para Android): no comparte código con él, implementa
 * por su cuenta el mismo formato de cable, y los vectores de interoperabilidad
 * de `test/` comprueban en ambos sentidos que siguen coincidiendo.
 *
 * Lo consumen el cliente web de Ellysia y la extensión de navegador. Toda la
 * criptografía corre en el cliente: el servidor es *zero-knowledge* y nunca ve
 * la contraseña maestra ni el texto en claro.
 *
 * El punto de entrada de la concurrencia optimista con la API vive aparte, en
 * `acheron-core-web/sync`: eso es el protocolo REST de Ellysia y no el formato
 * criptográfico, y son dos cosas que cambian a ritmos muy distintos.
 */

export {
  utf8,
  fromUtf8,
  b64encode,
  b64decode,
  randomBytes,
  generateSaltB64,
  deriveKey,
  aesGcmEncrypt,
  aesGcmDecrypt,
  importVaultKey,
  sha256Hex,
  validateChecker,
} from './src/crypto.js'

export { openVault, createVault, OpenVault, WrongPasswordError } from './src/vault.js'

export {
  STORABLE_FIELDS,
  STORABLE_CATEGORIES,
  KIND_BY_CATEGORY,
  CATEGORY_BY_KIND,
} from './src/storableFields.js'

export { STORABLE_SCHEMA, SCHEMA_VERSION } from './src/schema.js'

export * from './src/passwordGenerator.js'
export * from './src/passwordStrength.js'
