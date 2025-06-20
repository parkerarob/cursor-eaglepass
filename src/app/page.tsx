import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-8 bg-background text-foreground">
      <Image
        src="/globe.svg"
        alt="Eagle Pass Logo"
        width={80}
        height={80}
        className="mb-4 dark:invert"
        priority
      />
      <h1 className="text-4xl font-bold mb-2">Eagle Pass</h1>
      <p className="text-lg text-muted-foreground mb-6">Welcome to the Eagle Pass project!</p>
      <div className="rounded-lg border border-border p-4 bg-card shadow-md">
        <p className="text-base">This is your custom Next.js homepage.<br/>Edit <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-mono font-semibold">src/app/page.tsx</code> to get started.</p>
      </div>
    </div>
  );
}
