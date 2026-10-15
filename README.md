# Fastify Secure Internal API

API interna en Fastify + TypeScript con autenticacion por certificados mutuos (mTLS), autorizacion a nivel de fila en PostgreSQL (Supabase RLS), validacion de entrada con Zod, manejo centralizado de errores y CI con escaneo de seguridad.


**URL en vivo:** https://fastify-mtls-rls-api.onrender.com/health


**Nota:** la URL en vivo expone solo el endpoint `/health`. El flujo completo con mTLS
corre en local, porque Render termina TLS en su borde y el certificado de cliente no llega al backend. Esto esta documentado en la seccion de Limitaciones conocidas.

---


## Arquitectura

![Diagrama de arquitectura](arquitectura.drawio)


## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Fastify
- **Base de Datos:** PostgreSQL (Supabase) con Row Level Security
- **Validacion:** Zod
- **Autenticacion:** mTLS (certificados de cliente)
- **CI:** GitHub Actions + Semgrep + npm audit

---


## Como correrlo en local

### Requisitos

- Node.js 22+
- OpenSSL
- Cuenta gratuita en Supabase (opcional, para RLS)


### Instalacion

```bash
    npm install
```

### Generar certificados mTLS

```bash
    mkdir -p certs && cd certs

# CA

openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt -subj "/CN=Internal-CA"


# Servidor

openssl genrsa -out server.key 4096
openssl req -new -key server.key -out server.csr -subj "/CN=internal-api" 
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 825 -sha256


# Cliente

openssl genrsa -out client.key 4096
openssl req -new -key client.key -out client.csr -subj "/CN=service-a"
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt -days 825 -sha256

cd ..
```

La carpeta `certs/` esta en `.gitignore` y nunca se sube al repositorio.

### Variables de entorno

Crea un archivo `.env` en la raiz:

```
PORT=3000
DATABASE_URL=postgresql://...your-supabase
LOG_LEVEL=info

```


### Ejecutar en desarrollo

```bash
npm run dev
```

### Tests

```bash
npm test
```

---


## Como probar los escenarios de seguridad

### 1. Sin certificado de cliente

```bash
curl -k https://localhost:3000/health
```

Debe responder `401 Client certificate required`.

### 2. Con certificado valido

```bash
curl --cert certs/client.crt --key certs/client.key --cacert certs/ca.crt https://localhost:3000/health
```

# Fastify Secure Internal API

API interna en Fastify + TypeScript con autenticacion por certificados mutuos (mTLS), autorizacion a nivel de fila en PostgreSQL (Supabase RLS), validacion de entrada con Zod, manejo centralizado de errores y CI con escaneo de seguridad.


**URL en vivo:** https://fastify-mtls-rls-api.onrender.com/health


**Nota:** la URL en vivo expone solo el endpoint `/health`. El flujo completo con mTLS
corre en local, porque Render termina TLS en su borde y el certificado de cliente no llega al backend. Esto esta documentado en la seccion de Limitaciones conocidas.

---


## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Fastify
- **Base de Datos:** PostgreSQL (Supabase) con Row Level Security
- **Validacion:** Zod
- **Autenticacion:** mTLS (certificados de cliente)
- **CI:** GitHub Actions + Semgrep + npm audit

---


## Como correrlo en local

### Requisitos

- Node.js 22+
- OpenSSL
- Cuenta gratuita en Supabase (opcional, para RLS)


### Instalacion

```bash
    npm install
```

### Generar certificados mTLS

```bash

    mkdir -p certs && cd certs

# CA

openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt -subj "/CN=Internal-CA"


# Servidor

openssl genrsa -out server.key 4096
openssl req -new -key server.key -out server.csr -subj "/CN=internal-api" 
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 825 -sha256


# Cliente

openssl genrsa -out client.key 4096
openssl req -new -key client.key -out client.csr -subj "/CN=service-a"
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt -days 825 -sha256

cd ..
```

La carpeta `certs/` esta en `.gitignore` y nunca se sube al repositorio.

### Variables de entorno

Crea un archivo `.env` en la raiz:

```
PORT=3000
DATABASE_URL=postgresql://...your-supabase
LOG_LEVEL=info

```


### Ejecutar en desarrollo

```bash
npm run dev
```

### Tests

```bash
npm test
```

---


## Como probar los escenarios de seguridad

### 1. Sin certificado de cliente

```bash
curl -k https://localhost:3000/health
```

Debe responder `401 Client certificate required`.

### 2. Con certificado valido

```bash
curl --cert certs/client.crt --key certs/client.key --cacert certs/ca.crt https://localhost:3000/health
```

### 3. Con certificado invalido (autofirmado, no de tu CA)

Genera un certificado cualquiera y prueba. El handshake TLS falla antes de llegar al codigo.

---

## Decisiones de seguridad

### mTLS para API interna

Al ser una API interna, la autenticacion se basa en **certificados de cliente (mTLS)** en lugar de JWT con secreto compartido. Esto elimina ataques de fuerza bruta de tokens y garantiza que solo clientes autorizados explicitamente puedan hablar con la API.

El CN del certificado del cliente se usa como identidad del servicio (`serviceID`).

### RLS en Supabase

Las politicas de Row Level Security se aplican a nivel de base de datos. Antes de cada consulta, el backend inyecta el claim `sub` del usuario en la transaccion y cambia al rol `authenticated` para que RLS se active:

```typescript
    await client.query('BEGIN');
    await client.query(
        "SELECT set_config('request.jwt.claims', $1, true)",
        [JSON.stringify({ sub: userID, role: 'authenticated' })]
    );
    await client.query("SELECT set_config('role', $1, true)", ['authenticated']);
```

Sin esto, la conexion directa con `pg` entra como rol `postgres`, que tiene `BYPASSRLS`, y las politicas se ignoran.

### Validacion con Zod

Toda entrada se valida en el framework antes de llegar al handler. Los campos desconocidos se rechazan (prevencion de mass assignment)

### Errores sin filtrar informacion

El manejador centralizado de errores devuelve `Internal error` para codigos 500, y los detalles solo van a logs.


### CI con gates de seguridad

El workflow `.github/workflows/security.yml` corre en cada push:

- `npm audit --audit-level=high` - vulnerabilidades en dependencias
- `semgrep --config=auto` - patrones de codigo inseguros

Las Github Actions estan fijadas a SHA inmutable, no a tags mutables, para prevenir ataques de supply chain.

---

## Limitaciones conocidas

- **mTLS en Render:** Render termina TLS en su borde y reenvia HTTP interno a la aplicacion, por lo que el backend no ve el certificado del cliente. En local el mTLS funciona completo. Para produccion real se requiere un proveedor que exponga el socket TCP directo o una capa de proxy que reenvie el certificado.

- **Cold start:** El servicio gratuito de Render se duerme tras 15 minutos sin trafico. La siguiente peticion tarda aproximadamente 1 minuto.

- **Base de datos:** Supabase free tier tiene 500 MB de almacenamiento y pausa proyectos inactivos tras 7 dias.

---

## Contexto

Este proyecto es una demostracion practica de como se aplican defensas en profundidad en una API interna: autenticacion fuerte (mTLS), autorizacion a nivel de datos (RLS), validacion estricta de entrada (Zod), manejo seguro de errores y CI con gates de seguridad.
