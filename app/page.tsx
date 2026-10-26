import { Logo } from "@/components/brand/Logo";

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <h1>
        <Logo size={32} />
      </h1>
    </main>
  );
}
