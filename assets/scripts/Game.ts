import { _decorator, Camera, Color, Component, EventMouse, EventTouch, log, Node, Sprite, UITransform, Vec2, Vec3 } from 'cc';
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
    
    //Grid management
    cellSize = 100;
    rows = 7;
    cols = 7;
    origin = new Vec3(-this.cellSize / 2, -this.cellSize / 2, 0); // bottom-left of grid
    
    //Move geckos
    private activeTarget: Point | null = null;
    private pendingTarget: Point | null = null;
    private path: Point[] = [];
    private pathIndex = 0;
    private targetWorldPos: Vec3 | null = null;
    private previewDist: number = 80;

    private previewBaseAngle = 0;
    private isPreviewing = false;

    onLoad() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        const grid = Data.Grid;
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) 
            {
                if (grid[i][j] === 1) {
                    this.grid.children[i * this.cols + j].getComponentInChildren(Sprite).enabled = false;
                }
            }
        }
    }
    
    onTouchStart(e: EventTouch) {
        this.dragStart = e.getUILocation();
        this.choseMoveNode(e);
        this.moveToCellAtTouchPos(e);
    }
    
    onTouchMove(e: EventTouch) {
        const current = e.getUILocation();
        this.dragDir = current.subtract(this.dragStart);

        const maxLength = 100;
        
        if (this.dragDir.length() > maxLength) {
            this.dragDir.normalize().multiplyScalar(maxLength);
        }

        // const worldPos =  this.screenToWorld(new Vec3(e.getLocation().x, e.getLocation().y));
        // worldPos.z = 0;
        // const base = this.grid.children[this.gecko.HeadPoint.y * this.cols + this.gecko.HeadPoint.x];
        // const offset = worldPos.clone().subtract(base.worldPosition);
        // const distFromHead = offset.length();
        // log(distFromHead);
        // if(distFromHead < this.previewDist) {
        //     this.previewMove(base.worldPosition, offset);
        // } else {
            this.moveToCellAtTouchPos(e);
        //}
    }
    
    onTouchEnd() {
        this.dragDir.set(0, 0);
    }

    update(deltaTime: number) {
        if (!this.targetWorldPos) return;

        let remaining = Data.MoveSpeed * deltaTime;

        while (remaining > 0 && this.targetWorldPos) {
            const current = this.gecko.MoveNode.worldPosition.clone();
            const toTarget = this.targetWorldPos.clone().subtract(current);
            const dist = toTarget.length();
            
            this.gecko.lookAt2D(this.targetWorldPos);
            if (dist <= remaining) {
                // reach target this frame
                this.gecko.moveTo(this.targetWorldPos, Data.MoveSpeed, deltaTime);
                remaining -= dist;
                this.pathIndex++;
                if (this.pathIndex >= this.path.length) this.activeTarget = null;

                this.commitPendingTargetIfAny();
                this.moveToNextCell();
            } else {
                // partial move toward target
                toTarget.normalize();
                const nextPos = current.add(
                    toTarget.multiplyScalar(remaining)
                );
                this.gecko.moveTo(nextPos, Data.MoveSpeed, deltaTime);
                remaining = 0;
            }
        }
    }

    private commitPendingTargetIfAny() {
        if (!this.pendingTarget) return;
    
        this.activeTarget = this.pendingTarget;
        this.pendingTarget = null;
    
        this.moveGeckoOnPath(this.gecko.MovePoint, this.activeTarget);
    }

    private findCellAt(pos: Vec3): Point | null {
        this.grid.getComponent(UITransform)!.convertToNodeSpaceAR(pos, pos);

        const x = Math.floor((pos.x - this.origin.x) / this.cellSize);
        const y = Math.floor((pos.y - this.origin.y) / this.cellSize);

        if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) {
            return null;
        }

        const point = { x: x, y: y};
        return point;
    }

    private choseMoveNode(event: EventTouch) {
        const worldPos = this.screenToWorld(new Vec3(event.getLocation().x, event.getLocation().y, 0));
        const targetPoint = this.findCellAt(worldPos);
        
        if (targetPoint) this.gecko.determineMovementDirection(targetPoint);
    }

    private moveToCellAtTouchPos(event: EventTouch) {
        const worldPos = this.screenToWorld(new Vec3(event.getLocation().x, event.getLocation().y, 0));
        const targetPoint = this.findCellAt(worldPos);
        
        if (targetPoint) {
            if (Data.Grid[targetPoint.y][targetPoint.x] === 1) return; //Wall
            if (this.gecko.MovePoint.x === targetPoint.x && this.gecko.MovePoint.y === targetPoint.y) return;
            if (!this.activeTarget) {
                this.activeTarget = targetPoint;
                this.moveGeckoOnPath(this.gecko.MovePoint, targetPoint);
            } else {
                this.pendingTarget = targetPoint;
            }
        }
    }

    private findClosestGecko(pos: Vec3): Gecko | null {
        return null;
    }

    private moveGeckoOnPath(startPoint: Point, targetPoint: Point) {
        const grid = Data.Grid;
        const astar = new AStar(grid);
        const path = astar.findPath(startPoint, targetPoint);
        if (path.length === 0) {
            this.targetWorldPos = null;
            this.activeTarget = null;
            return;
        }
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
        this.gecko.updateTrail(this.path[this.pathIndex]);
        this.gecko.updateSegmentTargets();
    }

    private startPreview() {
        this.previewBaseAngle = this.gecko.MoveNode.eulerAngles.z;
        this.isPreviewing = true;
    }

    private endPreview() {
        this.isPreviewing = false;
        this.gecko.MoveNode.setRotationFromEuler(
            0,
            0,
            this.previewBaseAngle
        );
    }

    private previewMove(baseWorldPos: Vec3, offset: Vec3) {
        const max = this.previewDist;

        if (offset.length() > max) {
            offset.normalize().multiplyScalar(max);
        }

        const previewPos = baseWorldPos.clone().add(offset);

        this.gecko.MoveNode.setWorldPosition(previewPos);
        if (offset.length() > 50) this.previewRotate(offset);
    }

    private previewRotate(offset: Vec3) {
        if (offset.lengthSqr() === 0) return;

        const angleRad = Math.atan2(offset.y, offset.x);
        const angleDeg = angleRad * 180 / Math.PI + 90;

        this.gecko.MoveNode.setWorldRotationFromEuler(0, 0, angleDeg);
    }

    private gridToWorld(p: Point): Vec3 {
        const index = p.x + p.y * this.cols;
        const cell = this.grid.children[index];

        const wp = cell.worldPosition;
        return new Vec3(wp.x, wp.y, wp.z);
    }

    private screenToWorld(screenPos: Vec3): Vec3 {
        const out = new Vec3();
        this.mainCamera.screenToWorld(screenPos, out);
        return out;
    }
}


