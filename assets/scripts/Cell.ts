import { _decorator, Component, Node } from 'cc';
import { Point } from './AStar';
const { ccclass, property } = _decorator;

@ccclass('Cell')
export class Cell extends Component {
    point: Point = null;
    start() {

    }

    update(deltaTime: number) {
        
    }
}


