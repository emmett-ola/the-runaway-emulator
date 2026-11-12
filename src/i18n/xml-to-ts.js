import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

// Read literals without executing TS; keep source ranges so unrelated bytes stay intact.
function readTranslation(text, locale) {
  const source = ts.createSourceFile(`${locale}.ts`, text, ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) throw new Error(`Malformed TypeScript: ${locale}`);
  const declarations = source.statements
    .filter(statement => ts.isVariableStatement(statement)
      && statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
    .flatMap(statement => [...statement.declarationList.declarations])
    .filter(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === locale);
  if (declarations.length !== 1) throw new Error(`Expected one exported translation object: ${locale}`);

  function read(node, path) {
    if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      return { value: node.text, node };
    }
    if (!node || !ts.isObjectLiteralExpression(node)) {
      throw new Error(`Expected a string or literal object in TS: ${path || locale}`);
    }
    const children = new Map();
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)
        || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
        throw new Error(`Unsupported TS property: ${path || locale}`);
      }
      const key = property.name.text;
      const childPath = path ? `${path}.${key}` : key;
      if (children.has(key)) throw new Error(`Duplicate TS key: ${childPath}`);
      children.set(key, read(property.initializer, childPath));
    }
    return { children, node };
  }
  const tree = read(declarations[0].initializer, '');
  if (!tree.children) throw new Error(`Expected a translation object: ${locale}`);
  return { source, tree };
}

function mergeXML(xml, tree, source) {
  let dom;
  try {
    dom = new JSDOM(xml, { contentType: 'application/xml' });
  } catch (error) {
    throw new Error(`Malformed XML: ${error.message}`);
  }
  const edits = [];
  try {
    const document = dom.window.document;
    if (document.doctype) throw new Error('DOCTYPE is not supported');
    const root = document.documentElement;
    if (root.tagName !== 'translations') throw new Error('Expected <translations> root');
    for (const node of document.childNodes) {
      if (node !== root && node.nodeType !== 8) throw new Error('Unsupported XML node outside root');
    }

    function merge(element, expected, path) {
      if (element.attributes.length) throw new Error(`Attributes are not supported: ${path || 'translations'}`);
      for (const node of element.childNodes) {
        if (![1, 3, 4, 8].includes(node.nodeType)) throw new Error(`Unsupported XML node: ${path || 'translations'}`);
      }
      const children = [...element.children];
      if (!expected.children) {
        // Markup belongs in escaped text or CDATA, never in the translation tree.
        if (children.length) throw new Error(`Shape mismatch: ${path} must be a string`);
        const value = element.textContent;
        if (value !== expected.value) {
          edits.push({ start: expected.node.getStart(source), end: expected.node.end, text: JSON.stringify(value) });
        }
        return;
      }
      const seen = new Set();
      for (const child of children) {
        const childPath = path ? `${path}.${child.tagName}` : child.tagName;
        if (seen.has(child.tagName)) throw new Error(`Duplicate key: ${childPath}`);
        seen.add(child.tagName);
        if (!expected.children.has(child.tagName)) throw new Error(`Unknown key: ${childPath}`);
      }
      if (path && !children.length) throw new Error(`Shape mismatch: ${path} must be an object`);
      for (const node of element.childNodes) {
        if ((node.nodeType === 3 || node.nodeType === 4) && /\S/.test(node.textContent)) {
          throw new Error(`Unexpected text in object: ${path || 'translations'}`);
        }
      }
      for (const child of children) {
        merge(child, expected.children.get(child.tagName), path ? `${path}.${child.tagName}` : child.tagName);
      }
    }
    merge(root, tree, '');
    return edits;
  } finally {
    dom.window.close();
  }
}

function leafCount(tree) {
  return tree.children ? [...tree.children.values()].reduce((count, child) => count + leafCount(child), 0) : 1;
}

function generate(directory) {
  const xmlFiles = readdirSync(directory).filter(file => file.endsWith('.xml')).sort();
  if (!xmlFiles.length) throw new Error('No locale XML files found');
  // Validate and prepare every locale before writing any locale.
  const prepared = xmlFiles.map(file => {
    const locale = basename(file, '.xml');
    const destination = join(directory, 'translations', `${locale}.ts`);
    if (!existsSync(destination)) throw new Error(`Missing existing translation module: ${locale}`);
    try {
      const original = readFileSync(destination, 'utf8');
      const { source, tree } = readTranslation(original, locale);
      const edits = mergeXML(readFileSync(join(directory, file), 'utf8'), tree, source);
      let output = original;
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
      }
      return { locale, destination, original, output, count: leafCount(tree) };
    } catch (error) {
      throw new Error(`${locale}: ${error.message}`);
    }
  });
  for (const { locale, destination, original, output, count } of prepared) {
    const changed = output !== original;
    if (changed) writeFileSync(destination, output);
    console.log(`${locale}: ${changed ? 'updated' : 'unchanged'} (${count} string leaves)`);
  }
}

try {
  if (process.argv.length > 3) throw new Error('Usage: node src/i18n/xml-to-ts.js [i18n-directory]');
  generate(process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('.', import.meta.url)));
} catch (error) {
  console.error(`Translation generation failed: ${error.message}`);
  process.exitCode = 1;
}
