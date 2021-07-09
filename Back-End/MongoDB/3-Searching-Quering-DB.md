1. `db.items.find()` ---> Will show all the documents in the database

### Finds through document for the exact rating
2. `db.items.find({rating: 3.5})` ---> Will show all the documents where rating is 3.5

### Extra operators
gt: greater than
gte: greater than equal to
lt: lower than
lte: lower than equal to.

- This finds greater than equal to 3.5
3. `db.items.find({rating: {$gte: 3.5}})`

- This finds greater to 3.5
4. `db.items.find({rating: {$gt: 3.5}})`

- This is AND operator (no need to write 'add', &, &&)
5. `db.items.find({rating: {$lt: 3.5}, price: {$gt: 1000}})`

- This is OR operator adding in `$or[{..},{..}];`
6. `db.items.find({$or:[{rating: {$lt 3.5}},{price: {$gt: 114000}}]})`

- Only filters the specified field
7. `db.items.find({rating: {$gt: 3.5}} , {rating: 1})`