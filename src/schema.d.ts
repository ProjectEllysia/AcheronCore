/**
 * Declaración de `schema.js`, que se queda en JavaScript a propósito: es una
 * copia literal de un fichero generado en `AcheronSchema`, y convertirlo a
 * TypeScript rompería esa propiedad — dejaría de poder recopiarse sin más.
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
  fields: SchemaField[]
}

export declare const SCHEMA_VERSION: number
export declare const STORABLE_SCHEMA: SchemaType[]
