// 自选股盯盘 · 岛仔插件（api: 1 / runtime: js / owner: status）
// 数据：腾讯行情 qt.gtimg.cn，最多盯盘 3 只股票（A 股 sh / sz / bj 前缀）。
// 功能对齐桌面盯盘软件：现价、涨跌额与幅度、成本价与持股数量对应的浮动盈亏。

const ROW_H = 48;
const LIST_TOP = 10;

function num(value) {
    if (value === null || value === undefined) return NaN;
    const s = String(value).trim();
    if (s === "") return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
}

// 宿主设置项以字符串下发；关闭态可能是 "false" / "0" / "off" 等，不能只认 "off"。
function flagOn(value) {
    const s = String(value ?? "").trim().toLowerCase();
    return !["false", "0", "off", "no", "否", "关闭"].includes(s);
}

// 腾讯时间戳 yyyyMMddHHmmss 取 HH:mm；无法解析时返回空串。
function stampTime(stamp) {
    if (typeof stamp !== "string" || stamp.length < 12) return "";
    return `${stamp.slice(8, 10)}:${stamp.slice(10, 12)}`;
}

function visible(text, max) {
    return [...String(text || "").replace(/[\x00-\x1f\x7f-\x9f]/g, "").trim()].slice(0, max).join("");
}

// 解析腾讯行情一行：v_sh600519="1~贵州茅台~600519~现价~昨收~今开~…~时间~涨跌~涨跌%~最高~最低~…";
function parseQuote(source, code) {
    if (!source || source.status !== "ready" || typeof source.text !== "string") return null;
    const prefix = `v_${code}="`;
    const row = source.text
        .split(";")
        .map(line => line.trim())
        .find(line => line.startsWith(prefix) && line.endsWith('"'));
    if (!row) return null;

    const f = row.slice(prefix.length, -1).split("~");
    const name = f[1];
    const price = num(f[3]);
    const prevClose = num(f[4]);
    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isFinite(prevClose) || prevClose <= 0) {
        return null;
    }

    let change = num(f[31]);
    let percent = num(f[32]);
    if (!Number.isFinite(change)) change = price - prevClose;
    if (!Number.isFinite(percent)) percent = prevClose ? (change / prevClose) * 100 : 0;

    const high = num(f[33]);
    const low = num(f[34]);
    const stamp = f[30] || "";
    return {
        code, name, price, prevClose, change, percent,
        high: Number.isFinite(high) ? high : null,
        low: Number.isFinite(low) ? low : null,
        stamp
    };
}

const CODE_RE = /^(sh|sz|bj)\d{6}$/;

function normalizeCode(raw) {
    const code = String(raw || "").trim().toLowerCase();
    return CODE_RE.test(code) ? code : "";
}

function pickSlot(settings, storage, sources, index) {
    const code = normalizeCode(settings[`code${index}`]);
    if (!code) return null;

    const cost = num(settings[`cost${index}`]);
    const shares = num(settings[`shares${index}`]);
    const live = parseQuote(sources?.[`s${index}`], code);
    const cached = live ? null : storage?.quotes?.[code] ?? null;
    const quote = live ?? cached;
    if (!quote) return { code, missing: true };

    const costValid = Number.isFinite(cost) && cost > 0;
    const sharesValid = Number.isFinite(shares) && shares > 0;
    const profit = costValid && sharesValid ? (quote.price - cost) * shares : null;
    return {
        code,
        quote: { ...quote, stale: !live },
        cost: costValid ? cost : 0,
        shares: sharesValid ? shares : 0,
        profit
    };
}

function palette(settings) {
    if (settings.up_color === "green") {
        return { up: "#58D791", down: "#FF6B6B" };
    }
    return { up: "#FF6B6B", down: "#58D791" };
}

function sideColor(quote, colors) {
    if (quote.change > 0) return colors.up;
    if (quote.change < 0) return colors.down;
    return "$muted";
}

function sign(value) {
    return value > 0 ? "+" : "";
}

function summaryText(quote) {
    return `${sign(quote.change)}${quote.change.toFixed(2)} · ${sign(quote.percent)}${quote.percent.toFixed(2)}%`;
}

function fmtMoney(value) {
    const fixed = Math.abs(value).toFixed(2);
    const [int, dec] = fixed.split(".");
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${value < 0 ? "-" : ""}${grouped}.${dec}`;
}

function textWidth(value, size) {
    return [...String(value)].reduce((width, ch) => {
        const isWide = ch.charCodeAt(0) > 255;
        const unit = ch === "." || ch === "," ? 4 : isWide ? size : size * 0.6;
        return width + unit;
    }, 0);
}

function text(value, x, y, size, options = {}) {
    return { text: value, at: [x, y], size, ...options };
}

function buildItems(settings, storage, sources) {
    return [1, 2, 3]
        .map(index => pickSlot(settings, storage, sources, index))
        .filter(Boolean);
}

function toCanvas(items, settings) {
    const colors = palette(settings);
    const nodes = [];
    const ready = items.filter(item => !item.missing);

    if (!ready.length) {
        nodes.push(
            text("还没有可用的股票", 193, 82, 16, { align: "center", weight: 700, fill: "$text" }),
            text("在插件设置里填写股票代码，如 sh600519", 193, 106, 11, { align: "center", fill: "$muted" })
        );
        return { height: 196, nodes };
    }

    ready.forEach((item, i) => {
        const y = LIST_TOP + i * ROW_H;
        const q = item.quote;
        const color = q.stale ? "$muted" : sideColor(q, colors);
        const stamp = stampTime(q.stamp);
        const subLine = q.stale ? (stamp ? `上次报价 ${stamp}` : "上次报价") : q.code.toUpperCase();

        nodes.push({ rect: [0, y, 387, ROW_H - 5], r: 10, fill: "$card" });
        nodes.push(text(visible(q.name, 8), 12, y + 13, 12, {
            weight: 700, fill: "$text", max_width: 110
        }));
        nodes.push(text(subLine, 12, y + 28, 9, { fill: "$dim", max_width: 150 }));

        nodes.push(text(q.price.toFixed(2), 375, y + 14, 15, {
            align: "right", weight: 700, fill: color, max_width: 120
        }));
        nodes.push(text(summaryText(q), 375, y + 30, 10, {
            align: "right", fill: color, max_width: 150
        }));

        if (item.profit != null) {
            nodes.push(text(`成本 ${item.cost.toFixed(2)} · ${item.shares} 股`, 12, y + 39, 9, {
                fill: "$dim", max_width: 180
            }));
            if (flagOn(settings.show_profit)) {
                const profitColor = item.profit >= 0 ? colors.up : colors.down;
                nodes.push(text(`盈亏 ${sign(item.profit)}${fmtMoney(item.profit)}`, 375, y + 39, 9, {
                    align: "right", fill: profitColor, max_width: 170
                }));
            }
        } else {
            nodes.push(text("未填写成本价与持股数量", 12, y + 39, 9, { fill: "$muted" }));
        }
    });

    const height = Math.max(96, LIST_TOP + ready.length * ROW_H + 22);
    nodes.push(
        {
            rect: [322, height - 26, 65, 22], r: 6, fill: "$card",
            hover: { fill: "$track" }, hit: { action: "refresh" }
        },
        text("刷新", 354.5, height - 11, 10, { align: "center", fill: "$muted" })
    );
    return { height, nodes };
}

function toPinned(first, settings) {
    if (!first || first.missing || !first.quote) return null;
    const q = first.quote;
    const colors = palette(settings);
    const name = visible(q.name, 6);
    const price = q.price.toFixed(2);
    const percent = `${sign(q.percent)}${q.percent.toFixed(2)}%`;
    const color = q.stale ? "$muted" : sideColor(q, colors);

    let x = 0;
    const nameWidth = textWidth(name, 11);
    const nodes = [
        text(name, x, 15, 11, { fill: "$text", weight: 700, max_width: nameWidth })
    ];
    x += nameWidth + 8;

    const priceWidth = textWidth(price, 11.5);
    nodes.push(text(price, x, 15, 11.5, {
        fill: color, weight: 700, max_width: priceWidth
    }));
    x += priceWidth + 8;

    const percentWidth = textWidth(percent, 10);
    nodes.push(text(percent, x, 15, 10, {
        fill: color, max_width: percentWidth
    }));
    const width = x + percentWidth + 4;

    return { canvas: { width, nodes, fit_width: true } };
}

function refresh(input) {
    const settings = input.settings || {};
    const sources = input.sources || {};
    const storage = input.storage || {};

    const items = buildItems(settings, storage, sources);
    // 先沿用旧缓存：本轮离线或缺失的股票保留上次报价，有新报价再覆盖。
    const quotes = { ...(storage.quotes || {}) };
    for (const item of items) {
        if (item.quote) {
            const { stale, ...saved } = item.quote;
            quotes[item.code] = saved;
        }
    }

    const readyCount = items.filter(item => item.quote).length;
    const status = readyCount
        ? { state: "succeeded", label: "自选股盯盘", summary: `${readyCount} 只行情` }
        : { state: "offline", label: "行情暂不可用" };

    return {
        status,
        canvas: toCanvas(items, settings),
        pinned: toPinned(items[0], settings),
        storage: { quotes }
    };
}

function action(input) {
    return refresh(input);
}
