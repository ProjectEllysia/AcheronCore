/**
 * Lector JavaScript del catálogo de storables de Acheron.
 *
 * El contrato de verdad es `schema.json`: datos puros, sin código y sin texto
 * de interfaz, para que puedan leerlo también Python, Kotlin y Java. Este
 * módulo solo lo carga y ofrece los índices que los consumidores JS piden una
 * y otra vez, para que no los rehagan cada uno por su cuenta.
 *
 * Deliberadamente no valida nada al importar: de la forma del documento se
 * encarga `validate.mjs` en la CI de este repositorio, y hacerlo en cada
 * arranque solo añadiría coste a un fichero que ya se sabe correcto.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/** El documento completo, tal cual está en disco. */
export const SCHEMA_DOCUMENT = JSON.parse(
  readFileSync(resolve(here, 'schema.json'), 'utf8'),
)

/** Versión del formato del propio documento (no del catálogo que describe). */
export const SCHEMA_VERSION = SCHEMA_DOCUMENT.schemaVersion

/**
 * Los tipos de storable, en orden. Cada uno con `kind` (singular, el que usa
 * la API), `category` (plural, la clave de lista del JSON del vault) y sus
 * `fields`, donde `secret` marca los sensibles.
 */
export const STORABLE_SCHEMA = SCHEMA_DOCUMENT.types

/** Tipo por categoría. */
export const SCHEMA_BY_CATEGORY = Object.fromEntries(
  STORABLE_SCHEMA.map((type) => [type.category, type]),
)

/** Tipo por kind. */
export const SCHEMA_BY_KIND = Object.fromEntries(
  STORABLE_SCHEMA.map((type) => [type.kind, type]),
)

/** category → claves de sus campos, en orden. Es lo que la capa cripto cifra. */
export const FIELDS_BY_CATEGORY = Object.fromEntries(
  STORABLE_SCHEMA.map((type) => [type.category, type.fields.map((f) => f.key)]),
)

/** Las categorías presentes en un vault JSON, en orden. */
export const CATEGORIES = STORABLE_SCHEMA.map((type) => type.category)

/** category (plural) → kind (singular). */
export const KIND_BY_CATEGORY = Object.fromEntries(
  STORABLE_SCHEMA.map((type) => [type.category, type.kind]),
)

/** kind → category. */
export const CATEGORY_BY_KIND = Object.fromEntries(
  STORABLE_SCHEMA.map((type) => [type.kind, type.category]),
)

/** category → claves de los campos marcados como sensibles. */
export const SECRET_FIELDS_BY_CATEGORY = Object.fromEntries(
  STORABLE_SCHEMA.map((type) => [
    type.category,
    type.fields.filter((f) => f.secret).map((f) => f.key),
  ]),
)
