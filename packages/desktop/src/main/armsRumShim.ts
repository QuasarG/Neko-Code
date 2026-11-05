/**
 * ARMS RUM 已整体停用后的惰性垫片。
 *
 * 主进程不再初始化 SDK，但多处诊断代码仍保留 ARMS 调用点。真实 SDK 未初始化时
 * `setConfig` 会同步抛 `Config not initialized`，足以打断 app ready 启动链；
 * 这里用 no-op 实现替换默认导出，保留调用点与参数形状，不产生任何出网行为。
 */

type ArmsRumModule = typeof import("@arms/rum-electron").default;

const noop = (..._args: unknown[]): undefined => undefined;

const armsRumShim = {
  getConfig: () => ({ env: "local" }) as ReturnType<ArmsRumModule["getConfig"]>,
  sendCustom: noop as ArmsRumModule["sendCustom"],
  sendEvent: noop as ArmsRumModule["sendEvent"],
  setConfig: noop as ArmsRumModule["setConfig"],
};

export default armsRumShim as ArmsRumModule;
