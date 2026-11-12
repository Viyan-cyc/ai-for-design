export function exampleHTML(preset){
 return `<!doctype html><meta charset="utf-8"><title>Grid预设复现</title><h1>已有Grid参数样例</h1><p>先启动依赖 component-studio-n2 0.1.0，再打开此链接。需要匹配的Grid基线，不是自包含新组件。</p><a href="http://127.0.0.1:4173/#preset=${encodeURIComponent(JSON.stringify(preset))}">在本地Studio复现参数</a>`;
}
