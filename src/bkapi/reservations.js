import { signIn, getAuthToken } from './login';
import cheerio from 'cheerio';

const base_url = 'https://admin.booking.com';

function getAmount(strAmount) {
    return parseFloat(strAmount.replace(/[^0-9.]/g, ''));
}

function getCurrency(strAmount) {
    return strAmount.replace(/[0-9.]/g, '');
}

async function searchReservations(options, session, request) {
    const { dateFrom, dateTo, hotelAccountId } = options;
    const typeOfDates = options.typeOfDates || 'arrival';

    const request_options = {
        url: `${base_url}/fresa/extranet/group/reservations/search_reservations?lang=xu&ses=${session}`,
        method: 'POST',
        headers: {
            Accept: 'application/json, text/plain, */*',
            'content-type': 'application/json'
        },
        data: {
            page: 1,
            per_page: 50,
            type_of_dates: typeOfDates,
            date_from: dateFrom,
            date_to: dateTo,
            only_pending_requests: false,
            show_cancelled: false,
            only_booking_suite: false,
            engine_version: 1,
            hotel_account_id: hotelAccountId
        }
    };
    console.log('Request: ' + request_options.url);
    const response = await request(request_options);
    return response.data;
}

async function getCardFromReservation(
    options,
    credentials,
    session,
    getSms,
    request
) {
    const { hotelId, reservationId } = options;
    const { username, password } = credentials;

    // Get authorization url
    let request_options = {
        //url: `${base_url}/hotel/hoteladmin/extranet_ng/manage/booking.html?res_id=${reservationId}&hotel_id=${hotelId}&lang=xu&ses=${session}&date_from=2019-06-10&date_to=2019-06-11&date_type=arrival`,
        url: `${base_url}/hotel/hoteladmin/extranet_ng/manage/booking.html?res_id=${reservationId}&hotel_id=${hotelId}&lang=xu&ses=${session}`,
        method: 'GET',
        headers: {
            Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    };
    console.log('Request: ' + request_options.url);
    let response = await request(request_options),
        html = response.data;
    const authorizationUrlRe = /href=\"(https:\/\/account.booking.com\/oauth2\/authorize[^"]+)\"/,
        authorizationUrlMatch = html.match(authorizationUrlRe);

    if (!authorizationUrlMatch) {
        throw new Error('Reservation detail not found!');
    }

    // Sign in
    const authorizationUrl = authorizationUrlMatch[1];
    console.log('Request: ' + authorizationUrl);
    response = await request.get(authorizationUrl);
    html = response.data;

    const { opToken, clientId } = getAuthToken(html);
    const signInResponse = await signIn(
        { username, opToken, password, clientId },
        request
    );

    //TODO 2FA getSms

    // Redirect to home
    request_options = {
        url: signInResponse.redirect_uri,
        method: 'GET',
        headers: {
            Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    };
    console.log('Request: ' + request_options.url);
    response = await request(request_options);
    html = response.data;

    // Parsing html to get card info
    const $ = cheerio.load(html);
    const cardDetails = {
        reservationId: reservationId,
        charged: 0,
        availableBalance: 0,
        currency: '',
        cardNumber: '',
        cardType: '',
        cardHolderName: '',
        expirationDate: '',
        CVC: ''
    };
    const chargedRe = /You've already charged\s+<span>([^<]+)<\/span>/,
        chargedMatch = html.match(chargedRe);

    if (chargedMatch) {
        cardDetails.charged = getAmount(chargedMatch[1]);
    }
    $('table table tr')
        .slice(1)
        .each((i, el) => {
            const $td = $(el).find('td');
            const key = $td.eq(0).text(),
                value = $td.eq(1).text();
            switch (key) {
                case 'Available balance:':
                    cardDetails.availableBalance = getAmount(value);
                    cardDetails.currency = getCurrency(value);
                    break;
                case 'Card type:':
                    cardDetails.cardType = value;
                    break;
                case 'Card number:':
                    cardDetails.cardNumber = value
                        .split(' ')
                        .join('');
                    break;
                case "Card holder's name:":
                    cardDetails.cardHolderName = value;
                    break;
                case 'Expiration Date:':
                    cardDetails.expirationDate = value
                        .split(' ')
                        .join('');
                    break;
                case 'CVC Code:':
                    cardDetails.CVC = value;
                    break;
            }
        });

    if (cardDetails.availableBalance === 0) {
        console.log(html);
    }
    return cardDetails;
}

export { searchReservations, getCardFromReservation };
