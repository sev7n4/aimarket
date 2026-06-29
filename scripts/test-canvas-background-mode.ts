/**
 * P4.3 — canvas-background-mode 持久化单测
 *
 * 覆盖：默认值、合法值读取、非法值回退、写入、SSR（无 storage）兜底。
 *
 * pnpm exec tsx scripts/test-canvas-background-mode.ts
 */
import {
  CANVAS_BACKGROUND_STORAGE_KEY,
  DEFAULT_BACKGROUND_MODE,
  readCanvasBackgroundMode,
  writeCanvasBackgroundMode,
  type CanvasBackgroundMode,
} from "../apps/web/src/lib/canvas-background-mode.js";

const results: { name: string; pass: boolean }[] = [];
function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function makeMemoryStorage(): Storage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    get length() {
      return Object.keys(data).length;
    },
    clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
    getItem(key: string) {
      return key in data ? data[key]! : null;
    },
    key(i: number) {
      return Object.keys(data)[i] ?? null;
    },
    removeItem(key: string) {
      delete data[key];
    },
    setItem(key: string, value: string) {
      data[key] = String(value);
    },
  };
}

// 1) 默认值
ok(
  "空 storage → 默认 dots",
  readCanvasBackgroundMode(makeMemoryStorage()) === DEFAULT_BACKGROUND_MODE,
);
ok(
  "null storage (SSR) → 默认 dots",
  readCanvasBackgroundMode(null) === DEFAULT_BACKGROUND_MODE,
);

// 2) 合法值
const s = makeMemoryStorage();
s.setItem(CANVAS_BACKGROUND_STORAGE_KEY, "lines");
ok("读取合法 lines", readCanvasBackgroundMode(s) === "lines");
s.setItem(CANVAS_BACKGROUND_STORAGE_KEY, "blank");
ok("读取合法 blank", readCanvasBackgroundMode(s) === "blank");
s.setItem(CANVAS_BACKGROUND_STORAGE_KEY, "dots");
ok("读取合法 dots", readCanvasBackgroundMode(s) === "dots");

// 3) 非法值回退
s.setItem(CANVAS_BACKGROUND_STORAGE_KEY, "rainbow");
ok("非法 rainbow → 默认 dots", readCanvasBackgroundMode(s) === "dots");
s.setItem(CANVAS_BACKGROUND_STORAGE_KEY, "");
ok("空串 → 默认 dots", readCanvasBackgroundMode(s) === "dots");
s.setItem(CANVAS_BACKGROUND_STORAGE_KEY, "DOTS");
ok("大小写敏感 DOTS → 默认 dots", readCanvasBackgroundMode(s) === "dots");

// 4) 写入
const s2 = makeMemoryStorage();
const modes: CanvasBackgroundMode[] = ["dots", "lines", "blank"];
for (const m of modes) {
  writeCanvasBackgroundMode(s2, m);
  ok(`写入并读取 ${m}`, s2.getItem(CANVAS_BACKGROUND_STORAGE_KEY) === m);
  ok(`读取 ${m}`, readCanvasBackgroundMode(s2) === m);
}

// 5) null storage 写入不抛
let threw = false;
try {
  writeCanvasBackgroundMode(null, "blank");
} catch {
  threw = true;
}
ok("null storage 写入不抛", !threw);

// 6) 抛错 storage（quota 满）
const throwingStorage = {
  getItem: () => null,
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};
threw = false;
try {
  writeCanvasBackgroundMode(throwingStorage, "lines");
} catch {
  threw = true;
}
ok("抛错 storage 写入被吞掉", !threw);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
