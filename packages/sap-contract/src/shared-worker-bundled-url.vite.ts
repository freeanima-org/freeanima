/** Vite 构建时解析为 SharedWorker 产物 URL（随 shell base 落在 /web/assets/… 等路径） */
// @ts-expect-error Vite 在 shell 构建时解析 ?sharedworker&url
// oxlint-disable-next-line import/default -- Vite ?sharedworker&url 在 shell 构建时解析
import sapSharedWorkerUrl from "./shared-worker-entry.ts?sharedworker&url";

export default sapSharedWorkerUrl as string;
