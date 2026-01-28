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
    private isMove: boolean = false;

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
        if (this.isMove) this.moveSegmentsToTargets(800, dt);
    }

    moveToPos(pos: Vec3, speed: number, deltaTime: number) {
        const headPos = this.headNode.worldPosition.clone();
        const delta = pos.clone().subtract(headPos);
        const dist = delta.length();

        // move head
        this.headNode.setWorldPosition(pos);

        // move body segments
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
        this.isMove = true;
    }

    updateTrail(newHeadPoint: Point) {
        if (newHeadPoint.x === this.headPoint.x && newHeadPoint.y === this.headPoint.y) return;
        this.freeRemovedTrailPoint();
        for (let i = this.trail.length - 1; i > 0; i--) {
            this.trail[i].x = this.trail[i - 1].x;
            this.trail[i].y = this.trail[i - 1].y;
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
                this.segmentTargets.splice(-newTargets.length, newTargets.length);
                for (let i = 0; i < newTargets.length; i++) {
                    const labelNode = new Node("curtain");
                    const label = labelNode.addComponent(Label);
                    label.string = `${i}`;
                    label.fontSize = 15;
                    labelNode.parent = this.node.parent;
                    labelNode.setWorldPosition(newTargets[i].pos);
                    //labelNode.angle = newTargets[i].angle;
                }
            }
        else {
            const newTargets = [];
            if (this.trail[2].x === this.trail[0].x) {
                const dy = this.trail[1].y - this.trail[0].y;
                for (let i = 0; i < this.segmentsEachPart; i++) {
                    const worldPos = new Vec3();
                    this.parts[1].getComponent(UITransform)!.convertToWorldSpaceAR(
                        new Vec3(
                            0,
                            (-54 + i * 20) * dy,
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
                            (54 - i * 20) * dx,
                            0,
                            0
                        ),
                        worldPos
                    );
                    const target: SegmentTarget = {
                        pos: worldPos,
                        angle: dx > 0 ? 90 : -90
                    }
                    newTargets.push(target);
                }
            }
            this.segmentTargets.unshift(...newTargets);
            this.segmentTargets.splice(-newTargets.length, newTargets.length);
            for (let i = 0; i < newTargets.length; i++) {
                const labelNode = new Node("curtain");
                const label = labelNode.addComponent(Label);
                label.string = `${i}`;
                label.fontSize = 15;
                labelNode.parent = this.node.parent;
                labelNode.setWorldPosition(newTargets[i].pos);
                //labelNode.angle = newTargets[i].angle;
            }
        }
    }

    resetBody(index: number) {
        let j = 0;
        const partCount = this.parts[index].children.length;
        this.parts[index].children.forEach(segment => {
            segment.setPosition(0, -40 + j * (100 / partCount), 0);
            segment.angle = 0;
            j++;
        })
        this.parts[index].name = 'normal';
    }

    lookAtPrevBody(index: number) {
        if (this.trail[index].x === this.trail[index - 1].x)
            this.parts[index].angle = 0;
        else this.parts[index].angle = 90;
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
                this.segments[0].parent.name = '1_2_ok';
            }
        } else if (dx > 0 && dy < 0) {   // 3
            if (dx_fc === 0) {
                cx = half; cy = half;
                startAngle = 180;
                delta90 = 90;
                visualFlip = true;
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
                this.segments[0].parent.name = '2_1_ok';
                visualFlip = true;

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
        deltaTime: number
    ) {
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const target = this.segmentTargets[this.segments.length - 1 - i];
    
            // ---- position ----
            const currentPos = segment.worldPosition.clone();
            const toTarget = target.pos.clone().subtract(currentPos);
            const dist = toTarget.length();
    
            if (dist > 0.01) {
                const step = Math.min(speed * deltaTime, dist);
                toTarget.normalize().multiplyScalar(step);
                segment.setWorldPosition(currentPos.add(toTarget));
            }
    
            // ---- rotation ----
            const currentAngle = segment.eulerAngles.z;
            const newAngle = this.lerpAngle(currentAngle, target.angle, 0.25);
            segment.setRotationFromEuler(0, 0, newAngle);
        }
    }

    lerpAngle(a: number, b: number, t: number): number {
        let delta = ((b - a + 180) % 360) - 180;
        return a + delta * t;
    }
}


