/**
 * Lightweight project/workspace grouping — optional, never required. A
 * project is just a name that sessions can be tagged with, for filtering in
 * the sidebar. No separate files/knowledge-base/system-instructions layer —
 * that's real scope the app doesn't need yet, and this stays easy to extend
 * into that later without a schema change (projectId already flows through
 * session storage).
 */
const STORAGE_KEY = "unsense_projects";

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function listProjects() {
  return load().sort((a, b) => a.name.localeCompare(b.name));
}

export function createProject(name) {
  const clean = String(name || "").trim().slice(0, 60);
  if (!clean) return null;
  const projects = load();
  const project = { id: `proj_${Date.now()}`, name: clean, createdAt: new Date().toISOString() };
  projects.push(project);
  save(projects);
  return project;
}

export function deleteProject(id) {
  save(load().filter((p) => p.id !== id));
}
