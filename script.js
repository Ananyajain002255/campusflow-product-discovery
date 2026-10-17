
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
      localStorage.setItem("campusflow_theme", dark ? "dark" : "light");
      button.textContent = dark ? "☀️ Light mode" : "🌙 Dark mode";
      showToast(dark ? "Dark mode enabled" : "Light mode enabled");
    });
  }

  const darkSaved = localStorage.getItem("campusflow_theme") === "dark";
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

    const aiCard = document.createElement("div");
aiCard.className = "cf-plus-card";
aiCard.innerHTML = `
<h3>🤖 Smart Study Suggestions</h3>
<div id="cfAISuggestions"></div>
`;

panel.appendChild(aiCard);
    
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

  const report=document.createElement("div");

report.className="cf-plus-card";

report.innerHTML=`
<h3>📈 Weekly Report</h3>
<div id="cfWeeklyReport"></div>
`;

panel.appendChild(report);
  const timeline=document.createElement("div");

timeline.className="cf-plus-card";

timeline.innerHTML=`
<h3>📅 Upcoming Timeline</h3>
<div id="cfTimeline"></div>
`;

panel.appendChild(timeline);
  const taskList = document.getElementById("taskList");
  if (!taskList || document.getElementById("cfPlusPanel")) return;

  const readStore = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const quotes = [
"Small progress is still progress.",
"One assignment at a time.",
"Success comes from consistency.",
"Your future self will thank you.",
"Discipline beats motivation."
];

const quoteCard = document.createElement("div");
quoteCard.className="cf-plus-card";

quoteCard.innerHTML=`
<h3>💜 Daily Motivation</h3>
<p id="cfQuote"></p>
`;

panel.appendChild(quoteCard);

document.getElementById("cfQuote").textContent =
quotes[Math.floor(Math.random()*quotes.length)];
  

  const saveStore = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  let profile = readStore("cf_student_profile", { name: "Student" });
  let notes = readStore("cf_assignment_notes", {});
  let earned = readStore("cf_earned_tasks", []);
  let studyDates = readStore("cf_study_dates", []);

  const today = () => new Date().toLocaleDateString("en-CA");
  const getTask = (row) =>
    tasks.find(t => row.innerText.includes(t.title));

  const panel = document.createElement("section");
  panel.id = "cfPlusPanel";
  panel.className = "cf-plus-panel";

  panel.innerHTML = `
    <div class="cf-profile-card">
      <div>
        <p class="cf-plus-eyebrow">YOUR STUDY SPACE</p>
        <h2 id="cfWelcome">Hey, ${profile.name} 👋</h2>
        <p>Small steps every day lead to big results.</p>
      </div>
      <button id="cfEditProfile" class="cf-plus-button">Edit profile</button>
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
        <select id="cfFilterSubject">
          <option value="all">All subjects</option>
        </select>
        <select id="cfFilterPriority">
          <option value="all">All priorities</option>
          <option value="high">High priority</option>
          <option value="medium">Medium priority</option>
          <option value="low">Low priority</option>
        </select>
        <select id="cfFilterStatus">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>
      <button id="cfResetFilters" class="cf-plus-button">Reset filters</button>
    </div>
  `;

  taskList.parentElement.insertBefore(panel, taskList);

  // Personalized student profile
  document.getElementById("cfEditProfile").addEventListener("click", () => {
    const name = prompt("What should CampusFlow call you?", profile.name);
    if (name && name.trim()) {
      profile.name = name.trim();
      saveStore("cf_student_profile", profile);
      updatePlusDashboard();
    }
  });

  const suggestionBox = document.getElementById("cfAISuggestions");
if (suggestionBox) {
  suggestionBox.innerHTML = "";

  const pending = tasks.filter(t => !t.done);

  if (!pending.length) {
    suggestionBox.innerHTML =
      "<p>🎉 Amazing! All assignments are completed.</p>";
  } else {
    const nearest = [...pending].sort((a,b)=>a.due.localeCompare(b.due))[0];

    suggestionBox.innerHTML = `
      <div class="cf-tip">
        <strong>Today's Priority</strong>
        <p>Complete <b>${nearest.title}</b> (${nearest.subject}).</p>
      </div>

      <div class="cf-tip">
        <strong>Remaining Tasks</strong>
        <p>You have <b>${pending.length}</b> assignments left.</p>
      </div>

      <div class="cf-tip">
        <strong>Productivity Tip</strong>
        <p>Finish one high-priority task before starting a new one.</p>
      </div>
    `;
  }
}

  // Populate subject filter
  function updateSubjectOptions() {
    const select = document.getElementById("cfFilterSubject");
    const previous = select.value;
    const subjects = [...new Set(tasks.map(t => t.subject).filter(Boolean))];

    select.innerHTML = '<option value="all">All subjects</option>';
    subjects.forEach(subject => {
      const option = document.createElement("option");
      option.value = subject;
      option.textContent = subject;
      select.appendChild(option);
    });

    select.value = subjects.includes(previous) ? previous : "all";
  }

  // Advanced filtering
  function applyPlusFilters() {
    const subject = document.getElementById("cfFilterSubject").value;
    const priority = document.getElementById("cfFilterPriority").value;
    const status = document.getElementById("cfFilterStatus").value;

    [...taskList.children].forEach(row => {
      const task = getTask(row);
      if (!task) return;

      const matchesSubject = subject === "all" || task.subject === subject;
      const matchesPriority = priority === "all" ||
        String(task.priority).toLowerCase() === priority;

      const isOverdue = !task.done && task.due &&
        new Date(task.due + "T23:59:59") < new Date();

      const matchesStatus = status === "all" ||
        (status === "completed" && task.done) ||
        (status === "pending" && !task.done && !isOverdue) ||
        (status === "overdue" && isOverdue);

      row.style.display =
        matchesSubject && matchesPriority && matchesStatus ? "" : "none";
    });
  }

  ["cfFilterSubject", "cfFilterPriority", "cfFilterStatus"].forEach(id => {
    document.getElementById(id).addEventListener("change", applyPlusFilters);
  });

  document.getElementById("cfResetFilters").addEventListener("click", () => {
    document.getElementById("cfFilterSubject").value = "all";
    document.getElementById("cfFilterPriority").value = "all";
    document.getElementById("cfFilterStatus").value = "all";
    applyPlusFilters();
  });

  // Notes and resource links for each assignment
  function addNotesButtons() {
    [...taskList.children].forEach(row => {
      const task = getTask(row);
      if (!task || row.querySelector(".cf-notes-button")) return;

      const button = document.createElement("button");
      button.className = "cf-notes-button";
      button.textContent = "📝 Notes";
      button.type = "button";

      button.addEventListener("click", () => {
        const old = notes[task.id] || { text: "", url: "" };
        const text = prompt("Add assignment notes:", old.text);
        if (text === null) return;

        const url = prompt("Add a resource URL (optional):", old.url);
        if (url === null) return;

        notes[task.id] = { text, url };
        saveStore("cf_assignment_notes", notes);

        button.textContent = text || url ? "📝 Saved" : "📝 Notes";

        if (url.trim()) {
          try {
            const parsed = new URL(url);
            if (parsed.protocol === "https:" || parsed.protocol === "http:") {
              showToast("Notes saved! Open the Notes button to view your link.");
            } else {
              showToast("Notes saved. Use an http or https link for resources.");
            }
          } catch {
            showToast("Notes saved. The resource URL doesn't look valid yet.");
          }
        } else {
          showToast("Assignment notes saved!");
        }
      });

      row.appendChild(button);

      if (notes[task.id] &&
          (notes[task.id].text || notes[task.id].url)) {
        button.textContent = "📝 Saved";
      }
    });
  }

  // XP and study streaks
  function recordCompletions() {
    tasks.forEach(task => {
      if (task.done && !earned.includes(String(task.id))) {
        earned.push(String(task.id));
      }
    });
    saveStore("cf_earned_tasks", earned);
  }

  // Capture completion before the existing checkbox handler rerenders tasks
  taskList.addEventListener("change", event => {
    if (!event.target.matches('input[type="checkbox"]')) return;

    const row = event.target.closest("*");
    const taskRow = event.target.parentElement;
    const task = getTask(taskRow) || getTask(row);

    if (event.target.checked) {
      const completedTask = task || tasks.find(t =>
        [...taskList.children].some(r =>
          r.innerText.includes(t.title) && r.contains(event.target)
        )
      );

      if (completedTask) {
        const id = String(completedTask.id);
        if (!earned.includes(id)) earned.push(id);
        if (!studyDates.includes(today())) studyDates.push(today());

        saveStore("cf_earned_tasks", earned);
        saveStore("cf_study_dates", studyDates);
      }
    }

    setTimeout(updatePlusDashboard, 0);
  }, true);

  function calculateStreak() {
    const dates = new Set(studyDates);
    let count = 0;
    const date = new Date();

    // A streak can continue if the student last studied yesterday.
    if (!dates.has(today())) date.setDate(date.getDate() - 1);

    while (dates.has(date.toLocaleDateString("en-CA"))) {
      count++;
      date.setDate(date.getDate() - 1);
    }
    return count;
  }

  function updatePlusDashboard() {
    recordCompletions();

    document.getElementById("cfWelcome").textContent =
      `Hey, ${profile.name} 👋`;

    const xp = earned.length * 25;
    const streak = calculateStreak();
    const completed = tasks.filter(t => t.done).length;

    const badgeCount = [
      completed >= 1,
      completed >= 5,
      completed >= 10,
      streak >= 3,
      streak >= 7,
      xp >= 500
    ].filter(Boolean).length;

    document.getElementById("cfXP").textContent = xp;
    document.getElementById("cfStreak").textContent = streak;
    document.getElementById("cfBadges").textContent = badgeCount;

    const chart = document.getElementById("cfSubjectChart");
    const groups = {};

    tasks.forEach(task => {
      const subject = task.subject || "Other";
      if (!groups[subject]) groups[subject] = { total: 0, completed: 0 };
      groups[subject].total++;
      if (task.done) groups[subject].completed++;
    });

    chart.innerHTML = "";

    Object.entries(groups).forEach(([subject, data]) => {
      const percent = data.total
        ? Math.round(data.completed / data.total * 100) : 0;

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
      bar.style.width = percent + "%";

      track.appendChild(bar);
      item.append(heading, track);
      chart.appendChild(item);
    });

    if (!Object.keys(groups).length) {
      chart.textContent = "Add assignments to see your subject analytics.";
    }

    updateSubjectOptions();
    applyPlusFilters();
    addNotesButtons();
  }

  // Watch the existing renderer when it refreshes the assignment list
  const observer = new MutationObserver(() => {
    addNotesButtons();
    applyPlusFilters();
  });

  observer.observe(taskList, { childList: true, subtree: true });

  updatePlusDashboard();
}

const reportBox=document.getElementById("cfWeeklyReport");

if(reportBox){

const completed=tasks.filter(t=>t.done).length;
const pending=tasks.filter(t=>!t.done).length;

const rate=tasks.length
?Math.round(completed/tasks.length*100)
:0;

let grade="D";

if(rate>=90) grade="A+";
else if(rate>=75) grade="A";
else if(rate>=60) grade="B";
else if(rate>=40) grade="C";

reportBox.innerHTML=`
<div class="cf-grade">${grade}</div>
<p><b>${completed}</b> completed</p>
<p><b>${pending}</b> pending</p>
<p>Completion: <b>${rate}%</b></p>`;
}

const timelineBox=document.getElementById("cfTimeline");

if(timelineBox){

timelineBox.innerHTML="";

tasks
.filter(t=>!t.done)
.sort((a,b)=>a.due.localeCompare(b.due))
.slice(0,5)
.forEach(task=>{

timelineBox.innerHTML+=`
<div class="cf-timeline-item">
<div class="dot"></div>
<div>
<strong>${task.title}</strong>
<p>${task.subject} • ${task.due}</p>
</div>
</div>`;
});
}

setupAdvancedUI();
setupProductivityHub();
setupTaskTools();
setupCampusFlowPlus();
render();

// Confetti animation
function launchConfetti() {
    for (let i = 0; i < 30; i++) {
        const piece = document.createElement("div");

        piece.className = "confetti";
        piece.style.left = Math.random() * 100 + "vw";
        piece.style.background = `hsl(${Math.random() * 360},80%,65%)`;
        piece.style.animationDelay = Math.random() + "s";

        document.body.appendChild(piece);

        setTimeout(() => piece.remove(), 2500);
    }
}
