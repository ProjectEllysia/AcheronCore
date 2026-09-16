package com.ellysia.acheron;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import com.ellysia.acheron.vault.User;
import com.ellysia.acheron.vault.Vault;
import com.ellysia.acheron.vault.VaultFactory;
import com.ellysia.acheron.vault.interfaces.Storable;
import com.ellysia.acheron.vault.storables.Account;
import com.ellysia.acheron.vault.storables.CreditCard;
import com.ellysia.acheron.vault.storables.SecureNote;
import com.ellysia.acheron.vault.storables.VaultObject;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Interoperabilidad JS → Java: comprueba que este motor sabe leer las bóvedas
 * que escribe el cliente web.
 *
 * Es el espejo de {@link VectorGenerator} con los papeles cambiados. Aquel
 * PRODUCE vectores para que el cliente web verifique que sabe leer lo que
 * escribe Java; éste CONSUME los que produce el cliente web
 * ({@code acheron.vectorgen.mjs}) para verificar el sentido contrario.
 *
 * Hacen falta los dos porque los dos clientes escriben en la misma bóveda del
 * mismo usuario: la app Android guarda credenciales que después abre la web, y
 * la SPA guarda credenciales que después abre el móvil.
 *
 * No se comparan bytes. AES-GCM usa un IV aleatorio en cada operación, así que
 * el mismo texto cifrado dos veces da salidas distintas; la única forma de
 * verificar interoperabilidad con un cifrado autenticado es DESCIFRAR y
 * comparar el texto en claro.
 *
 * Los vectores se versionan en {@code vectors/acheron-vectors-js.json}; el
 * README explica de dónde salen y cuándo se regeneran.
 */
@DisplayName("Interop JS → Java: leer lo que escribe el cliente web")
public class InteropFromJsTest {

    private static final String VECTORS = "vectors/acheron-vectors-js.json";

    @TestFactory
    @DisplayName("Cada bóveda escrita por el cliente web se abre y descifra igual")
    List<DynamicTest> everyCaseFromTheWebClientDecrypts() throws IOException {
        Path path = Paths.get(System.getProperty("vectors.js.in", VECTORS)).toAbsolutePath();

        // Un fichero ausente NO puede degradar a "cero tests, todo bien": es
        // exactamente el fallo que dejo la interop del repo web un mes muerta.
        if (!Files.exists(path)) {
            throw new IllegalStateException(
                    "No estan los vectores del cliente web en " + path + ". Se regeneran con "
                    + "`node web/app/test/acheron.vectorgen.mjs` en EllysiaServer; ver README.");
        }

        JsonObject root = JsonParser
                .parseString(new String(Files.readAllBytes(path), StandardCharsets.UTF_8))
                .getAsJsonObject();

        List<DynamicTest> tests = new ArrayList<>();
        for (var element : root.getAsJsonArray("cases")) {
            JsonObject testCase = element.getAsJsonObject();
            String kdf = testCase.get("kdf").getAsString();
            tests.add(DynamicTest.dynamicTest("caso kdf=" + kdf, () -> checkCase(testCase)));
        }

        assertEquals(3, tests.size(), "se esperaban tres casos en los vectores del cliente web");
        return tests;
    }

    private void checkCase(JsonObject testCase) throws Exception {
        String masterPassword = testCase.get("masterPassword").getAsString();
        String username = testCase.get("username").getAsString();
        JsonObject expected = testCase.getAsJsonObject("expected");

        User user = new User("U1", "Alice", "Doe", "alice@example.com", username);
        Vault vault = new VaultFactory(user)
                .fromJson(testCase.getAsJsonObject("vault").toString(), masterPassword);
        vault.decryptAll();

        for (String id : expected.keySet()) {
            Storable storable = vault.get(id);
            assertNotNull(storable, "el storable " + id + " no esta en la boveda");

            Map<String, String> plain = plainFields(storable);
            JsonObject wanted = expected.getAsJsonObject(id);
            for (String field : wanted.keySet()) {
                assertEquals(
                        wanted.get(field).getAsString(), plain.get(field),
                        id + "." + field + " no descifra al valor que escribio el cliente web");
            }
        }
    }

    /**
     * Campos en claro de un storable ya descifrado, por nombre de campo.
     *
     * Se usan los getters y no {@code toJson()} a proposito: la serializacion
     * enmascara los secretos cuando el storable esta descifrado (la contrasena
     * sale como {@code "***"}), que es correcto para no filtrarlos a un log
     * pero inservible para comparar aqui.
     */
    private static Map<String, String> plainFields(Storable storable) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("title", ((VaultObject) storable).getTitle());

        if (storable instanceof Account account) {
            fields.put("username", account.getUsername());
            fields.put("domain", account.getDomain());
            fields.put("password", account.getPassword());
        } else if (storable instanceof CreditCard card) {
            fields.put("cardHolderName", card.getCardHolderName());
            fields.put("cardNumber", card.getCardNumber());
            fields.put("expirationDate", card.getExpirationDate());
            fields.put("cvv", card.getCvv());
            fields.put("postalCode", card.getPostalCode());
        } else if (storable instanceof SecureNote note) {
            fields.put("content", note.getContent());
        } else {
            throw new IllegalArgumentException(
                    "tipo de storable sin extractor en el test: " + storable.getClass().getName());
        }
        return fields;
    }
}
