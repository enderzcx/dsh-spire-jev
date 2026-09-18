# DSH Spire Jev

在 DeepSeek Harness 里直接玩《杀戮尖塔 2》：主模型规划，Jev 快速决策，程序校验并执行出牌。

这是 DSH 原生插件，注册真正的模型工具，不需要主模型拼 shell 命令。游戏逻辑来自独立的 [Spire Jev 核心](https://github.com/enderzcx/spire-jev)，插件只负责接入和配置。

## 安装

需要 Node.js 22+、已安装并配置模型的 DSH，以及 `pnpm`。

```sh
dsh plugin --profile web add \
  'https://github.com/enderzcx/spire-jev/archive/23fb5ddacdc7cc51e78c46fd4be80b3cf7ad586b.tar.gz' \
  'https://github.com/enderzcx/dsh-spire-jev/archive/refs/tags/v0.1.1.tar.gz'
```

安装到 headless 时，将 `web` 换成 `headless`。重启相应 DSH 配置后，告诉它“调用 spire_help 和 spire_state 检查游戏”。插件安装命令会自动加入 DSH 的插件层，不需要自己编辑工具注册文件。

首次使用仍需完成两项准备：

1. 安装 [核心项目的游戏 Mod](https://github.com/enderzcx/spire-jev#准备)，并从 Steam 启动游戏。插件不包含游戏本体。当前实测平台是 macOS arm64、游戏 v0.107.1。
2. 在 DSH 的凭据/环境中提供 `TYPESAFE_API_KEY`。插件通过 DSH 的凭据引用读取，缺失时也可使用同名环境变量。只读状态、单步规划操作不调用 Jev；连续 Jev 战斗需要这个 key。

不需要更换 DSH 当前使用的主模型。自己的 DeepSeek 配置、上下文和工具执行仍由 DSH 管理。

## 使用

可以直接对 DSH 说：

> 检查当前游戏，继续这一场战斗，打完停在奖励界面。普通出牌交给 Jev；能确定顺序时，用回合计划连续执行；抽牌或局面变化后重新规划。

| 原生工具 | 用途 |
|---|---|
| `spire_state` | 读取真实状态、动作选项和计划状态 |
| `spire_act` | 对刚读到的状态执行一个合法选项 |
| `spire_battle` | Jev 连续打当前战斗，遇接管条件返回 |
| `spire_plan` | 一次提交多卡计划，逐步核对实际结果 |
| `spire_clear_halt` | 核实不明确的动作结果后解除停止；不重放动作 |
| `spire_help` | 查看分工和安装要求 |

多卡计划是在信息确定的前缀里减少模型调用，不是盲目连点。遇到抽牌、随机变化、意图改变、选牌弹窗或预测偏离，会停止并交回规划。完整规则见 [核心回合计划说明](https://github.com/enderzcx/spire-jev/blob/main/docs/ROUND-PLAN.md)。

## 配置

插件节点名为 `spire-jev`，可在 DSH 配置里设置：

- `endpoint`：默认本机游戏接口，只接受 loopback HTTP。
- `apiKeyEnv`：默认 `TYPESAFE_API_KEY`，填写凭据引用名，不填写密钥本身。
- `runtimeDir`：可选私有日志目录。默认放在用户状态目录，不写入插件安装目录。

同一用户下的 CLI 和插件按游戏端口共享写入锁与未知动作停止标记。多个工具可以读状态，但只能有一个操作者。不要同时让多个 agent 或人类操作同一局。

## 验证范围

- 4 项插件离线测试通过：原生工具注册、调用转发、取消信号和加载时无副作用。
- 在隔离 DSH headless 配置完成真实安装，工具自动加载。
- DSH 已实际调用原生 `spire_help` / `spire_state` 读回游戏；并完成原生写入及 Jev 链路实测：药水/事件选牌写入成功；`spire_battle(max_steps=1)` 实际调用 Jev 后因低置信度返回，DSH 用 `spire_act` 执行一张无情猛攻，真实读回能量4→2、目标HP46→32。没有 bash 或第二个未授权动作。
- 核心独立验证包括多场战斗、精英、首领及多个双卡计划；整局结果以核心验证记录为准。

插件不绕过 DSH 的工具权限策略。取消信号会传给核心；动作结果不明确时核心持久停止，不自动重试。

## 开发与更新

```sh
npm ci --ignore-scripts
npm test
npm run check
```

安装命令把核心固定到已验证的 Git commit，通过公开 HTTPS 下载，不需要 GitHub 登录或 SSH key。核心作为显式顶层依赖安装，插件用精确 peer 版本连接它，兼容 pnpm 11 对嵌套 URL 依赖的保护。升级核心时更新版本、锁文件，并重新验证 DSH 工具调用。此仓库不复制游戏状态机、Jev 请求和动作执行逻辑。

卸载：

```sh
dsh plugin --profile web remove dsh-spire-jev
# 不再需要通用核心时，可另行 remove spire-jev
```

卸载插件不会删除游戏存档，也不会自动移除游戏 Mod。

MIT License。核心及其上游游戏 Mod 的授权说明分别保留在对应项目中。
