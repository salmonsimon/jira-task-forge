import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const sourceRoot = join(repoRoot, "src");

const allowedFeedbackFiles = new Set([
  "src/components/ui/FeedbackNote.tsx"
]);

const ignoredFiles = new Set([
  "src/styles.css"
]);

const sourceExtensions = new Set([".ts", ".tsx"]);
const feedbackNames = /\b(function|const|let|var)\s+(Feedback|.*FeedbackNote|.*NoticeNote|.*AlertNote)\b/;
const feedbackPaletteClasses = [
  "bg-[#deebff]",
  "bg-[#e3fcef]",
  "bg-[#fff7d6]",
  "bg-[#fff0b3]",
  "bg-[#ffebe6]",
  "bg-[#102d50]",
  "bg-[#143c2b]",
  "bg-[#3f3102]",
  "bg-[#4f1d1a]",
  "border-[#85b8ff]",
  "border-[#abf5d1]",
  "border-[#f5cd47]",
  "border-[#ffbdad]",
  "border-[#315a8a]",
  "border-[#216e4e]",
  "border-[#7f5f01]",
  "border-[#ae2e24]",
  "text-[#0747a6]",
  "text-[#006644]",
  "text-[#974f0c]",
  "text-[#bf2600]",
  "text-[#b7d5ff]",
  "text-[#7ee2a8]",
  "text-[#f5cd47]",
  "text-[#ffb8ad]"
];

const feedbackTerms = /\b(feedback|notice|message|warning|error|success|credential|token|api key|jql|preflight)\b/i;
const allowedLocalPaletteFiles = new Set([
  "src/App.tsx",
  "src/components/ui/badges.tsx",
  "src/features/jira-preflight/JiraPreflightDialog.tsx",
  "src/features/settings/JiraConnectionGuide.tsx",
  "src/features/settings/NotionSynchronizationGuide.tsx",
  "src/features/trays/ProjectTaskGroup.tsx"
]);

const failures = [];

for (const filePath of listSourceFiles(sourceRoot)) {
  const relPath = relative(repoRoot, filePath).replaceAll("\\", "/");
  if (ignoredFiles.has(relPath)) continue;
  const contents = readFileSync(filePath, "utf8");
  const lines = contents.split(/\r?\n/);

  if (!allowedFeedbackFiles.has(relPath)) {
    lines.forEach((line, index) => {
      if (feedbackNames.test(line)) {
        failures.push({
          path: relPath,
          line: index + 1,
          reason: "Define shared feedback UI in src/components/ui/FeedbackNote.tsx instead of a local Feedback helper."
        });
      }
    });
  }

  if (allowedFeedbackFiles.has(relPath) || allowedLocalPaletteFiles.has(relPath)) continue;

  lines.forEach((line, index) => {
    if (!feedbackPaletteClasses.some((className) => line.includes(className))) return;
    const nearbyText = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join("\n");
    if (!feedbackTerms.test(nearbyText)) return;
    failures.push({
      path: relPath,
      line: index + 1,
      reason: "Use FeedbackNote for actionable note/feedback states, or quiet inline text for passive helper copy."
    });
  });
}

if (failures.length) {
  console.error("Feedback pattern lint failed:");
  for (const failure of failures) {
    console.error(`- ${failure.path}:${failure.line} ${failure.reason}`);
  }
  process.exit(1);
}

console.log("Feedback pattern lint passed.");

function listSourceFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }
    if ([...sourceExtensions].some((extension) => path.endsWith(extension))) {
      files.push(path);
    }
  }
  return files;
}
