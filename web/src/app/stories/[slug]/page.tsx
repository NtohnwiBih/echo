import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatView } from "@/components/chat/chat-view";
import { getCharacterBySlug } from "@/lib/characters";
import { getStory } from "@/lib/chat/stories";

type Params = Promise<{ slug: string }>;

async function Chat({ params }: { params: Params }) {
  const { slug } = await params;
  const character = getCharacterBySlug(slug);
  const story = getStory(slug);
  if (!character || !story) notFound();

  return (
    <ChatView
      slug={slug}
      name={character.name}
      subtitle={story.subtitle}
      opening={story.opening}
      suggestions={story.suggestions}
    />
  );
}

export default function Page({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="text-muted p-8">Opening the story…</p>}>
      <Chat params={params} />
    </Suspense>
  );
}
