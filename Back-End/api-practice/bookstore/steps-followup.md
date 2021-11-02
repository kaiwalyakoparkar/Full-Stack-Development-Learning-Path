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