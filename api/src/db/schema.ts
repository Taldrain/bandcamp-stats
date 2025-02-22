import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const plays = sqliteTable("plays", {
  id: int().primaryKey({ autoIncrement: true }),
  artist: text().notNull(),
  album: text().notNull(),
  track: text().notNull(),
  albumUrl: text().notNull(),
  timestamp: int().notNull(),
});
