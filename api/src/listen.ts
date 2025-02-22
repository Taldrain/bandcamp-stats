import { Context } from '@hono/hono';
import { drizzle } from 'drizzle-orm/libsql';

import { plays } from '~/db/schema.ts';

import { DATABASE_URL } from '~/utils/env.ts';

const db = drizzle(DATABASE_URL);

function updateTrackCount(artist: string, album: string, track: string, albumUrl: string) {
  return db.insert(plays).values({ artist, album, track, albumUrl, timestamp: Date.now() });
}

async function handler(ctx: Context) {
  const body = await ctx.req.json();
  const { artist, album, track, albumUrl } = body;

  if (!artist || !album || !track || !albumUrl) {
    return ctx.body('Missing parameters', 400);
  }

  await updateTrackCount(artist, album, track, albumUrl);
  console.log(`Added ${artist} - ${album} - ${track}`);

  return ctx.body('');
}

export default handler;
