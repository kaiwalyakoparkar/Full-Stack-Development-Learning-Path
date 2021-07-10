## Commands to Create a new collection and add documents to it

1. `show dbs` ----> Will show all the dbs present on the computer
2. `use db-name` ----> Will create new collection if not present already

- `show collections` ----> Shows the collestions present

3. `db.items.insertOne({name: "sample-name", age: 18})` ---> Will add one document to db
4. `db.items.insertMany([{{name: "sample-name-1", age: 1},{name: "sample-name-2", age: 2}])` ---> Will add many documents into the db.
5. `dp.intems.find()` ---> Shows all the enties made in the db.
6. `show collections` ---> shows all the the collections. From the above commands it will show items (because of db.**items**.<operation>)
