#!/usr/bin/env node
// One-off codemod: tag each component's root JSX element(s) with
// data-component="ComponentName" for DOM/devtools debugging.
//
// Scope kept deliberately narrow for type-safety: only touches roots that
// are plain intrinsic HTML tags (div, article, button, ...). TypeScript's
// JSX checker only auto-allows arbitrary data-* attributes on intrinsic
// elements, not on custom/wrapped components (Foo, motion.div, Dialog.*),
// so those are skipped and reported instead of risking a tsc error.
//
// Usage: node scripts/add-data-component.mjs [--dry]
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const dry = process.argv.includes("--dry");
const ROOT = path.join(process.cwd(), "components");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      walk(full, out);
    } else if (
      entry.isFile() &&
      full.endsWith(".tsx") &&
      !full.endsWith(".stories.tsx") &&
      !full.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

const isPascalCase = (name) => /^[A-Z][A-Za-z0-9]*$/.test(name);
const isIntrinsicTag = (tagName) =>
  ts.isIdentifier(tagName) && /^[a-z]/.test(tagName.text);

function unwrapParens(expr) {
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  return expr;
}

function collectJsxRoots(name, body, results, skipped) {
  if (!name || !isPascalCase(name) || !body) return;

  const candidates = [];
  if (ts.isBlock(body)) {
    const collect = (node) => {
      if (ts.isReturnStatement(node) && node.expression) {
        candidates.push(unwrapParens(node.expression));
        return;
      }
      if (ts.isFunctionLike(node)) return; // don't leak into nested callbacks/components
      ts.forEachChild(node, collect);
    };
    ts.forEachChild(body, collect);
  } else {
    candidates.push(unwrapParens(body));
  }

  for (const expr of candidates) {
    if (ts.isJsxFragment(expr)) {
      skipped.push(`${name}: root is a Fragment`);
      continue;
    }
    const isEl = ts.isJsxElement(expr);
    const isSelfClosing = ts.isJsxSelfClosingElement(expr);
    if (!isEl && !isSelfClosing) continue; // not a JSX-returning branch
    const opening = isSelfClosing ? expr : expr.openingElement;
    if (!isIntrinsicTag(opening.tagName)) {
      skipped.push(`${name}: root is <${opening.tagName.getText()}> (custom/wrapped component)`);
      continue;
    }
    results.push({ name, opening });
  }
}

function findComponentRoots(sourceFile, skipped) {
  const results = [];
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      collectJsxRoots(node.name.text, node.body, results, skipped);
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        let init = decl.initializer;
        if (
          ts.isCallExpression(init) &&
          ts.isIdentifier(init.expression) &&
          ["forwardRef", "memo"].includes(init.expression.text) &&
          init.arguments.length > 0
        ) {
          init = init.arguments[0];
        }
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          collectJsxRoots(decl.name.text, init.body, results, skipped);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return results;
}

let filesTouched = 0;
let tagged = 0;
const allSkipped = [];

for (const file of walk(ROOT)) {
  const rel = path.relative(process.cwd(), file);
  const text = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const skipped = [];
  const roots = findComponentRoots(sourceFile, skipped);
  if (skipped.length) allSkipped.push(...skipped.map((s) => `${rel} — ${s}`));

  const edits = [];
  for (const { name, opening } of roots) {
    const already = opening.attributes.properties.some(
      (p) => ts.isJsxAttribute(p) && p.name.getText(sourceFile) === "data-component"
    );
    if (already) continue;
    edits.push({ pos: opening.tagName.end, text: ` data-component="${name}"` });
    tagged++;
  }
  if (edits.length === 0) continue;

  edits.sort((a, b) => b.pos - a.pos);
  let newText = text;
  for (const edit of edits) newText = newText.slice(0, edit.pos) + edit.text + newText.slice(edit.pos);

  if (dry) {
    console.log(`[dry] ${rel}: +${edits.length}`);
  } else {
    fs.writeFileSync(file, newText);
  }
  filesTouched++;
}

console.log(`\n${dry ? "[dry] would tag" : "Tagged"} ${tagged} root(s) across ${filesTouched} file(s).`);
if (allSkipped.length) {
  console.log(`\nSkipped (needs manual data-component, or intentionally not intrinsic):`);
  for (const line of allSkipped) console.log(`  - ${line}`);
}
