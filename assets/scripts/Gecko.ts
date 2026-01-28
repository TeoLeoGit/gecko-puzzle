import { _decorator, Component, Label, log, Node, size, UITransform, Vec3 } from 'cc';
import { Point } from './AStar';
import { Data } from './Data';
const { ccclass, property } = _decorator;

interface SegmentTarget {
    pos: Vec3;
    angle: number;
}

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
    private segments: Node[] = [];
    private segmentTargets: SegmentTarget[] = [];
    private segmentsEachPart: number = 6;

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

    protected onLoad(): void {
        this.markOccupiedOnTrail();
        const nodeSegments = new Node('segments');
        nodeSegments.setParent(this.node);
        for (let i = 1; i < this.parts.length - 1; i++) {
            this.parts[i].children.forEach(segment => {
                this.segments.push(segment);
            })
        }
        this.segments.forEach(segment => {
            segment.setParent(nodeSegments, true);
        });
        this.initSegmentTargets();
    }

    initSegmentTargets() {
        this.segments.forEach(segment => {
            this.segmentTargets.push({
                pos: segment.worldPosition,
                angle: segment.angle
            })
        })
    }

    protected update(dt: number): void {
        if (this.segmentTargets.length < this.segments.length) return;
        const done = this.moveSegmentsToTargets(dt, 1600);

        if (done) {
            this.consumeTailTargets(6);
        }
    }

    moveToPos(pos: Vec3) {
        // move head
        this.headNode.setWorldPosition(pos);
    }

    updateTrail(newHeadPoint: Point) {
        if (newHeadPoint.x === this.headPoint.x && newHeadPoint.y === this.headPoint.y) return;
        this.freeRemovedTrailPoint();
        for (let i = this.trail.length - 1; i > 0; i--) {
            this.trail[i].x = this.trail[i - 1].x;
            this.trail[i].y = this.trail[i - 1].y;
            this.parts[i].position = new Vec3(this.trail[i].x * Data.CellSize, this.trail[i].y * Data.CellSize);
        }
        this.headPoint.x = newHeadPoint.x;
        this.headPoint.y = newHeadPoint.y;
        this.trail[0].x = newHeadPoint.x;
        this.trail[0].y = newHeadPoint.y;
        this.markOccupiedOnTrail();
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

    updateSegmentTargets() {
        if (this.trail[2].x !== this.trail[0].x && 
            this.trail[2].y !== this.trail[0].y) {
                const newTargets = this.bendLCurveTargets(this.trail[0], this.trail[1],
                    this.trail[2], this.segmentsEachPart, this.parts[1]);
                this.segmentTargets.unshift(...newTargets);
            }
        else {
            const newTargets = [];
            if (this.trail[2].x === this.trail[0].x) {
                const dy = this.trail[0].y - this.trail[1].y;
                for (let i = 0; i < this.segmentsEachPart; i++) {
                    const worldPos = new Vec3();
                    this.parts[1].getComponent(UITransform)!.convertToWorldSpaceAR(
                        new Vec3(
                            0,
                            dy > 0 ? (54 - i * 20) : (-54 + i * 20),
                        ),
                        worldPos
                    );
                    const target: SegmentTarget = {
                        pos: worldPos,
                        angle: dy > 0 ? 180 : 0
                    }
                    newTargets.push(target);
                }
            } else {
                const dx = this.trail[0].x - this.trail[1].x;
                for (let i = 0; i < this.segmentsEachPart; i++) {
                    const worldPos = new Vec3();
                    this.parts[1].getComponent(UITransform)!.convertToWorldSpaceAR(
                        new Vec3(
                            dx > 0 ? (54 - i * 20) : (-54 + i * 20),
                            0,
                            0
                        ),
                        worldPos
                    );
                    const target: SegmentTarget = {
                        pos: worldPos,
                        angle: dx > 0 ? 90 : 270
                    }
                    newTargets.push(target);
                }
            }
            this.segmentTargets.unshift(...newTargets);
        }
    }

    markOccupiedOnTrail() {
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            Data.Grid[point.y][point.x] = 1;
        }
    }

    freeRemovedTrailPoint() {
        const freePoint = this.trail[this.trail.length - 1];
        Data.Grid[freePoint.y][freePoint.x] = 0;
    }

    testBendLCurve() {
        const newTargets = this.bendLCurveTargets({x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}, 6, this.parts[0]);
        for (let i = 0; i < newTargets.length; i++) {
            this.segments[i].worldPosition = newTargets[i].pos;
            this.segments[i].angle = newTargets[i].angle;
        }
    }

    bendLCurveTargets(
        from: Point,
        curr: Point,
        target: Point,
        N: number,
        parent: Node
    ): SegmentTarget[] {
        const half = 50;
        const targets: SegmentTarget[] = [];

        const dx = target.x - from.x;
        const dy = target.y - from.y;
        const dx_fc = from.x - curr.x;

        let cx = 0, cy = 0;
        let startAngle = 0;
        let delta90 = 0;
        let visualFlip = false;

        // ---- determine corner + rotation ----
        if (dx > 0 && dy > 0) {          // 4
            if (dx_fc === 0) {
                cx = half; cy = -half;
                startAngle = 180;
                delta90 = -90;
                visualFlip = true;
                this.segments[0].parent.name = '4_1_ok';
            } else {
                cx = -half; cy = half;
                startAngle = 270;
                delta90 = 90;
                this.segments[0].parent.name = '4_2_ok';
            }
        } else if (dx < 0 && dy > 0) {   // 1
            if (dx_fc === 0) {
                cx = -half; cy = -half;
                startAngle = 0;
                this.segments[0].parent.name = '1_1_ok';
                delta90 = 90;
            } else {
                cx = half; cy = half;
                startAngle = 270;
                delta90 = -90;
                visualFlip = true;
                this.segments[0].parent.name = '1_2_ok';
            }
        } else if (dx > 0 && dy < 0) {   // 3
            if (dx_fc === 0) {
                cx = half; cy = half;
                startAngle = 180;
                delta90 = 90;
                this.segments[0].parent.name = '3_1_ok';
            } else {
                cx = -half; cy = -half;
                startAngle = 90;
                delta90 = -90;
                visualFlip = true;
                this.segments[0].parent.name = '3_2_ok';
            }
        } else if (dx < 0 && dy < 0) {   // 2
            if (dx_fc === 0) {
                cx = -half; cy = half;
                startAngle = 0;
                delta90 = -90;
                visualFlip = true;
                this.segments[0].parent.name = '2_1_ok';

            } else {
                cx = half; cy = -half;
                startAngle = 90;
                delta90 = 90;
                this.segments[0].parent.name = '2_2_ok';
            }
        } else {
            return targets;
        }

        startAngle = this.normalizeAngle(startAngle);
        
        // 🔑 FIX: force delta to exactly ±90
        for (let i = 0; i < N; i++) {
            const t = i / (N - 1);

            const angleDeg = this.normalizeAngle(
                startAngle + delta90 * t
            );

            const rad = angleDeg * Math.PI / 180;
            const x = cx + Math.cos(rad) * half;
            const y = cy + Math.sin(rad) * half;
            
            let visAngle = this.normalizeAngle(
                angleDeg
            );
            if (visualFlip) {
                visAngle = visAngle + 180;
            }

            const worldPos = new Vec3();
            parent.getComponent(UITransform)!.convertToWorldSpaceAR(
                new Vec3(x, y, 0),
                worldPos
            );

            targets.push({
                pos: worldPos,
                angle: visAngle
            });
        }

        return targets;
    }

    normalizeAngle(a: number): number {
        a = a % 360;
        return a < 0 ? a + 360 : a;
    }

    remapVisualAngle(angle: number): number {
        angle = ((angle % 360) + 360) % 360;
    
        if (angle <= 90) {
            return angle;
        }
        if (angle <= 180) {
            return 180 - angle;
        }
        if (angle <= 270) {
            return angle - 180;
        }
        return 360 - angle;
    }

    moveSegmentsToTargets(
        speed: number,
        deltaTime: number,
    ): boolean {

        let allReached = true;

        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const tgt = this.segmentTargets[i];

            // ----- position -----
            const curPos = seg.worldPosition.clone();
            const dist = Vec3.distance(curPos, tgt.pos);

            if (dist > 0.001) {
                const t = Math.min(1, speed * deltaTime / dist);
                Vec3.lerp(curPos, curPos, tgt.pos, t);
                seg.setWorldPosition(curPos);

                // ----- rotation (same t) -----
                const curAngle = this.normalizeAngle(seg.eulerAngles.z);
                const targetAngle = this.normalizeAngle(tgt.angle);

                const nextAngle = this.lerpAngle(curAngle, targetAngle, t);
                seg.setRotationFromEuler(0, 0, nextAngle);

                allReached = false;
            } else {
                // snap if close
                seg.setWorldPosition(tgt.pos);
                seg.setRotationFromEuler(0, 0, tgt.angle);
            }
        }

        return allReached;
    }

    consumeTailTargets(H: number) {
        this.segmentTargets.splice(
            this.segmentTargets.length - H,
            H
        );
    }

    deltaAngle(a: number, b: number): number {
        let d = ((b - a + 180) % 360) - 180;
        if (d < -180) d += 360;
        return d;
    }

    lerpAngle(a: number, b: number, t: number): number {
        a = this.normalizeAngle(a);
        b = this.normalizeAngle(b);
    
        let delta = ((b - a + 180) % 360) - 180;
        if (delta < -180) delta += 360;
    
        return this.normalizeAngle(a + delta * t);
    }
}