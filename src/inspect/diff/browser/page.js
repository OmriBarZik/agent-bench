// The browser diff page's behaviour. diff-page.ts inlines this after `const PAGE = {...}`, which holds the
// title, the patch, one entry per file in diff order (path, status, added, removed) and a localStorage key.
(() => {
  const STATUS_NAMES = {
    A: "added",
    D: "deleted",
    R: "renamed",
    C: "copied",
    M: "modified",
    T: "modified",
    B: "binary",
  };
  const FORMAT_KEY = "agent-bench-diff:format";
  const VIEWED_KEY = `agent-bench-diff:viewed:${PAGE.storageKey}`;

  const target = document.getElementById("diff");
  const treeEl = document.getElementById("tree");
  const filterEl = document.getElementById("filter");
  const progressEl = document.getElementById("progress");
  const viewed = new Set(readJson(VIEWED_KEY, []));
  const collapsedDirs = new Set();
  let format = localStorage.getItem(FORMAT_KEY) || "side-by-side";
  let wrappers = [];
  let rows = new Map();
  let activeIndex = -1;
  let observer = null;

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text !== undefined) {
      node.textContent = text;
    }

    return node;
  }

  function showStats() {
    const added = PAGE.files.reduce((sum, file) => sum + file.added, 0);
    const removed = PAGE.files.reduce((sum, file) => sum + file.removed, 0);
    const stats = document.getElementById("stats");
    stats.replaceChildren(
      element("span", "", `${PAGE.files.length} ${PAGE.files.length === 1 ? "file" : "files"}`),
      element("span", "added", `+${added}`),
      element("span", "removed", `−${removed}`),
    );
  }

  function showProgress() {
    const count = PAGE.files.filter((file) => viewed.has(file.path)).length;
    progressEl.textContent = `${count} / ${PAGE.files.length} viewed`;
  }

  /** Folders as nested maps, files as leaves that keep their index in the diff. */
  function buildTree(query) {
    const root = { dirs: new Map(), files: [] };

    PAGE.files.forEach((file, index) => {
      if (query && !file.path.toLowerCase().includes(query)) {
        return;
      }

      const parts = file.path.split("/");
      const name = parts.pop();
      let node = root;

      for (const part of parts) {
        if (!node.dirs.has(part)) {
          node.dirs.set(part, { dirs: new Map(), files: [] });
        }

        node = node.dirs.get(part);
      }

      node.files.push({ file, index, name });
    });

    return root;
  }

  /** Joins a folder that only holds one folder into it, like GitHub does (`third_party/devtools-frontend/src`). */
  function compress(name, node) {
    let label = name;
    let current = node;

    while (current.files.length === 0 && current.dirs.size === 1) {
      const [childName, child] = current.dirs.entries().next().value;
      label = `${label}/${childName}`;
      current = child;
    }

    return { label, node: current };
  }

  function renderTree() {
    const query = filterEl.value.trim().toLowerCase();
    rows = new Map();
    treeEl.replaceChildren();
    renderNode({ node: buildTree(query), container: treeEl, depth: 0, prefix: "" });

    if (rows.size === 0) {
      treeEl.append(element("p", "empty", "No files match."));
    }

    markActive(activeIndex);
  }

  function renderNode({ node, container, depth, prefix }) {
    const dirs = [...node.dirs.entries()].sort(([left], [right]) => left.localeCompare(right));

    for (const [name, child] of dirs) {
      const { label, node: inner } = compress(name, child);
      const key = `${prefix}${label}/`;
      const group = element("div", "dir");
      const row = element("button", "row dir-row");
      row.style.setProperty("--depth", depth);
      row.append(element("span", "chevron", "▾"), element("span", "folder", "▸"), element("span", "name", label));
      row.title = key;
      const children = element("div", "children");
      group.append(row, children);
      group.classList.toggle("collapsed", collapsedDirs.has(key));
      row.addEventListener("click", () => {
        group.classList.toggle("collapsed");
        group.classList.contains("collapsed") ? collapsedDirs.add(key) : collapsedDirs.delete(key);
      });
      renderNode({ node: inner, container: children, depth: depth + 1, prefix: key });
      container.append(group);
    }

    const files = [...node.files].sort((left, right) => left.name.localeCompare(right.name));

    for (const { file, index, name } of files) {
      const row = element("a", `row file-row status-${file.status}`);
      row.href = `#file-${index}`;
      row.title = file.previousPath ? `${file.previousPath} → ${file.path}` : file.path;
      row.style.setProperty("--depth", depth);
      row.classList.toggle("viewed", viewed.has(file.path));
      const badge = element("span", "badge", file.status === "B" ? "M" : file.status);
      badge.title = STATUS_NAMES[file.status] || file.status;
      const counts = element("span", "counts");
      counts.append(element("span", "added", `+${file.added}`), element("span", "removed", `−${file.removed}`));
      row.append(badge, element("span", "name", name), counts);
      row.addEventListener("click", (event) => {
        event.preventDefault();
        openFile(index);
      });
      rows.set(index, row);
      container.append(row);
    }
  }

  function openFile(index) {
    const wrapper = wrappers[index];

    if (!wrapper) {
      return;
    }

    wrapper.scrollIntoView({ block: "start" });
    history.replaceState(null, "", `#file-${index}`);
    markActive(index);
  }

  function markActive(index) {
    rows.get(activeIndex)?.classList.remove("active");
    activeIndex = index;
    const row = rows.get(index);

    if (row) {
      row.classList.add("active");
      row.scrollIntoView({ block: "nearest" });
    }
  }

  function setViewed({ index, on }) {
    const file = PAGE.files[index];

    if (!file) {
      return;
    }

    on ? viewed.add(file.path) : viewed.delete(file.path);
    localStorage.setItem(VIEWED_KEY, JSON.stringify([...viewed]));
    rows.get(index)?.classList.toggle("viewed", on);
    showProgress();
  }

  /** diff2html's own Viewed box folds the file; it is kept in step with the tree and remembered per run. */
  function wireViewed(wrapper, index) {
    const label = wrapper.querySelector(".d2h-file-collapse");
    const box = wrapper.querySelector(".d2h-file-collapse-input");

    if (!label || !box) {
      return;
    }

    if (viewed.has(PAGE.files[index]?.path) && !box.checked) {
      label.click();
    }

    label.addEventListener("click", () => setTimeout(() => setViewed({ index, on: box.checked })));
  }

  function followScroll() {
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);

        if (visible.length > 0) {
          markActive(wrappers.indexOf(visible[0].target));
        }
      },
      { rootMargin: "-70px 0px -65% 0px" },
    );
    wrappers.forEach((wrapper) => observer.observe(wrapper));
  }

  function draw() {
    for (const button of document.querySelectorAll("[data-format]")) {
      button.setAttribute("aria-pressed", String(button.dataset.format === format));
    }

    if (PAGE.patch.trim() === "") {
      target.replaceChildren(element("p", "empty", "No file changes between these commits."));

      return;
    }

    const ui = new Diff2HtmlUI(target, PAGE.patch, {
      outputFormat: format,
      drawFileList: false,
      matching: "lines",
      highlight: true,
      fileContentToggle: true,
      stickyFileHeaders: true,
      synchronisedScroll: true,
      colorScheme: "auto",
    });
    ui.draw();
    ui.highlightCode();
    wrappers = [...target.querySelectorAll(".d2h-file-wrapper")];
    wrappers.forEach((wrapper, index) => {
      wrapper.id = `file-${index}`;
      wireViewed(wrapper, index);
    });
    followScroll();
  }

  function stepFile(delta) {
    const next = Math.min(Math.max((activeIndex < 0 ? -1 : activeIndex) + delta, 0), wrappers.length - 1);
    openFile(next);
  }

  for (const button of document.querySelectorAll("[data-format]")) {
    button.addEventListener("click", () => {
      format = button.dataset.format;
      localStorage.setItem(FORMAT_KEY, format);
      const keep = activeIndex;
      draw();
      openFile(keep < 0 ? 0 : keep);
    });
  }

  document.getElementById("toggle-tree").addEventListener("click", () => document.body.classList.toggle("tree-hidden"));
  filterEl.addEventListener("input", renderTree);
  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.key === "j" || event.key === "n") {
      stepFile(1);
    } else if (event.key === "k" || event.key === "p") {
      stepFile(-1);
    } else if (event.key === "/" || event.key === "t") {
      event.preventDefault();
      filterEl.focus();
    }
  });

  showStats();
  showProgress();
  draw();
  renderTree();
  const start = /^#file-(\d+)$/.exec(location.hash);

  if (start) {
    openFile(Number(start[1]));
  }
})();
