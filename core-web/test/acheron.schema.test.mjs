/**
 * El catálogo que publica este paquete sigue a `schema/schema.json`.
 *
 * El motor necesita saber qué campos tiene cada tipo de storable, porque son
 * los que cifra uno a uno. Ese catálogo es un contrato compartido con el motor
 * Java, la API y la app Android, y su fuente de verdad es `schema/schema.json`,
 * en la raíz de este repositorio.
 *
 * `src/schema.js` no es una copia sino el espejo que genera
 * `schema/generate.mjs`: el paquete corre en el navegador, donde no hay disco
 * del que leer el JSON. Este test comprueba que ese espejo y los índices que
 * el motor deriva de él dicen lo mismo que el contrato.
 *
 *   node test/acheron.schema.test.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { STORABLE_SCHEMA, SCHEMA_VERSION } from '../dist/src/schema.js'
import { STORABLE_FIELDS, STORABLE_CATEGORIES, KIND_BY_CATEGORY } from '../dist/src/storableFields.js'

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const shared = JSON.parse(readFileSync(resolve(here, '../../schema/schema.json'), 'utf8'))

console.log('Catálogo: el motor contra schema/schema.json\n')

check(
  'la versión del contrato coincide',
  SCHEMA_VERSION === shared.schemaVersion,
  `local=${SCHEMA_VERSION} contrato=${shared.schemaVersion}`,
)

// Las marcas van EN la comparación, y no es un detalle: `matchKey` e
// `identityKey` son lo único que la extensión de navegador tiene para saber
// qué credencial corresponde a una página y qué campo escribir como usuario.
// Si se perdieran entre el JSON y el módulo generado, la extensión dejaría de
// ofrecer credenciales —o rellenaría el campo equivocado— sin que fallara nada
// aquí, que es exactamente el modo de fallo que este fichero existe para
// impedir.
const simplify = (types) =>
  types.map((t) => ({
    kind: t.kind,
    category: t.category,
    matchKey: t.matchKey ?? null,
    identityKey: t.identityKey ?? null,
    fields: t.fields.map((f) => (f.secret ? { key: f.key, secret: true } : { key: f.key })),
  }))

check(
  'el catálogo local coincide con el contrato',
  JSON.stringify(simplify(STORABLE_SCHEMA)) === JSON.stringify(simplify(shared.types)),
  'ejecuta `npm run generate` en schema/',
)

/* ── Los índices que consume el motor se derivan del catálogo ── */

// vault.js cifra campo a campo recorriendo STORABLE_FIELDS. Si esa derivación
// perdiera un campo, ese campo viajaría EN CLARO al servidor sin que nada
// fallara: es el peor modo de fallo posible de este paquete.
for (const type of shared.types) {
  check(
    `${type.category}: el motor cifra exactamente los campos del contrato`,
    JSON.stringify(STORABLE_FIELDS[type.category]) ===
      JSON.stringify(type.fields.map((f) => f.key)),
    `motor=${JSON.stringify(STORABLE_FIELDS[type.category])}`,
  )
  check(
    `${type.category}: mapea a su kind`,
    KIND_BY_CATEGORY[type.category] === type.kind,
    `= ${KIND_BY_CATEGORY[type.category]}`,
  )
}

check(
  'las categorías del motor son las del contrato, en orden',
  JSON.stringify(STORABLE_CATEGORIES) === JSON.stringify(shared.types.map((t) => t.category)),
)

console.log(`\nResultado: ${passed} OK, ${failed} fallidos`)
if (failed > 0) process.exit(1)
