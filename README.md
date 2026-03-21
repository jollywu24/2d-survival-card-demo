# 2D 荒野求生卡牌 Demo

## 技术栈

- React
- TypeScript
- Vite
- Zustand
- Canvas 2D

## 项目结构

```text
src/
  components/
    CardCanvas.tsx      # Canvas 绘制卡牌
  data/
    cards.ts            # 10 张基础卡牌定义
    events.ts           # 随机事件与分支选项
  store/
    gameStore.ts        # Zustand 游戏状态与核心逻辑
  types/
    game.ts             # 核心类型定义
  App.tsx               # 主界面
  main.tsx              # 入口
  styles.css            # 样式
.tools/
  node-v20.19.2-win-x64 # 本地 Node.js 运行时
run-dev.cmd             # 本地开发启动脚本
run-build.cmd           # 生产构建脚本
run-preview.cmd         # 预览构建结果脚本
```

## 核心系统

### 玩家状态

- `health`
- `hunger`
- `thirst`
- `temperature`
- `sanity`
- `fatigue`

联动规则位于 `src/store/gameStore.ts`：

- 饥饿过低会降低体力和生命
- 缺水会降低生命和理智
- 体温过低会降低生命和体力
- 疲劳过低会降低理智

### 环境系统

- 天气：`sunny | rain | storm`
- 时间：`day | night`
- 地形：`beach | jungle | cave`

### 卡牌结构

```ts
interface CardDefinition {
  id: string;
  name: string;
  type: 'resource' | 'action' | 'event' | 'tool';
  description: string;
  effect: CardEffect;
  condition?: CardCondition;
}
```

### 事件结构

```ts
interface EventDefinition {
  id: string;
  title: string;
  description: string;
  condition?: CardCondition;
  options: EventOption[];
}
```

## 当前 Demo 内容

- 基础 UI 面板与卡牌展示
- Canvas 绘制卡牌
- Zustand 状态管理
- 回合推进
- 随机事件 + 分支选择
- 10 张基础卡牌

## 运行方法

这个仓库已经自带本地 Node.js 运行时，不需要你额外安装系统环境。

直接开发运行：

```bat
run-dev.cmd
```

如果想手动命令行运行：

```bat
set PATH=D:\2d-survival\.tools\node-v20.19.2-win-x64;%PATH%
D:\2d-survival\.tools\node-v20.19.2-win-x64\npm.cmd install
D:\2d-survival\.tools\node-v20.19.2-win-x64\npm.cmd run dev
```

生产构建：

```bat
run-build.cmd
```

预览构建结果：

```bat
run-preview.cmd
```

默认开发地址通常是：

- `http://127.0.0.1:5173`
- `http://localhost:5173`
