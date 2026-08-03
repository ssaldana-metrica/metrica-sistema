<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Reglas del proyecto

> Lo de arriba, entre marcadores, se regenera solo. Lo de aquí abajo es nuestro:
> no lo muevas dentro del bloque o se perderá en la próxima regeneración.

## Migraciones: el archivo va a `main` antes o junto con aplicarla

**Nunca apliques una migración a Supabase cuyo archivo no esté ya fusionado en
`main`, o no vaya a fusionarse en la misma sesión.**

El orden correcto es: escribir el archivo en `supabase/migrations/`, abrir el
PR, fusionar a `main`, y recién entonces aplicar. Si algo urge y hay que
aplicar primero, la fusión se hace **el mismo día** — no se deja para después.

### Por qué

Ya pasó, y costó caro. Entre el 30 y el 31 de julio de 2026 se aplicaron cuatro
migraciones a producción cuyos archivos vivían en una rama sin fusionar. El
resultado fueron tres realidades distintas conviviendo:

- Supabase con 31 migraciones aplicadas
- `main` con 27
- La rama que Vercel desplegaba, con 27 y un commit propio

De ahí salieron dos problemas reales. Uno: la migración 0028 eliminó la tabla
`banco_codigos_oda_prov`, pero el código desplegado seguía consultándola, así
que **anular una ODA de proveedores fallaba en producción**. Dos: si alguien
hubiera reconstruido la base desde los archivos "oficiales" de `main`, se
habrían perdido en silencio un arreglo de seguridad (RLS en
`oda_prov_correlativo`) y un cambio de control interno.

La regla no es burocracia: los archivos de migración **son** la definición del
esquema. Si no coinciden con lo aplicado, dejan de servir para reconstruir la
base, que es justamente para lo que existen.

## La rama de producción de Vercel es `main`

No una rama de trabajo. Cuando Vercel apunta a una rama `claude/*` o similar,
fusionar a `main` no despliega nada y el trabajo parece perdido — pasó, y tomó
varias horas descubrirlo. `main` es además la única rama desde la que GitHub
ejecuta las tareas programadas de `.github/workflows/`.

## Nada se borra: se anula

Las tablas de documentos con valor contable llevan `trg_no_borrar`. Anular es
cambiar de estado y dejar el motivo; borrar no es una opción.

La única excepción son las ODA de proveedores, que sí se pueden borrar **en
estado borrador únicamente** — y aun así quedan archivadas en
`ordenes_proveedores_borradas` por un trigger `BEFORE DELETE`, con quién las
borró y cuándo.

## Los códigos no se reciclan

Un código de cotización u ODA que se tomó no vuelve al banco, y uno anulado
nunca se reutiliza. No existe camino en la aplicación para revertirlo, y así
debe seguir: dos documentos distintos con el mismo número es un problema de
auditoría que no tiene arreglo después.

## Las reglas de negocio viven en la base, no solo en la pantalla

Una validación en el servidor da un mensaje claro; la que impide de verdad es
la de Postgres (RLS, triggers, constraints). Cuando una regla importe, ponla en
los dos sitios y deja escrito en el comentario cuál es la barrera real.

## Nadie aprueba lo suyo

Ninguna persona aprueba su propia cotización, sea cual sea su rol — gerencia
incluida. La regla vive en `trg_cotizacion_transicion` (migración 0030), en
`aprobaciones.ts` y en la cola de la interfaz. Si vuelve a aparecer una
excepción por rango, es un error.
