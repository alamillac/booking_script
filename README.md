# BKAPI

## Getting Started

### Installing

npm:

```
$ npm install bkapi
```

### Examples

#### Login

```js
import { Booking } from 'bkapi';
import readline from 'readline';

function getSms() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve, reject) => {
        rl.question(`Escriba el sms de booking obtenido:`, resolve);
    });
}

async function main() {
    const username = 'USERNAME',
        password = 'PASSWORD',
        partialPhone = '1234',
        hotelId = 7079999;

    const booking = Booking({ username, password, partialPhone });
    let response = await booking.login();
    if (response.smsRequired === true) {
        const smsToken = await getSms();
        response = await booking.login({ smsToken });
        const reservations = await booking.searchReservations({
            dateFrom: '2019-04-01',
            dateTo: '2019-06-05',
            hotelAccountId: hotelId
        });
    }
}

main();
```
