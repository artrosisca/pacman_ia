export class Pacman {
  x: number
  y: number
  radius: number
  speed: number
  dirX: number
  dirY: number
  nextDirX: number
  nextDirY: number
  angle: number
  mouthOpen: number
  mouthDir: number
  map: number[][]
  cellSize: number
  initialX: number
  initialY: number

  constructor(x: number, y: number, radius: number, map: number[][], cellSize: number) {
    this.x = x
    this.y = y
    this.initialX = x
    this.initialY = y
    this.radius = radius
    this.speed = 150 // pixels per second
    this.dirX = 0
    this.dirY = 0
    this.nextDirX = 0
    this.nextDirY = 0
    this.angle = 0
    this.mouthOpen = 0.2
    this.mouthDir = 0.1
    this.map = map
    this.cellSize = cellSize
  }

  setDirection(dirX: number, dirY: number) {
    this.nextDirX = dirX
    this.nextDirY = dirY
  }

  update(deltaTime: number) {
    // Try to change direction if requested
    if (this.nextDirX !== 0 || this.nextDirY !== 0) {
      const nextX = this.x + this.nextDirX * this.speed * deltaTime
      const nextY = this.y + this.nextDirY * this.speed * deltaTime

      if (!this.checkCollision(nextX, nextY)) {
        this.dirX = this.nextDirX
        this.dirY = this.nextDirY

        // Update angle based on direction
        if (this.dirX === 1) this.angle = 0
        else if (this.dirX === -1) this.angle = Math.PI
        else if (this.dirY === -1) this.angle = -Math.PI / 2
        else if (this.dirY === 1) this.angle = Math.PI / 2
      }
    }

    // Move in current direction
    const nextX = this.x + this.dirX * this.speed * deltaTime
    const nextY = this.y + this.dirY * this.speed * deltaTime

    if (!this.checkCollision(nextX, nextY)) {
      this.x = nextX
      this.y = nextY
    } else {
      // If we hit a wall, try to slide along it
      const nextXOnly = this.x + this.dirX * this.speed * deltaTime
      const nextYOnly = this.y + this.dirY * this.speed * deltaTime

      if (!this.checkCollision(this.x, nextYOnly)) {
        this.y = nextYOnly
        this.dirX = 0 // Stop horizontal movement
      } else if (!this.checkCollision(nextXOnly, this.y)) {
        this.x = nextXOnly
        this.dirY = 0 // Stop vertical movement
      }
    }

    // Handle tunnel wrapping
    if (this.x < 0) {
      this.x = this.map[0].length * this.cellSize
    } else if (this.x > this.map[0].length * this.cellSize) {
      this.x = 0
    }

    // Animate mouth
    this.mouthOpen += this.mouthDir
    if (this.mouthOpen > 0.5 || this.mouthOpen < 0.05) {
      this.mouthDir *= -1
    }
  }

  checkCollision(x: number, y: number): boolean {
    // Check if the next position would collide with a wall
    const cellX1 = Math.floor((x - this.radius * 0.8) / this.cellSize)
    const cellY1 = Math.floor((y - this.radius * 0.8) / this.cellSize)
    const cellX2 = Math.floor((x + this.radius * 0.8) / this.cellSize)
    const cellY2 = Math.floor((y + this.radius * 0.8) / this.cellSize)

    // Check all cells that Pacman would occupy
    for (let y = cellY1; y <= cellY2; y++) {
      for (let x = cellX1; x <= cellX2; x++) {
        if (this.map[y] && this.map[y][x] === 3) {
          return true
        }
      }
    }

    return false
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this.angle)

    // Draw Pacman
    ctx.fillStyle = "#ffff00"
    ctx.beginPath()
    ctx.arc(0, 0, this.radius, this.mouthOpen * Math.PI, (2 - this.mouthOpen) * Math.PI)
    ctx.lineTo(0, 0)
    ctx.fill()

    ctx.restore()
  }

  reset() {
    this.x = this.initialX
    this.y = this.initialY
    this.dirX = 0
    this.dirY = 0
    this.nextDirX = 0
    this.nextDirY = 0
    this.angle = 0

    // Ensure we're not stuck in a wall
    if (this.checkCollision(this.x, this.y)) {
      // Find a safe position by checking nearby cells
      const directions = [
        { x: 0, y: -1 }, // Up
        { x: 1, y: 0 }, // Right
        { x: 0, y: 1 }, // Down
        { x: -1, y: 0 }, // Left
      ]

      for (const dir of directions) {
        const newX = this.x + dir.x * this.cellSize
        const newY = this.y + dir.y * this.cellSize

        if (!this.checkCollision(newX, newY)) {
          this.x = newX
          this.y = newY
          break
        }
      }
    }
  }
}
