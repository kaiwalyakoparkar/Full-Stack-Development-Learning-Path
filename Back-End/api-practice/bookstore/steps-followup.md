- Put command `npm init` and add `server.js` as starting point.
- Run `npm i nodemon express dotenv chalk morgan`
- Add `"start": "nodemon server.js",` in the scripts
- Add following script at the end of `package.json` file
```js
"engines": {
    "node": ">=10.0.0"
}
```
- Add `.gitignore` file and add 
```md
/node_modules/
*.env
```
- Add `.env` & `.sample-env` files
- Create `index.js` file and add basic server starting code. eg: 👇
```js
const express = require('express');
const app = express();

console.log('✅ App Started');

const port = process.env.PORT || 3000;

app.get('/api/v1/books', (req, res) => {
    res.status(200).json({
        'status': 'success',
        'message': 'Everything is working correct'
    });
});

app.listen(port, () => {
    console.log(`✅ Server started at http://localhost:${port}`);
});
```
