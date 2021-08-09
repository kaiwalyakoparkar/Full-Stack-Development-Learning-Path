
### Evolution of the routers

================ 1. Naive ===============

```js
app.get('/route', (req, res) => {
  //Handler code
});
```
================ 2. Moderate ============

```js
const handlerFunction = (req, res) => {
  //Handler Code
}

app.get('/route', handlerFunction);
```
================ 3. Advance (Can be added in seperate file) =============
```js
const handlerFunction = (req, res) => {
  //Handler code
}

app
  .route('/route')
  .get(handlerFunction)
  .otherHTTPrequest(otherHandler);
```
