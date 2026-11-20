# Yotu — espacio privado para parejas

Aplicación web privada para dos personas: citas, sorpresas, gustos, notas, fechas importantes y recuerdos.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth, PostgreSQL con RLS, Storage) · Zod · Vitest + PGlite.

## Estado por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Registro, inicio de sesión, perfiles, creación y vinculación de parejas | ✅ Implementada |
| 2 | Citas y calendario compartidos, actividades personales, privacidad, notas diarias, disponibilidad y acuerdos económicos voluntarios | ✅ Implementada |
| 3 | Hablemos: borradores privados, conversaciones, pausas, resolución mutua y acuerdos | ✅ Implementada (sin asistente de IA) |
| 4 | Citas sorpresa y contenido bloqueado; gustos, recuerdos y fotos | Pendiente |
| 5 | Google Calendar y notificaciones avanzadas | Pendiente |

## Puesta en marcha

### 1. Crear el proyecto de Supabase

1. Crea un proyecto gratuito en <https://supabase.com/dashboard>.
2. **SQL Editor →** pega y ejecuta el contenido de cada archivo de `supabase/migrations/` en orden (por nombre).
   Alternativa con CLI: `npx supabase link --project-ref <ref>` y `npx supabase db push`.
3. **Authentication → Sign In / Providers → Email:** activado, con *Confirm email* activado.
   Sube la longitud mínima de contraseña a 8 (la app ya la exige en el servidor).
4. **Authentication → URL Configuration:**
   - *Site URL*: la URL de producción (p. ej. `https://tu-app.vercel.app`).
   - *Redirect URLs*: añade `http://localhost:3000/**` y la URL de producción, por ejemplo `https://yesicacausado.github.io/yotu/**`.
5. **Authentication → Emails → Templates** (recomendado, permite abrir el enlace en cualquier dispositivo):
   - *Confirm signup*: cambia el enlace por
     `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
   - *Reset password*: cambia el enlace por
     `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`

   Con las plantillas por defecto también funciona, pero el enlace debe abrirse en el mismo navegador donde se hizo el registro.
6. **Project Settings → API:** copia la URL y la clave `anon` (pública).

> El servicio de correo integrado de Supabase tiene un límite muy bajo de envíos por hora. Para uso real configura un SMTP propio en **Authentication → Emails → SMTP Settings**.

### Publicar en GitHub Pages

La aplicación se exporta como sitio estático de Next.js al directorio `out/`. El workflow `.github/workflows/deploy-pages.yml` publica ese artefacto cuando se actualiza `main` o `master`.

1. En GitHub, abre **Settings → Pages** y elige **GitHub Actions** como fuente de publicación.
2. En **Settings → Secrets and variables → Actions → Variables**, crea:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave publicable (`sb_publishable_...` o la clave `anon`).
3. En Supabase, aplica las migraciones de `supabase/migrations/` en orden. Configura *Site URL* como `https://yesicacausado.github.io/yotu/` y permite ese dominio bajo **Redirect URLs**, incluyendo `https://yesicacausado.github.io/yotu/auth/confirm/`.
4. Publica el workflow y revisa **Actions** para confirmar el despliegue. La aplicación quedará en `https://yesicacausado.github.io/yotu/`.

GitHub Pages no ejecuta Node.js: la autenticación y las consultas se realizan desde el navegador con la clave publicable de Supabase, y la base de datos debe protegerse con las políticas RLS/RPC existentes. No agregues `service_role` ni una clave secreta a las variables del workflow.

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública `anon`; segura en el navegador porque la RLS protege los datos |
| `NEXT_PUBLIC_SITE_URL` | URL de respaldo para enlaces; en el navegador se deriva del dominio actual y el `basePath` |

La aplicación no necesita una clave secreta de servidor. **Nunca** uses la clave `service_role` con prefijo `NEXT_PUBLIC_`.

### 3. Ejecutar

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

### 4. Despliegue en Vercel

1. Importa el repositorio en Vercel.
2. Añade las tres variables de entorno (en *Production* `NEXT_PUBLIC_SITE_URL` = dominio final).
3. Añade el dominio a *Redirect URLs* en Supabase.

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Compilación de producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Comprobación de tipos |
| `pnpm test` | Pruebas unitarias y de base de datos (RLS) |

Las pruebas de base de datos ejecutan **las migraciones reales** sobre PostgreSQL embebido (PGlite) con una réplica mínima de `auth` y `storage` de Supabase (`tests/db/supabase-stub.sql`), y comprueban las políticas RLS como usuarios distintos. No necesitan Docker ni conexión.

## Estructura

```
supabase/migrations/   SQL versionado (tablas, RLS, funciones RPC, Storage)
tests/db/              Pruebas de RLS con PGlite
src/app/               Rutas (App Router)
  (auth)/              login, registro, recuperar, nueva-contrasena
  (app)/               zona privada: inicio, citas, calendario, Hablemos, pareja, perfil
  auth/confirm/        callback estático de los enlaces de correo
  invitacion/          aceptación de invitación (token en query string)
src/components/        ui/ (sistema de diseño), layout/, couple/, profile/, forms/
src/features/*/        acciones cliente y componentes por módulo
src/lib/               supabase/ (clientes), dal.ts, validation.ts, dates.ts, ...
.github/workflows/     build estático y publicación en GitHub Pages
```

## Seguridad (resumen)

- **RLS en todas las tablas** con permisos concedidos explícitamente (incluso por columna).
- Crear pareja, invitar, aceptar, anular y salir solo mediante funciones `SECURITY DEFINER` con validación atómica.
- Máximo dos miembros por pareja (trigger con bloqueo de fila) y una pareja por persona (`UNIQUE`).
- Invitaciones: token aleatorio de ~244 bits, se guarda solo su SHA-256, un solo uso, caducan en 7 días, anulables; límite de 10 por hora.
- La sesión se gestiona desde el cliente de Supabase porque GitHub Pages no ejecuta Node.js; la interfaz protege la navegación y RLS/RPC autorizan cada operación de datos.
- Avatares en bucket **privado**, cada persona solo escribe en su carpeta; se sirven con URLs firmadas de 1 hora; la imagen se recorta y re-codifica en el navegador (elimina EXIF/GPS).
- Citas vinculadas al identificador de la pareja con RLS; sus portadas se guardan en un bucket privado y los cambios se transmiten por Supabase Realtime.
- Actividades personales asociadas a su creador y pareja; la información privada queda separada y solo se consulta mediante RPC con campos filtrados según visibilidad. Las notas diarias tienen RLS exclusiva del usuario.
- El calendario conjunto recibe solo invalidaciones sin contenido de horarios visibles; los eventos privados no generan sincronización hacia la pareja. La disponibilidad considera 07:00–22:00 y muestra espacios desde 60 minutos.
- Los presupuestos de citas se organizan en COP mediante invitación, aportes, división o presupuesto conjunto. Las propuestas y contraofertas se conservan; solo una propuesta aceptada por ambos actualiza el acuerdo. Los gastos reales registran quién pagó y quién los asumió; no hay transferencias ni deudas automáticas.
- Los avisos económicos se guardan para cada integrante y se sincronizan en tiempo real; los acuerdos aceptados no se pueden editar directamente y cualquier cambio de reparto requiere otra propuesta aceptada.
- Hablemos guarda borradores solo para su autor; los registros compartidos, respuestas, pausas, estados de resolución mutua y acuerdos tienen RLS y RPCs propios, con avisos por integrante y sincronización en tiempo real. No se envían textos emocionales a servicios externos; el asistente de IA se dejó para una etapa futura.
- Redirecciones `?next=` validadas contra redirecciones abiertas; `Referrer-Policy: no-referrer` se define en los metadatos estáticos, incluidos los enlaces de invitación.
- Mensajes de error que no revelan si un email está registrado.

### Decisión: salir de la pareja

Quien sale pierde el acceso inmediatamente; los datos compartidos quedan con la persona que permanece. Si no queda nadie, la pareja y todos sus datos se eliminan.

## Limitaciones conocidas (Fase 1)

- El acceso es con **email y contraseña** (Supabase Auth identifica las cuentas por email); el nombre visible se elige en el perfil.
- No hay eliminación de cuenta desde la app todavía.
- No se pueden reenviar los correos de confirmación desde la interfaz.
