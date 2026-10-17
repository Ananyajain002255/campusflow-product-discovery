
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
      render();
      showToast(task.done ? "Assignment completed! 🎉" : "Assignment marked pending");
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

    row.append(checkbox, info, priority, due);
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

setupAdvancedUI();
render();
