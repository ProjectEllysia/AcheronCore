/**
 * Validador de `schema.json`.
 *
 * Este fichero es un contrato que leen cuatro implementaciones en cuatro
 * lenguajes. Un error de forma aquí —una categoría duplicada, un campo sin
 * clave, un `secret` que no es booleano— no se manifiesta como un fallo
 * limpio en el consumidor: se manifiesta como un cliente que no encuentra un
 * campo, o que deja de cifrar uno que debía cifrar.
 *
 * Por eso se valida aquí, en el origen, y no en cada consumidor.
 *
 *   node validate.mjs
 */

import { SCHEMA_DOCUMENT, STORABLE_SCHEMA, SCHEMA_VERSION } from './index.js'

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

/** Elementos que aparecen más de una vez en una lista. */
function duplicates(values) {
  const seen = new Set()
  const repeated = new Set()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated].sort()
}

console.log('Validación de schema.json\n')

/* ── Documento ── */

check('schemaVersion es un entero positivo',
  Number.isInteger(SCHEMA_VERSION) && SCHEMA_VERSION > 0, `= ${SCHEMA_VERSION}`)
check('types es una lista no vacía',
  Array.isArray(STORABLE_SCHEMA) && STORABLE_SCHEMA.length > 0)
check('el documento no tiene claves de más',
  Object.keys(SCHEMA_DOCUMENT).every((k) => ['schemaVersion', 'types'].includes(k)),
  `claves: ${Object.keys(SCHEMA_DOCUMENT).join(', ')}`)

/* ── Unicidad ── */

// kind y category identifican un tipo en la API y en el JSON del vault
// respectivamente. Un duplicado hace que un consumidor que indexe por ellos
// pierda un tipo entero en silencio.
const kinds = STORABLE_SCHEMA.map((t) => t.kind)
const categories = STORABLE_SCHEMA.map((t) => t.category)

check('los kind no se repiten', duplicates(kinds).length === 0,
  `repetidos: ${duplicates(kinds).join(', ')}`)
check('las category no se repiten', duplicates(categories).length === 0,
  `repetidos: ${duplicates(categories).join(', ')}`)

/* ── Cada tipo ── */

const IDENTIFIER = /^[a-zA-Z][a-zA-Z0-9]*$/

for (const type of STORABLE_SCHEMA) {
  const name = type.kind ?? '(sin kind)'

  check(`${name}: kind es un identificador`,
    typeof type.kind === 'string' && IDENTIFIER.test(type.kind), `= ${type.kind}`)
  check(`${name}: category es un identificador`,
    typeof type.category === 'string' && IDENTIFIER.test(type.category), `= ${type.category}`)
  check(`${name}: no tiene claves de más`,
    Object.keys(type).every((k) => ['kind', 'category', 'fields'].includes(k)),
    `claves: ${Object.keys(type).join(', ')}`)
  check(`${name}: tiene al menos un campo`,
    Array.isArray(type.fields) && type.fields.length > 0)

  const fieldKeys = (type.fields ?? []).map((f) => f.key)
  check(`${name}: las claves de campo no se repiten`,
    duplicates(fieldKeys).length === 0, `repetidas: ${duplicates(fieldKeys).join(', ')}`)

  for (const field of type.fields ?? []) {
    const label = `${name}.${field.key ?? '(sin key)'}`
    // Las claves viajan literalmente al JSON del vault y a la API, asi que no
    // admiten guiones ni espacios: deben ser identificadores camelCase.
    check(`${label}: key es un identificador`,
      typeof field.key === 'string' && IDENTIFIER.test(field.key))
    check(`${label}: secret, si está, es true`,
      !('secret' in field) || field.secret === true, `secret = ${field.secret}`)
    check(`${label}: no tiene claves de más`,
      Object.keys(field).every((k) => ['key', 'secret'].includes(k)),
      `claves: ${Object.keys(field).join(', ')}`)
  }
}

/* ── Nada de texto visible ── */

// La invariante que hace publicable este fichero. Si alguien mete aquí una
// etiqueta, el contrato deja de ser neutro de lenguaje y los consumidores que
// no son JS heredan castellano que no pueden usar.
const TEXTO_VISIBLE = ['label', 'plural', 'newLabel', 'subtitleKey', 'description', 'placeholder']
for (const type of STORABLE_SCHEMA) {
  const enTipo = TEXTO_VISIBLE.filter((k) => k in type)
  check(`${type.kind}: sin texto de interfaz`, enTipo.length === 0,
    `encontrado: ${enTipo.join(', ')}`)
  for (const field of type.fields ?? []) {
    const enCampo = TEXTO_VISIBLE.filter((k) => k in field)
    check(`${type.kind}.${field.key}: sin texto de interfaz`, enCampo.length === 0,
      `encontrado: ${enCampo.join(', ')}`)
  }
}

console.log(`\nResultado: ${passed} OK, ${failed} fallidos`)
if (failed > 0) process.exit(1)
