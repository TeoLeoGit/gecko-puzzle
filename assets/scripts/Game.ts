import { _decorator, Camera, Component, EventMouse, EventTouch, log, Node, UITransform, Vec2, Vec3 } from 'cc';
import { AStar, Point } from './AStar';
import { Gecko } from './Gecko';
import { Data } from './Data';
const { ccclass, property } = _decorator;

@ccclass('Game')
export class Game extends Component {
    @property(Gecko)
    gecko: Gecko;

    @property(Node)
    grid: Node;

    @property(Camera)
    mainCamera: Camera = null!;

    private dragStart = new Vec2();
    private dragDir = new Vec2();
    
    private activeTarget: Point | null = null;
    private pendingTarget: Point | null = null;

    //Grid management
    cellSize = 100;
    rows = 7;
    cols = 7;
    origin = new Vec3(-this.cellSize / 2, -this.cellSize / 2, 0); // bottom-left of grid

    //Move geckos
    private path: Point[] = [];
    private pathIndex = 0;
    private moveSpeed = 800; // units per second
    private targetWorldPos: Vec3 | null = null;

    onLoad() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }
    
    onTouchStart(e: EventTouch) {
        this.dragStart = e.getUILocation();
        this.moveToCellAtTouchPos(e);
    }
    
    onTouchMove(e: EventTouch) {
        const current = e.getUILocation();
        this.dragDir = current.subtract(this.dragStart);

        const maxLength = 100;
        if (this.dragDir.length() > maxLength) {
            this.dragDir.normalize().multiplyScalar(maxLength);
        }
        this.moveToCellAtTouchPos(e);
    }
    
    onTouchEnd() {
        this.dragDir.set(0, 0);
    }

    update(deltaTime: number) {
        if (!this.targetWorldPos) return;

        let remaining = this.moveSpeed * deltaTime;

        while (remaining > 0 && this.targetWorldPos) {
            const current = this.gecko.node.worldPosition.clone();
            const toTarget = this.targetWorldPos.clone().subtract(current);
            const dist = toTarget.length();

            if (dist <= remaining) {
                // reach target this frame
                this.gecko.node.setWorldPosition(this.targetWorldPos);
                remaining -= dist;

                if (this.pathIndex < this.path.length) {
                    this.gecko.HeadPoint = this.path[this.pathIndex];
                } else {
                    this.activeTarget = null;
                }

                this.pathIndex++;
                this.commitPendingTargetIfAny();
                this.moveToNextCell();
            } else {
                // partial move toward target
                toTarget.normalize();
                const nextPos = current.add(
                    toTarget.multiplyScalar(remaining)
                );
                this.gecko.node.setWorldPosition(nextPos);
                remaining = 0;
            }
        }
    }

    private commitPendingTargetIfAny() {
        if (!this.pendingTarget) return;
    
        this.activeTarget = this.pendingTarget;
        this.pendingTarget = null;
    
        this.moveGeckoOnPath(this.gecko.HeadPoint, this.activeTarget);
    }

    findCellAt(pos: Vec3): Point | null {
        this.grid.getComponent(UITransform)!.convertToNodeSpaceAR(pos, pos);

        const x = Math.floor((pos.x - this.origin.x) / this.cellSize);
        const y = Math.floor((pos.y - this.origin.y) / this.cellSize);

        if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) {
            return null;
        }

        const point = { x: x, y: y};
        return point;
    }

    moveToCellAtTouchPos(event: EventTouch) {
        const worldPos = this.screenToWorld(new Vec3(event.getLocation().x, event.getLocation().y, 0));
        const targetPoint = this.findCellAt(worldPos);

        if (targetPoint) {
            if (!this.activeTarget) {
                this.activeTarget = targetPoint;
                this.moveGeckoOnPath(this.gecko.HeadPoint, targetPoint);
            } else {
                this.pendingTarget = targetPoint;
            }
        }
    }

    private inBounds(x: number, y: number): boolean {
        return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
    }
    
    private isWall(x: number, y: number): boolean {
        return Data.Grid[y][x] === 1;
    }

    findClosestGecko(pos: Vec3): Gecko | null {
        return null;
    }

    moveGeckoOnPath(startPoint: Point, targetPoint: Point) {
        const grid = Data.Grid;
        const astar = new AStar(grid);
        const path = astar.findPath(startPoint, targetPoint);
        if (path.length === 0) return;
        //move this.gecko node follow path
        this.path = path;
        this.pathIndex = 0;

        this.moveToNextCell();
    }

    private moveToNextCell() {
        if (this.pathIndex >= this.path.length) {
            this.targetWorldPos = null;
            this.activeTarget = null;
            return;
        }
    
        const p = this.path[this.pathIndex];
        this.targetWorldPos = this.gridToWorld(p);
    }

    private gridToWorld(p: Point): Vec3 {
        const index = p.x + p.y * this.cols;
        const cell = this.grid.children[index];

        const wp = cell.worldPosition;
        return new Vec3(wp.x, wp.y, wp.z);
    }

    screenToWorld(screenPos: Vec3): Vec3 {
        const out = new Vec3();
        this.mainCamera.screenToWorld(screenPos, out);
        return out;
    }
}


