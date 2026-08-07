# Monteflori

Sistema de gestión académica pensado para motivar y hacer seguimiento del progreso universitario: notas, materias, correlativas y fechas importantes en un solo lugar, sin tener que cargar todo a mano.

Incluye una extensión de navegador que lee tus materias y notas directamente desde **SIU Guaraní** (el sistema académico que usan la mayoría de las universidades públicas argentinas) para que no tengas que instalar ningún programa aparte ni tipear todo manualmente.

> ⚠️ Este proyecto corre sobre versiones de Next.js, React y Firebase más nuevas que las habituales, con cambios de comportamiento respecto a lo estándar. Antes de asumir convenciones "de siempre", revisá `AGENTS.md` y la documentación empaquetada en `node_modules/next/dist/docs/`.

📋 **[PASOS-MANUALES.md](PASOS-MANUALES.md)** — configuración pendiente que requiere crear cuentas o generar credenciales (Firestore, Google, Mercado Pago, WhatsApp, Sentry), explicada paso a paso.

## Stack

- **Next.js** (App Router) + **React** + **TypeScript** + **Tailwind CSS**
- **Firebase**: Auth, Firestore, Storage
- **Google Calendar API** — sincronización de fechas de exámenes
- **WhatsApp Cloud API** — bot de recordatorios y consultas (en pausa, ver [Estado del bot de WhatsApp](#estado-del-bot-de-whatsapp))
- **Extensión de Chrome** (Manifest V3) — scraping de SIU Guaraní
- **Vitest** — tests unitarios del motor de cálculo de notas

## Empezar

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

### Variables de entorno

Copiá `.env.local.example` (o creá `.env.local` a mano) con estas claves:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Config del SDK de Firebase (cliente) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ídem |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ídem |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ídem |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ídem |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ídem |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON del service account, para `firebase-admin` (API routes, server-side) |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app (usada en redirects de OAuth) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth de Google Calendar (ambas server-side) |
| `NEXT_PUBLIC_EXTENSION_ID` | ID de la extensión de Chrome (ya viene fijo en `extension/manifest.json`, no hace falta generarlo de nuevo) |
| `OAUTH_STATE_SECRET` | Firma el parámetro `state` del OAuth de Google (anti-CSRF). Generalo con `openssl rand -base64 32` |
| `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_WEBHOOK_SECRET` | Donaciones recurrentes (ver [Niveles](#niveles-gratis-y-donante)) |
| `CRON_SECRET` | Protege el endpoint `/api/cron/send-reminders` |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_API_VERSION` | WhatsApp Cloud API |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Reporte de errores (opcional, ver [Observabilidad](#observabilidad)) |

### Firebase: pasos que hay que hacer a mano en la consola

Estos dos pasos **no** están en el repo — hay que hacerlos una vez por proyecto de Firebase:

1. **Crear la base de datos de Firestore** en [console.firebase.google.com](https://console.firebase.google.com) → Firestore Database → Crear base de datos. Si nunca se hizo, cualquier lectura/escritura falla con `PERMISSION_DENIED: Cloud Firestore API has not been used...`.
2. **Publicar las reglas de seguridad**: pegar el contenido de [`firestore.rules`](firestore.rules) y [`storage.rules`](storage.rules) en la consola (Firestore Database → Reglas / Storage → Reglas) y publicar. El repo no las despliega solo — sin esto, todo falla con `Missing or insufficient permissions`.

## Niveles: gratis y donante

Monteflori es gratis. Las donaciones existen porque algunas funciones cuestan plata por uso (Google Calendar API, WhatsApp Cloud API, servidor).

| | Gratis | Donante |
|---|---|---|
| Materias, notas, fórmula de cálculo, correlativas, gráficos | ✅ sin límite | ✅ sin límite |
| Extensión de SIU Guaraní | ✅ sin límite | ✅ sin límite |
| Google Calendar | 1 sincronización por mes | ilimitado |
| Bot de WhatsApp | ❌ | ✅ (cuando se habilite, ver más abajo) |

Detalles de implementación:

- La lógica de límites vive en [`src/lib/planes.ts`](src/lib/planes.ts) (pura y testeada) y **se aplica en el servidor**, no en el cliente.
- El nivel donante se activa solo desde el webhook de Mercado Pago (`/api/mercadopago/webhook`), que valida la firma HMAC del header `x-signature` y vuelve a consultar el estado real del preapproval a la API de MP en vez de confiar en el cuerpo de la notificación.
- `firestore.rules` **prohíbe al cliente escribir** `suscripcion`, `uso` y `credenciales_externas` — si no, cualquiera se marcaría donante desde la consola del navegador. Solo el Admin SDK (server-side) puede tocarlos.
- La donación vence sola: si Mercado Pago deja de cobrar, `donante_activo_hasta` pasa y el usuario vuelve a gratis sin proceso manual.

Para habilitarlo hace falta crear una aplicación en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers) y completar `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET`. Sin esas variables, la app funciona normal y el botón de donar devuelve un mensaje de "todavía no habilitado".

## Defensas contra abuso

Como Firebase cobra por uso, la app tiene varias barreras para que nadie pueda inflar la factura:

- **Reglas de Firestore** ([`firestore.rules`](firestore.rules)): además de aislar los datos por usuario, validan tipos y acotan largos de texto y tamaños de lista. Sin eso, la base se puede usar como almacenamiento gratuito (un documento admite hasta 1 MB).
- **Reglas de Storage** ([`storage.rules`](storage.rules)): el avatar se escribe siempre en la ruta fija `avatars/{uid}/avatar`, así cada subida pisa la anterior. Antes el nombre salía del archivo del usuario, así que renombrándolo se podían acumular archivos de 5 MB sin tope.
- **Firebase App Check** ([`src/lib/firebase.ts`](src/lib/firebase.ts)): solo se aceptan pedidos que vengan de la app real, no de scripts externos usando la API key pública. Se activa con `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`; sin esa variable no se inicializa.
- **Rate limiting** ([`src/lib/rate-limit.ts`](src/lib/rate-limit.ts)) en las rutas que gastan cuota de terceros (Google Calendar, Mercado Pago). Es en memoria: frena el abuso obvio, pero **no es un límite global exacto** porque cada instancia serverless tiene su propia memoria. Para tráfico masivo, la defensa real es Cloudflare adelante del dominio.

Los pasos de consola para activar App Check y Cloudflare están en [PASOS-MANUALES.md](PASOS-MANUALES.md).

## Observabilidad

Errores de cliente y servidor se reportan a [Sentry](https://sentry.io) usando la instrumentación nativa de Next.js (`instrumentation.ts` / `instrumentation-client.ts`, no `sentry.*.config.ts` — ese patrón viejo). **Sin `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` configurados, no hace nada** — no requiere cuenta para desarrollar. Para activarlo:

1. Creá una cuenta y un proyecto Next.js en [sentry.io](https://sentry.io)
2. Completá `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` en `.env.local`
3. (Opcional, para subir source maps en el build) `SENTRY_AUTH_TOKEN`

## Tests

```bash
npm test
```

Cubre el motor de cálculo de notas (`src/lib/calculo-notas.ts`): promedios, sistemas ponderado/fórmula custom, reglas de aprobación/promoción y porcentaje de avance. Es la lógica más sensible del sistema (define si a alguien le figura una materia como aprobada o no), así que si la tocás, corré los tests.

## La extensión (SIU Guaraní → Monteflori)

Código en [`extension/`](extension). Chrome no permite instalar extensiones sueltas fuera de la Chrome Web Store salvo en modo desarrollador:

1. `chrome://extensions` → activar "Modo de desarrollador"
2. "Cargar descomprimida" → seleccionar la carpeta `extension/`
3. Desde el portal de SIU Guaraní (plan de estudio), abrir el popup de la extensión → "Sincronizar ahora"
4. Te lleva a `/materias/importar` en el dashboard para revisar y confirmar antes de guardar nada

Instrucciones con descarga de `.zip` para gente no técnica: página pública [`/extension`](src/app/extension/page.tsx).

Si cambiás algo en `extension/`, regenerá el `.zip` descargable con:

```bash
npm run package:extension
```

**Sobre otras universidades**: el scraper está probado contra una instancia real de SIU Guaraní (UNSJ). El sistema es el mismo que usan muchas otras universidades públicas argentinas, pero puede haber variaciones de versión/skin entre instancias que rompan algún selector. Si falla en otra universidad, el error debería llegar con el estado de la app en la consola del navegador (`[Monteflori] ...`) — mandalo para ajustar el parser.

## Estado del bot de WhatsApp

Funcional pero **en pausa** hasta terminar de endurecerlo: el webhook (`src/app/api/whatsapp/webhook/route.ts`) todavía no valida la firma `X-Hub-Signature-256` de Meta en los `POST` entrantes, así que cualquiera que conozca la URL podría mandar mensajes falsos simulando ser un usuario registrado. No reactivar en producción sin resolver esto antes.

## Estructura

```
src/app/(auth)/         páginas de login/registro
src/app/(dashboard)/    dashboard, materias, carreras, correlativas, config
src/app/api/            API routes (calendar, cron, whatsapp)
src/components/         componentes de UI, auth, dashboard, grafo
src/hooks/               hooks de datos (materias, carreras, auth, tema)
src/lib/                 lógica de negocio pura + integraciones (Firestore, cálculo de notas, grafo, motivación)
src/types/               tipos compartidos
extension/               extensión de Chrome (scraper de SIU Guaraní)
```
