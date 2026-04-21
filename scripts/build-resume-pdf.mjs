#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repoRoot, "public/files/mikhail-larionov-resume.md");
const htmlPath = path.join(repoRoot, "public/files/mikhail-larionov-resume.html");
const pdfPath = path.join(repoRoot, "public/files/mikhail-larionov-resume.pdf");

const chromeCandidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/opt/homebrew/bin/chromium",
  "/usr/bin/chromium",
].filter(Boolean);

const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));

if (!chromePath) {
  console.error("Could not find Chrome or Chromium. Set CHROME_BIN to a headless-capable browser.");
  process.exit(1);
}

const markdown = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
const blocks = parseMarkdown(markdown);
const firstSectionIndex = blocks.findIndex((block) => block.type === "h2");

if (blocks[0]?.type !== "h1" || firstSectionIndex === -1) {
  console.error("Resume markdown should start with a top-level name and contain section headings.");
  process.exit(1);
}

const name = blocks[0].text;
const introBlocks = blocks.slice(1, firstSectionIndex);
const tagline = introBlocks.find((block) => block.type === "p")?.rawLines.join(" ").trim() ?? "";
const contactSource = introBlocks
  .slice(1)
  .flatMap((block) => (block.rawLines ?? [block.text]).map((line) => line.trim()))
  .join(" | ");
const contactItems = contactSource
  .split(/\s+\|\s+/)
  .map((item) => item.trim())
  .filter(Boolean);
const bodyBlocks = blocks.slice(firstSectionIndex);

const html = renderDocument({
  name,
  tagline,
  contactItems,
  blocks: bodyBlocks,
});

fs.writeFileSync(htmlPath, html);
fs.rmSync(pdfPath, { force: true });

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-chrome-"));
const chromeArgs = [
  "--headless=new",
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--user-data-dir=${profileDir}`,
  `--print-to-pdf=${pdfPath}`,
  pathToFileURL(htmlPath).href,
];

const result = await printWithChrome(chromePath, chromeArgs, pdfPath);

removeProfileDir(profileDir);

if (!result.ok) {
  process.stderr.write(result.stderr);
  process.stderr.write(result.stdout);
  process.exit(result.status ?? 1);
}

console.log(`Wrote ${path.relative(repoRoot, htmlPath)}`);
console.log(`Wrote ${path.relative(repoRoot, pdfPath)}`);

function printWithChrome(command, args, targetPath) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let status = null;
    let settled = false;
    const startedAt = Date.now();
    const timeoutMs = 30000;
    const child = spawn(command, args, {
      cwd: repoRoot,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("exit", (code) => {
      status = code;
      finish(getPdfSize(targetPath) > 1024 && code === 0, code);
    });
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      finish(false, 1);
    });

    let lastPdfSize = 0;
    let stablePdfTicks = 0;

    const interval = setInterval(() => {
      const pdfSize = getPdfSize(targetPath);
      if (pdfSize > 1024 && pdfSize === lastPdfSize) {
        stablePdfTicks += 1;
      } else {
        stablePdfTicks = 0;
      }
      lastPdfSize = pdfSize;

      if (stablePdfTicks >= 2) {
        finish(true, 0);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        stderr += "Timed out waiting for Chrome to write the PDF.\n";
        finish(false, 1);
      }
    }, 250);

    function finish(ok, code) {
      if (settled) {
        return;
      }

      settled = true;
      clearInterval(interval);
      const stoppedChrome = status === null;
      if (stoppedChrome) {
        stopProcessGroup(child.pid);
      }

      setTimeout(
        () => resolve({ ok, status: code ?? status, stdout, stderr }),
        stoppedChrome ? 1200 : 0,
      );
    }
  });
}

function removeProfileDir(profileDir) {
  try {
    fs.rmSync(profileDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  } catch (error) {
    console.warn(`Could not remove temporary Chrome profile: ${error.message}`);
  }
}

function getPdfSize(targetPath) {
  try {
    return fs.statSync(targetPath).size;
  } catch {
    return 0;
  }
}

function stopProcessGroup(pid) {
  if (!pid) {
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    return;
  }

  setTimeout(() => {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // The process group exited after SIGTERM.
    }
  }, 1000).unref();
}

function parseMarkdown(input) {
  const lines = input.split("\n");
  const parsed = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      parsed.push({ type: `h${heading[1].length}`, text: heading[2].trim() });
      index += 1;
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*-\s+/, "").trim());
        index += 1;
      }
      parsed.push({ type: "ul", items });
      continue;
    }

    const rawLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index]) &&
      !/^\s*-\s+/.test(lines[index])
    ) {
      rawLines.push(lines[index]);
      index += 1;
    }
    parsed.push({
      type: "p",
      rawLines,
      text: rawLines.map((rawLine) => rawLine.trim()).join(" "),
    });
  }

  return parsed;
}

function renderDocument({ name, tagline, contactItems, blocks }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(name)} Resume</title>
  <style>
    :root {
      --ink: #18212f;
      --muted: #5d6978;
      --soft: #f5f8f7;
      --rule: #dde5e4;
      --accent: #2f5f5b;
      --accent-2: #7d5d3f;
    }

    * {
      box-sizing: border-box;
    }

    html {
      background: #edf1f3;
      color: var(--ink);
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 10.2pt;
      line-height: 1.42;
    }

    body {
      margin: 0;
    }

    .sheet {
      width: 8.5in;
      min-height: 11in;
      margin: 24px auto;
      padding: 0.52in 0.58in 0.58in;
      background: #fff;
      box-shadow: 0 20px 56px rgba(24, 33, 47, 0.14);
    }

    header {
      margin: -0.12in -0.12in 0.32in;
      padding: 0.32in 0.34in 0.28in;
      border: 1px solid #dce7e5;
      border-radius: 8px;
      background: var(--soft);
    }

    h1 {
      margin: 0 0 10px;
      color: #101722;
      font-size: 34pt;
      font-weight: 700;
      letter-spacing: 0;
      line-height: 0.95;
    }

    .tagline {
      max-width: 6.4in;
      margin: 0;
      color: #2e3947;
      font-size: 13pt;
      line-height: 1.28;
    }

    .contact {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 11px;
      margin: 18px 0 0;
      padding: 0;
      color: var(--muted);
      font-size: 9.2pt;
      list-style: none;
    }

    .contact li:first-child {
      flex-basis: auto;
    }

    .contact li:first-child::after {
      content: "";
    }

    .contact li:not(:last-child)::after {
      content: "";
      display: inline-block;
      width: 3px;
      height: 3px;
      margin-left: 11px;
      border-radius: 50%;
      background: #aab6b3;
      vertical-align: middle;
    }

    main {
      padding-top: 0;
    }

    section {
      margin-top: 0.34in;
      padding-top: 0;
      border-top: 0;
    }

    section:first-child {
      margin-top: 0;
    }

    h2 {
      margin: 0 0 0.14in;
      padding-bottom: 0.07in;
      border-bottom: 1px solid var(--rule);
      color: #202b3a;
      font-size: 13pt;
      font-weight: 700;
      letter-spacing: 0;
      line-height: 1.1;
      text-transform: none;
    }

    h2::after {
      content: none;
    }

    h3 {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      column-gap: 18px;
      align-items: baseline;
      margin: 0.2in 0 2px;
      color: #111827;
      font-size: 12.2pt;
      line-height: 1.18;
      break-after: avoid;
    }

    h2 + h3 {
      margin-top: 0;
    }

    h3 .org {
      font-weight: 700;
    }

    h3 .role {
      color: #435063;
      font-size: 9.5pt;
      font-weight: 600;
      text-align: right;
    }

    p {
      margin: 0 0 0.08in;
    }

    .date-line {
      margin-bottom: 0.06in;
      color: var(--accent);
      font-size: 9.2pt;
      font-weight: 700;
      break-after: avoid;
    }

    ul {
      margin: 0.06in 0 0;
      padding-left: 18px;
    }

    li {
      margin: 0 0 0.055in;
      padding-left: 3px;
    }

    li::marker {
      color: var(--accent);
      font-size: 0.86em;
    }

    a {
      color: #315e5b;
      text-decoration: none;
    }

    code {
      padding: 0 2px;
      border-radius: 3px;
      background: var(--soft);
      color: #17212b;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 0.92em;
    }

    .section-summary p {
      color: #1f2937;
      font-size: 11.1pt;
      line-height: 1.38;
    }

    .section-selected-achievements ul,
    .section-patents ul,
    .section-skills ul,
    .section-writing-and-public-work ul,
    .section-additional ul {
      margin-top: 2px;
    }

    .section-experience h3 {
      padding-top: 0.02in;
      border-top: 1px solid #edf1f2;
    }

    .section-experience h2 + h3 {
      border-top: 0;
      padding-top: 0;
    }

    .section-selected-achievements,
    .section-patents,
    .section-skills,
    .section-writing-and-public-work,
    .section-education,
    .section-additional {
      font-size: 9.65pt;
      line-height: 1.35;
    }

    .section-skills li {
      margin-bottom: 0.06in;
    }

    .section-selected-achievements {
      break-before: auto;
    }

    .section-patents {
      break-before: page;
    }

    @media print {
      @page {
        size: Letter;
        margin: 0.5in 0.56in 0.56in;
      }

      html {
        background: #fff;
        font-size: 10.2pt;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .sheet {
        width: auto;
        min-height: 0;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }

      header {
        margin: 0 0 0.3in;
      }

      h3,
      .date-line,
      li {
        break-inside: avoid;
      }

      a {
        color: #315e5b;
      }
    }
  </style>
</head>
<body>
  <article class="sheet">
    <header>
      <h1>${escapeHtml(name)}</h1>
      <p class="tagline">${renderInline(tagline)}</p>
      <ul class="contact">
        ${contactItems.map((item) => `<li>${renderInline(item)}</li>`).join("\n        ")}
      </ul>
    </header>
    <main>
${renderBlocks(blocks)}
    </main>
  </article>
</body>
</html>`;
}

function renderBlocks(blocks) {
  const html = [];
  let openSection = false;
  let lastBlockType = "";

  for (const block of blocks) {
    if (block.type === "h2") {
      if (openSection) {
        html.push("    </section>");
      }
      html.push(`    <section class="section-${slugify(block.text)}">`);
      html.push(`      <h2>${renderInline(block.text)}</h2>`);
      openSection = true;
      lastBlockType = "h2";
      continue;
    }

    if (!openSection) {
      html.push("    <section>");
      openSection = true;
    }

    if (block.type === "h3") {
      html.push(`      ${renderExperienceHeading(block.text)}`);
      lastBlockType = "h3";
      continue;
    }

    if (block.type === "p") {
      const isDate = lastBlockType === "h3" && isDateLine(block.text);
      const className = isDate ? ' class="date-line"' : "";
      html.push(`      <p${className}>${renderParagraph(block.rawLines)}</p>`);
      lastBlockType = "p";
      continue;
    }

    if (block.type === "ul") {
      html.push("      <ul>");
      for (const item of block.items) {
        html.push(`        <li>${renderInline(item)}</li>`);
      }
      html.push("      </ul>");
      lastBlockType = "ul";
    }
  }

  if (openSection) {
    html.push("    </section>");
  }

  return html.join("\n");
}

function renderExperienceHeading(text) {
  const parts = text.split(/\s+-\s+/);
  if (parts.length < 2) {
    return `<h3><span class="org">${renderInline(text)}</span></h3>`;
  }

  const org = parts.shift();
  const role = parts.join(" - ");
  return `<h3><span class="org">${renderInline(org)}</span><span class="role">${renderInline(role)}</span></h3>`;
}

function renderParagraph(rawLines) {
  return rawLines
    .map((line) => ({
      text: line.replace(/\s+$/, ""),
      hardBreak: /\s{2,}$/.test(line),
    }))
    .map(({ text, hardBreak }, index, rows) => {
      const suffix = hardBreak || index < rows.length - 1 ? "<br>" : "";
      return `${renderInline(text)}${suffix}`;
    })
    .join("");
}

function renderInline(text) {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, label, url) => {
    const safeUrl = escapeAttribute(url);
    return `<a href="${safeUrl}">${label}</a>`;
  });

  return linked.replace(/`([^`]+)`/g, "<code>$1</code>");
}

function isDateLine(text) {
  return /^(Pre-\d{4}|\d{4}\s+-\s+(Present|\d{4})(,\s*[^.]+)?)$/.test(text);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
