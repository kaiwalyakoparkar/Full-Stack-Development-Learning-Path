## Command to Delete a document in Mongo DB

1. `db.items.deleteOne({price: 2000})` ---> This will delete the first document from the found documents.
2. `db.itemss.deleteMany({price: 2000})` ---> This will delete every matching document found.
