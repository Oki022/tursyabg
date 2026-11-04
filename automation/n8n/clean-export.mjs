// Removes everything private from a workflow exported from n8n, so it can be committed.
// Usage: node automation/n8n/clean-export.mjs <downloaded-workflow.json> <output.json>
//
// - Webhook path: it is the secret part of the webhook URL -> YOUR_SECRET_PATH
// - Telegram chat ID -> YOUR_CHAT_ID
// - Credential references and n8n metadata are dropped (tokens are never in the export,
//   they stay in n8n's credential store).
import fs from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node clean-export.mjs <downloaded-workflow.json> <output.json>");
  process.exit(1);
}

const wf = JSON.parse(fs.readFileSync(input, "utf8").replace(/^﻿/, ""));
const removed = [];

for (const node of wf.nodes ?? []) {
  if (node.type === "n8n-nodes-base.webhook" && node.parameters?.path) {
    removed.push(node.parameters.path);
    node.parameters.path = "YOUR_SECRET_PATH";
  }
  if (node.type === "n8n-nodes-base.telegram" && node.parameters?.chatId) {
    removed.push(String(node.parameters.chatId));
    node.parameters.chatId = "YOUR_CHAT_ID";
  }
  delete node.credentials;
  delete node.webhookId;
}

const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings ?? {} };
const text = JSON.stringify(clean, null, 2) + "\n";

// Safety check: none of the removed values, and nothing that looks like a token, may remain.
const leaks = removed.filter((v) => v && v.length > 3 && text.includes(v));
if (/\d{8,10}:[A-Za-z0-9_-]{30,}/.test(text)) leaks.push("something that looks like a Telegram bot token");
if (text.includes("eyJ")) leaks.push("something that looks like a JWT");
if (leaks.length) {
  console.error("NOT SAVED. Private values are still in the file:", leaks.length);
  process.exit(1);
}

fs.writeFileSync(output, text);
console.log(`Saved ${output}: ${clean.nodes.length} nodes, secret path and chat ID replaced with placeholders.`);
