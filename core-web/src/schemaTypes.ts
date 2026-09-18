/**
 * Los tipos del catálogo, escritos a mano y a propósito.
 *
 * Viven separados de `schema.ts` porque ése lo escribe `schema/generate.mjs` y
 * se sobrescribe entero en cada regeneración: lo que se documente ahí se pierde
 * a la siguiente. Aquí no, y eso importa porque estas declaraciones son lo que
 * un consumidor lee para entender el catálogo sin ir a buscar el README de otro
 * repositorio.
 */

/** Un campo de un storable; `secret` marca los sensibles. */
export interface SchemaField {
  key: string
  /**
   * Marca el campo como sensible. Es propiedad **del dato**, no de la pantalla:
   * la interfaz lo enmascara, y la extensión de navegador la usa para saber
   * cuál es el campo de contraseña sin tener que conocer su nombre.
   */
  secret?: true
}

/** Un tipo de storable: `kind` singular para la API, `category` plural para el vault JSON. */
export interface SchemaType {
  /** El singular, lo que espera la API en `POST /acheron/storables`. */
  kind: string
  /** El plural, la clave de lista dentro del JSON de la bóveda. */
  category: string
  /**
   * Qué campo se compara con la URL de la página para decidir si una
   * credencial corresponde al sitio que el usuario está viendo.
   *
   * Sólo lo tienen los tipos asociables a una web —hoy únicamente `account`—.
   * La regla de comparación es host exacto, sin subdominios y solo sobre
   * `https`; está razonada en `schema/README.md`.
   */
  matchKey?: string
  /**
   * Qué campo es el identificador de acceso: lo que la extensión de navegador
   * escribe en la casilla de usuario al autocompletar.
   *
   * Hermano de `matchKey`, y existe por la misma razón: sin él, un cliente
   * tendría que adivinar qué campo es —por nombre o por descarte— y esa
   * conjetura se rompería en silencio al crecer el catálogo.
   *
   * Sólo aparece junto a `matchKey`: un tipo con identificador pero sin campo
   * comparable no se podría ofrecer en ninguna página, así que declararlo sería
   * prometer algo que no se puede cumplir. El validador lo exige.
   */
  identityKey?: string
  fields: SchemaField[]
}
