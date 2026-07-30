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
    url = uri("https://maven.pkg.github.com/ProjectEllysia/acheron-core")
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
    <url>https://maven.pkg.github.com/ProjectEllysia/acheron-core</url>
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

`VectorGenerator` (en `src/test`) cifra vaults con master password y salt
conocidos y vuelca el JSON resultante junto con los valores en claro esperados.
Corre con la suite normal:

```bash
./gradlew test
```

Deja el resultado en `build/acheron-vectors.json`, que el CI sube como artefacto
`acheron-vectors`. El test de interop del repo web (`acheron.interop.test.mjs`)
lo descarga y comprueba que su implementación descifra exactamente lo esperado.

Cualquier cambio en el formato (KDF, parámetros, envelope, AAD) debe romper ese
test. Si no lo rompe, es que no está cubierto por los vectores.

## Desarrollo

```bash
./gradlew test
```

Requiere JDK 17. El target es Java 17 con `--release`, porque el consumidor
principal es Android (API 24+).
