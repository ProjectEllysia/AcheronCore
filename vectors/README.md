# Vectores de interoperabilidad

Los dos motores implementan el mismo formato de bóveda sin compartir código, y escriben en la misma
bóveda del mismo usuario. Solo son seguros si algo comprueba que siguen coincidiendo, y como no se
puede comparar código Java contra código TypeScript, se comparan **resultados sobre entradas
conocidas**: bóvedas cifradas por un motor que el otro tiene que abrir.

No se comparan bytes. AES-GCM usa un vector de inicialización aleatorio en cada operación, así que
el mismo texto cifrado dos veces da salidas distintas; la única forma de verificar
interoperabilidad con un cifrado autenticado es **descifrar** y comparar el texto en claro.

## Los dos sentidos

Un vector prueba que un lado sabe leer lo que escribe el otro. Son dos afirmaciones distintas y
hacen falta las dos, porque los dos clientes escriben: la app Android guarda credenciales que
después abre la web, y la SPA guarda credenciales que después abre el móvil.

| Fichero | Lo produce | Lo consume |
|---|---|---|
| `acheron-vectors.json` | `core-jvm`, `VectorGenerator` | `core-web`, `acheron.interop.test.mjs` y `acheron.crud.test.mjs` |
| `acheron-vectors-js.json` | `core-web`, `acheron.vectorgen.mjs` | `core-jvm`, `InteropFromJsTest` |

Cobertura: Argon2id y PBKDF2, con `account`, `creditcard` y `securenote`. El caso de mayor riesgo
es `changePassword`, que rota la contraseña maestra reescribiendo de golpe `checker`, `vaultKey` y
`algorithm`: un fallo ahí no corrompe un campo suelto, deja la bóveda entera ilegible para el otro
cliente.

## Regenerarlos

No se editan a mano. Se regeneran a propósito cuando cambia el formato de cable, y la salida se
commitea: como cada bóveda nueva estrena salt, clave e IV, el fichero cambia en cada ejecución
aunque no cambie nada del código.

```bash
# Los que produce el motor Java
cd core-jvm && ./gradlew test --tests '*VectorGenerator'
cp build/acheron-vectors.json ../vectors/acheron-vectors.json

# Los que produce el motor web (escribe aquí directamente)
cd core-web && npm run vectors
```

## Cambiar el formato de cable

Con los dos motores y los vectores en el mismo repositorio, un cambio de formato es un solo PR: el
motor que escribe el formato nuevo, el que lo lee, y los vectores regenerados. Lo que no cambia es
la compatibilidad hacia atrás con las bóvedas que ya existen: **el lector sigue aceptando el
formato viejo**, porque hay bóvedas de usuarios reales cifradas con él y clientes que tardarán en
actualizarse. Retirar el formato viejo es un cambio posterior y aparte.

Cualquier cambio en el formato (KDF, parámetros, envelope, AAD) debe romper los vectores. Si no los
rompe, es que no está cubierto por ellos.
