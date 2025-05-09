"use client"

import { useEffect, useRef, useState } from "react"
import { defaultMap, centralMazeMap, castleMap } from "@/lib/maps"
import { Ghost, GhostType } from "@/lib/ghost"
import { Pacman } from "@/lib/pacman"
import { GameState } from "@/lib/game-state"

const CELL_SIZE = 20
const FPS = 60

// Define a class with static properties for initial positions
class PacmanPositions {
  static readonly defaultMap = {
    x: 14 * CELL_SIZE,
    y: 23.5 * CELL_SIZE
  };
  
  static readonly centralMazeMap = {
    x: 14 * CELL_SIZE,
    y: 25.5 * CELL_SIZE
  };
  
  static readonly castleMap = {
    x: 14 * CELL_SIZE,
    y: 23.5 * CELL_SIZE
  };
  
  static getPosition(mapName: string): {x: number, y: number} {
    return (this as any)[mapName] || this.defaultMap;
  }
}

export default function PacmanGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [gameState, setGameState] = useState<GameState>(GameState.READY)
  const [highScore, setHighScore] = useState(0)
  const [level, setLevel] = useState(1)

  const gameRef = useRef<{
    mapName: string
    map: number[][]
    pacman: Pacman | null
    ghosts: Ghost[]
    dotCount: number
    animationFrameId: number
    lastTime: number
  }>({
    // defaultMap, centralMazeMap, castleMap
    mapName: "defaultMap",
    map: JSON.parse(JSON.stringify(defaultMap)),
    pacman: null,
    ghosts: [],
    dotCount: 0,
    animationFrameId: 0,
    lastTime: 0,
  })

  // Initialize game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const game = gameRef.current

    // Count dots for win condition
    game.dotCount = game.map.flat().filter((cell) => cell === 1 || cell === 2).length

    // Initialize Pacman
    const initialPos = PacmanPositions.getPosition(game.mapName);
    game.pacman = new Pacman(
      initialPos.x, 
      initialPos.y, 
      CELL_SIZE / 2, 
      game.map, 
      CELL_SIZE
    );
    
    // Initialize Ghosts
    game.ghosts = [
      new Ghost(13.5 * CELL_SIZE, 11 * CELL_SIZE, CELL_SIZE / 2, game.map, CELL_SIZE, GhostType.BLINKY),
      new Ghost(12 * CELL_SIZE, 14 * CELL_SIZE, CELL_SIZE / 2, game.map, CELL_SIZE, GhostType.PINKY),
      new Ghost(13.5 * CELL_SIZE, 14 * CELL_SIZE, CELL_SIZE / 2, game.map, CELL_SIZE, GhostType.INKY),
      new Ghost(15 * CELL_SIZE, 14 * CELL_SIZE, CELL_SIZE / 2, game.map, CELL_SIZE, GhostType.CLYDE),
    ]

    // Set up keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!game.pacman) return

      if (gameState === GameState.READY && e.key === " ") {
        setGameState(GameState.PLAYING)
        return
      }

      if (gameState === GameState.GAME_OVER && e.key === " ") {
        resetGame()
        setGameState(GameState.READY)
        return
      }

      if (gameState !== GameState.PLAYING) return

      switch (e.key) {
        case "ArrowUp":
        case "w":
          game.pacman.setDirection(0, -1)
          break
        case "ArrowRight":
        case "d":
          game.pacman.setDirection(1, 0)
          break
        case "ArrowDown":
        case "s":
          game.pacman.setDirection(0, 1)
          break
        case "ArrowLeft":
        case "a":
          game.pacman.setDirection(-1, 0)
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    // Start game loop
    startGameLoop()

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      cancelAnimationFrame(game.animationFrameId)
    }
  }, [gameState])

  const startGameLoop = () => {
    const game = gameRef.current
    game.lastTime = performance.now()

    const gameLoop = (timestamp: number) => {
      const deltaTime = timestamp - game.lastTime
      game.lastTime = timestamp

      if (gameState === GameState.PLAYING) {
        update(deltaTime / 1000)
      }

      draw()
      game.animationFrameId = requestAnimationFrame(gameLoop)
    }

    game.animationFrameId = requestAnimationFrame(gameLoop)
  }

  const update = (deltaTime: number) => {
    const game = gameRef.current
    if (!game.pacman) return

    // Update Pacman
    game.pacman.update(deltaTime)

    // Check if Pacman ate a dot
    const pacmanCellX = Math.floor(game.pacman.x / CELL_SIZE)
    const pacmanCellY = Math.floor(game.pacman.y / CELL_SIZE)

    if (game.map[pacmanCellY] && game.map[pacmanCellY][pacmanCellX] === 1) {
      game.map[pacmanCellY][pacmanCellX] = 0
      setScore((prev) => prev + 10)
      game.dotCount--
    } else if (game.map[pacmanCellY] && game.map[pacmanCellY][pacmanCellX] === 2) {
      // Power pellet
      game.map[pacmanCellY][pacmanCellX] = 0
      setScore((prev) => prev + 50)
      game.dotCount--

      // Make ghosts frightened
      game.ghosts.forEach((ghost) => ghost.makeFrightened())
    }

    // Check win condition
    if (game.dotCount === 0) {
      setLevel((prev) => prev + 1)
      resetGame(true)
      return
    }

    // Update Ghosts
    game.ghosts.forEach((ghost) => {
      ghost.update(deltaTime, game.pacman!)

      // Check collision with Pacman
      const dx = ghost.x - game.pacman!.x
      const dy = ghost.y - game.pacman!.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < CELL_SIZE) {
        if (ghost.isFrightened) {
          // Pacman eats ghost
          ghost.reset()
          setScore((prev) => prev + 200)
        } else {
          // Ghost catches Pacman
          setLives((prev) => prev - 1)

          if (lives <= 1) {
            // Game over
            if (score > highScore) {
              setHighScore(score)
            }
            setGameState(GameState.GAME_OVER)
          } else {
            // Reset positions
            game.pacman!.reset()
            game.ghosts.forEach((g) => g.reset())
          }
        }
      }
    })
  }

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const game = gameRef.current

    // Clear canvas
    // Clear canvas with medieval floor texture
    ctx.fillStyle = "#2e1f1a"; // Dark wood/stone color
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add floor texture pattern
    ctx.strokeStyle = "#231612"; // Darker lines for floor boards
    ctx.lineWidth = 1;
    
    // Draw horizontal floor boards
    for (let y = 0; y < canvas.height; y += CELL_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Draw some vertical supports occasionally
    for (let x = 0; x < canvas.width; x += CELL_SIZE * 5) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Draw maze
    for (let y = 0; y < game.map.length; y++) {
      for (let x = 0; x < game.map[y].length; x++) {
        const cell = game.map[y][x]
    
        if (cell === 3) {
          // Wall as stone blocks
          ctx.fillStyle = "#696969"; // Stone gray
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          
          // Add stone texture
          ctx.strokeStyle = "#404040"; // Darker gray for mortar
          ctx.lineWidth = 1;
          
          // Horizontal mortar lines
          if (y % 2 === 0) {
            ctx.beginPath();
            ctx.moveTo(x * CELL_SIZE, y * CELL_SIZE + CELL_SIZE / 2);
            ctx.lineTo(x * CELL_SIZE + CELL_SIZE, y * CELL_SIZE + CELL_SIZE / 2);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE);
            ctx.lineTo(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE);
            ctx.stroke();
          }
        } else if (cell === 1) {
          // Dot as gold coin
          ctx.fillStyle = "#FFD700"; // Gold
          ctx.beginPath();
          ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 10, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === 2) {
          // Power pellet as magical orb
          const centerX = x * CELL_SIZE + CELL_SIZE / 2;
          const centerY = y * CELL_SIZE + CELL_SIZE / 2;
          
          // Glowing orb effect
          const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, CELL_SIZE / 3
          );
          gradient.addColorStop(0, "#ffffff");
          gradient.addColorStop(0.7, "#7851a9"); // Purple magic
          gradient.addColorStop(1, "#4a3278");
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(centerX, centerY, CELL_SIZE / 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw Pacman
    if (game.pacman) {
      game.pacman.draw(ctx)
    }

    // Draw Ghosts
    game.ghosts.forEach((ghost) => ghost.draw(ctx))

    // Draw game state messages
    ctx.fillStyle = "white"
    ctx.font = "20px Arial"
    ctx.textAlign = "center"

    if (gameState === GameState.READY) {
      ctx.fillText("PRESS SPACE TO START", canvas.width / 2, canvas.height / 2)
    } else if (gameState === GameState.GAME_OVER) {
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2)
      ctx.fillText("PRESS SPACE TO RESTART", canvas.width / 2, canvas.height / 2 + 30)
    }
  }

  const resetGame = (nextLevel = false) => {
    const game = gameRef.current

    // Reset map
    game.map = JSON.parse(JSON.stringify(defaultMap))

    // Count dots
    game.dotCount = game.map.flat().filter((cell) => cell === 1 || cell === 2).length

    // Reset Pacman
    if (game.pacman) {
      game.pacman.reset()

      // Ensure Pacman is not stuck in a wall after reset
      const pacmanCellX = Math.floor(game.pacman.x / CELL_SIZE)
      const pacmanCellY = Math.floor(game.pacman.y / CELL_SIZE)

      if (game.map[pacmanCellY][pacmanCellX] === 3) {
        // If in a wall, move to a safe position
        game.pacman.x = 13.5 * CELL_SIZE
        game.pacman.y = 23 * CELL_SIZE
      }
    }

    // Reset Ghosts
    game.ghosts.forEach((ghost) => {
      ghost.reset()
      // Increase ghost speed for higher levels
      if (nextLevel) {
        ghost.increaseSpeed(level * 0.1)
      }
    })

    if (!nextLevel) {
      setScore(0)
      setLives(3)
      setLevel(1)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-between w-full mb-2">
        <div className="text-white">SCORE: {score}</div>
        <div className="text-white">HIGH SCORE: {highScore}</div>
        <div className="text-white">LEVEL: {level}</div>
      </div>

      <canvas ref={canvasRef} width={28 * CELL_SIZE} height={31 * CELL_SIZE} className="border-2 border-blue-500" />

      <div className="mt-2 flex">
        {Array.from({ length: lives }).map((_, i) => (
          <div key={i} className="w-5 h-5 bg-yellow-400 rounded-full mx-1"></div>
        ))}
      </div>
    </div>
  )
}