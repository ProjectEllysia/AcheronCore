/**
 * Lector JavaScript del catálogo de storables de Acheron.
 *
 * El contrato de verdad es `schema.json`: datos puros, sin código y sin texto
 * de interfaz, para que puedan leerlo también Python, Kotlin y Java. Este
 * módulo ofrece los índices que los consumidores JS piden una y otra vez, para
 * que no los rehagan cada uno por su cuenta.
 *
 * Importa el catálogo de `schema.js` y NO lee `schema.json` del disco: el
 * consumidor principal es un motor criptográfico que corre en el navegador,
 * donde no hay sistema de ficheros. `schema.js` se genera desde el JSON con
 * `npm run generate`, y `npm test` comprueba que ambos siguen diciendo lo
 * mismo.
 *
 * Deliberadamente no valida nada al importar: de la forma del documento se
 * encarga `validate.mjs` en la CI de este repositorio, y hacerlo en cada
 * arranque sólo añadiría coste a un fichero que ya se sabe correcto.
 */

import { STORABLE_SCHEMA, SCHEMA_VERSION } from './schema.js'

export { STORABLE_SCHEMA, SCHEMA_VERSION }

/** Tipo por categoría (clave plural del vault JSON). */
export const SCHEMA_BY_CATEGORY = Object.fromEntries(
  STORABLE_SCHEMA.map((type) => [type.category, type]),
)

/** Tipo por kind (singular de la API). */
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
