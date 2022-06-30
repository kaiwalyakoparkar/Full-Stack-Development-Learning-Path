"use strict";
function getCustomer(id) {
    return id === 0 ? null : { dob: new Date() };
}
let customer = getCustomer(1);
console.log(customer === null || customer === void 0 ? void 0 : customer.dob.getFullYear());
//# sourceMappingURL=index.js.map