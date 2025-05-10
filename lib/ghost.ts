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

// Node class for A* pathfinding
class Node {
  x: number;
  y: number;
  g: number = 0; // Cost from start to current node
  h: number = 0; // Heuristic (estimated cost from current to goal)
  f: number = 0; // Total cost (g + h)
  parent: Node | null = null;
  
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  
  equals(other: Node): boolean {
    return this.x === other.x && this.y === other.y;
  }
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
  path: {x: number, y: number}[] = []; // Store the calculated path
  isWaiting: boolean
  waitTimer: number
  waitDuration: number

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
    this.isWaiting = false
    this.waitTimer = 0
    this.waitDuration = 5 // 5 seconds wait time

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
    // Update wait timer if ghost is waiting
    if (this.isWaiting) {
      this.waitTimer -= deltaTime
      if (this.waitTimer <= 0) {
        this.isWaiting = false
        this.speed = this.baseSpeed
      }
      return // Don't update position or behavior while waiting
    }

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
      
      // For Pinky, use A* to find path to target when in chase mode
      if (this.type === GhostType.PINKY && this.mode === GhostMode.CHASE && !this.isFrightened) {
        this.findPathAStar();
      } else {
        this.chooseNextDirection();
      }
    }

    // Calculate next position
    const nextX = this.x + this.dirX * this.speed * deltaTime;
    const nextY = this.y + this.dirY * this.speed * deltaTime;
    
    // Check for wall collision before moving
    if (!this.checkCollision(nextX, nextY)) {
      this.x = nextX;
      this.y = nextY;
    } else {
      // If we hit a wall, choose a new direction immediately
      // This is crucial to prevent ghosts from getting stuck
      this.chooseNextDirection();
      
      // Try moving in the new direction
      const newNextX = this.x + this.dirX * this.speed * deltaTime;
      const newNextY = this.y + this.dirY * this.speed * deltaTime;
      
      if (!this.checkCollision(newNextX, newNextY)) {
        this.x = newNextX;
        this.y = newNextY;
      }
    }

    // Handle tunnel wrapping
    if (this.x < 0) {
      this.x = this.map[0].length * this.cellSize
    } else if (this.x > this.map[0].length * this.cellSize) {
      this.x = 0
    }
  }
  
  // Add collision detection method
  checkCollision(x: number, y: number): boolean {
    // Check if the next position would collide with a wall
    const cellX1 = Math.floor((x - this.radius * 0.8) / this.cellSize)
    const cellY1 = Math.floor((y - this.radius * 0.8) / this.cellSize)
    const cellX2 = Math.floor((x + this.radius * 0.8) / this.cellSize)
    const cellY2 = Math.floor((y + this.radius * 0.8) / this.cellSize)

    // Check all cells that Ghost would occupy
    for (let y = cellY1; y <= cellY2; y++) {
      for (let x = cellX1; x <= cellX2; x++) {
        if (this.map[y] && this.map[y][x] === 3) {
          return true
        }
      }
    }

    return false
  }

  updateTarget(pacman: Pacman) {
    if (this.isFrightened) {
      // Random target when frightened
      this.targetX = Math.floor(Math.random() * this.map[0].length) * this.cellSize
      this.targetY = Math.floor(Math.random() * this.map.length) * this.cellSize
      return
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

    // Chase mode - each ghost has a different targeting strategy
    switch (this.type) {
      case GhostType.BLINKY:
        // Blinky targets Pacman directly
        this.targetX = pacman.x
        this.targetY = pacman.y
        break
      case GhostType.PINKY:
        // Pinky targets 4 tiles ahead of Pacman
        this.targetX = pacman.x + pacman.dirX * 4 * this.cellSize
        this.targetY = pacman.y + pacman.dirY * 4 * this.cellSize
        
        // Debug logging for Pinky's targeting
        if (this.mode === GhostMode.CHASE) {
          console.log("Pinky targeting:", {
            pacmanPos: { x: pacman.x, y: pacman.y },
            pacmanDir: { x: pacman.dirX, y: pacman.dirY },
            targetPos: { x: this.targetX, y: this.targetY },
            offset: { x: pacman.dirX * 4 * this.cellSize, y: pacman.dirY * 4 * this.cellSize }
          });
        }
        break;
      case GhostType.INKY:
        // Inky targets based on Blinky's position and Pacman's position
        const pivotX = pacman.x + pacman.dirX * 2 * this.cellSize
        const pivotY = pacman.y + pacman.dirY * 2 * this.cellSize
        // We don't have Blinky's position, so we'll use a simplified version
        this.targetX = pivotX * 2 - this.x
        this.targetY = pivotY * 2 - this.y
        break
      case GhostType.CLYDE:
        // Clyde targets Pacman directly if far away, otherwise targets scatter position
        const dx = pacman.x - this.x
        const dy = pacman.y - this.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance > 8 * this.cellSize) {
          this.targetX = pacman.x
          this.targetY = pacman.y
        } else {
          this.targetX = 0
          this.targetY = this.map.length * this.cellSize
        }
        break
    }
  }

  // A* pathfinding algorithm for Pinky
  findPathAStar() {
    // Convert current position and target to grid coordinates
    const startX = Math.floor(this.x / this.cellSize);
    const startY = Math.floor(this.y / this.cellSize);
    const targetX = Math.floor(this.targetX / this.cellSize);
    const targetY = Math.floor(this.targetY / this.cellSize);
    
    // Ensure target is within map bounds
    const boundedTargetX = Math.max(0, Math.min(targetX, this.map[0].length - 1));
    const boundedTargetY = Math.max(0, Math.min(targetY, this.map.length - 1));
    
    // Create start and end nodes
    const startNode = new Node(startX, startY);
    const endNode = new Node(boundedTargetX, boundedTargetY);
    
    // Initialize open and closed lists
    const openList: Node[] = [];
    const closedList: Node[] = [];
    
    // Add the start node to open list
    openList.push(startNode);
    
    // Define movement directions (up, right, down, left)
    const directions = [
      { x: 0, y: -1 }, // Up
      { x: 1, y: 0 },  // Right
      { x: 0, y: 1 },  // Down
      { x: -1, y: 0 }  // Left
    ];
    
    // Main A* loop
    while (openList.length > 0) {
      // Find the node with the lowest f value in open list
      let currentIndex = 0;
      let currentNode = openList[0];
      
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < currentNode.f) {
          currentNode = openList[i];
          currentIndex = i;
        }
      }
      
      // Remove current node from open list and add to closed list
      openList.splice(currentIndex, 1);
      closedList.push(currentNode);
      
      // If we reached the end node, reconstruct and return the path
      if (currentNode.equals(endNode)) {
        const path: {x: number, y: number}[] = [];
        let current: Node | null = currentNode;
        
        while (current) {
          path.push({ x: current.x, y: current.y });
          current = current.parent;
        }
        
        // Reverse to get path from start to end
        path.reverse();
        
        // If path has at least one step beyond the current position
        if (path.length > 1) {
          // Set direction based on the next step in the path
          const nextStep = path[1];
          this.dirX = nextStep.x - startX;
          this.dirY = nextStep.y - startY;
        }
        
        return;
      }
      
      // Generate children nodes
      for (const dir of directions) {
        const nodeX = currentNode.x + dir.x;
        const nodeY = currentNode.y + dir.y;
        
        // Check if position is valid (within map bounds and not a wall)
        if (nodeY < 0 || nodeY >= this.map.length || 
            nodeX < 0 || nodeX >= this.map[0].length || 
            this.map[nodeY][nodeX] === 3) {
          continue;
        }
        
        // Create new node
        const newNode = new Node(nodeX, nodeY);
        newNode.parent = currentNode;
        
        // Skip if node is in closed list
        if (closedList.some(node => node.equals(newNode))) {
          continue;
        }
        
        // Calculate g, h, and f values
        newNode.g = currentNode.g + 1;
        // Manhattan distance heuristic
        newNode.h = Math.abs(newNode.x - endNode.x) + Math.abs(newNode.y - endNode.y);
        newNode.f = newNode.g + newNode.h;
        
        // Skip if node is already in open list with a better path
        const existingOpenNode = openList.find(node => node.equals(newNode));
        if (existingOpenNode && newNode.g >= existingOpenNode.g) {
          continue;
        }
        
        // Add node to open list
        if (!existingOpenNode) {
          openList.push(newNode);
        }
      }
    }
    
    // If no path is found, fall back to the regular direction choosing method
    this.chooseNextDirection();
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
    let bestDir = possibleDirs[0]
    let bestDistance = Number.POSITIVE_INFINITY

    for (const dir of possibleDirs) {
      const nextX = this.x + dir.x * this.cellSize
      const nextY = this.y + dir.y * this.cellSize

      const dx = nextX - this.targetX
      const dy = nextY - this.targetY
      const distance = dx * dx + dy * dy // Square distance is enough for comparison

      if (distance < bestDistance) {
        bestDistance = distance
        bestDir = dir
      }
    }

    this.dirX = bestDir.x
    this.dirY = bestDir.y
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
    
    // If ghost is waiting, make it semi-transparent and add a pulsing effect
    if (this.isWaiting) {
      const alpha = 0.3 + Math.sin(this.waitTimer * 5) * 0.2; // Pulsing effect
      ctx.globalAlpha = alpha;
    }
    
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
    
    // Debug visualization for Pinky's target (only when in chase mode)
    if (this.type === GhostType.PINKY && this.mode === GhostMode.CHASE && !this.isFrightened) {
      // Draw target position
      ctx.fillStyle = "rgba(255, 184, 255, 0.5)"; // Semi-transparent pink
      ctx.beginPath();
      ctx.arc(this.targetX, this.targetY, this.radius / 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw line from Pinky to target
      ctx.strokeStyle = "rgba(255, 184, 255, 0.5)";
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.targetX, this.targetY);
      ctx.stroke();
    }
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
    this.speed = 0 // Stop movement
    this.mode = GhostMode.SCATTER
    this.scatterTimer = 0
    this.isWaiting = true
    this.waitTimer = this.waitDuration
    this.isFrightened = false // Reset frightened state
    this.frightenedTimer = 0 // Reset frightened timer
    this.speed = this.baseSpeed // Reset speed to normal
  }

  increaseSpeed(amount: number) {
    this.baseSpeed += amount
    this.speed = this.baseSpeed
  }
}
