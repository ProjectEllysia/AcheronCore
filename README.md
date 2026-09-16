# Acheron Core

El motor criptográfico *zero-knowledge* de la bóveda de Acheron, en sus dos lenguajes, junto al
catálogo y los vectores que los mantienen de acuerdo.

Acheron es la bóveda de credenciales de Ellysia. Todo el cifrado ocurre en el dispositivo del
usuario: el servidor guarda un blob que no sabe leer y nunca ve la contraseña maestra. Ese trabajo
lo hacen dos implementaciones del mismo formato, una para la JVM (la app Android) y otra para el
navegador (la SPA y la extensión), que escriben en la **misma** bóveda del mismo usuario. Si
dejaran de coincidir, una credencial guardada desde el móvil no se podría abrir desde la web.

## Qué hay aquí

| Carpeta | Qué es | Se publica como |
|---|---|---|
| [`core-jvm/`](core-jvm/README.md) | El motor en Java 17 | `com.ellysia:acheron-core` (Maven, GitHub Packages) |
| [`core-web/`](core-web/README.md) | El motor en TypeScript | `@projectellysia/acheron-core-web` (npm, GitHub Packages) |
| [`schema/`](schema/README.md) | El catálogo de storables: qué tipos guarda una bóveda y con qué campos | no se publica; lo leen los dos motores |
| [`vectors/`](vectors/README.md) | Bóvedas cifradas por un motor que el otro tiene que saber abrir | no se publica; lo leen las dos suites |

Los dos motores no comparten código, y es deliberado: las primitivas criptográficas vienen de cada
plataforma (JCA en la JVM, WebCrypto y `hash-wasm` en el navegador), y lo que se escribe dos veces
es la capa fina de encima —formato de contenedor, catálogo, parámetros de derivación—. Esa capa se
ata con **datos compartidos**, no con código compartido: un único `schema/schema.json` y un único
juego de vectores, leídos por ruta relativa desde las dos suites. Una divergencia entre motores
falla en el mismo PR que la introduce.

## Versiones

Los dos paquetes salen **siempre juntos y con el mismo número**, aunque solo uno haya cambiado. El
número no significa «este paquete cambió», sino «esta pareja de motores es interoperable»: la app
Android con `acheron-core` 2.2.0 y la SPA con `acheron-core-web` 2.2.0 leen y escriben las mismas
bóvedas.

Un consumidor fija la versión exacta, sin rangos. En un contrato que decide qué campos se cifran,
una actualización automática es un cambio que nadie revisó.

## Publicar una versión

La versión la manda el tag; no hay que tocar `build.gradle.kts` ni `package.json`:

```bash
git tag v2.2.0 && git push origin v2.2.0
```

La CI prueba el catálogo y los dos motores, publica el paquete Maven y, solo si ha salido bien,
el paquete npm. Las versiones publicadas en GitHub Packages son **inmutables**: para corregir algo
se saca un tag nuevo.

## Desarrollo

```bash
cd schema   && npm test                 # valida el catálogo y su espejo en core-web/
cd core-jvm && ./gradlew test           # motor Java (JDK 17+)
cd core-web && npm install && npm test  # motor web (Node 22+)
```

Cambiar el catálogo o el formato de cable es un solo PR: `schema/` o los vectores, y los dos
motores. Los detalles están en [`schema/README.md`](schema/README.md) y
[`vectors/README.md`](vectors/README.md).
