// DB에 drizzle/ 마이그레이션을 적용한다.  사용법: pnpm db:migrate
import "./env";

async function main() {
  const { db, usingPglite } = await import("../src/db");
  if (usingPglite) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
  }
  console.log(`마이그레이션 완료 (${usingPglite ? "로컬 PGlite" : "Neon"})`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
