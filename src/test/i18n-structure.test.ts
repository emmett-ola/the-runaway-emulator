/// <reference types="node" />
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { zh_cn } from '../lib/i18n/locales/zh_cn';
import { copy, renderedExpectations as baseline } from './i18n-copy';

type Tree = { [key: string]: string | Tree };
const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function lookup(tree: Tree, path: string): string | Tree | undefined {
  return path.split('.').reduce<string | Tree | undefined>((value, key) => typeof value === 'object' ? value[key] : undefined, tree);
}

describe('i18n retained component structure and approved copy', () => {
  it('one module CARDS retains all eight records, order and Chinese card strings; sentinels stay empty keys', () => {
    const source = parse('src/pages/games/GamesHub.tsx');
    const declarations: ts.VariableDeclaration[] = [];
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && ['CARDS', 'cards', 'localCards'].includes(node.name.getText(source))) declarations.push(node);
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(declarations).toHaveLength(1);
    const declaration = declarations[0];
    expect(declaration.name.getText(source)).toBe('CARDS');
    expect(ts.isSourceFile(declaration.parent.parent.parent)).toBe(true);
    expect(declaration.type?.getText(source)).toBe('Card[]');
    expect(ts.isArrayLiteralExpression(declaration.initializer!)).toBe(true);
    const cards = (declaration.initializer as ts.ArrayLiteralExpression).elements.map(node => Object.fromEntries((node as ts.ObjectLiteralExpression).properties.map(p => {
      const property = p as ts.PropertyAssignment;
      const value = property.initializer;
      return [property.name.getText(source), ts.isStringLiteral(value) ? value.text : ts.isNumericLiteral(value) ? Number(value.text) : value.kind === ts.SyntaxKind.TrueKeyword];
    })));
    expect(cards.map((card, index) => ({
      id: card.id, number: card.number,
      name: lookup(zh_cn, String(card.nameKey)), description: lookup(zh_cn, String(card.descKey)),
      rarity: card.rarity, owned: card.owned, count: card.count,
      nameKey: card.nameKey, descKey: card.descKey,
      expectedNameKey: `games.card_${index + 1}_name`, expectedDescKey: `games.card_${index + 1}_desc`,
    }))).toEqual(baseline.cards.map((card, index) => ({ ...card,
      nameKey: `games.card_${index + 1}_name`, descKey: `games.card_${index + 1}_desc`,
      expectedNameKey: `games.card_${index + 1}_name`, expectedDescKey: `games.card_${index + 1}_desc`,
    })));
    const text = source.text;
    expect(text).toContain('const cardsPerPage = 6;');
    expect(text).toContain('CARDS.slice(startIndex, endIndex)');
    expect(text).toContain('CARDS.forEach');
    expect(text).toContain('const isEmptyCard = !card.nameKey;');
    expect(text).toMatch(/nameKey: '',\s+descKey: ''/);
    expect(text).toContain('i18n.t(card.nameKey)');
    expect(text).toContain('i18n.t(card.descKey)');
    for (const rarity of ['common', 'uncommon', 'rare', 'legendary']) expect(text).toContain(`${rarity}: i18n.t('games.rarity_${rarity}')`);
    expect(text).not.toContain('.toUpperCase()');
  });
  it('Print and Album add no subscriptions; both date formatters use the component language map', () => {
    const hub = readFileSync('src/pages/games/GamesHub.tsx', 'utf8');
    const print = parse('src/features/print/PrintCalendar.tsx');
    expect(hub).not.toContain('onLanguageChange');
    expect(print.text).not.toContain('onLanguageChange');
    expect(print.text).toContain('firstDay.getDay()');
    expect(print.text).toContain('LOCALE_TAGS[i18n.getLanguage()]');
    const formatters: ts.CallExpression[] = [];
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'toLocaleDateString') formatters.push(node);
      ts.forEachChild(node, visit);
    }
    visit(print);
    expect(formatters).toHaveLength(2);
    for (const call of formatters) expect(call.arguments[0].getText(print)).toBe('localeTag');
  });
  it('new zh_tw strings use the exact approved Traditional forms, not their Simplified alternatives', () => {
    const text = Object.values(copy).map(values => values.zh_tw).join('\n');
    expect(text).not.toMatch(/[历关闭梦续撑鱼达滩说辞职开启实财务传页张选择语设图显颜]/);
    for (const word of ['列印日曆', '關閉', '噩夢', '週一早上的您', '咖啡續命', '撐過', '摸魚達人', '嚮往自由', '海灘', '辭職的您', '開啟', '實現財務自由', '傳說', '頁', '張', '選擇語言', '背景圖形']) expect(text).toContain(word);
  });
});
