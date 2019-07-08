const base_url = 'https://account.booking.com';

function getSessionFromUrl(urlPath) {
    // Get session from Home page
    console.log('Getting session and token from home page');
    const query = urlPath.split('?')[1];

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

    console.log('Session found');
    return sessionParam.val;
}

function getAuthToken(html) {
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

    return {
        opToken: token_re[1],
        clientId: client_id_re[1]
    };
}

async function signIn(options, request) {
    const { username, opToken, password, clientId } = options;

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
    let response = await request(request_options);

    // login second step
    request_options = {
        url: base_url + '/account/sign-in/password',
        data: {
            login_name: username,
            password: password,
            client_id: clientId,
            state: '',
            code_challenge: '',
            code_challenge_method: '',
            op_token: opToken
        },
        method: 'POST'
    };
    console.log('Request: ' + request_options.url);
    response = await request(request_options);
    return response.data;
}

async function loginFirstStep(credentials, request) {
    const { username, password, partialPhone } = credentials;

    const login_url = 'https://admin.booking.com';
    console.log('Request: ' + login_url);
    let response = await request.get(login_url),
        html = response.data;

    // Get Token
    const { opToken, clientId } = getAuthToken(html);

    // Do login
    console.log('Init login');
    const signInResponse = await signIn(
        { username, opToken, password, clientId },
        request
    );
    if (signInResponse.redirect_uri !== undefined) {
        // Login without 2FA

        // Remove common headers
        const commonHeaders = {
            'content-type': request.defaults.headers['content-type'],
            'x-requested-with':
                request.defaults.headers['x-requested-with']
        };
        delete request.defaults.headers['content-type'];
        delete request.defaults.headers['x-requested-with'];

        // Init redirect
        let request_options = {
            url: signInResponse.redirect_uri,
            method: 'GET',
            headers: {
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                Referer: 'https://account.booking.com/'
            },
            maxRedirects: 0,
            validateStatus: function(status) {
                return status === 302;
            }
        };
        console.log('Request: ' + request_options.url);
        response = await request(request_options);

        request_options = {
            url: response.headers.location,
            method: 'GET',
            headers: {
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                Referer: 'https://account.booking.com/'
            },
            maxRedirects: 0,
            validateStatus: function(status) {
                return status === 302;
            }
        };
        console.log('Request: ' + request_options.url);
        response = await request(request_options);

        // Redirect to home
        request_options = {
            url:
                'https://admin.booking.com' +
                response.headers.location, //Fix stupid redirection
            method: 'GET',
            headers: {
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                Referer: 'https://account.booking.com/'
            },
            maxRedirects: 0
        };
        console.log('Request: ' + request_options.url);
        response = await request(request_options);

        // Set common headers
        request.defaults.headers['content-type'] =
            commonHeaders['content-type'];
        request.defaults.headers['x-requested-with'] =
            commonHeaders['x-requested-with'];

        // Get session from response
        const tokens = {
                session: getSessionFromUrl(response.request.path)
            },
            smsRequired = false;
        return { smsRequired, tokens };
    }

    // 2FA is required
    const phones = signInResponse.phones_info.sms,
        authorizationToken = signInResponse.authorization_token;

    const phoneInfo = phones.find(
            phone => phone.masked.indexOf(partialPhone) != -1
        ),
        phoneHash = phoneInfo.hash;

    console.log('Init sms verification');

    // Send sms if needed
    const request_options = {
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

    return {
        session: getSessionFromUrl(response.request.path)
    };
}

async function login(credentials, getSms, request) {
    const { smsRequired, tokens } = await loginFirstStep(
        credentials,
        request
    );
    if (!smsRequired) {
        return tokens;
    }

    const smsToken = await getSms();
    console.log(`Token received: ${smsToken}`);
    tokens.smsToken = smsToken;

    return await loginSecondStep(tokens, request);
}

export { login, signIn, getAuthToken };
