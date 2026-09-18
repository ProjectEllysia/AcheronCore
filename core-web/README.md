# Acheron Core — motor web

El motor criptográfico de la bóveda de Acheron, en **TypeScript**.

Acheron es la bóveda de credenciales de Ellysia. Todo el cifrado ocurre en el cliente: el servidor
es *zero-knowledge*, guarda un blob que no sabe leer y nunca ve la contraseña maestra ni el texto en
claro. Este paquete es la mitad del cliente que hace ese trabajo, y lo consumen el cliente web y la
extensión de navegador.

## Su relación con el motor Java

[`core-jvm/`](../core-jvm/README.md) hace lo mismo en Java, para la app Android. **No comparten una línea de código**: cada uno implementa por su cuenta el mismo *formato
de cable* —cuántas pasadas de Argon2id, en qué orden van los bytes, dónde acaba el vector de
inicialización y empieza el texto cifrado—.

Eso importa porque los dos escriben en la misma bóveda del mismo usuario. Si guardas una credencial
desde el móvil y luego abres la web, la web tiene que descifrar exactamente lo que escribió el
móvil, y viceversa.

Como no se puede comparar código Java contra código JavaScript, se comparan **resultados sobre
entradas conocidas**: los vectores de interoperabilidad, en los dos sentidos. Están descritos en
[`vectors/README.md`](../vectors/README.md), y son lo único que garantiza que las dos implementaciones no se
han separado.

## Qué hay dentro

| Fichero | Qué hace |
|---|---|
| `src/types.ts` | la forma de lo que cruza la frontera del paquete |
| `src/crypto.ts` | primitivas: Argon2id/PBKDF2, AES-GCM, Base64, el *checker* |
| `src/vault.ts` | abrir una bóveda, descifrar y recifrar storables, rotar la contraseña |
| `src/storableFields.ts` | qué campos cifra cada tipo, derivado del catálogo |
| `src/schema.ts` | el catálogo de storables, generado desde `schema/` (ver abajo) |
| `src/passwordGenerator.ts` | generador de contraseñas |
| `src/passwordStrength.ts` | medidor de robustez |
| `src/sync.ts` | concurrencia optimista con la API — **entrada aparte** |

`src/schema.ts` lo escribe un generador, así que no se edita a mano; lo único que ese generador
sabe de tipos es la anotación `SchemaType[]`, y las interfaces con su documentación viven aparte, en
`src/schemaTypes.ts`. Estuvo en JavaScript hasta la 2.3.0, y se cambió porque con un `.js` era `tsc`
quien deducía la declaración del contenido del catálogo y la emitía encima de la escrita a mano: el
consumidor recibía un tipo inferido del catálogo de ese día en lugar del contrato documentado.

## El nombre del paquete cambió en la 2.4.0

Este motor se publicó como **`@projectellysia/acheron-core-web`** hasta la 2.3.0 incluida. Desde la
2.4.0 se publica como **`@projectellysia/acheron-core-js`**, y el paquete viejo queda congelado
donde está: no se borra, no recibe versiones nuevas.

El motivo no es estético. Un paquete npm de GitHub Packages queda **vinculado al repositorio desde
el que se publicó por primera vez**, y ese vínculo no se mueve después. `acheron-core-web` nació en
el repositorio del mismo nombre, que se archivó al unificar todo aquí, así que aunque sus últimas
versiones salieran ya de `AcheronCore`, seguía colgando de un repositorio archivado y heredando sus
permisos. La consecuencia práctica: la CI de un consumidor recibía un `403 permission_denied` al
instalarlo, y arreglarlo dependía de un ajuste manual en la interfaz de GitHub que además el
archivado bloqueaba.

Un paquete con nombre nuevo, publicado desde aquí, nace vinculado a un repositorio **público y
vivo**, y hereda su visibilidad sin que nadie tenga que tocar un ajuste. Es la causa del problema
y no su síntoma.

El nombre aprovecha para decir mejor lo que distingue a los dos motores. `-web` sugería la
plataforma, pero lo que los separa no es dónde corren —este también corre en una extensión y en
Node— sino **en qué lenguaje están escritos**, que es justo el eje del que habla el README de la
raíz: el motor en Java y el motor en TypeScript. `acheron-core` y `acheron-core-js` son la misma
pareja, nombrada por su lenguaje.

`sync.ts` se expone en `@projectellysia/acheron-core-js/sync` y no en la entrada principal. No es
criptografía: es el protocolo REST de Ellysia (`If-Match`, `409 vault_revision_mismatch`), y son dos
cosas que cambian a ritmos muy distintos. Separarlas mantiene visible ese acoplamiento en el import
de quien lo usa.

## El catálogo de storables

`src/schema.ts` no se edita a mano: lo genera `schema/generate.mjs` a partir de
[`schema/schema.json`](../schema/README.md), el contrato compartido con el motor Java, la API y la
app Android. `npm test` en `schema/` comprueba que no se ha separado del JSON, y
`test/acheron.schema.test.mjs` comprueba aquí que los índices que el motor deriva de él (qué campos
cifra cada tipo) siguen al contrato.

## Uso

```js
import { openVault, WrongPasswordError } from '@projectellysia/acheron-core-js'

const vault = await openVault(vaultJson, masterPassword, username)
const account = await vault.decryptStorable('accounts', item)
```

Dos cosas del contrato que conviene saber antes de integrarlo, porque no son evidentes:

- **La bóveda está atada al *username* de Ellysia.** El *checker* se valida contra
  `hex(SHA-256(username))`, así que renombrar a un usuario invalida su bóveda entera.
- **Los parámetros del KDF llegan como cadenas o como números.** La API exporta `kdfIterations` y
  compañía como texto y `AcheronCore` como número; las dos formas se aceptan y dan la misma clave.
  Un valor presente pero no interpretable **lanza**, en vez de caer al default: hacerlo derivaría
  una clave distinta y la bóveda parecería tener otra contraseña.

## Desarrollo

```bash
npm install
npm run build     # compila a dist/ con sus declaraciones
npm run typecheck # comprueba tipos sin emitir
npm test          # compila y corre: catálogo + contratos + interop + CRUD + sync
npm run vectors   # regenera vectors/acheron-vectors-js.json, que lee el motor Java
```

Las suites corren con `node` a secas, sin framework ni navegador, y salen con código distinto de
cero al fallar. Leen `../schema/` y `../vectors/`, así que se ejecutan dentro del repositorio
completo. Corren contra **`dist/`**, no contra el fuente: lo que interesa verificar es lo que
recibe el consumidor.

`tsconfig.json` va en `strict` con `noUncheckedIndexedAccess`. Ese último es incómodo y se ganó su
sitio: obliga a tratar un índice fuera de rango como lo que es, y en un motor que recorre campos de
un JSON venido de la red eso no es paranoia.
