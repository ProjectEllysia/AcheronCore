/**
 * Declaración de `schema.js`, que se queda en JavaScript a propósito: lo
 * escribe `schema/generate.mjs` a partir de `schema/schema.json`, y así el
 * generador no necesita saber nada de tipos.
 */

/** Un campo de un storable; `secret` marca los sensibles. */
export interface SchemaField {
  key: string
  secret?: true
}

/** Un tipo de storable: `kind` singular para la API, `category` plural para el vault JSON. */
export interface SchemaType {
  kind: string
  category: string
  /**
   * Qué campo se compara con la URL de la página para decidir si una
   * credencial corresponde al sitio que el usuario está viendo.
   *
   * Solo lo tienen los tipos asociables a una web —hoy únicamente `account`—.
   * La regla de comparación es host exacto, sin subdominios y solo sobre
   * `https`; está razonada en `schema/README.md`.
   */
  matchKey?: string
  fields: SchemaField[]
}

export declare const SCHEMA_VERSION: number
export declare const STORABLE_SCHEMA: SchemaType[]
