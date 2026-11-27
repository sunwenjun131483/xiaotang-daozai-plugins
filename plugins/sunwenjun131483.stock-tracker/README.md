# 自选股盯盘

在状态页查看自选股的现价、涨跌额与幅度，并按成本价和持股数量计算浮动盈亏；岛上常驻条跟随显示第一只股票。

## 启用

安装后在「设置 → 插件 → 已安装」启用。状态页归属插件，还需在「页面管理 / 岛上显示」里把对应状态页开启，插件和所属页面都开启后才会定时刷新。停用或卸载后插件不再取数。个别来源掉线时，本地保留上一次成功报价，并在卡片上标注「上次报价」及行情时间，常驻条同步按旧价淡化显示；全部来源离线时，宿主不会展示插件的缓存画面。

## 来源与范围

- 行情数据源：腾讯行情 `https://qt.gtimg.cn/utf8/q={股票代码}`，每只股票一路请求，最多盯盘 3 只
- 支持 A 股代码前缀：`sh`、`sz`、`bj`，如 `sh600519`、`sz000001`、`bj430047`
- 权限：`source.read: https`，仅只读请求白名单域名，不读取本机文件，不收集或上传个人信息
- 自动刷新与手动刷新最小间隔均为 60 秒；涨跌额或幅度缺失时按现价与昨收推算
- 个别股票取数失败时沿用本地上次报价，卡片标注「上次报价」及行情时间，常驻条按旧价淡化；全部来源离线时由宿主决定是否展示
- 行情字段：名称、现价、昨收、涨跌额、涨跌幅度、最高、最低；盈亏按 `(现价 − 成本价) × 股数` 计算

## 设置项

| 设置 | 说明 | 默认 |
| --- | --- | --- |
| 股票代码 1 / 2 / 3 | 带市场前缀的代码；留空则不盯 | 占位提示 |
| 成本价 1 / 2 / 3 | 买入成本价，`0` 表示不计算盈亏 | 0 |
| 持股数量 1 / 2 / 3 | 持股股数，`0` 表示不计算盈亏 | 0 |
| 涨跌颜色 | 红涨绿跌 / 绿涨红跌 | 红涨绿跌 |
| 显示浮动盈亏 | 是否在卡片上显示按成本计算的盈亏 | 开启 |

## 本地校验

```powershell
& daozai.exe --plugin-test ./plugin.json
& daozai.exe --plugin-test ./plugin.json --input ./fixtures/mock.json
& daozai.exe --plugin-test ./plugin.json --input ./fixtures/profit-off.json
& daozai.exe --plugin-test ./plugin.json --input ./fixtures/empty-change.json
& daozai.exe --plugin-test ./plugin.json --input ./fixtures/cached.json
& daozai.exe --plugin-test ./plugin.json --input ./fixtures/offline.json
```

返回码 `0` 表示通过。

## 许可

MIT License，Copyright (c) 2026 Sun。行情数据版权归腾讯行情所有，本插件只做展示与计算。
