import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { healthRoutes } from '../routes/health';

describe('health', () => {
    let app: FastifyInstance;
    beforeAll(async () => {
        app = Fastify();
        await app.register(healthRoutes);
        await app.ready();
    });
    afterAll(() => app.close());

    it('returns ok', async () => {
        const res = await app.inject({ method: 'GET', url: '/health'});
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).status).toBe('ok');
    });
});