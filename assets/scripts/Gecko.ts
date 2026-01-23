import { _decorator, Component, Node } from 'cc';
import { Point } from './AStar';
const { ccclass, property } = _decorator;

@ccclass('Gecko')
export class Gecko extends Component {
    private headPoint: Point = { x: 0, y: 0 };
    private tailCell: Point = null;
    private trail: Point[] = []

    get HeadPoint(): Point {
        return this.headPoint;
    }

    get TailPoint(): Point {
        return this.tailCell;
    }

    set HeadPoint(point: Point) {
        this.headPoint = point;
    }

    init(bodyLength: number) {
        
    }
}


