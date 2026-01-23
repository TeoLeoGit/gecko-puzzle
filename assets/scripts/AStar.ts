// AStar.ts
export interface Point {
    x: number;
    y: number;
}

class NodeAStar {
    point: Point;
    g: number; // cost from start
    h: number; // heuristic to end
    f: number; // g + h
    parent: NodeAStar | null;

    constructor(point: Point, g = 0, h = 0, parent: NodeAStar | null = null) {
        this.point = point;
        this.g = g;
        this.h = h;
        this.f = g + h;
        this.parent = parent;
    }
}

export class AStar {
    private grid: number[][];
    private width: number;
    private height: number;

    constructor(grid: number[][]) {
        this.grid = grid;
        this.height = grid.length;
        this.width = grid[0].length;
    }

    findPath(start: Point, end: Point): Point[] {
        const openList: NodeAStar[] = [];
        const closedSet = new Set<string>();

        const startNode = new NodeAStar(start);
        openList.push(startNode);

        while (openList.length > 0) {
            // get node with lowest f
            openList.sort((a, b) => a.f - b.f);
            const current = openList.shift()!;
            const key = this.key(current.point);

            if (current.point.x === end.x && current.point.y === end.y) {
                return this.reconstructPath(current);
            }

            closedSet.add(key);

            for (const neighbor of this.getNeighbors(current.point)) {
                const nKey = this.key(neighbor);
                if (closedSet.has(nKey)) continue;

                const g = current.g + 1;
                let node = openList.find(n => this.samePoint(n.point, neighbor));

                if (!node) {
                    const h = this.heuristic(neighbor, end);
                    node = new NodeAStar(neighbor, g, h, current);
                    openList.push(node);
                } else if (g < node.g) {
                    node.g = g;
                    node.f = node.g + node.h;
                    node.parent = current;
                }
            }
        }

        return []; // no path
    }

    private getNeighbors(p: Point): Point[] {
        const dirs = [
            { x: 0, y: 1 },
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: -1, y: 0 }
        ];

        const result: Point[] = [];

        for (const d of dirs) {
            const nx = p.x + d.x;
            const ny = p.y + d.y;

            if (
                nx >= 0 &&
                ny >= 0 &&
                nx < this.width &&
                ny < this.height &&
                this.grid[ny][nx] === 0
            ) {
                result.push({ x: nx, y: ny });
            }
        }

        return result;
    }

    private heuristic(a: Point, b: Point): number {
        // Manhattan distance (best for grid movement)
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    private reconstructPath(node: NodeAStar): Point[] {
        const path: Point[] = [];
        let current: NodeAStar | null = node;

        while (current) {
            path.push(current.point);
            current = current.parent;
        }

        return path.reverse();
    }

    private key(p: Point): string {
        return `${p.x},${p.y}`;
    }

    private samePoint(a: Point, b: Point): boolean {
        return a.x === b.x && a.y === b.y;
    }
}
