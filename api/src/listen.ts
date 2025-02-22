import { Context } from '@hono/hono';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

import { tracks } from '~/db/schema.ts';

import { DATABASE_URL } from '~/utils/env.ts';

const db = drizzle(DATABASE_URL);

function trackId(artist: string, album: string, track: string) {
  return `${artist}:${album}:${track}`;
}

function updateTrackCount(artist: string, album: string, track: string, albumUrl: string) {
  return db.insert(tracks)
    .values({ id: trackId(artist, album, track), artist, album, track, albumUrl, nbListens: 1 })
    .onConflictDoUpdate({
      target: tracks.id,
      set: { nbListens: sql`${tracks.nbListens} + 1` },
  });
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
