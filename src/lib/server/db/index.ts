import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createDB(d1: any) {
  return drizzle(d1, { schema });
}

export * from './schema';