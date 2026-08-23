# Estrategia: competencia, posicionamiento y decisiones pendientes

Documento vivo. Junta el análisis de mercado, los conflictos entre el plan nuevo y lo que ya está construido, y las ideas de producto que salieron de la investigación.

Investigación hecha en agosto de 2026. Los precios y políticas de terceros cambian: las fuentes están linkeadas al final para poder re-verificar.

---

## 1. Quién más está en esto

### miFACU — el competidor serio

Lo hacen dos estudiantes argentinos (Matías González y Facundo Basualdo). Es el más completo del mercado local.

| | miFACU |
|---|---|
| **Plataformas** | iOS + Android nativas + web, sincronizadas |
| **Precio** | Gratis con todo lo core. PRO: **USD 0,99/mes** o USD 9,99/año |
| **Cobertura** | Plan de estudios pre-cargado de **310+ carreras en 130+ universidades** |
| **Carga de datos** | Manual, o subir screenshot/PDF de SIU Guaraní o SYSACAD y una IA lo parsea |
| **Features PRO** | Simulador de correlativas, calendario institucional, timer de estudio con rankings, asistente IA (Faro), flashcards |
| **Extra** | Apuntes subidos por la comunidad, asistencia por materia, detección de choques de horario |

### EDUROAD

Web (no app nativa). Gratis, con un tier pago sin precio público. Roadmap visual de la carrera, correlativas que se conectan solas, "camino crítico". Su diferencial es **social**: agregás amigos y comparás quién aprobó más, quién está por recibirse, con ranking en vivo. Cubre 7 universidades (UBA, UNLP, UTN, UADE, Siglo 21, UAI, ITBA).

### Plande, Correlativas, y la app oficial de SIU

- **Plande**: plan de estudios interactivo, foco en planificación.
- **Correlativas**: app de Google Play, alcance acotado (por carrera/facultad).
- **App oficial de SIU Guaraní**: notificaciones de eventos académicos (carga de notas, fechas de inscripción, cambios de estado) y sincronización con el calendario del celular. Ventaja imbatible: los datos le llegan **desde adentro**, sin scraping.

---

## 2. Dónde Monteflori pierde hoy

Es incómodo pero conviene tenerlo claro:

**a) La carga inicial es mucho peor.** miFACU tiene el plan de estudios ya cargado de 310+ carreras: elegís tu carrera y aparecen todas las materias con año y duración. En Monteflori arrancás con la pantalla vacía y tenés que sincronizar o cargar a mano. Es la diferencia entre "listo en 30 segundos" y "primero instalate una extensión".

**b) El diferencial de "extracción automática" es más fino de lo que parece.** El plan lo posiciona como *la* ventaja frente a competidores "con carga manual". Pero comparemos el flujo real:

- **miFACU**: sacás un screenshot desde el celular → lo subís → la IA lo parsea. Sin instalar nada.
- **Monteflori**: instalás una extensión de Chrome → entrás a SIU desde una computadora → hacés clic en sincronizar.

Para una población que vive en el celular, el flujo de miFACU tiene *menos* fricción, aunque técnicamente sea "manual". Nuestra extensión es más profunda y más precisa, pero también es **desktop-only y requiere instalación** — dos barreras que ellos no tienen.

**c) No hay app móvil.** Ellos tienen nativas en ambas tiendas. Nosotros, web.

**d) El precio va en la dirección contraria.** El mínimo planteado es **ARS 5.000/mes**. miFACU cobra **USD 0,99/mes** por un PRO con más features. Según el tipo de cambio del momento, estamos pidiendo del orden de **3 a 4 veces más que un competidor más completo**. Vale la pena revisar el número contra la cotización actual.

**e) No hay capa social.** EDUROAD apuesta fuerte a comparar progreso con amigos. Es un motor de retención y de crecimiento orgánico que hoy no tenemos.

---

## 3. Dónde Monteflori ya es mejor

**a) El constructor visual de fórmula de nota.** No lo vi en ningún competidor. Los demás registran notas y calculan un promedio. Nosotros dejamos modelar **cómo tu cátedra calcula la nota final** (grupos con peso, promedio / mejor nota / última nota, arrastrando y soltando). Para carreras con esquemas de ponderación raros, esto no lo resuelve nadie más.

**b) Recuperatorios que reemplazan sin borrar.** El recuperatorio anula la nota original en el cálculo pero la deja visible en el historial. Es un detalle chico que refleja cómo funciona de verdad la cursada.

**c) Profundidad de la extracción.** Un screenshot captura lo que está en pantalla. Nosotros leemos Historia académica completa: fecha exacta de cada acto (regularidad, promoción, examen), nota real, **y la fecha de vencimiento de cada regularidad** — recorriendo todas las carreras automáticamente. Ese dataset es más rico que el de cualquier competidor.

**d) Posicionamiento.** "Lo hace un estudiante para la comunidad", abierto, sin empresa detrás. miFACU también nació así, pero ya se ve como producto. Hay lugar para lo genuinamente comunitario.

---

## 4. Conflictos entre el plan nuevo y lo que ya está construido

Esto es lo que hay que resolver antes de seguir agregando.

### 🔴 4.1 El cron de WhatsApp es una fuga de plata

[`src/app/api/cron/send-reminders/route.ts`](src/app/api/cron/send-reminders/route.ts) corre todos los días y manda **templates iniciados por nosotros** — la categoría más cara, y que **nunca** fue gratis (la gratuidad aplicaba solo a respuestas dentro de la ventana de 24 h).

Dos problemas:

1. **No filtra por nivel.** La query es `where("configuracion.notificaciones_whatsapp", "==", true)` — sin chequeo de donante. Cualquiera que active notificaciones dispara mensajes pagos por nosotros, todos los días, más el resumen de los lunes.
2. **Contradice el plan nuevo**, que dice explícitamente: *"el usuario escribe al bot… no la plataforma la que escribe primero"*.

Hoy no está costando nada solo porque WhatsApp está pausado sin credenciales. En el momento en que se active, empieza a cobrar. **Es una mina enterrada.**

### 🔴 4.2 Limitar Google Calendar contradice la regla de oro

El plan dice: *"cobrar lo que cuesta mantener, no lo que vale para el usuario"* y que el PRO cubre *"únicamente los costos reales de operar (no features core)"*.

Pero la tabla de costos del propio plan dice: **"Google Calendar API — Gratis — cuota muy alta, no es un costo real"**.

Y lo que está implementado ([`src/lib/planes.ts`](src/lib/planes.ts)) limita a los usuarios gratis a **1 sincronización por mes**. Estamos cobrando por algo que no nos cuesta nada. Va en contra del principio que acabás de fijar.

**Sugerencia**: sacar el límite mensual y dejar Calendar gratis para todos, protegido solo por el rate limiting técnico que ya existe (20/min por usuario, que está para evitar abuso, no para monetizar). Si más adelante hace falta una palanca de donación, que sea sobre algo que **sí** cueste.

### 🟡 4.3 Vercel Hobby + Mercado Pago integrado = zona gris

Lo marcaste en el plan y la investigación lo confirma. Los términos de Vercel listan como uso comercial, textual:

> *"Any method of requesting or processing payment from visitors of the site"*

Pedir donaciones, por otro lado, **no** cuenta como uso comercial. La distinción práctica parece ser: **un link a una plataforma externa de donación está bien; montar el checkout y los webhooks en tu deployment, no**.

Lo que construimos (crear suscripción + webhook de Mercado Pago corriendo en Vercel) cae del lado riesgoso.

**Tres caminos**:

| Opción | Costo | Riesgo | Nota |
|---|---|---|---|
| **Cafecito con link externo** | $0 | Ninguno | Es el estándar argentino para esto. Elimina todo el código de pagos y su superficie de ataque. Contra: dar el nivel donante es manual. |
| **Vercel Pro** | USD 20/mes | Ninguno | Probablemente más caro que lo que entre por donaciones al principio. |
| **Dejarlo como está** | $0 | Suspensión del deployment | Vercel invita a consultarles ante la duda. |

**Recomendación**: para el arranque, Cafecito. Encaja mejor con el posicionamiento ("apoyo, no suscripción"), es gratis, y saca de encima mantener y asegurar código de pagos. Si el volumen justifica automatizar, ahí se pasa a Pro y se retoma Mercado Pago — el código queda en el repo, no se tira.

### 🟡 4.4 Telegram gana por goleada en economía

| | WhatsApp | Telegram |
|---|---|---|
| Costo por mensaje | ~USD 0,026 (ARS) — y **desde el 1/10/2026 también se cobran las respuestas de servicio** dentro de la ventana de 24 h | **$0**, sin límite |
| Límites | Por costo | Throttling (~30 msg/s), no se paga por subirlo |
| Alcance en Argentina | Altísimo | Menor, pero real |
| Aprobación de templates | Sí, 24-48 h | No existe |

Meta publica las tarifas nuevas **antes del 1 de septiembre de 2026** — o sea, en cuestión de semanas.

Para un proyecto financiado con donaciones, un canal con costo por mensaje que escala con el uso es exactamente lo que no querés: cuanto mejor te va, más perdés.

**Sugerencia**: Telegram primero. Es gratis, no tiene aprobación de templates, y la API es más simple. WhatsApp queda como "lo que pide la gente" y se evalúa cuando haya con qué pagarlo. Encaja con que el plan ya lo pone como alternativa a considerar.

### 🟢 4.5 El login en la extensión: lo que hay hoy es mejor que lo planeado

El plan dice que la extensión debe hacer el login (completar el formulario). **Lo implementado no hace eso**: el usuario entra a SIU por su cuenta y la extensión lee la sesión que ya está abierta.

Eso es **estrictamente más seguro**. Para autocompletar el formulario habría que guardar la contraseña en algún lado, aunque sea local. Hoy no tocamos credenciales en ningún momento — ni siquiera en el navegador del usuario.

**Sugerencia**: mantener el enfoque actual y actualizar el plan. "No manejamos credenciales" es más fuerte que "las manejamos con cuidado", y es más fácil de explicar a un usuario desconfiado.

### 🟢 4.6 Firebase: Spark vs Blaze

El plan dice Firestore **Spark** (gratis). Ojo con dos cosas:

- **Firebase Storage** (los avatares) requiere **Blaze** en proyectos nuevos. Si estás en Spark, esa función no anda.
- Antes mencionaste tener un límite de facturación, lo que sugiere que ya estás en Blaze.

Conviene confirmar en cuál estás, porque cambia qué protecciones importan. Si estás en Spark, los topes duros te cubren de una factura sorpresa. Si estás en Blaze, las defensas que agregamos (App Check, reglas, rate limiting) son las que te cubren.

---

## 5. Qué agregaría — ideas que salen de lo que ya tenemos

Ordenadas por (impacto ÷ esfuerzo). Las primeras dos aprovechan datos que **ya extraemos y nadie más tiene**.

### 5.1 ⭐ Alertas de vencimiento de regularidad

Ya scrapeamos el campo `vencimiento` de cada regularidad en Historia académica. **Ningún competidor tiene ese dato.**

Perder una regularidad por no rendir a tiempo es un dolor real y caro: te obliga a recursar una materia entera. Un aviso a los 90/30/7 días es de las cosas más valiosas que puede hacer la app, y los datos ya están en la base.

Además es un caso de uso **naturalmente proactivo**, que justifica notificaciones (push en la app; por Telegram si el usuario lo pide).

### 5.2 ⭐ "¿Qué necesito sacar para promocionar?"

Tenemos el constructor de fórmula. Invertir el cálculo es matemática directa: *"con lo que llevás, necesitás 8 o más en el final para promocionar; con 6 aprobás; con menos de 4 recursás"*.

Es la pregunta que todo estudiante se hace antes de un final, y se responde con la fórmula que ya modelaste. Es el uso más fuerte del diferencial que ya tenemos.

### 5.3 Plan de estudios pre-cargado (la deuda grande)

Es lo que más nos separa de miFACU. Pero tenemos una ventaja: **cada sincronización de un usuario nos trae el plan completo de su carrera**, con correlativas incluidas.

Se puede construir una biblioteca de planes de forma incremental: el primer usuario de una carrera la scrapea, y a partir de ahí los siguientes la eligen de una lista y arrancan con todo cargado. El costo marginal tiende a cero y crece solo con el uso.

Requiere pensar bien la privacidad (compartir *estructura de plan*, nunca notas de nadie) y la deduplicación entre variantes de plan.

### 5.4 Promedio con y sin aplazos

Las universidades difieren en si los aplazos entran al promedio, y muchas piden el promedio de las dos formas para becas o postulaciones. Es barato de calcular sobre los datos que ya tenemos.

### 5.5 Simulación "qué pasa si"

*"Si apruebo estas 3 materias este cuatrimestre, ¿qué se me habilita?"* — se apoya en el grafo de correlativas que ya está construido y testeado.

### 5.6 Capa social, con cuidado

EDUROAD la usa bien. Pero comparar progreso académico puede ser tóxico para gente que va atrasada, que es justamente a quien la app quiere ayudar. Si se hace, mejor **cooperativa que competitiva**: "vas a cursar Álgebra II con 3 personas que conocés" es más útil (y más sano) que un ranking.

---

## 6. Sobre "móvil vía WhatsApp en vez de las tiendas"

La intuición es buena — evitar las tiendas ahorra plata y burocracia — pero conviene separar dos cosas que el plan mezcla.

**WhatsApp no reemplaza una app.** Sirve para interacciones cortas (avisar, cargar una nota suelta). No sirve para ver el plan de ruta, los gráficos, o el constructor de fórmula. Es un **canal de notificación**, no una interfaz.

**Y ahora tiene costo marginal.** Desde el 1/10/2026 cada respuesta se cobra. Reemplazar una app (costo fijo único) por un canal que cobra por mensaje (costo variable creciente) es cambiar un costo que se amortiza por uno que escala con el éxito.

**La opción que el plan no considera: PWA.** Con lo que ya está construido (Next.js) se puede instalar desde el navegador, con ícono propio, sin pasar por ninguna tienda, sin pagar nada, sin revisión. En Android es prácticamente indistinguible de una app nativa. En iOS es más limitada (notificaciones push con más fricción), pero funciona.

**Comparación de caminos a móvil:**

| | PWA | Capacitor + tiendas | Solo WhatsApp |
|---|---|---|---|
| Costo inicial | $0 | USD 25 (Play) + USD 99/año (Apple) | $0 |
| Costo por uso | $0 | $0 | Crece con los usuarios |
| Burocracia | Ninguna | 12 testers × 14 días seguidos (Play, cuentas personales); revisión de Apple | Aprobación de templates |
| Necesita Mac | No | Sí, para iOS | No |
| Interfaz completa | Sí | Sí | No |
| Push | Sí (con límites en iOS) | Sí, completo | Es el canal |
| Descubrimiento | Nulo (no está en tiendas) | Sí | Nulo |

**Sugerencia de secuencia**:

1. **PWA ahora** — barato, rápido, cubre la mayor parte del valor de "tenerlo en el celular".
2. **Telegram** para lo proactivo (gratis).
3. **Capacitor + Play Store** cuando haya usuarios que lo justifiquen. Ojo con el requisito de Play: **12 testers manteniéndose 14 días corridos**, y si uno se baja en el día 7 el contador **se reinicia**. Conviene tener los 12 conseguidos de antemano. Las cuentas de organización están exentas, las personales no.
4. **iOS al final**, como ya dice el plan.

---

## 7. Decisiones pendientes

- [ ] ¿Se saca el límite mensual de Google Calendar? (contradice la regla de oro — ver 4.2)
- [ ] ¿Se apaga o se limita el cron de WhatsApp antes de activar el bot? (fuga de plata — ver 4.1)
- [ ] ¿Cafecito con link externo o Mercado Pago integrado + Vercel Pro? (ver 4.3)
- [ ] ¿Telegram primero en vez de WhatsApp? (ver 4.4)
- [ ] ¿Se revisa el mínimo de ARS 5.000 contra el USD 0,99 de miFACU? (ver 2.d)
- [ ] ¿Firebase está en Spark o Blaze? (ver 4.6)
- [ ] ¿PWA antes que Capacitor? (ver 6)

---

## Fuentes

- [miFACU](https://mifacu.com.ar/)
- [EDUROAD](https://www.eduroad.app/)
- [Plande](https://plande.app/)
- [Correlativas (Google Play)](https://play.google.com/store/apps/details?id=ar.maillet.correlativas_historia)
- [App oficial SIU Guaraní (App Store)](https://apps.apple.com/ar/app/siu-guarani/id1436509732)
- [Vercel — Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
- [Cambios de tarifas de WhatsApp desde el 1/10/2026 — AiChat](https://www.aichat.com/blog/whatsapp-business-pricing-changes-2026)
- [Cambios de tarifas de WhatsApp — Chakra HQ](https://chakrahq.com/article/whatsapp-api-pricing-update-service-messages-october-2026/)
- [Precios de Telegram Bot API](https://www.botract.com/blog/telegram-bot-cost-pricing-guide)
- [Google Play — requisito de testing para cuentas personales](https://support.google.com/googleplay/android-developer/answer/14151465)
