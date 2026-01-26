import { _decorator, Component, log, Node, Vec3 } from 'cc';
import { Point } from './AStar';
const { ccclass, property } = _decorator;

@ccclass('Gecko')
export class Gecko extends Component {
    @property(Node)
    parts: Node[] = [];

    @property(Node)
    headNode: Node = null!;

    @property(Node)
    tailNode: Node = null!;

    private headPoint: Point = { x: 0, y: 0 };
    private tailPoint: Point = null;
    private trail: Point[] = [
        {x: 0, y: 0},
        {x: 0, y: 1},
        {x: 0, y: 2},
        {x: 0, y: 3}
    ];


    get HeadPoint(): Point {
        return this.headPoint;
    }

    get TailPoint(): Point {
        return this.tailPoint;
    }

    get HeadNode(): Node {
        return this.headNode;
    }

    set HeadPoint(point: Point) {
        this.headPoint = point;
    }

    init(bodyLength: number) {
        
    }

    moveToPos(pos: Vec3) {
        const headPos = this.headNode.worldPosition.clone();
        const delta = pos.clone().subtract(headPos);
        const dist = delta.length();

        // move head
        this.headNode.setWorldPosition(pos);

        // move body parts
        for (let i = 1; i < this.parts.length; i++) {
            const part = this.parts[i];
            const partPos = part.worldPosition;

            const prev = this.trail[i - 1];
            const curr = this.trail[i];

            let dx = 0;
            let dy = 0;

            if (prev.x === curr.x) {
                // vertical
                dy = prev.y > curr.y ? dist : -dist;
            } else {
                // horizontal
                dx = prev.x > curr.x ? dist : -dist;
            }

            part.setWorldPosition(
                partPos.x + dx,
                partPos.y + dy,
                partPos.z
            );
        }
    }

    updateTrail(newHeadPoint: Point) {
        if (newHeadPoint.x === this.headPoint.x && newHeadPoint.y === this.headPoint.y) return;
        for (let i = this.trail.length - 1; i > 0; i--) {
            this.trail[i].x = this.trail[i - 1].x;
            this.trail[i].y = this.trail[i - 1].y;
        }
        this.headPoint.x = newHeadPoint.x;
        this.headPoint.y = newHeadPoint.y;
        this.trail[0].x = newHeadPoint.x;
        this.trail[0].y = newHeadPoint.y;
        this.bendBody();
    }

    lookAt2D(target: Vec3) {
        const from = this.headNode.worldPosition;
        const to = target;
    
        const dx = to.x - from.x;
        const dy = to.y - from.y;
    
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = angleRad * 180 / Math.PI + 90;
    
        this.headNode.setRotationFromEuler(0, 0, angleDeg);
    }

    lerpAngle(current: number, target: number, t: number): number {
        let delta = (target - current) % 360;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return current + delta * t;
    }

    bendBody() {
        for (let i = 1; i < this.parts.length - 1; i++) {
            this.resetBody(i);
            if (this.trail[i + 1].x !== this.trail[i - 1].x && 
                this.trail[i + 1].y !== this.trail[i - 1].y)
                this.bendLCurve(this.parts[i].children, this.trail[i - 1], this.trail[i],  this.trail[i + 1]);
        }
    }

    bendLCurve(
        parts: Node[],          // ordered from head-side to tail-side
        from: Point,            // from grid cell
        curr: Point,            // current grid cell
        target: Point,          // next grid cell
    ) {
        const N = parts.length;
        if (N === 0) return;

        const half = 50;

        const dx = target.x - from.x;
        const dy = target.y - from.y;
        const dx_fc = from.x - curr.x;
        const dy_fc = from.y - curr.y;

        dx > 0;
        dx < 0;
        dy < 0; // screen space
        dy > 0;

        let cx = 0, cy = 0; //center of the curve
        let startAngle = 0;
        let endAngle = 0;

        // ---- determine corner + rotation ----
        if (dx > 0 && dy > 0) {          // 4
            if (dx_fc === 0) {
                cx = half; cy = -half;
                startAngle = 180;
                endAngle = 90;
                parts[0].parent.name = '4_1';
            } else {
                cx = -half; cy = half;
                startAngle = -90;
                endAngle = 0;
                parts[0].parent.name = '4_2';
            }
        } else if (dx < 0 && dy > 0) {    // 1
            if (dx_fc === 0) {
                cx = -half; cy = -half;
                startAngle = 0;
                endAngle = 90;
                parts[0].parent.name = '1_1';
            } else {
                cx = half; cy = half;
                startAngle = -90;
                endAngle = -180;
                parts[0].parent.name = '1_2';
            }
        } else if (dx > 0 && dy < 0) { // 3
            if (dx_fc === 0) {
                cx = half; cy = half;
                startAngle = 180;
                endAngle = 270;
                parts[0].parent.name = '3_1';
            } else {
                cx = -half; cy = -half;
                startAngle = 90;
                endAngle = 0;
                parts[0].parent.name = `3_2_${dy}_${dx}`;
            }
        } else if (dx < 0 && dy < 0) {  // 2
            if (dx_fc === 0) {
                cx = -half; cy = half;
                startAngle = 0;
                endAngle = -90;
                parts[0].parent.name = '2_1';
            } else {
                cx = half; cy = -half;
                startAngle = 90;
                endAngle = 180;
                parts[0].parent.name = '2_2';
            }
        } else {
            return;
        }
    
        // --- geometry ---
        for (let i = 0; i < N; i++) {
            const t = i / (N - 1);

            const angleDeg = startAngle + (endAngle - startAngle) * t;
            const angleRad = angleDeg * Math.PI / 180;

            const x = cx + Math.cos(angleRad) * half;
            const y = cy + Math.sin(angleRad) * half;

            parts[i].setPosition(x, y, 0);
            parts[i].setRotationFromEuler(0, 0, angleDeg);
        }
    }

    resetBody(index: number) {
        let j = 0;
        const partCount = this.parts[index].children.length;
        this.parts[index].children.forEach(part => {
            part.setPosition(0, -40 + j * (100 / partCount), 0);
            part.angle = 0;
            j++;
        })
        this.parts[index].name = 'normal';
    }
}


