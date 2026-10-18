/* CampusFlow AI frontend. Kept separate so the existing premium site logic stays untouched. */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const URL_KEY = "campusflow_ai_server_url";
  const cleanBase = value => String(value || "").trim().replace(/\/+$/, "");
  const baseUrl = () => cleanBase(localStorage.getItem(URL_KEY) || "");
  const safeText = value => String(value ?? "");
  const status = (message, kind = "") => {
    const box = byId("cfAiStatus"), label = byId("cfAiStatusText");
    if (label) label.textContent = message;
    if (box) box.className = "cf-ai-status" + (kind ? " is-" + kind : "");
  };
  const setBusy = (button, busy, original) => {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? "Thinking…" : original;
  };
  const appendMessage = (role, text) => {
    const log = byId("cfAiChatLog");
    if (!log) return;
    const item = document.createElement("div");
    item.className = "cf-ai-msg " + role;
    item.textContent = safeText(text);
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  };
  function getTaskContext() {
    try {
      const raw = localStorage.getItem("campusflow_tasks");
      const tasks = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(tasks)) return "";
      return tasks.slice(0, 100).map(t => ({
        title: t.title, subject: t.subject, due: t.due,
        priority: t.priority, completed: Boolean(t.done)
      }));
    } catch (_) { return ""; }
  }
  async function requestAI({ mode = "chat", message = "", context = "" }) {
    const endpoint = (baseUrl() || "") + "/api/ai";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, message, context: typeof context === "string" ? context : JSON.stringify(context) })
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}). Check the AI server URL and setup.`);
    if (!data.answer) throw new Error("AI response was empty. Please try again.");
    return data.answer;
  }
  async function checkHealth() {
    try {
      const response = await fetch((baseUrl() || "") + "/api/health");
      const data = await response.json();
      if (data.aiConfigured) status("AI connected · " + (data.model || "model ready"), "online");
      else status("Server found · API key not configured", "error");
    } catch (_) {
      status("AI server not connected yet", "error");
    }
  }
  async function sendChat(message) {
    appendMessage("user", message);
    const button = byId("cfAiSend");
    setBusy(button, true, "Send ↗");
    status("CampusFlow AI is thinking…");
    try {
      const answer = await requestAI({ mode: "chat", message, context: getTaskContext() });
      appendMessage("bot", answer);
      status("Response received", "online");
    } catch (error) {
      appendMessage("bot", "I couldn’t connect just now. " + error.message);
      status("AI request failed", "error");
    } finally {
      setBusy(button, false, "Send ↗");
      byId("cfAiMessage")?.focus();
    }
  }
  async function runTool(mode) {
    const notes = byId("cfAiNotes")?.value.trim() || "";
    const out = byId("cfAiToolOutput"), message = byId("cfAiToolStatus");
    if (!notes && mode !== "plan" && mode !== "coach") {
      message.textContent = "Please enter a topic or paste your notes first.";
      byId("cfAiNotes")?.focus(); return;
    }
    message.textContent = "CampusFlow AI is preparing your result…";
    out.textContent = "Working on it…";
    const button = document.querySelector(`[data-cf-mode="${mode}"]`);
    const original = button?.querySelector("strong")?.textContent || "Generate";
    if (button) { button.disabled = true; }
    try {
      const context = {
        notes,
        assignments: getTaskContext(),
        planningPreferences: {
          availableHours: Number(byId("cfAiHours")?.value || 4),
          subjects: byId("cfAiSubjects")?.value.trim() || "Use subjects from my assignments and notes",
          nearestDeadline: byId("cfAiDeadline")?.value.trim() || "Use the due dates in my assignments",
          priority: byId("cfAiPriority")?.value || "Balanced study"
        }
      };
      const prompts = {
        summarize: "Summarize these notes for a college student. Include overview, key concepts, definitions, examples if present, and quick revision points. Do not invent facts.",
        quiz: "Create a revision quiz from the supplied notes. Include 8 questions with a mix of MCQs and short-answer questions, then an answer key with brief explanations.",
        flashcards: "Create 10 useful study flashcards from the supplied notes. Format each as Card number, Front (question/term), Back (clear answer/definition). Keep answers concise and do not invent facts.",
        plan: "Build a personalized, realistic study timetable for today using planningPreferences and the supplied assignments. Respect availableHours, subjects, nearestDeadline, and priority. Use time blocks, short breaks, revision, and a clear reason for each priority. Do not schedule more than the available hours. Mention assumptions if any.",
        coach: "Act as a supportive productivity coach. Analyze pending assignments, due dates, priorities and supplied notes. Identify bottlenecks and suggest the three most useful next steps, including what to start now and what can wait. Keep it practical and encouraging."
      };
      const answer = await requestAI({ mode, message: prompts[mode], context });
      out.textContent = answer;
      message.textContent = "Done — your result is ready. ✨";
      status("AI tool completed", "online");
    } catch (error) {
      out.textContent = "Could not generate a result.\n\n" + error.message;
      message.textContent = "Check the server connection and try again.";
      status("AI request failed", "error");
    } finally { if (button) button.disabled = false; }
  }
  function init() {
    const urlInput = byId("cfAiBaseUrl");
    if (urlInput) urlInput.value = baseUrl();
    byId("cfAiSaveUrl")?.addEventListener("click", () => {
      const value = cleanBase(urlInput?.value);
      if (value && !/^https?:\/\//i.test(value)) {
        status("Server URL must start with https:// or http://", "error"); return;
      }
      try {
        if (value) localStorage.setItem(URL_KEY, value);
        else localStorage.removeItem(URL_KEY);
      } catch (_) {}
      status("Server URL saved. Checking connection…");
      checkHealth();
    });
    byId("cfAiChatForm")?.addEventListener("submit", event => {
      event.preventDefault();
      const input = byId("cfAiMessage"), message = input?.value.trim();
      if (!message) return;
      input.value = "";
      sendChat(message);
    });
    document.querySelectorAll("[data-cf-prompt]").forEach(button => button.addEventListener("click", () => {
      const input = byId("cfAiMessage");
      if (input) { input.value = button.dataset.cfPrompt || ""; input.focus(); }
    }));
    document.querySelectorAll("[data-cf-mode]").forEach(button => button.addEventListener("click", () => runTool(button.dataset.cfMode)));
    byId("cfAiCopyOutput")?.addEventListener("click", async () => {
      const text = byId("cfAiToolOutput")?.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
        byId("cfAiToolStatus").textContent = "Result copied to clipboard.";
      } catch (_) {
        byId("cfAiToolStatus").textContent = "Clipboard access unavailable. Select the result and copy it manually.";
      }
    });
    checkHealth();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
