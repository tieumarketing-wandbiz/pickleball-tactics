/** Shared numerical QA; not imported by the production renderer.
 * A finite-difference velocity change measures acceleration, NOT a discontinuity. */
export const AUDIT_DT = 1 / 240;
export type AuditPoint = { x: number; y: number; z: number };
type Maximum = { value: number; time: number };
export interface MotionAudit {
  /** Diagnostic only, retained for older reports; no longer an acceptance threshold. */
  jumps: Record<string, Maximum>;
  acceleration: Record<string, Maximum>;
  spikes: Record<string, Maximum>;
  peakSpeed: number;
  peakTime: number;
}
const subtract = (a: AuditPoint, b: AuditPoint, scale = 1): AuditPoint =>
  ({ x: (a.x-b.x)*scale, y: (a.y-b.y)*scale, z: (a.z-b.z)*scale });
const norm = (v: AuditPoint) => Math.hypot(v.x,v.y,v.z);
const median = (values: number[]) => values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
function maximum(out: Record<string,Maximum>, name: string, value: number, time: number) {
  if(value>(out[name]?.value ?? -1))out[name]={value,time};
}
export function auditMotion(sample: (t: number) => Record<string, AuditPoint>, start: number, end: number): MotionAudit {
  const result: MotionAudit = {jumps:{},acceleration:{},spikes:{},peakSpeed:0,peakTime:0};
  const acceleration: Record<string,{time:number; vector:AuditPoint}[]> = {};
  let before:Record<string,AuditPoint>|undefined, priorVelocity:Record<string,AuditPoint>|undefined;
  for(let i=Math.floor(start/AUDIT_DT);i<=Math.ceil(end/AUDIT_DT);i++) {
    const t=i*AUDIT_DT, points=sample(t), velocity:Record<string,AuditPoint>={};
    if(before)for(const [name,p] of Object.entries(points)) {
      const a=before[name]; if(!a)continue;
      const v=subtract(p,a,1/AUDIT_DT); velocity[name]=v;
      const speed=norm(v);
      if(name==='paddle' && speed>result.peakSpeed){result.peakSpeed=speed;result.peakTime=t-AUDIT_DT/2;}
      const old=priorVelocity?.[name];if(!old)continue;
      const acc=subtract(v,old,1/AUDIT_DT), time=t-AUDIT_DT;
      maximum(result.jumps,name,norm(acc)*AUDIT_DT,time);
      maximum(result.acceleration,name,norm(acc),time);
      (acceleration[name] ??= []).push({time,vector:acc});
    }
    before=points;priorVelocity=velocity;
  }
  for(const [name,rows] of Object.entries(acceleration))for(let i=4;i<rows.length-4;i++) {
    const neighbours=rows.slice(i-4,i+5).map(r=>r.vector);
    // Componentwise vector median preserves the meaning of |a - median(a)| on curved paths.
    const middle={x:median(neighbours.map(v=>v.x)),y:median(neighbours.map(v=>v.y)),z:median(neighbours.map(v=>v.z))};
    maximum(result.spikes,name,norm(subtract(rows[i].vector,middle)),rows[i].time);
  }
  return result;
}
export interface BoundaryAudit { time:number; name:string; positionJump:number; velocityJump:number; speed:number }
/** Two-sided limiting values for a general FK/IK sampler. Quadratic extrapolation to the
 * boundary removes ordinary acceleration from the comparison (h=10us, not a 240Hz interval).
 * Core Hermite curves additionally have exact analytic derivative tests. */
export function auditBoundaries(sample:(t:number)=>Record<string,AuditPoint>, boundaries:number[], h=1e-5):BoundaryAudit[] {
  const reports:BoundaryAudit[]=[];
  const combine=(a:AuditPoint,b:AuditPoint,c:AuditPoint,ca:number,cb:number,cc:number):AuditPoint=>({
    x:ca*a.x+cb*b.x+cc*c.x,y:ca*a.y+cb*b.y+cc*c.y,z:ca*a.z+cb*b.z+cc*c.z});
  for(const t of [...new Set(boundaries)].sort((a,b)=>a-b)) {
    const lm3=sample(t-3*h),lm2=sample(t-2*h),lm1=sample(t-h);
    const rp1=sample(t+h),rp2=sample(t+2*h),rp3=sample(t+3*h);
    for(const name of Object.keys(lm1)) {
      if(!rp1[name])continue;
      const left=combine(lm1[name],lm2[name],lm3[name],3,-3,1),right=combine(rp1[name],rp2[name],rp3[name],3,-3,1);
      const vl=combine(lm1[name],lm2[name],lm3[name],2.5/h,-4/h,1.5/h),vr=combine(rp1[name],rp2[name],rp3[name],-2.5/h,4/h,-1.5/h);
      reports.push({time:t,name,positionJump:norm(subtract(left,right)),velocityJump:norm(subtract(vl,vr)),speed:Math.max(norm(vl),norm(vr))});
    }
  }
  return reports;
}
