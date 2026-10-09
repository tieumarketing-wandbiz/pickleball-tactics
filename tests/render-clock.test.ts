import { describe, expect, it } from "vitest";
import * as T from "three";
import { PLAYBACK_FPS, SHUTTER_SECONDS, PlaybackClock, PlaybackRenderClock } from "../src/core/render-clock";
import { ShutterGhosts } from "../src/scene/shutter-ghosts";
describe("24 fps render clock", () => {
  it("paces 120 Hz RAF at 24 fps for 45 seconds without phase drift", () => {
    const clock = new PlaybackRenderClock(); let renders=0;
    for(let i=0;i<45*120;i++) if(clock.due(i*1000/120,true,false)) renders++;
    expect(renders).toBe(45*PLAYBACK_FPS);
  });
  it("drops missed renders, not real elapsed time; interactive/paused changes render immediately", () => {
    const pacing=new PlaybackRenderClock(), clock=new PlaybackClock();
    clock.resume(10); expect(pacing.due(0,true,false)).toBe(true);
    expect(pacing.due(1200,true,false)).toBe(true);
    expect(pacing.due(1201,true,false)).toBe(false);
    expect(clock.sample(11.2)).toBeCloseTo(1.2,12);
    expect(pacing.due(1202,true,true)).toBe(true);
    expect(pacing.due(1203,false,false)).toBe(false);
    expect(pacing.due(1204,false,true)).toBe(true);
  });
  it("pauses at event time and resumes with no loss, rounding, or double counting", () => {
    const clock=new PlaybackClock(); clock.resume(7);
    expect(clock.pause(7.123456)).toBeCloseTo(0.123456,12);
    expect(clock.sample(100)).toBeCloseTo(0.123456,12);
    clock.resume(100); clock.resume(101);
    expect(clock.sample(100.2)).toBeCloseTo(0.323456,12);
    clock.reset(); expect(clock.sample(1000)).toBe(0);
  });
});
describe("pooled single-pass 180° shutter", () => {
  it("reuses four ghosts per object, shows a fast swoosh, and hides on pause/still", () => {
    const scene=new T.Scene(), paddle=new T.Group(), ball=new T.Group(); scene.add(paddle,ball);
    const blur=new ShutterGhosts(scene,[paddle],ball);
    const geometry=blur.swoosh.geometry, data=geometry.getAttribute("position").array;
    expect(SHUTTER_SECONDS).toBe(1/48);
    blur.update(0,true); expect(blur.group.visible).toBe(false);
    paddle.position.x=0.2; ball.position.x=0.4;
    blur.update(1/24,true);
    expect(blur.paddle.map(m=>m.count)).toEqual([1,1,1,1]);
    expect(blur.ball.map(m=>m.count)).toEqual([1,1,1,1]);
    expect(blur.swoosh.geometry.drawRange.count).toBe(24);
    const matrix=new T.Matrix4(); blur.paddle[3].getMatrixAt(0,matrix);
    expect(matrix.elements[12]).toBeCloseTo(0.1,6); // oldest sample exactly 20.833ms back
    blur.update(2/24,true); expect(blur.group.visible).toBe(false);
    for(let i=3;i<50;i++){paddle.position.x=i*.1;blur.update(i/24,true);}
    expect(blur.swoosh.geometry).toBe(geometry); expect(geometry.getAttribute("position").array).toBe(data);
    blur.group.traverse(o=>{expect(o.castShadow).toBe(false);expect(o.receiveShadow).toBe(false);});
    blur.update(3,false); expect(blur.group.visible).toBe(false);
  });
});
