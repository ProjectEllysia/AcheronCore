plugins {
    `java-library`
    `maven-publish`
}

group = "com.ellysia"
// Las releases se publican desde un tag (v1.2.3 -> 1.2.3); en local es snapshot.
version = System.getenv("RELEASE_VERSION") ?: "1.0.0-SNAPSHOT"

repositories {
    mavenCentral()
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
    withSourcesJar()
}

// El consumidor principal es Android (API 24+). --release impide enlazar contra
// firmas que solo existen en JDKs mas nuevos que el que dice el target.
tasks.withType<JavaCompile>().configureEach {
    options.release.set(17)
    // Obligatorio: hay literales no-ASCII en el codigo (VaultTest usa
    // "Contraseña" cruda). Sin esto javac usa el charset de la plataforma y en
    // Windows los mangla, mientras que en el CI de Linux pasaria igualmente.
    options.encoding = "UTF-8"
}

dependencies {
    compileOnly("org.projectlombok:lombok:1.18.40")
    annotationProcessor("org.projectlombok:lombok:1.18.40")

    // api, no implementation: JsonObject aparece en firmas publicas
    // (Account.fromJson y demas storables), asi que el consumidor lo necesita
    // en su classpath de compilacion.
    api("com.google.code.gson:gson:2.11.0")

    // Argon2id puro-Java (sin binarios JNA nativos), funciona en cualquier ABI
    // de Android a diferencia de de.mkammerer:argon2-jvm.
    implementation("org.bouncycastle:bcprov-jdk18on:1.78.1")
    implementation("org.jetbrains:annotations:26.0.2")

    testCompileOnly("org.projectlombok:lombok:1.18.40")
    testAnnotationProcessor("org.projectlombok:lombok:1.18.40")

    testImplementation("org.junit.jupiter:junit-jupiter:5.11.0")
    testImplementation("org.junit.platform:junit-platform-suite:1.11.0")
}

val vectorsFile = layout.buildDirectory.file("acheron-vectors.json")

tasks.test {
    useJUnitPlatform()
    // VectorGenerator corre con el resto de tests y deja aqui los vectores de
    // interop que consume el cliente web. CI los sube como artefacto.
    systemProperty("vectors.out", vectorsFile.get().asFile.path)
    outputs.file(vectorsFile)

    // Los vectores que produce el cliente web son ENTRADA de la suite: sin
    // declararlos, Gradle da la tarea por up-to-date y no vuelve a ejecutar
    // InteropFromJsTest cuando cambian, que es justo cuando hay que ejecutarlo.
    // Se usa inputs.files (y no inputs.file) para que un fichero ausente no
    // rompa la configuracion del build: de ese caso ya se queja el test, con
    // un mensaje que explica como regenerarlo.
    inputs.files(layout.projectDirectory.file("../vectors/acheron-vectors-js.json"))
        .withPropertyName("interopVectorsFromJs")
        .optional()
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            pom {
                name.set("Acheron Core")
                description.set("Zero-knowledge vault crypto engine for Ellysia")
                url.set("https://github.com/ProjectEllysia/AcheronCore")
            }
        }
    }
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/ProjectEllysia/AcheronCore")
            credentials {
                username = System.getenv("GITHUB_ACTOR")
                    ?: providers.gradleProperty("gpr.user").orNull
                password = System.getenv("GITHUB_TOKEN")
                    ?: providers.gradleProperty("gpr.token").orNull
            }
        }
    }
}
