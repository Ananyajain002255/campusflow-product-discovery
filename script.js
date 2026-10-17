
const today = new Date();
today.setHours(0, 0, 0, 0);

function dateOffset(days) {
  const date = new Date(today);
  date.setDate(date.getDate() + days);

  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
}

const starterTasks = [
  {
    id: 1,
    title: "DBMS lab assignment",
    subject: "DBMS",
    due: dateOffset(1),
    priority: "High",
    done: false
  },
  {
    id: 2,
    title: "Java OOP practice",
    subject: "Java",
    due: dateOffset(2),
    priority: "Medium",
    done: false
  },
  {
    id: 3,
    title: "AI case study report",
    subject: "Artificial Intelligence",
    due: dateOffset(4),
    priority: "High",
    done: false
  },
  {
    id: 4,
    title: "Data Structures questions",
    subject: "DSA",
    due: dateOffset(6),
    priority: "Low",
    done: true
  }
];

let tasks = [];

try {
  const saved = localStorage.getItem("campusflow_tasks");
  tasks = saved ? JSON.parse(saved) : starterTasks;

  if (!Array.isArray(tasks)) tasks = starterTasks;
} catch (error) {
  tasks = starterTasks;
}

let currentFilter = "all";

const $ = id => document.getElementById(id);

function saveTasks() {
  try {
    localStorage.setItem("campusflow_tasks", JSON.stringify(tasks));
  } catch (error) {
    console.warn("Local storage is unavailable.");
  }
}

function daysUntil(dateString) {
  const date = new Date(dateString + "T00:00:00");
  return Math.round((date - today) / 86400000);
}

function formatDate(dateString) {
  return new Date(dateString + "T00:00:00").toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "short", year: "numeric" }
  );
}

function isDueSoon(task) {
  const days = daysUntil(task.due);
  return !task.done && days >= 0 && days <= 3;
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

  const query = $("search").value.trim().toLowerCase();
  const subject = $("subjectFilter").value;

  const visibleTasks = tasks.filter(task => {
    const matchesSearch =
      (task.title + " " + task.subject).toLowerCase().includes(query);

    const matchesSubject =
      subject === "all" || subject === task.subject;

    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "todo" && !task.done) ||
      (currentFilter === "done" && task.done) ||
      (currentFilter === "soon" && isDueSoon(task));

    return matchesSearch && matchesSubject && matchesFilter;
  }).sort((a, b) => a.due.localeCompare(b.due));

  const list = $("taskList");
  list.replaceChildren();

  if (!visibleTasks.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent =
      "No assignments found. Try another filter or add a task.";
    list.appendChild(empty);
    return;
  }

  visibleTasks.forEach(task => {
    const row = document.createElement("div");
    row.className = "task" + (task.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute(
      "aria-label",
      "Mark " + task.title + " complete"
    );

    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      render();
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
    } else if (days === 0) {
      due.textContent = "Due today";
    } else {
      due.textContent = formatDate(task.due);
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

  tasks.push({
    id: Date.now(),
    title: $("taskTitle").value.trim(),
    subject: $("taskSubject").value.trim(),
    due: $("taskDate").value,
    priority: $("taskPriority").value,
    done: false
  });

  closeModal();
  render();
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

render();
