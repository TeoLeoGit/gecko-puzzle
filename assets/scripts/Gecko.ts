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
        //move parts from tail to head
        const toTarget = pos.clone().subtract(this.headNode.worldPosition);
        this.headNode.setWorldPosition(pos);
        const dist = toTarget.length();
        log('movig')
        for (let i = 1; i < this.parts.length; i++) {
            const partWP = this.parts[i].worldPosition;
            if (this.trail[i].x === this.trail[i - 1].x) { //vertical movement 
                if (this.trail[i - 1].y > this.trail[i].y)
                    this.parts[i].setWorldPosition(partWP.x, partWP.y + dist, partWP.z);
                else
                    this.parts[i].setWorldPosition(partWP.x, partWP.y - dist, partWP.z);
            } else { //horizontal movement 
                if (this.trail[i - 1].x > this.trail[i].x)
                    this.parts[i].setWorldPosition(partWP.x + dist, partWP.y, partWP.z);
                else
                    this.parts[i].setWorldPosition(partWP.x - dist, partWP.y, partWP.z);
            }
        }
    }

    updateTrail(newHeadPoint: Point) {
        log('update trail');
        for (let i = this.trail.length - 1; i > 0; i--) {
            this.trail[i].x = this.trail[i - 1].x;
            this.trail[i].y = this.trail[i - 1].y;
        }
        this.headPoint.x = newHeadPoint.x;
        this.headPoint.y = newHeadPoint.y;
        this.trail[0].x = newHeadPoint.x;
        this.trail[0].y = newHeadPoint.y;
    }
}


