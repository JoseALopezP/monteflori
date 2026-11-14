# Lista de mejoras

Qué conviene hacer después del rediseño, en orden. Complementa a [ESTRATEGIA.md](ESTRATEGIA.md) (el porqué: competencia y posicionamiento) y a [PASOS-MANUALES.md](PASOS-MANUALES.md) (lo que hay que configurar a mano).

Escrita el 14 de noviembre de 2026. Actualizada el mismo día al terminar los puntos 1 y 2.

**Cómo leerla.** Cada mejora tiene un tamaño estimado: **S** (una sesión de trabajo), **M** (dos o tres), **L** (una semana o más). Los tamaños son estimaciones mías, no mediciones. Lo marcado con ⚠️ depende de algo que no pude verificar y está aclarado en el ítem.

---

## Resumen: por dónde empezar

| # | Mejora | Tamaño | Por qué va primero |
|---|---|---|---|
| 1 | ~~Guardar lo que la extensión ya lee y hoy se descarta~~ | ✅ | Hecho. Falta que vuelvas a sincronizar para que tu cuenta tenga los datos. |
| 2 | ~~Gráficos nuevos~~ | ✅ | Primera tanda hecha. Ver qué quedó para la segunda. |
| 3 | Calendarios de Apple, Samsung y Outlook | ✅ + M | La descarga está hecha. Falta el calendario suscripto, que necesita el servidor. |
| 4 | "¿Cuánto necesito sacar?" | S | Es el uso más fuerte de lo que Monteflori ya hace mejor que nadie (la fórmula de nota). |
| 5 | Instalable en el celular (PWA) | S | La barra inferior y el botón "+" ya están pensados para celular; falta poder instalarla. |

Antes que todo eso hay un arreglo pendiente en tu entorno, que no es una mejora sino un bloqueo: ver la sección 0.

---

## 0. Bloqueos y deudas — antes de sumar nada

### 0.1 La clave de servidor de Firebase no funciona en local · S

`FIREBASE_SERVICE_ACCOUNT_KEY` en `.env.local` tiene una clave privada que no se puede leer. El servidor arranca con un proyecto de relleno y rechaza todas las sesiones, así que **en `localhost` falla todo lo que pasa por el servidor**: sincronización de Calendar, comentarios, catálogo compartido y donaciones.

Lo vi en el log al probar el guardado. No sé si en producción la variable está bien: hay que revisarlo en Vercel. Mientras siga así en local, ninguna mejora que toque el servidor (el punto 3.2, por ejemplo) se puede probar antes de publicar.

### 0.2 Publicar lo que está hecho · S

El rediseño completo está sin commitear. Conviene commitearlo y publicarlo antes de seguir, para que las próximas mejoras se revisen de a una y no mezcladas con 44 archivos.

### 0.3 Probar lo que quedó sin ejecutar · S

Quedó revisado en código pero no ejecutado contra una cuenta real:

- Crear, editar y eliminar carreras.
- La importación con datos reales de SIU Guaraní (necesita la extensión instalada).
- Que al borrar una materia se limpie de las correlativas de las demás.
- El arreglo del desfase de 3 horas en Google Calendar (tiene tests, pero no lo vi crear un evento real).

### 0.4 Limpiar el código muerto de WhatsApp · S

El bot está retirado, pero quedan la ruta `api/whatsapp/webhook`, el cron `send-reminders` (responde 503) y los campos `notificaciones_whatsapp` y `telefono_whatsapp` en el perfil. Si Telegram va a ser el camino (ESTRATEGIA.md, 4.4), conviene sacar esto para que no confunda.

---

## 1. Guardar lo que la extensión ya lee · ✅ hecho

La extensión lee de Historia académica cada regularidad, promoción y examen, con su fecha, su nota y el vencimiento de la regularidad. La importación descartaba todo eso; ahora lo guarda en cada materia (`actos_academicos`).

**Para que aparezca hay que volver a sincronizar una vez.** Las cuentas que ya importaron no tienen esos datos, y tampoco tienen la fecha de aprobación: lo comprobé en la tuya, donde las 16 materias aprobadas están sin fecha.

**Pendiente tuyo:** publicar `firestore.rules`, que suma un tope de 60 actos por materia. Sin publicarlas todo funciona igual; el tope es solo una protección.

**Corrección a la primera versión de esta lista:** decía que el período de cursada se descartaba y que por eso un gráfico aparecía vacío. No era así: lo que trae la extensión en ese campo es el cuatrimestre *del plan* (y ya se guarda), no cuándo cursaste. El "cuándo" sale de las fechas de la historia académica.

---

## 2. Gráficos · primera tanda ✅ hecha

**Hecho:**

- Cuatro cifras arriba: aprobadas, promedio (y promedio con aplazos cuando hay historia), tu mejor año y tu ritmo.
- **Tu carrera en el tiempo**: materias aprobadas acumuladas año por año, con la meta de la carrera marcada, y vista alternativa "por año".
- **Tu promedio en el tiempo.**
- **Avance por año del plan**, con aprobadas, regulares y cursando en una barra.
- **Notas finales**: ahora cuenta una nota por materia (antes mezclaba parciales con finales).
- **Materias por estado**: tocar un estado abre la lista de materias ya filtrada.
- **Regularidades por vencer** y **cómo aprobaste** (promoción o examen final): aparecen solos cuando hay historia académica.
- Los cálculos están en `src/lib/estadisticas.ts`, con 13 tests.

**Lo que no pude ver con datos reales:** los gráficos de tiempo, regularidades y "cómo aprobaste" dependen de datos que tu cuenta todavía no tiene. Los probé con datos de ejemplo (se dibujan bien) y los cálculos tienen tests, pero falta verlos con una sincronización real.

**Queda para una segunda tanda:**

- **Proyección de egreso** ("a este ritmo te recibís en 2028"). No la hice: es una de las decisiones tuyas del final de este documento. · S
- **Imagen para compartir** tu avance. También espera tu decisión. · S
- **Aprobadas por cuatrimestre**, además de por año. · S
- **Vista de tabla** de cada gráfico, para lector de pantalla y para copiar los números. · S
- **Colores para daltonismo:** los colores de estado no los validé con una herramienta; hoy cada color va acompañado de su nombre y su número, así que no dependen solo del color, pero conviene medirlo. · S

---

## 3. Calendarios: Apple, Samsung, Outlook · S + M

Hoy la app solo habla con Google Calendar, por su API. Apple y Samsung no ofrecen una API equivalente para que una web escriba en el calendario de alguien. El estándar que sí aceptan todos es el formato **iCalendar (.ics)**, y hay dos formas de usarlo.

### 3.1 Botón "Agregar a mi calendario" · ✅ hecho

Descarga un archivo `.ics` que el teléfono o la computadora ofrece sumar al calendario que tengas: Apple, Samsung, Outlook, cualquiera. Está en tres lugares:

- En cada fecha de una materia (menú de la fecha → "Agregar a mi calendario").
- En el inicio, debajo de "Lo que viene" → "Llevar a mi calendario", con todas las próximas.
- En Configuración → Calendario → "Descargar mis próximas fechas".

Cada evento lleva los mismos dos recordatorios que en Google (un día y una hora antes). Si volvés a descargar después de cambiar una fecha, el calendario actualiza el evento que ya tenía en vez de duplicarlo.

**Límites que hay que conocer:**

- Es una copia: un cambio hecho en Monteflori no llega solo al calendario. Para eso está el punto 3.2.
- **Probado en el navegador** con una fecha real: el archivo sale con la hora bien pasada a UTC y los dos recordatorios, desde la materia y desde Configuración.
- ⚠️ **No lo probé en un iPhone ni en un Samsung.** El archivo sigue el estándar y tiene 12 tests de formato, pero cómo lo abre cada teléfono (sobre todo Safari en iPhone, que a veces muestra el archivo en vez de ofrecer agregarlo) hay que verlo en el dispositivo.
- Las horas se escriben asumiendo hora de Argentina (UTC-3, sin horario de verano). Si la app se usara desde otro país, eso hay que revisarlo.

### 3.2 Calendario suscripto que se actualiza solo · M

Monteflori publica una dirección privada por usuario, del estilo `webcal://monteflori.com/api/calendario/<clave-secreta>.ics`. El usuario la agrega **una sola vez** y su calendario la vuelve a consultar cada tanto: las fechas nuevas, cambiadas o borradas se reflejan solas.

- **Apple Calendar** (iPhone y Mac): soporta suscripciones a calendarios por dirección. Es el caso que mejor anda.
- **Outlook:** también las soporta.
- ⚠️ **Samsung Calendar:** hasta donde sé, no se suscribe a una dirección por sí solo; muestra los calendarios de las cuentas que el teléfono tiene agregadas (Google, Outlook, Samsung). El camino para un usuario de Samsung sería la sincronización con Google que ya existe (la mayoría de los Samsung tienen una cuenta de Google) o el botón del punto 3.1. **Esto hay que confirmarlo en un Samsung real antes de prometerlo en la pantalla.**

**Cosas a decidir y cuidar:**

- La dirección es la llave: quien la tenga ve las fechas. Tiene que ser larga, imposible de adivinar, y **regenerable** desde Configuración por si se filtra. No debe incluir nada más que fechas de examen (ni notas ni nombre completo).
- Cada calendario decide cada cuánto consulta. No es instantáneo como Google: un cambio puede tardar horas en verse, y eso hay que decirlo en la pantalla.
- Va por el servidor, así que **depende de resolver el punto 0.1** para poder probarlo.
- Costo: cada consulta lee las materias del usuario en Firestore. Con caché de una hora es poco, pero hay que ponerle rate limit como al resto.

### 3.3 Reordenar la pantalla · ✅ hecho

En Configuración, "Google Calendar" pasó a ser **"Calendario"**, con dos opciones: Google (automático) y "Apple, Samsung, Outlook u otro" (descarga). Cuando exista el punto 3.2 se suma ahí como tercera opción.

**Falta:** el punto 3.2, que depende de arreglar la clave del servidor (punto 0.1).

---

## 4. Para el día a día del estudiante

### 4.1 "¿Cuánto necesito sacar?" · S

Con la fórmula que ya modelaste, invertir la cuenta: *"con lo que llevás, necesitás 8 o más en el final para promocionar; con 6 aprobás"*. Va en el detalle de la materia, debajo de la nota actual. Es la pregunta que todo estudiante se hace antes de un final (ESTRATEGIA.md, 5.2).

### 4.2 Simulador "qué pasa si" · M

En Plan de carrera: marcar materias como si las aprobaras y ver qué se habilita. Se apoya en el grafo de correlativas, que ya está hecho y testeado (ESTRATEGIA.md, 5.5).

### 4.3 Horarios de cursada · M

Día, hora y aula de cada materia, con una vista de semana en el inicio y aviso de superposiciones. Hoy la app sabe qué cursás pero no cuándo.

### 4.4 Asistencia · S

El campo `asistencia_actual` y `requiere_asistencia` ya existen en el modelo y no se usan en ninguna pantalla. Contador de faltas por materia con aviso al acercarse al límite.

### 4.5 Notas con escalas distintas · S

Todo asume notas de 0 a 10. Hay cátedras que usan porcentaje o conceptos (aprobado / desaprobado). Hoy un "aprobado" sin número no se puede cargar.

---

## 5. Llegar y volver

### 5.1 Instalable en el celular (PWA) · S

Agregar el manifiesto y el ícono para que se instale desde el navegador, con pantalla completa y sin pasar por ninguna tienda. La navegación ya está pensada para eso (ESTRATEGIA.md, 6).

### 5.2 Alertas de vencimiento de regularidad · M

Depende del punto 1. Perder una regularidad obliga a recursar: un aviso a 90, 30 y 7 días es de lo más valioso que puede hacer la app, y ningún competidor tiene el dato (ESTRATEGIA.md, 5.1). Primera versión: un aviso en el inicio. Las notificaciones push vienen después.

### 5.3 Recordatorios · M

Hoy los únicos recordatorios son los de Google Calendar. Dos caminos: notificaciones push de la PWA, o Telegram (gratis, ESTRATEGIA.md, 4.4). Decidir uno antes de construir.

### 5.4 Plan de estudios pre-cargado · L

La deuda más grande frente a la competencia: elegir tu carrera de una lista y arrancar con todo cargado. El catálogo compartido ya junta las materias de cada facultad; falta guardar también la estructura del plan (año, cuatrimestre, correlativas) y ofrecerla al crear la carrera (ESTRATEGIA.md, 5.3).

### 5.5 Importar sin extensión · L

La extensión solo funciona en computadora. Alternativa para el celular: subir una captura o el PDF de Historia académica. Es lo que hace la competencia, y requiere un servicio de lectura de imágenes con costo por uso: hay que hacer la cuenta antes.

### 5.6 Extensión en la Chrome Web Store · S

Hoy se instala en modo desarrollador con cinco pasos manuales. Publicarla la baja a un clic. Es el paso 10 de PASOS-MANUALES.md.

---

## 6. Pulido de lo que ya está

Cosas chicas que vi durante la revisión y no entraron:

- **Nombre de la facultad al importar.** Las carreras quedan con `autogestion.guarani.unsj.edu.ar` como facultad. Conviene traducirlo a un nombre legible ("UNSJ") al importar. · S
- **Reordenar notas y grupos.** Las evaluaciones se muestran en orden de carga; poder ordenarlas por fecha. · S
- **Deshacer en vez de confirmar.** Para borrar una nota o una fecha, un aviso con "Deshacer" es más ágil que el diálogo de confirmación. · S
- **Buscador global.** Un atajo para saltar a cualquier materia desde cualquier pantalla. · S
- **Exportar mis datos.** Un botón que descargue todo en un archivo, y otro para eliminar la cuenta. Hoy no hay forma de irse con los datos ni de borrarse. · S
- **Accesibilidad.** Los colores nuevos mejoran el contraste, pero no hice una pasada completa con lector de pantalla ni solo con teclado. · M
- **Tests de pantallas.** Los 151 tests cubren la lógica (notas, correlativas, calendario) y ninguna pantalla. Un puñado de pruebas de punta a punta de los flujos principales evitaría romper algo en el próximo cambio grande. · M

---

## Decisiones que son tuyas

Además de las siete que siguen abiertas en ESTRATEGIA.md (sección 7):

- [ ] **Calendarios:** ¿solo el botón de descarga (3.1), o también la suscripción (3.2)? La segunda es mejor experiencia pero suma una dirección privada que hay que cuidar.
- [ ] **Recordatorios:** ¿push de la PWA o Telegram?
- [ ] **Proyección de egreso (2.1):** ¿se muestra? Motiva a quien viene bien y puede desalentar a quien viene atrasado, que es justo a quien la app quiere ayudar.
- [ ] **Imagen para compartir (2.4):** ¿encaja con el tono de la app?
