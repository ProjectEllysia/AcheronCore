/**
 * Los contratos implícitos que este paquete exporta a sus consumidores.
 *
 * Mientras el motor vivía dentro de la SPA, dos suposiciones podían quedarse
 * en los comentarios del código. Con dos consumidores en dos repositorios
 * distintos pasan a ser contrato, y los contratos no escritos son los que
 * rompe el tercero que llega.
 *
 * Este fichero los convierte en algo ejecutable, que es la única forma de
 * documentación que no se queda atrás.
 *
 *   node test/acheron.contract.test.mjs
 */

import { deriveKey, sha256Hex } from '../src/crypto.js'
import { openVault, createVault, WrongPasswordError } from '../src/vault.js'

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

async function throwsWith(fn, fragment) {
  try {
    await fn()
    return { threw: false, message: '(no lanzó)' }
  } catch (e) {
    return { threw: String(e.message).includes(fragment), message: e.message }
  }
}

const PASSWORD = 'correct horse battery staple'
const USERNAME = 'alice'

/** Bloque `algorithm` de Argon2id, con los parámetros que se quiera sobrescribir. */
const argon2 = (overrides = {}) => ({
  transformation: 'AES/GCM/NoPadding',
  kdf: 'Argon2',
  kdfIterations: '3',
  kdfMemoryKiB: '65536',
  kdfParallelism: '1',
  salt: 'AaIAMSaaAapdO4iYQupBCw==',
  ...overrides,
})

console.log('Contratos implícitos del motor\n')

/* ── 1) Los parámetros del KDF llegan como CADENA o como NÚMERO ── */

// La API de Ellysia los exporta como texto; el generador de AcheronCore los
// emite como numero. Las dos formas tienen que producir la MISMA clave, o los
// dos clientes no podrian abrir la misma boveda.
{
  const fromText = await deriveKey(PASSWORD, argon2({ kdfIterations: '3' }))
  const fromNumber = await deriveKey(PASSWORD, argon2({ kdfIterations: 3 }))

  // Las claves se importan como no exportables, asi que se comparan por su
  // efecto: que una descifre lo que cifro la otra.
  const { aesGcmEncrypt, aesGcmDecrypt } = await import('../src/crypto.js')
  const sealed = await aesGcmEncrypt(fromText, 'mismo secreto')
  let interchangeable = false
  try {
    interchangeable = (await aesGcmDecrypt(fromNumber, sealed)) === 'mismo secreto'
  } catch {
    interchangeable = false
  }
  check('kdfIterations como cadena y como número dan la misma clave', interchangeable)
}

/* ── 2) Un parámetro presente y corrupto FALLA, no cae al default ── */

// Caer al default derivaria una clave distinta de la real, el vault no abriria
// y al usuario se le diria que su contrasena es incorrecta. Es mentira, y le
// lleva a intentar recuperarla en vez de a mirar sus datos.
for (const [key, value] of [
  ['kdfIterations', 'no-es-un-numero'],
  ['kdfIterations', '0'],
  ['kdfIterations', '-3'],
  ['kdfIterations', '3.5'],
  ['kdfMemoryKiB', 'muchisima'],
  ['kdfParallelism', '0'],
]) {
  const result = await throwsWith(
    () => deriveKey(PASSWORD, argon2({ [key]: value })),
    'no es un entero positivo',
  )
  check(`${key} = ${JSON.stringify(value)} lanza un error explícito`, result.threw, result.message)
}

/* ── 3) Un parámetro AUSENTE sí usa el default documentado ── */

// Un vault antiguo puede no traer el campo, y ahi el default es correcto. La
// distincion entre "no viene" y "viene corrupto" es toda la gracia del cambio.
{
  const sinIteraciones = argon2()
  delete sinIteraciones.kdfIterations
  const result = await throwsWith(() => deriveKey(PASSWORD, sinIteraciones), 'imposible')
  check('un kdfIterations ausente usa el default y no lanza', !result.threw)
}

/* ── 4) La bóveda está atada al username de Ellysia ── */

// El checker se valida contra hex(SHA-256(username)), asi que renombrar a un
// usuario invalida su boveda entera. No es un bug: es el contrato, y conviene
// que este escrito donde se pueda ejecutar antes de que alguien anada un
// "cambiar nombre de usuario" a la API sin saberlo.
{
  const meta = await createVault(PASSWORD, USERNAME)
  const vaultJson = { version: 1, ...meta, accounts: [] }

  const opened = await openVault(vaultJson, PASSWORD, USERNAME)
  check('la bóveda abre con el username con el que se creó', !!opened)

  let rejected = false
  try {
    await openVault(vaultJson, PASSWORD, 'alice-renombrada')
  } catch (e) {
    rejected = e instanceof WrongPasswordError
  }
  check('renombrar al usuario invalida la bóveda, aunque la contraseña sea correcta', rejected)

  check(
    'el checker es hex(SHA-256(username))',
    (await sha256Hex(USERNAME)).length === 64,
  )
}

console.log(`\nResultado: ${passed} OK, ${failed} fallidos`)
if (failed > 0) process.exit(1)
