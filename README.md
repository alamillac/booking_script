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

async function doLogin() {
    const username = "USERNAME",
        password = "PASSWORD",
        partialPhone = "1234";

    const booking = Booking({username, password, partialPhone});
    let response = await booking.login();
    if(response.smsRequired === true) {
        const smsToken = await getSms();
        response = await booking.login({smsToken});
    }
}

doLogin()
```
