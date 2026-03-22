const SECTION_KEY_MAP = {
  标题: "title",
  新增: "features",
  优化: "improvements",
  改进: "improvements",
  修复: "fixes",
  重大变更: "breaking",
};

const normalizeVersion = (rawVersion) =>
  String(rawVersion || "")
    .trim()
    .replaceAll("-", ".")
    .replace(/\.(\d+)$/, "-$1");

const buildEntryDate = (rawVersion, orderIndex) => {
  const matched = String(rawVersion || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:-(\d+))?$/);
  if (!matched) {
    return new Date(Date.now() - orderIndex * 60 * 1000).toISOString();
  }

  const [, year, month, day, suffix] = matched;
  const hour = 20;
  const minute = Math.max(0, 59 - orderIndex);
  const extraMinute = Number(suffix || 0);
  const date = new Date(`${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(Math.max(0, minute - extraMinute)).padStart(2, "0")}:00+08:00`);
  return date.toISOString();
};

const inferEntryType = (entry) => {
  if (entry.breaking.length > 0) {
    return "major";
  }
  if (entry.features.length > 0) {
    return "minor";
  }
  if (String(entry.version || "").includes("-")) {
    return "patch";
  }
  if (entry.fixes.length > 0 || entry.improvements.length > 0) {
    return "patch";
  }
  return "minor";
};

const createEntry = (rawVersion, orderIndex) => ({
  version: normalizeVersion(rawVersion),
  date: buildEntryDate(rawVersion, orderIndex),
  type: "patch",
  title: "",
  features: [],
  improvements: [],
  fixes: [],
  breaking: [],
});

export const parseChangelogMarkdown = (markdownText) => {
  const lines = String(markdownText || "").split(/\r?\n/);
  const entries = [];
  let currentEntry = null;
  let currentSection = "";

  lines.forEach((rawLine) => {
    const line = String(rawLine || "").trim();
    if (!line) {
      return;
    }

    if (line.startsWith("## ")) {
      currentEntry = createEntry(line.slice(3).trim(), entries.length);
      entries.push(currentEntry);
      currentSection = "";
      return;
    }

    if (!currentEntry) {
      return;
    }

    if (line.startsWith("### ")) {
      currentSection = SECTION_KEY_MAP[line.slice(4).trim()] || "";
      return;
    }

    if (!line.startsWith("- ") || !currentSection) {
      return;
    }

    const content = line.slice(2).trim();
    if (!content) {
      return;
    }

    if (currentSection === "title") {
      currentEntry.title = currentEntry.title
        ? `${currentEntry.title} / ${content}`
        : content;
      return;
    }

    currentEntry[currentSection].push(content);
  });

  return entries.map((entry) => ({
    ...entry,
    type: inferEntryType(entry),
  }));
};
