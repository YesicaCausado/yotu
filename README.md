# Yotu — espacio privado para parejas

Aplicación web privada para dos personas: citas, sorpresas, gustos, notas, fechas importantes y recuerdos.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth, PostgreSQL con RLS, Storage) · Zod · Vitest + PGlite.

## Estado por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Registro, inicio de sesión, perfiles, creación y vinculación de parejas | ✅ Implementada |
| 2 | Citas, listado y calendario | Pendiente |
| 3 | Citas sorpresa y contenido bloqueado | Pendiente |
| 4 | Gustos, notas, fechas importantes, recuerdos y fotos | Pendiente |
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
   - *Redirect URLs*: añade `http://localhost:3000/**` y `https://tu-app.vercel.app/**`.
5. **Authentication → Emails → Templates** (recomendado, permite abrir el enlace en cualquier dispositivo):
   - *Confirm signup*: cambia el enlace por
     `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
   - *Reset password*: cambia el enlace por
     `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`

   Con las plantillas por defecto también funciona, pero el enlace debe abrirse en el mismo navegador donde se hizo el registro.
6. **Project Settings → API:** copia la URL y la clave `anon` (pública).

> El servicio de correo integrado de Supabase tiene un límite muy bajo de envíos por hora. Para uso real configura un SMTP propio en **Authentication → Emails → SMTP Settings**.

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública `anon`; segura en el navegador porque la RLS protege los datos |
| `NEXT_PUBLIC_SITE_URL` | URL pública de la app (enlaces de correos e invitaciones) |

Ningún secreto de servidor es necesario en la Fase 1. **Nunca** uses la clave `service_role` con prefijo `NEXT_PUBLIC_`.

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
  (app)/               zona privada: inicio, pareja, perfil
  auth/confirm/        destino de los enlaces de los correos
  invitacion/[token]/  aceptar invitación
src/components/        ui/ (sistema de diseño), layout/, couple/, profile/, forms/
src/features/*/        Server Actions por módulo
src/lib/               supabase/ (clientes), dal.ts, validation.ts, dates.ts, ...
src/proxy.ts           Renovación de sesión y redirecciones optimistas
```

## Seguridad (resumen)

- **RLS en todas las tablas** con permisos concedidos explícitamente (incluso por columna).
- Crear pareja, invitar, aceptar, anular y salir solo mediante funciones `SECURITY DEFINER` con validación atómica.
- Máximo dos miembros por pareja (trigger con bloqueo de fila) y una pareja por persona (`UNIQUE`).
- Invitaciones: token aleatorio de ~244 bits, se guarda solo su SHA-256, un solo uso, caducan en 7 días, anulables; límite de 10 por hora.
- La sesión se valida en el servidor con `getUser()`/`getClaims()`; `proxy.ts` es solo una comprobación optimista.
- Avatares en bucket **privado**, cada persona solo escribe en su carpeta; se sirven con URLs firmadas de 1 hora; la imagen se recorta y re-codifica en el navegador (elimina EXIF/GPS).
- Redirecciones `?next=` validadas contra redirecciones abiertas; cabeceras de seguridad y `Referrer-Policy: no-referrer` en las invitaciones.
- Mensajes de error que no revelan si un email está registrado.

### Decisión: salir de la pareja

Quien sale pierde el acceso inmediatamente; los datos compartidos quedan con la persona que permanece. Si no queda nadie, la pareja y todos sus datos se eliminan.

## Limitaciones conocidas (Fase 1)

- El acceso es con **email y contraseña** (Supabase Auth identifica las cuentas por email); el nombre visible se elige en el perfil.
- No hay eliminación de cuenta desde la app todavía.
- No se pueden reenviar los correos de confirmación desde la interfaz.
