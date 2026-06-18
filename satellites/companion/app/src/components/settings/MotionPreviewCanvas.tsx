import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
  type VRMAnimation,
} from "@pixiv/three-vrm-animation";
import { motionManifest } from "@shared/motion-manifest.ts";
import { COMPANION_WINDOW_HEIGHT, COMPANION_WINDOW_WIDTH } from "@/lib/window-metrics.ts";
import { loadCachedModelSource } from "@/lib/model-cache.ts";
import { resolveSidecarAssetUrl } from "@/lib/sidecar-asset-url.ts";
import { applyVrmCameraFraming, computeVrmFraming } from "@/renderer/VrmCameraFraming.ts";

type Props = {
  modelPath: string;
  motionFile: string;
  width: number;
  className?: string;
};

export function MotionPreviewCanvas({ modelPath, motionFile, width, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = Math.round((width * COMPANION_WINDOW_HEIGHT) / COMPANION_WINDOW_WIDTH);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !modelPath.trim() || !motionFile.trim()) return;

    let disposed = false;
    let revokeModel: (() => void) | undefined;
    let animationId: number | null = null;
    const clock = new THREE.Clock();

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

    void (async () => {
      try {
        const modelUrl = await resolveSidecarAssetUrl(modelPath);
        const cached = await loadCachedModelSource(modelUrl);
        revokeModel = cached.revoke;
        if (disposed) return;

        const vrmLoader = new GLTFLoader();
        vrmLoader.register((parser) => new VRMLoaderPlugin(parser));
        const gltf = await vrmLoader.loadAsync(cached.url);
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
        });

        const motionUrl = await resolveSidecarAssetUrl(`${motionManifest.baseUrl}/${motionFile}`);
        const animLoader = new GLTFLoader();
        animLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));
        const motionGltf = await animLoader.loadAsync(motionUrl);
        const animations = motionGltf.userData.vrmAnimations as VRMAnimation[] | undefined;
        const vrma = animations?.[0];
        if (!vrma || disposed) return;

        mixer = new THREE.AnimationMixer(loaded.scene);
        const clip = createVRMAnimationClip(vrma, loaded);
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
        action.play();

        const tick = (): void => {
          if (disposed) return;
          animationId = requestAnimationFrame(tick);
          const delta = clock.getDelta();
          mixer?.update(delta);
          vrm?.update(delta);
          renderer.render(scene, camera);
        };
        tick();
      } catch {
        /* 预览失败时保持空白 */
      }
    })();

    return () => {
      disposed = true;
      ro.disconnect();
      if (animationId !== null) cancelAnimationFrame(animationId);
      revokeModel?.();
      mixer?.stopAllAction();
      if (vrm) VRMUtils.deepDispose(vrm.scene);
      renderer.dispose();
    };
  }, [modelPath, motionFile, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "motion-preview-canvas"}
      width={width}
      height={height}
      style={{ width, height }}
    />
  );
}
