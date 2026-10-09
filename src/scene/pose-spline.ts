import * as T from 'three';
import { hermite } from '../core/motion-curve';
/** A few solved drawings, not per-frame IK branch selection. Components share time tangents;
 * quaternion hemispheres are unwrapped once before normalized Hermite evaluation. */
export interface RigDrawing { time: number; values: Float64Array }
export class PoseSpline {
  private tangents: Float64Array[];
  constructor(readonly keys: RigDrawing[], quaternionOffsets: number[]) {
    for (const c of quaternionOffsets) for (let i=1;i<keys.length;i++) {
      const a=keys[i-1].values,b=keys[i].values;
      if (a[c]*b[c]+a[c+1]*b[c+1]+a[c+2]*b[c+2]+a[c+3]*b[c+3]<0)
        for(let j=0;j<4;j++)b[c+j]*=-1;
    }
    this.tangents=keys.map((k,i)=>{
      const v=new Float64Array(k.values.length);
      if(i>0&&i<keys.length-1){const a=keys[i-1],b=keys[i+1];
        for(let c=0;c<v.length;c++)v[c]=(b.values[c]-a.values[c])/(b.time-a.time);}
      return v;
    });
  }
  setVelocity(key: number, channel: number, velocity: number) { this.tangents[key][channel] = velocity; }
  scaleVelocity(key: number, channel: number, scale: number) { this.tangents[key][channel] *= scale; }
  /** Fritsch-Carlson tangents for bounded anatomical scalar channels. */
  monotoneChannel(channel:number){
    for(let i=1;i<this.keys.length-1;i++){
      const a=this.keys[i-1],b=this.keys[i],c=this.keys[i+1],h0=b.time-a.time,h1=c.time-b.time;
      const left=(b.values[channel]-a.values[channel])/h0,right=(c.values[channel]-b.values[channel])/h1;
      const w0=2*h1+h0,w1=h1+2*h0;
      const m=left*right<=0 ? 0 : (w0+w1)/(w0/left+w1/right);
      this.tangents[i][channel]=Math.sign(m)*Math.min(Math.abs(m),3*Math.min(Math.abs(left),Math.abs(right)));
    }
  }
  sample(time:number,out:Float64Array){
    const keys=this.keys;
    if(time<=keys[0].time){out.set(keys[0].values);return;}
    if(time>=keys.at(-1)!.time){out.set(keys.at(-1)!.values);return;}
    let i=0;while(time>keys[i+1].time)i++;
    const a=keys[i],b=keys[i+1],d=b.time-a.time,u=(time-a.time)/d;
    for(let c=0;c<out.length;c++)out[c]=hermite(a.values[c],b.values[c],this.tangents[i][c],this.tangents[i+1][c],d,u);
  }
}
export const readQuaternion = (q:T.Quaternion, values:Float64Array, c:number) => q.set(values[c],values[c+1],values[c+2],values[c+3]).normalize();
