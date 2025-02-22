import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tracks = sqliteTable("tracks", {
  id: text().primaryKey(),
  artist: text().notNull(),
  album: text().notNull(),
  track: text().notNull(),
  albumUrl: text().notNull(),
  nbListens: int().notNull().default(0),
});
