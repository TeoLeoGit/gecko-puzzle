import { _decorator, Component, log, Node, Skeleton, sp, UITransform, Vec3 } from 'cc';
import { Point } from './AStar';
import { Data } from './Data';
import { Utils } from './Utils';
import { Config } from './Config';
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

    @property(Node)
    legsNode: Node = null!;

    private headPoint: Point = { x: 0, y: 0 };
    private tailPoint: Point = { x: 0, y: 3 };
    private movePoint: Point = null;
    private endPoint:  Point = null;
    private trail:     Point[] = [
        {x: 0, y: 0},
        {x: 0, y: 1},
        {x: 0, y: 2},
        {x: 0, y: 3}
    ];
    private backwardPoint1: Point = null;
    private baclwardPoint2: Point = null;
    private legSegments: Node[] = [];
    private segments:    Node[] = [];
    private moveNode:    Node = null;
    private endNode:     Node = null;
    private segmentTargets : SegmentTarget[] = [];
    private isMovingHead: boolean = true;
    private isMoving    : boolean = false;
    private isBackwards : boolean = false;
    private segmentsEachPart: number = 6;
    private legSkeletons: sp.Skeleton[] = [];

    get MovePoint(): Point {
        return this.movePoint;
    }

    get MoveNode(): Node {
        return this.moveNode;
    }

    get IsBackwards(): boolean {
        return this.isBackwards;
    }

    get IsMoving(): boolean {
        return this.isMoving;
    }

    protected onLoad(): void {
        this.markOccupiedOnTrail();
        const nodeSegments = this.node.getChildByName('segments');
        nodeSegments.setParent(this.node);
        for (let i = 1; i < this.parts.length - 1; i++) {
            this.parts[i].children.forEach(segment => {
                this.segments.push(segment);
            });
        }
        this.segments.forEach(segment => {
            segment.setParent(nodeSegments, true);
            const leg = segment.getChildByName('leg');
            if (leg) {
                this.legSegments.push(segment);
                const legComp = leg.getComponent(sp.Skeleton)
                this.legSkeletons.push(legComp);
                // leg.parent = this.legsNode;
                // leg.position = segment.position;
                legComp.paused = true;
            }
        });
        this.initSegmentTargets();
        this.segments.forEach((child, i) => {
            child.setSiblingIndex(this.segments.length - 1 - i);
        });
    }

    initSegmentTargets() {
        this.segments.forEach(segment => {
            this.segmentTargets.push({
                pos: segment.worldPosition,
                angle: segment.angle
            });
        })
    }

    protected update(dt: number): void {
        if (this.segmentTargets.length <= this.segments.length) return;
        const done = this.moveSegmentsToTargets(Data.MoveSpeed, dt);

        const remaining = this.segmentTargets.length - this.segments.length;
        if (done && remaining > 0) {
            this.isMoving = false;
            this.consumeTailTargets(6);
        } 
        this.animateLegs();
    }

    moveTo(pos: Vec3, speed: number, dt: number) {
        this.isMoving = true;
        this.moveNode.setWorldPosition(pos);
        this.moveEndNode(speed, dt);    
    }

    isTouchGecko(point: Point): boolean {
        if (point) {
            for (let i = 0; i < this.trail.length; i++) {
                if (point.x === this.trail[i].x && point.y === this.trail[i].y) return true;
            }
        }
        return false;
    }
 
    isBackwardsDirection(dragPoint: Point): boolean {
        if (dragPoint) {
            for (let i = 1; i < this.trail.length - 1; i++) {
                if (dragPoint.x === this.trail[i].x && dragPoint.y === this.trail[i].y) return true;
            }
        }
        return false;
    }

    setBackwardsMovement(isBackward: boolean) {
        this.isBackwards = isBackward;
        const n = this.trail.length - 1;
        this.backwardPoint1 = this.trail[n];
        this.baclwardPoint2 = this.trail[n - 1];
    }

    getBackwardsPoint(): Point {
        if (this.isMoving) return null;

        const { x, y } = this.backwardPoint1;
        const dx = this.backwardPoint1.x - this.baclwardPoint2.x;
        const dy = this.backwardPoint1.y - this.baclwardPoint2.y;

        const isFree = (nx: number, ny: number) =>
            nx >= 0 && nx < Config.Cols &&
            ny >= 0 && ny < Config.Rows &&
            Data.Grid[ny][nx] !== 1;

        // movement priority lists
        let candidates: Point[] = [];

        if (dx !== 0) {
            // horizontal movement → prefer left/right, then up/down
            candidates = dx > 0
                ? [
                    { x: x + 1, y }, // right
                    { x: x - 1, y }, // left
                    { x, y: y + 1 }, // up
                    { x, y: y - 1 }, // down
                ]
                : [
                    { x: x - 1, y }, // left
                    { x: x + 1, y }, // right
                    { x, y: y + 1 }, // up
                    { x, y: y - 1 }, // down
                ];
        } else {
            // vertical movement → prefer up/down, then left/right
            candidates = dy > 0
                ? [
                    { x, y: y + 1 }, // up
                    { x, y: y - 1 }, // down
                    { x: x + 1, y }, // right
                    { x: x - 1, y }, // left
                ]
                : [
                    { x, y: y - 1 }, // down
                    { x, y: y + 1 }, // up
                    { x: x + 1, y }, // right
                    { x: x - 1, y }, // left
                ];
        }

        for (const p of candidates) {
            if (isFree(p.x, p.y)) return p;
        }

        return null;
    }

    private moveEndNode(speed: number, dt: number) {
        const n = this.parts.length;
        const curPos = this.endNode.position.clone();
        const tgtPos = new Vec3(this.trail[n - 1].x * Data.CellSize, this.trail[n - 1].y * Data.CellSize);

        const dist = Vec3.distance(curPos, tgtPos);

        if (dist > 0.001) {
            const t = Math.min(1, speed * dt / dist);
            Vec3.lerp(curPos, curPos, tgtPos, t);
            this.endNode.setPosition(curPos);

            // ----- rotation (same t) -----
            const curAngle = Utils.normalizeAngle(this.endNode.eulerAngles.z);
            let delta = this.endNode === this.tailNode ? 0 : 180;
            const targetAngle = Utils.normalizeAngle(this.segments[this.segments.length - 1].angle + delta);

            const nextAngle = Utils.lerpAngle(curAngle, targetAngle, t);
            this.endNode.setRotationFromEuler(0, 0, nextAngle);
        } else {
            // snap if close
            this.endNode.setPosition(tgtPos);
        }
    }

    updateTrail(targetPoint: Point) {
        if (targetPoint.x === this.movePoint.x && targetPoint.y === this.movePoint.y) return;
        const freePoint = this.trail[this.trail.length - 1];
        Data.Grid[freePoint.y][freePoint.x] = 0;
        for (let i = this.trail.length - 1; i > 0; i--) {
            this.trail[i].x = this.trail[i - 1].x;
            this.trail[i].y = this.trail[i - 1].y;
            if (i < this.trail.length - 1)
                this.parts[i].position = new Vec3(this.trail[i].x * Data.CellSize, this.trail[i].y * Data.CellSize);
            else {
                this.endPoint.x = this.trail[i].x;
                this.endPoint.y = this.trail[i].y;
            }
        }
        this.movePoint.x = targetPoint.x;
        this.movePoint.y = targetPoint.y;
        this.trail[0].x = targetPoint.x;
        this.trail[0].y = targetPoint.y;
        this.markOccupiedOnTrail();
    }

    lookAt2D(target: Vec3) {
        const from = this.moveNode.worldPosition;
        const to = target;
    
        const dx = to.x - from.x;
        const dy = to.y - from.y;
    
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = angleRad * 180 / Math.PI + 90;
        let delta = this.endNode === this.tailNode ? 0 : 180;
    
        this.moveNode.setRotationFromEuler(0, 0, angleDeg + delta);
    }

    animateLegs() {
        for (let i = 0; i < this.legSkeletons.length; i++) {
            this.legSkeletons[i].paused = !this.isMoving;
            // this.legSkeletons[i].node.position = this.legSegments[i].position;
            // this.legSkeletons[i].node.angle = this.legSegments[i].angle;
        }
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
                        angle: this.segments[0].angle
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
                        angle: this.segments[0].angle
                    }
                    newTargets.push(target);
                }
            }
            this.segmentTargets.unshift(...newTargets);
        }
    }

    private markOccupiedOnTrail() {
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            Data.Grid[point.y][point.x] = 1;
        }
    }

    private bendLCurveTargets(
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
            } else {
                cx = -half; cy = half;
                startAngle = 270;
                delta90 = 90;
            }
        } else if (dx < 0 && dy > 0) {   // 1
            if (dx_fc === 0) {
                cx = -half; cy = -half;
                startAngle = 0;
                delta90 = 90;
            } else {
                cx = half; cy = half;
                startAngle = 270;
                delta90 = -90;
                visualFlip = true;
            }
        } else if (dx > 0 && dy < 0) {   // 3
            if (dx_fc === 0) {
                cx = half; cy = half;
                startAngle = 180;
                delta90 = 90;
            } else {
                cx = -half; cy = -half;
                startAngle = 90;
                delta90 = -90;
                visualFlip = true;
            }
        } else if (dx < 0 && dy < 0) {   // 2
            if (dx_fc === 0) {
                cx = -half; cy = half;
                startAngle = 0;
                delta90 = -90;
                visualFlip = true;
            } else {
                cx = half; cy = -half;
                startAngle = 90;
                delta90 = 90;
            }
        } else {
            return targets;
        }

        startAngle = Utils.normalizeAngle(startAngle);
        
        for (let i = 0; i < N; i++) {
            const t = i / (N - 1);

            const angleDeg = Utils.normalizeAngle(
                startAngle + delta90 * t
            );

            const rad = angleDeg * Math.PI / 180;
            const x = cx + Math.cos(rad) * half;
            const y = cy + Math.sin(rad) * half;
            
            let visAngle = Utils.normalizeAngle(
                angleDeg
            );
            
            if (visualFlip) {
                visAngle = Utils.normalizeAngle(visAngle + 180);
            }
            

            const worldPos = new Vec3();
            parent.getComponent(UITransform)!.convertToWorldSpaceAR(
                new Vec3(x, y, 0),
                worldPos
            );

            targets.push({
                pos: worldPos,
                angle: visAngle,
            });
        }

        return targets;
    }

    private moveSegmentsToTargets(
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
                const curAngle = Utils.normalizeAngle(seg.eulerAngles.z);
                const targetAngle = Utils.normalizeAngle(tgt.angle);

                const nextAngle = Utils.lerpAngle(curAngle, targetAngle, t);
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

    private consumeTailTargets(H: number) {
        this.segmentTargets.splice(
            this.segmentTargets.length - H,
            H
        );
    }

    previewMove(targetPos: Vec3) {
        
    }

    determineMovementDirection(targetPoint: Point) {
        if (this.segmentTargets.length > this.segments.length) return;
        const distFromHead = Utils.manhattan(targetPoint, this.headPoint);
        const distFromTail = Utils.manhattan(targetPoint, this.tailPoint);

        if (distFromHead <= distFromTail) { //move head
            this.movePoint = this.headPoint;
            this.endPoint = this.tailPoint;
            this.moveNode = this.headNode;
            this.endNode = this.tailNode;
            if (!this.isMovingHead) this.reverseDirection();
            this.isMovingHead = true;
        } else {                            //move tail
            this.movePoint = this.tailPoint;
            this.endPoint = this.headPoint;
            this.moveNode = this.tailNode;
            this.endNode = this.headNode;
            if (this.isMovingHead) this.reverseDirection();
            this.isMovingHead = false;
        }
    }

    reverseDirection() {
        this.segmentTargets = this.segmentTargets.reverse();
        this.trail          = this.trail.reverse();
        this.segments       = this.segments.reverse();
        this.parts          = this.parts.reverse();
        this.segments.forEach(segment => {
            segment.angle = Utils.normalizeAngle(segment.angle + 180)
            segment.setScale(-segment.scale.x,-segment.scale.y, 1);
        });
    }
}