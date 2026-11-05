# Nekode 数据根隔离

## 1. 背景与边界

官方 ZCode 使用 `~/.zcode` 保存其配置、会话与记忆；Nekode fork 使用 `~/.nekode` 保存自己的数据。两者必须物理隔离：

- Nekode 进程不得读取或写入 `~/.zcode` 下的任何文件。
- `~/.zcode` 的内容由官方 ZCode 管理，Nekode 不迁移、不覆盖、不双读。
- `~/.neko_mem` 是过渡期手工账本，不属于运行时数据根；Nekode 稳定后单独清理，本设计不依赖它。

现状是“大部分路径已经落在 `~/.nekode`，但若干环境变量仍可把根指回 `~/.zcode`”。本设计只修这个缺口，不改变现有产品语义。

## 2. 现状约束

以下行为必须保持不变：

1. App 数据根仍由 `dataBaseDir` 决定：`<dataBaseDir>/.nekode`，默认 `~/.nekode`。
2. CLI 仍默认使用 `$HOME/.nekode`，不自动跟随 App 的 `dataBaseDir`；这与 `docs/desktop/configurable-data-directory.md` 的现有边界一致。
3. `NEKODE_STORAGE_DIR` 仍用于 CLI/beta 的显式存储根（例如 `~/.nekode-beta`）。
4. `NEKODE_ROOT` 仍作为 persona / Neko Memory 的兼容别名。
5. Desktop 向 Host/Agent 显式传递的数据根与 provider 配置路径不能被共享清洗器一刀切掉。

## 3. 根解析规则

新增一个 Node-only 纯函数，作为唯一解析入口：

```text
CLI root =
  NEKODE_HOME
  > NEKODE_STORAGE_DIR
  > NEKODE_ROOT
  > $HOME/.nekode

App root =
  guard($dataBaseDir/.nekode)
```

其中 `$HOME` 取 `HOME` / `USERPROFILE` / `os.homedir()`。

### 3.1 官方根守卫

```text
officialRoot = $HOME/.zcode
if candidate == officialRoot or candidate is inside officialRoot:
    return $HOME/.nekode
```

规则：

- 比较前做路径规范化；Windows 下大小写不敏感。
- 只拒绝 `~/.zcode` 及其子目录；其他自定义根继续生效。
- 守卫是最后一道防线，入口剥离是前一道防线；两者都不能省。

### 3.2 入口剥离

- Desktop 入口在读取 bootstrap 设置前删除继承的 `ZCODE_*`、`NEKODE_ROOT`、`NEKODE_STORAGE_DIR`、`NEKODE_DATA_BASE_DIR` 等外部指针；数据根由 App 自己重新计算或显式下发。
- CLI 入口删除 `ZCODE_*`；保留用户显式设置的 `NEKODE_*`，由守卫拒绝指向 `~/.zcode` 的值。
- 共享子进程清洗器不删除 host→agent 正常转发的数据根与 provider 配置路径；这些边界由调用方显式传参。

## 4. 改动范围

必须接入统一解析的路径：

- Neko Memory root 与 runtime SQLite。
- persona 文件。
- CLI 默认 session DB、日志、model-io、workflow、exec 输出、clipboard 临时目录。
- 任何从 `NEKODE_DATA_BASE_DIR` 派生 `<base>/.nekode` 的路径。

明确不改：

- `~/.nekode/v2/setting.json` 仍固定在真实 HOME，作为 bootstrap 指针。
- App 的 `dataBaseDir` 与 CLI 根仍保持现有分离，不借本次改动合并。
- 不迁移、不删除任何已有数据。

## 5. 验收

1. 默认环境：CLI 根为 `$HOME/.nekode`，App 根为 `$HOME/.nekode`。
2. `NEKODE_HOME` / `NEKODE_STORAGE_DIR` / `NEKODE_ROOT` 指向自定义目录时，对应根跟随。
3. 上述任一变量指向 `$HOME/.zcode` 或其子目录时，解析结果回退到 `$HOME/.nekode`。
4. `NEKODE_DATA_BASE_DIR=$HOME/.zcode` 时，App 数据根回退到 `$HOME/.nekode`。
5. Desktop 入口注入 `ZCODE_*` 与 `NEKODE_ROOT` 时，不产生任何 `~/.zcode` 下的读写。
6. 现有 beta 根 `~/.nekode-beta`、`dataBaseDir` 切换、host→agent 传参测试保持通过。
7. `pnpm typecheck`、`pnpm lint`、目标回归测试通过；architecture 既有基线违规单独报告，不冒充通过。
