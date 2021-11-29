//Using OS Module
const os = require('os');

console.log(os.homedir());//Logs the home directory location
console.log(os.totalmem());//Logs the total memory present in the computer.
console.log(os.freemem());//Logs the free memory available in the computer
console.log(os.type());//Logs the OS present on the computer
console.log(os.uptime());//Logs the total time computer is on.
console.log(os.hostname());//Logs the host name of the computer.