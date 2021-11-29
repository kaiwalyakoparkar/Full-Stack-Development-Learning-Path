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
};

app.get('/route', handlerFunction);
```

================ 3. Advance (Can be added in seperate file) =============

```js
const handlerFunction = (req, res) => {
  //Handler code
};

app
  .route('/route')
  .get(handlerFunction)
  .otherHTTPrequest(otherHandler);
```

```
req.params - returns the extension to the url eg: original url api/v1/tours and if we add api/v1/tours/12345 then /12345 is a parameter attached to the request
```

```
req.query - returns the query fields added to url eg: original url api/v1/tours and if we want to filter the response then we can add api/v1/tours?difficulty=easy here {difficulty: easy} is the query attached to the request (after ?)
```
