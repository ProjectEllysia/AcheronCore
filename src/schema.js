/**
 * El catálogo como MÓDULO JavaScript, generado desde `schema.json`.
 *
 * `schema.json` es el contrato y la fuente de verdad, pero un fichero JSON
 * sólo se puede leer del disco, y el consumidor principal de este paquete es
 * un motor criptográfico que corre en el NAVEGADOR, donde no hay disco. De ahí
 * este espejo: un módulo que cualquier navegador, empaquetador o runtime puede
 * importar sin tocar el sistema de ficheros.
 *
 * NO SE EDITA A MANO. Se regenera con `npm run generate`, y `npm test`
 * comprueba que no se ha separado del JSON.
 */
export const SCHEMA_VERSION = 1

export const STORABLE_SCHEMA = [
  {
    kind: "account", category: "accounts",
    fields: [
      { key: "username" },
      { key: "domain" },
      { key: "password", secret: true },
    ],
  },
  {
    kind: "creditcard", category: "creditcards",
    fields: [
      { key: "cardHolderName" },
      { key: "cardNumber", secret: true },
      { key: "expirationDate" },
      { key: "cvv", secret: true },
      { key: "postalCode" },
    ],
  },
  {
    kind: "securenote", category: "securenotes",
    fields: [
      { key: "content" },
    ],
  },
  {
    kind: "identity", category: "identities",
    fields: [
      { key: "fullName" },
      { key: "email" },
      { key: "phone" },
      { key: "address" },
      { key: "city" },
      { key: "country" },
      { key: "documentId", secret: true },
    ],
  },
  {
    kind: "bankaccount", category: "bankaccounts",
    fields: [
      { key: "bankName" },
      { key: "holder" },
      { key: "iban", secret: true },
      { key: "swiftBic", secret: true },
      { key: "accountNumber", secret: true },
    ],
  },
  {
    kind: "wifi", category: "wifinetworks",
    fields: [
      { key: "ssid" },
      { key: "password", secret: true },
      { key: "securityType" },
    ],
  },
  {
    kind: "license", category: "licenses",
    fields: [
      { key: "product" },
      { key: "licenseKey", secret: true },
      { key: "licensedTo" },
      { key: "version" },
    ],
  },
]
