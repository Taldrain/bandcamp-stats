import { defineConfig } from 'drizzle-kit';

import { DATABASE_URL } from './src/utils/env.ts';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: DATABASE_URL,
  },
});

