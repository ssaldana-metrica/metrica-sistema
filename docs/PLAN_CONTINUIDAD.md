# Plan de continuidad y gobernanza · Métrica Sistema Operativo

> | | |
> |---|---|
> | **Última revisión** | **4 de agosto de 2026** |
> | Responsable de mantenerlo | *Pendiente de definir · ver §11* |
> | Próxima revisión | *Pendiente de definir · ver §11* |

---

## 1. Para qué sirve este documento

Este documento responde a una sola pregunta: **si Sergio Saldaña no está mañana,
¿qué hace Métrica con este sistema?** No explica cómo está construido —eso está
en `ARQUITECTURA_SISTEMA.md`— ni cómo se usa —eso está en `MANUAL_USUARIO.md`—.
Es el documento que se abre el día en que la persona que construyó el sistema no
está disponible, y lo van a leer dos tipos de persona: gerencia, que necesita
decidir, y un desarrollador externo, que necesita entender qué recibió.

**Se lee en una emergencia, así que un dato desactualizado acá hace daño real.**
Donde aparece **[VERIFICAR]** es porque el dato no se pudo comprobar desde el
código ni desde la base: hay que mirarlo en el panel del servicio y escribirlo.
**Hay 24 marcas de esas, y cada una dice exactamente dónde mirar.** Mientras
estén sin llenar, este documento está incompleto.

Cuatro de ellas están marcadas **IMPORTANTE** o **CRÍTICO** porque no son solo
datos que faltan: son cosas que podrían estar rotas ahora mismo sin que nadie lo
sepa. Si solo se revisan cuatro, que sean esas.

---

## 2. El riesgo en una página

### El sistema está construido a medida y hoy depende de una persona

No es un producto comprado. Son **15 227 líneas de código** repartidas en 96
archivos, más **35 migraciones** que definen la base de datos. Lo escribió y lo
opera una sola persona. Nadie más en Métrica lo ha tocado.

### La titularidad de las cuentas es personal, no institucional

Esto no es una sospecha, está verificado:

| Servicio | Lo que dice el sistema, literalmente |
|---|---|
| **GitHub** | El repositorio cuelga de `ssaldana-metrica`, una **cuenta personal**, no una organización. **Colaboradores: uno.** Nadie más tiene acceso al código |
| **Supabase** | La organización se llama **"ssaldana-metrica's Org"** |

**Métrica, como empresa, no es dueña de nada de esto hoy.** Es dueña de sus
datos —eso es distinto y se explica abajo— pero no de las cuentas que los alojan.

### Qué pasa en la práctica

| Si Sergio… | Consecuencia |
|---|---|
| **No está disponible una semana** | El sistema **sigue funcionando solo**. Nadie puede desplegar cambios, arreglar un fallo ni dar de alta a un usuario nuevo que necesite rol de administración |
| **Pierde el acceso a su correo** | Se cae la recuperación de las cinco cuentas a la vez. Los servicios siguen corriendo, pero **nadie puede entrar a administrarlos**. Salir de ahí requiere soporte de cada proveedor, con pruebas de titularidad que Métrica no tiene porque las cuentas no están a su nombre |
| **Sale de la empresa en malos términos** | El peor escenario. Sin transferencia previa, Métrica queda sin control administrativo sobre el sistema que corre su ciclo de compras. Los datos se pueden recuperar; el control de las cuentas, no necesariamente |
| **Sale de la empresa en buenos términos** | Un día de trabajo de transferencia y el problema desaparece. Ver §4 |

La diferencia entre las dos últimas filas es **hacer la transferencia antes de
necesitarla**. Es la recomendación central de este documento.

### Qué NO está en riesgo

Conviene dimensionarlo bien, porque el riesgo es de **control**, no de
**información**:

- **Los datos están completos y son exportables.** La base entera pesa **14 MB**
  y los archivos guardados **432 kB** en 36 PDF. Todo eso sale con dos comandos
  (§9). No hay nada atrapado en un formato propietario.
- **Supabase está en plan de pago (Pro)**, con copias de seguridad diarias. La
  información no vive en el plan gratuito de nadie.
- **El código es Métrica.** Está en un repositorio que hoy es incluso público, de
  modo que "perder el código" no es un escenario posible.
- **Nada de esto es urgente hoy.** El sistema funciona. Lo que se está gestionando
  es la probabilidad de un problema futuro, no un incendio actual.

---

## 3. Inventario de cuentas y servicios

Semáforo de titularidad: 🔴 personal · 🟡 por confirmar · 🟢 institucional.

### 🔴 GitHub — el código y la tarea programada

| | |
|---|---|
| **Para qué** | Guarda todo el código y las migraciones. Además ejecuta la tarea programada que dispara el monitor de normas legales |
| **Titular hoy** | Cuenta **personal** `ssaldana-metrica`. **Un solo colaborador**, rol admin *(verificado)* |
| **Si se pierde el acceso** | El sistema **sigue funcionando** — Vercel ya tiene desplegado lo último. Pero no se puede publicar ningún cambio ni corregir ningún fallo. La tarea programada se detiene |
| **Para transferir** | Transferir el repositorio a una organización de GitHub. Ver §4.1 |
| **Costo** | Gratuito. Una organización también es gratuita |
| **Además** | El repositorio es **público** hoy. Ver §10 |

### 🔴 Supabase — la base de datos, el login y los archivos

| | |
|---|---|
| **Para qué** | Es donde vive **toda la información**: cotizaciones, fichas, órdenes, usuarios y los PDF. También resuelve el inicio de sesión con Google |
| **Titular hoy** | Organización **"ssaldana-metrica's Org"**, plan **pro** *(verificado)*. Proyecto `metrica-login`, región `sa-east-1`, PostgreSQL 17.6.1 |
| **Si se pierde el acceso** | **El más grave de los seis.** El sistema deja de funcionar por completo: sin base no hay nada. Y sin acceso al panel no se pueden sacar copias ni exportar |
| **Para transferir** | Renombrar la organización y transferir el proyecto, o invitar a la cuenta institucional como propietaria. Ver §4.2 |
| **Costo** | Plan Pro. **[VERIFICAR: el costo mensual real en Supabase → Organization → Billing, y si hay complementos contratados. El plan base ronda los US$ 25/mes]** |
| | **[VERIFICAR: quiénes son los miembros de la organización, en Organization → Team. Si aparece una sola persona, esa es la confirmación de que no hay respaldo]** |
| | **[VERIFICAR: a nombre de quién está el método de pago, en Billing → Payment methods]** |
| | **[VERIFICAR: si el complemento PITR está contratado, en Project Settings → Add-ons. Sin él, la peor pérdida posible es de un día. Con él se recupera a cualquier minuto, pero cuesta del orden de US$ 100/mes: es una decisión de costo-beneficio, no un descuido]** |

> **Un detalle que confunde en una emergencia:** el proyecto de Supabase **no se
> llama `metrica-sistema` sino `metrica-login`**, nombre heredado de cuando solo
> resolvía el inicio de sesión. Quien lo busque por el nombre del sistema no lo
> va a encontrar.

### 🟡 Vercel — donde está publicada la web

| | |
|---|---|
| **Para qué** | Sirve la aplicación en `https://metrica-sistema.vercel.app` y ejecuta toda la lógica del servidor |
| **Titular hoy** | **[VERIFICAR: quién es el propietario de la cuenta y del proyecto, en Vercel → Settings → General]** |
| **Si se pierde el acceso** | El sistema **deja de ser accesible** para el equipo. Los datos siguen intactos en Supabase. Reconstruirlo en otra cuenta es cuestión de horas si se tienen las variables de entorno; sin ellas, hay que recuperarlas una por una de cada servicio |
| **Para transferir** | Transferir el proyecto a un equipo de Vercel. Ver §4.3 |
| **Costo** | Plan **Hobby**, gratuito — y ese es justamente el problema, ver §10. Pro cuesta **US$ 20/mes por asiento de desarrollador**; los usuarios del sistema **no** cuentan como asientos |
| | **[VERIFICAR: el plan actual y quién más tiene acceso al proyecto, en Settings → Members]** |
| | **[VERIFICAR: el método de pago, si lo hay, y a nombre de quién]** |
| | **[VERIFICAR: que Production Branch siga apuntando a `main`, en Settings → Git. Apuntarla a otra rama ya rompió el despliegue en silencio una vez]** |
| | **[VERIFICAR: si hay un dominio propio configurado o solo el `.vercel.app`, en Settings → Domains]** |
| | **[VERIFICAR — IMPORTANTE: si la variable `CORREO_PRUEBAS` está definida en Settings → Environment Variables. Si lo está, NINGÚN correo del sistema está llegando a su destinatario real: todos se redirigen a una sola dirección]** |

### 🟡 Resend — los correos internos

| | |
|---|---|
| **Para qué** | Manda los avisos internos: cotización aprobada u observada, ficha devuelta, solicitud de rol, y el correo del monitor de normas. **Nunca escribe a un cliente** |
| **Titular hoy** | **[VERIFICAR: titular de la cuenta y plan, en Resend → Settings]** |
| **Si se pierde el acceso** | El sistema **sigue funcionando entero**; simplemente dejan de llegar los avisos. Todo se puede consultar en pantalla. Es el servicio menos crítico de los seis |
| **Para transferir** | Ver §4.4 |
| **Costo** | **[VERIFICAR: plan y costo. El nivel gratuito de Resend cubre del orden de 3 000 correos al mes, muy por encima del uso actual]** |
| | **[VERIFICAR — IMPORTANTE: si el dominio `metrica.pe` está verificado en Resend → Domains. Si NO lo está, el sistema está en modo pruebas: remitente `onboarding@resend.dev` y entrega solo a la dirección con la que se registró la cuenta]** |

### 🟡 Google Cloud — el inicio de sesión

| | |
|---|---|
| **Para qué** | Es lo que hace funcionar el botón **Entrar con Google**. El sistema **no tiene contraseñas propias**: si esto falla, nadie entra |
| **Titular hoy** | **[VERIFICAR: qué proyecto de Google Cloud aloja las credenciales OAuth y quién es su propietario]** |
| **Si se pierde el acceso** | **Nadie puede iniciar sesión.** Las sesiones ya abiertas siguen vivas unas horas y después caen. Es, junto con Supabase, el punto único de fallo más serio |
| **Para transferir** | Ver §4.5 |
| **Costo** | Gratuito para este uso |
| | **[VERIFICAR — CRÍTICO: el estado de publicación de la pantalla de consentimiento, en APIs & Services → OAuth consent screen. Si el tipo es *External* y el estado es *Testing*, las sesiones caducan a los 7 días y el login se rompe solo, sin que nadie toque nada. Si es *Internal* de Google Workspace, no caduca — pero entonces solo entran cuentas de ese dominio, y el sistema está escrito para aceptar `metrica.pe` **y** `metricaperu.com`]** |
| | **[VERIFICAR: los URI de redirección autorizados. Deben incluir la URL de Supabase que recibe la vuelta de Google. Si mañana se cambia de dominio, esto hay que actualizarlo o el login deja de funcionar]** |

### ⚪ El Peruano — la fuente del monitor

| | |
|---|---|
| **Para qué** | De ahí salen las normas legales que vigila la automatización |
| **Titular** | **No hay cuenta ni contrato.** Se lee su buscador público |
| **Si falla** | Solo se detiene esa automatización. El resto del sistema no se entera |
| **El riesgo real** | No es perder acceso, es que **cambien el formato sin avisar**. No es un API con contrato: es un formato interno que se descifró leyendo la aplicación. El sistema está escrito para **fallar ruidosamente** si eso pasa, no para callarse. Ver §8.1 del inventario |

### Resumen

| Servicio | Titularidad | Si se pierde |
|---|---|---|
| Supabase | 🔴 Personal | 🔴 El sistema muere |
| Google Cloud | 🟡 Por confirmar | 🔴 Nadie puede entrar |
| Vercel | 🟡 Por confirmar | 🟠 El sistema no es accesible; los datos están a salvo |
| GitHub | 🔴 Personal | 🟠 No se puede cambiar nada; el monitor se detiene |
| Resend | 🟡 Por confirmar | 🟢 Solo dejan de llegar avisos |
| El Peruano | — | 🟢 Solo se detiene el monitor |

---

## 4. Cómo transferir la propiedad a Métrica

**El paso cero, antes de tocar nada:** crear la cuenta institucional. La
convención sugerida es `sistema@metrica.pe`, un buzón de la empresa al que
tengan acceso **al menos dos personas**. Todas las transferencias de abajo
apuntan a esa cuenta.

**[VERIFICAR: si ya existe una cuenta institucional de este tipo, y quién
administra el Google Workspace de Métrica para poder crearla]**

**Orden recomendado:** GitHub primero (es el más fácil y el que menos riesgo
tiene), Supabase al final (es el que más cuidado exige). Así se aprende el
procedimiento con lo barato antes de tocar lo caro.

### 4.1 · GitHub — fácil

1. Crear una organización de GitHub a nombre de Métrica (gratuita).
2. Invitar a `sistema@metrica.pe` como **propietario**.
3. Desde el repositorio: Settings → General → Transfer ownership → elegir la
   organización.

| | |
|---|---|
| **Costo** | Ninguno |
| **¿Interrumpe el servicio?** | **No.** Vercel sigue sirviendo lo ya desplegado |
| **Dificultad** | Baja. Diez minutos |
| **Qué se pierde si sale mal** | Nada irreversible. GitHub redirige la URL antigua a la nueva |

> ⚠️ **Lo que sí se rompe, y hay que prever:** al transferir un repositorio,
> **los secretos de Actions no se pueden dar por conservados**. Este repositorio
> tiene dos, `URL_SISTEMA` y `CRON_SECRET`, y sin ellos la tarea programada del
> monitor falla. Después de transferir, **entrar a Settings → Secrets → Actions,
> comprobar que estén, y volver a cargarlos si no**. Hay que tener los valores a
> mano *antes* de empezar: `CRON_SECRET` también está en Vercel, así que se puede
> recuperar de ahí; si no estuviera en ninguno de los dos, hay que generar uno
> nuevo y ponerlo en ambos sitios a la vez.
>
> También conviene reconectar la integración de Vercel con el repositorio y
> comprobar que el despliegue automático sigue funcionando, con un cambio
> pequeño de prueba.

### 4.2 · Supabase — el que más cuidado exige

Dos caminos, y el segundo es mucho más seguro:

**Camino A · Invitar, no transferir.** Añadir `sistema@metrica.pe` como
**propietario** de la organización actual (Organization → Team → Invite). La
organización sigue llamándose igual, pero deja de depender de una sola persona.
Es reversible, no interrumpe nada y se hace en cinco minutos.

**Camino B · Transferir el proyecto** a una organización nueva a nombre de
Métrica. Más limpio a largo plazo, pero implica mover la facturación y tiene más
pasos.

**La recomendación es hacer el A hoy mismo** —quita el punto único de fallo en
cinco minutos— y el B con calma.

| | |
|---|---|
| **Costo** | El plan Pro se paga igual; en el camino B hay que rehacer la facturación |
| **¿Interrumpe el servicio?** | El camino A no. El B, **[VERIFICAR]** |
| **Dificultad** | A: baja. B: media |
| **Qué se pierde si sale mal** | Nada de datos. Un proyecto mal transferido puede quedar suspendido por falta de método de pago, y eso sí tumba el sistema hasta resolverlo |

**[VERIFICAR: el procedimiento exacto de transferencia entre organizaciones en la
versión actual del panel de Supabase, y si exige que la organización de destino
tenga ya un método de pago cargado]**

> **Antes de tocar Supabase, sacar una copia completa** siguiendo la §9. Es media
> hora de trabajo que convierte cualquier error en un susto en vez de un
> problema.

### 4.3 · Vercel

**[VERIFICAR: el procedimiento actual. En líneas generales, Vercel permite
transferir un proyecto a un equipo desde Settings → General → Transfer, pero el
flujo y sus requisitos cambian con frecuencia y no se pueden dar por buenos sin
mirarlos]**

Lo que sí se puede decir con seguridad:

- **Las variables de entorno son lo importante.** Antes de mover nada, anotarlas
  todas —son ocho, listadas en §5— porque reconstruir el proyecto sin ellas es
  mucho más trabajo que con ellas.
- **Reconstruir desde cero es una alternativa viable.** Conectar el repositorio a
  una cuenta nueva, cargar las ocho variables y desplegar. Un desarrollador
  competente lo hace en una hora. Es más lento que transferir, pero no depende de
  que el procedimiento de transferencia coopere.
- **Esto se puede combinar con el paso a Vercel Pro** (§10), que hay que hacer de
  todos modos. Conviene hacer las dos cosas juntas y no dos veces.

### 4.4 · Resend

**[VERIFICAR: el procedimiento de transferencia de cuenta o de invitación de
miembros en Resend]**

Es el menos urgente y el de menor consecuencia: si algo sale mal, dejan de llegar
avisos por unos días. Nada se pierde. En el peor caso se crea una cuenta nueva,
se verifica el dominio otra vez y se cambia `RESEND_API_KEY` en Vercel.

### 4.5 · Google Cloud (el login)

Depende de la marca de verificación de la §3 —en qué proyecto de Google Cloud
viven las credenciales y quién es su propietario—, así que empieza por ahí.

**Este es el que más cuidado merece después de Supabase**, porque un error deja a
todo el equipo sin poder entrar. Dos advertencias:

- **No borrar ni regenerar el `client secret`** sin actualizarlo al mismo tiempo
  en Supabase (Authentication → Providers → Google). Entre una cosa y otra, nadie
  entra.
- Si el proyecto de Google Cloud está en una cuenta personal, se puede añadir a
  la cuenta institucional como propietaria del proyecto sin mover nada más. Eso
  resuelve el riesgo sin tocar la configuración que funciona.

---

## 5. Credenciales: dónde están y cómo se custodian

### 5.1 · Qué existe y dónde vive

Ocho variables. **Ninguna está en el código** — se verificó: `.gitignore` cubre
los archivos de entorno y en el repositorio solo aparecen los nombres.

| Variable | Sensible | Dónde vive | Para qué |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Vercel | Dirección del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Vercel | Llave pública. Viaja al navegador; es segura porque las reglas de la base deciden qué ve cada quien |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔒 **Alta** | Vercel | **Salta todas las reglas de seguridad de la base.** Quien la tenga puede leer y cambiar cualquier dato |
| `RESEND_API_KEY` | 🔒 Media | Vercel | Envío de correos. Filtrada, alguien podría mandar correos como Métrica |
| `CRON_SECRET` | 🔒 Media | Vercel **y** GitHub | Contraseña compartida entre la tarea programada y el sistema |
| `CORREO_REMITENTE` | No | Vercel | Desde qué dirección salen los correos |
| `CORREO_PRUEBAS` | No | Vercel | Redirige **todos** los correos a una dirección |
| `URL_SISTEMA` | No | Vercel **y** GitHub | Dirección pública del sistema |

Además, **fuera de las variables**, hay credenciales de acceso a los paneles:
usuario y contraseña de GitHub, Supabase, Vercel, Resend y Google Cloud, cada uno
con su segundo factor. Esas son las que de verdad importan para la continuidad.

Y una más, fácil de olvidar: los scripts de la carpeta `scripts/` leen sus
credenciales de un archivo `.env.local` que **no está en el repositorio**. Quien
tome el proyecto necesita que alguien se lo pase.

### 5.2 · Cómo deberían custodiarse

Cuatro reglas, y las cuatro importan:

1. **Un gestor de contraseñas institucional** — 1Password, Bitwarden o similar,
   con una bóveda compartida. No un archivo, no un correo, no un chat.
2. **Al menos dos personas con acceso.** Una sola persona con la bóveda reproduce
   exactamente el problema que este documento intenta resolver.
3. **Los códigos de recuperación de dos factores guardados en la misma bóveda.**
   Es lo que más se olvida y lo que más falta hace en una emergencia.
4. **Las llaves marcadas 🔒 nunca se copian fuera de ahí** — ni a un correo, ni a
   un documento, ni a un mensaje.

**[VERIFICAR: si Métrica ya usa algún gestor de contraseñas, para no crear una
herramienta nueva innecesariamente]**

### 5.3 · Si se sospecha que una credencial se filtró

**Regla general:** primero se crea la llave nueva, después se pone en su sitio, y
recién al final se revoca la vieja. Al revés se produce una caída innecesaria.

| Credencial | Cómo se rota | Qué se rompe mientras tanto |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → rotar. Actualizar en Vercel y **volver a desplegar** | **Lo más delicado.** Entre la rotación y el nuevo despliegue, el alta de usuarios, los correos y el monitor fallan. Ventana de unos minutos. Hacerlo fuera de horario |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Igual que la anterior | Igual. Ojo: esta llave viaja al navegador **por diseño**; que sea visible no es una filtración |
| `RESEND_API_KEY` | Resend → API Keys → crear nueva, actualizar en Vercel, borrar la vieja | Nada, si se hace en ese orden |
| `CRON_SECRET` | Inventar una cadena larga al azar. Ponerla **primero en Vercel**, después en GitHub → Settings → Secrets → Actions | Entre un paso y otro, la tarea programada falla. Como corre dos veces al día, se pierde una corrida como mucho |
| Contraseñas de los paneles | Desde cada servicio | Nada del sistema. Solo el acceso administrativo |

**Si lo que se filtró fue `SUPABASE_SERVICE_ROLE_KEY`, hay que asumir que alguien
pudo leer toda la base.** Además de rotar, conviene revisar los registros de
acceso de Supabase.

---

## 6. Mantenimiento: qué hay que hacer y cada cuánto

| Tarea | Cada cuánto | Quién | Si no se hace |
|---|---|---|---|
| **Comprobar que el pago de Supabase pasó** | Mensual | No técnico | Suspenden el proyecto. **El sistema deja de funcionar por completo** |
| **Comprobar que el monitor corrió de verdad** | Semanal | No técnico | Ver el recuadro de abajo. **Es la tarea más importante de esta tabla** |
| **Revisar la lista de usuarios** y dar de baja a quien salió | Mensual | No técnico (gerencia) | Gente que ya no trabaja en Métrica sigue entrando |
| **Resolver las solicitudes de rol pendientes** | Cuando llegue el correo | No técnico (gerencia) | Alguien nuevo trabaja con permisos incompletos sin saber por qué |
| **Comprobar que las copias de seguridad existen** | Trimestral | Técnico | Se descubre que no hay copia el día que hace falta |
| **Revisar dependencias con vulnerabilidades** (`npm audit`) | Trimestral | Técnico | Deuda de seguridad acumulada |
| **Revisar los avisos de seguridad de Supabase** | Trimestral | Técnico | Igual |
| **Revisar los cuatro documentos de este paquete** | Semestral, y siempre que cambie algo grande | Técnico + gerencia | Se convierten en ficción, que es peor que no tenerlos |
| **Revisar este documento en concreto** | Semestral, y **siempre que cambie una titularidad** | Gerencia | Se lee en una emergencia con datos falsos |

> ### ⚠️ Cómo comprobar el monitor: mirando la base, no el semáforo
>
> **Esto ya nos pasó y costó cinco días de avisos perdidos.** La tarea de GitHub
> puede reportar **verde diez veces seguidas** mientras el monitor no ejecuta
> absolutamente nada. El semáforo verde de GitHub significa "la petición se
> mandó", no "el trabajo se hizo".
>
> **La comprobación que sí sirve** — entrar a **Automatizaciones** en el sistema
> y mirar el bloque *Historial de corridas*. Si la última corrida es de hoy o de
> ayer, todo bien. **Si tiene varios días, el monitor está caído aunque GitHub
> diga que no.**
>
> Quien tenga acceso a la base puede confirmarlo con:
>
> ```sql
> select ultima_corrida_en, ultimo_estado
>   from automatizaciones where clave = 'normas_legales';
> ```
>
> **Al 4 de agosto de 2026 el monitor está caído por esta razón.** Diagnóstico y
> corrección en `INVENTARIO_COMPLETO.md`, §5.1.

---

## 7. Qué hacer si el sistema falla y no hay nadie técnico

Escrito para alguien no técnico. Seguir el orden.

### Paso 1 · ¿Es el sistema o es mi computadora?

Antes de dar la alarma, treinta segundos de comprobación:

1. **Abre cualquier otra página** —un diario, el correo—. Si tampoco carga, es tu
   internet, no el sistema.
2. **Pregúntale a un compañero** si a él le funciona. Si a él sí, es tu equipo:
   recarga con `Ctrl+Shift+R`, o prueba en otro navegador o desde el teléfono.
3. **Si a nadie le funciona**, entonces sí es el sistema. Sigue al paso 2.

### Paso 2 · Mirar dónde está el problema

Tres páginas públicas, sin necesidad de contraseña:

| Página | Qué te dice |
|---|---|
| `status.supabase.com` | Si hay problema, **es lo más serio**: nada funciona hasta que se resuelva |
| `vercel-status.com` | Si hay problema, la web no carga pero **los datos están intactos** |
| `status.resend.com` | Si hay problema, **solo** dejan de llegar correos. Todo lo demás funciona |

Si las tres dicen que todo está bien, el problema es del sistema y no del
proveedor. Ve al paso 3.

### Paso 3 · Los cuatro casos más probables

| Lo que ves | Qué es | Qué hacer |
|---|---|---|
| **No puedes entrar, dice *Acceso denegado*** | Entraste con un correo que no es de Métrica | Cierra sesión de Google y vuelve con el de trabajo |
| **No puedes entrar, dice *Acceso dado de baja*** | Alguien desactivó tu cuenta | Que gerencia te reactive desde **Usuarios** |
| **No llegan los correos, pero el sistema funciona** | Problema de Resend, o la cuenta llegó a su límite | Nada urgente. Todo se consulta en pantalla. Avisa y sigue trabajando |
| **La web no carga para nadie, y las tres páginas de estado dicen que todo bien** | Lo más probable: **el proyecto de Vercel fue suspendido** por el asunto del plan Hobby (§10), o venció un pago | **Escala de inmediato.** Es de las pocas cosas que no se arreglan solas |

### Paso 4 · Cuándo escalar y a quién

| Situación | A quién |
|---|---|
| Cualquiera de los cuatro casos de arriba que no se resuelva en una hora | Sergio Saldaña · `ssaldana@metrica.pe` |
| Si no está disponible y el sistema lleva **más de medio día caído** | Gerencia decide contratar apoyo externo. Ver §8 |
| Sospecha de que alguien accedió sin permiso | **Inmediato**, sin esperar. Ver §5.3 |

**[VERIFICAR: definir un segundo contacto técnico y escribirlo acá. Hoy no
existe]**

### Paso 5 · Cómo seguir trabajando mientras tanto

**Esto es lo más importante de esta sección.** El sistema caído no debería
detener a la agencia, y lo que se haga en el intervalo tiene que poder cargarse
después **sin romper la numeración**.

**La regla de oro: no inventes códigos.** Los números `COT-`, `ODA-` y
`ODA-PROV-` los asigna el sistema y **no se pueden reservar a mano**. Si escribes
`COT-2026-0012` en un papel y el sistema al volver le da ese número a otra
cotización, quedan dos documentos distintos con el mismo número — un problema de
auditoría que ya no tiene arreglo.

**Lo que sí hay que hacer:** en una hoja de cálculo compartida, una fila por cada
cosa que hubieras cargado, con:

- **Cotizaciones** — fecha, cliente, proyecto, moneda, fee %, y las líneas de
  proveedor con descripción, cantidad y precio unitario.
- **Órdenes** — de qué ficha sale, proveedor con RUC, banco, cuenta y CCI, y las
  líneas de compra.
- **Facturas recibidas** — número, fecha de recepción y a qué orden corresponden.
- **En todas** — quién lo hizo y **la fecha real**, que es el dato que más se
  pierde.

**Y en la columna del código, deja el espacio vacío.** Se llena al cargarlo,
con el número que dé el sistema.

**Lo que no se puede diferir:** si hay que mandarle una cotización a un cliente y
el sistema está caído, se hace por fuera — pero **quedará sin código del sistema
hasta que se cargue**. Anótalo aparte para no perder de vista que ese documento
todavía no está en el registro.

---

## 8. Cómo contratar a alguien para mantenerlo

### 8.1 · Qué perfil buscar

Para publicar una búsqueda, en estos términos:

> Desarrollador **full-stack** con experiencia real en **Next.js (App Router) y
> React**, **TypeScript** y **PostgreSQL**. Imprescindible: haber trabajado con
> **Supabase** o, en su defecto, entender **Row Level Security de PostgreSQL** —
> las reglas de seguridad de este sistema viven en la base de datos, no en la
> pantalla. Se valora experiencia en sistemas administrativos o contables, donde
> la trazabilidad y la numeración de documentos importan más que la velocidad de
> entrega.

**No hace falta un equipo.** Es un sistema de 15 227 líneas mantenido por una
persona a tiempo parcial. Una persona competente, unas horas por semana, alcanza.

**Lo que NO hace falta:** experiencia en aplicaciones móviles, en escalabilidad
masiva o en infraestructura compleja. Esto lo usan seis personas.

### 8.2 · Qué entregarle el primer día, y en qué orden

| Orden | Documento | Para qué |
|---|---|---|
| 1 | `MANUAL_USUARIO.md` | **Empezar por acá, aunque sea el menos técnico.** Sin entender qué hace el negocio, el código no se entiende |
| 2 | `ARQUITECTURA_SISTEMA.md` | Cómo está construido, con el mapa del proceso |
| 3 | `INVENTARIO_COMPLETO.md` | Qué está a medias, qué no se usa y qué trampas hay |
| 4 | Este documento | Cuentas, accesos y qué está pendiente de decidir |

Además: acceso de lectura al repositorio y a Supabase, y **el archivo
`AGENTS.md`**, que tiene las cinco reglas duras del proyecto en una página. Esas
cinco reglas no son estilo: son decisiones que costaron caro aprender.

### 8.3 · Cuánto tarda en entenderlo

Con los cuatro documentos en la mano y midiendo contra el tamaño real del sistema
—96 archivos, 35 migraciones, tres módulos—, una estimación razonable:

| Momento | Qué debería poder hacer |
|---|---|
| **Día 2–3** | Explicar el recorrido de una compra y qué hace cada rol |
| **Semana 1** | Corregir un fallo pequeño en una pantalla y desplegarlo |
| **Semana 2–3** | Escribir una migración nueva con su RLS, y probarla en los dos sentidos |
| **Mes 2** | Tocar con criterio las funciones atómicas y la anulación en cascada |

Si a la tercera semana todavía no entiende por qué las reglas están en la base y
no en la pantalla, no es la persona.

### 8.4 · Señales de alerta en la entrevista

| Si dice… | Por qué preocupa |
|---|---|
| *"Muevo las validaciones al frontend, es más rápido"* | No entendió lo esencial. Las reglas están en la base **a propósito**: una validación de pantalla se salta llamando al servidor por fuera |
| *"Esto lo reescribo en dos semanas"* | Nadie reescribe en dos semanas 35 migraciones de reglas de negocio aprendidas a golpes |
| *"Borro los registros de prueba y las órdenes viejas"* | Nada se borra en este sistema. Se anula, dejando motivo y autor |
| *"El código de una cotización anulada lo devuelvo al banco"* | Los códigos no se reciclan **nunca**. Dos documentos con el mismo número no tienen arreglo posterior |
| *"Le quito los `SECURITY DEFINER`, son peligrosos"* | Son lo que sostiene la asignación atómica de códigos. Quitarlos sin entenderlos rompe la numeración |
| No pregunta **nada** sobre los datos de producción | Va a probar contra la base real |

### 8.5 · Lo que nadie toca sin entenderlo primero

Cinco zonas. Cambiar cualquiera sin entenderla produce daño que no se nota hasta
meses después, en una auditoría:

1. **Las funciones atómicas de los bancos de códigos** — `crear_cotizacion()`,
   `generar_oda()`, `crear_orden_proveedor()`. Usan bloqueos para que dos personas
   creando a la vez nunca reciban el mismo número.
2. **La anulación en cascada** — `anular_proceso()` y `reactivar_proceso()`.
   Anulan de una sola vez la cotización, la ficha, sus órdenes y sus códigos, en
   una operación que no puede quedar a medias.
3. **Las políticas RLS** — 73 reglas que deciden qué ve cada rol. Son la barrera
   real, no las comprobaciones del servidor.
4. **Los disparadores `trg_no_borrar`** — impiden borrar documentos con valor
   contable, **incluso con la llave privilegiada**.
5. **El control de cuatro ojos** — `trg_cotizacion_transicion()` y
   `trg_solicitud_no_propia()`. Nadie aprueba lo suyo, gerencia incluida.

**La regla para tocar cualquiera de las cinco:** probarlo **en los dos sentidos**
—que la barrera bloquee a quien debe bloquear, y que el camino legítimo siga
funcionando— y sobre sesiones simuladas, no leyendo el código. Cómo se hace está
en `INVENTARIO_COMPLETO.md`, §8.7.

---

## 9. Cómo exportar todo y migrar a otra herramienta

### 9.1 · La base de datos

Desde Supabase → Project Settings → Database se obtiene la cadena de conexión, y
con ella:

```bash
pg_dump "<cadena-de-conexión>" --no-owner --no-privileges -f metrica-completo.sql
```

Queda un archivo SQL de texto plano con **todo**: estructura y datos. Pesa poco —
la base entera son **14 MB**.

Para llevárselo a Excel o a otra herramienta, tabla por tabla:

```bash
psql "<cadena-de-conexión>" -c "\copy (select * from cotizaciones) to 'cotizaciones.csv' csv header"
```

Supabase también permite descargar una copia desde el panel, sin línea de
comandos. **[VERIFICAR: la ubicación exacta de esa opción en la versión actual
del panel]**

### 9.2 · Los PDF guardados

Son **36 archivos, 432 kB en total**, en tres cajones privados: `cotizaciones`
(19), `ordenes` (10) y `fichas` (7). Se bajan con la CLI de Supabase o con un
script corto usando la llave privilegiada. No hay botón de "descargar todo" en el
panel.

### 9.3 · Qué se conserva y qué se pierde

| Se conserva | Se pierde |
|---|---|
| **Todos los datos**, íntegros y en formato abierto | **La lógica de negocio.** Las 35 migraciones con sus reglas, disparadores y políticas no se "exportan" a otra herramienta: hay que reimplementarlas |
| Los PDF ya generados | **La generación** de PDF nuevos con el formato de Métrica |
| La trazabilidad histórica: qué código corresponde a qué documento | El control de cuatro ojos, la numeración atómica y la anulación en cascada |
| Los correos ya enviados (están en los buzones) | Los avisos automáticos |

**En una frase:** los datos se llevan enteros; **el sistema no**. Lo que hace
valioso a esto no es guardar información, es el conjunto de reglas que impide que
la información quede mal. Eso se reconstruye o se pierde.

### 9.4 · Cuánto toma

| Tarea | Tiempo |
|---|---|
| Exportar base y archivos | **Media jornada** de una persona técnica |
| Dejarlo legible en hojas de cálculo | **Uno o dos días** más |
| Reimplementar las reglas en otra herramienta | **Semanas o meses**, según la herramienta |

---

## 10. Riesgos abiertos y decisiones pendientes

Ordenados por gravedad. El detalle técnico de cada uno está en
`INVENTARIO_COMPLETO.md`.

| # | Riesgo | Si no se resuelve | Para cerrarlo | Quién decide |
|---|---|---|---|---|
| 1 | **Titularidad personal de las cuentas** (verificado en GitHub y Supabase) | Si esa persona no está, Métrica no controla su propio sistema | Cuenta institucional + §4. **Lo más urgente, y lo más barato** | Gerencia |
| 2 | **Un solo colaborador en todo** (verificado: 1 en GitHub) | Nadie puede entrar a arreglar nada | Segunda persona con acceso a todo | Gerencia |
| 3 | **El plan Hobby de Vercel prohíbe el uso comercial** | Vercel puede **suspender el proyecto sin aviso previo**. El sistema deja de ser accesible de un momento a otro. Los datos no se pierden | Migrar a Pro · US$ 20/mes por asiento de desarrollador. Los usuarios **no** cuentan como asientos | Administración |
| 4 | **El monitor de normas no corre desde el 30 de julio** | Los avisos de El Peruano no llegan y el tablero dice que sí | Una línea de código. Ver `INVENTARIO_COMPLETO.md` §5.1 | Ya decidido: se documentó, falta ejecutar |
| 5 | **El repositorio es público** | El código, las migraciones, el RUC y los nombres de clientes son visibles. **No hay credenciales dentro** — verificado | Settings → General → Change visibility. Gratis | Gerencia |
| 6 | **La rama por defecto de GitHub no es `main`** | Las tareas programadas corren desde una rama de trabajo. Hoy no rompe nada; el día que difieran, sí | Settings → General → Default branch | Técnico |
| 7 | **Las cláusulas tributarias del PDF sin confirmar** | Los PDF que se mandan a proveedores llevan indicaciones tributarias que nadie de contabilidad validó, incluido un 8 % de retención de cuarta categoría | Que contabilidad revise `src/config/oda.ts` y `oda-proveedores.ts` | Contabilidad |
| 8 | **PITR sin confirmar** | Sin él, la peor pérdida posible es un día de trabajo | Verificar y decidir si el costo se justifica | Administración |
| 9 | **Datos de prueba en producción** | Cinco proveedores inventados, clientes con RUC falsos, cotizaciones de prueba. El equipo va a trabajar sobre eso | Limpieza única antes de arrancar en serio. Requiere deshabilitar disparadores a mano | Gerencia + técnico |
| 10 | **Estado del correo sin confirmar** | Si `CORREO_PRUEBAS` está definida, **ningún correo llega a su destinatario real** | Mirar Vercel → Environment Variables | Técnico |

---

## 11. Decisiones que Métrica debe tomar

Esta sección está **deliberadamente sin llenar**. Son preguntas, no
recomendaciones. Se señala cuál parece la opción más razonable y por qué, pero la
decisión es de Métrica y queda abierta hasta que se escriba acá.

---

### Decisión 1 · ¿Se crea la cuenta institucional y se transfiere todo?

| Opción | Implica |
|---|---|
| **A · Sí, ahora** ⭐ | Un día de trabajo. Costo cero salvo lo que ya se paga. Elimina de raíz los riesgos 1 y 2 |
| **B · Sí, más adelante** | El riesgo sigue abierto mientras tanto, y "más adelante" tiende a no llegar |
| **C · No, se mantiene como está** | Métrica acepta que su sistema depende de las cuentas personales de un colaborador |

**Por qué A:** es la única de las diez decisiones abiertas que se resuelve en un
día, no cuesta dinero y desactiva los dos riesgos más graves. Si solo se hace una
cosa de este documento, que sea esta.

**Decisión:** _________________  **Fecha:** __________

---

### Decisión 2 · ¿Quién es la segunda persona con acceso a las credenciales?

| Opción | Implica |
|---|---|
| **A · Alguien de gerencia** ⭐ | Continuidad garantizada por parte de la empresa. No necesita saber programar: solo poder dar acceso a un tercero en una emergencia |
| **B · Otro colaborador técnico** | Puede además arreglar cosas, pero si sale de la empresa se reproduce el problema |
| **C · Un proveedor externo con contrato** | Continuidad técnica real. Implica un contrato y un costo |

**Por qué A:** el problema que se resuelve no es técnico sino de control. Quien
tenga la bóveda no necesita entender el sistema; necesita poder abrirle la puerta
a quien sí lo entienda.

**Decisión:** _________________  **Fecha:** __________

---

### Decisión 3 · ¿Se aprueba el gasto de Vercel Pro?

| Opción | Implica |
|---|---|
| **A · Sí, migrar a Pro** ⭐ | US$ 20/mes por asiento de desarrollador — hoy uno. Cierra el riesgo 3 y de paso levanta el límite que obligó a usar GitHub Actions para el monitor |
| **B · Migrar a otro proveedor** | Sin costo mensual en algunas alternativas, pero es trabajo técnico real y hay que rehacer el despliegue |
| **C · Quedarse en Hobby** | Se acepta que Vercel puede suspender el proyecto sin aviso |

**Por qué A:** US$ 240 al año es menos de lo que cuesta un día de sistema caído, y
la alternativa B consume tiempo técnico que hoy no sobra.

**Decisión:** _________________  **Fecha:** __________

---

### Decisión 4 · ¿Quién asume el mantenimiento cuando Sergio no esté?

| Opción | Implica |
|---|---|
| **A · Contratar a alguien externo por horas** ⭐ | Costo variable, sin planilla. Perfil y proceso en §8. Hay que hacerlo **antes** de necesitarlo: contratar en medio de una emergencia sale caro y mal |
| **B · Formar a alguien interno** | Más barato a largo plazo y mejor conocimiento del negocio. Requiere que exista alguien con perfil técnico |
| **C · Congelar el sistema** | Sigue funcionando mientras nada falle. No hay cambios, no hay correcciones. Los proveedores actualizan sus plataformas y en algún momento algo se rompe solo |

**Por qué A:** es la única que se puede activar rápido. La C parece gratis y no lo
es: solo pospone el costo hasta que sea urgente.

**Decisión:** _________________  **Fecha:** __________

---

### Decisión 5 · ¿Cada cuánto se revisa este documento, y quién responde?

| Opción | Implica |
|---|---|
| **A · Semestral, con responsable nombrado** ⭐ | Dos revisiones al año, media hora cada una |
| **B · Solo cuando cambie algo** | En la práctica significa nunca: los cambios pequeños no disparan revisiones |
| **C · Sin revisión** | El documento envejece y en una emergencia se lee con datos falsos |

**Por qué A:** la fecha en la cabecera es lo primero que mira alguien en una
emergencia. Si dice hace dos años, deja de confiar en todo lo demás.

**Responsable:** _________________  **Frecuencia:** __________

---

### Decisión 6 · ¿Se limpian los datos de prueba antes de arrancar en serio?

| Opción | Implica |
|---|---|
| **A · Limpieza completa antes de empezar** ⭐ | Una operación única, incómoda a propósito: hay que deshabilitar los disparadores de "nada se borra" a mano. Se arranca con la base vacía y creíble |
| **B · Dejarlo y convivir** | El equipo ve cinco proveedores inventados y cotizaciones llamadas "iyiyyi". Cuesta credibilidad y con el tiempo ya no se puede distinguir lo real de lo falso |
| **C · Limpieza parcial** | Borrar proveedores y clientes falsos, conservar los documentos. Menos trabajo, resultado a medias |

**Por qué A:** el momento es **ahora**. Ninguna ficha se cerró, ninguna factura se
registró, no hay historia real que preservar. En seis meses ya no será posible.

**Decisión:** _________________  **Fecha:** __________

---

### Decisión 7 · ¿`facturas@metrica.pe` debe ser un usuario del sistema?

Hoy es las dos cosas a la vez: **el buzón** al que las cláusulas del PDF piden
enviar las facturas, y **un usuario con rol de Administración** — con permiso para
aprobar cotizaciones y emitir órdenes.

| Opción | Implica |
|---|---|
| **A · Solo buzón, se le quita el acceso** ⭐ | Una cuenta compartida con permiso de aprobar rompe la trazabilidad: no se sabe **quién** aprobó |
| **B · Sigue como está** | Cómodo si alguien lo usa a diario para cargar facturas |
| **C · Se le baja a rol Ejecutivo** | Punto medio: puede entrar y mirar, no puede aprobar |

**Por qué A:** todo el sistema está construido sobre "quién hizo qué". Una cuenta
compartida con permiso de aprobación es un agujero en esa idea.

**Decisión:** _________________  **Fecha:** __________

---

*Documento creado el 4 de agosto de 2026, verificado contra el repositorio, la
base de datos de producción y el API de GitHub. Las 24 marcas **[VERIFICAR]**
corresponden a paneles de servicios externos a los que no se pudo acceder: hay
que completarlas a mano. Mientras estén sin llenar, este documento está
incompleto — y se lee en una emergencia.*
