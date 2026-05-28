# 行动清单本地应用

> 负责 Agent：`9004-行动清单-master-agent`
> 首版日期：2026-05-28

这个目录是行动清单的本地可点击界面。它不直接读取滴答清单数据库，而是在 YING 工作区内维护一份可控的本地数据，方便人类手动点击，也方便 Codex/9004 通过自然语言或文件编辑维护。

GitHub 仓库：

```text
https://github.com/bladydora/bladydora-to-do
```

## 启动

macOS App 方式：

```text
双击 dist/Bladydora To Do.app
```

已安装到系统应用程序目录：

```text
/Applications/Bladydora To Do.app
```

这个方式会打开一个普通 macOS 软件窗口，没有浏览器地址栏。App 内部使用 `4175` 端口启动本地服务，数据保存在：

```text
~/Library/Application Support/Bladydora To Do/store.json
```

启动后菜单栏会出现 `✓` 快捷图标，可直接使用：

- 打开行动清单
- 快速添加任务
- 番茄计时
- 搜索

重新构建 App：

```bash
./macos/build_app.sh
```

最简单的手动方式：

```text
双击 打开行动清单.command
```

它会自动检查 `4174` 端口，如果服务还没启动，就启动本地服务，并打开浏览器。

命令行方式：

```bash
npm start
```

默认地址：

```text
http://localhost:4174
```

## 文件结构

| 路径 | 用途 |
|------|------|
| `server.mjs` | 本地 HTTP 服务和 JSON API |
| `public/index.html` | 应用入口 |
| `public/app.js` | 前端交互逻辑 |
| `public/styles.css` | 界面样式 |
| `data/store.json` | 本地待办数据库 |

## 当前功能

- 清单视图：今天、最近 7 天、收集箱、各清单、标签。
- 任务维护：新增、勾选完成、恢复未完成、修改标题、日期、优先级、四象限、负责人、来源、路由建议和备注。
- 四象限：按重要/紧急维度查看任务。
- 番茄专注：25 分钟番茄钟、正计时、绑定任务、记录专注时长。
- 搜索：按标题、备注、清单、标签、来源、负责人检索。
- macOS 菜单栏快捷入口：打开主窗口、快速添加任务、进入番茄计时和搜索。
- 自然语言维护：页面内输入简单中文指令，也可以由 Codex 直接修改 `data/store.json`。

## 自然语言示例

```text
明天添加 高优先 复核合同 到 YING
完成 确认行动清单的周期规则
把 确认行动清单的周期规则 延期到 下周一
添加 重要不紧急 每周整理行动清单
```

## 数据维护原则

- `data/store.json` 是界面可写数据库。
- `../全局待办清单.md` 仍作为人类可读的总台账，后续可以增加同步脚本。
- 不自动导入滴答清单历史数据，避免误把未确认数据写入 YING。
