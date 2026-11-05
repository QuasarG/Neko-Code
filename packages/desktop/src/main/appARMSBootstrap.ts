/**
 * ARMS RUM 出网已停用。
 *
 * 主进程不再初始化 SDK：不安装 Reporter 传输、不注册渲染进程注入监听、
 * 也不再依赖任何构建期 endpoint。保留一个已 resolve 的 Promise，旧调用方若仍
 * 引用它也不会被挂起或抛出异常。
 */
export const armsInitPromise: Promise<void> = Promise.resolve();
