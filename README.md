# Acheron Core Web

El motor criptográfico de la bóveda de Acheron para **JavaScript**.

Acheron es la bóveda de credenciales de Ellysia. Todo el cifrado ocurre en el cliente: el servidor
es *zero-knowledge*, guarda un blob que no sabe leer y nunca ve la contraseña maestra ni el texto en
claro. Este paquete es la mitad del cliente que hace ese trabajo, y lo consumen el cliente web y la
extensión de navegador.

## Su relación con AcheronCore

[`AcheronCore`](https://github.com/ProjectEllysia/AcheronCore) hace lo mismo en Java, para la app
Android. **No comparten una línea de código**: cada uno implementa por su cuenta el mismo *formato
de cable* —cuántas pasadas de Argon2id, en qué orden van los bytes, dónde acaba el vector de
inicialización y empieza el texto cifrado—.

Eso importa porque los dos escriben en la misma bóveda del mismo usuario. Si guardas una credencial
desde el móvil y luego abres la web, la web tiene que descifrar exactamente lo que escribió el
móvil, y viceversa.

Como no se puede comparar código Java contra código JavaScript, se comparan **resultados sobre
entradas conocidas**: los vectores de interoperabilidad, en los dos sentidos. Están descritos en
[`test/README.md`](test/README.md), y son lo único que garantiza que las dos implementaciones no se
han separado.

## Qué hay dentro

| Fichero | Qué hace |
|---|---|
| `src/crypto.js` | primitivas: Argon2id/PBKDF2, AES-GCM, Base64, el *checker* |
| `src/vault.js` | abrir una bóveda, descifrar y recifrar storables, rotar la contraseña |
| `src/storableFields.js` | qué campos cifra cada tipo, derivado del catálogo |
| `src/schema.js` | copia del catálogo de storables (ver abajo) |
| `src/passwordGenerator.js` | generador de contraseñas |
| `src/passwordStrength.js` | medidor de robustez |
| `src/sync.js` | concurrencia optimista con la API — **entrada aparte** |

`sync.js` se expone en `@projectellysia/acheron-core-web/sync` y no en la entrada principal. No es
criptografía: es el protocolo REST de Ellysia (`If-Match`, `409 vault_revision_mismatch`), y son dos
cosas que cambian a ritmos muy distintos. Separarlas mantiene visible ese acoplamiento en el import
de quien lo usa.

## El catálogo de storables

`src/schema.js` es una **copia** del catálogo que vive en
[`AcheronSchema`](https://github.com/ProjectEllysia/AcheronSchema), el contrato compartido con la
API, la app Android y `AcheronCore`.

Es una copia y no una dependencia npm por una razón temporal: los repositorios de la organización
son privados, así que instalar desde otro repositorio exige credenciales que esta CI todavía no
tiene. Convertirlo en dependencia con versión fijada llega con la publicación en GitHub Packages.

Mientras tanto, `test/acheron.schema.test.mjs` ata la copia al contrato, igual que hacen los otros
tres clientes con la suya. Sin esa verificación, la copia sería un quinto sitio donde el catálogo
puede divergir.

| | |
|---|---|
| **Copiado de** | `AcheronSchema` @ [`v1.1.0`](https://github.com/ProjectEllysia/AcheronSchema/releases/tag/v1.1.0) |

## Uso

```js
import { openVault, WrongPasswordError } from '@projectellysia/acheron-core-web'

const vault = await openVault(vaultJson, masterPassword, username)
const account = await vault.decryptStorable('accounts', item)
```

Dos cosas del contrato que conviene saber antes de integrarlo, porque no son evidentes:

- **La bóveda está atada al *username* de Ellysia.** El *checker* se valida contra
  `hex(SHA-256(username))`, así que renombrar a un usuario invalida su bóveda entera.
- **Los parámetros del KDF llegan como cadenas.** La API exporta `kdfIterations` y compañía como
  texto, no como números.

## Desarrollo

```bash
npm install
npm test          # interoperabilidad + CRUD + sync + catálogo
npm run vectors   # regenera los vectores que consume AcheronCore
```

Las suites corren con `node` a secas, sin framework ni navegador, y salen con código distinto de
cero al fallar.
