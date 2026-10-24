import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/db/schema.ts", "./src/db/schema-infra.ts"],
  out: "./drizzle",
  dialect: "postgresql",
});
