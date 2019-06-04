const base_url = 'https://account.booking.com';

async function loginFirstStep(credentials, request) {
    const { username, password, partialPhone } = credentials;

    const login_url = 'https://admin.booking.com';
    console.log('Request: ' + login_url);
    let response = await request.get(login_url),
        html = response.data;

    // Get Token
    console.log('Getting token');
    const token_regex = /\"op_token\":\"([^"]+)\"/,
        token_re = html.match(token_regex),
        client_id_regex = /\"client_id\":\"([^"]+)\"/,
        client_id_re = html.match(client_id_regex);

    if (!token_re) {
        throw new Error('Token not found!');
    }

    if (!client_id_re) {
        throw new Error('Client_id not found!');
    }

    const opToken = token_re[1],
        client_id = client_id_re[1];
    console.log('Token found ' + opToken);
    console.log('Client_id found ' + client_id);

    // Do login
    console.log('Init login');
    // login first step
    let request_options = {
        url: base_url + '/account/sign-in/login_name',
        data: {
            login_name: username,
            op_token: opToken
        },
        method: 'POST'
    };

    console.log('Request: ' + request_options.url);
    response = await request(request_options);

    // login second step
    request_options = {
        url: base_url + '/account/sign-in/password',
        data: {
            login_name: username,
            password: password,
            client_id: client_id,
            state: '',
            code_challenge: '',
            code_challenge_method: '',
            op_token: opToken
        },
        method: 'POST'
    };
    console.log('Request: ' + request_options.url);
    response = await request(request_options);
    const phones = response.data.phones_info.sms,
        authorizationToken = response.data.authorization_token;

    const phoneInfo = phones.find(
            phone => phone.masked.indexOf(partialPhone) != -1
        ),
        phoneHash = phoneInfo.hash;

    console.log('Init sms verification');
    //TODO revisar en la respuesta si es necesaria la verificación

    // Send sms if needed
    request_options = {
        url: base_url + '/account/send/2fa-pin',
        data: {
            type: 'sms',
            authorization_token: authorizationToken,
            phone_id: phoneHash,
            op_token: opToken
        },
        method: 'POST'
    };
    console.log('Request: ' + request_options.url);
    response = await request(request_options);

    const tokens = { opToken, authorizationToken },
        smsRequired = true;
    return { smsRequired, tokens };
}

async function loginSecondStep(options, request) {
    const { smsToken, authorizationToken, opToken } = options;

    // SMS verification
    let request_options = {
        url: base_url + '/account/sign-in/2fa-pin',
        data: {
            type: 'sms',
            authorization_token: authorizationToken,
            second_factor: smsToken,
            op_token: opToken
        },
        method: 'POST'
    };
    console.log('Request: ' + request_options.url);
    let response = await request(request_options);

    // Redirect to home
    request_options = {
        url: response.data.redirect_uri,
        method: 'GET',
        headers: {
            Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    };
    console.log('Request: ' + request_options.url);
    response = await request(request_options);

    // Get session from Home page
    console.log('Getting session and token from home page');
    const url_path = response.request.path,
        query = url_path.split('?')[1];

    const params = query.split('&').map(q => {
            const key_val = q.split('=');
            return {
                key: key_val[0],
                val: key_val[1]
            };
        }),
        sessionParam = params.find(p => p.key == 'ses');

    if (!sessionParam) {
        throw new Error('Session not found in home page!');
    }

    const tokens = {
        session: sessionParam.val
    };
    console.log('Tokens found');
    return { tokens };
}

export { loginFirstStep, loginSecondStep };
