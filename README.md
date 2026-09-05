# Acheron Schema

El catálogo de tipos de la bóveda de Acheron, como **dato neutro de lenguaje**.

Acheron es la bóveda de credenciales de Ellysia. Guarda cuentas, tarjetas, notas seguras,
identidades, cuentas bancarias, redes Wi-Fi y licencias. Este repositorio responde a una sola
pregunta, y a ninguna más: **qué tipos existen, qué campos tiene cada uno y cuáles son sensibles.**

## El problema que resuelve

Ese catálogo estaba escrito **cuatro veces, en cuatro lenguajes**:

| Dónde | Fichero |
|---|---|
| SPA web | `EllysiaServer`, `web/app/src/acheron/storableSchema.js` |
| API | `EllysiaServer`, `API/src/modules/features/acheron/storable_specs.py` |
| App Android | `AcheronMobile`, `StorableTypes.kt` |
| Motor Java | `AcheronCore`, las clases de `vault/storables/` |

Los cuatro tienen que coincidir en los nombres **exactos** de los campos —`cardHolderName`,
`expirationDate`, `cvv`…— porque esos nombres son las claves del JSON de la bóveda. Nada comprobaba
que coincidieran: si alguien añadía un tipo en un sitio y se olvidaba de otro, el fallo se
descubría cuando un cliente no sabía leer lo que había escrito otro.

Y el catálogo estaba **mezclado con la interfaz**. En la web y en el móvil vivía junto a las
etiquetas en castellano y a las pistas del formulario (teclado numérico, textarea, longitud
mínima). A Python y a Kotlin no se les puede pedir que consuman un fichero así, de modo que
unificarlo era imposible hasta separarlo.

## Qué hay aquí

**`schema.json`** es el contrato. Datos puros: sin código, sin lógica y sin una sola cadena visible
para el usuario.

```json
{
  "kind": "account",
  "category": "accounts",
  "fields": [
    { "key": "username" },
    { "key": "domain" },
    { "key": "password", "secret": true }
  ]
}
```

- **`kind`** — el singular, lo que espera la API en `POST /acheron/storables`.
- **`category`** — el plural, la clave de lista dentro del JSON de la bóveda.
- **`fields[].key`** — el nombre del campo, literal, tal y como viaja en el JSON.
- **`fields[].secret`** — marca los campos sensibles. Es propiedad **del dato**, no de la pantalla:
  la interfaz los enmascara, y la extensión de navegador necesita saber cuál es el campo de
  contraseña para autocompletarlo sin mostrarlo en claro.

Lo que **no** hay aquí, y no debe haberlo: etiquetas, plurales legibles, pistas de formulario,
orden de presentación, iconos. Todo eso es de cada cliente. El validador lo impide activamente.

**`index.js`** es un lector para consumidores JavaScript, con los índices que todos acaban
necesitando (por `kind`, por `category`, claves por categoría, campos secretos por categoría).
Python, Kotlin y Java leen el JSON directamente; no necesitan librería.

## Consumir el esquema

```bash
npm install github:ProjectEllysia/AcheronSchema#v1.0.0
```

```js
import { SCHEMA_BY_CATEGORY, FIELDS_BY_CATEGORY } from '@projectellysia/acheron-schema'
```

Desde otros lenguajes, léelo como el JSON que es. Cada consumidor debe **verificar su copia contra
este fichero en su propia suite** en lugar de confiar en que coinciden; ése es el objetivo, y sin
esa verificación este repositorio sería un quinto sitio donde escribir lo mismo en vez del sitio
donde está escrito.

## Cambiar el catálogo

Añadir un tipo o un campo es un cambio de contrato entre cuatro implementaciones. El orden importa:

1. **Aquí primero.** Se edita `schema.json`, pasa `npm test` y se publica con un tag nuevo.
2. **Después cada consumidor**, actualizando su copia y su verificación.

Al revés no funciona: un consumidor que añada un campo antes que el esquema verá fallar su propia
suite, que es justo lo que debe pasar.

**Fija la versión que consumes.** Nada de rangos: en un contrato que decide qué campos se cifran,
una actualización automática es un cambio que nadie revisó.

## Desarrollo

```bash
npm test        # valida schema.json
```

El validador comprueba la forma del documento (versión, claves permitidas), la unicidad de `kind`,
`category` y claves de campo, que las claves sean identificadores —viajan literalmente al JSON, así
que no admiten guiones ni espacios—, y que no se haya colado texto de interfaz.

Se valida **aquí, en el origen**, y no en cada consumidor: un error de forma no se manifiesta como
un fallo limpio río abajo, sino como un cliente que no encuentra un campo, o que deja de cifrar uno
que debía cifrar.
