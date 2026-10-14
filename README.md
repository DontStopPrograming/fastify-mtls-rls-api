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