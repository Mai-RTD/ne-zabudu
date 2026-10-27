const HOMEWORK_KEY = "ne-zabudu.homework.v1";
const TIMETABLE_KEY = "ne-zabudu.timetable.v1";

let homework = [];
let timetable = null;
let editMode = false;
let editingLesson = null;

// ---------- storage ----------
function loadHomework() {
  try {
    const raw = localStorage.getItem(HOMEWORK_KEY);
    homework = raw ? JSON.parse(raw) : [];
  } catch (e) {
    homework = [];
  }
  if (!Array.isArray(homework)) homework = [];
}

function saveHomework() {
  localStorage.setItem(HOMEWORK_KEY, JSON.stringify(homework));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadTimetable() {
  try {
    const raw = localStorage.getItem(TIMETABLE_KEY);
    if (raw) timetable = JSON.parse(raw);
  } catch (e) {
    timetable = null;
  }
  if (!timetable || typeof timetable !== "object") {
    timetable = deepClone(DEFAULT_TIMETABLE);
  }
  for (const d of DAYS) {
    if (!Array.isArray(timetable[d.key])) timetable[d.key] = [];
  }
  saveTimetable();
}

function saveTimetable() {
  localStorage.setItem(TIMETABLE_KEY, JSON.stringify(timetable));
}

// ---------- dates ----------
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function addDaysStr(s, n) {
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function formatDateRu(s) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function dueLabel(s) {
  const today = todayStr();
  const tomorrow = addDaysStr(today, 1);
  if (s === today) return "сегодня";
  if (s === tomorrow) return "завтра";
  return formatDateRu(s);
}

// ---------- subjects ----------
function subjectSet() {
  const set = new Set(BASE_SUBJECTS);
  for (const d of DAYS) {
    for (const l of timetable[d.key]) set.add(l.subject);
  }
  for (const h of homework) set.add(h.subject);
  return [...set].filter(Boolean).sort(function (a, b) {
    return a.localeCompare(b, "ru");
  });
}

function refreshSubjectList() {
  const dl = document.getElementById("subject-list");
  dl.innerHTML = "";
  for (const s of subjectSet()) {
    const opt = document.createElement("option");
    opt.value = s;
    dl.appendChild(opt);
  }
}

function subjectColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return "hsl(" + hue + ", 55%, 88%)";
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + Math.random().toString(36).slice(2);
}

// ---------- homework render ----------
function renderHomework() {
  const list = document.getElementById("homework-list");
  list.innerHTML = "";
  const today = todayStr();
  const tomorrow = addDaysStr(today, 1);

  const overdue = homework.filter(function (h) { return !h.done && h.due < today; });
  const todayG = homework.filter(function (h) { return !h.done && h.due === today; });
  const tomorrowG = homework.filter(function (h) { return !h.done && h.due === tomorrow; });
  const later = homework.filter(function (h) { return !h.done && h.due > tomorrow; });
  const done = homework.filter(function (h) { return h.done; }).sort(function (a, b) {
    return (b.due || "").localeCompare(a.due || "");
  });

  function sortAsc(arr) {
    return arr.slice().sort(function (a, b) {
      return (a.due || "").localeCompare(b.due || "") || (a.createdAt - b.createdAt);
    });
  }

  const groups = [
    { title: "Просрочено", items: sortAsc(overdue), cls: "overdue" },
    { title: "Сегодня", items: sortAsc(todayG), cls: "" },
    { title: "Завтра", items: sortAsc(tomorrowG), cls: "" },
    { title: "Позже", items: sortAsc(later), cls: "" },
    { title: "Сделано", items: done, cls: "done" },
  ];

  let any = false;
  for (const g of groups) {
    if (g.items.length === 0) continue;
    any = true;
    const h = document.createElement("h3");
    h.className = "group-title";
    h.textContent = g.title;
    list.appendChild(h);
    for (const item of g.items) list.appendChild(renderCard(item, g.cls));
  }

  document.getElementById("homework-empty").hidden = homework.length !== 0;

  const left = homework.filter(function (h) { return !h.done; }).length;
  document.getElementById("homework-counter").textContent = "Осталось: " + left;
}

function renderCard(item, cls) {
  const card = document.createElement("article");
  card.className = "card" + (cls ? " " + cls : "") + (item.done ? " done" : "");

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "checkbox";
  cb.checked = item.done;
  cb.addEventListener("change", function () { toggleDone(item.id); });

  const body = document.createElement("div");
  body.className = "card-body";

  const chip = document.createElement("span");
  chip.className = "subject-chip";
  chip.textContent = item.subject;
  chip.style.background = subjectColor(item.subject);

  const task = document.createElement("p");
  task.className = "task";
  task.textContent = item.task;

  const due = document.createElement("p");
  due.className = "due";
  due.textContent = item.due ? dueLabel(item.due) : "";

  body.appendChild(chip);
  body.appendChild(task);
  body.appendChild(due);

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.type = "button";
  del.textContent = "×";
  del.setAttribute("aria-label", "Удалить");
  del.addEventListener("click", function () { deleteHomework(item.id); });

  card.appendChild(cb);
  card.appendChild(body);
  card.appendChild(del);
  return card;
}

function toggleDone(id) {
  const item = homework.find(function (h) { return h.id === id; });
  if (!item) return;
  item.done = !item.done;
  saveHomework();
  renderHomework();
}

function deleteHomework(id) {
  if (!confirm("Удалить эту домашку?")) return;
  homework = homework.filter(function (h) { return h.id !== id; });
  saveHomework();
  renderHomework();
}

// ---------- homework dialog ----------
function openHomeworkDialog() {
  document.getElementById("hw-subject").value = "";
  document.getElementById("hw-task").value = "";
  document.getElementById("hw-due").value = addDaysStr(todayStr(), 1);
  document.getElementById("hw-error").hidden = true;
  refreshSubjectList();
  document.getElementById("homework-dialog").showModal();
  setTimeout(function () { document.getElementById("hw-subject").focus(); }, 50);
}

document.getElementById("hw-cancel").addEventListener("click", function () {
  document.getElementById("homework-dialog").close();
});

document.getElementById("homework-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const subject = document.getElementById("hw-subject").value.trim();
  const task = document.getElementById("hw-task").value.trim();
  const due = document.getElementById("hw-due").value;
  const err = document.getElementById("hw-error");
  if (!subject || !task || !due) {
    err.textContent = "Заполни предмет, задание и срок.";
    err.hidden = false;
    return;
  }
  err.hidden = true;
  homework.unshift({
    id: newId(),
    subject: subject,
    task: task,
    due: due,
    done: false,
    createdAt: Date.now(),
  });
  saveHomework();
  document.getElementById("homework-dialog").close();
  renderHomework();
});

// ---------- timetable render ----------
function renderTimetable() {
  const container = document.getElementById("timetable-list");
  container.classList.toggle("editing", editMode);
  container.innerHTML = "";

  const today = new Date();
  const todayDayIndex = today.getDay(); // 0 Sun .. 6 Sat
  const todayKey = ["", "mon", "tue", "wed", "thu", "fri"][todayDayIndex] || null;
  const weekend = todayDayIndex === 0 || todayDayIndex === 6;
  document.getElementById("timetable-weekend").hidden = !weekend;

  for (const d of DAYS) {
    const card = document.createElement("div");
    card.className = "day-card" + (d.key === todayKey ? " today" : "");

    const title = document.createElement("div");
    title.className = "day-title";
    title.textContent = d.label;
    card.appendChild(title);

    const lessons = (timetable[d.key] || []).slice().sort(function (a, b) {
      return a.time.localeCompare(b.time);
    });

    if (lessons.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-day";
      empty.textContent = "Уроков нет. Нажми «Изменить».";
      card.appendChild(empty);
    } else {
      for (const l of lessons) {
        const row = document.createElement("div");
        row.className = "lesson";

        const time = document.createElement("div");
        time.className = "lesson-time";
        time.textContent = l.time;

        const body = document.createElement("div");
        body.className = "lesson-body";

        const subj = document.createElement("div");
        subj.className = "lesson-subject";
        subj.textContent = l.subject;

        const room = document.createElement("div");
        room.className = "lesson-room";
        room.textContent = l.room ? "каб. " + l.room : "";

        body.appendChild(subj);
        body.appendChild(room);

        const actions = document.createElement("div");
        actions.className = "lesson-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.textContent = "✎";
        editBtn.setAttribute("aria-label", "Изменить урок");
        editBtn.addEventListener("click", function () { openLessonDialog(d.key, l.id); });

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "×";
        delBtn.setAttribute("aria-label", "Удалить урок");
        delBtn.addEventListener("click", function () { deleteLesson(d.key, l.id); });

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        row.appendChild(time);
        row.appendChild(body);
        row.appendChild(actions);
        card.appendChild(row);
      }
    }

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "add-lesson-btn";
    addBtn.textContent = "+ Добавить урок";
    addBtn.addEventListener("click", function () { openLessonDialog(d.key, null); });
    card.appendChild(addBtn);

    container.appendChild(card);
  }
}

// ---------- lesson dialog ----------
function openLessonDialog(dayKey, lessonId) {
  editingLesson = lessonId ? { day: dayKey, id: lessonId } : null;
  let lesson = null;
  if (lessonId) {
    const list = timetable[dayKey] || [];
    lesson = list.find(function (l) { return l.id === lessonId; }) || null;
  }
  document.getElementById("lesson-day").value = dayKey;
  document.getElementById("lesson-time").value = lesson ? lesson.time : "";
  document.getElementById("lesson-subject").value = lesson ? lesson.subject : "";
  document.getElementById("lesson-room").value = lesson ? (lesson.room || "") : "";
  document.getElementById("lesson-error").hidden = true;
  document.getElementById("lesson-delete").hidden = !lessonId;
  document.getElementById("lesson-dialog-title").textContent = lessonId ? "Изменить урок" : "Новый урок";
  refreshSubjectList();
  document.getElementById("lesson-dialog").showModal();
  setTimeout(function () { document.getElementById("lesson-time").focus(); }, 50);
}

function deleteLesson(dayKey, lessonId) {
  if (!confirm("Удалить этот урок?")) return;
  if (!timetable[dayKey]) return;
  timetable[dayKey] = timetable[dayKey].filter(function (l) { return l.id !== lessonId; });
  saveTimetable();
  renderTimetable();
  refreshSubjectList();
}

document.getElementById("lesson-cancel").addEventListener("click", function () {
  document.getElementById("lesson-dialog").close();
});

document.getElementById("lesson-delete").addEventListener("click", function () {
  if (!editingLesson) return;
  if (!confirm("Удалить этот урок?")) return;
  const day = editingLesson.day;
  if (timetable[day]) {
    timetable[day] = timetable[day].filter(function (l) { return l.id !== editingLesson.id; });
  }
  saveTimetable();
  document.getElementById("lesson-dialog").close();
  renderTimetable();
  refreshSubjectList();
});

document.getElementById("lesson-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const day = document.getElementById("lesson-day").value;
  const time = document.getElementById("lesson-time").value;
  const subject = document.getElementById("lesson-subject").value.trim();
  const room = document.getElementById("lesson-room").value.trim();
  const err = document.getElementById("lesson-error");
  if (!day || !time || !subject) {
    err.textContent = "Заполни день, время и предмет.";
    err.hidden = false;
    return;
  }
  err.hidden = true;

  if (editingLesson && editingLesson.id) {
    const oldDay = editingLesson.day;
    if (oldDay !== day) {
      if (timetable[oldDay]) {
        timetable[oldDay] = timetable[oldDay].filter(function (l) { return l.id !== editingLesson.id; });
      }
      if (!timetable[day]) timetable[day] = [];
      timetable[day].push({ id: editingLesson.id, time: time, subject: subject, room: room });
    } else {
      const list = timetable[day] || [];
      const idx = list.findIndex(function (l) { return l.id === editingLesson.id; });
      if (idx >= 0) list[idx] = { id: editingLesson.id, time: time, subject: subject, room: room };
    }
  } else {
    if (!timetable[day]) timetable[day] = [];
    timetable[day].push({ id: newId(), time: time, subject: subject, room: room });
  }

  saveTimetable();
  document.getElementById("lesson-dialog").close();
  renderTimetable();
  refreshSubjectList();
});

// ---------- tabs ----------
function applyScreen(name) {
  const target = name === "timetable" ? "timetable" : "homework";
  document.querySelectorAll(".screen").forEach(function (s) {
    s.classList.toggle("active", s.id === "screen-" + target);
  });
  document.querySelectorAll(".nav-btn").forEach(function (b) {
    b.classList.toggle("active", b.dataset.screen === target);
  });
  document.getElementById("fab-add").hidden = target !== "homework";
  if (target === "homework") renderHomework();
  if (target === "timetable") renderTimetable();
}

function switchScreen(name) {
  location.hash = "#" + name;
}

window.addEventListener("hashchange", function () {
  const name = (location.hash.replace("#", "") || "homework");
  applyScreen(name);
});

document.querySelectorAll(".nav-btn").forEach(function (b) {
  b.addEventListener("click", function () { switchScreen(b.dataset.screen); });
});

document.getElementById("fab-add").addEventListener("click", openHomeworkDialog);

document.getElementById("timetable-edit-btn").addEventListener("click", function () {
  editMode = !editMode;
  document.getElementById("timetable-edit-btn").textContent = editMode ? "Готово" : "Изменить";
  renderTimetable();
});

// backdrop close
document.querySelectorAll("dialog").forEach(function (d) {
  d.addEventListener("click", function (e) {
    if (e.target === d) d.close();
  });
});

// ---------- init ----------
loadHomework();
loadTimetable();

// populate day select
const daySelect = document.getElementById("lesson-day");
for (const d of DAYS) {
  const opt = document.createElement("option");
  opt.value = d.key;
  opt.textContent = d.label;
  daySelect.appendChild(opt);
}

const now = new Date();
document.getElementById("header-date").textContent = now.toLocaleDateString("ru-RU", {
  weekday: "long", day: "numeric", month: "long",
});

const initial = (location.hash.replace("#", "") === "timetable") ? "timetable" : "homework";
applyScreen(initial);
