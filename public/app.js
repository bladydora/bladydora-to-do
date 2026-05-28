const app = document.querySelector("#app");

const state = {
  db: null,
  selectedView: "today",
  selectedListId: "",
  selectedTagId: "",
  selectedTaskId: "",
  searchText: "",
  nlMessage: "",
  modal: null,
  editingListId: "",
  syncPreview: null,
  syncMessage: "",
  contextMenu: null,
  priorityMenuOpen: false,
  timerMode: "pomodoro",
  timerSeconds: 25 * 60,
  timerRunning: false,
  timerStartedAt: "",
  timerId: null
};

const viewLabels = {
  today: "今天",
  next7: "最近 7 天",
  inbox: "收集箱",
  completed: "已完成",
  quadrant: "四象限",
  focus: "番茄专注",
  search: "搜索"
};

const priorities = {
  high: { label: "高优先级", short: "高", color: "#e53935", icon: "flag" },
  medium: { label: "中优先级", short: "中", color: "#ffab2e", icon: "flag" },
  low: { label: "低优先级", short: "低", color: "#4f7cff", icon: "flag" },
  none: { label: "无优先级", short: "无", color: "#a8a8a8", icon: "flag" }
};

const palette = ["#ff5e6c", "#ffab2e", "#ffcc2e", "#dfe838", "#36d66f", "#4aa0f2", "#6d6df2", "#20a8c5", "#8b5cf6"];

const viewTypes = [
  { id: "list", label: "列表", icon: "list" },
  { id: "kanban", label: "看板", icon: "board" },
  { id: "timeline", label: "时间线", icon: "timeline" }
];

const quadrants = [
  { id: "q1", roman: "I", title: "重要且紧急", color: "#ff5e6c" },
  { id: "q2", roman: "II", title: "重要不紧急", color: "#ffab2e" },
  { id: "q3", roman: "III", title: "不重要但紧急", color: "#4f7cff" },
  { id: "q4", roman: "IV", title: "不重要不紧急", color: "#20c997" }
];

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function addDays(days) {
  const date = new Date(`${today()}T00:00:00+08:00`);
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function icon(name, className = "") {
  const paths = {
    check: `<path d="M6.5 12.5l3.4 3.4 7.6-8.3"/>`,
    task: `<path d="M7 12.5l3 3 7-8"/><rect x="4" y="4" width="16" height="16" rx="5"/>`,
    calendar: `<rect x="4" y="5.5" width="16" height="15" rx="4"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/>`,
    inbox: `<path d="M5 7.5h14l-2 9h-3.5l-1.5 2h-4l-1.5-2H3l2-9z"/><path d="M8 7.5l1.5-3h5L16 7.5"/>`,
    completed: `<path d="M7 12.5l3 3 7-8"/><circle cx="12" cy="12" r="8.5"/>`,
    quadrant: `<path d="M12 3v18M3 12h18"/><rect x="4" y="4" width="16" height="16" rx="5"/>`,
    focus: `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>`,
    search: `<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l4 4"/>`,
    refresh: `<path d="M19 8a7 7 0 0 0-12.2-3.2L5 7M5 4v3h3M5 16a7 7 0 0 0 12.2 3.2L19 17M19 20v-3h-3"/>`,
    bell: `<path d="M7 10a5 5 0 0 1 10 0v4.5l1.5 2h-13l1.5-2V10z"/><path d="M10 19a2.2 2.2 0 0 0 4 0"/>`,
    help: `<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9a2.7 2.7 0 1 1 4.2 2.2c-.9.6-1.7 1.1-1.7 2.3M12 17.5h.01"/>`,
    plus: `<path d="M12 5v14M5 12h14"/>`,
    drag: `<path d="M6 8h12M6 12h12M6 16h12"/>`,
    sidebar: `<rect x="4" y="5" width="16" height="14" rx="4"/><path d="M9 5v14"/>`,
    sort: `<path d="M8 5v14M5.5 7.5L8 5l2.5 2.5M16 19V5M13.5 16.5L16 19l2.5-2.5"/>`,
    more: `<circle cx="6.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="17.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>`,
    note: `<path d="M7 6h10M7 10h10M7 14h7"/><rect x="4" y="4" width="16" height="16" rx="5"/>`,
    checklist: `<path d="M8 8.5l1.5 1.5L12 7.5M14 9h3M8 14.5l1.5 1.5L12 13.5M14 15h3"/><rect x="4" y="4" width="16" height="16" rx="5"/>`,
    close: `<path d="M7 7l10 10M17 7L7 17"/>`,
    star: `<path d="M12 4.5l2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2L4.5 10l5.2-.8L12 4.5z"/>`,
    flag: `<path d="M7 20V5.5c3-1.6 5 .9 8-1V14c-3 1.9-5-.8-8 1"/>`,
    tag: `<path d="M4.5 12l7.5-7.5h6.5V11L11 18.5 4.5 12z"/><circle cx="15.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/>`,
    list: `<path d="M8 7h10M8 12h10M8 17h10M5 7h.01M5 12h.01M5 17h.01"/>`,
    board: `<rect x="4" y="5" width="16" height="14" rx="4"/><path d="M10 5v14M15 5v14"/>`,
    timeline: `<path d="M6 6h7M6 12h12M6 18h9"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>`
  };
  return `<svg class="sf-icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.task}</svg>`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function load() {
  state.db = await api("/api/state");
  normalizeState();
  const initialView = new URLSearchParams(window.location.search).get("view");
  if (initialView) selectView(initialView, { preserveTask: true });
  render();
}

function normalizeState() {
  state.db.lists.forEach((list, index) => {
    if (typeof list.order !== "number") list.order = index;
    list.viewType ||= "list";
    list.folderId ||= "";
    list.listType ||= "task";
    list.smartDisplay ||= "all";
  });
  state.db.tags.forEach((tag, index) => {
    if (typeof tag.order !== "number") tag.order = index;
    tag.parentId ||= "";
  });
  state.db.tasks.forEach((task) => {
    task.detailMode ||= task.checkItems?.length ? "checklist" : "note";
    if (!Array.isArray(task.checkItems)) task.checkItems = [];
    task.priority ||= "none";
  });
}

function sortedLists() {
  return [...state.db.lists].filter((list) => !list.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function sortedTags() {
  return [...state.db.tags].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function openTasks() {
  return state.db.tasks.filter((task) => task.status === "open");
}

function doneTasks() {
  return state.db.tasks.filter((task) => task.status === "done");
}

function listById(id) {
  return state.db.lists.find((list) => list.id === id);
}

function selectedTask() {
  return state.db.tasks.find((task) => task.id === state.selectedTaskId);
}

function taskMatchesSearch(task, text) {
  const list = listById(task.listId)?.title || "";
  const tags = task.tags.map((id) => state.db.tags.find((tag) => tag.id === id)?.title || "").join(" ");
  return `${task.title} ${task.notes} ${list} ${tags} ${task.source} ${task.owner}`.toLowerCase().includes(text.toLowerCase());
}

function visibleTasks() {
  const tasks = state.db.tasks.filter((task) => task.status !== "canceled");
  if (state.selectedView === "today") {
    const day = today();
    return tasks.filter((task) => task.status === "open" && (!task.dueDate || task.dueDate <= day));
  }
  if (state.selectedView === "next7") {
    const end = addDays(7);
    return tasks.filter((task) => task.status === "open" && task.dueDate && task.dueDate <= end);
  }
  if (state.selectedView === "inbox") return tasks.filter((task) => task.listId === "inbox");
  if (state.selectedView === "completed") return tasks.filter((task) => task.status === "done");
  if (state.selectedView === "list") return tasks.filter((task) => task.listId === state.selectedListId);
  if (state.selectedView === "tag") return tasks.filter((task) => task.tags.includes(state.selectedTagId));
  if (state.selectedView === "search") return tasks.filter((task) => taskMatchesSearch(task, state.searchText));
  return tasks;
}

function viewTitle() {
  if (state.selectedView === "list") return listById(state.selectedListId)?.title || "清单";
  if (state.selectedView === "tag") return state.db.tags.find((tag) => tag.id === state.selectedTagId)?.title || "标签";
  return viewLabels[state.selectedView] || "行动清单";
}

function formatDue(dueDate) {
  if (!dueDate) return "";
  const current = today();
  if (dueDate === current) return "今天";
  if (dueDate === addDays(1)) return "明天";
  return dueDate.slice(5).replace("-", "月") + "日";
}

function formatDateTimeLocal(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dueClass(task) {
  if (!task.dueDate || task.status !== "open") return "";
  if (task.dueDate < today()) return "overdue";
  if (task.dueDate <= addDays(7)) return "soon";
  return "";
}

function render() {
  app.className = `app-shell mode-${state.selectedView}`;
  app.innerHTML = `
    ${renderRail()}
    ${renderSide()}
    ${renderMain()}
    ${renderDetail()}
    ${renderModal()}
    ${renderContextMenu()}
  `;
  bindEvents();
}

function renderRail() {
  const items = [
    ["today", "task", "任务"],
    ["next7", "calendar", "日历"],
    ["quadrant", "quadrant", "四象限"],
    ["focus", "focus", "专注"],
    ["search", "search", "搜索"]
  ];
  return `
    <aside class="rail">
      <div class="avatar">Y</div>
      ${items.map(([view, iconName, label]) => `
        <button class="rail-button ${state.selectedView === view ? "active" : ""}" data-view="${view}" title="${label}">${icon(iconName)}</button>
      `).join("")}
      <div class="rail-spacer"></div>
      <button class="rail-button" data-refresh title="刷新">${icon("refresh")}</button>
      <button class="rail-button" title="通知">${icon("bell")}</button>
      <button class="rail-button" title="帮助">${icon("help")}</button>
    </aside>
  `;
}

function renderSide() {
  const todayCount = openTasks().filter((task) => !task.dueDate || task.dueDate <= today()).length;
  const next7Count = openTasks().filter((task) => task.dueDate && task.dueDate <= addDays(7)).length;
  const inboxCount = state.db.tasks.filter((task) => task.status === "open" && task.listId === "inbox").length;
  const completedCount = doneTasks().length;
  return `
    <aside class="side">
      <button class="nav-row" data-view="today"><span>${icon("task")}</span><span>今天</span><span class="count">${todayCount}</span></button>
      <button class="nav-row" data-view="next7"><span>${icon("calendar")}</span><span>最近 7 天</span><span class="count">${next7Count}</span></button>
      <button class="nav-row" data-view="inbox"><span>${icon("inbox")}</span><span>收集箱</span><span class="count">${inboxCount}</span></button>
      <button class="nav-row" data-view="completed"><span>${icon("completed")}</span><span>已完成</span><span class="count">${completedCount}</span></button>
      <button class="sync-entry" data-sync-global title="从 Markdown 全局待办清单同步">
        <span>${icon("refresh")}</span>
        <span>同步全局待办</span>
      </button>

      <div class="section-title"><span>清单</span><button class="mini-add" data-add-list title="添加清单">${icon("plus")}</button></div>
      ${sortedLists().map((list) => {
        const count = state.db.tasks.filter((task) => task.status === "open" && task.listId === list.id).length;
        return `
          <div class="list-row ${state.selectedView === "list" && state.selectedListId === list.id ? "active" : ""}" data-list-row="${list.id}" draggable="true">
            <button class="drag-handle" data-drag-handle title="拖拽排序">${icon("drag")}</button>
            <button class="row-label" data-list="${list.id}">
            <span>${escapeHtml(list.title)}</span>
            </button>
            <span class="dot" style="background:${list.color}"></span>
            <span class="count">${count}</span>
          </div>
        `;
      }).join("")}

      <div class="section-title"><span>标签</span><button class="mini-add" data-add-tag title="添加标签">${icon("plus")}</button></div>
      ${sortedTags().map((tag) => `
        <button class="tag-row ${state.selectedView === "tag" && state.selectedTagId === tag.id ? "active" : ""}" data-tag="${tag.id}">
          <span class="tag-icon" style="color:${tag.color}">${icon("tag")}</span>
          <span>${escapeHtml(tag.title)}</span>
          <span class="dot" style="background:${tag.color}"></span>
        </button>
      `).join("")}
    </aside>
  `;
}

function renderMain() {
  if (state.selectedView === "quadrant") return renderQuadrantView();
  if (state.selectedView === "focus") return renderFocusView();
  if (state.selectedView === "search") return renderSearchView();

  const open = visibleTasks().filter((task) => task.status === "open");
  const done = visibleTasks().filter((task) => task.status === "done");
  const completedOnly = state.selectedView === "completed";
  return `
    <main class="main">
      <header class="main-header">
        <button class="icon-button" title="侧边栏">${icon("sidebar")}</button>
        <h1 class="main-title">${escapeHtml(viewTitle())}</h1>
        <button class="icon-button" data-sort title="排序">${icon("sort")}</button>
        <button class="icon-button" title="更多">${icon("more")}</button>
      </header>
      <form class="add-form" data-add-task>
        <input class="quick-input" name="title" placeholder="+ 添加任务" autocomplete="off" />
        <input class="field" name="dueDate" type="date" />
        <button class="primary-button">添加</button>
      </form>
      <form class="nl-bar" data-nl-form>
        <input class="quick-input" name="nl" placeholder="自然语言维护，例如：明天添加 高优先 复核合同 到 YING" autocomplete="off" />
        <button class="secondary-button">执行</button>
      </form>
      <div class="nl-result">${escapeHtml(state.nlMessage)}</div>
      <section class="content">
        ${completedOnly ? renderTaskGroup("已完成", done) : renderTaskGroup("待办", open)}
        ${!completedOnly && done.length ? renderTaskGroup("已完成", done) : ""}
      </section>
    </main>
  `;
}

function renderTaskGroup(title, tasks) {
  if (!tasks.length) {
    return `<div class="empty-note">没有任务</div>`;
  }
  return `
    <div class="task-group-title"><span>${title}</span><span class="count">${tasks.length}</span></div>
    ${tasks.map(renderTaskRow).join("")}
  `;
}

function renderTaskRow(task) {
  const list = listById(task.listId);
  const priority = priorities[task.priority] || priorities.none;
  const modeIcon = task.detailMode === "checklist" ? icon("checklist", "tiny-icon") : "";
  return `
    <div class="task-row ${state.selectedTaskId === task.id ? "selected" : ""}" data-task="${task.id}">
      <button class="check ${task.status === "done" ? "done" : ""}" data-toggle="${task.id}" title="完成">${task.status === "done" ? icon("completed", "checkmark-icon") : ""}</button>
      <button class="task-title ${task.status === "done" ? "done-text" : ""}" data-select-task="${task.id}">${modeIcon ? `<span class="task-mode-icon">${modeIcon}</span>` : ""}${escapeHtml(task.title)}</button>
      <div class="task-meta">
        <span class="priority-flag" style="color:${priority.color}" title="${priority.label}">${icon(priority.icon, "tiny-icon")}</span>
        ${list ? `<span>${escapeHtml(list.title)}</span>` : ""}
        ${task.dueDate ? `<span class="due ${dueClass(task)}">${formatDue(task.dueDate)}</span>` : ""}
      </div>
    </div>
  `;
}

function renderDetail() {
  const task = selectedTask();
  if (!task) {
    return `
      <aside class="detail">
        <div class="detail-empty">
          <div>
            <div class="empty-illustration">${icon("star")}</div>
            <div>选择一条任务查看详情</div>
          </div>
        </div>
      </aside>
    `;
  }

  const priority = priorities[task.priority] || priorities.none;
  return `
    <aside class="detail">
      <header class="detail-header">
        <div class="detail-tools-left">
          <button class="mode-button ${task.detailMode === "note" ? "active" : ""}" data-detail-mode="note" title="纯文字模式">${icon("note")}</button>
          <span class="tool-divider"></span>
          <button class="mode-button ${task.detailMode === "checklist" ? "active" : ""}" data-detail-mode="checklist" title="清单打勾模式">${icon("checklist")}</button>
          <input class="date-chip detail-date-input" type="date" data-field="dueDate" value="${escapeHtml(task.dueDate)}" title="设置日期" />
        </div>
        <div class="detail-tools-right">
          <button class="priority-button" data-priority-menu title="优先级" style="color:${priority.color}">${icon(priority.icon)}</button>
          ${state.priorityMenuOpen ? renderPriorityMenu(task) : ""}
          <button class="icon-button" data-close-detail title="关闭">${icon("close")}</button>
        </div>
      </header>
      <section class="detail-body">
        <textarea class="title-input detail-title-input" data-field="title" rows="2">${escapeHtml(task.title)}</textarea>
        ${task.detailMode === "checklist" ? renderChecklistDetail(task) : renderNoteDetail(task)}
      </section>
      <footer class="detail-footer">
        <select class="footer-select" data-field="listId">
          ${sortedLists().map((list) => `<option value="${list.id}" ${task.listId === list.id ? "selected" : ""}>${escapeHtml(list.title)}</option>`).join("")}
        </select>
        <button class="footer-button" data-detail-more title="更多">${icon("more")}</button>
      </footer>
    </aside>
  `;
}

function renderPriorityMenu(task) {
  return `
    <div class="floating-menu priority-menu">
      ${Object.entries(priorities).map(([id, item]) => `
        <button class="menu-row ${task.priority === id ? "selected" : ""}" data-set-priority="${id}">
          <span style="color:${item.color}">${icon(item.icon, "tiny-icon")}</span>
          <span>${item.label}</span>
          <span>${task.priority === id ? icon("check", "tiny-icon") : ""}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderNoteDetail(task) {
  return `
    <textarea class="note-editor" data-field="notes" placeholder="描述">${escapeHtml(task.notes || "")}</textarea>
    <div class="field-grid compact">
      <label>四象限</label>
      <select class="field" data-field="quadrant">
        ${quadrants.map((item) => `<option value="${item.id}" ${task.quadrant === item.id ? "selected" : ""}>${item.roman} ${item.title}</option>`).join("")}
      </select>
    </div>
    <div class="field-grid compact">
      <label>负责人</label>
      <input class="field" data-field="owner" value="${escapeHtml(task.owner || "")}" />
    </div>
  `;
}

function renderChecklistDetail(task) {
  return `
    <div class="description-label">描述</div>
    <div class="checklist-editor">
      ${task.checkItems.map((item, index) => `
        <div class="check-item-row">
          <button class="check ${item.done ? "done" : ""}" data-toggle-check-item="${index}">${item.done ? icon("completed", "checkmark-icon") : ""}</button>
          <input class="check-item-input ${item.done ? "done-text" : ""}" data-check-item-title="${index}" value="${escapeHtml(item.title)}" />
          <button class="mini-remove" data-remove-check-item="${index}" title="删除">${icon("close")}</button>
        </div>
      `).join("")}
      <form class="check-item-row add-check-item" data-add-check-item>
        <span class="check"></span>
        <input class="check-item-input" name="title" placeholder="换行即可添加检查事项" autocomplete="off" />
      </form>
    </div>
  `;
}

function renderQuadrantView() {
  return `
    <main class="main">
      <header class="main-header">
        <h1 class="main-title">四象限</h1>
        <button class="icon-button" data-view="today" title="返回任务">${icon("task")}</button>
      </header>
      <section class="content">
        <div class="quadrant-grid">
          ${quadrants.map((quad) => {
            const tasks = openTasks().filter((task) => task.quadrant === quad.id);
            return `
              <div class="quadrant">
                <h2 style="color:${quad.color}"><span class="roman" style="background:${quad.color}">${quad.roman}</span>${quad.title}</h2>
                ${tasks.length ? tasks.map((task) => `
                  <div class="card-task" data-task="${task.id}">
                    <button class="check" data-toggle="${task.id}"></button>
                    <button class="task-title" data-select-task="${task.id}">${escapeHtml(task.title)}</button>
                  </div>
                `).join("") : `<div class="empty-note">没有任务</div>`}
              </div>
            `;
          }).join("")}
        </div>
      </section>
    </main>
  `;
}

function renderFocusView() {
  const sessions = state.db.focusSessions;
  const totalMinutes = sessions.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const todaySessions = sessions.filter((item) => item.endedAt?.slice(0, 10) === today());
  const todayMinutes = todaySessions.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const task = selectedTask();
  return `
    <main class="main">
      <header class="main-header">
        <h1 class="main-title">番茄专注</h1>
        <button class="icon-button" title="添加专注记录" data-add-focus-session>${icon("plus")}</button>
      </header>
      <section class="content">
        <div class="focus-view">
          <div class="timer-panel">
            <div class="mode-toggle">
              <button class="${state.timerMode === "pomodoro" ? "active" : ""}" data-mode="pomodoro">番茄计时</button>
              <button class="${state.timerMode === "stopwatch" ? "active" : ""}" data-mode="stopwatch">正计时</button>
            </div>
            <select class="field" style="max-width:360px" data-focus-task>
              <option value="">不绑定任务</option>
              ${openTasks().map((item) => `<option value="${item.id}" ${state.selectedTaskId === item.id ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
            </select>
            <div class="timer-circle">${formatSeconds(state.timerSeconds)}</div>
            <div style="color:#888;min-height:22px;">${task ? escapeHtml(task.title) : "专注"}</div>
            <div class="focus-actions">
              <button class="primary-button" data-start-focus>${state.timerRunning ? "暂停" : "开始"}</button>
              <button class="secondary-button" data-reset-focus>重置</button>
            </div>
          </div>
          <div class="stats-panel">
            <h2>概览</h2>
            <div class="stats-grid">
              <div class="stat-card"><span>今日番茄</span><strong>${todaySessions.length}</strong></div>
              <div class="stat-card"><span>今日专注时长</span><strong>${todayMinutes}</strong> m</div>
              <div class="stat-card"><span>总番茄</span><strong>${sessions.length}</strong></div>
              <div class="stat-card"><span>总专注时长</span><strong>${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} m</strong></div>
            </div>
            <h2>专注记录</h2>
            ${sessions.slice(0, 12).map((item) => `
              <div class="session-row">
                <div><span>${new Date(item.endedAt).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span><br><strong>${escapeHtml(item.taskTitle || "专注")}</strong></div>
                <span>${item.minutes}m</span>
              </div>
            `).join("") || `<div class="empty-note" style="min-height:160px;">没有记录</div>`}
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderSearchView() {
  const tasks = state.searchText ? visibleTasks() : [];
  return `
    <main class="main">
      <header class="main-header">
        <h1 class="main-title">搜索</h1>
      </header>
      <section class="content">
        <div class="search-view">
          <input class="search-input" data-search-input value="${escapeHtml(state.searchText)}" placeholder="搜索任务、标签、清单和来源" autofocus />
          <div style="margin-top:30px;">
            ${state.searchText ? renderTaskGroup("搜索结果", tasks) : `<div class="empty-note" style="min-height:360px;">搜索任务、标签、清单和过滤器</div>`}
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderModal() {
  if (!state.modal) return "";
  if (state.modal === "list") return renderListModal();
  if (state.modal === "tag") return renderTagModal();
  if (state.modal === "focusRecord") return renderFocusRecordModal();
  if (state.modal === "syncGlobal") return renderSyncGlobalModal();
  return "";
}

function renderSyncGlobalModal() {
  const preview = state.syncPreview;
  const candidates = preview?.candidates || [];
  const duplicates = preview?.duplicates || [];
  const skipped = preview?.skipped || [];
  return `
    <div class="modal-backdrop" data-close-modal>
      <section class="settings-modal sync-modal" data-modal-panel>
        <button class="modal-close-dot" data-close-modal title="关闭"></button>
        <div class="modal-form full">
          <h2>同步全局待办</h2>
          <p class="sync-copy">由 9004 从 Markdown 台账读取待办，先过滤过期项和重复项，再导入 App。</p>
          ${preview?.error ? `<div class="sync-error">${escapeHtml(preview.error)}</div>` : ""}
          ${preview ? `
            <div class="sync-summary">
              <div><span>可导入</span><strong>${candidates.length}</strong></div>
              <div><span>已存在</span><strong>${duplicates.length}</strong></div>
              <div><span>已忽略</span><strong>${skipped.length}</strong></div>
            </div>
            <div class="sync-source">${escapeHtml(preview.sourcePath || "")}</div>
            <div class="sync-list">
              ${candidates.length ? `<h3>准备导入</h3>${candidates.map((task) => renderSyncRow(task, "candidate")).join("")}` : `<div class="empty-note small-empty">没有新的可导入待办</div>`}
              ${duplicates.length ? `<h3>已存在</h3>${duplicates.map((row) => renderSyncRow(row, "duplicate")).join("")}` : ""}
              ${skipped.length ? `<h3>已忽略/过期</h3>${skipped.map((row) => renderSyncRow(row, "skipped")).join("")}` : ""}
            </div>
          ` : `<div class="empty-note small-empty">正在读取全局待办清单...</div>`}
          <div class="sync-message">${escapeHtml(state.syncMessage)}</div>
          <div class="modal-actions">
            <button class="modal-cancel" data-close-modal>取消</button>
            <button class="modal-save" data-apply-global-sync ${candidates.length ? "" : "disabled"}>导入 ${candidates.length}</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderSyncRow(item, type) {
  const title = item.title || item.rawTitle || "";
  const meta = [item.source, item.owner, item.reason].filter(Boolean).join(" · ");
  return `
    <div class="sync-row ${type}">
      <span class="sync-status-dot"></span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(meta)}</small>
      </div>
    </div>
  `;
}

function renderFocusRecordModal() {
  const end = new Date();
  const start = new Date(end.getTime() - 25 * 60 * 1000);
  return `
    <div class="modal-backdrop" data-close-modal>
      <section class="settings-modal focus-record-modal" data-modal-panel>
        <button class="modal-close-dot" data-close-modal title="关闭"></button>
        <div class="modal-form full">
          <h2>添加专注记录</h2>
          <label class="modal-grid-row">
            <span>专注任务</span>
            <select class="modal-select" data-focus-record-task>
              <option value="">不绑定任务</option>
              ${openTasks().map((task) => `<option value="${task.id}" ${state.selectedTaskId === task.id ? "selected" : ""}>${escapeHtml(task.title)}</option>`).join("")}
            </select>
          </label>
          <label class="modal-grid-row">
            <span>开始时间</span>
            <input class="modal-select" type="datetime-local" data-focus-record-start value="${formatDateTimeLocal(start)}" />
          </label>
          <label class="modal-grid-row">
            <span>结束时间</span>
            <input class="modal-select" type="datetime-local" data-focus-record-end value="${formatDateTimeLocal(end)}" />
          </label>
          <label class="modal-grid-row">
            <span>类型</span>
            <select class="modal-select" data-focus-record-mode>
              <option value="pomodoro">番茄计时</option>
              <option value="stopwatch">正计时</option>
            </select>
          </label>
          <label class="modal-grid-row notes-row">
            <span>专注笔记</span>
            <textarea class="modal-textarea" data-focus-record-notes placeholder="记录你的想法..."></textarea>
          </label>
          <div class="modal-actions">
            <button class="modal-cancel" data-close-modal>取消</button>
            <button class="modal-save" data-save-focus-record>保存</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderContextMenu() {
  if (!state.contextMenu) return "";
  return `
    <div class="context-menu" style="left:${state.contextMenu.x}px;top:${state.contextMenu.y}px;" data-context-menu>
      <button data-edit-list="${state.contextMenu.listId}">编辑</button>
      <button disabled>置顶</button>
      <button disabled>分享</button>
      <button disabled>复制</button>
      <button disabled>归档</button>
      <button disabled>删除</button>
    </div>
  `;
}

function renderListModal() {
  const editingList = state.editingListId ? listById(state.editingListId) : null;
  const selectedColor = state.modalColor || editingList?.color || palette[0];
  const selectedViewType = state.modalViewType || editingList?.viewType || "list";
  return `
    <div class="modal-backdrop" data-close-modal>
      <section class="settings-modal wide" data-modal-panel>
        <button class="modal-close-dot" data-close-modal title="关闭"></button>
        <div class="modal-form">
          <h2>${editingList ? "编辑清单" : "添加清单"}</h2>
          <label class="modal-name-field">
            <span>${icon("drag")}</span>
            <input name="title" data-modal-title placeholder="名称" value="${escapeHtml(editingList?.title || "")}" autofocus />
          </label>
          <div class="modal-grid-row">
            <label>清单颜色</label>
            <div class="color-row">
              ${palette.map((color) => `<button class="color-swatch ${selectedColor === color ? "active" : ""}" data-modal-color="${color}" style="background:${color}"></button>`).join("")}
            </div>
          </div>
          <div class="modal-grid-row">
            <label>视图类型</label>
            <div class="view-type-row">
              ${viewTypes.map((item) => `<button class="view-type ${selectedViewType === item.id ? "active" : ""}" data-modal-view-type="${item.id}"><span>${icon(item.icon)}</span></button>`).join("")}
            </div>
          </div>
          <label class="modal-grid-row">
            <span>文件夹</span>
            <select class="modal-select" data-modal-folder>
              <option value="">无</option>
            </select>
          </label>
          <label class="modal-grid-row">
            <span>清单类型</span>
            <select class="modal-select" data-modal-list-type>
              <option value="task" ${(editingList?.listType || "task") === "task" ? "selected" : ""}>任务清单</option>
              <option value="note" ${editingList?.listType === "note" ? "selected" : ""}>笔记清单</option>
            </select>
          </label>
          <label class="modal-grid-row">
            <span>在智能清单显示</span>
            <select class="modal-select" data-modal-smart-display>
              <option value="all" ${(editingList?.smartDisplay || "all") === "all" ? "selected" : ""}>所有任务</option>
              <option value="none" ${editingList?.smartDisplay === "none" ? "selected" : ""}>不显示</option>
            </select>
          </label>
          <div class="modal-actions">
            <button class="modal-cancel" data-close-modal>取消</button>
            <button class="modal-save" data-save-list>保存</button>
          </div>
        </div>
        <div class="modal-preview">
          <div class="preview-card">
            <div class="preview-main">
              <div class="preview-title"><span>${icon("drag")}</span><strong>名称</strong></div>
              <div class="preview-line long"></div>
              <div class="preview-line short"></div>
              <div class="preview-task"><span style="border-color:${selectedColor}"></span><i></i></div>
              <div class="preview-task"><span></span><i class="wide"></i></div>
              <div class="preview-task"><span></span><i></i></div>
            </div>
            <div class="preview-side">
              <span style="border-color:${selectedColor}"></span>
              <div class="preview-line"></div>
              <div class="preview-line short"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderTagModal() {
  const selectedColor = state.modalColor || palette[6];
  return `
    <div class="modal-backdrop" data-close-modal>
      <section class="settings-modal tag-modal" data-modal-panel>
        <button class="modal-close-dot" data-close-modal title="关闭"></button>
        <div class="modal-form full">
          <h2>添加标签</h2>
          <label class="modal-name-field">
            <span>${icon("tag")}</span>
            <input name="title" data-modal-title placeholder="标签名称" autofocus />
          </label>
          <div class="modal-grid-row">
            <label>颜色</label>
            <div class="color-row">
              ${palette.map((color) => `<button class="color-swatch ${selectedColor === color ? "active" : ""}" data-modal-color="${color}" style="background:${color}"></button>`).join("")}
            </div>
          </div>
          <label class="modal-grid-row">
            <span>上级标签</span>
            <select class="modal-select" data-modal-parent-tag>
              <option value="">无</option>
              ${sortedTags().map((tag) => `<option value="${tag.id}">${escapeHtml(tag.title)}</option>`).join("")}
            </select>
          </label>
          <div class="modal-actions">
            <button class="modal-cancel" data-close-modal>取消</button>
            <button class="modal-save" data-save-tag>保存</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function formatSeconds(total) {
  const min = Math.floor(total / 60).toString().padStart(2, "0");
  const sec = (total % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function selectView(view, options = {}) {
  const allowedViews = new Set(["today", "next7", "inbox", "completed", "quadrant", "focus", "search"]);
  if (!allowedViews.has(view)) return;
  state.selectedView = view;
  state.selectedListId = "";
  state.selectedTagId = "";
  state.priorityMenuOpen = false;
  if (!options.preserveTask) state.selectedTaskId = state.selectedTaskId || "";
}

function focusAfterRender(selector) {
  requestAnimationFrame(() => {
    const element = document.querySelector(selector);
    element?.focus();
    element?.select?.();
  });
}

window.bladydoraSelectView = (view) => {
  selectView(view);
  render();
};

window.bladydoraOpenQuickAdd = () => {
  selectView("today");
  render();
  focusAfterRender("[data-add-task] input[name='title']");
};

window.bladydoraOpenSearch = () => {
  selectView("search");
  render();
  focusAfterRender("[data-search-input]");
};

function closeContextMenuOnce() {
  if (!state.contextMenu) return;
  state.contextMenu = null;
  render();
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      selectView(button.dataset.view);
      render();
    });
  });

  document.querySelectorAll("[data-list]").forEach((button) => {
    button.addEventListener("click", () => {
      state.contextMenu = null;
      state.selectedView = "list";
      state.selectedListId = button.dataset.list;
      render();
    });
  });

  document.querySelectorAll("[data-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      state.contextMenu = null;
      state.selectedView = "tag";
      state.selectedTagId = button.dataset.tag;
      render();
    });
  });

  document.querySelectorAll("[data-list-row]").forEach((row) => {
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      state.contextMenu = { type: "list", listId: row.dataset.listRow, x: event.clientX, y: event.clientY };
      render();
    });
  });

  document.querySelector("[data-context-menu]")?.addEventListener("click", (event) => event.stopPropagation());
  document.querySelector("[data-edit-list]")?.addEventListener("click", () => {
    const list = listById(state.contextMenu?.listId);
    if (!list) return;
    state.modal = "list";
    state.editingListId = list.id;
    state.modalColor = list.color;
    state.modalViewType = list.viewType || "list";
    state.contextMenu = null;
    render();
  });

  document.addEventListener("click", closeContextMenuOnce, { once: true });

  document.querySelector("[data-refresh]")?.addEventListener("click", load);
  document.querySelector("[data-sync-global]")?.addEventListener("click", openGlobalSyncModal);
  document.querySelector("[data-close-detail]")?.addEventListener("click", () => {
    state.selectedTaskId = "";
    state.priorityMenuOpen = false;
    render();
  });

  document.querySelector("[data-add-task]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = form.get("title").trim();
    if (!title) return;
    const task = await api("/api/tasks", {
      method: "POST",
      body: {
        title,
        dueDate: form.get("dueDate"),
        listId: state.selectedView === "list" ? state.selectedListId : "inbox"
      }
    });
    state.db.tasks.unshift(task);
    state.selectedTaskId = task.id;
    render();
  });

  document.querySelector("[data-nl-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = form.get("nl").trim();
    if (!text) return;
    const result = await api("/api/nl", { method: "POST", body: { text } });
    state.nlMessage = result.message;
    await load();
  });

  document.querySelector("[data-add-list]")?.addEventListener("click", () => {
    state.modal = "list";
    state.editingListId = "";
    state.modalColor = palette[0];
    state.modalViewType = "list";
    state.contextMenu = null;
    render();
  });

  document.querySelector("[data-add-tag]")?.addEventListener("click", () => {
    state.modal = "tag";
    state.modalColor = palette[6];
    render();
  });

  document.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const task = state.db.tasks.find((item) => item.id === button.dataset.toggle);
      const nextStatus = task.status === "done" ? "open" : "done";
      const updated = await api(`/api/tasks/${task.id}`, { method: "PATCH", body: { status: nextStatus } });
      Object.assign(task, updated);
      render();
    });
  });

  document.querySelectorAll("[data-select-task]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTaskId = button.dataset.selectTask;
      state.priorityMenuOpen = false;
      render();
    });
  });

  document.querySelectorAll("[data-field]").forEach((field) => {
    field.addEventListener("change", saveDetailField);
    field.addEventListener("blur", saveDetailField);
  });

  document.querySelector("[data-search-input]")?.addEventListener("input", (event) => {
    state.searchText = event.target.value;
    render();
    document.querySelector("[data-search-input]")?.focus();
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.timerMode = button.dataset.mode;
      state.timerSeconds = state.timerMode === "pomodoro" ? 25 * 60 : 0;
      state.timerRunning = false;
      clearInterval(state.timerId);
      render();
    });
  });

  document.querySelector("[data-focus-task]")?.addEventListener("change", (event) => {
    state.selectedTaskId = event.target.value;
    render();
  });

  document.querySelector("[data-add-focus-session]")?.addEventListener("click", () => {
    state.modal = "focusRecord";
    render();
  });

  document.querySelector("[data-start-focus]")?.addEventListener("click", toggleTimer);
  document.querySelector("[data-reset-focus]")?.addEventListener("click", resetTimer);

  bindListDragging();
  bindModalEvents();
  bindDetailControls();
}

function bindListDragging() {
  let draggedId = "";
  document.querySelectorAll("[data-list-row]").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      draggedId = row.dataset.listRow;
      row.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", async (event) => {
      event.preventDefault();
      row.classList.remove("drag-over");
      const targetId = row.dataset.listRow;
      if (!draggedId || draggedId === targetId) return;
      const ids = sortedLists().map((list) => list.id);
      const from = ids.indexOf(draggedId);
      const to = ids.indexOf(targetId);
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      await api("/api/lists/reorder", { method: "POST", body: { ids } });
      ids.forEach((id, index) => {
        const list = state.db.lists.find((item) => item.id === id);
        if (list) list.order = index;
      });
      render();
    });
  });
}

function bindModalEvents() {
  document.querySelector("[data-modal-panel]")?.addEventListener("click", (event) => event.stopPropagation());
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modal = null;
      state.editingListId = "";
      render();
    });
  });
  document.querySelectorAll("[data-modal-color]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modalColor = button.dataset.modalColor;
      render();
    });
  });
  document.querySelectorAll("[data-modal-view-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modalViewType = button.dataset.modalViewType;
      render();
    });
  });
  document.querySelector("[data-save-list]")?.addEventListener("click", saveListFromModal);
  document.querySelector("[data-save-tag]")?.addEventListener("click", saveTagFromModal);
  document.querySelector("[data-save-focus-record]")?.addEventListener("click", saveFocusRecordFromModal);
  document.querySelector("[data-apply-global-sync]")?.addEventListener("click", applyGlobalSync);
  document.querySelector("[data-modal-title]")?.focus();
}

async function openGlobalSyncModal() {
  state.modal = "syncGlobal";
  state.syncPreview = null;
  state.syncMessage = "";
  render();
  try {
    state.syncPreview = await api("/api/sync/global-todos/preview");
  } catch (error) {
    state.syncPreview = { error: error.message, candidates: [], duplicates: [], skipped: [] };
  }
  render();
}

async function applyGlobalSync() {
  const candidates = state.syncPreview?.candidates || [];
  if (!candidates.length) return;
  const result = await api("/api/sync/global-todos/apply", { method: "POST" });
  state.db = result.db;
  normalizeState();
  state.syncPreview = result;
  state.syncMessage = `已导入 ${result.imported || 0} 条待办。`;
  render();
}

async function saveListFromModal() {
  const title = document.querySelector("[data-modal-title]")?.value.trim();
  if (!title) return;
  const body = {
    title,
    color: state.modalColor || palette[0],
    viewType: state.modalViewType || "list",
    folderId: document.querySelector("[data-modal-folder]")?.value || "",
    listType: document.querySelector("[data-modal-list-type]")?.value || "task",
    smartDisplay: document.querySelector("[data-modal-smart-display]")?.value || "all"
  };
  const list = state.editingListId
    ? await api(`/api/lists/${state.editingListId}`, { method: "PATCH", body })
    : await api("/api/lists", { method: "POST", body });
  const current = state.db.lists.find((item) => item.id === list.id);
  if (current) Object.assign(current, list);
  else state.db.lists.push(list);
  state.modal = null;
  state.editingListId = "";
  state.selectedView = "list";
  state.selectedListId = list.id;
  render();
}

async function saveTagFromModal() {
  const title = document.querySelector("[data-modal-title]")?.value.trim();
  if (!title) return;
  const tag = await api("/api/tags", {
    method: "POST",
    body: {
      title,
      color: state.modalColor || palette[6],
      parentId: document.querySelector("[data-modal-parent-tag]")?.value || ""
    }
  });
  state.db.tags.push(tag);
  state.modal = null;
  state.selectedView = "tag";
  state.selectedTagId = tag.id;
  render();
}

async function saveFocusRecordFromModal() {
  const taskId = document.querySelector("[data-focus-record-task]")?.value || "";
  const startedAtValue = document.querySelector("[data-focus-record-start]")?.value;
  const endedAtValue = document.querySelector("[data-focus-record-end]")?.value;
  const startedAt = new Date(startedAtValue);
  const endedAt = new Date(endedAtValue);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime()) || endedAt <= startedAt) return;
  const task = state.db.tasks.find((item) => item.id === taskId);
  const session = await api("/api/focus-sessions", {
    method: "POST",
    body: {
      taskId,
      taskTitle: task?.title || "",
      minutes: Math.max(1, Math.round((endedAt - startedAt) / 60000)),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      mode: document.querySelector("[data-focus-record-mode]")?.value || "pomodoro",
      notes: document.querySelector("[data-focus-record-notes]")?.value || ""
    }
  });
  state.db.focusSessions.unshift(session);
  if (task) task.focusMinutes = Number(task.focusMinutes || 0) + session.minutes;
  state.modal = null;
  render();
}

function bindDetailControls() {
  document.querySelectorAll("[data-detail-mode]").forEach((button) => {
    button.addEventListener("click", async () => {
      await updateSelectedTask({ detailMode: button.dataset.detailMode });
    });
  });
  document.querySelector("[data-priority-menu]")?.addEventListener("click", () => {
    state.priorityMenuOpen = !state.priorityMenuOpen;
    render();
  });
  document.querySelectorAll("[data-set-priority]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.priorityMenuOpen = false;
      await updateSelectedTask({ priority: button.dataset.setPriority });
    });
  });
  document.querySelector("[data-add-check-item]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = new FormData(event.currentTarget).get("title").trim();
    if (!title) return;
    const task = selectedTask();
    await updateSelectedTask({ checkItems: [...task.checkItems, { title, done: false }] });
  });
  document.querySelectorAll("[data-toggle-check-item]").forEach((button) => {
    button.addEventListener("click", async () => {
      const task = selectedTask();
      const index = Number(button.dataset.toggleCheckItem);
      const items = task.checkItems.map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item);
      await updateSelectedTask({ checkItems: items });
    });
  });
  document.querySelectorAll("[data-check-item-title]").forEach((input) => {
    input.addEventListener("blur", async () => {
      const task = selectedTask();
      const index = Number(input.dataset.checkItemTitle);
      const items = task.checkItems.map((item, itemIndex) => itemIndex === index ? { ...item, title: input.value } : item);
      await updateSelectedTask({ checkItems: items });
    });
  });
  document.querySelectorAll("[data-remove-check-item]").forEach((button) => {
    button.addEventListener("click", async () => {
      const task = selectedTask();
      const index = Number(button.dataset.removeCheckItem);
      await updateSelectedTask({ checkItems: task.checkItems.filter((_, itemIndex) => itemIndex !== index) });
    });
  });
}

async function updateSelectedTask(patch) {
  const task = selectedTask();
  if (!task) return null;
  const updated = await api(`/api/tasks/${task.id}`, { method: "PATCH", body: patch });
  Object.assign(task, updated);
  render();
  return updated;
}

async function saveDetailField(event) {
  const task = selectedTask();
  if (!task) return;
  const field = event.target.dataset.field;
  const value = event.target.value;
  if (task[field] === value) return;
  const updated = await api(`/api/tasks/${task.id}`, { method: "PATCH", body: { [field]: value } });
  Object.assign(task, updated);
  render();
}

function toggleTimer() {
  if (state.timerRunning) {
    clearInterval(state.timerId);
    state.timerRunning = false;
    render();
    return;
  }
  state.timerRunning = true;
  state.timerStartedAt = state.timerStartedAt || new Date().toISOString();
  state.timerId = setInterval(async () => {
    state.timerSeconds += state.timerMode === "stopwatch" ? 1 : -1;
    if (state.timerMode === "pomodoro" && state.timerSeconds <= 0) {
      await finishFocus();
      return;
    }
    render();
  }, 1000);
  render();
}

function resetTimer() {
  clearInterval(state.timerId);
  state.timerRunning = false;
  state.timerStartedAt = "";
  state.timerSeconds = state.timerMode === "pomodoro" ? 25 * 60 : 0;
  render();
}

async function finishFocus() {
  const elapsed = state.timerMode === "pomodoro" ? 25 : Math.max(1, Math.round(state.timerSeconds / 60));
  const task = selectedTask();
  clearInterval(state.timerId);
  state.timerRunning = false;
  await api("/api/focus-sessions", {
    method: "POST",
    body: {
      taskId: task?.id || "",
      taskTitle: task?.title || "",
      minutes: elapsed,
      startedAt: state.timerStartedAt || new Date().toISOString(),
      mode: state.timerMode
    }
  });
  state.timerStartedAt = "";
  state.timerSeconds = state.timerMode === "pomodoro" ? 25 * 60 : 0;
  await load();
}

load().catch((error) => {
  app.innerHTML = `<pre style="padding:24px;color:#c00">${escapeHtml(error.message)}</pre>`;
});
