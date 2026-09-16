package com.ellysia.acheron.vault.storables;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import com.ellysia.acheron.vault.interfaces.Storable;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import java.io.IOException;
import java.lang.reflect.Constructor;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Los storables de este motor tienen que seguir al catálogo de {@code schema/schema.json}.
 *
 * El catálogo de tipos de la bóveda está escrito cuatro veces y en cuatro
 * lenguajes: aquí, en la SPA ({@code storableSchema.js}), en la API
 * ({@code storable_specs.py}) y en la app Android ({@code StorableSchema.kt}).
 * Los cuatro deben coincidir en los nombres EXACTOS de los campos, porque son
 * las claves del JSON de la bóveda que los clientes se intercambian.
 *
 * Es la copia más difícil de revisar a ojo de las cuatro: en las otras el
 * catálogo es una tabla que se lee de un vistazo, y aquí está repartido por la
 * serialización de siete clases. Por eso el test no lee el código fuente sino
 * que SERIALIZA una instancia de cada tipo y compara las claves que salen, que
 * es exactamente lo que verá el otro cliente.
 *
 * Los vectores de interoperabilidad ({@code InteropFromJsTest}) cubren que el
 * cifrado sea compatible; esto cubre que el catálogo lo sea. Son dos contratos
 * distintos que fallan de formas distintas.
 *
 * <p>El contrato se lee de {@code schema/schema.json}, en la raíz de este
 * repositorio: es el mismo fichero del que genera su catálogo el motor web, así
 * que no hay copia que pueda quedarse atrás. Un cambio del catálogo que este
 * motor no siga falla en el mismo PR que lo introduce.
 */
@DisplayName("Contrato: los storables siguen a schema/schema.json")
public class StorableSchemaContractTest {

    private static final String SCHEMA = "../schema/schema.json";

    /**
     * Metadatos comunes a todo storable, que añade {@code VaultObject} y que
     * el esquema no declara porque no son campos del tipo.
     */
    private static final Set<String> METADATA =
            Set.of("id", "title", "createdAt", "updatedAt", "allowedUsers");

    /** kind del esquema → clase que lo implementa aquí. */
    private static final Map<String, Class<? extends Storable>> BY_KIND = new LinkedHashMap<>();
    static {
        BY_KIND.put("account", Account.class);
        BY_KIND.put("creditcard", CreditCard.class);
        BY_KIND.put("securenote", SecureNote.class);
        BY_KIND.put("identity", Identity.class);
        BY_KIND.put("bankaccount", BankAccount.class);
        BY_KIND.put("wifi", WifiNetwork.class);
        BY_KIND.put("license", SoftwareLicense.class);
    }

    @TestFactory
    @DisplayName("Cada tipo declara las claves y la categoría que el contrato dice")
    List<DynamicTest> everyStorableMatchesTheSharedSchema() throws IOException {
        Path path = Paths.get(System.getProperty("schema.in", SCHEMA)).toAbsolutePath();

        // Un fichero ausente no puede degradar a "cero tests, todo bien".
        if (!Files.exists(path)) {
            throw new IllegalStateException(
                    "No esta el catalogo en " + path + ". Vive en schema/schema.json, "
                    + "en la raiz del repositorio; el test se ejecuta desde core-jvm/.");
        }

        JsonObject root = JsonParser
                .parseString(new String(Files.readAllBytes(path), StandardCharsets.UTF_8))
                .getAsJsonObject();

        List<DynamicTest> tests = new ArrayList<>();
        Set<String> kindsInSchema = new LinkedHashSet<>();

        for (var element : root.getAsJsonArray("types")) {
            JsonObject type = element.getAsJsonObject();
            String kind = type.get("kind").getAsString();
            kindsInSchema.add(kind);
            tests.add(DynamicTest.dynamicTest(kind, () -> checkType(type, kind)));
        }

        // Ni un tipo de mas ni uno de menos: si el esquema anade uno y aqui no
        // hay clase, o al reves, tambien es divergencia.
        tests.add(DynamicTest.dynamicTest(
                "el motor implementa exactamente los kinds del contrato",
                () -> assertEquals(kindsInSchema, BY_KIND.keySet())));

        return tests;
    }

    private void checkType(JsonObject type, String kind) throws Exception {
        Class<? extends Storable> implementation = BY_KIND.get(kind);
        assertNotNull(implementation, "el contrato declara el kind '" + kind
                + "' y este motor no tiene clase para el");

        Storable storable = instantiate(implementation);

        assertEquals(type.get("category").getAsString(), storable.category(),
                kind + ": la clave de lista del JSON del vault no sigue al contrato");

        Set<String> expected = new LinkedHashSet<>();
        for (var field : type.getAsJsonArray("fields")) {
            expected.add(field.getAsJsonObject().get("key").getAsString());
        }

        JsonObject serialized = JsonParser.parseString(storable.toJson()).getAsJsonObject();
        Set<String> actual = serialized.keySet().stream()
                .filter(key -> !METADATA.contains(key))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        // Conjuntos y no listas: el ORDEN no forma parte del contrato. El JSON
        // del vault es un objeto con los campos por nombre, no una tupla, asi
        // que ningun cliente depende de el para leer un storable. Hoy hay una
        // divergencia real y viva -- este motor y la API serializan
        // creditcard con postalCode antes que cvv, y la SPA y la app Android
        // al reves -- que no rompe nada. Si algun dia el orden importa, el
        // sitio donde decidirlo es schema/schema.json, no este test.
        assertEquals(expected, actual,
                kind + ": las claves que serializa este motor no siguen al contrato");
    }

    /**
     * Construye un storable de relleno con el constructor mas corto que solo
     * pide cadenas y un booleano.
     *
     * Se hace por reflexion y no fijando las siete firmas a proposito: lo que
     * este test verifica son las CLAVES que salen al serializar, no los
     * constructores, y clavarlos aqui haria fallar el test por un cambio de
     * firma que no rompe ningun contrato.
     */
    private static Storable instantiate(Class<? extends Storable> type) throws Exception {
        Constructor<?> shortest = Arrays.stream(type.getConstructors())
                .filter(candidate -> Arrays.stream(candidate.getParameterTypes())
                        .allMatch(parameter -> parameter == String.class
                                || parameter == boolean.class))
                .min(Comparator.comparingInt(Constructor::getParameterCount))
                .orElseThrow(() -> new IllegalStateException(
                        "sin constructor de solo cadenas para " + type.getSimpleName()));

        Object[] arguments = Arrays.stream(shortest.getParameterTypes())
                .map(parameter -> parameter == boolean.class ? (Object) Boolean.FALSE : (Object) "x")
                .toArray();

        return (Storable) shortest.newInstance(arguments);
    }
}
