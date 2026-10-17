const $ = id => document.getElementById(id);

const today = new Date();
today.setHours(0, 0, 0, 0);

function dateOffset(days) {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

const starterTasks = [
  { id: 1, title: "DBMS lab assignment", subject: "DBMS", due: dateOffset(1), priority: "High", done: false },
  { id: 2, title: "Java OOP practice", subject: "Java", due: dateOffset(2), priority: "Medium", done: false },
  { id: 3, title: "AI case study report", subject: "Artificial Intelligence", due: dateOffset(4), priority: "High", done: false },
  { id: 4, title: "Data Structures questions", subject: "DSA", due: dateOffset(6), priority: "Low", done: true }
];

let tasks = [];
try {
  const saved = localStorage.getItem("campusflow_tasks");
  const parsed = saved ? JSON.parse(saved) : null;
  tasks = Array.isArray(parsed) ? parsed : starterTasks;
} catch {
  tasks = starterTasks;
}

let currentFilter = "all";
let sortMode = "smart";

function saveTasks() {
  try {
    localStorage.setItem("campusflow_tasks", JSON.stringify(tasks));
  } catch (error) {
    console.warn("Could not save tasks.", error);
  }
}

function daysUntil(dateString) {
  const date = new Date(dateString + "T00:00:00");
  return Math.round((date - today) / 86400000);
}

function formatDate(dateString) {
  return new Date(dateString + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function isDueSoon(task) {
  const days = daysUntil(task.due);
  return !task.done && days >= 0 && days <= 3;
}

function showToast(message) {
  let toast = $("cfToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "cfToast";
    toast.className = "cf-toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function setupAdvancedUI() {
  const header = document.querySelector("header");
  if (header && !$("themeToggle")) {
    const button = document.createElement("button");
    button.id = "themeToggle";
    button.className = "theme-toggle";
    button.type = "button";
    button.setAttribute("aria-label", "Toggle light and dark theme");
    header.appendChild(button);

    button.addEventListener("click", () => {
      const dark = document.body.classList.toggle("dark-mode");
      try { localStorage.setItem("campusflow_theme", dark ? "dark" : "light"); } catch (error) { console.warn("Could not save theme preference.", error); }
      button.textContent = dark ? "☀️ Light mode" : "🌙 Dark mode";
      showToast(dark ? "Dark mode enabled" : "Light mode enabled");
    });
  }

  let darkSaved = false;
  try { darkSaved = localStorage.getItem("campusflow_theme") === "dark"; } catch (error) { console.warn("Could not read theme preference.", error); }
  document.body.classList.toggle("dark-mode", darkSaved);
  if ($("themeToggle")) {
    $("themeToggle").textContent = darkSaved ? "☀️ Light mode" : "🌙 Dark mode";
  }

  const stats = document.querySelector(".stats");
  if (stats && !$("cfAnalytics")) {
    const panel = document.createElement("section");
    panel.id = "cfAnalytics";
    panel.className = "cf-analytics";

    panel.innerHTML = `
      <div class="cf-analytics-heading">
        <div>
          <p class="cf-eyebrow">YOUR STUDY SNAPSHOT</p>
          <h2>Productivity insights</h2>
        </div>
        <label class="cf-sort-label">Sort by
          <select id="sortMode" class="cf-sort">
            <option value="smart">Smart priority</option>
            <option value="date">Nearest deadline</option>
            <option value="priority">Highest priority</option>
          </select>
        </label>
      </div>

      <div class="cf-insight-grid">
        <div class="cf-insight">
          <span>Pending work</span>
          <strong id="cfPending">0</strong>
          <small>Assignments left</small>
        </div>
        <div class="cf-insight">
          <span>Overdue</span>
          <strong id="cfOverdue">0</strong>
          <small>Needs attention</small>
        </div>
        <div class="cf-insight">
          <span>Completion rate</span>
          <strong id="cfRate">0%</strong>
          <small>Semester progress</small>
        </div>
      </div>

      <div class="cf-subject-area">
        <h3>Subject-wise progress</h3>
        <div id="cfSubjectProgress"></div>
      </div>`;

    stats.insertAdjacentElement("afterend", panel);

    $("sortMode").addEventListener("change", event => {
      sortMode = event.target.value;
      render();
    });
  }

  if (!$("cfToast")) {
    const toast = document.createElement("div");
    toast.id = "cfToast";
    toast.className = "cf-toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
}

function updateSubjectOptions() {
  const select = $("subjectFilter");
  const oldValue = select.value;
  const subjects = [...new Set(tasks.map(task => task.subject))].sort();

  select.innerHTML = '<option value="all">All subjects</option>';
  subjects.forEach(subject => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    select.appendChild(option);
  });

  if (subjects.includes(oldValue)) select.value = oldValue;
}

function renderAnalytics(percentage) {
  $("cfPending").textContent = tasks.filter(task => !task.done).length;
  $("cfOverdue").textContent = tasks.filter(
    task => !task.done && daysUntil(task.due) < 0
  ).length;
  $("cfRate").textContent = percentage + "%";

  const container = $("cfSubjectProgress");
  container.replaceChildren();

  const subjects = [...new Set(tasks.map(task => task.subject))];

  if (!subjects.length) {
    container.textContent = "Add assignments to see subject progress.";
    return;
  }

  subjects.sort().forEach(subject => {
    const group = tasks.filter(task => task.subject === subject);
    const done = group.filter(task => task.done).length;
    const rate = Math.round(done / group.length * 100);

    const item = document.createElement("div");
    item.className = "cf-subject-row";

    const top = document.createElement("div");
    top.className = "cf-subject-top";

    const name = document.createElement("span");
    name.textContent = subject;

    const count = document.createElement("span");
    count.textContent = `${done}/${group.length} completed`;

    const track = document.createElement("div");
    track.className = "cf-mini-track";

    const bar = document.createElement("div");
    bar.className = "cf-mini-bar";
    bar.style.width = rate + "%";

    top.append(name, count);
    track.appendChild(bar);
    item.append(top, track);
    container.appendChild(item);
  });
}


function editTask(task) {
  const title = prompt("Edit assignment name:", task.title);
  if (title === null) return;

  const subject = prompt("Edit subject:", task.subject);
  if (subject === null) return;

  const due = prompt("Edit due date (YYYY-MM-DD):", task.due);
  if (due === null) return;

  const priority = prompt(
    "Enter priority: High, Medium, or Low",
    task.priority
  );
  if (priority === null) return;

  const cleanTitle = title.trim();
  const cleanSubject = subject.trim();
  const cleanPriority = priority.trim().toLowerCase();
  const validPriorities = ["high", "medium", "low"];

  if (!cleanTitle || !cleanSubject) {
    showToast("Name and subject cannot be empty.");
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) ||
      Number.isNaN(new Date(due + "T00:00:00").getTime())) {
    showToast("Please enter a valid date in YYYY-MM-DD format.");
    return;
  }

  if (!validPriorities.includes(cleanPriority)) {
    showToast("Priority must be High, Medium, or Low.");
    return;
  }

  task.title = cleanTitle;
  task.subject = cleanSubject;
  task.due = due;
  task.priority = cleanPriority.charAt(0).toUpperCase() +
    cleanPriority.slice(1);

  render();
  showToast("Assignment updated successfully! ✨");
}

function deleteTask(task) {
  if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) {
    return;
  }

  tasks = tasks.filter(item => item.id !== task.id);
  render();
  showToast("Assignment deleted.");
}


function render() {
  saveTasks();
  updateSubjectOptions();

  $("total").textContent = tasks.length;
  $("dueSoon").textContent = tasks.filter(isDueSoon).length;

  const completedCount = tasks.filter(task => task.done).length;
  $("completed").textContent = completedCount;

  const percentage = tasks.length
    ? Math.round(completedCount / tasks.length * 100)
    : 0;

  $("progress").style.width = percentage + "%";
  $("progressText").textContent = percentage + "% complete";
  renderAnalytics(percentage);
  renderProductivityHub();
  
  const query = $("search").value.trim().toLowerCase();
  const subject = $("subjectFilter").value;

  const visibleTasks = tasks.filter(task => {
    const matchesSearch =
      (task.title + " " + task.subject).toLowerCase().includes(query);
    const matchesSubject = subject === "all" || subject === task.subject;
    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "todo" && !task.done) ||
      (currentFilter === "done" && task.done) ||
      (currentFilter === "soon" && isDueSoon(task));

    return matchesSearch && matchesSubject && matchesFilter;
  });

  const priorityRank = { High: 0, Medium: 1, Low: 2 };
  visibleTasks.sort((a, b) => {
    if (sortMode === "priority") {
      return priorityRank[a.priority] - priorityRank[b.priority] ||
        a.due.localeCompare(b.due);
    }
    if (sortMode === "date") return a.due.localeCompare(b.due);

    if (a.done !== b.done) return a.done ? 1 : -1;
    const aOverdue = !a.done && daysUntil(a.due) < 0;
    const bOverdue = !b.done && daysUntil(b.due) < 0;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return priorityRank[a.priority] - priorityRank[b.priority] ||
      a.due.localeCompare(b.due);
  });

  const list = $("taskList");
  list.replaceChildren();

  if (!visibleTasks.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No assignments found. Try another filter or add a task.";
    list.appendChild(empty);
    return;
  }

  visibleTasks.forEach(task => {
    const row = document.createElement("div");
    row.className = "task" + (task.done ? " done" : "");
    row.dataset.taskId = String(task.id);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", "Mark " + task.title + " complete");

    
checkbox.addEventListener("change", () => {
  task.done = checkbox.checked;

  if (task.done) {
    task.completedOn = dateOffset(0);
  } else {
    delete task.completedOn;
  }

  render();
  showToast(
    task.done
      ? "Assignment completed! 🎉"
      : "Assignment marked pending"
  );
});


    const info = document.createElement("div");
    info.className = "task-info";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.textContent = task.subject;

    info.append(title, meta);

    const priority = document.createElement("span");
    priority.className = "priority " + task.priority.toLowerCase();
    priority.textContent = task.priority;

    const due = document.createElement("span");
    due.className = "due";
    const days = daysUntil(task.due);

    if (task.done) {
      due.textContent = "Completed";
    } else if (days < 0) {
      due.textContent = "Overdue · " + formatDate(task.due);
      due.classList.add("cf-overdue");
    } else if (days === 0) {
      due.textContent = "Due today";
      due.classList.add("cf-due-today");
    } else if (days === 1) {
      due.textContent = "Due tomorrow";
      due.classList.add("cf-due-soon");
    } else {
      due.textContent = formatDate(task.due);
      if (days <= 3) due.classList.add("cf-due-soon");
    }

    
const actions = document.createElement("div");
actions.className = "cf-task-actions";

const editButton = document.createElement("button");
editButton.type = "button";
editButton.className = "cf-edit-btn";
editButton.textContent = "✏️ Edit";
editButton.setAttribute("aria-label", "Edit " + task.title);
editButton.addEventListener("click", () => editTask(task));

const deleteButton = document.createElement("button");
deleteButton.type = "button";
deleteButton.className = "cf-delete-btn";
deleteButton.textContent = "🗑 Delete";
deleteButton.setAttribute("aria-label", "Delete " + task.title);
deleteButton.addEventListener("click", () => deleteTask(task));

actions.append(editButton, deleteButton);
row.append(checkbox, info, priority, due, actions);
list.appendChild(row);
  });
}

function openModal() {
  $("taskForm").reset();
  $("taskDate").value = dateOffset(1);
  $("modalBackdrop").classList.add("open");
  $("taskTitle").focus();
}

function closeModal() {
  $("modalBackdrop").classList.remove("open");
}

$("openAdd").addEventListener("click", openModal);
$("cancelAdd").addEventListener("click", closeModal);

$("modalBackdrop").addEventListener("click", event => {
  if (event.target === $("modalBackdrop")) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
});

$("taskForm").addEventListener("submit", event => {
  event.preventDefault();

  const title = $("taskTitle").value.trim();
  const subject = $("taskSubject").value.trim();
  const due = $("taskDate").value;

  if (!title || !subject || !due) {
    showToast("Please fill in all assignment details.");
    return;
  }

  tasks.push({
    id: Date.now(),
    title,
    subject,
    due,
    priority: $("taskPriority").value,
    done: false
  });

  closeModal();
  render();
  showToast("Assignment added successfully! ✨");
});

$("search").addEventListener("input", render);
$("subjectFilter").addEventListener("change", render);

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll(".tab").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });
    render();
  });
});


/* ===== CampusFlow Productivity Hub ===== */

let calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedCalendarDate = dateOffset(0);
let focusSeconds = 25 * 60;
let focusInterval = null;
let focusRunning = false;
let focusMode = "focus";

function getStudyGoal() {
  return Math.max(1, Number(localStorage.getItem("cf_daily_goal")) || 3);
}

function getFocusCount() {
  return Number(localStorage.getItem("cf_focus_count")) || 0;
}

function setupProductivityHub() {
  if ($("cfProductivityHub")) return;

  const hub = document.createElement("section");
  hub.id = "cfProductivityHub";
  hub.className = "cf-productivity-hub";

  hub.innerHTML = `
    <div class="cf-hub-heading">
      <p class="cf-eyebrow">STUDY SMARTER</p>
      <h2>Your Productivity Hub ✨</h2>
      <p>Plan your deadlines, focus deeply and track your daily goals.</p>
    </div>

    <div class="cf-hub-grid">
      <article class="cf-hub-card cf-calendar-card">
        <div class="cf-card-heading">
          <div><span class="cf-feature-icon">📅</span><h3>Deadline Calendar</h3></div>
          <div class="cf-calendar-nav">
            <button id="cfPrevMonth" type="button" aria-label="Previous month">‹</button>
            <button id="cfNextMonth" type="button" aria-label="Next month">›</button>
          </div>
        </div>
        <h4 id="cfCalendarTitle"></h4>
        <div class="cf-calendar-week">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span>
          <span>Thu</span><span>Fri</span><span>Sat</span>
        </div>
        <div id="cfCalendarGrid" class="cf-calendar-grid"></div>
        <div class="cf-selected-date">
          <strong id="cfSelectedDateLabel"></strong>
          <div id="cfCalendarTasks"></div>
        </div>
      </article>

      <article class="cf-hub-card cf-focus-card">
        <span class="cf-feature-icon">⏱️</span>
        <h3>Focus Timer</h3>
        <p class="cf-muted">One session at a time. You've got this!</p>
        <div id="cfTimerDisplay" class="cf-timer-display">25:00</div>
        <div class="cf-timer-modes">
          <button type="button" data-mode="focus" class="active">Focus 25m</button>
          <button type="button" data-mode="short">Break 5m</button>
        </div>
        <div class="cf-timer-actions">
          <button id="cfTimerStart" type="button" class="cf-primary-btn">▶ Start</button>
          <button id="cfTimerReset" type="button" class="cf-secondary-btn">↺ Reset</button>
        </div>
        <p class="cf-session-count">Completed focus sessions: <strong id="cfFocusCount">0</strong></p>
      </article>

      <article class="cf-hub-card cf-goal-card">
        <span class="cf-feature-icon">🎯</span>
        <h3>Today's Study Goal</h3>
        <p class="cf-muted">Choose how many assignments you want to finish today.</p>
        <label class="cf-goal-label" for="cfGoalInput">Daily completion goal</label>
        <div class="cf-goal-controls">
          <input id="cfGoalInput" type="number" min="1" max="50" value="3">
          <button id="cfSaveGoal" type="button" class="cf-primary-btn">Save goal</button>
        </div>
        <div class="cf-goal-track"><div id="cfGoalBar"></div></div>
        <p id="cfGoalText" class="cf-goal-text"></p>
      </article>

      <article class="cf-hub-card cf-backup-card">
        <span class="cf-feature-icon">🗂️</span>
        <h3>Data Backup</h3>
        <p class="cf-muted">Keep a copy of your assignments or restore them later.</p>
        <button id="cfBackupBtn" type="button" class="cf-primary-btn">⬇ Download backup</button>
        <label class="cf-import-label" for="cfImportFile">Restore from JSON backup</label>
        <input id="cfImportFile" type="file" accept=".json,application/json">
        <p class="cf-backup-note">Restoring replaces your current assignment list.</p>
      </article>
    </div>
  `;

  const analytics = $("cfAnalytics");
  const stats = document.querySelector(".stats");
  if (analytics) analytics.insertAdjacentElement("afterend", hub);
  else if (stats) stats.insertAdjacentElement("afterend", hub);
  else document.querySelector("main")?.appendChild(hub);

  $("cfPrevMonth").addEventListener("click", () => {
    calendarMonth.setMonth(calendarMonth.getMonth() - 1);
    renderProductivityHub();
  });

  $("cfNextMonth").addEventListener("click", () => {
    calendarMonth.setMonth(calendarMonth.getMonth() + 1);
    renderProductivityHub();
  });

  $("cfCalendarGrid").addEventListener("click", event => {
    const dayButton = event.target.closest("[data-date]");
    if (!dayButton) return;
    selectedCalendarDate = dayButton.dataset.date;
    renderProductivityHub();
  });

  document.querySelectorAll("[data-mode]").forEach(button => {
    button.addEventListener("click", () => {
      focusMode = button.dataset.mode;
      stopFocusTimer();
      focusSeconds = focusMode === "focus" ? 25 * 60 : 5 * 60;
      document.querySelectorAll("[data-mode]").forEach(item => {
        item.classList.toggle("active", item === button);
      });
      updateFocusDisplay();
    });
  });

  $("cfTimerStart").addEventListener("click", () => {
    if (focusRunning) {
      stopFocusTimer();
      $("cfTimerStart").textContent = "▶ Resume";
      return;
    }

    focusRunning = true;
    $("cfTimerStart").textContent = "Ⅱ Pause";

    focusInterval = setInterval(() => {
      focusSeconds--;
      updateFocusDisplay();

      if (focusSeconds <= 0) {
        stopFocusTimer();

        if (focusMode === "focus") {
          localStorage.setItem("cf_focus_count", String(getFocusCount() + 1));
          showToast("Focus session complete! Take a break 🎉");
        } else {
          showToast("Break complete! Ready to focus? 💜");
        }

        focusSeconds = focusMode === "focus" ? 25 * 60 : 5 * 60;
        updateFocusDisplay();
      }
    }, 1000);
  });

  $("cfTimerReset").addEventListener("click", () => {
    stopFocusTimer();
    focusSeconds = focusMode === "focus" ? 25 * 60 : 5 * 60;
    updateFocusDisplay();
  });

  $("cfSaveGoal").addEventListener("click", () => {
    const value = Number($("cfGoalInput").value);
    if (!Number.isInteger(value) || value < 1 || value > 50) {
      showToast("Choose a daily goal between 1 and 50.");
      return;
    }
    localStorage.setItem("cf_daily_goal", String(value));
    renderProductivityHub();
    showToast("Daily goal saved! 🎯");
  });

  $("cfBackupBtn").addEventListener("click", () => {
    const backup = {
      app: "CampusFlow",
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "CampusFlow_Backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Backup downloaded successfully!");
  });

  $("cfImportFile").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const data = JSON.parse(await file.text());
      const imported = Array.isArray(data) ? data : data.tasks;

      const valid = Array.isArray(imported) && imported.every(task =>
        task &&
        typeof task.title === "string" &&
        typeof task.subject === "string" &&
        typeof task.due === "string" &&
        ["High", "Medium", "Low"].includes(task.priority) &&
        typeof task.done === "boolean"
      );

      if (!valid) throw new Error("Invalid backup format");

      if (!confirm("Restore this backup? Your current assignments will be replaced.")) {
        event.target.value = "";
        return;
      }

      tasks = imported.map((task, index) => ({
        ...task,
        id: Number(task.id) || Date.now() + index
      }));

      render();
      showToast("Backup restored successfully!");
    } catch {
      showToast("Invalid backup file. Please choose a CampusFlow JSON backup.");
    }

    event.target.value = "";
  });

  $("cfGoalInput").value = getStudyGoal();
  updateFocusDisplay();
  renderProductivityHub();
}

function stopFocusTimer() {
  if (focusInterval) clearInterval(focusInterval);
  focusInterval = null;
  focusRunning = false;
  if ($("cfTimerStart")) $("cfTimerStart").textContent = "▶ Start";
}

function updateFocusDisplay() {
  const display = $("cfTimerDisplay");
  if (!display) return;

  const mins = Math.floor(focusSeconds / 60);
  const secs = focusSeconds % 60;
  display.textContent =
    String(mins).padStart(2, "0") + ":" +
    String(secs).padStart(2, "0");

  $("cfFocusCount").textContent = getFocusCount();
}

function renderProductivityHub() {
  if (!$("cfProductivityHub")) return;

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  $("cfCalendarTitle").textContent =
    calendarMonth.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });

  const grid = $("cfCalendarGrid");
  grid.replaceChildren();

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstWeekday; i++) {
    const blank = document.createElement("span");
    blank.className = "cf-calendar-blank";
    grid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = [
      year,
      String(month + 1).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");

    const dayTasks = tasks.filter(task => task.due === key && !task.done);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cf-calendar-day";
    button.dataset.date = key;
    button.textContent = day;

    if (key === dateOffset(0)) button.classList.add("cf-calendar-today");
    if (key === selectedCalendarDate) button.classList.add("cf-calendar-selected");
    if (dayTasks.length) button.classList.add("cf-calendar-has-task");
    if (dayTasks.some(task => daysUntil(task.due) < 0)) {
      button.classList.add("cf-calendar-overdue");
    }

    button.title = dayTasks.length
      ? `${dayTasks.length} pending assignment(s)`
      : "No pending assignments";

    grid.appendChild(button);
  }

  $("cfSelectedDateLabel").textContent =
    new Date(selectedCalendarDate + "T00:00:00").toLocaleDateString(
      "en-IN", { weekday: "long", day: "numeric", month: "long" }
    );

  const dateTasks = tasks.filter(task => task.due === selectedCalendarDate);
  const taskContainer = $("cfCalendarTasks");
  taskContainer.replaceChildren();

  if (!dateTasks.length) {
    const empty = document.createElement("p");
    empty.className = "cf-muted";
    empty.textContent = "No assignments due on this date.";
    taskContainer.appendChild(empty);
  } else {
    dateTasks.forEach(task => {
      const line = document.createElement("p");
      line.className = "cf-calendar-task";
      line.textContent = `${task.done ? "✓" : "•"} ${task.title} — ${task.done ? "Completed" : task.priority}`;
      taskContainer.appendChild(line);
    });
  }

  const goal = getStudyGoal();
  const completedToday = tasks.filter(task =>
    task.done && task.completedOn === dateOffset(0)
  ).length;

  $("cfGoalInput").value = goal;
  $("cfGoalBar").style.width =
    Math.min(100, Math.round(completedToday / goal * 100)) + "%";
  $("cfGoalText").textContent =
    `${completedToday} of ${goal} assignments completed today`;
}


function setupTaskTools() {
  const heading = document.querySelector(".panel-heading");
  if (!heading || $("cfTaskTools")) return;

  const tools = document.createElement("div");
  tools.id = "cfTaskTools";
  tools.className = "cf-task-tools";

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "cf-export-btn";
  exportButton.textContent = "⬇ Export CSV";

  exportButton.addEventListener("click", () => {
    const columns = ["Assignment", "Subject", "Due Date", "Priority", "Status"];
    const rows = tasks.map(task => [
      task.title,
      task.subject,
      task.due,
      task.priority,
      task.done ? "Completed" : "Pending"
    ]);

    const escapeCSV = value =>
      '"' + String(value).replace(/"/g, '""') + '"';

    const csv = [columns, ...rows]
      .map(row => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "CampusFlow_Assignments.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast("Assignment report downloaded! 📄");
  });

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "cf-clear-btn";
  clearButton.textContent = "✓ Clear Completed";

  clearButton.addEventListener("click", () => {
    const completedCount = tasks.filter(task => task.done).length;

    if (!completedCount) {
      showToast("No completed assignments to clear.");
      return;
    }

    if (!confirm(`Remove all ${completedCount} completed assignment(s)?`)) {
      return;
    }

    tasks = tasks.filter(task => !task.done);
    render();
    showToast("Completed assignments cleared.");
  });

  tools.append(exportButton, clearButton);
  heading.appendChild(tools);
}

// ===== CAMPUSFLOW PLUS FEATURES =====

function setupCampusFlowPlus() {
  const taskList = $("taskList");
  if (!taskList || $("cfPlusPanel")) return;

  const readStore = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const saveStore = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Could not save CampusFlow data.", error);
      showToast("Could not save data in this browser.");
    }
  };

  const quotes = [
    "Small progress is still progress.",
    "One assignment at a time.",
    "Success comes from consistency.",
    "Your future self will thank you.",
    "Discipline beats motivation."
  ];

  let profile = readStore("cf_student_profile", { name: "Student" });
  let notes = readStore("cf_assignment_notes", {});
  let earned = readStore("cf_earned_tasks", []).map(String);
  let studyDates = readStore("cf_study_dates", []);

  const getTodayKey = () => {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  };

  const getTask = row => {
    const title = row.querySelector(".task-title")?.textContent;
    return tasks.find(task => task.title === title);
  };

  const panel = document.createElement("section");
  panel.id = "cfPlusPanel";
  panel.className = "cf-plus-panel";
  panel.innerHTML = `
    <div class="cf-profile-card">
      <div>
        <p class="cf-plus-eyebrow">YOUR STUDY SPACE</p>
        <h2 id="cfWelcome"></h2>
        <p>Small steps every day lead to big results.</p>
      </div>
      <button id="cfEditProfile" type="button" class="cf-plus-button">Edit profile</button>
      <div class="cf-profile-stats">
        <div><strong id="cfXP">0</strong><span>Total XP</span></div>
        <div><strong id="cfStreak">0</strong><span>Day streak 🔥</span></div>
        <div><strong id="cfBadges">0</strong><span>Badges 🏅</span></div>
      </div>
    </div>

    <div class="cf-plus-card">
      <h3>📊 Subject-wise Analytics</h3>
      <p class="cf-plus-muted">Your assignment progress by subject</p>
      <div id="cfSubjectChart"></div>
    </div>

    <div class="cf-plus-card">
      <h3>🔎 Advanced Filters</h3>
      <div class="cf-filter-grid">
        <select id="cfFilterSubject" aria-label="Filter by subject">
          <option value="all">All subjects</option>
        </select>
        <select id="cfFilterPriority" aria-label="Filter by priority">
          <option value="all">All priorities</option>
          <option value="high">High priority</option>
          <option value="medium">Medium priority</option>
          <option value="low">Low priority</option>
        </select>
        <select id="cfFilterStatus" aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>
      <button id="cfResetFilters" type="button" class="cf-plus-button">Reset filters</button>
    </div>

    <div class="cf-plus-card">
      <h3>🤖 Smart Study Suggestions</h3>
      <div id="cfAISuggestions"></div>
    </div>

    <div class="cf-plus-card">
      <h3>📈 Weekly Report</h3>
      <div id="cfWeeklyReport"></div>
    </div>

    <div class="cf-plus-card">
      <h3>📅 Upcoming Timeline</h3>
      <div id="cfTimeline"></div>
    </div>

    <div class="cf-plus-card">
      <h3>💜 Daily Motivation</h3>
      <p id="cfQuote"></p>
    </div>
  `;

  taskList.parentElement.insertBefore(panel, taskList);
  $("cfQuote").textContent = quotes[Math.floor(Math.random() * quotes.length)];

  $("cfEditProfile").addEventListener("click", () => {
    const name = prompt("What should CampusFlow call you?", profile.name || "Student");
    if (name === null || !name.trim()) return;
    profile.name = name.trim();
    saveStore("cf_student_profile", profile);
    updatePlusDashboard();
  });

  function updatePlusSubjectOptions() {
    const select = $("cfFilterSubject");
    const previous = select.value;
    const subjects = [...new Set(tasks.map(task => task.subject).filter(Boolean))].sort();

    select.replaceChildren(new Option("All subjects", "all"));
    subjects.forEach(subject => select.add(new Option(subject, subject)));
    select.value = subjects.includes(previous) ? previous : "all";
  }

  function applyPlusFilters() {
    const subject = $("cfFilterSubject").value;
    const priority = $("cfFilterPriority").value;
    const status = $("cfFilterStatus").value;

    [...taskList.children].forEach(row => {
      const task = getTask(row);
      if (!task) return;

      const matchesSubject = subject === "all" || task.subject === subject;
      const matchesPriority = priority === "all" ||
        String(task.priority).toLowerCase() === priority;
      const overdue = !task.done && daysUntil(task.due) < 0;
      const matchesStatus = status === "all" ||
        (status === "completed" && task.done) ||
        (status === "pending" && !task.done && !overdue) ||
        (status === "overdue" && overdue);

      row.style.display = matchesSubject && matchesPriority && matchesStatus ? "" : "none";
    });
  }

  ["cfFilterSubject", "cfFilterPriority", "cfFilterStatus"].forEach(id => {
    $(id).addEventListener("change", applyPlusFilters);
  });

  $("cfResetFilters").addEventListener("click", () => {
    $("cfFilterSubject").value = "all";
    $("cfFilterPriority").value = "all";
    $("cfFilterStatus").value = "all";
    applyPlusFilters();
  });

  function addNotesButtons() {
    [...taskList.children].forEach(row => {
      const task = getTask(row);
      if (!task || row.querySelector(".cf-notes-button")) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "cf-notes-button";
      button.textContent = "📝 Notes";
      button.addEventListener("click", () => {
        const old = notes[task.id] || { text: "", url: "" };
        const text = prompt("Assignment notes (leave blank to clear):", old.text || "");
        if (text === null) return;
        const url = prompt("Resource URL (optional):", old.url || "");
        if (url === null) return;

        notes[task.id] = { text: text.trim(), url: url.trim() };
        saveStore("cf_assignment_notes", notes);
        button.textContent = text.trim() || url.trim() ? "📝 Saved" : "📝 Notes";

        if (!text.trim() && !url.trim()) {
          delete notes[task.id];
          saveStore("cf_assignment_notes", notes);
          showToast("Assignment notes cleared.");
          return;
        }

        if (url.trim()) {
          try {
            const parsed = new URL(url.trim());
            if (!["http:", "https:"].includes(parsed.protocol)) {
              showToast("Notes saved. Resource links must start with http:// or https://.");
              return;
            }
          } catch {
            showToast("Notes saved, but the resource URL is not valid.");
            return;
          }
        }
        showToast("Assignment notes saved!");
      });

      row.appendChild(button);
      if (notes[task.id] && (notes[task.id].text || notes[task.id].url)) {
        button.textContent = "📝 Saved";
      }
    });
  }

  function recordCompletions() {
    tasks.forEach(task => {
      if (task.done && !earned.includes(String(task.id))) {
        earned.push(String(task.id));
      }
    });
    saveStore("cf_earned_tasks", earned);
  }

  function calculateStreak() {
    const dates = new Set(studyDates);
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    if (!dates.has(getTodayKey())) date.setDate(date.getDate() - 1);

    let count = 0;
    while (true) {
      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
      ].join("-");
      if (!dates.has(key)) break;
      count++;
      date.setDate(date.getDate() - 1);
    }
    return count;
  }

  function updateWeeklyReport() {
    const completed = tasks.filter(task => task.done).length;
    const pending = tasks.filter(task => !task.done).length;
    const rate = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
    let grade = "D";
    if (rate >= 90) grade = "A+";
    else if (rate >= 75) grade = "A";
    else if (rate >= 60) grade = "B";
    else if (rate >= 40) grade = "C";

    const box = $("cfWeeklyReport");
    box.replaceChildren();
    const gradeElement = document.createElement("div");
    gradeElement.className = "cf-grade";
    gradeElement.textContent = grade;
    const completedElement = document.createElement("p");
    completedElement.textContent = `${completed} completed`;
    const pendingElement = document.createElement("p");
    pendingElement.textContent = `${pending} pending`;
    const rateElement = document.createElement("p");
    rateElement.textContent = `Overall completion: ${rate}%`;
    box.append(gradeElement, completedElement, pendingElement, rateElement);
  }

  function updateTimeline() {
    const box = $("cfTimeline");
    box.replaceChildren();
    const upcoming = tasks.filter(task => !task.done)
      .sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);

    if (!upcoming.length) {
      box.textContent = "🎉 No pending assignments!";
      return;
    }

    upcoming.forEach(task => {
      const item = document.createElement("div");
      item.className = "cf-timeline-item";
      const dot = document.createElement("div");
      dot.className = "dot";
      const content = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = task.title;
      const details = document.createElement("p");
      details.textContent = `${task.subject} • ${formatDate(task.due)}`;
      content.append(title, details);
      item.append(dot, content);
      box.appendChild(item);
    });
  }

  function updateSuggestions() {
    const box = $("cfAISuggestions");
    box.replaceChildren();
    const pending = tasks.filter(task => !task.done)
      .sort((a, b) => a.due.localeCompare(b.due));

    if (!pending.length) {
      box.textContent = "🎉 Amazing! All assignments are completed.";
      return;
    }

    const nearest = pending[0];
    const highPriority = pending.find(task => task.priority === "High");
    const tips = [
      ["Today's Priority", `Work on ${nearest.title} (${nearest.subject}), due ${formatDate(nearest.due)}.`],
      ["Remaining Tasks", `You have ${pending.length} assignment${pending.length === 1 ? "" : "s"} left.`],
      ["Productivity Tip", highPriority
        ? `Try finishing the high-priority task: ${highPriority.title}.`
        : "Break your next assignment into small, manageable steps."]
    ];

    tips.forEach(([headingText, message]) => {
      const tip = document.createElement("div");
      tip.className = "cf-tip";
      const heading = document.createElement("strong");
      heading.textContent = headingText;
      const paragraph = document.createElement("p");
      paragraph.textContent = message;
      tip.append(heading, paragraph);
      box.appendChild(tip);
    });
  }

  function updatePlusDashboard() {
    recordCompletions();
    $("cfWelcome").textContent = `Hey, ${profile.name || "Student"} 👋`;

    const xp = earned.length * 25;
    const streak = calculateStreak();
    const completed = tasks.filter(task => task.done).length;
    const badgeCount = [
      completed >= 1, completed >= 5, completed >= 10,
      streak >= 3, streak >= 7, xp >= 500
    ].filter(Boolean).length;

    $("cfXP").textContent = xp;
    $("cfStreak").textContent = streak;
    $("cfBadges").textContent = badgeCount;

    const chart = $("cfSubjectChart");
    chart.replaceChildren();
    const groups = {};
    tasks.forEach(task => {
      const subject = task.subject || "Other";
      if (!groups[subject]) groups[subject] = { total: 0, completed: 0 };
      groups[subject].total++;
      if (task.done) groups[subject].completed++;
    });

    Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).forEach(([subject, data]) => {
      const percent = Math.round(data.completed / data.total * 100);
      const item = document.createElement("div");
      item.className = "cf-subject-row";
      const heading = document.createElement("div");
      heading.className = "cf-subject-heading";
      const name = document.createElement("span");
      name.textContent = subject;
      const count = document.createElement("span");
      count.textContent = `${data.completed}/${data.total} · ${percent}%`;
      heading.append(name, count);
      const track = document.createElement("div");
      track.className = "cf-chart-track";
      const bar = document.createElement("div");
      bar.className = "cf-chart-bar";
      bar.style.width = `${percent}%`;
      track.appendChild(bar);
      item.append(heading, track);
      chart.appendChild(item);
    });

    if (!Object.keys(groups).length) {
      chart.textContent = "Add assignments to see your subject analytics.";
    }

    updatePlusSubjectOptions();
    applyPlusFilters();
    addNotesButtons();
    updateWeeklyReport();
    updateTimeline();
    updateSuggestions();
  }

  // Record study activity before the main checkbox handler redraws the task list.
  taskList.addEventListener("change", event => {
    if (!event.target.matches('input[type="checkbox"]') || !event.target.checked) return;
    const row = event.target.closest(".task");
    const task = row ? getTask(row) : null;
    if (task) {
      const id = String(task.id);
      if (!earned.includes(id)) earned.push(id);
      const todayKey = getTodayKey();
      if (!studyDates.includes(todayKey)) studyDates.push(todayKey);
      saveStore("cf_earned_tasks", earned);
      saveStore("cf_study_dates", studyDates);
    }
    setTimeout(updatePlusDashboard, 0);
  }, true);

  const observer = new MutationObserver(() => {
    addNotesButtons();
    applyPlusFilters();
    updatePlusDashboard();
  });
  observer.observe(taskList, { childList: true, subtree: true });

  updatePlusDashboard();
}

// ===== START CAMPUSFLOW =====

setupAdvancedUI();
setupProductivityHub();
setupTaskTools();
setupCampusFlowPlus();
render();

// Confetti animation helper
function launchConfetti() {
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = `hsl(${Math.random() * 360}, 80%, 65%)`;
    piece.style.animationDelay = Math.random() + "s";
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2500);
  }
}

/* ===== CAMPUSFLOW SIGNATURE EXPERIENCE =====
   Add-on layer: premium daily briefing, mood check-in, weekly challenge,
   focus mode, rotating study prompts and keyboard shortcuts.
   Works with the existing CampusFlow script and does not replace task logic.
*/
(function setupCampusFlowSignature() {
  if (window.__campusFlowSignatureLoaded) return;
  window.__campusFlowSignatureLoaded = true;

  const cfTodayKey = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  };
  const cfSafeGet = (key, fallback = "") => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) { return fallback; }
  };
  const cfSafeSet = (key, value) => {
    try { localStorage.setItem(key, String(value)); } catch (_) { /* storage may be blocked */ }
  };
  const cfEsc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  const quotes = [
    { quote: "Small progress is still progress.", author: "Your CampusFlow reminder" },
    { quote: "Start where you are. Use what you have. Do what you can.", author: "A little nudge for today" },
    { quote: "You do not need a perfect plan. You need a first step.", author: "Your CampusFlow reminder" },
    { quote: "Focus on the next 25 minutes, not the whole semester.", author: "Focus, one session at a time" },
    { quote: "Consistency beats last-minute panic.", author: "Your CampusFlow reminder" },
    { quote: "Your effort counts, even before the result shows.", author: "A note to yourself" }
  ];
  const moods = [
    { value: "energized", emoji: "⚡", label: "Energized" },
    { value: "okay", emoji: "🌤️", label: "Doing okay" },
    { value: "tired", emoji: "🌿", label: "Need a gentle day" }
  ];

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 21) return "Good evening";
    return "Still here? Take it one step at a time";
  }

  function getDailyBrief() {
    const list = Array.isArray(window.tasks) ? window.tasks : (typeof tasks !== "undefined" && Array.isArray(tasks) ? tasks : []);
    const pending = list.filter(task => !task.done);
    const overdue = pending.filter(task => task.due && new Date(task.due + "T00:00:00") < new Date(new Date().toDateString()));
    const dueToday = pending.filter(task => task.due === cfTodayKey());
    const urgent = pending.filter(task => task.priority === "High").sort((a, b) => String(a.due).localeCompare(String(b.due)))[0];
    if (overdue.length) return { icon: "⏳", title: `${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"}`, text: "Clear one overdue item first. A small win will make the rest feel lighter." };
    if (dueToday.length) return { icon: "📌", title: `${dueToday.length} due today`, text: "Keep today simple: finish the nearest deadline before starting something new." };
    if (urgent) return { icon: "✨", title: "Your next best move", text: `Start with “${urgent.title}”${urgent.subject ? ` for ${urgent.subject}` : ""}. It is marked high priority.` };
    if (pending.length) return { icon: "🌱", title: "Build a little momentum", text: `You have ${pending.length} task${pending.length === 1 ? "" : "s"} left. Pick one and give it 25 focused minutes.` };
    return { icon: "🏆", title: "Everything is clear", text: "Your task list is complete. Take a break or add your next assignment when ready." };
  }

  function renderSignature() {
    const root = document.getElementById("cfSignature");
    if (!root) return;
    const list = (typeof tasks !== "undefined" && Array.isArray(tasks)) ? tasks : [];
    const total = list.length;
    const completed = list.filter(task => task.done).length;
    const pending = total - completed;
    const percent = total ? Math.round(completed / total * 100) : 0;
    const goal = Math.max(1, Number(cfSafeGet("cf_signature_week_goal", "5")) || 5);
    const weekDone = Number(cfSafeGet("cf_signature_week_done", "0")) || 0;
    const dailyMood = cfSafeGet("cf_signature_mood_" + cfTodayKey(), "");
    const intention = cfSafeGet("cf_signature_intention_" + cfTodayKey(), "");
    const brief = getDailyBrief();
    const quoteIndex = Number(cfSafeGet("cf_signature_quote", "0")) % quotes.length;
    const quote = quotes[quoteIndex];
    const moodMarkup = moods.map(mood => `
      <button type="button" class="cf-signature-mood ${dailyMood === mood.value ? "is-selected" : ""}" data-cf-mood="${mood.value}" aria-pressed="${dailyMood === mood.value}">
        <span>${mood.emoji}</span><small>${mood.label}</small>
      </button>`).join("");

    root.innerHTML = `
      <section class="cf-signature-hero">
        <div class="cf-signature-orb cf-signature-orb-one"></div><div class="cf-signature-orb cf-signature-orb-two"></div>
        <div class="cf-signature-hero-copy">
          <p class="cf-signature-kicker">YOUR PERSONAL STUDY SPACE</p>
          <h2>${cfEsc(getGreeting())} <span class="cf-signature-sparkle">✦</span></h2>
          <p class="cf-signature-lead">Make room for progress, not pressure.</p>
          <div class="cf-signature-actions">
            <button type="button" class="cf-signature-main-btn" data-cf-action="add">＋ Add assignment</button>
            <button type="button" class="cf-signature-glass-btn" data-cf-action="focus">◉ ${document.body.classList.contains("cf-focus-mode") ? "Exit focus mode" : "Focus mode"}</button>
          </div>
        </div>
        <div class="cf-signature-progress" aria-label="${percent}% assignments completed">
          <div class="cf-signature-ring" style="--cf-progress:${percent * 3.6}deg"><div><strong>${percent}%</strong><span>completed</span></div></div>
          <p><strong>${completed}</strong> of ${total} assignments done</p>
        </div>
      </section>

      <div class="cf-signature-grid">
        <article class="cf-signature-card cf-signature-brief-card">
          <div class="cf-signature-card-top"><span class="cf-signature-icon">${brief.icon}</span><span class="cf-signature-label">SMART BRIEF</span></div>
          <h3>${cfEsc(brief.title)}</h3><p>${cfEsc(brief.text)}</p>
          <button type="button" class="cf-signature-text-btn" data-cf-action="next">Show my tasks <span>↗</span></button>
        </article>
        <article class="cf-signature-card cf-signature-quote-card">
          <div class="cf-signature-card-top"><span class="cf-signature-icon">✧</span><span class="cf-signature-label">A NOTE FOR YOU</span></div>
          <blockquote>“${cfEsc(quote.quote)}”</blockquote><p class="cf-signature-quote-author">${cfEsc(quote.author)}</p>
          <button type="button" class="cf-signature-text-btn" data-cf-action="quote">Another little reminder ↻</button>
        </article>
        <article class="cf-signature-card cf-signature-checkin-card">
          <div class="cf-signature-card-top"><span class="cf-signature-icon">☁</span><span class="cf-signature-label">DAILY CHECK-IN</span></div>
          <h3>How's your energy today?</h3><p>No pressure. Choose the pace that feels right.</p>
          <div class="cf-signature-moods">${moodMarkup}</div>
          <label class="cf-signature-intention-label" for="cfSignatureIntention">Today's tiny intention</label>
          <div class="cf-signature-intention-row"><input id="cfSignatureIntention" maxlength="90" placeholder="e.g. Revise Java for 20 minutes" value="${cfEsc(intention)}"><button type="button" data-cf-action="save-intention" aria-label="Save intention">Save</button></div>
          <p class="cf-signature-saved" id="cfSignatureSaved" aria-live="polite">${intention ? "Your intention is saved for today ✨" : "One small promise to yourself is enough."}</p>
        </article>
        <article class="cf-signature-card cf-signature-challenge-card">
          <div class="cf-signature-card-top"><span class="cf-signature-icon">♧</span><span class="cf-signature-label">WEEKLY CHALLENGE</span></div>
          <h3>Collect small wins</h3><p>Complete assignments to build your weekly momentum.</p>
          <div class="cf-signature-challenge-numbers"><strong>${Math.min(weekDone, goal)}<span> / ${goal}</span></strong><span>weekly wins</span></div>
          <div class="cf-signature-track"><span style="width:${Math.min(100, Math.round(weekDone / goal * 100))}%"></span></div>
          <div class="cf-signature-goal-row"><label for="cfSignatureGoal">Set your goal</label><select id="cfSignatureGoal"><option value="3" ${goal === 3 ? "selected" : ""}>3 wins</option><option value="5" ${goal === 5 ? "selected" : ""}>5 wins</option><option value="7" ${goal === 7 ? "selected" : ""}>7 wins</option><option value="10" ${goal === 10 ? "selected" : ""}>10 wins</option></select></div>
          <p class="cf-signature-saved">${weekDone >= goal ? "Challenge complete — celebrate that! 🎉" : `${goal - Math.min(weekDone, goal)} more to reach your goal.`}</p>
        </article>
      </div>
      <div class="cf-signature-footnote"><span>✦</span> Your progress is saved in this browser. <span class="cf-signature-shortcuts">Shortcuts: <kbd>/</kbd> search · <kbd>N</kbd> new task · <kbd>D</kbd> theme</span></div>
    `;
  }

  function setMood(value) {
    const key = "cf_signature_mood_" + cfTodayKey();
    cfSafeSet(key, value);
    renderSignature();
    if (typeof showToast === "function") showToast("Check-in saved. Be kind to yourself today 💜");
  }

  function handleAction(action) {
    if (action === "add") {
      const addButton = document.getElementById("openAdd");
      if (addButton) addButton.click();
      else if (typeof openModal === "function") openModal();
    } else if (action === "focus") {
      document.body.classList.toggle("cf-focus-mode");
      renderSignature();
      if (typeof showToast === "function") showToast(document.body.classList.contains("cf-focus-mode") ? "Focus mode on — one thing at a time ✨" : "Focus mode off");
    } else if (action === "quote") {
      cfSafeSet("cf_signature_quote", (Number(cfSafeGet("cf_signature_quote", "0")) + 1) % quotes.length);
      renderSignature();
    } else if (action === "next") {
      const list = document.getElementById("taskList");
      const panel = document.querySelector(".panel");
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      const pendingHigh = (typeof tasks !== "undefined" ? tasks : []).find(task => !task.done && task.priority === "High");
      if (pendingHigh && typeof showToast === "function") showToast("Next up: " + pendingHigh.title);
      if (list) list.classList.add("cf-signature-task-highlight");
      setTimeout(() => list && list.classList.remove("cf-signature-task-highlight"), 1400);
    } else if (action === "save-intention") {
      const input = document.getElementById("cfSignatureIntention");
      const value = input ? input.value.trim() : "";
      cfSafeSet("cf_signature_intention_" + cfTodayKey(), value);
      const saved = document.getElementById("cfSignatureSaved");
      if (saved) saved.textContent = value ? "Your intention is saved for today ✨" : "Add a tiny intention whenever you're ready.";
      if (typeof showToast === "function") showToast(value ? "Today's intention saved ✨" : "Intention cleared");
    }
  }

  function mount() {
    if (document.getElementById("cfSignature")) return;
    const welcome = document.querySelector("main .welcome");
    if (!welcome) return;
    const root = document.createElement("section");
    root.id = "cfSignature";
    root.className = "cf-signature";
    welcome.insertAdjacentElement("afterend", root);
    renderSignature();

    root.addEventListener("click", event => {
      const moodButton = event.target.closest("[data-cf-mood]");
      if (moodButton) { setMood(moodButton.dataset.cfMood); return; }
      const actionButton = event.target.closest("[data-cf-action]");
      if (actionButton) handleAction(actionButton.dataset.cfAction);
    });
    root.addEventListener("change", event => {
      if (event.target.id === "cfSignatureGoal") {
        cfSafeSet("cf_signature_week_goal", event.target.value);
        renderSignature();
        if (typeof showToast === "function") showToast("Weekly goal updated");
      }
    });
  }

  // Track completion changes for the weekly challenge, without double-counting.
  function watchTaskChanges() {
    const list = document.getElementById("taskList");
    if (!list || list.dataset.cfSignatureWatching) return;
    list.dataset.cfSignatureWatching = "true";
    // Capture the change before the main task handler redraws/removes the row.
    // Without capture=true, the checkbox can be detached before this listener runs.
    list.addEventListener("change", event => {
      if (!event.target.matches('input[type="checkbox"]')) return;
      const row = event.target.closest(".task");
      if (!row) return;
      const key = "cf_signature_counted_" + cfTodayKey();
      const id = row.dataset.taskId || row.getAttribute("data-id") || ((row.querySelector(".task-title")?.textContent || "task") + "|" + (row.querySelector(".task-meta")?.textContent || ""));
      if (event.target.checked) {
        const counted = (() => { try { return JSON.parse(cfSafeGet(key, "[]")); } catch (_) { return []; } })();
        if (!counted.includes(id)) {
          counted.push(id);
          cfSafeSet(key, JSON.stringify(counted));
          cfSafeSet("cf_signature_week_done", (Number(cfSafeGet("cf_signature_week_done", "0")) || 0) + 1);
        }
      }
      setTimeout(renderSignature, 80);
    }, true);
  }

  document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target && (target.matches("input, textarea, select") || target.isContentEditable)) return;
    if (event.key === "/") {
      event.preventDefault();
      const search = document.getElementById("search");
      if (search) search.focus();
    } else if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      handleAction("add");
    } else if (event.key.toLowerCase() === "d") {
      const theme = document.getElementById("themeToggle");
      if (theme) theme.click();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { mount(); watchTaskChanges(); });
  } else {
    mount();
    watchTaskChanges();
  }
  // Refresh summary when the main task renderer updates the list.
  const taskList = document.getElementById("taskList");
  if (taskList && "MutationObserver" in window) {
    new MutationObserver(() => renderSignature()).observe(taskList, { childList: true, subtree: true });
  }
  // Keep the greeting fresh if the page stays open across the day.
  renderSignature();
})();
