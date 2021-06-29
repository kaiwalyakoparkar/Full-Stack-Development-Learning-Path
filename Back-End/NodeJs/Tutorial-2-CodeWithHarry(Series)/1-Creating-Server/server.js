//This code is available here: https://nodejs.org/en/about/

const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    // res.setHeader('Content-Type', 'text/plain');
    //res.end('Hello World');
    
    //This will render html file
    res.setHeader('Content-Type', 'text/html');
    res.end(`
        <h1>Hey this is H1</h1>
    `);
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
