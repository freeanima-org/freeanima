import type { VRM } from "@pixiv/three-vrm";

type HumanBone =
  | "hips"
  | "spine"
  | "chest"
  | "neck"
  | "head"
  | "leftUpperLeg"
  | "leftLowerLeg"
  | "rightUpperLeg"
  | "rightLowerLeg"
  | "leftUpperArm"
  | "leftLowerArm"
  | "rightUpperArm"
  | "rightLowerArm";

function bone(vrm: VRM, name: HumanBone) {
  return vrm.humanoid.getNormalizedBoneNode(name);
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 每完成一个迈步周期对应的屏幕位移（越大 → 腿摆越慢） */
const STRIDE_LENGTH_PX = 92;

type IdleHeadState = "wait" | "tilt" | "hold" | "return";

/** VRM 归一化 T 字基础上，上臂绕 Z 下垂的角度（约 78°） */
const UPPER_ARM_HANG_Z = 1.36;
/** 小臂自然微弯 */
const LOWER_ARM_REST_X = -0.38;
/** 走路摆臂幅度（弧度） */
const WALK_ARM_SWING = 0.32;

function setUpperArmHang(
  upper: NonNullable<ReturnType<typeof bone>>,
  side: "left" | "right",
): void {
  upper.rotation.order = "ZXY";
  const hangZ = side === "left" ? UPPER_ARM_HANG_Z : -UPPER_ARM_HANG_Z;
  upper.rotation.set(0, 0, hangZ);
}

function setLowerArmRest(lower: NonNullable<ReturnType<typeof bone>>): void {
  lower.rotation.order = "XYZ";
  lower.rotation.set(LOWER_ARM_REST_X, 0, 0);
}

/** 自然垂臂（避免 T 字举臂） */
function applyNaturalArmRest(vrm: VRM): void {
  const leftUpperArm = bone(vrm, "leftUpperArm");
  const rightUpperArm = bone(vrm, "rightUpperArm");
  const leftLowerArm = bone(vrm, "leftLowerArm");
  const rightLowerArm = bone(vrm, "rightLowerArm");

  if (leftUpperArm) setUpperArmHang(leftUpperArm, "left");
  if (rightUpperArm) setUpperArmHang(rightUpperArm, "right");
  if (leftLowerArm) setLowerArmRest(leftLowerArm);
  if (rightLowerArm) setLowerArmRest(rightLowerArm);
}

/** 对侧甩臂：先 Z 下垂，再在局部 X 轴前后摆 */
function applyWalkArmSwing(vrm: VRM, armPhase: number): void {
  const armSwing = Math.sin(armPhase) * WALK_ARM_SWING;
  const leftUpperArm = bone(vrm, "leftUpperArm");
  const rightUpperArm = bone(vrm, "rightUpperArm");
  const leftLowerArm = bone(vrm, "leftLowerArm");
  const rightLowerArm = bone(vrm, "rightLowerArm");

  if (leftUpperArm) {
    leftUpperArm.rotation.order = "ZXY";
    leftUpperArm.rotation.set(-armSwing, 0, UPPER_ARM_HANG_Z);
  }
  if (rightUpperArm) {
    rightUpperArm.rotation.order = "ZXY";
    rightUpperArm.rotation.set(armSwing, 0, -UPPER_ARM_HANG_Z);
  }
  if (leftLowerArm) {
    const bend = LOWER_ARM_REST_X + Math.max(0, -armSwing) * 0.2;
    leftLowerArm.rotation.set(bend, 0, 0);
  }
  if (rightLowerArm) {
    const bend = LOWER_ARM_REST_X + Math.max(0, armSwing) * 0.2;
    rightLowerArm.rotation.set(bend, 0, 0);
  }
}

/** 程序化 idle / walk（不依赖外部 VRMA 文件） */
export class VrmProceduralLocomotion {
  private walkPhase = 0;
  private idlePhase = 0;
  private idleHeadTiltZ = 0;
  private idleHeadTiltY = 0;
  private idleHeadState: IdleHeadState = "wait";
  private idleHeadTimer = 0;
  private idleHeadTargetZ = 0;
  private idleHeadTargetY = 0;

  reset(vrm: VRM): void {
    vrm.humanoid.resetNormalizedPose();
    applyNaturalArmRest(vrm);
    this.walkPhase = 0;
    this.idlePhase = 0;
    this.idleHeadTiltZ = 0;
    this.idleHeadTiltY = 0;
    this.idleHeadState = "wait";
    this.idleHeadTimer = randomRange(2.5, 6);
    this.idleHeadTargetZ = 0;
    this.idleHeadTargetY = 0;
  }

  /** 走路时头颈随步态轻微前后点、左右摆，头发由 spring bone 跟随 */
  private applyWalkHead(vrm: VRM, walkPhase: number): void {
    const step = Math.abs(Math.sin(walkPhase));
    const sway = Math.sin(walkPhase);
    const bob = step * 0.045;
    const roll = sway * 0.032;
    const yaw = Math.sin(walkPhase * 0.5 + 0.4) * 0.018;

    const spine = bone(vrm, "spine");
    const chest = bone(vrm, "chest");
    const neck = bone(vrm, "neck");
    const head = bone(vrm, "head");

    if (spine) spine.rotation.z = roll * 0.08;
    if (chest) {
      chest.rotation.x = bob * 0.12;
      chest.rotation.z = roll * 0.14;
    }
    if (neck) {
      neck.rotation.x = bob * 0.35;
      neck.rotation.z = -roll * 0.28;
      neck.rotation.y = yaw * 0.35;
    }
    if (head) {
      head.rotation.x = bob * 0.42;
      head.rotation.z = roll * 0.52;
      head.rotation.y = yaw * 0.55;
    }
  }

  /** 站立时偶尔歪头，带平滑过渡 */
  private applyIdleHead(vrm: VRM, delta: number): void {
    const tiltSpeed = 2.8;
    const lerp = 1 - Math.exp(-tiltSpeed * delta);

    switch (this.idleHeadState) {
      case "wait":
        this.idleHeadTimer -= delta;
        if (this.idleHeadTimer <= 0) {
          const sign = Math.random() < 0.5 ? -1 : 1;
          this.idleHeadTargetZ = sign * randomRange(0.09, 0.15);
          this.idleHeadTargetY = sign * randomRange(0.04, 0.1);
          this.idleHeadState = "tilt";
        }
        break;
      case "tilt":
        this.idleHeadTiltZ += (this.idleHeadTargetZ - this.idleHeadTiltZ) * lerp;
        this.idleHeadTiltY += (this.idleHeadTargetY - this.idleHeadTiltY) * lerp;
        if (
          Math.abs(this.idleHeadTiltZ - this.idleHeadTargetZ) < 0.008 &&
          Math.abs(this.idleHeadTiltY - this.idleHeadTargetY) < 0.008
        ) {
          this.idleHeadState = "hold";
          this.idleHeadTimer = randomRange(0.9, 2.4);
        }
        break;
      case "hold":
        this.idleHeadTimer -= delta;
        if (this.idleHeadTimer <= 0) {
          this.idleHeadState = "return";
        }
        break;
      case "return":
        this.idleHeadTiltZ += (0 - this.idleHeadTiltZ) * lerp;
        this.idleHeadTiltY += (0 - this.idleHeadTiltY) * lerp;
        if (Math.abs(this.idleHeadTiltZ) < 0.006 && Math.abs(this.idleHeadTiltY) < 0.006) {
          this.idleHeadTiltZ = 0;
          this.idleHeadTiltY = 0;
          this.idleHeadState = "wait";
          this.idleHeadTimer = randomRange(4, 10);
        }
        break;
    }

    const micro = Math.sin(this.idlePhase * 0.7) * 0.008;
    const neck = bone(vrm, "neck");
    const head = bone(vrm, "head");

    if (neck) {
      neck.rotation.z = this.idleHeadTiltZ * 0.35 + micro;
      neck.rotation.y = this.idleHeadTiltY * 0.35;
    }
    if (head) {
      head.rotation.z = this.idleHeadTiltZ + micro * 0.5;
      head.rotation.y = this.idleHeadTiltY;
    }
  }

  applyIdle(vrm: VRM, delta: number): void {
    vrm.humanoid.resetNormalizedPose();
    applyNaturalArmRest(vrm);

    this.idlePhase += delta * 1.6;
    const breath = Math.sin(this.idlePhase) * 0.02;
    const chest = bone(vrm, "chest");
    const spine = bone(vrm, "spine");
    if (chest) chest.rotation.x += breath;
    if (spine) spine.rotation.x += breath * 0.45;

    this.applyIdleHead(vrm, delta);
  }

  applyWalk(vrm: VRM, delta: number, speedPxPerSec: number): void {
    vrm.humanoid.resetNormalizedPose();

    this.walkPhase += ((speedPxPerSec * delta) / STRIDE_LENGTH_PX) * Math.PI * 2;

    const swing = Math.sin(this.walkPhase) * 0.24;
    const step = Math.max(0, Math.sin(this.walkPhase));
    const leftKnee = Math.max(0, Math.sin(this.walkPhase + 0.35)) * 0.28;
    const rightKnee = Math.max(0, Math.sin(this.walkPhase + Math.PI + 0.35)) * 0.28;
    const bounce = step * 0.01;

    const hips = bone(vrm, "hips");
    const spine = bone(vrm, "spine");
    const leftUpperLeg = bone(vrm, "leftUpperLeg");
    const rightUpperLeg = bone(vrm, "rightUpperLeg");
    const leftLowerLeg = bone(vrm, "leftLowerLeg");
    const rightLowerLeg = bone(vrm, "rightLowerLeg");

    if (hips) hips.position.y = 0;
    if (spine) spine.rotation.x = -bounce * 1.6;

    if (leftUpperLeg) leftUpperLeg.rotation.x = swing;
    if (rightUpperLeg) rightUpperLeg.rotation.x = -swing;
    if (leftLowerLeg) leftLowerLeg.rotation.x = leftKnee;
    if (rightLowerLeg) rightLowerLeg.rotation.x = rightKnee;

    applyWalkArmSwing(vrm, this.walkPhase);

    this.applyWalkHead(vrm, this.walkPhase);
  }
}
