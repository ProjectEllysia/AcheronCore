# Suites del motor web

Se ejecutan con `node` a secas, sin framework. Salen con código distinto de cero si algo falla,
para poder usarse en CI:

```bash
npm test    # catálogo + contratos + interoperabilidad + CRUD + sync
```

Ninguna suite lleva ficheros propios de datos:

- Los **vectores de interoperabilidad** (`acheron.interop.test.mjs`, `acheron.crud.test.mjs` y el
  generador `acheron.vectorgen.mjs`) leen y escriben en [`vectors/`](../../vectors/README.md), en la
  raíz del repositorio.
- El **catálogo** (`acheron.schema.test.mjs`) se compara con
  [`schema/schema.json`](../../schema/README.md).

Así el motor Java y este prueban contra los mismos ficheros, y no hay copia que pueda quedarse
atrás.
