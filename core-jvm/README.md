# Acheron Core — motor Java

Motor criptográfico zero-knowledge de Ellysia para la JVM. Lo consumen los
clientes Android y desktop como dependencia Maven. El cliente web usa el motor
de [`core-web/`](../core-web/README.md), y los dos se mantienen de acuerdo con
el catálogo de [`schema/`](../schema/README.md) y los vectores de
[`vectors/`](../vectors/README.md).

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
implementation("com.ellysia:acheron-core:2.2.0")
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
    <version>2.2.0</version>
  </dependency>
</dependencies>
```

El `id` del `<server>` y el del `<repository>` deben coincidir.

## Publicar una versión

Este paquete sale siempre a la vez que `@projectellysia/acheron-core-web` y con
el mismo número, desde un tag del repositorio; el procedimiento está en el
[README de la raíz](../README.md#publicar-una-versión). En local, sin variables
de entorno, la versión es `2.2.0-SNAPSHOT`.

## Interoperabilidad con el motor web

El motor web no consume este JAR: reimplementa el mismo formato sobre WebCrypto
y `hash-wasm`. Lo que se comparte es el formato de la bóveda, y lo que garantiza
que las dos implementaciones coinciden son los vectores de
[`vectors/`](../vectors/README.md), que la suite de este motor lee
directamente (`InteropFromJsTest`) y genera (`VectorGenerator`).

## Desarrollo

```bash
./gradlew test
```

Se ejecuta desde `core-jvm/`: los tests leen `../schema/` y `../vectors/`.
Requiere JDK 17. El target es Java 17 con `--release`, porque el consumidor
principal es Android (API 24+).
