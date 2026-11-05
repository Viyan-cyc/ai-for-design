const FILE_LIMIT = 500;
const FUNCTION_LIMIT = 100;
const functionTypes = new Set([
  'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression',
  'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod',
]);

function normalize(source) {
  return source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

export function countPhysicalLines(source) {
  const text = normalize(source);
  if (!text) return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

export function checkFileLength(source, file) {
  const actual = countPhysicalLines(source);
  return actual > FILE_LIMIT
    ? [{code: 'FILE_LINES', file, line: 1, actual, limit: FILE_LIMIT}]
    : [];
}

export function checkFunctionLengths(ast, file, lineOffset = 0) {
  const diagnostics = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (functionTypes.has(node.type) && node.loc) {
      const actual = node.loc.end.line - node.loc.start.line + 1;
      if (actual > FUNCTION_LIMIT) {
        diagnostics.push({
          code: 'FUNCTION_LINES', file,
          line: node.loc.start.line + lineOffset,
          actual, limit: FUNCTION_LIMIT,
          name: node.id?.name || node.key?.name || node.key?.id?.name || 'anonymous',
        });
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'tokens', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  return diagnostics;
}

export function shouldCheckSourceSize(relativePath, source, scaffoldSource = null) {
  const file = relativePath.replace(/\\/g, '/').replace(/^\/?src\//, '');
  if (!/\.(vue|m?js|css|less|json)$/.test(file)) return false;
  if (file.startsWith('assets/icons/')) return false;
  const fixedTheme = /^assets\/themes\/(base|bridge|default|dark)\.less$/.test(file);
  return !(fixedTheme && scaffoldSource !== null && normalize(source) === normalize(scaffoldSource));
}
