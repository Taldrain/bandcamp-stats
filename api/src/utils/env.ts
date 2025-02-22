export const DATABASE_URL = Deno.env.get("DATABASE_URL")!;
export const PORT = parseInt(Deno.env.get("PORT")!, 10);
export const API_KEY = Deno.env.get("API_KEY")!;
