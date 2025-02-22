import { Hono } from '@hono/hono';
import { bearerAuth } from '@hono/hono/bearer-auth';

import listen from '~/listen.ts';
import { PORT, API_KEY } from '~/utils/env.ts';

const app = new Hono();

app.post('/v1/listen', bearerAuth({ token: API_KEY }), listen);

app.post('/health', ctx => ctx.body('OK'));

Deno.serve({ port: PORT }, app.fetch);
