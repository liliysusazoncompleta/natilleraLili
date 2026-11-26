# Crear el primer administrador y entrar por primera vez

Este procedimiento es solo para una instalación de producción que todavía no tiene ninguna cuenta con rol de administrador. No ejecute el seed de demostración ni edite `clave_hash` directamente en PostgreSQL.

## Requisitos

- La base de datos de producción está preparada y el backend se desplegó con `backend/scripts/create-initial-admin.js`.
- El servicio backend de Railway usa `NODE_ENV=production` y tiene configurada su `DATABASE_URL` privada.
- El proyecto de Railway y el entorno seleccionados son los de producción.

## Crear la cuenta administradora

Desde PowerShell local, en la carpeta del proyecto, abra una shell del servicio:

```powershell
railway status
railway ssh --service natilleraLili --environment production
```

En la shell remota de Railway, vaya a `/app` y ejecute:

```bash
node backend/scripts/create-initial-admin.js
```

Si la shell indica que `node` no existe, busque la ruta del ejecutable Node que está usando el servicio:

```bash
for f in /proc/[0-9]*/exe; do target=$(readlink "$f" 2>/dev/null) || continue; case "$target" in */bin/node) echo "$target"; break;; esac; done
```

Ejecute el script con la ruta que imprimió, seguida de `backend/scripts/create-initial-admin.js`. Por ejemplo:

```bash
/mise/installs/node/22.23.5/bin/node backend/scripts/create-initial-admin.js
```

Ingrese nombres, apellidos, correo y nombre de usuario. Para confirmar la creación, escriba `CREAR ADMINISTRADOR`; luego escriba la contraseña dos veces. No se muestra al teclearla. Debe tener al menos 8 caracteres y no superar 72 bytes. El comando guarda un hash bcrypt, requiere `NODE_ENV=production` y se niega a crear la cuenta si ya existe un administrador.

## Primer acceso

Abra <https://liliysusazoncompleta.github.io/natilleraLili/#/login>. Ingrese el nombre de usuario o el correo que registró y la contraseña elegida. Después de entrar, use **Socios** para registrar perfiles y **Usuarios** para crear accesos adicionales.

Guarde la contraseña en un gestor seguro y no la envíe por chat, correo ni capturas. Si ya hay un administrador, no vuelva a ejecutar el aprovisionamiento inicial; use el proceso autorizado de recuperación de contraseña para esa cuenta.
