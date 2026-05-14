import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("The database URL is missing from the environment.");
}

const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client);