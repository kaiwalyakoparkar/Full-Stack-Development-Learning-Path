const http = require('http');
const fs = require('fs');
const homeFile = fs.readFileSync('sampleHome.html');

const port = 3000;
const hostname = '127.0.0.1';

const server = http.createServer((req, res) => {
    // res.statusCode = 200;
    // res.setHeader('Content-text','text/html');
    res.writeHead(200, {'Content-text':'text/html'});
    res.end(homeFile);
})

server.listen(port, hostname, () =>{
// server.listen(3000, '127.0.0.1',()=>{
    console.log(`Started the server on http://${hostname}:${port}`);
})
