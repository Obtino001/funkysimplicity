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
          console.log('PAYMENT ICONS CHECK:\n', res.result.result.value);
          ws.close();
        }
      };

      send('Runtime.evaluate', {
        expression: `(() => {
          return {
            hasPaymentIcons: !!document.querySelector('.payment-icons'),
            footerPaymentIcons: document.querySelectorAll('.footer .payment-icons__item').length
          };
        })()`,
        returnByValue: true
      });
    };
  });
});
