## Updating the documents in the db

1. `db.items.updateOne({name: "Samsung 30s"},{$set: {price: 18000}})` ---> Takes the **2** object. Fist selects the document to update and second one updates according to the passed parameter.
2. `db.items.updateMany({$or: [{param1}, {param2}]},{$set: {update}})` ---> Considers all the params and then updates the specified update
   eg: `db.items.updateMany({$or:[{rating: 4.5},{rating: 3.5}]},{$set: {qty: 500}})`
