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
        hotelAccountId = 7079999;

    const booking = Booking(
        { username, password, partialPhone },
        getSms
    );
    // Reservations
    const reservationsResponse = await booking.searchReservations({
        dateFrom: '2019-06-01',
        dateTo: '2019-06-05',
        hotelAccountId: hotelAccountId
    });
    console.log(
        'Reservations: ' + JSON.stringify(reservationsResponse)
    );

    const reservationsId = reservationsResponse.data.reservations.map(r => ({hotelId: r.hotel_id, reservationId: r.id}))
    const cardDetails = await booking.getCardsFromReservations(reservationsId);
    console.log('CardDetails: ' + JSON.stringify(cardDetails));
    }
}

main();
```
