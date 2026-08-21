import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import {
  createVrmAnimationClip,
  firstVrmAnimation,
  registerVrmAnimationLoader,
} from "../../renderer/vrm-animation-access.ts";
import { motionManifest } from "@freeanima/shared/companion-app/motion-manifest.ts";
import {
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
} from "@freeanima/features/companion/ui/spa/lib/window-metrics.ts";
import { loadCachedModelSource } from "@freeanima/features/companion/ui/spa/lib/model-cache.ts";
import { formatVrmLoadError } from "@freeanima/features/companion/ui/spa/lib/vrm-load-error.ts";
import {
  applyVrmCameraFraming,
  computeVrmFraming,
} from "@freeanima/features/companion/ui/spa/renderer/VrmCameraFraming.ts";
import { getVrmScene } from "@freeanima/features/companion/ui/spa/renderer/vrm-three-access.ts";

type Props = {
  modelPath: string;
  /** `/motions/{id}.vrma` 或仅文件名（相对 motionManifest.baseUrl） */
  motionFile: string;
  width: number;
  className?: string;
};

/** motionFile 已是 `/motions/…` 时勿再拼 baseUrl（否则变成 `/motions//motions/…`） */
export function resolvePreviewMotionPath(motionFile: string): string {
  const trimmed = motionFile.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `${motionManifest.baseUrl}/${trimmed}`;
}

export function MotionPreviewCanvas({ modelPath, motionFile, width, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = Math.round((width * COMPANION_WINDOW_HEIGHT) / COMPANION_WINDOW_WIDTH);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !modelPath.trim() || !motionFile.trim()) return () => {};

    let disposed = false;
    let revokeModel: (() => void) | undefined;
    let animationId: number | null = null;
    const clock = new THREE.Clock();
    setError(null);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(1, 2, 2);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    let vrm: VRM | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let controls: OrbitControls | null = null;

    const resize = (): void => {
      const w = canvas.clientWidth || width;
      const h = canvas.clientHeight || height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const startRenderLoop = (): void => {
      if (disposed || animationId != null) return;
      const tick = (): void => {
        if (disposed) return;
        animationId = requestAnimationFrame(tick);
        const delta = clock.getDelta();
        mixer?.update(delta);
        vrm?.update(delta);
        controls?.update();
        renderer.render(scene, camera);
      };
      tick();
    };

    void (async () => {
      try {
        const cached = await loadCachedModelSource(modelPath);
        revokeModel = cached.revoke;
        if (disposed) return;

        const vrmLoader = new GLTFLoader();
        vrmLoader.register((parser) => new VRMLoaderPlugin(parser));
        const gltf = await vrmLoader.loadAsync(cached.url);
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 第三方/库类型边界
        const loaded = gltf.userData.vrm as VRM | undefined;
        if (!loaded || disposed) return;

        VRMUtils.rotateVRM0(loaded);
        scene.add(loaded.scene);
        vrm = loaded;

        const { framing } = computeVrmFraming(loaded);
        applyVrmCameraFraming(camera, framing, {
          paddingX: 1.06,
          topHeadroomRatio: 0.36,
          bottomMarginRatio: 0.03,
          canvasHeight: height,
          footprintHeight: height,
          fitWidth: true,
          framingAspect: width / Math.max(height, 1),
        });

        controls = new OrbitControls(camera, canvas);
        controls.target.set(framing.centerX, framing.lookAtY, 0);
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.minPolarAngle = (30 * Math.PI) / 180;
        controls.maxPolarAngle = (150 * Math.PI) / 180;
        controls.update();

        // 先画出静态 VRM；动作失败时仍可见角色
        startRenderLoop();

        const motionPath = resolvePreviewMotionPath(motionFile);
        const motionBlob = await loadCachedModelSource(motionPath);
        if (disposed) {
          motionBlob.revoke();
          return;
        }
        const animLoader = new GLTFLoader();
        registerVrmAnimationLoader(animLoader);
        const motionGltf = await animLoader.loadAsync(motionBlob.url);
        motionBlob.revoke();
        const vrma = firstVrmAnimation(motionGltf);
        if (!vrma || disposed) {
          if (!vrma && !disposed) setError("动作文件无可播放的 VRMA 片段");
          return;
        }

        mixer = new THREE.AnimationMixer(getVrmScene(loaded));
        try {
          const clip = createVrmAnimationClip(vrma, loaded);
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
          action.play();
        } catch (clipErr) {
          if (!disposed) {
            setError(formatVrmLoadError(clipErr));
          }
        }
      } catch (e) {
        if (!disposed) {
          setError(formatVrmLoadError(e));
        }
      }
    })();

    return () => {
      disposed = true;
      ro.disconnect();
      if (animationId != null) cancelAnimationFrame(animationId);
      controls?.dispose();
      revokeModel?.();
      mixer?.stopAllAction();
      if (vrm) VRMUtils.deepDispose(vrm.scene);
      renderer.dispose();
    };
  }, [modelPath, motionFile, width, height]);

  return (
    <div className="relative" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        className={className ?? "motion-preview-canvas"}
        width={width}
        height={height}
        style={{ width, height }}
      />
      {error ? (
        <p className="absolute inset-x-2 bottom-2 rounded bg-destructive/90 px-2 py-1 text-[10px] text-destructive-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
