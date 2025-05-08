import PacmanGame from "@/components/pacman-game"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-black">
      <h1 className="text-3xl font-bold text-yellow-400 mb-4">PACMAN</h1>
      <PacmanGame />
    </main>
  )
}
