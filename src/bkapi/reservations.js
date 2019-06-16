import { signIn, getAuthToken } from './login';
import cheerio from 'cheerio';

const base_url = 'https://admin.booking.com';

function makeFormPost(data) {
    return Object.entries(data)
        .map(([key, val]) => `${key}=${val}`)
        .join('&');
}

function getAmount(strAmount) {
    return parseFloat(strAmount.replace(/[^0-9.]/g, ''));
}

function getCurrency(strAmount) {
    return strAmount.replace(/[0-9.]/g, '');
}

function getInputs($form) {
    const inputs = {},
        $inputs = $form.find('input');

    $inputs.each((i, el) => {
        inputs[el.attribs.name] = el.attribs.value;
    });
    return inputs;
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

    if (html.includes('Please choose a verification method')) {
        // 2FA is required
        console.log('2FA required');
        const { partialPhone } = credentials,
            secureBaseUrl = 'https://secure-admin.booking.com/2fa/';

        // Select phone number and send sms
        let $ = cheerio.load(html),
            $form = $('form#select_phone_number'),
            urlAction = $form.attr('action'),
            inputs = getInputs($form),
            formData = {
                dest: inputs.dest,
                check_pin_auth: inputs.check_pin_auth,
                message_type: 'sms',
                ask_pin: '',
                phone_id: '',
                phone_id_call: '',
                phone_id_sms: ''
            };

        $form.find('option').each((i, el) => {
            const $phoneOption = $(el);
            const phoneNumber = $phoneOption.text();
            if (phoneNumber.includes(partialPhone)) {
                const phoneId = $phoneOption.val();
                formData.phone_id = phoneId;
                formData.phone_id_call = phoneId;
                formData.phone_id_sms = phoneId;
            }
        });
        request_options = {
            url: secureBaseUrl + urlAction, // 2fa/verify.html
            data: formData,
            method: 'POST',
            headers: {
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'content-type': 'application/x-www-form-urlencoded',
                Referer: secureBaseUrl + response.request.path
            },
            transformRequest: [
                (data, headers) => {
                    delete headers.common['x-requested-with'];
                    return makeFormPost(data);
                }
            ]
        };
        console.log('Request: ' + request_options.url);
        response = await request(request_options); // send sms token
        html = response.data;

        // Get sms and validate it
        $ = cheerio.load(html);
        $form = $('form#enter_security_pin');
        urlAction = $form.attr('action');
        const smsToken = await getSms();
        inputs = getInputs($form);
        formData = {
            ask_pin: smsToken,
            hotel_id: inputs.hotel_id,
            ses: inputs.ses,
            account_id: inputs.account_id,
            dest: inputs.dest,
            pulse: 0,
            pcip: '',
            from_pulse: '',
            check_pin_auth: inputs.check_pin_auth
        };
        request_options = {
            url: secureBaseUrl + urlAction, // 2fa/confirm.html
            data: formData,
            method: 'POST',
            headers: {
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'content-type': 'application/x-www-form-urlencoded',
                Referer: secureBaseUrl + response.request.path
            },
            transformRequest: [
                (data, headers) => {
                    delete headers.common['x-requested-with'];
                    return makeFormPost(data);
                }
            ]
        };
        console.log('Request: ' + request_options.url);
        response = await request(request_options);
        html = response.data;
    }

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
