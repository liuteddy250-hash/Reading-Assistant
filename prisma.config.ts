import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Keep a fallback so `prisma generate` also works on a fresh clone without .env
// (npm postinstall runs before the user creates one).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  },
});
