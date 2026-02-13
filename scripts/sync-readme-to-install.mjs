#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const readmePath = path.join(repoRoot, "README.md");
const indexPath = path.join(repoRoot, "install", "index.html");

const mode = process.argv.includes("--check")
  ? "check"
  : process.argv.includes("--write")
    ? "write"
    : null;

if (!mode) {
  console.error("Usage: node scripts/sync-readme-to-install.mjs [--write|--check]");
  process.exit(1);
}

const readme = fs.readFileSync(readmePath, "utf8");
const indexHtml = fs.readFileSync(indexPath, "utf8");

const blocks = {
  "quick-start": extractMarkedBlock(readme, "quick-start"),
  features: extractMarkedBlock(readme, "features"),
  "powershell-reference": extractMarkedBlock(readme, "powershell-reference"),
};

const rendered = {
  "quick-start": renderQuickStart(blocks["quick-start"]),
  features: renderFeatures(blocks.features),
  "powershell-reference": renderPowerShellReference(blocks["powershell-reference"]),
};

let nextHtml = indexHtml;
for (const [slot, html] of Object.entries(rendered)) {
  nextHtml = replaceSlot(nextHtml, slot, html);
}

if (mode === "check") {
  if (nextHtml !== indexHtml) {
    console.error("Documentation sync is out of date. Run: npm run sync:docs");
    process.exit(1);
  }
  console.log("Documentation sync check passed.");
  process.exit(0);
}

if (mode === "write") {
  if (nextHtml !== indexHtml) {
    fs.writeFileSync(indexPath, nextHtml, "utf8");
    console.log("Updated install/index.html from README markers.");
  } else {
    console.log("No sync changes needed.");
  }
}

function extractMarkedBlock(content, name) {
  const start = `<!-- sync:${name}:start -->`;
  const end = `<!-- sync:${name}:end -->`;
  const startMatches = [...content.matchAll(new RegExp(`^${escapeRegex(start)}\\s*$`, "gm"))];
  const endMatches = [...content.matchAll(new RegExp(`^${escapeRegex(end)}\\s*$`, "gm"))];

  if (startMatches.length !== 1 || endMatches.length !== 1) {
    throw new Error(`Expected exactly one marker pair for '${name}' in README.md`);
  }

  const startIdx = startMatches[0].index;
  const endIdx = endMatches[0].index;

  if (startIdx === undefined || endIdx === undefined || endIdx <= startIdx) {
    throw new Error(`Missing or invalid marker block for '${name}' in README.md`);
  }

  return content.slice(startIdx + start.length, endIdx).trim();
}

function replaceSlot(html, slot, blockHtml) {
  const slotToken = `<!-- sync-slot:${slot} -->`;
  const generatedStart = `<!-- generated:start:${slot} -->`;
  const generatedEnd = `<!-- generated:end:${slot} -->`;
  const replacement = `${generatedStart}\n${blockHtml}\n${generatedEnd}`;

  if (html.includes(slotToken)) {
    return html.replace(slotToken, replacement);
  }

  const generatedPattern = new RegExp(
    `<!-- generated:start:${escapeRegex(slot)} -->[\\s\\S]*?<!-- generated:end:${escapeRegex(slot)} -->`,
    "m",
  );

  if (!generatedPattern.test(html)) {
    throw new Error(`Missing slot or generated block for '${slot}' in install/index.html`);
  }

  return html.replace(generatedPattern, replacement);
}

function renderQuickStart(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^###\s+/.test(line)) {
      out.push(`<h3>${renderInline(line.replace(/^###\s+/, "").trim())}</h3>`);
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      i += 1;
      const code = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      if (i >= lines.length) {
        throw new Error("Unclosed code fence in quick-start block");
      }
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      i += 1;
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const paragraph = [line.trim()];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^###\s+/.test(lines[i]) &&
      !lines[i].startsWith("```")
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    out.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return out.join("\n\n");
}

function renderFeatures(markdown) {
  const lines = markdown.split(/\r?\n/);
  const cards = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const featureMatch = line.match(/^- \*\*(.+?):\*\*\s*(.*)$/);
    if (featureMatch) {
      if (current) cards.push(current);
      current = {
        title: featureMatch[1].trim(),
        intro: featureMatch[2].trim(),
        bullets: [],
      };
      continue;
    }

    const bulletMatch = line.match(/^\s{2,}-\s+(.+)$/);
    if (bulletMatch && current) {
      current.bullets.push(bulletMatch[1].trim());
      continue;
    }
  }
  if (current) cards.push(current);

  if (cards.length === 0) {
    throw new Error("No features parsed from README markers");
  }

  const cardsHtml = cards
    .map((card) => {
      const intro = card.intro ? `<p>${renderInline(card.intro)}</p>\n` : "";
      const bullets = card.bullets.map((item) => `    <li>${renderInline(item)}</li>`).join("\n");
      const list = card.bullets.length > 0 ? `<ul>\n${bullets}\n  </ul>` : "";
      return `<div class="feature">
  <h4>${renderInline(card.title)}</h4>
  ${intro}${list}
</div>`;
    })
    .join("\n\n");

  return `<div class="features">
${cardsHtml}
</div>`;
}

function renderPowerShellReference(markdown) {
  const lines = markdown.split(/\r?\n/);
  const groups = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const inlineGroupMatch = line.match(/^- \*\*(.+?):\*\*\s+(.+)$/);
    if (inlineGroupMatch) {
      if (current) groups.push(current);
      groups.push({
        title: inlineGroupMatch[1].trim(),
        items: [inlineGroupMatch[2].trim()],
      });
      current = null;
      continue;
    }

    const groupMatch = line.match(/^- \*\*(.+?):\*\*$/);
    if (groupMatch) {
      if (current) groups.push(current);
      current = { title: groupMatch[1].trim(), items: [] };
      continue;
    }

    const itemMatch = line.match(/^\s{2,}-\s+(.+)$/);
    if (itemMatch && current) {
      current.items.push(itemMatch[1].trim());
    }
  }

  if (current) groups.push(current);

  if (groups.length === 0) {
    throw new Error("No PowerShell reference groups parsed from README markers");
  }

  return groups
    .map((group) => {
      const items = group.items.map((item) => `    <li>${renderInline(item)}</li>`).join("\n");
      return `<h3>${renderInline(group.title)}</h3>
<ul>
${items}
</ul>`;
    })
    .join("\n\n");
}

function renderInline(text) {
  let output = escapeHtml(text);
  output = output.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    return `<a href="${escapeAttr(url)}">${escapeHtml(label)}</a>`;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return output;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(text) {
  return text.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
