const app = document.querySelector("#app");

const state = {
  db: null,
  selectedView: "today",
  selectedListId: "",
  selectedTagId: "",
  selectedTaskId: "",
  searchText: "",
  nlMessage: "",
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
  quadrant: "四象限",
  focus: "番茄专注",
  search: "搜索"
};

const priorities = {
  high: { label: "高", color: "#ff5e6c" },
  medium: { label: "中", color: "#ffab2e" },
  low: { label: "低", color: "#20c997" },
  none: { label: "无", color: "#b7b7b7" }
};

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
  render();
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
  `;
  bindEvents();
}

function renderRail() {
  const items = [
    ["today", "✓", "任务"],
    ["next7", "▦", "日历"],
    ["quadrant", "✣", "四象限"],
    ["focus", "◎", "专注"],
    ["search", "⌕", "搜索"]
  ];
  return `
    <aside class="rail">
      <div class="avatar">Y</div>
      ${items.map(([view, icon, label]) => `
        <button class="rail-button ${state.selectedView === view ? "active" : ""}" data-view="${view}" title="${label}">${icon}</button>
      `).join("")}
      <div class="rail-spacer"></div>
      <button class="rail-button" data-refresh title="刷新">↻</button>
      <button class="rail-button" title="通知">●</button>
      <button class="rail-button" title="帮助">?</button>
    </aside>
  `;
}

function renderSide() {
  const todayCount = openTasks().filter((task) => !task.dueDate || task.dueDate <= today()).length;
  const next7Count = openTasks().filter((task) => task.dueDate && task.dueDate <= addDays(7)).length;
  const inboxCount = state.db.tasks.filter((task) => task.status === "open" && task.listId === "inbox").length;
  return `
    <aside class="side">
      <button class="nav-row" data-view="today"><span>▣</span><span>今天</span><span class="count">${todayCount}</span></button>
      <button class="nav-row" data-view="next7"><span>▤</span><span>最近 7 天</span><span class="count">${next7Count}</span></button>
      <button class="nav-row" data-view="inbox"><span>▱</span><span>收集箱</span><span class="count">${inboxCount}</span></button>

      <div class="section-title"><span>清单</span><button class="mini-add" data-add-list title="添加清单">+</button></div>
      ${state.db.lists.filter((list) => !list.archived).map((list) => {
        const count = state.db.tasks.filter((task) => task.status === "open" && task.listId === list.id).length;
        return `
          <button class="list-row ${state.selectedView === "list" && state.selectedListId === list.id ? "active" : ""}" data-list="${list.id}">
            <span>☰</span>
            <span>${escapeHtml(list.title)}</span>
            <span class="dot" style="background:${list.color}"></span>
            <span class="count">${count}</span>
          </button>
        `;
      }).join("")}

      <div class="section-title"><span>标签</span></div>
      ${state.db.tags.map((tag) => `
        <button class="tag-row ${state.selectedView === "tag" && state.selectedTagId === tag.id ? "active" : ""}" data-tag="${tag.id}">
          <span class="tag-icon" style="color:${tag.color}"></span>
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
  return `
    <main class="main">
      <header class="main-header">
        <button class="icon-button" title="侧边栏">☰</button>
        <h1 class="main-title">${escapeHtml(viewTitle())}</h1>
        <button class="icon-button" data-sort title="排序">⇅</button>
        <button class="icon-button" title="更多">…</button>
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
        ${renderTaskGroup("待办", open)}
        ${done.length ? renderTaskGroup("已完成", done) : ""}
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
  return `
    <div class="task-row ${state.selectedTaskId === task.id ? "selected" : ""}" data-task="${task.id}">
      <button class="check ${task.status === "done" ? "done" : ""}" data-toggle="${task.id}" title="完成">${task.status === "done" ? "✓" : ""}</button>
      <button class="task-title ${task.status === "done" ? "done-text" : ""}" data-select-task="${task.id}">${escapeHtml(task.title)}</button>
      <div class="task-meta">
        <span class="priority-pill" style="background:${priority.color}" title="${priority.label}优先级"></span>
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
            <div style="font-size:58px;margin-bottom:12px;">☆</div>
            <div>选择一条任务查看详情</div>
          </div>
        </div>
      </aside>
    `;
  }

  return `
    <aside class="detail">
      <header class="detail-header">
        <button class="check ${task.status === "done" ? "done" : ""}" data-toggle="${task.id}" title="完成">${task.status === "done" ? "✓" : ""}</button>
        <div>
          <button class="icon-button" data-close-detail title="关闭">×</button>
        </div>
      </header>
      <section class="detail-body">
        <div class="detail-title-row">
          <span></span>
          <textarea class="title-input" data-field="title" rows="2">${escapeHtml(task.title)}</textarea>
        </div>
        <div class="field-grid">
          <label>清单</label>
          <select class="field" data-field="listId">
            ${state.db.lists.map((list) => `<option value="${list.id}" ${task.listId === list.id ? "selected" : ""}>${escapeHtml(list.title)}</option>`).join("")}
          </select>
        </div>
        <div class="field-grid">
          <label>日期</label>
          <input class="field" type="date" data-field="dueDate" value="${escapeHtml(task.dueDate)}" />
        </div>
        <div class="field-grid">
          <label>优先级</label>
          <select class="field" data-field="priority">
            ${Object.entries(priorities).map(([id, item]) => `<option value="${id}" ${task.priority === id ? "selected" : ""}>${item.label}</option>`).join("")}
          </select>
        </div>
        <div class="field-grid">
          <label>四象限</label>
          <select class="field" data-field="quadrant">
            ${quadrants.map((item) => `<option value="${item.id}" ${task.quadrant === item.id ? "selected" : ""}>${item.roman} ${item.title}</option>`).join("")}
          </select>
        </div>
        <div class="field-grid">
          <label>负责人</label>
          <input class="field" data-field="owner" value="${escapeHtml(task.owner || "")}" />
        </div>
        <div class="field-grid">
          <label>来源</label>
          <input class="field" data-field="source" value="${escapeHtml(task.source || "")}" />
        </div>
        <div class="field-grid">
          <label>路由</label>
          <input class="field" data-field="route" value="${escapeHtml(task.route || "")}" />
        </div>
        <div class="field-grid" style="align-items:start;">
          <label>备注</label>
          <textarea class="textarea" data-field="notes">${escapeHtml(task.notes || "")}</textarea>
        </div>
      </section>
    </aside>
  `;
}

function renderQuadrantView() {
  return `
    <main class="main">
      <header class="main-header">
        <h1 class="main-title">四象限</h1>
        <button class="icon-button" data-view="today" title="返回任务">✓</button>
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
        <button class="icon-button" title="添加专注记录" data-finish-focus>＋</button>
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

function formatSeconds(total) {
  const min = Math.floor(total / 60).toString().padStart(2, "0");
  const sec = (total % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedView = button.dataset.view;
      state.selectedListId = "";
      state.selectedTagId = "";
      render();
    });
  });

  document.querySelectorAll("[data-list]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedView = "list";
      state.selectedListId = button.dataset.list;
      render();
    });
  });

  document.querySelectorAll("[data-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedView = "tag";
      state.selectedTagId = button.dataset.tag;
      render();
    });
  });

  document.querySelector("[data-refresh]")?.addEventListener("click", load);
  document.querySelector("[data-close-detail]")?.addEventListener("click", () => {
    state.selectedTaskId = "";
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

  document.querySelector("[data-add-list]")?.addEventListener("click", async () => {
    const title = window.prompt("清单名称");
    if (!title?.trim()) return;
    const list = await api("/api/lists", { method: "POST", body: { title: title.trim() } });
    state.db.lists.push(list);
    state.selectedView = "list";
    state.selectedListId = list.id;
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

  document.querySelector("[data-start-focus]")?.addEventListener("click", toggleTimer);
  document.querySelector("[data-reset-focus]")?.addEventListener("click", resetTimer);
  document.querySelector("[data-finish-focus]")?.addEventListener("click", finishFocus);
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
