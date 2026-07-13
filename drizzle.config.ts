import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "src/schema.ts",
  out: "src/generated",
  dialect: "postgresql",
  dbCredentials: {
    url: "postgres://ys4f:@localhost:5432/gator?sslmode=disable",
  },
});