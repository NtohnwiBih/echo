import Link from "next/link";
import { characters } from "@/lib/characters";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-accent text-xs tracking-[0.3em] uppercase">ECHO</p>
      <h1 className="font-display mt-3 text-5xl">A universe that remembers you.</h1>
      <ul className="mt-10 space-y-3">
        {characters.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/stories/${c.slug}`}
              className="text-accent text-lg underline-offset-4 hover:underline"
            >
              Talk to {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
