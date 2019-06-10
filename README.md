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

    const booking = Booking({ username, password, partialPhone });

    let response = await booking.login();
    if (response.smsRequired === true) {
        const smsToken = await getSms();
        response = await booking.login({ smsToken });
        console.log('Response: ' + JSON.stringify(response));
        // List properties
        const propertiesResponse = await booking.listProperties({
            hotelAccountId: hotelAccountId
        });
        console.log(
            'Properties: ' + JSON.stringify(propertiesResponse)
        );

        // Reservations
        const reservationsResponse = await booking.searchReservations(
            {
                dateFrom: '2019-04-01',
                dateTo: '2019-06-05',
                hotelAccountId: hotelAccountId
            }
        );
        console.log(
            'Reservations: ' + JSON.stringify(reservationsResponse)
        );

        const cardsPromises = reservationsResponse.data.reservations.map(
            reservation =>
                booking.getCardFromReservation({
                    hotelId: reservation.hotel_id,
                    reservationId: reservation.id
                })
        );
        const cards = await Promise.all(cardsPromises);
        console.log('CardDetails: ' + JSON.stringify(cards));
        //
    }
}

main();
```
