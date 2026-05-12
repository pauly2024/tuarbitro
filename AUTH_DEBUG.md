# Guía de Depuración: Problema de localStorage Vacío Después del Login

## Resumen del Problema
El localStorage está vacío después del login y no se guardan los datos de sesión en localStorage, causando que aparezca el error `Timeout en index-D9bld81F.js` porque el código intenta hacer consultas a settings antes de que la sesión exista.

## Causas Comunes

### 1. **detectSessionInUrl: true (PROBLEMA PRINCIPAL)**
- Cuando está activado, Supabase intenta detectar la sesión en la URL
- En navegadores modernos (Chrome, Firefox, Safari) con SameSite=Lax/Strict
- Esto causa que los navegadores **no guarden las cookies** porque detectan posible redirección de tercero
- Resultado: La sesión existe en memoria pero **no se persiste entre recargas**

### 2. **SameSite Attribute Incorrecto**
- Cuando el navegador ve SameSite=Lax desde origin cross-site (ej: localhost → dominio real)
- Bloquea la cookie/almacenamiento de sesión
- Causa: `Cookies blocked` warnings en consola del navegador

### 3. **Falta de persistencia entre recargas de página**
- `onAuthStateChange` se dispara con INITIAL_SESSION pero si no hay datos en localStorage/storage
- La autenticación falla porque el código falla "user not found" en intermediarios

### 4. **Configuración de CORS insuficiente en Supabase**
- Si el proyecto no tiene configurado el dominio correcto en Settings > API
- Las cookies de autenticación pueden ser rechazadas por CORS

---

## Soluciones Implementadas

### Cambios en `supabase.ts`

#### 1. **Desactivado `detectSessionInUrl: true`** ✅
```typescript
auth: {
  detectSessionInUrl: false, // DESACTIVADO - causaba conflictos con navegadores modernos
}
```

#### 2. **Configuración de Cookies Optimizada** ✅
```typescript
auth: {
  cookies: {
    name: 'tuarbitro-auth-token-box',
    lifetime: 60 * 60 * 7, // 7 horas
    domain: '', // Vacío = funciona en todos los subdominios
    path: '/',
    sameSite: 'lax' as const, // 'lax' es más compatible
    secure: import.meta.env.PROD, // Solo HTTPS en producción
  },
}
```

#### 3. **persistSession: true asegurado** ✅
```typescript
auth: {
  persistSession: true, // Asegura que la sesión se guarde
}
```

---

## Verificación de la Solución

### Método 1: Usar la función de debug
```typescript
import { logAuthDebugInfo } from './supabase';

// Después del onAuthStateChange:
await logAuthDebugInfo('Después de login');
```

**Expected Output:**
- `User: true`
- `Session: true`
- `LocalStorage t-auth keys: [..."tuarbitro-auth-v3"...]`
- `Cookies: [...]tuarbitro-auth-token-box=[token]`


### Método 2: Verificar en el navegador
1. Presionar F12 (DevTools)
2. Ir a Application > Local Storage
3. Verificar que exista clave: `tuarbitro-auth-v3`
4. Ir a Application > Cookies
5. Verificar que exista cookie: `tuarbitro-auth-token-box`

### Método 3: Primera Recarga de página
- **Antes del fix:** Al recargar, `isSessionChecking` queda en `true` indefinidamente
- **Después del fix:** La sesión se restaura automáticamente y `isSessionChecking` pasa a `false`

---

## Configuración Requerida en Supabase Dashboard

Ir a: **Project Settings > API**

### Verificar:
✅ **Site URL:** debe incluir tu dominio (ej: `https://app.tuarbitro.com`)
✅ **Redirect URLs:** debe incluir tu dominio de frontend (ej: `https://app.tuarbitro.com/*`)
✅ **CORS Allowed Origins:** debe incluir:
- `https://tuarbitro.com`
- `https://app.tuarbitro.com`
- `http://localhost:*` (para desarrollo)
- `http://*.vercel.app` (si usas despliegues de Vercel)

### Si no están configurados correctamente:
1. Añadir los dominios en Settings > API
2. Guardar cambios
3. Esperar 60 segundos
4. Testear el login nuevamente

---

## Mensajes de Error Comunes y Soluciones

| Error | Causa | Solución |
|------|-------|----------|
| `LocalStorage vacío después del login` | [PRIMARY] detectSessionInUrl conflict | Desactivar detectSessionInUrl y usar cookies con sameSite: 'lax' |
| `Cookies blocked` en console | SameSite o Configuración CORS | Configurar Site URL y CORS Origins en Supabase Dashboard |
| `Timeout syncing settings` | Intento fallido de query sin sesión | Esperar getUser() antes de supabase.from() |
| `42P17` error en profile fetch | Debug RLS policies o permisos | Verificar que el cliente tenga permisos para leer 'profiles' |

---

## Prueba Manual: Flujos Correctos

### Flujo A: Primero Login
1. Abrir aplicación en navegador
2. Hacer login
3. Ir a Application > LocalStorage
4. **Verificar:** Debe existir clave `tuarbitro-auth-v3` con datos de sesión
5. Recargar página (F5)
6. **Verificar:** La app carga automáticamente sin volver a login

### Flujo B: Login en producción
1. Abrir `https://app.tuarbitro.com`
2. Login con Google/E-mail
3. **Verificar:** cookie `tuarbitro-auth-token-box` creada
4. Cerrar navegador completo
5. Volver a abrir `https://app.tuarbitro.com`
6. **Verificar:** La sesión sigue activa (sin pedir login nuevamente)

---

## Límites Conocidos

### Vercel Hosting
⚠️ Por defecto, Vercel no envía cookies de cross-subdomain correctamente desde sus dominios *.vercel.app

**Solución:**
- Usar dominios personalizados en Vercel o
- Configurar dominio real (ej: `app.tuarbitro.com`) en Vercel

---

## Checklist post-implementación

- [ ] La app se compila sin errores
- [ ] Verificar en LocalStorage: clave `tuarbitro-auth-v3` presente después de login
- [ ] Verificar en Cookies: cookie `tuarbitro-auth-token-box` con valor válido
- [ ] Recargar página: sesión persiste correctamente
- [ ] Cerrar/Reabrir navegador: sesión se restaura correctamente
- [ ] Test en modo incógnito: no debería pedir login nuevamente
- [ ] Verificar que `onAuthStateChange` se dispara correctamente con INITIAL_SESSION

---

## Notas adicionales

### ¿Por qué SameSite=Lax y no Strict?
- **Lax:** Permite redirecciones cross-site desde navegación normal (ej: hacer clic en un link)
- **Strict:** Bloquea TODAS las redirecciones cross-site, incluso las normales
- Lax es la opción más compatible para aplicaciones de SaaS

### ¿Por qué dominio='' y no '.tuarbitro.com'?
- `.tuarbitro.com` fuerza cookies a todos los subdominios
- `''` (vacío) permite que el navegador determine automáticamente el dominio correcto
- Evita problemas si la app está en subdominio diferente (ej: app.tuarbitro.com vs tuarbitro.com)

### ¿Por qué lifetime de 7 horas?
- Supabase/Gotrue soporta máximo 24 horas
- 7 horas (60*60*7) es un balance seguro entre seguridad y UX
- El token se refresca automáticamente con `autoRefreshToken: true`
