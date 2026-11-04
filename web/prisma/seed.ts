import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildCharacterSystemPrompt, characters } from "../src/lib/characters";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  for (const c of characters) {
    const data = {
      name: c.name,
      version: c.version,
      systemPrompt: buildCharacterSystemPrompt(c),
    };
    await prisma.character.upsert({
      where: { slug: c.slug },
      update: data,
      create: { slug: c.slug, ...data },
    });
  }

  // Development-only user so we can chat before login exists (Phase 2).
  await prisma.user.upsert({
    where: { id: "dev-user" },
    update: {},
    create: { id: "dev-user" },
  });

  console.log(`Seeded ${characters.length} characters and the dev user.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());