/**
 * Genera `core-web/src/schema.js` a partir de `schema.json`.
 *
 * El JSON es el contrato y la fuente de verdad: es lo que leen Python, Kotlin
 * y Java. Pero un fichero JSON sólo se puede leer del disco, y el consumidor
 * principal —el motor criptográfico de `core-web/`, que usará también la
 * extensión de navegador— corre donde no hay disco.
 *
 * De ahí el espejo en JavaScript. Se genera en vez de mantenerse a mano porque
 * dos copias escritas a mano divergen, y ésta divergiría en silencio: un
 * módulo y un JSON no se comparan solos.
 *
 *   node generate.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const document = JSON.parse(readFileSync(resolve(here, 'schema.json'), 'utf8'))

const lines = [
  '/**',
  ' * El catálogo como MÓDULO JavaScript, generado desde `schema.json`.',
  ' *',
  ' * `schema.json` es el contrato y la fuente de verdad, pero un fichero JSON',
  ' * sólo se puede leer del disco, y el consumidor principal de este paquete es',
  ' * un motor criptográfico que corre en el NAVEGADOR, donde no hay disco. De ahí',
  ' * este espejo: un módulo que cualquier navegador, empaquetador o runtime puede',
  ' * importar sin tocar el sistema de ficheros.',
  ' *',
  ' * NO SE EDITA A MANO. Se regenera con `npm run generate`, y `npm test`',
  ' * comprueba que no se ha separado del JSON.',
  ' */',
  `export const SCHEMA_VERSION = ${document.schemaVersion}`,
  '',
  'export const STORABLE_SCHEMA = [',
]

for (const type of document.types) {
  lines.push('  {')
  lines.push(`    kind: ${JSON.stringify(type.kind)}, category: ${JSON.stringify(type.category)},`)
  if (type.matchKey) lines.push(`    matchKey: ${JSON.stringify(type.matchKey)},`)
  lines.push('    fields: [')
  for (const field of type.fields) {
    lines.push(`      { key: ${JSON.stringify(field.key)}${field.secret ? ', secret: true' : ''} },`)
  }
  lines.push('    ],')
  lines.push('  },')
}

lines.push(']', '')

writeFileSync(resolve(here, '../core-web/src/schema.js'), lines.join('\n'), 'utf8')
console.log(`core-web/src/schema.js generado: ${document.types.length} tipos`)
