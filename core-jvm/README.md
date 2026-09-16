# Acheron Core

Motor criptográfico zero-knowledge de Ellysia. Fuente única para los clientes
Android y desktop, que lo consumen como dependencia Maven. El cliente web tiene
su propia implementación en JS y se mantiene sincronizado mediante los
**vectores de interop** que genera este repo (ver más abajo).

Repositorio **privado**: tanto el código como el paquete publicado requieren un
token de GitHub con `read:packages` para poder descargarse.

## Consumir la librería

### 1. Crear un Personal Access Token

GitHub → Settings → Developer settings → Personal access tokens → **Tokens
(classic)** → Generate new token, con estos scopes:

- `read:packages` — imprescindible para descargar el artefacto.
- `repo` — necesario además porque el repositorio es privado.

> GitHub Packages para Maven **no permite descargas anónimas**, ni siquiera de
> paquetes públicos. El token es obligatorio siempre.

Guárdalo fuera del repo. Para uso local, en `~/.gradle/gradle.properties`:

```properties
gpr.user=tu-usuario-github
gpr.token=ghp_xxxxxxxxxxxx
```

### 2. Android / Gradle

En `settings.gradle.kts` (o donde declares los repositorios):

```kotlin
maven {
    url = uri("https://maven.pkg.github.com/ProjectEllysia/AcheronCore")
    credentials {
        username = providers.gradleProperty("gpr.user").orNull ?: System.getenv("GITHUB_ACTOR")
        password = providers.gradleProperty("gpr.token").orNull ?: System.getenv("GITHUB_TOKEN")
    }
}
```

Y en el módulo:

```kotlin
implementation("com.ellysia:acheron-core:1.0.0")
```

### 3. Desktop / Maven

`~/.m2/settings.xml`:

```xml
<servers>
  <server>
    <id>github-acheron</id>
    <username>tu-usuario-github</username>
    <password>ghp_xxxxxxxxxxxx</password>
  </server>
</servers>
```

`pom.xml`:

```xml
<repositories>
  <repository>
    <id>github-acheron</id>
    <url>https://maven.pkg.github.com/ProjectEllysia/AcheronCore</url>
  </repository>
</repositories>

<dependencies>
  <dependency>
    <groupId>com.ellysia</groupId>
    <artifactId>acheron-core</artifactId>
    <version>1.0.0</version>
  </dependency>
</dependencies>
```

El `id` del `<server>` y el del `<repository>` deben coincidir.

## Publicar una versión

El versionado va por tag. No hay que tocar `build.gradle.kts`:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

El workflow de CI corre los tests y publica `com.ellysia:acheron-core:1.0.0`
usando el `GITHUB_TOKEN` del propio Actions. Las versiones de release son
**inmutables** en GitHub Packages: para corregir algo hay que sacar un tag
nuevo, no reescribir el anterior.

En local, sin variables de entorno, la versión es `1.0.0-SNAPSHOT`.

## Interop con el cliente web

El web no consume este JAR: reimplementa el mismo formato en JS sobre WebCrypto
+ `hash-wasm`. Lo que se comparte es **el formato del vault**, no el código.

Eso significa que hay dos implementaciones independientes escribiendo en la
misma bóveda del mismo usuario. Sólo son seguras si algo comprueba que siguen
coincidiendo, y como no se puede comparar código Java contra código JavaScript,
lo que se comparan son **resultados sobre entradas conocidas**: los vectores.

### Los dos sentidos

Un vector prueba que un lado sabe leer lo que escribe el otro. Eso son dos
afirmaciones distintas y hacen falta las dos, porque los dos clientes escriben:
la app Android guarda credenciales que después abre la web, y la SPA guarda
credenciales que después abre el móvil.

| Fichero | Lo produce | Lo consume |
|---|---|---|
| `vectors/acheron-vectors.json` | este repo, `VectorGenerator` | el cliente web, `acheron.interop.test.mjs` |
| `vectors/acheron-vectors-js.json` | el cliente web, `acheron.vectorgen.mjs` | este repo |

El caso de mayor riesgo es `changePassword`, que rota la contraseña maestra
reescribiendo de golpe `checker`, `vaultKey` y `algorithm`. Un fallo ahí no
corrompe un campo suelto: deja la bóveda entera ilegible para el otro cliente.

### Regenerar los que produce este repo

```bash
./gradlew test --tests '*VectorGenerator'
cp build/acheron-vectors.json vectors/acheron-vectors.json
```

`VectorGenerator` no es un test sino un generador, y corre también con la suite
normal (`./gradlew test`), dejando su salida en `build/`. La copia versionada
bajo `vectors/` es la que consumen los demás repositorios.

### Por qué van versionados y no como artefacto de CI

Un artefacto de CI caduca y no es direccionable por versión, así que la única
forma de consumirlo es descargarlo a mano y copiarlo. Eso ya falló una vez: al
separar este repositorio, el fichero copiado en el repo web se perdió y su test
de interop estuvo un mes sin poder ejecutarse sin que nadie lo notara.

Versionados, un `git clone` a un tag basta para verificar la interoperabilidad,
sin red y sin credenciales.

**Quien copie un fichero de vectores a otro repositorio debe anotar de qué
versión salió.** Sin esa anotación, un fallo de interoperabilidad no se puede
atribuir a un cambio concreto del motor.

### Cambiar el formato de cable

Con los dos sentidos verificados, un cambio de formato no puede aterrizar de
golpe: cada repositorio fallaría contra los vectores antiguos del otro y se
bloquearían mutuamente. Va en dos pasos:

1. **El lector aprende el formato nuevo** sin dejar de aceptar el viejo. Se
   mergea y se publica.
2. **El emisor cambia** al formato nuevo y se regeneran sus vectores. El lector
   ya sabía leerlos.

Después se puede retirar el soporte del formato viejo, en un tercer paso.

Cualquier cambio en el formato (KDF, parámetros, envelope, AAD) debe romper los
vectores. Si no los rompe, es que no está cubierto por ellos.

## Desarrollo

```bash
./gradlew test
```

Requiere JDK 17. El target es Java 17 con `--release`, porque el consumidor
principal es Android (API 24+).
