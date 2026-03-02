const fs = require('fs');
const https = require('https');

const files = {
    'package.json': { content: fs.readFileSync('package.json', 'utf8') },
    'next.config.ts': { content: fs.readFileSync('next.config.ts', 'utf8') },
    'tsconfig.json': { content: fs.readFileSync('tsconfig.json', 'utf8') },
    'postcss.config.mjs': { content: fs.readFileSync('postcss.config.mjs', 'utf8') },
    'src/app/page.tsx': { content: fs.readFileSync('src/app/page.tsx', 'utf8') },
    'src/app/layout.tsx': { content: fs.readFileSync('src/app/layout.tsx', 'utf8') },
    'src/app/globals.css': { content: fs.readFileSync('src/app/globals.css', 'utf8') },
};

const data = JSON.stringify({ files });

const options = {
    hostname: 'codesandbox.io',
    port: 443,
    path: '/api/v1/sandboxes/define?json=1',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
        try {
            const json = JSON.parse(body);
            console.log(`URL: https://codesandbox.io/s/${json.sandbox_id}`);
        } catch (e) {
            console.log(body);
        }
    });
});

req.on('error', (e) => {
    console.error(e);
});

req.write(data);
req.end();
