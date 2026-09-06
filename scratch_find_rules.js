const http = require('http');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const target = pages.find(p => p.url.includes('products/argus-leggings-cream-black'));
    const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      let id = 1;
      const send = (method, params = {}) => ws.send(JSON.stringify({ id: id++, method, params }));

      ws.onmessage = (event) => {
        const res = JSON.parse(event.data);
        if (res.result && res.result.result) {
          console.log('MATCHED PARENT RULES:\n', res.result.result.value);
          ws.close();
        }
      };

      send('Runtime.evaluate', {
        expression: `(() => {
          let el = document.querySelector('#dropdown-language-results .language-name');
          const results = [];
          while (el && el.id !== 'header-component') {
            const matched = [];
            for (const sheet of document.styleSheets) {
              try {
                for (const rule of sheet.cssRules) {
                  if (rule.selectorText && el.matches(rule.selectorText) && rule.cssText.includes('color')) {
                    matched.push({ selector: rule.selectorText, cssText: rule.cssText });
                  }
                }
              } catch(e){}
            }
            results.push({ tag: el.tagName, class: el.className, id: el.id, matched });
            el = el.parentElement;
          }
          return JSON.stringify(results, null, 2);
        })()`,
        returnByValue: true
      });
    };
  });
});
