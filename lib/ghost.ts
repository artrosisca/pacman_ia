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
  private exitX: number;
  private exitY: number;
  private isInSpawnArea: boolean;

  constructor(x: number, y: number, radius: number, map: number[][], cellSize: number, type: GhostType) {
    this.x = x
    this.y = y
    this.initialX = x
    this.initialY = y
    this.radius = radius
    this.baseSpeed = 120 // pixels per second
    this.speed = this.baseSpeed
    this.dirX = 1
    this.dirY = 0
    this.map = map
    this.cellSize = cellSize
    this.type = type
    this.mode = GhostMode.SCATTER
    this.isFrightened = false
    this.isWaiting = false
    this.waitTimer = 0
    this.waitDuration = 2 // 2 seconds wait time
    this.isInSpawnArea = this.checkIfInSpawnArea();
    
    // Find the exit point dynamically
    const exitPoint = this.findExitPoint();
    this.exitX = exitPoint.x * cellSize + cellSize / 2;
    this.exitY = exitPoint.y * cellSize + cellSize / 2;

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

  // Find the exit point from the ghost spawn area
  private findExitPoint(): {x: number, y: number} {
    // First, find the ghost spawn area
    let spawnPoints: {x: number, y: number}[] = [];
    
    // Scan the map for ghost spawn points (value 4)
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[y].length; x++) {
        if (this.map[y][x] === 4) {
          spawnPoints.push({x, y});
        }
      }
    }
    
    if (spawnPoints.length === 0) {
      // Fallback if no spawn points found
      return {x: Math.floor(this.map[0].length / 2), y: 14};
    }
    
    // Calculate the center of the spawn area
    const centerX = spawnPoints.reduce((sum, point) => sum + point.x, 0) / spawnPoints.length;
    const centerY = spawnPoints.reduce((sum, point) => sum + point.y, 0) / spawnPoints.length;
    
    // Find the top edge of the spawn area
    const minY = Math.min(...spawnPoints.map(point => point.y));
    
    // IMPROVED EXIT FINDING: Look for valid exits in all directions
    const directions = [
      {x: 0, y: -1, priority: 1}, // Up (highest priority)
      {x: 1, y: 0, priority: 2},  // Right
      {x: -1, y: 0, priority: 2}, // Left
      {x: 0, y: 1, priority: 3}   // Down (lowest priority)
    ];
    
    let bestExit = null;
    let bestPriority = Infinity;
    let bestDistance = Infinity;
    
    // Check for exits in each direction from the spawn area
    for (const spawnPoint of spawnPoints) {
      for (const dir of directions) {
        // Check multiple steps in this direction
        for (let steps = 1; steps <= 3; steps++) {
          const checkX = spawnPoint.x + dir.x * steps;
          const checkY = spawnPoint.y + dir.y * steps;
          
          // Check if this is a valid exit point
          if (checkY >= 0 && checkY < this.map.length && 
              checkX >= 0 && checkX < this.map[0].length && 
              this.map[checkY][checkX] !== 3 && 
              this.map[checkY][checkX] !== 4) {
            
            // Calculate distance from center
            const dist = Math.sqrt(
              Math.pow(checkX - centerX, 2) + 
              Math.pow(checkY - centerY, 2)
            );
            
            // Check if this is a better exit based on priority and distance
            if (dir.priority < bestPriority || 
                (dir.priority === bestPriority && dist < bestDistance)) {
              bestExit = {x: checkX, y: checkY};
              bestPriority = dir.priority;
              bestDistance = dist;
            }
            
            // If we found an exit, no need to check further steps in this direction
            break;
          }
        }
      }
    }
    
    // If we found a valid exit, use it
    if (bestExit) {
      return bestExit;
    }
    
    // Fallback: find any non-wall, non-spawn cell
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[0].length; x++) {
        if (this.map[y][x] !== 3 && this.map[y][x] !== 4) {
          return {x, y};
        }
      }
    }
    
    // Ultimate fallback
    return {x: Math.floor(this.map[0].length / 2), y: Math.floor(this.map.length / 2)};
  }
  
  // Check if the ghost is in the spawn area - simplified to be more precise
  private checkIfInSpawnArea(): boolean {
    const cellX = Math.floor(this.x / this.cellSize);
    const cellY = Math.floor(this.y / this.cellSize);
    
    // Direct check if current cell is a spawn point
    if (this.map[cellY] && this.map[cellY][cellX] === 4) {
      return true;
    }
    
    return false; // Simplify to make detection more precise
  }

  update(deltaTime: number, pacman: Pacman, ghosts: Ghost[]) {
    // Update wait timer if ghost is waiting
    if (this.isWaiting) {
      this.waitTimer -= deltaTime
      if (this.waitTimer <= 0) {
        this.isWaiting = false
        this.speed = this.baseSpeed
        
        // Set target to exit point
        this.targetX = this.exitX;
        this.targetY = this.exitY;
        
        // Force a direction to exit the spawn
        const exitCellX = Math.floor(this.exitX / this.cellSize);
        const exitCellY = Math.floor(this.exitY / this.cellSize);
        const currentCellX = Math.floor(this.x / this.cellSize);
        const currentCellY = Math.floor(this.y / this.cellSize);
        
        // Set direction directly toward exit
        if (exitCellY < currentCellY) {
          this.dirX = 0;
          this.dirY = -1; // Up
        } else if (exitCellX > currentCellX) {
          this.dirX = 1;
          this.dirY = 0; // Right
        } else if (exitCellX < currentCellX) {
          this.dirX = -1;
          this.dirY = 0; // Left
        } else {
          this.dirX = 0;
          this.dirY = 1; // Down
        }
      }
      return // Don't update position or behavior while waiting
    }

    // Check if ghost is in spawn area
    const wasInSpawnArea = this.isInSpawnArea;
    this.isInSpawnArea = this.checkIfInSpawnArea();
    
    // If in spawn area, prioritize getting out
    if (this.isInSpawnArea) {
      // Set target to exit point
      this.targetX = this.exitX;
      this.targetY = this.exitY;
      
      // CRITICAL FIX: Force movement directly toward exit point
      // Calculate vector to exit
      const dx = this.exitX - this.x;
      const dy = this.exitY - this.y;
      
      // Determine primary direction based on which component is larger
      if (Math.abs(dx) > Math.abs(dy)) {
        this.dirX = dx > 0 ? 1 : -1;
        this.dirY = 0;
      } else {
        this.dirX = 0;
        this.dirY = dy > 0 ? 1 : -1;
      }
      
      // Move with increased speed to ensure escape
      const escapeSpeed = this.baseSpeed * 3; // Increased speed to break through any invisible barriers
      const moveX = this.x + this.dirX * escapeSpeed * deltaTime;
      const moveY = this.y + this.dirY * escapeSpeed * deltaTime;
      
      // IMPORTANT: When in spawn area, ignore wall collisions with spawn cells
      const nextCellX = Math.floor(moveX / this.cellSize);
      const nextCellY = Math.floor(moveY / this.cellSize);
      
      // Only check for real walls (value 3), not spawn area boundaries
      if (nextCellY >= 0 && nextCellY < this.map.length && 
          nextCellX >= 0 && nextCellX < this.map[0].length && 
          this.map[nextCellY][nextCellX] !== 3) {
        // Move if not hitting a real wall
        this.x = moveX;
        this.y = moveY;
      } else {
        // If we'd hit a real wall, try the other primary direction
        // Swap directions
        const tempDirX = this.dirX;
        this.dirX = this.dirY;
        this.dirY = tempDirX;
        
        const altMoveX = this.x + this.dirX * escapeSpeed * deltaTime;
        const altMoveY = this.y + this.dirY * escapeSpeed * deltaTime;
        
        const altNextCellX = Math.floor(altMoveX / this.cellSize);
        const altNextCellY = Math.floor(altMoveY / this.cellSize);
        
        if (altNextCellY >= 0 && altNextCellY < this.map.length && 
            altNextCellX >= 0 && altNextCellX < this.map[0].length && 
            this.map[altNextCellY][altNextCellX] !== 3) {
          // Move in alternate direction if possible
          this.x = altMoveX;
          this.y = altMoveY;
        }
      }
      
      // Check if we've reached a non-spawn area
      const newCellX = Math.floor(this.x / this.cellSize);
      const newCellY = Math.floor(this.y / this.cellSize);
      
      if (this.map[newCellY][newCellX] !== 4) {
        this.isInSpawnArea = false;
        
        // Force position to center of cell to avoid getting stuck at boundaries
        this.x = newCellX * this.cellSize + this.cellSize / 2;
        this.y = newCellY * this.cellSize + this.cellSize / 2;
      }
      
      return;
    } else if (wasInSpawnArea && !this.isInSpawnArea) {
      // Just exited the spawn area, reset to normal behavior
      this.mode = GhostMode.SCATTER;
      this.scatterTimer = 0;
      
      // Force position to center of current cell to avoid boundary issues
      const cellX = Math.floor(this.x / this.cellSize);
      const cellY = Math.floor(this.y / this.cellSize);
      this.x = cellX * this.cellSize + this.cellSize / 2;
      this.y = cellY * this.cellSize + this.cellSize / 2;
      
      this.chooseNextDirection();
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
    this.updateTarget(pacman, ghosts)

    // Decide next direction at intersections
    const cellX = Math.floor(this.x / this.cellSize)
    const cellY = Math.floor(this.y / this.cellSize)

    // Check if we're at the center of a cell (intersection)
    const centerX = cellX * this.cellSize + this.cellSize / 2
    const centerY = cellY * this.cellSize + this.cellSize / 2

    if (Math.abs(this.x - centerX) < 1 && Math.abs(this.y - centerY) < 1) {
      this.x = centerX
      this.y = centerY
      
      // Use appropriate pathfinding method based on ghost type
      if (this.mode === GhostMode.CHASE && !this.isFrightened) {
        switch (this.type) {
          case GhostType.BLINKY:
            this.findPathAStar();
            break;
          case GhostType.PINKY:
            this.findPathAStar();
            break;
          case GhostType.INKY:
            // Use Inky's A* search at intersections
            const inkyTarget = this.inkySearch(pacman, ghosts);
            this.targetX = inkyTarget.x;
            this.targetY = inkyTarget.y;
            this.chooseNextDirection();
            break;
          case GhostType.CLYDE:
            // Use Clyde's greedy search at intersections
            const clydeTarget = this.clydeSearch(pacman);
            this.targetX = clydeTarget.x;
            this.targetY = clydeTarget.y;
            this.chooseNextDirection();
            break;
        }
      } else {
        this.chooseNextDirection();
      }
    }

    const nextX = this.x + this.dirX * this.speed * deltaTime;
    const nextY = this.y + this.dirY * this.speed * deltaTime;
    
    // Check if the next position would cause a collision with a wall
    if (!this.wouldCollideWithWall(nextX, nextY)) {
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
    
    // Find the exit point dynamically (in case map changed)
    const exitPoint = this.findExitPoint();
    this.exitX = exitPoint.x * this.cellSize + this.cellSize / 2;
    this.exitY = exitPoint.y * this.cellSize + this.cellSize / 2;
    
    this.isInSpawnArea = this.checkIfInSpawnArea();
    
    // Stagger ghost release times based on type
    switch (this.type) {
      case GhostType.BLINKY:
        this.waitTimer = 1; // Blinky leaves first
        break;
      case GhostType.PINKY:
        this.waitTimer = 3; // Pinky leaves second
        break;
      case GhostType.INKY:
        this.waitTimer = 5; // Inky leaves third
        break;
      case GhostType.CLYDE:
        this.waitTimer = 7; // Clyde leaves last
        break;
    }
  }

  updateTarget(pacman: Pacman, ghosts: Ghost[]) {
    if (!pacman) return; // add security check for pacman

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
                // Use A* search with Inky's heuristic
                const inkyTarget = this.inkySearch(pacman, ghosts);
                this.targetX = inkyTarget.x;
                this.targetY = inkyTarget.y;
                break;
            case GhostType.CLYDE:
                // Use greedy search with Clyde's heuristic
                const clydeTarget = this.clydeSearch(pacman);
                this.targetX = clydeTarget.x;
                this.targetY = clydeTarget.y;
                break;
        }
    } catch (error) {
        // If something goes wrong, maintain current target
        console.error('Error in updateTarget:', error);
    }
}

  // A* pathfinding algorithm for Pinky
  findPathAStar() {
    // Convert current position and target to grid coordinates
    const startX = Math.floor(this.x / this.cellSize);
    const startY = Math.floor(this.y / this.cellSize);
    const targetX = Math.floor(this.targetX / this.cellSize);
    const targetY = Math.floor(this.targetY / this.cellSize);
    const exitGridX = Math.floor(this.exitX / this.cellSize);
    const exitGridY = Math.floor(this.exitY / this.cellSize)
    
    // Ensure target is within map bounds
    const boundedTargetX = Math.max(0, Math.min(targetX, this.map[0].length - 1));
    const boundedTargetY = Math.max(0, Math.min(targetY, this.map.length - 1));

    if (this.map[boundedTargetY][boundedTargetX] === 3) {
      this.chooseNextDirection(); 
      return;
    }

    if (startX === exitGridX && startY === exitGridY) return;
    
    // Create start and end nodes
    const startNode = new Node(startX, startY);
    const targetGridX = Math.floor(this.targetX / this.cellSize);
    const targetGridY = Math.floor(this.targetY / this.cellSize);
    const endNode = new Node(targetGridX, targetGridY);
    
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
  private inkySearch(pacman: Pacman, ghosts: Ghost[]): {x: number, y: number} {
    // Find Blinky for Inky's targeting
    const blinky = ghosts.find(g => g.type === GhostType.BLINKY);
    if (!blinky) {
      // Fallback if Blinky not found
      return {x: this.x, y: this.y};
    }
    
    // Calculate Inky's target position based on Pacman and Blinky
    const pivotX = pacman.x + pacman.dirX * 2 * this.cellSize;
    const pivotY = pacman.y + pacman.dirY * 2 * this.cellSize;
    const targetX = pivotX * 2 - blinky.x;
    const targetY = pivotY * 2 - blinky.y;
    
    // Convert to grid coordinates
    const targetGridX = Math.floor(targetX / this.cellSize);
    const targetGridY = Math.floor(targetY / this.cellSize);
    
    // Ensure target is within map bounds
    const boundedTargetX = Math.max(0, Math.min(targetGridX, this.map[0].length - 1));
    const boundedTargetY = Math.max(0, Math.min(targetGridY, this.map.length - 1));
    
    // Use A* to find path to target
    const startX = Math.floor(this.x / this.cellSize);
    const startY = Math.floor(this.y / this.cellSize);
    
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
        return {
          x: targetX,
          y: targetY
        };
      }
      
      // Generate children nodes
      for (const dir of directions) {
        const nodeX = currentNode.x + dir.x;
        const nodeY = currentNode.y + dir.y;
        
        // Check if position is valid (within map bounds and not a wall)
        if (nodeY < 0 || nodeY >= this.map.length || 
            nodeX < 0 || nodeX >= this.map[0].length || 
            this.map[nodeY][nodeX] === 3 || 
            this.map[nodeY][nodeX] === 4) {
          continue;
        }
        
        // Check if node is already in closed list
        if (closedList.some(node => node.x === nodeX && node.y === nodeY)) {
          continue;
        }
        
        // Create new node
        const newNode = new Node(nodeX, nodeY);
        newNode.parent = currentNode;
        newNode.g = currentNode.g + 1;
        newNode.h = this.calculateInkyHeuristic(nodeX, nodeY, pacman);
        newNode.f = newNode.g + newNode.h;
        
        // Check if node is already in open list
        const existingOpenNode = openList.find(node => node.x === nodeX && node.y === nodeY);
        if (existingOpenNode) {
          // If this path to the node is better, update it
          if (newNode.g < existingOpenNode.g) {
            existingOpenNode.g = newNode.g;
            existingOpenNode.f = existingOpenNode.g + existingOpenNode.h;
            existingOpenNode.parent = currentNode;
          }
        } else {
          // Add new node to open list
          openList.push(newNode);
        }
      }
    }
    
    // If no path found, return current position
    return {
      x: this.x,
      y: this.y
    };
  }

  // Add Clyde's greedy search method
  private clydeSearch(pacman: Pacman): {x: number, y: number} {
    const possibleMoves = [];
    const currentX = Math.floor(this.x / this.cellSize);
    const currentY = Math.floor(this.y / this.cellSize);
    
    const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
    
    // Don't allow reversing direction
    const reverseDir = {x: -this.dirX, y: -this.dirY};
    
    for (const dir of directions) {
      // Skip reverse direction
      if (dir.x === reverseDir.x && dir.y === reverseDir.y) {
        continue;
      }
      
      const nextX = currentX + dir.x;
      const nextY = currentY + dir.y;
      
      // Check if this direction is valid (not a wall or spawn area)
      if (nextY >= 0 && nextY < this.map.length && 
          nextX >= 0 && nextX < this.map[0].length && 
          this.map[nextY][nextX] !== 3 && 
          this.map[nextY][nextX] !== 4) {
        
        // Calculate heuristic for this move using Clyde's heuristic
        const h = this.calculateClydeHeuristic(nextX, nextY, pacman);
        
        possibleMoves.push({
          x: nextX,
          y: nextY,
          dir: dir,
          h: h
        });
      }
    }
    
    // If no valid moves, allow reversing
    if (possibleMoves.length === 0) {
      for (const dir of directions) {
        const nextX = currentX + dir.x;
        const nextY = currentY + dir.y;
        
        if (nextY >= 0 && nextY < this.map.length && 
            nextX >= 0 && nextX < this.map[0].length && 
            this.map[nextY][nextX] !== 3 && 
            this.map[nextY][nextX] !== 4) {
          
          const h = this.calculateClydeHeuristic(nextX, nextY, pacman);
          
          possibleMoves.push({
            x: nextX,
            y: nextY,
            dir: dir,
            h: h
          });
        }
      }
    }
    
    // If still no valid moves, return current position
    if (possibleMoves.length === 0) {
      // Emergency fallback - choose any valid direction
      for (const dir of directions) {
        const nextX = currentX + dir.x;
        const nextY = currentY + dir.y;
        
        if (nextY >= 0 && nextY < this.map.length && 
            nextX >= 0 && nextX < this.map[0].length && 
            this.map[nextY][nextX] !== 3) {
          
          this.dirX = dir.x;
          this.dirY = dir.y;
          
          return {
            x: nextX * this.cellSize + this.cellSize / 2,
            y: nextY * this.cellSize + this.cellSize / 2
          };
        }
      }
      
      // Absolute last resort - return current position
      return {
        x: this.x,
        y: this.y
      };
    }
    
    // Choose the move with the lowest heuristic value
    const bestMove = possibleMoves.reduce((min, move) => move.h < min.h ? move : min, possibleMoves[0]);
    
    // Set direction
    this.dirX = bestMove.dir.x;
    this.dirY = bestMove.dir.y;
    
    return {
      x: bestMove.x * this.cellSize + this.cellSize / 2,
      y: bestMove.y * this.cellSize + this.cellSize / 2
    };
  }

  // Inky's heuristic - combines distance with randomness
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

  // Clyde's heuristic - switches between chasing and fleeing
  private calculateClydeHeuristic(x: number, y: number, pacman: Pacman): number {
    const distanceToPacman = Math.sqrt(
      Math.pow(x * this.cellSize - pacman.x, 2) + 
      Math.pow(y * this.cellSize - pacman.y, 2)
    );
    
    // Se estiver muito perto do Pac-Man, prioriza ir para o canto
    if (distanceToPacman < 8 * this.cellSize) {
      return Math.abs(x) + Math.abs(y - this.map.length * this.cellSize);
    }
    
    // Caso contrário, persegue o Pac-Man
    return Math.abs(x * this.cellSize - pacman.x) + Math.abs(y * this.cellSize - pacman.y);
  }

  // Choose the next direction at an intersection
  private chooseNextDirection() {
    // Define possible directions (up, right, down, left)
    const directions = [
      { x: 0, y: -1 }, // Up
      { x: 1, y: 0 },  // Right
      { x: 0, y: 1 },  // Down
      { x: -1, y: 0 }  // Left
    ];
    
    // Filter out invalid directions (walls and reverse direction)
    const validDirections = directions.filter(dir => {
      // Don't allow reversing direction
      if (dir.x === -this.dirX && dir.y === -this.dirY) {
        return false;
      }
      
      // Check if moving in this direction would hit a wall
      const nextX = this.x + dir.x * this.cellSize;
      const nextY = this.y + dir.y * this.cellSize;
      
      return !this.wouldCollideWithWall(nextX, nextY);
    });
    
    if (validDirections.length === 0) {
      // If no valid directions, allow reversing
      for (const dir of directions) {
        const nextX = this.x + dir.x * this.cellSize;
        const nextY = this.y + dir.y * this.cellSize;
        
        if (!this.wouldCollideWithWall(nextX, nextY)) {
          this.dirX = dir.x;
          this.dirY = dir.y;
          return;
        }
      }
    } else if (this.isFrightened) {
      // When frightened, choose a random valid direction
      const randomIndex = Math.floor(Math.random() * validDirections.length);
      this.dirX = validDirections[randomIndex].x;
      this.dirY = validDirections[randomIndex].y;
    } else {
      // Choose the direction that gets closest to the target
      let bestDirection = validDirections[0];
      let bestDistance = Infinity;
      
      for (const dir of validDirections) {
        const nextX = this.x + dir.x * this.cellSize;
        const nextY = this.y + dir.y * this.cellSize;
        
        const distance = Math.sqrt(
          Math.pow(nextX - this.targetX, 2) + 
          Math.pow(nextY - this.targetY, 2)
        );
        
        if (distance < bestDistance) {
          bestDistance = distance;
          bestDirection = dir;
        }
      }
      
      this.dirX = bestDirection.x;
      this.dirY = bestDirection.y;
    }
  }
  
  // Check if a position would collide with a wall
  private wouldCollideWithWall(x: number, y: number): boolean {
    // Create a buffer around the ghost to keep it from getting too close to walls
    const buffer = this.radius * 0.9; // Slightly smaller than the full radius for better movement
    
    // Check all four corners of the ghost's bounding box plus the buffer
    const points = [
      { x: x - buffer, y: y - buffer }, // Top-left
      { x: x + buffer, y: y - buffer }, // Top-right
      { x: x - buffer, y: y + buffer }, // Bottom-left
      { x: x + buffer, y: y + buffer }  // Bottom-right
    ];
    
    // Check if any of these points would be inside a wall
    for (const point of points) {
      const cellX = Math.floor(point.x / this.cellSize);
      const cellY = Math.floor(point.y / this.cellSize);
      
      // Check if this cell is a wall or out of bounds
      // CRITICAL FIX: When in spawn area, only consider actual walls (value 3) as collisions
      if (cellY < 0 || cellY >= this.map.length || 
          cellX < 0 || cellX >= this.map[0].length || 
          (this.map[cellY][cellX] === 3) || 
          (!this.isInSpawnArea && this.map[cellY][cellX] === 4)) {
        return true;
      }
    }
    
    return false;
  }
}