# Inventario completo · Métrica Sistema Operativo

> **Para qué es este documento.** La ficha técnica describe cómo está construido
> el sistema y el manual explica cómo se usa. Este recoge lo que no cabía en
> ninguno de los dos: lo que se construyó en sesiones sueltas, lo que quedó a
> medias, lo que está pendiente y lo que solo estaba en la cabeza de quien lo
> hizo.
>
> Se escribe porque **lo que no está documentado se pierde**.

| | |
|---|---|
| Fecha | 4 de agosto de 2026 |
| Verificado contra | El repositorio y la base de datos de producción |
| Método | Lectura del código y consultas reales a Supabase, no memoria |

**Cómo se marca cada punto:**

| Marca | Significa |
|---|---|
| **INFORMATIVO** | Solo hay que saberlo. No requiere hacer nada |
| **REVISAR** | Alguien debería mirarlo y decidir. No urge |
| **ACCIÓN REQUERIDA** | Hay algo que hacer, y el documento dice qué |

---

## Índice

1. [Lo urgente, en una página](#1-lo-urgente-en-una-página)
2. [Módulos y pantallas que existen hoy](#2-módulos-y-pantallas-que-existen-hoy)
3. [Lo que se construyó sin haberse pedido explícitamente](#3-lo-que-se-construyó-sin-haberse-pedido-explícitamente)
4. [Lo que quedó a medias o desconectado](#4-lo-que-quedó-a-medias-o-desconectado)
5. [Deuda técnica y riesgos abiertos](#5-deuda-técnica-y-riesgos-abiertos)
6. [Datos de prueba en la base de producción](#6-datos-de-prueba-en-la-base-de-producción)
7. [Configuración y servicios externos](#7-configuración-y-servicios-externos)
8. [Conocimiento que no está escrito en ninguna otra parte](#8-conocimiento-que-no-está-escrito-en-ninguna-otra-parte)

---

## 1. Lo urgente, en una página

Cuatro cosas que conviene resolver antes de que el equipo empiece a usar el
sistema en serio. Cada una está desarrollada más abajo.

| # | Qué pasa | Marca | Quién lo arregla |
|---|---|---|---|
| 1 | **El monitor de normas legales no corre desde el 30 de julio**, y GitHub reporta éxito dos veces al día | ACCIÓN REQUERIDA | Cambio de una línea en el código |
| 2 | **La rama por defecto del repositorio no es `main`** | ACCIÓN REQUERIDA | Tú, desde GitHub |
| 3 | **El repositorio es público** | ACCIÓN REQUERIDA | Tú, desde GitHub |
| 4 | **El plan de Vercel prohíbe el uso comercial** | ACCIÓN REQUERIDA | Decisión de administración |

Ninguna de las cuatro ha causado pérdida de datos. La primera sí está causando
pérdida de servicio hoy mismo: el aviso de normas legales lleva cinco días sin
salir.

---

## 2. Módulos y pantallas que existen hoy

### 2.1 · El mapa completo de pantallas · INFORMATIVO

Todas las rutas que existen, tal como están en `src/app/`:

| Ruta | Qué es | Quién entra |
|---|---|---|
| `/login` | Botón **Entrar con Google**. Único punto de entrada | Cualquiera |
| `/auth/callback` | Recibe la vuelta de Google. No es una pantalla | — |
| `/elegir-rol` | Pregunta *¿Cuál es tu rol?* la primera vez | Quien no tiene fila en `usuarios` |
| `/acceso-denegado` | Dos mensajes según `?motivo=`: correo ajeno o cuenta de baja | — |
| `/` | **Selector de sistemas.** Cuatro tarjetas | Todos |
| `/panel` | *Actividad reciente*: últimas cotizaciones con código, cliente, proyecto, ejecutivo y estado | Todos |
| `/banco` | Rejilla de los códigos `COT` del año con su estado | Todos |
| `/cotizaciones` · `/nueva` · `/[id]` · `/[id]/pdf` | Listado, alta, detalle y descarga | Todos (cada quien lo suyo) |
| `/fichas` · `/[id]` · `/[id]/pdf` | Fichas de apertura | Todos (cada quien lo suyo) |
| `/aprobaciones` | Cola de una cotización a la vez | Administración y gerencia |
| `/ordenes` · `/[id]` · `/[id]/pdf` | ODA de proyecto | Administración y gerencia |
| `/ordenes/proveedores` · `/[id]` · `/[id]/pdf` | ODA-PROV, gasto de oficina | Administración y gerencia |
| `/control` | Tabla de control | Administración y gerencia |
| `/usuarios` | Alta, baja, roles, solicitudes y permisos | Solo gerencia |
| `/automatizaciones` | Panel del monitor e historial de corridas | Todos ven · solo gerencia administra |
| `/api/automatizaciones/normas-legales` | Endpoint `POST` que dispara una corrida | Cron con secreto, o gerencia |

**Un detalle de arquitectura que sorprende:** `/automatizaciones` vive **fuera**
del grupo `(app)`. No es un descuido — necesitaba su propia navegación en vez del
menú lateral de Cotizaciones. El costo es que no hereda el layout de allá, y con
él se perdía el proveedor de avisos; por eso tiene su propio
`src/app/automatizaciones/layout.tsx`, que existe solo para eso.

### 2.2 · El selector de sistemas y sus cuatro tarjetas · INFORMATIVO

Esta pantalla no está descrita en detalle en ningún otro documento. Son cuatro
tarjetas, y **dos de ellas no llevan a ninguna parte**:

| Tarjeta | Etiqueta | Qué hay detrás |
|---|---|---|
| **Sistema de Cotizaciones** | *Disponible* | Enlace real a `/panel`. Es el sistema completo |
| **Automatizaciones** | *Nuevo* | Enlace real a `/automatizaciones` |
| **Desarrollo Organizacional** | *Próximamente* · nota *"En camino"* | **Nada.** Un recuadro de borde punteado, sin enlace |
| **Nuevos sistemas** | *En construcción* · nota *"Reservado"* | **Nada.** Igual que el anterior |

Para que quede sin ambigüedad, porque la pregunta se hizo explícitamente:
**"Desarrollo Organizacional" y "Nuevos sistemas" son marcadores visuales y nada
más.** No hay ruta, ni tabla, ni código, ni siquiera un borrador. Son un `<div>`
con texto. La descripción que se lee en pantalla —*"Gestión del equipo y los
procesos internos de Métrica"*— es una intención, no una descripción de algo que
exista.

Se hicieron así a propósito: comunican que el ecosistema va a crecer sin prometer
una fecha. Pero si alguien pregunta cuándo entra Desarrollo Organizacional, la
respuesta honesta es que **no se ha empezado**. (Esa tarjeta se llamó *Recursos
Humanos* hasta el 4 de agosto de 2026.)

### 2.3 · El módulo de Automatizaciones, completo · INFORMATIVO

Es el módulo peor documentado de los tres, y el más frágil.

**Qué hace.** Dos veces al día lee las normas legales publicadas en el diario
oficial El Peruano, las compara con una lista de términos vigilados por cuenta de
cliente, y manda un correo interno con cada norma etiquetada según a quién
afecta.

**Las piezas:**

| Pieza | Dónde | Qué hace |
|---|---|---|
| Disparador | `.github/workflows/normas-legales.yml` | Un `curl` a las 13:00 y 23:00 UTC. **Solo dispara**, no trabaja |
| Endpoint | `src/app/api/automatizaciones/normas-legales/route.ts` | Autoriza y llama al monitor |
| Orquestación | `src/lib/normas-monitor.ts` | Los ocho pasos de una corrida |
| Lector | `src/lib/el-peruano.ts` | Habla con el buscador de El Peruano |
| Decodificador | `src/lib/turbo-stream.ts` | Escrito a mano. Ver §8 |
| Comparador | `src/lib/normas-coincidencias.ts` | Normaliza acentos y busca términos |
| Pantalla | `src/app/automatizaciones/page.tsx` | Panel e historial |

**El estado hoy, medido en la base:**

| | |
|---|---|
| Automatización | `normas_legales` · **encendida** · modo prueba **apagado** |
| Cuentas vigiladas | KALLPA (31 términos) y SPGL (25 términos) |
| Destinatarios | 5, todos activos y con acceso a **todas** las cuentas |
| Hallazgos guardados | 3 normas, con 6 etiquetas de cuenta entre ellas |
| Corridas registradas | **2**, las dos del 30 de julio |
| Última corrida | **30 de julio de 2026, 19:56 UTC** |

Los cinco destinatarios son `echavez@`, `edibos@`, `mjcamino@`, `ssaldana@` (todos
`metrica.pe`) y `pcaterianollosa@metricaperu.com`. **Ninguno es un cliente**, y la
base lo impide: un `CHECK` verifica que el dominio sea uno de los dos de Métrica.

> **Un detalle que parece un error y no lo es:** los términos **MINEM** y
> **OSINERGMIN** están en las listas de **las dos cuentas**, duplicados. Es
> deliberado: las dos cuentas siguen a los mismos reguladores, y el índice único
> de la tabla es *por cuenta* justamente para permitirlo. Si alguien "limpia" ese
> duplicado, una de las dos cuentas deja de recibir avisos del regulador.

### 2.4 · El módulo de ODA a proveedores · INFORMATIVO

Nació completo en una sola sesión y **no se conecta con nada** del resto del
sistema: `ordenes_proveedores` no tiene ni una clave foránea hacia cotizaciones,
fichas u órdenes de proyecto. Es intencional — paga el gasto de la casa, no el
del cliente.

Diferencias que conviene tener presentes:

- Su código **no sale del banco**. Usa un contador propio, `oda_prov_correlativo`,
  una fila por año. El banco se probó y se descartó.
- Tiene **monto mínimo** (S/ 700 · US$ 200, sin IGV) que las de proyecto no tienen.
- Tiene **botón Borrar**, que las de proyecto no tienen — y solo en borrador.
- Tiene **cláusulas de PDF propias**, distintas de las de proyecto.
- Desde el 4 de agosto guarda la **factura del proveedor**, que las de proyecto
  no tienen.
- `tipo_proveedor` significa **algo distinto** que en las de proyecto. Ver §5.

---

## 3. Lo que se construyó sin haberse pedido explícitamente

Todo esto existe y funciona. Se lista porque no se pidió por su nombre en ninguna
fase: salió de resolver un problema concreto o de una decisión tomada sobre la
marcha. Si mañana alguien se pregunta "¿y esto de dónde salió?", está acá.

### 3.1 · Piezas de infraestructura invisibles · INFORMATIVO

| Pieza | Por qué existe |
|---|---|
| **`src/lib/turbo-stream.ts`** | El buscador de El Peruano no devuelve JSON normal sino un formato de serialización de React Router v7: un arreglo plano con referencias por posición. No hay librería para eso en el servidor, así que se escribió el decodificador. **Lanza excepción a gritos** si el formato cambia, en vez de devolver una lista vacía que se confundiría con "hoy no hubo normas" |
| **`src/components/ui/Toast.tsx`** | Los avisos de "guardado" / "no se pudo". Nadie lo pidió; sin él, media aplicación falla en silencio |
| **`src/components/ui/SinScrollNumerico.tsx`** | Impide que la rueda del ratón cambie un número cuando el cursor pasa por encima de un campo. Un monto cambiado sin querer al hacer scroll es un error muy caro y muy difícil de notar |
| **`npm run predev`** | Un `npm install` automático antes de `npm run dev`. Evita el "a mí no me funciona" tras cambiar de rama |
| **`escaparHtml()`** en `correo.ts` | Los nombres de proyecto y las observaciones las escriben personas y van dentro del HTML de un correo. Un `<` suelto rompía el correo |
| **`remitenteValido()`** en `correo.ts` | Tolera las tres formas típicas de escribir mal `CORREO_REMITENTE` (con comillas de más, sin `<>`, solo el correo) y cae al remitente de pruebas antes que romper el envío |

### 3.2 · Decisiones del monitor de normas · INFORMATIVO

| Qué | Por qué se hizo |
|---|---|
| **Sinónimos por término** (migración `0025`) | Las normas dicen *"Organismo Supervisor de la Inversión en Energía y Minería"*, no *"OSINERGMIN"*. Sin sinónimos, la mitad de las coincidencias se perdían |
| **Modo prueba** | Para poder encender el monitor sin llenar de correos a cinco personas mientras se ajustan los términos |
| **Tabla puente `normas_legales_hallazgo_cuenta`** | Una misma norma puede tocar a KALLPA y a SPGL a la vez. Con una sola columna de cuenta habría que elegir una, y el correo mentiría |
| **Enviar primero y marcar después** | Si Resend falla, las normas quedan pendientes y la corrida siguiente las reintenta. Al revés se marcarían como avisadas sin que nadie las viera |
| **El correo incluye TODO lo pendiente**, no solo lo de hoy | Consecuencia de lo anterior: si el envío del martes falló, el miércoles llega lo de ambos días |
| **Historial visible para todo el equipo** (migración `0024`) | Esto sí se pidió. Se separó *ver* de *administrar*: cualquiera con rol comprueba que la tarea corrió; solo gerencia la toca |

### 3.3 · Decisiones de las ODA a proveedores · INFORMATIVO

| Qué | Por qué |
|---|---|
| **El mínimo en dólares es un número fijo (200), no una conversión** | El sistema no tiene tipo de cambio en ninguna parte. Convertir en vivo haría que una orden que ayer pasaba hoy se bloquee porque se movió el dólar |
| **El mínimo se mide sin IGV** | Con IGV, un proveedor con factura cruzaría el límite en S/ 593 y uno con recibo por honorarios necesitaría S/ 700: la misma compra permitida o bloqueada según qué comprobante emita |
| **Cláusulas de PDF propias** | Las de proyecto empiezan con *«Código 022 para servicios de influencers»*, que no viene al caso en una suscripción de software y —peor— sugiere consignar un código que puede no ser el correcto |
| **`ordenes_proveedores_borradas`** | Un archivo con la fila completa en JSON, quién borró y cuándo, por un disparador `BEFORE DELETE`. El propio archivo lleva `trg_no_borrar`, así que tampoco se puede vaciar |
| **La factura se edita desde la lista, no desde el detalle** | El trabajo es por lotes: llegan varias facturas juntas. Entrar y salir de diez órdenes para escribir dos datos es la fricción que hace que la gente termine llevando la cuenta en un Excel aparte |

### 3.4 · Decisiones de seguridad tomadas sobre la marcha · INFORMATIVO

| Qué | Por qué |
|---|---|
| **El permiso `puede_otorgar_gerencia` es un dato, no un correo en el código** | La migración `0013` tenía un correo personal escrito a mano dentro de una función y la `0017` tuvo que reemplazarlo. El día que esa persona no esté, este permiso se transfiere desde la pantalla y nadie toca código |
| **Migración `0035`, que nadie pidió** | La `0033` dejaba una puerta que se cierra desde adentro: quien tiene el permiso podía quitárselo a sí mismo. Si lo hacía sin habérselo pasado a nadie, el permiso desaparecía del sistema y volverlo a poner exigía otra migración |
| **La columna "Otorgar gerencia" en la tabla de Usuarios** | La `0033` prometía que el permiso se transfiere desde la pantalla, y la acción del servidor existía… sin ningún control que la llamara. Se conectó |
| **La franja amarilla de solicitud pendiente en todas las pantallas** | Sin ella, quien espera aprobación ve un menú incompleto y no sabe por qué. Lo natural es pensar que el sistema está roto |
| **Nadie aprueba lo suyo, gerencia incluida** (migración `0030`) | Esto sí se decidió explícitamente. Antes gerencia estaba exenta |
| **`CHECK` de dominio en los destinatarios del monitor** | Antes el sistema aceptaba cualquier correo y la garantía era la disciplina. Ahora la base impide agregar uno que no sea de Métrica |
| **Comparación en tiempo constante del `CRON_SECRET`** | Comparar con `===` se rinde en el primer carácter distinto, y esa diferencia de tiempo permite adivinar el secreto carácter por carácter |
| **El endpoint del cron responde 404 y no 401** cuando no autoriza | No hace falta confirmarle a nadie que esa ruta existe |
| **Es `POST` y no `GET`** | Un `GET` se dispara solo desde un prefetch del navegador, un rastreador o el previsualizador de enlaces de cualquier chat |

### 3.5 · Los scripts sueltos · REVISAR

`scripts/` tiene cinco archivos que **no forman parte de la aplicación** y no se
ejecutan nunca solos. Se corren a mano desde la máquina de quien desarrolla, y
todos leen las credenciales de un `.env.local` que no está versionado.

| Script | Qué hace | ¿Sigue sirviendo? |
|---|---|---|
| `backfill-fichas.mjs` | Creó las fichas de las cotizaciones aprobadas antes de que existiera la creación automática | **No.** Fue de una sola vez. Es idempotente, así que correrlo otra vez no rompe nada |
| `prueba-banco.mjs` | Prueba de concurrencia: dispara 6 tomas de código en paralelo entre dos usuarios y verifica que salgan 6 códigos distintos | Sí, pero **crea usuarios de autenticación temporales en producción** y los borra al final. Si falla a mitad, deja basura |
| `prueba-correo.mjs` | Diagnóstico de Resend de punta a punta | Sí. Útil el día que los correos dejen de llegar |
| `prueba-pdf.mts` | Genera un PDF de cotización de muestra | Sí, para revisar formato sin crear documentos reales |
| `prueba-pdf-oda-proveedor.mts` | Lo mismo para la ODA-PROV | Sí |

**REVISAR:** `prueba-banco.mjs` corre contra la base **de producción**. Conviene
dejarlo anotado, o mover esas pruebas a un proyecto Supabase aparte.

---

## 4. Lo que quedó a medias o desconectado

Nada de esto rompe el sistema. Es peso muerto que confunde a quien venga después.

### 4.1 · Código que nadie llama · REVISAR

| Qué | Dónde | Detalle |
|---|---|---|
| **`Proximamente`** | `src/components/ui/Proximamente.tsx` | Archivo completo sin usar. El selector de sistemas tiene su propio `TarjetaProximamente` local, y no importa este |
| **`tomarCodigo()`** | `src/actions/codigos.ts` | Archivo completo sin usar. Es una *server action* —o sea, un endpoint accesible— que solo hace un `redirect('/cotizaciones/nueva')`. Quedó de cuando el código se "tomaba" antes de crear la cotización; hoy se asigna al guardar |
| **`cciValido()`** | `src/lib/cci.ts` | Exportada y nunca llamada. Sí se usan `CCI_LARGO` y `soloDigitos` |
| **`normalizar()`, `textoBuscable()`, `coincidenciasDeNorma()`** | `src/lib/normas-coincidencias.ts` | Exportadas pero solo `filtrarRelevantes()` se importa desde fuera. Se expusieron para poder probarlas sueltas |

Ninguna es peligrosa. `tomarCodigo()` es la única que merece un vistazo, por ser
un endpoint vivo aunque inofensivo.

### 4.2 · Columnas que existen y nadie llena · INFORMATIVO

Medido en la base, no supuesto:

| Columna | Filas con dato | Por qué |
|---|---|---|
| `ordenes_adquisicion.cuenta_cci` | 0 de 4 | La migración `0012` la partió en `cuenta` y `cci`. Sobrevive por los registros antiguos |
| `ordenes_proveedores.descripcion` | 0 de 1 | El detalle vive en las líneas. La columna nunca se conectó a la pantalla |
| `normas_legales_cuentas.cliente_id` | 0 de 2 | Se dejó preparado para enlazar KALLPA y SPGL con la tabla `clientes`, y nunca se hizo. Hoy la cuenta vigilada y el cliente que se factura son dos mundos separados |
| `usuarios.puede_reactivar` | 0 de 6 | Nadie tiene el permiso. Gerencia puede reactivar igual, sin él |
| `usuarios.rol_otorgado_por` / `rol_otorgado_en` | 0 de 6 | Los seis usuarios son anteriores a la migración `0033`. Se llenará con los próximos |

### 4.3 · Funciones vivas pero revocadas · INFORMATIVO

`tomar_codigo()` y `tomar_codigo_oda()` siguen existiendo en la base, pero tienen
el `EXECUTE` revocado desde la migración `0021`. Quedaron obsoletas al mover la
asignación de correlativos dentro de las funciones de creación. Se dejaron por si
alguna migración vieja las referencia.

### 4.4 · Tablas vacías · INFORMATIVO

Vacías no siempre significa roto. La distinción importa:

| Tabla | Filas | ¿Es normal? |
|---|---|---|
| `control_proceso` | 0 | **Sí.** Las filas nacen al cerrar una ficha, y las cuatro fichas están en `lista_ejecutivo`, ninguna `completa`. La Tabla de control se ve vacía porque el proceso nunca llegó hasta ahí, no porque falle |
| `ficha_facturas_cliente` | 0 | Sí, por lo mismo |
| `ficha_proveedor_facturas` | 0 | Sí, por lo mismo |
| `ordenes_proveedores_borradas` | 0 | Sí. El archivo se creó el 3 de agosto y desde entonces no se ha borrado ninguna orden |
| `solicitudes_rol` | 0 | Sí. Se creó el 4 de agosto y todavía no ha entrado nadie nuevo |

**El punto que sí conviene entender:** el sistema **nunca se ha usado de punta a
punta**. Ninguna ficha se cerró, ninguna fila de control se creó, ninguna factura
se registró. Todo lo que existe llega hasta la mitad del recorrido.

### 4.5 · Tres números de ODA-PROV que se perdieron · REVISAR

El contador `oda_prov_correlativo` está en **1004**, pero solo existe una orden:
`ODA-PROV-2026-1001`. Las 1002, 1003 y 1004 se crearon y se borraron **antes** de
que existiera el archivo de borrados (migración `0031`, del 3 de agosto), así que
no queda rastro de qué eran.

No es un problema —los códigos no se reciclan, y la siguiente orden será la
1005— pero conviene saber que **el archivo de borrados tiene un punto ciego para
todo lo anterior al 3 de agosto**.

### 4.6 · Una columna con nombre de caso particular · REVISAR

La Tabla de control tiene una columna llamada **"Influencer"**. Es un rastro de
cuando el sistema se pensó para campañas de influencers. Hoy sirve para cualquier
proveedor, y ese encabezado va a confundir a quien registre una productora o un
corresponsal.

### 4.7 · Dependencias · INFORMATIVO

**No hay ninguna dependencia instalada sin usar.** Las ocho de producción tienen
uso real en `src/` o en `scripts/` (comprobado archivo por archivo); las ocho de
desarrollo son las herramientas de construcción —TypeScript, Tailwind, PostCSS,
ESLint y los tipos— y todas intervienen en el `build`.

Es una lista deliberadamente corta: **no hay librería de componentes, ni de
formularios, ni de estado, ni de fechas**. Todo eso está escrito a mano. Tiene un
costo —más código propio— y una ventaja para un sistema que debe durar: nada que
se abandone o cambie de licencia debajo.

---

## 5. Deuda técnica y riesgos abiertos

Ordenados por gravedad.

### 5.1 · 🔴 El monitor de normas se dispara pero no ejecuta nada · ACCIÓN REQUERIDA

**Los hechos, verificados los dos por separado:**

- GitHub Actions ejecutó la tarea **diez veces** desde el 31 de julio, dos por
  día, todas con conclusión `success`.
- La base registra **dos corridas**, ambas del 30 de julio, y ambas disparadas a
  mano desde la pantalla.

**La causa.** El intermediario de sesión (`src/proxy.ts`) intercepta todas las
rutas salvo `/login`, `/acceso-denegado` y `/auth`. La petición del cron no lleva
cookie de sesión, así que responde un **307 hacia `/login`** antes de que el
endpoint llegue a ejecutarse. El log de la Action lo dice literalmente:

```
Disparando: ***/api/automatizaciones/normas-legales
Redirecting...
Corrida solicitada.
```

Y `curl --fail-with-body` solo considera fallo un código 400 o superior. Un 307
pasa por bueno, y el paso sale verde.

**Por qué esto es peor que un fallo ruidoso.** El endpoint tiene su propia
autorización por `CRON_SECRET`, bien implementada, con comparación en tiempo
constante. Nunca llega a correr. Y el tablero de GitHub dice que todo está bien,
así que nadie va a mirar.

**La corrección:** agregar `/api/automatizaciones/normas-legales` a
`RUTAS_PUBLICAS` en `src/proxy.ts`. No debilita nada — la autorización real vive
en el endpoint, no en el intermediario.

**Y además,** para que un desvío futuro no vuelva a pasar por éxito: que la
Action verifique el código HTTP en vez de confiar en el código de salida de
`curl`.

**Mientras tanto:** el botón **Correr ahora** de la pantalla de Automatizaciones
sí funciona, porque va con sesión de navegador.

### 5.2 · 🔴 La rama por defecto del repositorio no es `main` · ACCIÓN REQUERIDA

`default_branch` es **`claude/pensive-franklin-dbrg7b`** (consultado al API de
GitHub el 4 de agosto).

Es el mismo error que ya costó horas con Vercel, ahora en GitHub. Consecuencias:

- **Las tareas programadas corren desde la rama por defecto**, no desde `main`.
  Hoy no rompe nada porque el archivo del workflow es idéntico en las dos, pero
  el día que difieran, `main` deja de mandar y nadie se entera.
- Cualquier PR nuevo apunta ahí por defecto.
- Quien clone el repositorio se lleva esa rama.

**Se corrige en** Settings → General → Default branch → `main`.

### 5.3 · 🔴 El repositorio es público · ACCIÓN REQUERIDA

`visibility: public`. Cualquiera puede leer el código completo, las migraciones,
el RUC de Métrica, los nombres de los clientes y las reglas de negocio.

**Lo que sí está bien:** **no hay ninguna credencial dentro.** Se verificó —
`.gitignore` cubre `.env*`, no hay archivos de entorno versionados, y lo único
que aparece son *nombres* de variables. Las llaves viven en Vercel y en los
secretos de GitHub.

Aun así, para el sistema operativo interno de una agencia es exposición
innecesaria. **Se corrige en** Settings → General → Change visibility → Private.
Es gratis en cuentas personales.

### 5.4 · 🔶 El plan de Vercel prohíbe el uso comercial · ACCIÓN REQUERIDA

Desarrollado en la §8 de la ficha técnica. En resumen: el plan **Hobby** está
reservado a proyectos personales, Vercel puede suspender el proyecto sin aviso
previo, y la migración a **Pro** son US$ 20 al mes por asiento de desarrollador —
los usuarios del sistema **no** cuentan como asientos.

No se perderían datos: viven en Supabase, que está en un plan de pago apropiado.
Sería una interrupción de servicio.

### 5.5 · 🔶 Las cláusulas tributarias del PDF sin confirmar · ACCIÓN REQUERIDA

`src/config/oda-proveedores.ts` lleva un aviso escrito en el propio código:

> ⚠️ REVISAR CON CONTABILIDAD antes de darlas por definitivas.

Se ajustó lo que claramente no correspondía —quitar el «Código 022 para
influencers» de una suscripción de software— pero **lo tributario debe
confirmarlo quien lleva los libros**. En concreto, las seis cláusulas de la
ODA-PROV y en particular:

- la mención genérica al régimen de detracciones,
- la retención de cuarta categoría en Recibos por Honorarios.

Las cláusulas de la ODA de proyecto (`src/config/oda.ts`) mencionan un **8 %** de
retención de cuarta categoría. Ese porcentaje **no está verificado contra la
normativa vigente** en ningún punto de este proyecto.

### 5.6 · 🟡 Una función sin `search_path` · REVISAR

`trg_codigo_anulado_es_final` es la única de las 20 funciones del sistema sin
`SET search_path`, y el linter de Supabase la marca. El riesgo es bajo porque es
`SECURITY INVOKER`: corre con los privilegios de quien la llama, sin elevación.
Las 15 `SECURITY DEFINER` sí lo tienen todas.

### 5.7 · 🟡 Avisos del linter que NO son un problema · INFORMATIVO

Se dejan escritos porque van a volver a aparecer y alguien va a asustarse:

**"Public Can Execute SECURITY DEFINER Function"** sobre `trg_usuarios_control_de_rol`,
`trg_cotizacion_transicion`, `trg_solicitud_no_propia` y
`trg_archivar_oda_prov_borrada`. El linter avisa de que son invocables como RPC.
**Se probó: no lo son.** PostgreSQL las rechaza con
`trigger functions can only be called as triggers`. Es ruido del linter, no una
puerta abierta.

**"Leaked Password Protection Disabled"** en Supabase Auth. No aplica: **el
sistema no tiene contraseñas.** Se entra solo con Google.

### 5.8 · 🟡 Copias de seguridad · REVISAR

Supabase está en plan **Pro**, que incluye copias diarias con retención de 7
días. El complemento **PITR** (recuperación a un punto en el tiempo) **está
pendiente de confirmar** si se contrató. Sin PITR, la peor pérdida posible es de
un día de trabajo.

### 5.9 · 🟡 El duplicado CENTENARIO / CENTERNARIO · REVISAR

Dos clientes que parecen el mismo con distinta grafía y **RUC distintos**:

| Nombre comercial | Razón social | RUC |
|---|---|---|
| CENTENARIO | CENTENARIO | 20567387456 |
| CENTERNARIO | CENTENARIO | 20875478382 |

No se tocó. Antes de unificarlos hay que revisar si alguno tiene cotizaciones
colgando — hoy ninguno las tiene, así que el momento de arreglarlo es ahora.

### 5.10 · 🟡 Un RUC con 10 dígitos · REVISAR

**NATURA** tiene el RUC `2053697854`: **diez dígitos**. Un RUC peruano tiene
once. Los otros ocho clientes tienen once.

El sistema no valida el largo del RUC de un cliente en ninguna parte. Ese número
se imprime en el PDF de la cotización tal cual.

---

## 6. Datos de prueba en la base de producción

Todo el contenido de la base fue creado durante el desarrollo. **No hay ninguna
operación comercial real registrada de punta a punta.** Esto es lo que se puede
limpiar y lo que conviene conservar.

### 6.1 · Usuarios · INFORMATIVO · no tocar

Seis, todos reales, y `auth.users` coincide exactamente con la tabla `usuarios`:

| Correo | Rol | Último ingreso |
|---|---|---|
| `ssaldana@metrica.pe` | gerencia · **con permiso de otorgar gerencia** | 3 ago |
| `kmurguia@metrica.pe` | admin | 15 jul |
| `lsanchezv@metrica.pe` | admin | 16 jul |
| `facturas@metrica.pe` | admin | 30 jul |
| `achavez@metrica.pe` | ejecutivo | 16 jul |
| `varana@metrica.pe` | ejecutivo | 16 jul |

**Ojo con `facturas@metrica.pe`:** es a la vez un usuario con rol de
administración y el buzón al que las cláusulas del PDF piden enviar las facturas.
Vale la pena decidir si debe ser una cuenta con acceso al sistema o solo un buzón.

### 6.2 · Proveedores · ACCIÓN REQUERIDA · son todos inventados

Los cinco tienen **exactamente la misma marca de tiempo de creación**
(`2026-06-10 18:38:38`), nombres de fantasía y RUC secuenciales inventados:

`JMA Influencers Connect`, `Productora Lima Films`, `Foto Estudio Norte`,
`Plaza Eventos`, `Carla Quispe — Fotógrafa`.

Son semilla de demostración. **Ninguno es un proveedor real de Métrica.** Se
pueden borrar cuando el equipo vaya a empezar en serio, siempre que ninguna ficha
los referencie.

### 6.3 · Clientes · REVISAR · mezcla

De los nueve, unos parecen reales y otros inventados:

| Probablemente reales | Probablemente inventados |
|---|---|
| Interbank, Banco Falabella, Mitsubishi Motors Perú, NATURA *(con el RUC mal)* | CAASA `20100123456`, H&M Perú `20543219876`, KIA Motors `20501234567` — RUC con pinta de secuencia |
| | CENTENARIO y CENTERNARIO, el duplicado |

### 6.4 · Documentos · REVISAR

| Documento | Qué es | Veredicto |
|---|---|---|
| `COT-2026-0001` "Corresponsa" | Aprobada, KIA, varana@ | Prueba. El nombre está cortado |
| `COT-2026-0002` "CAMPAÑA PUBLICIDAD TIKTOK" | Aprobada, NATURA, kmurguia@ | Podría ser real |
| `COT-2026-0003` "iyiyyi" | Aprobada, CAASA, kmurguia@ | Prueba evidente |
| `COT-2026-0007` "Campaña Fiestas Patrias" | Aprobada, Mitsubishi, achavez@ | Podría ser real |
| `FA-COT-2026-0001/2/3/7` | Las cuatro fichas, todas en `lista_ejecutivo` | Siguen a sus cotizaciones |
| `ODA-2026-1001` | Emitida · Hanna Agency · RUC 20606570296 | Parece real |
| `ODA-2026-1002` | Borrador · "jose chacaayan" | Prueba |
| `ODA-2026-1003` | Borrador · **sin razón social** | Prueba a medio llenar |
| `ODA-2026-1004` | Borrador · **sin razón social, RUC "141441"** | Prueba a medio llenar |
| `ODA-PROV-2026-1001` | Emitida · METRICA S.A. · US$ 3 089,95 · vinculadas · creada por kmurguia@ | **Real.** No tocar |

**Banco de códigos:** `COT` 46 disponibles / 4 en uso · `ODA` 46 / 4.

### 6.5 · Archivos en Storage · INFORMATIVO

Tres cajones privados, ninguno público:

| Cajón | Archivos | Peso |
|---|---|---|
| `cotizaciones` | 19 | 208 kB |
| `ordenes` | 10 | 142 kB |
| `fichas` | 7 | 82 kB |

Hay más PDF que documentos porque cada reemisión genera uno nuevo. Son todos de
prueba salvo los de `ODA-2026-1001` y `ODA-PROV-2026-1001`.

### 6.6 · Cómo se limpiaría, si se decide · INFORMATIVO

**No hay forma de hacerlo desde la aplicación**, y es a propósito: `trg_no_borrar`
impide borrar cotizaciones, fichas, órdenes, usuarios y solicitudes **incluso con
la llave privilegiada**. Vaciar la base para arrancar limpio exige deshabilitar
esos disparadores a mano, borrar, y volver a habilitarlos.

Es una operación deliberadamente incómoda. Si se va a hacer, que sea **una sola
vez y antes de que el equipo empiece**, no como costumbre.

---

## 7. Configuración y servicios externos

Material para `PLAN_CONTINUIDAD.md`. **Nombres de variables únicamente, ningún
valor.**

### 7.1 · Servicios conectados · ACCIÓN REQUERIDA

| Servicio | Para qué | Plan | Titularidad |
|---|---|---|---|
| **Supabase** | Base de datos, login y archivos. PostgreSQL 17.6, región `sa-east-1` | **Pro** *(verificado)* | Organización **"ssaldana-metrica's Org"** ⚠️ |
| **Vercel** | Publicación web. Proyecto `metrica-sistema`, región `gru1` | **Hobby** ⚠️ | Por confirmar |
| **GitHub** | Repositorio + tareas programadas | Gratuito | Cuenta personal `ssaldana-metrica` ⚠️ |
| **Resend** | Correos internos | Por confirmar | Por confirmar |
| **Google Cloud / OAuth** | Inicio de sesión | Gratuito | Por confirmar |
| **El Peruano** | Fuente del monitor. Sin cuenta ni contrato: se lee su buscador público | — | — |

**ACCIÓN REQUERIDA · La titularidad está a nombre de una persona, no de la
empresa.** Los dos que se pudieron verificar lo confirman: la organización de
Supabase se llama literalmente *"ssaldana-metrica's Org"* y la cuenta de GitHub
es una cuenta personal, no una organización. Todo el sistema de Métrica cuelga
de cuentas de un colaborador.

Migrar a una organización es gratis en GitHub y resuelve de una vez la
titularidad y los permisos del equipo. En Supabase la organización se puede
renombrar y transferir.

> **Un detalle menor pero desconcertante:** el proyecto de Supabase **no se llama
> `metrica-sistema` sino `metrica-login`**. Es un nombre heredado de cuando solo
> resolvía el inicio de sesión. Quien busque el proyecto por el nombre del
> sistema no lo va a encontrar.

### 7.2 · Variables de entorno · INFORMATIVO

Ocho, todas usadas realmente en el código. Se configuran en el panel de Vercel:

| Variable | Sensible | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Dirección del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Llave pública. Viaja al navegador; es segura porque RLS decide qué ve cada quien |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔒 **Sí** | **Salta RLS por completo.** Solo servidor |
| `RESEND_API_KEY` | 🔒 **Sí** | Envío de correos |
| `CRON_SECRET` | 🔒 **Sí** | Contraseña compartida con GitHub Actions |
| `CORREO_REMITENTE` | No | Desde qué dirección salen los correos |
| `CORREO_PRUEBAS` | No | Redirige **todos** los correos a una dirección. Si está puesta en producción, nadie recibe nada |
| `URL_SISTEMA` | No | Dirección pública. Se usa en los enlaces de los correos |

**Secretos del repositorio de GitHub** (Settings → Secrets → Actions), necesarios
para la tarea programada: `URL_SISTEMA` y `CRON_SECRET`.

**Los scripts de `scripts/`** leen las credenciales de un `.env.local` local que
**no está versionado**. Quien tome el proyecto necesita que alguien se lo pase.

### 7.3 · Estado del correo · REVISAR

El código está escrito para funcionar en dos modos, y hay que saber en cuál está:

- **Modo pruebas** — mientras el dominio `metrica.pe` no esté verificado en
  Resend, el remitente es `onboarding@resend.dev` y Resend **solo entrega al
  correo con el que se registró la cuenta**. Con `CORREO_PRUEBAS` definida, todo
  se redirige ahí con un aviso en el cuerpo.
- **Modo normal** — con el dominio verificado: se define `CORREO_REMITENTE` y se
  **quita** `CORREO_PRUEBAS`.

**REVISAR:** conviene confirmar en Vercel si `CORREO_PRUEBAS` sigue definida. Si
lo está, ningún correo del sistema está llegando a su destinatario real.

---

## 8. Conocimiento que no está escrito en ninguna otra parte

Lo que se aprendió construyendo y se perdería si nadie lo anotara.

### 8.1 · De dónde salen los datos de El Peruano · INFORMATIVO

**No hay API pública.** El buscador `busquedas.elperuano.pe` es una aplicación
React Router v7: su HTML llega vacío. Lo que sí devuelve datos es la ruta gemela:

```
/_root.data?ci=all&fecha=AAAAMMDD&tipoPublicacion=NL
```

Los tres parámetros importan:

- `ci=all` — sin esto no devuelve publicaciones.
- `fecha` — formato `AAAAMMDD`, hora de Lima.
- `tipoPublicacion=NL` — el filtro que de verdad funciona.

> **La trampa que costó tres diagnósticos equivocados:** existe un parámetro
> `rubro=NL` que el servidor **acepta y devuelve en el eco de parámetros, pero
> ignora**. Sigue entregando el Boletín Oficial completo. Parece que funciona
> porque el parámetro aparece en la respuesta. **No usarlo.**

**Volumen real:** un día hábil trae unas 7 normas legales, frente a ~573
publicaciones sin filtrar, casi todas sucesiones intestadas del Boletín. Por eso
se trae el día completo y se filtra en el servidor, en vez de lanzar una búsqueda
por término.

**La respuesta no es JSON.** Es *turbo-stream*: un arreglo plano donde los
valores se referencian por posición. Hubo que escribir el decodificador
(`src/lib/turbo-stream.ts`).

**Esto es frágil por naturaleza.** Se lee un formato interno, no un contrato.
Puede cambiar sin aviso. Por eso todas las validaciones **lanzan excepción** en
lugar de devolver una lista vacía: una lista vacía se confundiría con "hoy no se
publicó nada relevante", y el monitor callaría justo cuando falla.

### 8.2 · La normalización de acentos tiene una excepción · INFORMATIVO

Al comparar términos se quitan los acentos, para que *"energia"* encuentre
*"energía"*. Pero **la virgulilla de la ñ se conserva a propósito**: sin esa
excepción, *"año"* y *"ano"* serían la misma palabra.

Está implementado con un rango Unicode explícito que **salta el `U+0303`**, la
virgulilla combinante:

```js
new RegExp('[\\u0300-\\u0302\\u0304-\\u036f]', 'g')
```

Y está escrito **como cadena de escapes, no como literal**, a propósito: los
caracteres combinantes escritos directamente en el código son invisibles en el
editor y nadie puede verificar que estén bien. Si alguien "simplifica" esto a un
literal, la próxima persona no podrá revisarlo.

### 8.3 · Por qué la región de Vercel es `gru1` · INFORMATIVO

São Paulo, la más cercana a Perú de las disponibles. Y hay una razón más
importante: **la lectura de El Peruano se verificó desde ahí**. Los runners de
GitHub salen por otra red y no se comprobó que El Peruano los atienda igual — por
eso la Action solo dispara y todo el trabajo se queda en Vercel.

### 8.4 · El IGV lo decide el comprobante, no el proveedor · INFORMATIVO

Una factura lleva IGV; un Recibo por Honorarios no. El campo *tipo de proveedor*
(empresa / persona natural) es **informativo** y ya no decide nada.

Se cambió porque la regla anterior era incorrecta: una persona natural con RUC
puede emitir factura.

### 8.5 · "Tipo de proveedor" significa dos cosas distintas · REVISAR

Es la trampa número uno para quien mantenga esto:

| En | Significa |
|---|---|
| `ordenes_adquisicion.tipo_proveedor` | *empresa* / *persona natural* |
| `ordenes_proveedores.tipo_proveedor` | El rubro del gasto: *suscripciones*, *corresponsales*, *vinculadas*, *servicios de oficina*, *otros*, *bienes* |

Mismo nombre, mismo tipo de dato, significados sin relación. Está avisado con un
⚠️ en la cabecera de la migración `0026`. Renombrar el segundo a *rubro del
gasto* resolvería la confusión de raíz.

### 8.6 · El historial de desincronizaciones · INFORMATIVO

Ya ocurrió tres veces que "la verdad" estuviera en tres sitios distintos. Vale la
pena conocer el patrón, porque se repite:

1. **Julio 30–31.** Cuatro migraciones aplicadas a producción cuyos archivos
   vivían en una rama sin fusionar: Supabase con 31, `main` con 27, y la rama que
   Vercel desplegaba con 27 más un commit propio. De ahí salió que anular una ODA
   de proveedores fallara en producción, porque el código consultaba una tabla que
   la migración `0028` había eliminado.
2. **La rama de producción de Vercel** apuntaba a una rama `claude/*` en vez de a
   `main`. Fusionar a `main` no desplegaba nada y el trabajo parecía perdido.
   Tomó horas descubrirlo.
3. **La rama por defecto de GitHub** sigue apuntando a una rama de trabajo. Es la
   §5.2 de este documento, todavía abierta.

La regla que salió de ahí está escrita en `AGENTS.md`: **el archivo de la
migración va a `main` antes o junto con aplicarla, nunca después.**

### 8.7 · Cómo se verificó todo lo que se dice verificado · INFORMATIVO

No por lectura de código. Con **sesiones simuladas** contra la base de
producción:

```sql
set local role authenticated;
set local request.jwt.claims = '{"email":"alguien@metrica.pe"}';
```

Y siempre en los dos sentidos: que la barrera **bloquee** a quien debe bloquear,
y que el **camino legítimo siga funcionando**. Una prueba que solo comprueba lo
primero no distingue una regla bien puesta de una que rompió la aplicación.

### 8.8 · Cosas pequeñas que van a hacer dudar a alguien · INFORMATIVO

- **`FA-COT-...` no es un código nuevo.** La ficha deriva su código del de su
  cotización anteponiendo `FA-`. Se hizo así para que la relación se lea a simple
  vista sin consultar el sistema.
- **`ODA-PROV` no toca el banco de códigos.** Se intentó y se descartó: usa un
  contador propio de una fila por año.
- **`oda_prov_correlativo` no tiene ninguna política de escritura.** Solo de
  lectura, y solo para admin y gerencia. Moverlo es exclusivo de
  `crear_orden_proveedor()`. Fue un agujero real hasta la migración `0029`.
- **El botón Borrar de una ODA-PROV emitida no aparece deshabilitado: no
  aparece.** Un botón apagado invita a preguntarse cómo encenderlo.
- **Los correos jamás salen a un cliente.** Todos son internos entre cuentas de
  Métrica. El PDF al cliente lo manda una persona, a mano.
- **Un usuario dado de baja a mitad de sesión queda fuera de inmediato.** Su
  login de Google sigue vivo, pero su fila en `usuarios` deja de responder.
- **El límite de líneas** es 40 en una cotización y 60 en una orden.

---

*Documento generado el 4 de agosto de 2026 a partir del repositorio y de
consultas a la base de datos de producción. Como el resto de la documentación,
vive junto al código: si algo no coincide con la realidad, el desactualizado es
el documento.*
