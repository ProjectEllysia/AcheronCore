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

- **`matchKey`** — opcional; sólo lo tienen los tipos que se pueden asociar a una página web.
  Ver más abajo.

- **`identityKey`** — opcional; qué campo es el identificador de acceso. Va siempre acompañado de
  `matchKey`. Ver más abajo.

Lo que **no** hay aquí, y no debe haberlo: etiquetas, plurales legibles, pistas de formulario,
orden de presentación, iconos. Todo eso es de cada cliente. El validador lo impide activamente.

**`generate.mjs`** escribe el mismo catálogo como módulo TypeScript en `core-web/src/schema.ts`.
Existe porque un fichero JSON sólo se puede leer del disco, y el motor web —y la extensión de
navegador que lo usa— corre donde no hay disco. Ese módulo no se edita a mano: se regenera con
`npm run generate`, y `npm test` comprueba que no se ha separado del JSON.

El motor Java lee el JSON directamente desde sus tests; Python y Kotlin llevan su propia copia y la
verifican en su suite.

## `matchKey`: qué campo se compara con la URL

Para autocompletar, la extensión de navegador tiene que decidir **qué credencial corresponde a la
página que el usuario está viendo**. Eso significa comparar la URL contra algún campo del storable,
y el esquema es quien dice cuál:

```json
{ "kind": "account", "category": "accounts", "matchKey": "domain", ... }
```

Sólo `account` lo tiene. Los demás tipos no se asocian a un sitio web: una tarjeta o una nota
segura no «pertenecen» a un dominio, y darles uno invitaría a ofrecerlas donde no toca.

Vive aquí y no en la extensión a propósito. Si la extensión llevara escrito que «el campo se llama
`domain`», sería un cliente con conocimiento propio del catálogo que nadie verifica — exactamente
el problema que este repositorio existe para eliminar.

El validador comprueba dos cosas sobre él. Que **apunte a un campo que existe**: un `matchKey`
colgando no rompe nada al cargar, hace que la extensión no ofrezca *nunca* esa credencial, en
silencio. Y que **no apunte a un campo secreto**: comparar un valor sensible contra una URL es
sacarlo de su sitio.

## `identityKey`: qué campo se escribe en la casilla de usuario

Rellenar un formulario de acceso necesita **dos** campos, no uno. `matchKey` resuelve contra qué se
compara la URL y `secret` resuelve cuál es la contraseña, pero el identificador de acceso no lo
declaraba nada:

```json
{ "kind": "account", "category": "accounts", "matchKey": "domain", "identityKey": "username", ... }
```

Sin esta marca, un cliente sólo puede **adivinar**: por el nombre del campo —y entonces lleva
escrito `username`, que es el acoplamiento que este repositorio elimina— o por descarte, quedándose
con el campo que no es secreto ni comparable. La extensión lo hizo así durante un tiempo y
funcionaba, pero el razonamiento dependía del **orden** de los campos y de que nunca apareciera un
segundo campo no secreto. Al crecer el catálogo se habría roto en silencio: rellenaría el campo
equivocado sin que fallara nada.

El validador comprueba cuatro cosas. Que apunte a un campo que **existe**; que **no sea secreto**,
porque el identificador se muestra en claro para que el usuario elija entre varias credenciales del
mismo sitio; que **no sea el mismo campo que `matchKey`**, porque un campo no puede ser a la vez el
dominio y el usuario; y que **venga acompañado de `matchKey`**, porque un tipo con identificador
pero sin campo comparable no se podría ofrecer en ninguna página, y declararlo sería prometer algo
que no se puede cumplir.

### La regla de comparación

El esquema dice *qué* campo se compara. *Cómo* se compara es una decisión de seguridad, y la
decisión tomada es la conservadora:

> **Coincidencia exacta de host**, sin subdominios, y sólo sobre `https`.

Una credencial guardada para `mail.google.com` se ofrece en `mail.google.com` y en ningún otro
sitio.

El motivo es la asimetría del error. Ser demasiado estricto molesta: el usuario no ve su credencial
ofrecida y la busca a mano. Ser demasiado laxo **entrega credenciales a quien no debe**, y eso no
tiene deshacer. Las reglas más cómodas —coincidencia por dominio registrable, o por sufijo— exigen
la *Public Suffix List* para no tratar `github.io` o `blogspot.com` como un solo sitio; sin ella, un
usuario cualquiera de esos dominios recibiría las credenciales de todos los demás.

Ampliar la regla más adelante es fácil y compatible: una credencial que hoy se ofrece seguirá
ofreciéndose. Estrecharla no lo es — deja de ofrecer credenciales donde el usuario ya se había
acostumbrado a verlas. Por eso se empieza estrecho.

`https` no es negociable: autocompletar sobre `http` entrega la contraseña a la red.

## Consumir el esquema

Dentro de este repositorio, los dos motores lo leen por ruta relativa: no hay copia.

Fuera de él (la API de Ellysia y la app Android), cada consumidor lleva una copia de `schema.json`
**tomada del tag de AcheronCore que consume** y anotada con ese tag, y la verifica contra su propio
código en su suite. Sin esa verificación, la copia sería un sitio más donde escribir lo mismo en vez
del sitio donde está escrito.

## Cambiar el catálogo

Añadir un tipo o un campo es un cambio de contrato entre varias implementaciones:

1. **En este repositorio, un solo PR**: `schema.json`, el `core-web/src/schema.ts` regenerado y los
   dos motores. Las tres suites tienen que pasar.
2. **Se publica una versión** de AcheronCore, que saca los dos motores con el mismo número.
3. **Después cada consumidor externo** sube a esa versión y actualiza su copia.

## Desarrollo

```bash
npm test        # valida schema.json y su espejo en core-web/src/schema.ts
```

El validador comprueba la forma del documento (versión, claves permitidas), la unicidad de `kind`,
`category` y claves de campo, que las claves sean identificadores —viajan literalmente al JSON, así
que no admiten guiones ni espacios—, y que no se haya colado texto de interfaz.

Se valida **aquí, en el origen**, y no en cada consumidor: un error de forma no se manifiesta como
un fallo limpio río abajo, sino como un cliente que no encuentra un campo, o que deja de cifrar uno
que debía cifrar.
