import type { Pacman } from "./pacman"

export enum GhostType {
  BLINKY = "BLINKY", // Red - chases Pacman directly
  PINKY = "PINKY", // Pink - tries to ambush Pacman
  INKY = "INKY", // Cyan - unpredictable
  CLYDE = "CLYDE", // Orange - random movement
}

export enum GhostMode {
  CHASE = 0,
  SCATTER = 1,
  FRIGHTENED = 2,
}

export class Ghost {
  x: number
  y: number
  radius: number
  speed: number
  baseSpeed: number
  dirX: number
  dirY: number
  map: number[][]
  cellSize: number
  type: GhostType
  mode: GhostMode
  color: string
  frightenedTimer: number
  initialX: number
  initialY: number
  targetX: number
  targetY: number
  scatterTimer: number
  scatterDuration: number
  chaseDuration: number
  isFrightened: boolean

  constructor(x: number, y: number, radius: number, map: number[][], cellSize: number, type: GhostType) {
    this.x = x
    this.y = y
    this.initialX = x
    this.initialY = y
    this.radius = radius
    this.baseSpeed = 120 // pixels per second
    this.speed = this.baseSpeed
    this.dirX = 0
    this.dirY = -1 // Start moving up
    this.map = map
    this.cellSize = cellSize
    this.type = type
    this.mode = GhostMode.SCATTER
    this.isFrightened = false

    // Set color based on ghost type
    switch (type) {
      case GhostType.BLINKY:
        this.color = "#ff0000" // Red
        break
      case GhostType.PINKY:
        this.color = "#ffb8ff" // Pink
        break
      case GhostType.INKY:
        this.color = "#00ffff" // Cyan
        break
      case GhostType.CLYDE:
        this.color = "#ffb852" // Orange
        break
    }

    this.frightenedTimer = 0
    this.targetX = 0
    this.targetY = 0

    // Set up scatter/chase cycle
    this.scatterTimer = 0
    this.scatterDuration = 7 // seconds
    this.chaseDuration = 20 // seconds
  }

  update(deltaTime: number, pacman: Pacman) {
    // Update timers
    if (this.isFrightened) {
      this.frightenedTimer -= deltaTime
      if (this.frightenedTimer <= 0) {
        this.isFrightened = false
        this.speed = this.baseSpeed
      }
    } else {
      // Update scatter/chase cycle
      this.scatterTimer += deltaTime
      if (this.mode === GhostMode.SCATTER && this.scatterTimer >= this.scatterDuration) {
        this.mode = GhostMode.CHASE
        this.scatterTimer = 0
      } else if (this.mode === GhostMode.CHASE && this.scatterTimer >= this.chaseDuration) {
        this.mode = GhostMode.SCATTER
        this.scatterTimer = 0
      }
    }

    // Update target based on mode and ghost type
    this.updateTarget(pacman)

    // Decide next direction at intersections
    const cellX = Math.floor(this.x / this.cellSize)
    const cellY = Math.floor(this.y / this.cellSize)

    // Check if we're at the center of a cell (intersection)
    const centerX = cellX * this.cellSize + this.cellSize / 2
    const centerY = cellY * this.cellSize + this.cellSize / 2

    if (Math.abs(this.x - centerX) < 1 && Math.abs(this.y - centerY) < 1) {
      this.x = centerX
      this.y = centerY
      this.chooseNextDirection()
    }

    // Move in current direction
    const nextX = this.x + this.dirX * this.speed * deltaTime;
    const nextY = this.y + this.dirY * this.speed * deltaTime;
    
    // Check map boundaries before moving
    const nextCellX = Math.floor(nextX / this.cellSize);
    const nextCellY = Math.floor(nextY / this.cellSize);
    
    // Only move if within map bounds and not hitting a wall
    if (nextCellY >= 0 && nextCellY < this.map.length &&
        nextCellX >= 0 && nextCellX < this.map[0].length &&
        this.map[nextCellY][nextCellX] !== 3) {
        this.x = nextX;
        this.y = nextY;
    } else {
        // If hitting a boundary, try to find a new direction
        this.chooseNextDirection();
    }

    // Handle tunnel wrapping
    if (this.x < 0) {
        this.x = this.map[0].length * this.cellSize;
    } else if (this.x > this.map[0].length * this.cellSize) {
        this.x = 0;
    }
  }

  updateTarget(pacman: Pacman) {
    try {
        if (this.isFrightened) {
            // Comportamento aleatório quando assustado
            this.targetX = Math.floor(Math.random() * this.map[0].length) * this.cellSize;
            this.targetY = Math.floor(Math.random() * this.map.length) * this.cellSize;
            return;
        }
  
        if (this.mode === GhostMode.SCATTER) {
            // Each ghost has a different corner to scatter to
            switch (this.type) {
                case GhostType.BLINKY:
                    this.targetX = this.map[0].length * this.cellSize
                    this.targetY = 0
                    break
                case GhostType.PINKY:
                    this.targetX = 0
                    this.targetY = 0
                    break
                case GhostType.INKY:
                    this.targetX = this.map[0].length * this.cellSize
                    this.targetY = this.map.length * this.cellSize
                    break
                case GhostType.CLYDE:
                    this.targetX = 0
                    this.targetY = this.map.length * this.cellSize
                    break
            }
            return
        }

        // Chase mode logic for all ghosts
        switch (this.type) {
            case GhostType.BLINKY:
                const aStarTarget = this.aStarSearch(pacman);
                if (aStarTarget) {
                    this.targetX = aStarTarget.x;
                    this.targetY = aStarTarget.y;
                }
                break;
            case GhostType.PINKY:
                const pinkyTarget = this.greedySearch(pacman);
                this.targetX = pinkyTarget.x;
                this.targetY = pinkyTarget.y;
                break;
            case GhostType.INKY:
                // Inky targets a position based on Pac-Man and Blinky
                const pivotX = pacman.x + pacman.dirX * 2 * this.cellSize;
                const pivotY = pacman.y + pacman.dirY * 2 * this.cellSize;
                this.targetX = pivotX * 2 - this.x;
                this.targetY = pivotY * 2 - this.y;
                break;
            case GhostType.CLYDE:
                const distanceToPacman = Math.sqrt(
                    Math.pow(this.x - pacman.x, 2) + Math.pow(this.y - pacman.y, 2)
                );
                if (distanceToPacman < 8 * this.cellSize) {
                    // Run away to corner
                    this.targetX = 0;
                    this.targetY = this.map.length * this.cellSize;
                } else {
                    // Chase Pac-Man
                    this.targetX = pacman.x;
                    this.targetY = pacman.y;
                }
                break;
        }
    } catch (error) {
        // If something goes wrong, maintain current target
        console.error('Error in updateTarget:', error);
    }
}

  chooseNextDirection() {
    // Get possible directions (excluding the opposite of current direction)
    const possibleDirs = []
    const oppositeX = -this.dirX
    const oppositeY = -this.dirY

    // Check each direction
    const directions = [
      { x: 0, y: -1 }, // Up
      { x: 1, y: 0 }, // Right
      { x: 0, y: 1 }, // Down
      { x: -1, y: 0 }, // Left
    ]

    for (const dir of directions) {
      // Skip opposite direction (no U-turns)
      if (dir.x === oppositeX && dir.y === oppositeY) continue

      // Check if there's a wall in this direction
      const nextX = Math.floor(this.x / this.cellSize) + dir.x
      const nextY = Math.floor(this.y / this.cellSize) + dir.y

      if (this.map[nextY] && this.map[nextY][nextX] !== 3) {
        possibleDirs.push(dir)
      }
    }

    if (possibleDirs.length === 0) {
      // If no valid directions, allow U-turn
      this.dirX = oppositeX
      this.dirY = oppositeY
      return
    }

    if (this.isFrightened) {
      // Choose random direction when frightened
      const randomDir = possibleDirs[Math.floor(Math.random() * possibleDirs.length)]
      this.dirX = randomDir.x
      this.dirY = randomDir.y
      return
    }

    // Choose direction that gets closest to target
    let bestDir = possibleDirs[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const dir of possibleDirs) {
        const nextX = Math.floor(this.x / this.cellSize) + dir.x;
        const nextY = Math.floor(this.y / this.cellSize) + dir.y;

        // Skip if out of bounds
        if (nextY < 0 || nextY >= this.map.length ||
            nextX < 0 || nextX >= this.map[0].length) {
            continue;
        }

        const dx = (nextX * this.cellSize) - this.targetX;
        const dy = (nextY * this.cellSize) - this.targetY;
        const distance = dx * dx + dy * dy;

        if (distance < bestDistance) {
            bestDistance = distance;
            bestDir = dir;
        }
    }

    this.dirX = bestDir.x;
    this.dirY = bestDir.y;
}

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
  
    // Base color based on ghost type or frightened state
    let baseColor = this.color;
    if (this.isFrightened) {
      baseColor = this.frightenedTimer < 2
        ? Math.floor(this.frightenedTimer * 10) % 2 === 0
          ? "#0000ff"
          : "#ffffff"
        : "#0000ff";
    }
    
    // Draw ghost body as a hooded figure or monster
    ctx.fillStyle = baseColor;
    
    // Hooded body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, Math.PI, 0, false);
    ctx.lineTo(this.x + this.radius, this.y + this.radius);
    
    // Jagged bottom for robe/cloak effect
    const segments = 5;
    const segmentWidth = (this.radius * 2) / segments;
    
    for (let i = 0; i < segments; i++) {
      const pointX = this.x + this.radius - (i * segmentWidth);
      const pointY = i % 2 === 0 
        ? this.y + this.radius * 1.2 
        : this.y + this.radius;
      ctx.lineTo(pointX, pointY);
    }
    
    ctx.lineTo(this.x - this.radius, this.y + this.radius);
    ctx.closePath();
    ctx.fill();
    
    // Eyes
    const eyeRadius = this.radius * 0.25;
    const eyeOffsetX = this.radius * 0.3;
    const eyeOffsetY = -this.radius * 0.1;
    
    // Left eye
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(this.x - eyeOffsetX, this.y + eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Right eye
    ctx.beginPath();
    ctx.arc(this.x + eyeOffsetX, this.y + eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupils - look in direction of movement
    ctx.fillStyle = "#000000";
    const pupilRadius = eyeRadius * 0.6;
    const pupilOffsetX = this.dirX * (eyeRadius * 0.3);
    const pupilOffsetY = this.dirY * (eyeRadius * 0.3);
    
    // Left pupil
    ctx.beginPath();
    ctx.arc(this.x - eyeOffsetX + pupilOffsetX, this.y + eyeOffsetY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Right pupil
    ctx.beginPath();
    ctx.arc(this.x + eyeOffsetX + pupilOffsetX, this.y + eyeOffsetY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  makeFrightened() {
    this.isFrightened = true
    this.frightenedTimer = 8 // 8 seconds of frightened mode
    this.speed = this.baseSpeed * 0.5 // Slower when frightened

    // Reverse direction
    this.dirX = -this.dirX
    this.dirY = -this.dirY
  }

  reset() {
    this.x = this.initialX
    this.y = this.initialY
    this.dirX = 0
    this.dirY = -1
    this.isFrightened = false
    this.speed = this.baseSpeed
    this.mode = GhostMode.SCATTER
    this.scatterTimer = 0
  }

  increaseSpeed(amount: number) {
    this.baseSpeed += amount
    this.speed = this.baseSpeed
  }

  // Heurística para Blinky: Distância Manhattan até o Pac-Man
  private calculateBlinkyHeuristic(x: number, y: number, pacman: Pacman): number {
    return Math.abs(x - pacman.x) + Math.abs(y - pacman.y);
  }
  
  // Função de custo real para A*
  private calculateGCost(x: number, y: number, parentG: number): number {
    return parentG + this.cellSize;
  }
  
  // Implementação A* para Blinky
  private aStarSearch(pacman: Pacman): {x: number, y: number} {
    const openSet: Array<{x: number, y: number, g: number, f: number}> = [];
    const closedSet = new Set<string>();
    const startX = Math.floor(this.x / this.cellSize);
    const startY = Math.floor(this.y / this.cellSize);
    
    openSet.push({
      x: startX,
      y: startY,
      g: 0,
      f: this.calculateBlinkyHeuristic(startX, startY, pacman)
    });
  
    const MAX_ITERATIONS = 1000;
    let iterations = 0;
    
    while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        const current = openSet.reduce((min, item) => item.f < min.f ? item : min, openSet[0]);
        const currentIndex = openSet.findIndex(item => item.x === current.x && item.y === current.y);
        
        if (Math.abs(current.x - Math.floor(pacman.x / this.cellSize)) < 1 &&
                Math.abs(current.y - Math.floor(pacman.y / this.cellSize)) < 1) {
            return {x: current.x * this.cellSize, y: current.y * this.cellSize};
        }
    
        // Remove the current node properly
        openSet.splice(currentIndex, 1);
        closedSet.add(`${current.x},${current.y}`);
    
        // Check if node is already in openSet before adding
        for (const dir of [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}]) {
            const nextX = current.x + dir.x;
            const nextY = current.y + dir.y;
            
            const nodeKey = `${nextX},${nextY}`;
            if (this.map[nextY] && this.map[nextY][nextX] !== 3 && 
                    !closedSet.has(nodeKey) &&
                    !openSet.some(node => node.x === nextX && node.y === nextY)) {
                const g = this.calculateGCost(nextX, nextY, current.g);
                const h = this.calculateBlinkyHeuristic(nextX, nextY, pacman);
                const f = g + h;
                
                openSet.push({x: nextX, y: nextY, g: g, f: f});
            }
        }
    }
    
    // If max iterations reached, return current position
    return {x: this.x, y: this.y};
  }

  // Heurística para Pinky: Distância até 4 células à frente do Pac-Man
  private calculatePinkyHeuristic(x: number, y: number, pacman: Pacman): number {
    const targetX = pacman.x + pacman.dirX * 4 * this.cellSize;
    const targetY = pacman.y + pacman.dirY * 4 * this.cellSize;
    return Math.abs(x - targetX) + Math.abs(y - targetY);
  }
  
  // Busca gulosa para Pinky
  private greedySearch(pacman: Pacman): {x: number, y: number} {
    const possibleMoves = [];
    const currentX = Math.floor(this.x / this.cellSize);
    const currentY = Math.floor(this.y / this.cellSize);
    
    const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
    
    for (const dir of directions) {
        const nextX = currentX + dir.x;
        const nextY = currentY + dir.y;
        
        if (nextY >= 0 && nextY < this.map.length && 
            nextX >= 0 && nextX < this.map[0].length && 
            this.map[nextY][nextX] !== 3) {
            const h = this.calculatePinkyHeuristic(nextX * this.cellSize, nextY * this.cellSize, pacman);
            possibleMoves.push({x: nextX, y: nextY, h: h});
        }
    }
    
    if (possibleMoves.length === 0) return {x: this.x, y: this.y};
    
    const bestMove = possibleMoves.reduce((min, move) => move.h < min.h ? move : min, possibleMoves[0]);
    return {x: bestMove.x * this.cellSize, y: bestMove.y * this.cellSize};
  }

  // Heurística híbrida para Inky
  private calculateInkyHeuristic(x: number, y: number, pacman: Pacman): number {
    const pivotX = pacman.x + pacman.dirX * 2 * this.cellSize;
    const pivotY = pacman.y + pacman.dirY * 2 * this.cellSize;
    const targetX = pivotX * 2 - this.x;
    const targetY = pivotY * 2 - this.y;
    
    // Combina distância até o alvo com um componente aleatório
    const baseHeuristic = Math.abs(x - targetX) + Math.abs(y - targetY);
    const randomFactor = Math.random() * this.cellSize * 2;
    return baseHeuristic + randomFactor;
  }

  // Heurística para Clyde
  private calculateClydeHeuristic(x: number, y: number, pacman: Pacman): number {
    const distanceToPacman = Math.sqrt(
      Math.pow(x - pacman.x, 2) + Math.pow(y - pacman.y, 2)
    );
    
    // Se estiver muito perto do Pac-Man, prioriza ir para o canto
    if (distanceToPacman < 8 * this.cellSize) {
      return Math.abs(x) + Math.abs(y - this.map.length * this.cellSize);
    }
    
    // Caso contrário, persegue o Pac-Man
    return Math.abs(x - pacman.x) + Math.abs(y - pacman.y);
  }
}
