import 'dotenv/config'
import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from "fastify";
import { readFileSync } from "node:fs";
import { TLSSocket } from "node:tls";
import { fastifyRequestContext } from "@fastify/request-context";
import { env } from "node:process";
import { healthRoutes } from './routes/health.js';

const app = Fastify({
    logger: { level: env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' },
    https: {
        key: readFileSync('./certs/server.key'),
        cert: readFileSync('./certs/server.crt'),
        requestCert: true,
        rejectUnauthorized: true,
        ca: [readFileSync('./certs/ca.crt')],
    },
})

await app.register(fastifyRequestContext);

app.addHook('onRequest', async (request, reply) => {
    const socket = request.socket as TLSSocket;
    const cert = socket.getPeerCertificate();
    const cn = Array.isArray(cert?.subject?.CN) ? cert.subject.CN[0] : cert?.subject?.CN;
    if (!cn){
        return reply.code(401).send({ error: 'Client certificate required' });
    }
    request.requestContext.set('serviceId', cn);
});

app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error({ err: error }, 'Request failed');
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    reply.code(statusCode).send({
        error: statusCode >= 500 ? 'Internal error' : error.message,
    });
});

await app.register(healthRoutes);

app.listen({ port: Number(env.PORT), host: '0.0.0.0'}, (err) => {
    if (err) process.exit(1);
});