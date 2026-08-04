# Manual de usuario · Sistema Operativo Métrica

> Este manual explica **qué tocar para hacer tu trabajo** y qué hacer cuando
> algo no sale como esperabas. No explica cómo funciona el sistema por dentro.
>
> Busca tu rol en el índice y ve directo ahí. No hace falta leerlo entero.
>
> Si lo que buscas es cómo está construido, eso está en
> `ARQUITECTURA_SISTEMA.md`; `INVENTARIO_COMPLETO.md` reúne lo pendiente y
> `PLAN_CONTINUIDAD.md` es para gerencia. Ninguno hace falta para trabajar.

---

## Antes de empezar

### Qué es este sistema

Es la herramienta donde vive todo el recorrido de una compra en Métrica: desde
que cotizas un trabajo para un cliente hasta que se le paga al proveedor que lo
hizo. Cada documento nace del anterior y arrastra su número, así que en
cualquier momento se puede saber de dónde salió cada cosa. Reemplaza las hojas
de cálculo sueltas y los correos de "¿en qué quedó esto?".

### Cómo entrar

1. Abre **https://metrica-sistema.vercel.app** en tu navegador.
2. Pulsa **Entrar con Google**.
3. Elige tu correo de Métrica.

[CAPTURA: pantalla de inicio de sesión con el botón "Entrar con Google"]

Tiene que ser tu correo **@metrica.pe** o **@metricaperu.com**. Un Gmail
personal no entra, aunque sea tuyo.

**La primera vez** te va a preguntar *¿Cuál es tu rol?* con dos opciones:
**Ejecutivo** y **Administración**. Elige la que te corresponde y pulsa **Entrar
al sistema**.

[CAPTURA: pantalla "¿Cuál es tu rol?" con las dos opciones]

Lo que pasa después depende de lo que elegiste:

- **Ejecutivo** → entras de una vez, con todo lo de tu rol disponible.
- **Administración** → entras igual, pero **como Ejecutivo mientras gerencia
  revisa tu pedido**. Desde el primer minuto puedes cotizar y llenar tus fichas;
  lo único que todavía no puedes hacer es aprobar cotizaciones.

Mientras esperas vas a ver **una franja amarilla arriba de todas las pantallas**
que te recuerda que tu solicitud está pendiente. No es un error ni algo que
tengas que arreglar: es para que sepas por qué te falta una sección del menú.

[CAPTURA: franja amarilla de "Tu solicitud del rol Administración está pendiente de aprobación"]

Cuando gerencia decida, **te llega un correo** y la franja desaparece sola. Si
te la aprobaron, recarga la página y ya ves las secciones nuevas.

> **Nadie se concede a sí mismo el permiso de aprobar.** Es a propósito: quien
> aprueba un gasto no puede ser también quien decidió que podía aprobarlo.

Si te equivocaste de opción, avísale a gerencia: lo corrige desde el módulo de
Usuarios en un clic.

### Si te dice que no puedes entrar

Hay dos mensajes distintos y significan cosas diferentes:

| Lo que dice la pantalla | Qué pasó | Qué hacer |
|---|---|---|
| **Acceso denegado** | Entraste con un correo que no es de Métrica | Cierra sesión de Google, vuelve y elige tu correo de trabajo |
| **Acceso dado de baja** | Tu cuenta fue desactivada por gerencia | Avisa a gerencia para que te reactive |

Si sale **No pudimos completar el ingreso**, es un problema momentáneo:
inténtalo de nuevo.

### Lo primero que ves: el selector de sistemas

Después de entrar **no caes directo en el sistema**, sino en una pantalla que te
deja elegir. Hoy hay dos disponibles:

- **Sistema de Cotizaciones** — todo el ciclo de compras. Es al que entras casi
  siempre.
- **Automatizaciones** — las tareas que corren solas. Solo gerencia administra
  aquí, pero todos pueden mirar.

Los otros dos (*Desarrollo Organizacional* y *Nuevos sistemas*) todavía no
existen.

[CAPTURA: selector de sistemas con las cuatro tarjetas]

Si más adelante quieres volver a esta pantalla, pulsa el logo de Métrica arriba
a la izquierda, donde dice **cambiar sistema**.

### El menú, sección por sección

| Sección | Para qué sirve | Quién la ve |
|---|---|---|
| **Panel** | Resumen: cotizaciones del mes, códigos disponibles, pendientes de aprobar | Todos |
| **Banco de códigos** | Los números de cotización del año y cuáles están libres | Todos |
| **Cotizaciones** | Crear y consultar cotizaciones | Todos |
| **Fichas de apertura** | Los procesos que nacieron de cotizaciones aprobadas | Todos |
| **Aprobaciones** | La cola de cotizaciones por revisar | Administración y gerencia |
| **Órdenes (ODA)** | Las órdenes de compra. Se despliega en *Proyectos* y *Proveedores* | Administración y gerencia |
| **Tabla de control** | Seguimiento de facturación y cobranza | Administración y gerencia |
| **Usuarios** | Quién tiene acceso y con qué rol | Solo gerencia |

Si no ves alguna sección, no es un error: es que tu rol no la tiene.

[CAPTURA: menú lateral completo, visto por una cuenta de gerencia]

### Los tres roles

**Ejecutivo** — Cotizas trabajos para tus clientes y llenas la parte comercial
de cada proceso. Ves solo lo tuyo.

**Administración** — Revisas y apruebas las cotizaciones de todos, generas las
órdenes de compra y llevas el seguimiento de facturación y cobranza.

**Gerencia** — Todo lo de administración, más gestionar usuarios y las
automatizaciones.

---

# Parte 1 · Si eres EJECUTIVO

## 1.1 · Antes de cotizar: mira el banco de códigos

Entra a **Banco de códigos**. Ahí ves todos los números de cotización del año y
cuáles están libres.

No tienes que apuntar ninguno ni reservarlo: **el sistema te asigna el siguiente
disponible solo**, en el momento de crear la cotización. El banco es para mirar,
no para elegir.

[CAPTURA: banco de códigos, con códigos disponibles y algunos ya en uso]

## 1.2 · Crear una cotización

1. Ve a **Cotizaciones**.
2. Pulsa el botón de nueva cotización.
3. Llena la parte de arriba:

| Campo | Qué poner |
|---|---|
| **Cliente** | Elígelo de la lista. Si no está, usa **＋ Registrar cliente nuevo…** |
| **Proyecto / Servicio** | El nombre del trabajo. Ej. *Campaña Día de la Madre* |
| **Moneda** | **Soles (PEN)** o **Dólares (USD)** |
| **Fee de intermediación (%)** | El porcentaje que cobra Métrica |
| **Fecha de envío al cliente** | Opcional, se puede completar luego |
| **Nota (opcional)** | Un comentario que verá el cliente. Si lo dejas vacío, no aparece en el PDF |

[CAPTURA: formulario de nueva cotización con los datos del cliente y el proyecto]

### Las líneas de proveedores

Abajo agregas una línea por cada cosa que vas a comprar:

- **Proveedor** — quién lo provee
- **Descripción** — el servicio o entregable
- **Cant.** — cuántas unidades
- **P. unit.** — el precio de cada una

Los totales se calculan solos mientras escribes. Vas a ver cuatro cifras:

| | Qué es |
|---|---|
| **Subtotal proveedores** | La suma de todas las líneas |
| **Monto neto** | El subtotal más el fee de Métrica |
| **IGV (18%)** | El impuesto |
| **Total** | Lo que paga el cliente |

[CAPTURA: tabla de líneas de proveedores con los cuatro totales calculados abajo]

## 1.3 · Guardar borrador o enviar a aprobación

Son dos cosas distintas:

**Guardar como borrador** — la cotización queda tuya, la puedes seguir editando
cuando quieras. Nadie más la ve todavía. Úsalo si te falta un precio o estás
esperando confirmación de un proveedor.

**Enviar a aprobación** — se la mandas a administración para que la revise.
**Desde ese momento ya no la puedes editar** hasta que te respondan.

Úsalo solo cuando esté completa.

## 1.4 · Qué pasa después de enviarla

Tu cotización entra a la cola de administración. Alguien de ese equipo la va a
revisar y puede hacer dos cosas: aprobarla o devolvértela con un comentario.

**En ambos casos te llega un correo.** No tienes que estar revisando la pantalla.

## 1.5 · Si te la devuelven observada

Significa que algo hay que corregir. No es un rechazo: es un "arregla esto y
vuelve a mandarla".

1. Abre la cotización.
2. Arriba vas a ver el recuadro **Observación de administración:** con el motivo
   escrito por quien la revisó.
3. Corrige lo que te piden.
4. Pulsa **Reenviar a aprobación**.

**Conserva el mismo código.** Una cotización observada no se convierte en otra
distinta: sigue siendo la misma, con su mismo número, solo que corregida.

[CAPTURA: cotización observada, con el recuadro del motivo visible arriba]

## 1.6 · Cuando te la aprueban

Te llega un correo con el **PDF de la cotización** adjunto. Ese es el documento
que le mandas al cliente.

Y pasa algo más, automáticamente: **nace la ficha de apertura**. No tienes que
crearla. Ya está esperándote en **Fichas de apertura**, con el mismo número que
tu cotización pero empezando en `FA-`.

Si tu cotización fue la `COT-2026-0007`, su ficha es la `FA-COT-2026-0007`.

## 1.7 · Llenar tu parte de la ficha de apertura

Entra a **Fichas de apertura** y abre la tuya. Hay tres bloques que te tocan:

### Datos del cliente

**Cliente**, **Razón social**, **RUC**, **Contacto de aprobación**, **Correo del
contacto** y **Facturación (opcional)**.

### Datos del servicio

**Fecha de emisión**, **Inicio de acciones**, **Fin de acciones**, **Moneda
general**, **Política de pago** y **Observaciones (opcional)**.

[CAPTURA: ficha de apertura, bloques "Datos del cliente" y "Datos del servicio"]

### Proveedores que cobran

Aquí va la lista de a quiénes hay que pagarles. Pulsa **+ Agregar proveedor**
por cada uno y llena: **Agencia**, **RUC**, **Banco**, **Cuenta** y **Email**.

> ### ⚠️ Importante: estos proveedores NO vienen de la cotización
>
> Aunque en la cotización ya escribiste proveedores, **acá los escribes de
> nuevo, desde cero**. No es un descuido del sistema.
>
> La razón es simple: **quien cobra no siempre es quien cotizaste**. Cotizaste a
> un influencer y factura su agencia. Cotizaste "productora" en general y al
> final contrataste a una específica. Lo de la cotización es una estimación
> comercial; lo de la ficha es a quién se le va a girar el dinero de verdad.

[CAPTURA: bloque "Proveedores que cobran" con una fila llena y el botón "+ Agregar proveedor"]

Guarda con **Guardar** las veces que necesites. Puedes volver mañana.

## 1.8 · Marcar "Mi parte está lista"

Cuando terminaste de llenar todo, pulsa **Mi parte está lista**.

Eso le avisa a administración que ya pueden seguir. Vas a ver el mensaje *"Tu
parte quedó lista. Administración hará el seguimiento."*

**Desde ese momento la ficha pasa a ser solo lectura para ti.** Si te falta
corregir algo, pídele a administración que la reabra.

[CAPTURA: botón "Mi parte está lista" al pie de la ficha]

## 1.9 · Encontrar tus cotizaciones y fichas

En **Cotizaciones** y en **Fichas de apertura** ves las tuyas. Arriba tienes:

- **Filtros por estado** — Todas, Borrador, Pendiente, Aprobada, Observada,
  Anulada
- **Un buscador** — escribe el código, el cliente o el proyecto y pulsa
  **Buscar**

Tú ves **solo lo tuyo**. Donde administración lee *"Todas las cotizaciones de la
agencia"*, tú lees *"Tus cotizaciones"*.


## 1.10 · Lo que no puedes hacer, y por qué

| No puedes | Por qué |
|---|---|
| Aprobar cotizaciones | El control es que las revise otra persona |
| Ver las cotizaciones de otros ejecutivos | Cada uno ve su cartera |
| Generar o emitir órdenes de compra | Es trabajo de administración |
| Ver la tabla de control | Ídem |
| Editar una cotización enviada o aprobada | Se congela para que no cambie después de revisada |
| Editar tu ficha después de marcarla lista | Ídem — pide que la reabran |

No es desconfianza: es que cada documento tenga un responsable claro y que nadie
firme solo.

---

# Parte 2 · Si eres ADMINISTRACIÓN

## 2.1 · La cola de aprobaciones

Entra a **Aprobaciones**. El sistema te muestra **una cotización a la vez**, con
su vista previa completa: cliente, proyecto, líneas y totales.

Al resolverla, **pasa sola a la siguiente**. No tienes que volver a la lista.
Cuando no quede ninguna, vas a ver *Bandeja vacía*.

[CAPTURA: cola de aprobaciones con una cotización en pantalla y su vista previa]

## 2.2 · Aprobar una cotización

Pulsa **Aprobar y generar PDF**. En un solo paso ocurren cuatro cosas:

1. Se genera el **PDF** con el formato de Métrica.
2. Se le manda **por correo al ejecutivo** que la creó.
3. **Nace la ficha de apertura** automáticamente.
4. Te queda un enlace para descargar el PDF tú también.

Ningún correo del sistema va al cliente. El PDF se lo manda el ejecutivo.

## 2.3 · Devolver una cotización

Si algo está mal, pulsa **Devolver al ejecutivo**.

Te va a pedir que escribas el **motivo**. Escríbelo concreto: el ejecutivo lo va
a leer tal cual y es lo único que tiene para saber qué corregir.

- ❌ *"Revisar"*
- ✅ *"El RUC del proveedor 2 no corresponde. Confirmar con el cliente si el fee es 12% o 15%."*

El ejecutivo recibe un correo, corrige y la reenvía **con el mismo código**.

## 2.4 · Por qué no puedes aprobar tu propia cotización

Si tú creaste una cotización, **no puedes aprobarla tú mismo**. La tiene que
aprobar otra persona de administración o gerencia.

Es el control de cuatro ojos: quien pide el gasto no es quien lo autoriza. **No
tiene excepciones — tampoco para gerencia.**

En la práctica no te estorba: **tus propias cotizaciones no entran a tu cola.**
El sistema las salta y te muestra la siguiente que sí puedes resolver. Arriba te
avisa en amarillo cuántas hay tuyas esperando a que las vea alguien más.

[CAPTURA: aviso amarillo que dice cuántas cotizaciones tuyas hay en la cola]

## 2.5 · Completar tu parte de la ficha de apertura

Cuando el ejecutivo marca su parte como lista, te toca a ti. Abre la ficha y
verás dos bloques que son tuyos:

### Seguimiento del cliente

Las facturas que Métrica le emite al cliente. Con **+ Agregar factura del
cliente** puedes poner varias: **N° factura al cliente**, **OC del cliente**,
**HES** y **Total**.

### Seguimiento por proveedor

Por cada proveedor: **N° ODA**, **N° factura** y los datos de pago.

Guarda con **Guardar seguimiento**.

[CAPTURA: bloques "Seguimiento del cliente" y "Seguimiento por proveedor"]

## 2.6 · Cerrar la ficha

Cuando el seguimiento está completo, pulsa **Cerrar ficha y generar PDF**.

**Solo se puede cerrar después de que el ejecutivo marcó su parte como lista.**
Si el botón no te deja, es porque él todavía no lo hizo.

Al cerrarla se genera el PDF de la ficha y queda como **Completa**, en solo
lectura.

### Si hay que corregir algo después

Tienes dos botones distintos y **no hacen lo mismo**:

| Botón | Qué hace | Cuándo usarlo |
|---|---|---|
| **Corregir seguimiento (sin avisar)** | Reabre la ficha **sin avisar al ejecutivo** | Te equivocaste tú en el seguimiento |
| **Devolver la ficha al ejecutivo** | Reabre y **le manda un correo al ejecutivo** | Necesitas que él corrija su parte |

Si usas el segundo, escribe qué debe corregir. Ejemplo del propio sistema:
*"Corrige el RUC del proveedor 2 y vuelve a marcar tu parte como lista."*

## 2.7 · Generar una orden de adquisición

Dentro de la ficha, en el bloque de cada proveedor, tienes **+ Generar ODA**.

Es **un botón por proveedor**: si la ficha tiene tres proveedores, generas tres
órdenes distintas, cada una con su propio código.

[CAPTURA: bloque de un proveedor dentro de la ficha con el botón "+ Generar ODA"]

Al pulsarlo se crea la orden y te lleva a ella. Trae ya cargados los datos que
había en la ficha, pero **hay campos que tienes que completar tú**:

| Campo | Nota |
|---|---|
| **Razón social (nombre legal)** | El nombre exacto con el que factura |
| **Nombre comercial** | Si se deja vacío, usa el nombre legal |
| **Tipo de proveedor** | **Empresa** o **Persona natural** |
| **Tipo de comprobante** | **Factura (con IGV)** o **Recibo por Honorarios (sin IGV)** |
| **Condiciones de pago** | Ej. *50% adelanto, 50% contra entrega* |
| **Banco**, **Cuenta**, **CCI**, **Email del proveedor** | Datos de pago |

> **El tipo de comprobante decide el IGV.** Factura suma 18%; recibo por
> honorarios no. Si eliges mal, el total del PDF sale mal.

### Las líneas de compra

Con **+ Detalle de compra** agregas una línea por concepto: descripción,
cantidad y precio unitario. El total se calcula solo.

[CAPTURA: editor de la orden con el detalle de compra y los totales]

Guarda con **Guardar cambios** cuando quieras. Sigue siendo borrador.

## 2.8 · Emitir la orden

Cuando esté completa, pulsa **Emitir y generar PDF**.

**Después de emitir, la orden queda fija.** Ya no se puede editar. Se genera el
PDF que se le manda al proveedor y aparece el botón **Descargar PDF**.

Si te falta la razón social, el RUC o al menos una línea con monto, el sistema
te lo dice antes de dejarte emitir.

### Si hay que corregir una orden ya emitida

Pulsa **Reabrir**. Vuelve a borrador, la corriges y la emites de nuevo. El PDF
anterior queda obsoleto y se regenera al volver a emitir.

## 2.9 · Anular una orden

Se anula cuando la orden ya salió y hay que dejarla sin efecto. Te pide el
**motivo**, que queda registrado.

**El código anulado no se reutiliza nunca.** No se recicla para otra orden.

---

## 2.10 · Las órdenes a proveedores (ODA-PROV)

> **Esta es la parte que más se confunde. Léela completa aunque tengas prisa.**

En el menú, **Órdenes (ODA)** se despliega en dos:

[CAPTURA: menú con "Órdenes (ODA)" desplegado mostrando "Proyectos" y "Proveedores"]

### La diferencia en una frase

**Proyectos** paga cosas del cliente. **Proveedores** paga cosas de Métrica.

### La diferencia con detalle

| | **Proyectos** | **Proveedores** |
|---|---|---|
| Código | `ODA-2026-1001` | `ODA-PROV-2026-1001` |
| ¿De dónde sale? | De una ficha de apertura | **De cero**, con un botón |
| ¿Quién paga al final? | El cliente, se le factura | **Métrica**, es gasto propio |
| Ejemplos | Producción de reels, honorarios de influencer | Suscripción de software, corresponsal, servicios de oficina |
| ¿Aparece en la tabla de control? | Sí | **No** |
| Monto mínimo | No tiene | **S/ 700 · US$ 200** |

**La prueba para saber cuál usar:** pregúntate *¿esto se lo voy a cobrar a un
cliente?*

- **Sí** → es de Proyectos, y tiene que nacer de una ficha.
- **No, lo paga Métrica** → es de Proveedores.

### Crear una orden a proveedores

1. Ve a **Órdenes (ODA) → Proveedores**.
2. Pulsa **+ Nueva ODA**.
3. Se crea al instante con su código y te lleva a ella.

[CAPTURA: lista de órdenes a proveedores, con el botón "+ Nueva ODA" y la fila de filtros por tipo de proveedor]

Llenas todo a mano, porque no hay ficha de donde heredar nada. El campo que
distingue este módulo es:

**Tipo de proveedor** — aquí NO es *Empresa / Persona natural*. Es en qué se
gasta:

- Suscripciones
- Corresponsales
- Vinculadas
- Servicios de oficina
- Otros
- Bienes

> ⚠️ **Ojo:** en las ODA de Proyectos, el campo *Tipo de proveedor* significa
> otra cosa (Empresa o Persona natural). Mismo nombre, distinto significado
> según en qué módulo estés.

### El monto mínimo

Estas órdenes **se emiten desde S/ 700** (o **US$ 200** si es en dólares), **sin
contar el IGV**.

Por debajo de eso el botón de emitir queda apagado y aparece un aviso amarillo
diciéndote cuánto suma y cuánto falta. Puedes guardarla como borrador igual,
pero no emitirla.

[CAPTURA: editor de ODA-PROV con el aviso amarillo del monto mínimo]

### Registrar la factura del proveedor

Cuando el proveedor manda su factura, se anota en la propia lista de órdenes,
sin entrar a cada una. En la columna **Factura del proveedor** vas a ver:

- **+ Registrar** si todavía no tiene nada anotado.
- El número y la fecha si ya se cargó, así: `F001-00123` y debajo *recibida
  03-ago*.

Pulsa ahí, escribe el **número de la factura** y la **fecha en que la
recibiste**, y dale a **Guardar**. Si te equivocaste, pulsa de nuevo y corrígelo.

[CAPTURA: columna "Factura del proveedor" abierta para editar, con los dos campos y los botones Guardar y Cancelar]

Tres cosas que conviene saber:

- **Solo se puede en órdenes emitidas.** En un borrador no hay nada que
  facturar todavía, así que la columna aparece con un guion.
- **La fecha sin número no se guarda.** Primero el número; la fecha sola
  describiría una factura que no existe.
- **Si la orden se anula después, la factura se conserva** y se sigue viendo.
  Esconderla taparía justo lo que más interesa al revisar una anulación.

El sistema guarda por dentro quién cargó cada factura y cuándo, aunque eso no se
muestre en la tabla.

**Para saber qué falta:** filtra por **Emitidas** y mira qué filas siguen con
*+ Registrar*. Esas son las órdenes que salieron y todavía no tienen su
comprobante.

### Buscar y filtrar

Arriba tienes filtros por estado (**Todas**, **Borrador**, **Emitidas**,
**Anuladas**) y, debajo, una fila de **Tipo de proveedor** para ver solo un
rubro. Se combinan entre sí y con el buscador.


## 2.11 · Borrar o anular una orden a proveedores

Son dos botones distintos, para dos situaciones distintas:

| | **Borrar** | **Anular** |
|---|---|---|
| Qué hace | Desaparece del sistema | Queda visible, marcada como anulada |
| Cuándo se puede | **Solo si está en borrador** | En cualquier momento |
| Pide motivo | No | **Sí** |
| Cuándo usarlo | La creaste por error y nunca salió | Ya salió al proveedor y hay que dejarla sin efecto |

**Si la orden ya está emitida, el botón Borrar no aparece.** No es una falla: es
que una orden que ya salió no se hace desaparecer, se anula dejando constancia.

En los dos casos, **el número no se reutiliza**.

Hay un tercer botón que solo sale en las emitidas: **Reabrir**. Devuelve la orden
a borrador para corregirla y volver a emitirla, con el mismo número. Mientras
esté en borrador no se puede tocar su factura — vuelve a poderse al emitirla de
nuevo.

## 2.12 · La tabla de control

Es la vista de seguimiento de todos los procesos, uno por línea. Reúne en una
sola pantalla lo que está repartido entre fichas y órdenes:

**Inicio**, **Término**, **Cliente**, **Agencia**, **Influencer**, **Proyecto**,
**N° Ficha**, **N° ODA**, **Factura prov.**, **Factura cliente**, **OC/OS
cliente**, **F. facturación**, **F. cobro**, **Política de pago** y **Estado**.

Sirve para responder de un vistazo: qué está facturado, qué está cobrado y qué
sigue abierto.

[CAPTURA: tabla de control con varias filas y sus columnas de seguimiento]

## 2.13 · Anular un proceso completo

> ### 🛑 Esta es la acción más grave del sistema. Léela dos veces.

Desde la tabla de control, el botón **Anular** no anula una sola cosa: **anula
el proceso entero de un golpe.**

En una sola acción quedan anuladas:

- La **cotización** y su código
- La **ficha de apertura**
- **Todas las órdenes** de ese proceso y sus códigos

Te pide un **motivo obligatorio**, y queda registrado quién lo hizo.

**Ningún código anulado se reutiliza.** Esos números quedan quemados para
siempre.

Úsalo solo cuando el trabajo entero se cayó. Si lo que se cae es una sola orden,
anula esa orden, no el proceso.

[CAPTURA: tabla de control con el botón "Anular proceso" y el campo de motivo]

Si te equivocas, **existe forma de revertirlo** — pero solo gerencia puede.
Avísale de inmediato.

---

# Parte 3 · Si eres GERENCIA

Puedes hacer **todo lo de administración**, sin ninguna limitación… con una
excepción importante:

> **Tampoco puedes aprobar tus propias cotizaciones.** El control de cuatro ojos
> no tiene excepciones por cargo. Si cotizas algo, lo aprueba otra persona.

Además tienes tres cosas que nadie más:

## 3.1 · Gestionar usuarios

Entra a **Usuarios**. Ves a todo el que tiene acceso, con su rol y si está
activo.

### Aprobar una solicitud de rol

Cuando alguien nuevo entra y elige **Administración**, no se lo lleva solo: entra
como Ejecutivo y su pedido queda esperándote. **Te llega un correo** en el
momento, y en la pantalla de Usuarios aparece **un bloque amarillo arriba de la
tabla** con las solicitudes pendientes.

[CAPTURA: bloque amarillo de solicitudes pendientes, con el nombre, el correo, el rol pedido y los botones Aprobar y Rechazar]

De cada solicitud ves quién la pide, con qué correo, qué rol pide y desde
cuándo. Dos botones:

- **Aprobar** — le concede el rol al instante. Le llega un correo avisándole.
- **Rechazar** — la persona sigue como Ejecutivo, que es un rol de trabajo
  completo. También le llega un correo, redactado sin dramatismo.

El bloque **solo aparece si hay algo pendiente**. Si no ves nada, es que no hay
nada que resolver.

> **No puedes resolver tu propia solicitud.** Si por lo que sea aparece una a tu
> nombre, en vez de los botones vas a leer *"Es tu solicitud · la resuelve otra
> persona"*. Lo mismo vale si intentaras hacerlo por fuera de la pantalla: la
> base de datos lo rechaza.

Aprobada o rechazada, **la decisión queda registrada** con tu nombre y la fecha.
Si dentro de un año se vuelve a pedir lo mismo, las dos decisiones constan.

### Cambiar el rol de alguien

Elige el rol nuevo en su fila. Es inmediato.

**No puedes cambiar tu propio rol** — para que nadie se deje a sí mismo sin
acceso por error.

### Nombrar a otra gerencia

El rol de **Gerencia** no aparece en la lista de roles de la tabla salvo que
tengas el permiso para concederlo. Es un permiso aparte del rol: toda gerencia
resuelve solicitudes de Administración, pero **solo quien tiene el permiso puede
crear más gerencias** — o quitarle el rol a una que ya existe.

El permiso se ve y se mueve en la columna **Otorgar gerencia** de la tabla. En
cada fila dice **Sí, puede ✓** o **No**; si tú lo tienes, esos textos son botones
y basta con pulsarlos.

> **En tu propia fila el texto no es un botón.** Nadie cambia su propio permiso,
> ni siquiera quien lo tiene. Si te lo quitaras sin habérselo pasado a nadie,
> el permiso desaparecería del sistema y recuperarlo exigiría tocar la base de
> datos. Para transferirlo hacen falta dos personas: tú se lo das a alguien, y
> esa persona te lo retira a ti.

Consecuencia práctica: **si quien lo tiene deja la empresa, tiene que pasárselo
a alguien antes de irse.**

[CAPTURA: columna "Otorgar gerencia" en la tabla de Usuarios, con una fila en "Sí, puede ✓" y otra en "No"]

### Dar de baja a alguien que sale de la empresa

Pulsa **Dar de baja** en su fila. Desde ese momento no puede entrar, ni siquiera
si su sesión estaba abierta.

> **Su histórico se conserva completo.** Las cotizaciones que hizo, las fichas
> que llenó y las órdenes que emitió siguen ahí, con su nombre. Dar de baja
> quita el acceso, no borra el pasado.

Si vuelve, **Reactivar** le devuelve el acceso.

**No puedes darte de baja a ti mismo.**

[CAPTURA: módulo de Usuarios con la lista, los roles y el botón "Dar de baja"]

### El permiso de reactivar anulaciones

En la misma pantalla puedes darle a alguien el permiso de **reactivar procesos
anulados**. Por defecto nadie lo tiene, y gerencia siempre puede hacerlo sin
importar el permiso.

## 3.2 · Las automatizaciones

Entra a **Automatizaciones** desde el selector de sistemas.

### Qué es el monitor de normas legales

Dos veces al día —a las 8 de la mañana y a las 6 de la tarde— el sistema lee las
normas legales publicadas en el diario oficial El Peruano. Busca las que
mencionan temas de los clientes vigilados y manda un correo con cada norma
etiquetada según a quién afecta.

Hoy vigila dos cuentas: **KALLPA** y **SPGL**. Una misma norma puede llevar las
dos etiquetas.

> ⚠️ **Al 4 de agosto de 2026 el monitor no está corriendo solo.** La tarea
> programada se dispara puntualmente dos veces al día y GitHub la reporta como
> exitosa, pero la petición no llega a ejecutarse: el guardián de sesión del
> sistema la desvía antes. Desde el 30 de julio no se ha enviado ningún aviso.
> El botón **Correr ahora** de esta pantalla sí funciona. Está documentado con
> el diagnóstico y la corrección en `INVENTARIO_COMPLETO.md`.

### El panel de la automatización

Arriba ves si está **Encendida** o **Apagada**, si está en **Modo prueba**, y
cuándo corrió por última vez.

[CAPTURA: panel del monitor de normas legales con los interruptores y la última corrida]

**Correr ahora** — la ejecuta en el momento, sin esperar la hora. El botón
cambia a *Revisando El Peruano…* mientras trabaja.

**Automatización encendida** — el interruptor principal. Apagada no revisa nada
ni manda correos, aunque llegue la hora.

**Modo prueba** — mientras esté encendido, **los avisos te llegan solo a ti** y
la lista de destinatarios ni se consulta. Sirve para probar sin molestar a
nadie. Apágalo cuando quieras que llegue a todos.

### Quién recibe los avisos

En **Quién recibe los avisos** administras la lista.

- Para agregar: escribe el correo, opcionalmente el nombre, elige si recibe
  **Todo** o **Solo KALLPA** / **Solo SPGL**, y pulsa **Agregar**.
- **Pausar** deja de mandarle avisos sin sacarlo de la lista. **Reanudar** lo
  vuelve a activar.
- **Eliminar** lo saca del todo. Pide confirmación y te sugiere Pausar si solo
  querías una pausa.

> Solo se pueden agregar correos **@metrica.pe** y **@metricaperu.com**. El
> sistema no deja poner uno de fuera — estos avisos no salen de la empresa.

### Qué se vigila

En **Qué se vigila** están las palabras que disparan un aviso, agrupadas por
cuenta. Agregas escribiendo en la caja de esa cuenta, y quitas con la **×** de
cada etiqueta.

Algunas tienen un **+2** al lado: son sinónimos. Pasa el cursor por encima para
verlos. Por ejemplo *OSINERGMIN* también detecta *"Organismo Supervisor de la
Inversión en Energía y Minería"*, que es como El Peruano lo escribe de verdad.

[CAPTURA: bloque "Qué se vigila" con los términos de KALLPA y SPGL]

### El historial de corridas

Abajo están las últimas 15 ejecuciones, con cuántas normas se revisaron y
cuántas resultaron relevantes. Los resultados posibles:

| Dice | Significa |
|---|---|
| **Aviso enviado** | Encontró normas y mandó el correo |
| **Sin novedades** | Revisó y no había nada relevante. Todo bien |
| **Con error** | Algo falló. El motivo aparece debajo |
| **Interrumpida** | Empezó y no terminó. Avisa si se repite |

**Todo el equipo puede ver este historial**, aunque solo tú lo administras. Así
cualquiera confirma que la tarea está corriendo.

## 3.3 · Reactivar un proceso anulado

Si se anuló un proceso por error, **Reactivar proceso** lo revierte: la
cotización, la ficha y todas sus órdenes vuelven al estado exacto que tenían
antes.

Solo tú puedes hacerlo, o alguien a quien le hayas dado ese permiso en Usuarios.

**Qué implica.** Los códigos que habían quedado anulados vuelven a estar en uso
— pero **vuelven al mismo documento que siempre los tuvo**. Nunca se le entrega
un número usado a un documento distinto.

Úsalo cuando la anulación fue un error. Si el proceso de verdad se cayó, déjalo
anulado.

---

# Preguntas frecuentes

**No puedo entrar, me dice acceso denegado.**
Mira cuál de los dos mensajes es. Si dice *Acceso denegado*, entraste con un
correo que no es de Métrica: cierra sesión de Google y vuelve con el de trabajo.
Si dice *Acceso dado de baja*, tu cuenta fue desactivada y tienes que avisarle a
gerencia.

**No veo una sección que otro sí ve.**
Tu rol no la incluye. Los ejecutivos no ven Aprobaciones, Órdenes ni Tabla de
control; solo gerencia ve Usuarios. Si crees que te falta acceso, pídeselo a
gerencia.

**Elegí Administración al entrar, pero no veo Aprobaciones.**
Mira si arriba tienes una franja amarilla: tu solicitud está esperando a
gerencia. Mientras tanto trabajas como Ejecutivo, que es un rol completo —
puedes cotizar y llenar tus fichas con normalidad. Cuando la resuelvan te llega
un correo; recarga la página y aparecen las secciones nuevas.

**Se me fue un dato mal en una cotización que ya está aprobada.**
No la puedes editar tú. Pídele a administración que la devuelva; la corriges y
la reenvías con el mismo código.

**Anulé algo por error.**
Avisa a gerencia de inmediato. Si fue un proceso completo, se puede reactivar
desde la tabla de control. Cuanto antes, mejor.

**No me llegó el correo.**
Revisa primero la carpeta de spam. Si no está ahí, entra al sistema: si la
cotización figura como aprobada, el PDF se puede descargar desde ahí. El correo
es una comodidad, no el único camino.

**El PDF no se descarga.**
Comprueba que la cotización esté aprobada o la orden emitida — antes de eso el
PDF no existe todavía. Si el documento está anulado, su PDF ya no es válido y el
sistema no lo entrega. Si nada de eso aplica, recarga la página e inténtalo otra
vez.

**¿Puedo cambiar el código de una cotización?**
No. El código se asigna solo al crearla y no se puede modificar ni reutilizar.
Es lo que permite rastrear un documento años después.

**¿Qué pasa si dos personas cotizamos al mismo tiempo?**
Nada. El sistema entrega los números de uno en uno: si dos personas crean una
cotización en el mismo segundo, una recibe un número y la otra el siguiente.
Nunca el mismo.

**Se me fue el internet a mitad de un formulario.**
Lo que no habías guardado se pierde. Vuelve a entrar y revisa qué quedó: si
habías pulsado **Guardar**, está ahí. Costumbre útil: en formularios largos,
guarda cada tanto.

**¿Los clientes reciben algún correo del sistema?**
No, nunca. Todos los correos son internos entre cuentas de Métrica. El PDF al
cliente se lo manda una persona.

---

# Si algo falla

## Qué mirar primero

1. **Recarga la página.** Resuelve la mayoría de los casos raros.
2. **Revisa tu conexión.** Sin internet el sistema no guarda nada.
3. **Confirma con qué correo entraste.** Arriba a la derecha aparece tu nombre.
   Si no es tu cuenta de Métrica, sal y vuelve a entrar.
4. **Prueba en otra pestaña.** Si llevas horas con la misma abierta, tu sesión
   puede haber caducado.

## Qué anotar antes de pedir ayuda

Sin estos tres datos, quien te ayude va a tener que adivinar:

1. **Qué estabas haciendo.** "Intentaba emitir una orden", no "no funciona".
2. **El mensaje exacto que salió.** Cópialo tal cual o toma una captura.
3. **El código del documento.** `COT-2026-0007`, `ODA-PROV-2026-1003`.

Y si puedes, la hora aproximada.

## A quién avisar

A **Sergio Saldaña** — `ssaldana@metrica.pe`.

Escríbele con los tres datos de arriba. Con eso normalmente basta; sin eso, lo
primero que va a hacer es pedírtelos.

Si lo que pasó tiene que ver con **dinero, un documento ya emitido o una
anulación**, avisa de inmediato aunque no tengas los tres datos completos. Esos
casos se resuelven mejor cuanto antes.

---

# Observaciones para mejorar la experiencia

Lo que noté al recorrer el sistema. **No son fallas** — funciona todo — pero
son puntos donde alguien nuevo se puede trabar.

### 1 · "Tipo de proveedor" significa dos cosas distintas

En las ODA de **Proyectos** es *Empresa / Persona natural*. En las de
**Proveedores** es el rubro del gasto (*Suscripciones*, *Corresponsales*…).
Mismo nombre, distinto significado según el módulo.

Alguien que trabaje en los dos va a dudar. Podría llamarse *Rubro del gasto* en
el módulo de proveedores.

### 2 · El botón "Borrar" desaparece sin explicar por qué

En una ODA a proveedores emitida, el botón **Borrar** simplemente ya no está.
Es la decisión correcta, pero alguien que lo usó ayer en un borrador va a
buscarlo y no lo va a encontrar, sin saber si es un error suyo.

Un texto breve —*"Las órdenes emitidas se anulan, no se borran"*— ahorraría la
consulta.

### 3 · El selector de sistemas sorprende al entrar

Después del login no caes en el sistema sino en una pantalla que te deja elegir.
Tiene sentido a futuro, pero hoy que solo hay uno operativo es un clic extra que
la gente no espera.

### 4 · Los mensajes de error aparecen arriba en formularios largos

En la ficha y en las órdenes, si falta un dato el aviso sale al principio del
formulario. Si estabas abajo, en el botón de emitir, puedes no verlo y pensar
que no pasó nada.

### 5 · Los estados se llaman distinto según dónde los mires

El ejecutivo pulsa **Mi parte está lista**; la ficha pasa a un estado que la
tabla de control muestra con otras palabras. Es el mismo momento del proceso
nombrado de dos maneras, y complica ponerse de acuerdo al hablar por teléfono.

---

### Dos observaciones que ya se resolvieron

Estaban en la primera versión de este manual y se corrigieron en el mismo
trabajo. Se dejan anotadas para que quede el registro de qué cambió.

**Cualquiera elegía su rol al entrar por primera vez.** Un colaborador nuevo
podía darse **Administración** por su cuenta y aprobar cotizaciones sin que
nadie lo autorizara. Ahora quien elige Administración entra como Ejecutivo y
gerencia resuelve la solicitud (ver *Cómo entrar* y *3.1 · Gestionar usuarios*).

**Dos botones llamados "Reabrir" hacían cosas distintas.** En la ficha convivían
*Reabrir para administración* y *Reabrir y avisar*, uno al lado del otro. Ahora
se llaman **Corregir seguimiento (sin avisar)** y **Devolver la ficha al
ejecutivo**: el nombre dice qué hace cada uno sin tener que recordarlo.
