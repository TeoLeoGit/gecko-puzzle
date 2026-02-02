import { Point } from "./AStar";

export class Utils  {
    static normalizeAngle(a: number): number {
        a = a % 360;
        return a < 0 ? a + 360 : a;
    }

    static lerpAngle(a: number, b: number, t: number): number {
        let delta = ((b - a + 540) % 360) - 180;
        return Utils.normalizeAngle(a + delta * t);
    }

    static flipAngle180(angle: number): number {
        angle += 180;
        angle %= 360;
        if (angle > 180) angle -= 360;
        return angle;
    }

    static manhattan(a: Point, b: Point): number {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

}


