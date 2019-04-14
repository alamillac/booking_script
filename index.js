const Booking = require('./booking'),
    credentials = require('./credentials');


const booking = Booking(credentials);

const process = () => {
    console.log("Login done!");
};

console.log("Init script");
booking.login()
    .then(() => process)
    .catch((err) => {
        console.log("Something was wrong!");
        console.log(err);
    });
