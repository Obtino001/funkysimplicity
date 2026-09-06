const http = require('http');
const fs = require('fs');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const target = pages.find(p => p.url.includes('products/argus-leggings-cream-black'));
    const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      let id = 1;
      const send = (method, params = {}) => {
        return new Promise((resolve) => {
          const currentId = id++;
          const handler = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id === currentId) {
              ws.removeEventListener('message', handler);
              resolve(msg.result);
            }
          };
          ws.addEventListener('message', handler);
          ws.send(JSON.stringify({ id: currentId, method, params }));
        });
      };

      (async () => {
        // Reload page to get fresh server-rendered Liquid
        await send('Page.reload');
        console.log('Page reloading...');
        await new Promise(r => setTimeout(r, 4000));

        // Check payment icons
        const paymentCheck = await send('Runtime.evaluate', {
          expression: `(() => {
            const icons = document.querySelectorAll('.payment-icons .icon, .payment-icons svg');
            return {
              count: icons.length,
              types: Array.from(icons).map(i => i.getAttribute('aria-labelledby') || i.className.baseVal || i.tagName)
            };
          })()`,
          returnByValue: true
        });
        console.log('Payment icons count & types:', paymentCheck.result.value);

        // Capture screenshot of top (with payment icons)
        const ss0 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`c:/Users/Yasir/.gemini/antigravity-ide/brain/ff3808ba-daea-4aa1-9fcc-697c0e68a066/verify_top_payment_icons.png`, Buffer.from(ss0.data, 'base64'));

        // Scroll to 400 and check sticky
        await send('Runtime.evaluate', {
          expression: `(() => {
            const pw = document.querySelector('.page-wrapper');
            if (pw) pw.scrollTop = 400;
            window.scrollTo(0, 400);
          })()`
        });
        await new Promise(r => setTimeout(r, 500));

        const scroll400Check = await send('Runtime.evaluate', {
          expression: `(() => {
            const gallery = document.querySelector('.mo-product-gallery-section');
            const header = document.querySelector('#header-component');
            const r = el => el ? {
              top: Math.round(el.getBoundingClientRect().top),
              bottom: Math.round(el.getBoundingClientRect().bottom),
              height: Math.round(el.getBoundingClientRect().height)
            } : null;
            return {
              headerBottom: r(header)?.bottom,
              gallery: r(gallery)
            };
          })()`,
          returnByValue: true
        });
        console.log('Scroll 400 check:', scroll400Check.result.value);

        const ss400 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`c:/Users/Yasir/.gemini/antigravity-ide/brain/ff3808ba-daea-4aa1-9fcc-697c0e68a066/verify_scroll_400.png`, Buffer.from(ss400.data, 'base64'));

        // Scroll to 700
        await send('Runtime.evaluate', {
          expression: `(() => {
            const pw = document.querySelector('.page-wrapper');
            if (pw) pw.scrollTop = 700;
            window.scrollTo(0, 700);
          })()`
        });
        await new Promise(r => setTimeout(r, 500));

        const ss700 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`c:/Users/Yasir/.gemini/antigravity-ide/brain/ff3808ba-daea-4aa1-9fcc-697c0e68a066/verify_scroll_700.png`, Buffer.from(ss700.data, 'base64'));

        ws.close();
      })();
    };
  });
});
