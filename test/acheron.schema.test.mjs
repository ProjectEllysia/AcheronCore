/**
 * La copia del catálogo que lleva este paquete no diverge de `AcheronSchema`.
 *
 * El motor necesita saber qué campos tiene cada tipo de storable, porque son
 * los que cifra uno a uno. Ese catálogo es un contrato compartido con la API,
 * la app Android y `AcheronCore`, y vive en
 * [AcheronSchema](https://github.com/ProjectEllysia/AcheronSchema).
 *
 * Aquí se lleva **una copia**, `src/schema.js`, y no una dependencia npm, por
 * una razón temporal: los repositorios de la organización son privados, así
 * que instalar desde otro repositorio exige credenciales que la CI todavía no
 * tiene. Ese paso —convertirlo en dependencia con versión fijada— es la issue
 * de publicación en GitHub Packages.
 *
 * Mientras tanto, una copia sin verificar sería un quinto sitio donde el
 * catálogo puede divergir. Este test la ata al contrato, igual que hacen los
 * otros tres clientes con la suya.
 *
 *   node test/acheron.schema.test.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { STORABLE_SCHEMA, SCHEMA_VERSION } from '../src/schema.js'
import { STORABLE_FIELDS, STORABLE_CATEGORIES, KIND_BY_CATEGORY } from '../src/storableFields.js'

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
const shared = JSON.parse(readFileSync(resolve(here, 'acheron-schema.json'), 'utf8'))

console.log('Catálogo: la copia local contra AcheronSchema\n')

check(
  'la versión del contrato coincide',
  SCHEMA_VERSION === shared.schemaVersion,
  `local=${SCHEMA_VERSION} contrato=${shared.schemaVersion}`,
)

const simplify = (types) =>
  types.map((t) => ({
    kind: t.kind,
    category: t.category,
    fields: t.fields.map((f) => (f.secret ? { key: f.key, secret: true } : { key: f.key })),
  }))

check(
  'el catálogo local coincide con el contrato',
  JSON.stringify(simplify(STORABLE_SCHEMA)) === JSON.stringify(simplify(shared.types)),
  'la copia se ha separado de AcheronSchema',
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
