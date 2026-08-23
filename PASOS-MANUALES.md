# Pasos manuales pendientes

Cosas que **solo podés hacer vos** porque requieren crear cuentas, generar credenciales o tomar decisiones de negocio. Están ordenadas por urgencia: de arriba hacia abajo.

Cada paso dice qué pasa si no lo hacés, así podés decidir qué postergar sin sorpresas.

> **Nota sobre las instrucciones**: las interfaces de Google, Meta, Mercado Pago y Sentry cambian seguido. Si un botón no se llama exactamente como acá, buscá el que haga lo mismo — describo también *qué* estás buscando, no solo dónde hacer clic.

---

## 🔴 Urgente — hay un agujero de seguridad abierto ahora mismo

### 1. Publicar las reglas nuevas de Firestore

**Por qué es urgente**: las reglas que están publicadas hoy dejan que cualquier usuario escriba **cualquier campo** de su propio documento desde la consola del navegador. Con el sistema de donaciones nuevo, eso significa que alguien puede marcarse como donante sin pagar. Las reglas corregidas ya están en el repo (`firestore.rules`), pero **el repo no las despliega solo**.

**Pasos**:

1. Abrí [console.firebase.google.com](https://console.firebase.google.com) y entrá a tu proyecto **monteflori**.
2. En el menú de la izquierda: **Compilación → Firestore Database**.
3. Pestaña **Reglas** (arriba, al lado de "Datos").
4. Abrí el archivo [`firestore.rules`](firestore.rules) de este repo, copiá **todo** el contenido.
5. Pegalo reemplazando lo que haya en el editor de la consola.
6. Clic en **Publicar**.

**Cómo verificar que funcionó**: en la consola de Firebase, la pestaña Reglas debería mostrar la fecha de publicación actualizada a "hace unos segundos". Si querés probarlo de verdad: entrá a la app, abrí la consola del navegador (F12) e intentá escribir el campo `suscripcion` de tu usuario — debería fallar con "Missing or insufficient permissions".

---

### 1.b Publicar las reglas nuevas de Storage

Junto con las de Firestore, hay que republicar las de Storage. **Había un agujero real**: el nombre del archivo del avatar salía del archivo que subía el usuario, así que renombrándolo (`a.png`, `b.png`, …) se podían acumular subidas de 5 MB sin tope en tu cuenta. Ahora el código guarda siempre en la misma ruta y las reglas solo permiten escribir ahí.

1. Firebase Console → **Compilación → Storage** → pestaña **Reglas**.
2. Copiá todo el contenido de [`storage.rules`](storage.rules) y pegalo.
3. **Publicar**.

> Si ya tenías un avatar subido con el esquema viejo, va a seguir viéndose (la lectura sigue permitiendo cualquier nombre); la próxima vez que subas uno nuevo pasa a la ruta fija.

---

### 1.c Índices de Firestore para el catálogo y los comentarios

**Qué rompe si no lo hacés**: la búsqueda de "esta materia ya existe" no devuelve nada y los comentarios no cargan. El resto de la app anda igual.

Firestore necesita índices compuestos para estas consultas. La forma más fácil de crearlos:

1. Usá la app normalmente (creá una materia, entrá a una que tenga comentarios).
2. Abrí la consola del navegador (F12). Cuando falte un índice, Firebase imprime un error con un **link directo** para crearlo.
3. Clic en el link → **Crear índice**. Tarda unos minutos en construirse.

Los que van a hacer falta:

| Colección | Campos |
|---|---|
| `catalogo_materias` | `institucion_id` (asc) + `nombre_normalizado` (asc) |
| `comentarios` (grupo de colecciones) | `oculto` (asc) + `puntaje` (desc) |
| `comentarios` (grupo de colecciones) | `reportes` (desc) — para el panel de moderación |

> Los dos de `comentarios` son de tipo **grupo de colecciones** (collection group), no de colección simple. Si los creás a mano en vez de por el link, elegí esa opción.

---

### 1.d Configurar quién modera (`ADMIN_UIDS`)

**Qué rompe si no lo hacés**: el panel de moderación en `/admin/moderacion` responde "no encontrado" para todos, incluido vos. Los comentarios reportados se siguen ocultando solos al llegar a 3 reportes, pero no vas a poder revisarlos ni restaurarlos.

1. Necesitás tu UID de Firebase. Entrá a la app, abrí la consola (F12) y ejecutá:
   ```js
   firebase.auth().currentUser.uid
   ```
   Si eso no funciona, buscalo en Firebase Console → **Authentication** → tu usuario → columna "Identificador de usuario".

2. En Vercel → **Settings → Environment Variables**:

   | Key | Value |
   |---|---|
   | `ADMIN_UIDS` | Tu UID. Si son varios, separados por coma sin espacios. |

3. Redeployá.

> A propósito no es un campo en la base: si lo fuera, sería una superficie más para proteger, y un error en las reglas dejaría que alguien se haga admin solo. Con la variable de entorno, cambiar quién modera requiere entrar a Vercel.

---

### 2. Generar `OAUTH_STATE_SECRET`

**Qué rompe si no lo hacés**: conectar Google Calendar tira error. La app funciona igual en todo lo demás.

**Qué es**: una clave secreta que usa el servidor para firmar el parámetro `state` del flujo OAuth. Sin ella no se puede verificar que quien vuelve de Google es la misma persona que inició el proceso.

**Pasos**:

1. Generá una clave aleatoria. En una terminal:
   ```bash
   openssl rand -base64 32
   ```
   Si no tenés `openssl`, sirve cualquier string aleatorio largo (40+ caracteres). No uses algo adivinable.

2. **En tu máquina**: abrí `.env.local` y agregá la línea:
   ```
   OAUTH_STATE_SECRET=<lo que te dio el comando>
   ```

3. **En Vercel**: entrá a tu proyecto → **Settings → Environment Variables** → **Add New**.
   - Key: `OAUTH_STATE_SECRET`
   - Value: la misma clave
   - Environments: marcá **Production**, **Preview** y **Development**
   - **Save**

4. Redeployá para que tome la variable (Deployments → último deploy → ⋯ → **Redeploy**).

**Importante**: usá **la misma clave** en local y en Vercel solo si te resulta cómodo; en realidad pueden ser distintas (cada entorno firma y verifica con la suya). Lo que **no** puede pasar es que falte.

---

### 3. Registrar el redirect URI de producción en Google Cloud

**Qué rompe si no lo hacés**: conectar Google Calendar desde `monteflori.com` falla con `redirect_uri_mismatch`, aunque funcione en local.

**Por qué**: Google solo acepta redirigir a URLs que registraste explícitamente. Hasta ahora seguro tenés solo la de `localhost`.

**Pasos**:

1. Andá a [console.cloud.google.com](https://console.cloud.google.com) y seleccioná el proyecto asociado a Monteflori (probablemente el mismo que Firebase).
2. Menú → **APIs y servicios → Credenciales**.
3. En la lista **ID de clientes de OAuth 2.0**, hacé clic en el cliente que estás usando (el que corresponde a `GOOGLE_CLIENT_ID`).
4. En **URIs de redireccionamiento autorizados**, agregá (con **+ AGREGAR URI**):
   ```
   https://monteflori.com/api/auth/callback/google-calendar
   https://www.monteflori.com/api/auth/callback/google-calendar
   ```
   Dejá también la de `http://localhost:3000/api/auth/callback/google-calendar` para poder seguir probando en local.
5. **Guardar**.

**Ojo**: los cambios de Google pueden tardar unos minutos en propagarse.

**Cómo verificar**: entrá a `monteflori.com/configuracion` → "Conectar Google Calendar". Si te lleva a la pantalla de consentimiento de Google sin errores, está.

---

## 🟡 Necesario para que funcionen las donaciones

### 4. Decidir el monto mínimo de donación

**Estado actual**: dejé **$5.000 ARS/mes** como valor provisorio.

**Dónde se cambia**: [`src/lib/planes.ts`](src/lib/planes.ts), constante `DONACION_MINIMA_ARS`. Es un solo número, se refleja automáticamente en la página `/donar` y en la validación del servidor.

Avisame el número y lo cambio, o cambialo vos directamente.

---

### 5. Crear la aplicación en Mercado Pago

**Qué rompe si no lo hacés**: el botón "Donar" responde *"Las donaciones todavía no están habilitadas"*. Todo lo demás de la app funciona normal.

**Antes de empezar**: necesitás una cuenta de Mercado Pago. Para cobrar de verdad tiene que estar verificada (con tus datos fiscales). Para **probar sin cobrar plata real**, alcanza con las credenciales de prueba.

#### 5.1 Crear la aplicación

1. Entrá a [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers) e iniciá sesión.
2. Menú **Tus integraciones** → **Crear aplicación**.
3. Completá:
   - **Nombre**: Monteflori
   - **Producto que vas a integrar**: elegí **Suscripciones** (o "Pagos recurrentes" — es lo que usa la app, no pagos sueltos).
4. Creála.

#### 5.2 Copiar las credenciales

Dentro de la aplicación, sección **Credenciales**. Vas a ver dos juegos:

- **Credenciales de prueba** (sandbox): para probar sin mover plata real.
- **Credenciales de producción**: cobran de verdad.

**Empezá por las de prueba.** Copiá el **Access Token**.

#### 5.3 Configurar el webhook

Esto es lo que le avisa a la app cuándo alguien donó o dejó de donar. **Sin esto, las donaciones se cobran pero nadie pasa a nivel donante.**

1. En tu aplicación → sección **Webhooks** / **Notificaciones**.
2. **URL de producción**:
   ```
   https://monteflori.com/api/mercadopago/webhook
   ```
3. **Eventos a suscribir**: marcá los de **suscripciones / preapproval** (algo como "Planes y suscripciones"). No hace falta el resto.
4. Al guardar, Mercado Pago te muestra una **clave secreta** (firma secreta). **Copiala ahora** — en muchos casos solo se muestra una vez.

#### 5.4 Cargar las variables

Igual que en el paso 2, en **Vercel → Settings → Environment Variables**:

| Key | Value |
|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | El access token del paso 5.2 |
| `MERCADOPAGO_WEBHOOK_SECRET` | La clave secreta del paso 5.3 |

Redeployá después de agregarlas.

#### 5.5 Probar sin gastar plata

Con las credenciales **de prueba** cargadas:

1. Entrá a `monteflori.com/donar` y hacé clic en donar.
2. Te lleva al checkout de Mercado Pago.
3. Usá una **tarjeta de prueba** de las que documenta Mercado Pago (buscá "tarjetas de prueba" en su portal de developers — publican números que simulan pagos aprobados y rechazados).
4. Completá el flujo.
5. Volvé a `/configuracion` y fijate si dice "Sos donante".

**Si no cambia el nivel**: el webhook no llegó o falló la firma. En Vercel → Deployments → tu deploy → **Logs** vas a ver los mensajes que empiezan con `[Mercado Pago]`.

#### 5.6 Pasar a producción

Cuando lo hayas probado: reemplazá el access token de prueba por el **de producción** en Vercel y redeployá. Verificá que la URL del webhook de producción esté configurada.

---

## 🟢 Cuando quieras — mejoras y funciones nuevas

### 6. Bot de WhatsApp

**Estado: en pausa, y NO conviene activarlo todavía.**

**Por qué está en pausa**: el webhook (`src/app/api/whatsapp/webhook/route.ts`) **no valida la firma `X-Hub-Signature-256` de Meta**. Sin eso, cualquiera que descubra la URL puede mandar POSTs simulando ser un usuario registrado y leer sus datos académicos.

**Antes de hacer cualquiera de los pasos de abajo, avisame para que agregue esa validación** (es el mismo tipo de firma que ya implementé para el webhook de Mercado Pago, así que es un trabajo acotado). Los pasos de configuración quedan documentados igual para cuando llegue el momento.

#### 6.1 Requisitos previos

- Una **cuenta de Meta Business** (business.facebook.com).
- Un **número de teléfono** que NO esté registrado en WhatsApp normal ni WhatsApp Business app. Si el número ya tiene WhatsApp, primero hay que borrar esa cuenta. Meta te da un número de prueba gratis para empezar.

#### 6.2 Crear la app en Meta

1. Andá a [developers.facebook.com](https://developers.facebook.com) → **Mis apps** → **Crear app**.
2. Tipo de app: **Empresa** (Business).
3. Dentro de la app, en el listado de productos, agregá **WhatsApp**.
4. Te va a pedir asociar una **cuenta de Meta Business**. Elegila o creala.

#### 6.3 Obtener las credenciales

En **WhatsApp → Configuración de la API**:

- **Identificador del número de teléfono** (`Phone number ID`) → va a `WHATSAPP_PHONE_NUMBER_ID`.
- **Token de acceso temporal** → va a `WHATSAPP_ACCESS_TOKEN`.

> ⚠️ **Trampa importante**: el token que te muestra por defecto **vence a las 24 horas**. Sirve para probar, pero para producción necesitás un **token permanente**: se genera creando un *usuario del sistema* en **Meta Business Suite → Configuración del negocio → Usuarios → Usuarios del sistema**, dándole permisos sobre la app de WhatsApp y generando un token sin vencimiento. Si tu bot "dejó de funcionar al día siguiente", casi siempre es esto.

#### 6.4 Inventar el verify token

`WHATSAPP_VERIFY_TOKEN` **no te lo da Meta**: lo inventás vos. Es una contraseña compartida que Meta te devuelve al configurar el webhook, para que tu servidor confirme que la solicitud viene de ellos.

Generá algo aleatorio (mismo comando del paso 2) y guardalo — lo vas a necesitar en dos lugares.

#### 6.5 Cargar las variables en Vercel

| Key | Value |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Token del paso 6.3 |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID del paso 6.3 |
| `WHATSAPP_VERIFY_TOKEN` | El que inventaste en 6.4 |
| `WHATSAPP_API_VERSION` | `v19.0` (o la que esté vigente) |

Redeployá **antes** del paso siguiente: el webhook tiene que estar activo para que Meta pueda verificarlo.

#### 6.6 Configurar el webhook en Meta

1. En **WhatsApp → Configuración** → sección **Webhook** → **Editar**.
2. **URL de devolución de llamada**:
   ```
   https://monteflori.com/api/whatsapp/webhook
   ```
3. **Token de verificación**: el mismo `WHATSAPP_VERIFY_TOKEN` del paso 6.4.
4. **Verificar y guardar**. Meta hace un GET a tu webhook en ese momento; si el token coincide, queda verificado. Si falla, revisá que la variable esté cargada en Vercel y que hayas redeployado.
5. Una vez verificado, en **Campos del webhook** suscribite a **messages**.

#### 6.7 Probar

Mandá un mensaje de WhatsApp al número configurado con el texto `ayuda`. Deberías recibir la lista de comandos.

> Recordá: con el sistema de niveles, el bot solo responde a **donantes activos**. A quien no lo sea le contesta que la función está reservada.

---

### 6.b Activar Firebase App Check (recomendado antes de abrirlo al público)

**Qué resuelve**: tu `NEXT_PUBLIC_FIREBASE_API_KEY` es visible en el navegador (eso es normal y no es un secreto). Pero sin App Check, cualquiera puede tomarla y pegarle a tu Firestore **desde un script**, sin pasar por tu app. App Check hace que Firebase rechace todo lo que no venga de tu sitio real.

El código ya está listo ([`src/lib/firebase.ts`](src/lib/firebase.ts)): si no configurás la variable, App Check simplemente no se activa y todo funciona igual.

#### Pasos

1. **Crear la clave de reCAPTCHA**: andá a [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin) y registrá un sitio nuevo.
   - Tipo: **reCAPTCHA v3**
   - Dominios: `monteflori.com`, `www.monteflori.com` y `localhost`
   - Al crearlo te da una **clave de sitio** (site key) y una **clave secreta**.

2. **Registrar la app en Firebase**: Firebase Console → ⚙️ **Configuración del proyecto** → pestaña **App Check** → elegí tu app web → proveedor **reCAPTCHA v3** → pegá la **clave secreta** del paso 1 → Guardar.

3. **Cargar la site key**: en Vercel → Environment Variables:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | La **clave de sitio** (la pública, no la secreta) |

   Agregala también a tu `.env.local` si querés probarlo en local.

4. **Redeployá**.

5. **Empezá en modo monitoreo**: en Firebase Console → App Check → pestaña **APIs**, vas a ver Firestore y Storage. Dejalos **sin aplicar** (unenforced) unos días y mirá las métricas: te muestran qué porcentaje de pedidos vienen verificados. Cuando veas que casi todo está verde, recién ahí activá **Aplicar** (enforce).

> ⚠️ **No actives "Aplicar" de una**: si algo quedó mal configurado, dejás afuera a todos los usuarios (incluido vos) hasta que lo arregles. El modo monitoreo existe justamente para eso.

**Para desarrollo local**: la primera vez que corras la app con la variable puesta, Firebase imprime en la consola del navegador un *debug token*. Copialo y registralo en Firebase Console → App Check → tu app → menú ⋮ → **Administrar tokens de depuración**. Si no, en local vas a quedar bloqueado cuando actives el enforcement.

---

### 6.c Prender el proxy de Cloudflare (DDoS y rate limiting gratis)

Cuando configuramos el dominio te dije de dejar la nube **gris** — era necesario para que Vercel pudiera emitir el certificado SSL. Una vez que el dominio figure como **Valid Configuration** en Vercel, podés prenderlo y ganás protección contra tráfico masivo sin pagar nada.

1. En Cloudflare → **SSL/TLS** → **Overview**: poné el modo en **Full (strict)**.
   **Este paso va primero.** Si lo dejás en "Flexible" (el default) y prendés el proxy, se arma un loop de redirects y el sitio se cae.
2. Recién ahí, en **DNS**, pasá a **naranja** (Proxied) los registros que apuntan a Vercel.
3. Entrá al sitio y verificá que cargue bien con HTTPS.

Con el proxy activo ganás automáticamente mitigación de DDoS. Si además querés reglas de rate limiting propias, están en **Security → WAF → Rate limiting rules** (el plan gratis incluye una regla).

> Si algo se rompe, volver la nube a gris revierte el cambio en segundos.

---

### 7. Sentry (reporte de errores)

**Qué te perdés si no lo hacés**: cuando a alguien le explote algo en producción, no te enterás salvo que te avise.

El código ya está listo — sin las variables, simplemente no reporta nada.

1. Creá una cuenta en [sentry.io](https://sentry.io) (el plan gratis alcanza de sobra).
2. Creá un proyecto de tipo **Next.js**.
3. Copiá el **DSN** que te muestra (una URL tipo `https://algo@algo.ingest.sentry.io/123`).
4. En Vercel, agregá:

| Key | Value |
|---|---|
| `SENTRY_DSN` | El DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | El mismo DSN |
| `SENTRY_ORG` | El slug de tu organización (está en la URL de Sentry) |
| `SENTRY_PROJECT` | El slug del proyecto |

5. Redeployá.

**Cómo verificar**: entrá a una URL rota de tu app o forzá un error, y fijate si aparece en el panel de Sentry en un par de minutos.

---

### 8. Verificar que el dominio quedó bien

Quedó a medias en nuestra última conversación. Revisá en Vercel → **Settings → Domains** que `monteflori.com` figure como **Valid Configuration** (no "Generating SSL Certificate" ni "DNS Change Recommended").

Si sigue trabado, lo más probable sigue siendo:
- En Cloudflare, los registros DNS que apuntan a Vercel tienen que estar con la **nube gris** (DNS only), no naranja.
- El registro de la raíz (`@`) debe ser el **CNAME** que te indicó Vercel, no un registro A viejo.

También asegurate de que `NEXT_PUBLIC_APP_URL` en Vercel valga `https://monteflori.com` — si quedó en `localhost`, los redirects de OAuth y los `back_url` de Mercado Pago van a apuntar mal.

---

### 9. Repasar que todas las variables estén en Vercel

Checklist completa de lo que la app usa hoy. Todo lo que esté vacío en Vercel simplemente desactiva esa función (salvo las de Firebase, que son obligatorias).

| Variable | ¿Obligatoria? | Para qué |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (6) | **Sí** | Login y base de datos |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | **Sí** | Operaciones del servidor |
| `NEXT_PUBLIC_APP_URL` | **Sí** | Redirects de OAuth y pagos |
| `NEXT_PUBLIC_EXTENSION_ID` | Sí, si usás la extensión | Puente con la extensión |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | No, pero recomendada | Firebase App Check (ver 6.b) |
| `ADMIN_UIDS` | Sí, para moderar comentarios | Panel de moderación (ver 1.d) |
| `OAUTH_STATE_SECRET` | Sí, si usás Calendar | Seguridad del OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Sí, si usás Calendar | Google Calendar |
| `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_WEBHOOK_SECRET` | Sí, si querés donaciones | Donaciones |
| `CRON_SECRET` | Sí, si usás recordatorios | Protege el cron diario |
| `WHATSAPP_*` (4) | No (en pausa) | Bot de WhatsApp |
| `SENTRY_*` | No | Reporte de errores |

> **Ojo con el cron**: `vercel.json` tiene programado un recordatorio diario a las 11:00 UTC (8 de la mañana en Argentina) que pega a `/api/cron/send-reminders`. Esa ruta manda mensajes por WhatsApp — mientras el bot esté en pausa no hace nada útil, pero conviene tener `CRON_SECRET` configurado igual para que nadie más pueda invocarla.

---

### 10. Publicar la extensión en la Chrome Web Store (opcional)

Hoy la extensión se descarga como `.zip` desde `/extension` y se instala en modo desarrollador. Funciona, pero le pide a la gente varios pasos manuales y muestra advertencias de Chrome.

Publicarla en la Chrome Web Store implica:
- Pagar **$5 USD una vez** (cuenta de desarrollador).
- Un proceso de revisión de Google que puede tardar días, y que suele pedir justificar por qué la extensión necesita los permisos que pide.
- Cada actualización pasa por revisión de nuevo.

**No es urgente** — el flujo actual funciona. Es más una cuestión de qué tan pulido querés que se sienta para gente no técnica.

> Si la publicás, el **ID de la extensión cambia** salvo que subas la misma clave pública que ya está fijada en `extension/manifest.json`. Está puesta justamente para que el ID se mantenga (`hlncdppelkcpkgadmeanalfeoobajeac`) — no la borres.

---

## Lo que queda pendiente de mi lado

Para que tengas el panorama completo, esto es lo que falta y **no** depende de vos:

- **Validar la firma del webhook de WhatsApp** (bloquea el punto 6).
- **Páginas legales** (privacidad y términos): necesito que me digas qué querés declarar y qué contacto poner.
- **Tests end-to-end** (hoy hay 81 tests, pero solo de lógica pura, no de flujos completos).
- **CI en GitHub Actions** para que corran los tests en cada push.
- **Manifest PWA** para "Agregar a inicio" en el celular.

Decime cuál querés que encare y lo hago.
