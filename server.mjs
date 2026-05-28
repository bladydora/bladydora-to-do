import { createServer } from "node:http";
import { copyFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : join(__dirname, "public");
const dataPath = process.env.DATA_PATH ? resolve(process.env.DATA_PATH) : join(__dirname, "data", "store.json");
const seedDataPath = join(__dirname, "data", "store.json");
const userHome = process.env.HOME || homedir();
const globalTodoPath = process.env.GLOBAL_TODO_PATH
  ? resolve(process.env.GLOBAL_TODO_PATH)
  : join(userHome, "YING", "HUMAN", "01 结构", "OPS", "行动清单", "全局待办清单.md");
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function nowIso() {
  return new Date().toISOString();
}

function todayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function addDays(dateText, days) {
  const date = dateText ? new Date(`${dateText}T00:00:00+08:00`) : new Date();
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function makeId(prefix = "task") {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const tail = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${tail}`;
}

function makeStableKey(parts) {
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

async function readJson() {
  await ensureDataFile();
  const raw = await readFile(dataPath, "utf8");
  return migrateDb(JSON.parse(raw));
}

function migrateDb(db) {
  db.meta ||= { schemaVersion: 1, updatedAt: nowIso() };
  db.lists ||= [];
  db.tags ||= [];
  db.tasks ||= [];
  db.focusSessions ||= [];

  db.lists.forEach((list, index) => {
    if (typeof list.order !== "number") list.order = index;
    list.viewType ||= "list";
    list.folderId ||= "";
    list.listType ||= "task";
    list.smartDisplay ||= "all";
  });
  db.tags.forEach((tag, index) => {
    if (typeof tag.order !== "number") tag.order = index;
    tag.parentId ||= "";
  });
  db.tasks.forEach((task) => {
    task.detailMode ||= task.checkItems?.length ? "checklist" : "note";
    if (!Array.isArray(task.checkItems)) task.checkItems = [];
    task.priority ||= "none";
    task.syncKey ||= "";
    task.syncSource ||= "";
  });
  return db;
}

async function ensureDataFile() {
  if (existsSync(dataPath)) return;
  await mkdir(dirname(dataPath), { recursive: true });
  if (existsSync(seedDataPath) && seedDataPath !== dataPath) {
    await copyFile(seedDataPath, dataPath);
    return;
  }
  const emptyDb = {
    meta: { schemaVersion: 1, updatedAt: nowIso() },
    lists: [{ id: "inbox", title: "收集箱", color: "#64748b", archived: false }],
    tags: [],
    tasks: [],
    focusSessions: []
  };
  await writeFile(dataPath, `${JSON.stringify(emptyDb, null, 2)}\n`, "utf8");
}

async function writeJson(db) {
  db.meta.updatedAt = nowIso();
  await mkdir(dirname(dataPath), { recursive: true });
  await writeFile(dataPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  return db;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function parseDate(text) {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.includes("今天")) return todayDate();
  if (trimmed.includes("明天")) return addDays(todayDate(), 1);
  if (trimmed.includes("后天")) return addDays(todayDate(), 2);

  const nextWeekday = trimmed.match(/下周([一二三四五六日天])/);
  if (nextWeekday) {
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
    const target = map[nextWeekday[1]];
    const base = new Date(`${todayDate()}T00:00:00+08:00`);
    const current = base.getDay();
    const diff = 7 + ((target - current + 7) % 7 || 7);
    return addDays(todayDate(), diff);
  }

  const iso = trimmed.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const cn = trimmed.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  if (cn) {
    const year = todayDate().slice(0, 4);
    return `${year}-${cn[1].padStart(2, "0")}-${cn[2].padStart(2, "0")}`;
  }

  return "";
}

function parsePriority(text) {
  if (/紧急|最高|高优先/.test(text)) return "high";
  if (/低优先|不急|低/.test(text)) return "low";
  if (/中优先|中等|普通/.test(text)) return "medium";
  return "";
}

function parseQuadrant(text) {
  if (/重要且紧急|第一象限|Q1|q1/.test(text)) return "q1";
  if (/重要不紧急|第二象限|Q2|q2/.test(text)) return "q2";
  if (/不重要但紧急|第三象限|Q3|q3/.test(text)) return "q3";
  if (/不重要不紧急|第四象限|Q4|q4/.test(text)) return "q4";
  return "";
}

function parseTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  if (/^\|\s*-+/.test(trimmed)) return null;
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim().replace(/`/g, ""));
}

function priorityFromGlobalTodo(text) {
  if (/高/.test(text)) return "high";
  if (/低/.test(text)) return "low";
  if (/中/.test(text)) return "medium";
  return "none";
}

function dueFromGlobalTodo(text) {
  if (!text || /待定|尽快|无|--/.test(text)) return "";
  return parseDate(text);
}

function listIdFromGlobalTodo(db, row) {
  const haystack = `${row.title} ${row.domain} ${row.owner} ${row.route}`.toUpperCase();
  const matched = db.lists.find((list) => haystack.includes(list.title.toUpperCase()) || haystack.includes(list.id.toUpperCase()));
  if (matched) return matched.id;
  if (/系统\/行动清单|9004|SIMATRIX/.test(`${row.domain} ${row.owner}`)) return db.lists.find((list) => list.id === "simatrix")?.id || "inbox";
  if (/会话注册巡检|YING|DISPATCHER/i.test(`${row.domain} ${row.source}`)) return db.lists.find((list) => list.id === "ying")?.id || "inbox";
  return "inbox";
}

function taskFromGlobalTodo(db, row) {
  const rawTitle = row.title.replace(/^【[^】]+】\s*/, "").trim();
  const [shortTitle, ...detailParts] = rawTitle.split("：");
  const title = shortTitle.trim() || rawTitle;
  const titleDetail = detailParts.join("：").trim();
  const syncKey = `global-md:${makeStableKey([title, row.domain, row.source, row.owner])}`;
  const priority = priorityFromGlobalTodo(row.priority);
  return {
    id: makeId(),
    title,
    notes: [
      titleDetail,
      row.domain ? `领域：${row.domain}` : "",
      row.route ? `路由建议：${row.route}` : "",
      rawTitle !== title ? `原始事项：${rawTitle}` : ""
    ].filter(Boolean).join("\n"),
    listId: listIdFromGlobalTodo(db, row),
    status: "open",
    priority,
    quadrant: priority === "high" ? "q1" : "q2",
    dueDate: dueFromGlobalTodo(row.due),
    reminderAt: "",
    repeat: "",
    tags: [],
    detailMode: "note",
    checkItems: [],
    source: row.source || "全局待办清单",
    owner: row.owner || "人类 + 9004-行动清单-master-agent",
    route: row.route || "9004 同步导入",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: "",
    focusMinutes: 0,
    syncSource: "global-todo-md",
    syncKey
  };
}

async function readGlobalTodoRows() {
  if (!existsSync(globalTodoPath)) {
    return { sourcePath: globalTodoPath, rows: [], error: "未找到全局待办清单文件。" };
  }

  const raw = await readFile(globalTodoPath, "utf8");
  const rows = [];
  let section = "";
  for (const line of raw.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      section = heading[1].trim();
      continue;
    }
    const cells = parseTableRow(line);
    if (!cells || ["状态", "日期", "完成日期"].includes(cells[0])) continue;
    if (section === "待办" && cells.length >= 8) {
      rows.push({
        section,
        status: cells[0],
        rawTitle: cells[1],
        title: cells[1],
        domain: cells[2],
        owner: cells[3],
        priority: cells[4],
        due: cells[5],
        source: cells[6],
        route: cells[7]
      });
    } else if (/已忽略|过期/.test(section) && cells.length >= 5) {
      rows.push({
        section,
        status: "已忽略",
        rawTitle: cells[1],
        title: cells[1],
        domain: cells[2],
        owner: "",
        priority: "",
        due: "",
        source: cells[3],
        route: cells[4]
      });
    }
  }
  return { sourcePath: globalTodoPath, rows, error: "" };
}

async function previewGlobalTodoSync(db) {
  const parsed = await readGlobalTodoRows();
  const result = {
    sourcePath: parsed.sourcePath,
    error: parsed.error,
    candidates: [],
    duplicates: [],
    skipped: []
  };
  const existingKeys = new Set(db.tasks.map((task) => task.syncKey).filter(Boolean));
  const existingTitles = new Set(db.tasks.map((task) => `${task.title}|${task.source || ""}`));
  const seenKeys = new Set();

  parsed.rows.forEach((row) => {
    if (/已忽略|过期/.test(row.section) || row.status !== "待办") {
      result.skipped.push({ ...row, reason: "Markdown 已标记为过期/忽略" });
      return;
    }
    if (/\[stale-active-session\]/.test(row.title)) {
      result.skipped.push({ ...row, reason: "会话巡检过期项，需要人工确认后再导入" });
      return;
    }
    const task = taskFromGlobalTodo(db, row);
    if (seenKeys.has(task.syncKey)) {
      result.skipped.push({ ...row, reason: "本次同步中重复" });
      return;
    }
    seenKeys.add(task.syncKey);
    if (existingKeys.has(task.syncKey) || existingTitles.has(`${task.title}|${task.source || ""}`)) {
      result.duplicates.push({ ...row, reason: "App 中已存在" });
      return;
    }
    result.candidates.push(task);
  });

  return result;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMentionedList(db, text) {
  return db.lists.find((list) => text.includes(list.title) || text.includes(list.id));
}

function findTask(db, text) {
  const cleaned = text
    .replace(/^(完成|勾掉|做完|删除|取消|延期|推迟|改到|把|将|任务)/, "")
    .replace(/(完成|勾掉|做完|删除|取消|延期|推迟|改到|到|为|设为|设置为)/g, " ")
    .trim();
  const quoted = text.match(/[“"']([^”"']+)[”"']/)?.[1];
  const keyword = quoted || cleaned;
  return db.tasks.find((task) => keyword && task.title.includes(keyword));
}

function titleFromCreateCommand(text, db) {
  const datePattern = "(今天|明天|后天|下周[一二三四五六日天]|20\\d{2}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}\\s*月\\s*\\d{1,2}\\s*[日号]?)";
  let title = text
    .replace(new RegExp(`^${datePattern}\\s*`), "")
    .replace(/^(记一条待办|记一条|新增待办|添加待办|添加任务|新增任务|加入|添加|新增)\s*/, "")
    .replace(new RegExp(datePattern, "g"), "")
    .replace(/(高优先|中优先|低优先|紧急|不急|重要且紧急|重要不紧急|不重要但紧急|不重要不紧急|第一象限|第二象限|第三象限|第四象限)/g, "")
    .trim();

  for (const list of db.lists) {
    const listPattern = escapeRegExp(list.title);
    title = title.replace(new RegExp(`(到|在)\\s*${listPattern}\\s*(清单|列表)?`, "g"), "");
    title = title.replace(new RegExp(`${listPattern}\\s*(清单|列表)`, "g"), "");
  }

  title = title.replace(/\s+/g, " ").replace(/[，,。；;]+$/g, "").trim();
  return title || text.trim();
}

function applyNaturalLanguage(db, text) {
  const input = text.trim();
  if (!input) return { db, result: "请输入一句待办指令。" };

  if (/^(完成|勾掉|做完)/.test(input)) {
    const task = findTask(db, input);
    if (!task) return { db, result: "没有找到匹配的待办。" };
    task.status = "done";
    task.completedAt = nowIso();
    task.updatedAt = nowIso();
    return { db, result: `已完成：${task.title}`, task };
  }

  if (/^(取消|删除)/.test(input)) {
    const task = findTask(db, input);
    if (!task) return { db, result: "没有找到匹配的待办。" };
    task.status = "canceled";
    task.updatedAt = nowIso();
    return { db, result: `已取消：${task.title}`, task };
  }

  if (/延期|推迟|改到|改为/.test(input)) {
    const task = findTask(db, input);
    const dueDate = parseDate(input);
    if (!task) return { db, result: "没有找到要延期的待办。" };
    if (!dueDate) return { db, result: "我找到了待办，但没有识别出新的日期。" };
    task.dueDate = dueDate;
    task.updatedAt = nowIso();
    return { db, result: `已把「${task.title}」改到 ${dueDate}`, task };
  }

  const list = findMentionedList(db, input);
  const dueDate = parseDate(input);
  const priority = parsePriority(input) || "medium";
  const quadrant = parseQuadrant(input) || (priority === "high" ? "q1" : "q2");
  const task = {
    id: makeId(),
    title: titleFromCreateCommand(input, db),
    notes: "",
    listId: list?.id || "inbox",
    status: "open",
    priority,
    quadrant,
    dueDate,
    reminderAt: "",
    repeat: "",
    tags: [],
    detailMode: "note",
    checkItems: [],
    source: "自然语言",
    owner: "人类",
    route: "待确认",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: "",
    focusMinutes: 0
  };
  db.tasks.unshift(task);
  return { db, result: `已添加：${task.title}`, task };
}

async function handleApi(req, res, url) {
  const db = await readJson();
  const path = url.pathname;

  if (req.method === "GET" && path === "/api/state") {
    return sendJson(res, 200, db);
  }

  if (req.method === "GET" && path === "/api/sync/global-todos/preview") {
    return sendJson(res, 200, await previewGlobalTodoSync(db));
  }

  if (req.method === "POST" && path === "/api/sync/global-todos/apply") {
    const preview = await previewGlobalTodoSync(db);
    db.tasks.unshift(...preview.candidates);
    await writeJson(db);
    return sendJson(res, 200, { ...preview, imported: preview.candidates.length, db });
  }

  if (req.method === "POST" && path === "/api/tasks") {
    const body = await readBody(req);
    const task = {
      id: makeId(),
      title: body.title?.trim() || "未命名任务",
      notes: body.notes || "",
      listId: body.listId || "inbox",
      status: "open",
      priority: body.priority || "medium",
      quadrant: body.quadrant || "q2",
      dueDate: body.dueDate || "",
      reminderAt: body.reminderAt || "",
      repeat: body.repeat || "",
      tags: Array.isArray(body.tags) ? body.tags : [],
      detailMode: body.detailMode || "note",
      checkItems: Array.isArray(body.checkItems) ? body.checkItems : [],
      source: body.source || "手动",
      owner: body.owner || "人类",
      route: body.route || "待确认",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: "",
      focusMinutes: 0
    };
    db.tasks.unshift(task);
    await writeJson(db);
    return sendJson(res, 201, task);
  }

  const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === "PATCH") {
    const body = await readBody(req);
    const task = db.tasks.find((item) => item.id === taskMatch[1]);
    if (!task) return sendError(res, 404, "Task not found");
    Object.assign(task, body, { updatedAt: nowIso() });
    if (body.status === "done" && !task.completedAt) task.completedAt = nowIso();
    if (body.status === "open") task.completedAt = "";
    await writeJson(db);
    return sendJson(res, 200, task);
  }

  if (taskMatch && req.method === "DELETE") {
    const task = db.tasks.find((item) => item.id === taskMatch[1]);
    if (!task) return sendError(res, 404, "Task not found");
    task.status = "canceled";
    task.updatedAt = nowIso();
    await writeJson(db);
    return sendJson(res, 200, task);
  }

  if (req.method === "POST" && path === "/api/lists") {
    const body = await readBody(req);
    const title = body.title?.trim();
    if (!title) return sendError(res, 400, "List title is required");
    const list = {
      id: makeId("list"),
      title,
      color: body.color || "#4f7cff",
      order: db.lists.length,
      viewType: body.viewType || "list",
      folderId: body.folderId || "",
      listType: body.listType || "task",
      smartDisplay: body.smartDisplay || "all",
      archived: false
    };
    db.lists.push(list);
    await writeJson(db);
    return sendJson(res, 201, list);
  }

  const listMatch = path.match(/^\/api\/lists\/([^/]+)$/);
  if (listMatch && req.method === "PATCH") {
    const body = await readBody(req);
    const list = db.lists.find((item) => item.id === listMatch[1]);
    if (!list) return sendError(res, 404, "List not found");
    Object.assign(list, body);
    await writeJson(db);
    return sendJson(res, 200, list);
  }

  if (req.method === "POST" && path === "/api/lists/reorder") {
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids : [];
    ids.forEach((id, index) => {
      const list = db.lists.find((item) => item.id === id);
      if (list) list.order = index;
    });
    await writeJson(db);
    return sendJson(res, 200, db.lists);
  }

  if (req.method === "POST" && path === "/api/tags") {
    const body = await readBody(req);
    const title = body.title?.trim();
    if (!title) return sendError(res, 400, "Tag title is required");
    const tag = {
      id: makeId("tag"),
      title,
      color: body.color || "#4f7cff",
      parentId: body.parentId || "",
      order: db.tags.length
    };
    db.tags.push(tag);
    await writeJson(db);
    return sendJson(res, 201, tag);
  }

  const tagMatch = path.match(/^\/api\/tags\/([^/]+)$/);
  if (tagMatch && req.method === "PATCH") {
    const body = await readBody(req);
    const tag = db.tags.find((item) => item.id === tagMatch[1]);
    if (!tag) return sendError(res, 404, "Tag not found");
    Object.assign(tag, body);
    await writeJson(db);
    return sendJson(res, 200, tag);
  }

  if (req.method === "POST" && path === "/api/focus-sessions") {
    const body = await readBody(req);
    const session = {
      id: makeId("focus"),
      taskId: body.taskId || "",
      taskTitle: body.taskTitle || "",
      minutes: Number(body.minutes || 25),
      startedAt: body.startedAt || nowIso(),
      endedAt: body.endedAt || nowIso(),
      mode: body.mode || "pomodoro",
      notes: body.notes || ""
    };
    db.focusSessions.unshift(session);
    if (session.taskId) {
      const task = db.tasks.find((item) => item.id === session.taskId);
      if (task) task.focusMinutes = Number(task.focusMinutes || 0) + session.minutes;
    }
    await writeJson(db);
    return sendJson(res, 201, session);
  }

  if (req.method === "POST" && path === "/api/nl") {
    const body = await readBody(req);
    const applied = applyNaturalLanguage(db, body.text || "");
    await writeJson(applied.db);
    return sendJson(res, 200, { message: applied.result, task: applied.task || null });
  }

  return sendError(res, 404, "API route not found");
}

async function serveStatic(req, res, url) {
  const requestPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const resolved = normalize(join(publicDir, requestPath));
  if (!resolved.startsWith(publicDir)) return sendError(res, 403, "Forbidden");

  if (!existsSync(resolved)) return sendError(res, 404, "File not found");
  const data = await readFile(resolved);
  res.writeHead(200, { "content-type": mimeTypes[extname(resolved)] || "application/octet-stream" });
  res.end(data);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (error) {
    console.error(error);
    sendError(res, 500, error.message || "Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`YING action list running at http://${host}:${port}`);
});
