const login_url = "https://admin.booking.com",
    base_url = "https://account.booking.com";


async function loginFirstStep(credentials, request) {
    const { username, password, partialPhone } = credentials;

    let response = await request.get(login_url),
        html = response.data;

    // Get Token
    console.log("Getting token");
    const token_regex = /\"op_token\":\"([^"]+)\"/,
        token_re = html.match(token_regex),
        client_id_regex = /\"client_id\":\"([^"]+)\"/,
        client_id_re = html.match(client_id_regex);

    if(!token_re) {
        throw new Error("Token not found!");
    }

    if(!client_id_re) {
        throw new Error("Client_id not found!");
    }

    const opToken = token_re[1],
        client_id = client_id_re[1];
    console.log("Token found " + opToken);
    console.log("Client_id found " + client_id);

    // Do login
    console.log("Init login");
    // login first step
    const request_options = {
        url: base_url + "/account/sign-in/login_name",
        data: {
            "login_name": username,
            "op_token": opToken
        },
        method: "POST"
    };

    console.log("Request: " + request_options.url);
    response = await request(request_options);

    // login second step
    request_options.url = base_url + "/account/sign-in/password";
    request_options.data = {
        "login_name": username,
        "password": password,
        "client_id": client_id,
        "state": "",
        "code_challenge": "",
        "code_challenge_method": "",
        "op_token": opToken
    };
    console.log("Request: " + request_options.url);
    response = await request(request_options);
    const phones = response.data.phones_info.sms,
        authorizationToken = response.data.authorization_token;

    const phoneInfo = phones.find((phone) => phone.masked.indexOf(partialPhone) != -1),
        phoneHash = phoneInfo.hash;

    console.log("Init sms verification");
    const tokens = {opToken, phoneHash, authorizationToken},
        smsRequired = true; //TODO revisar en la respuesta si es necesaria la verificación
    return { smsRequired, tokens };
}


async function loginSecondStep(options, request) {
    const { smsToken, authorizationToken, opToken, phoneHash } = options;

    // SMS verification
    const request_options = {
        url: base_url + "/account/send/2fa-pin",
        data: {
            "type": "sms",
            "authorization_token": authorizationToken,
            "phone_id": phoneHash,
            "op_token": opToken
        },
        method: "POST"
    };
    console.log("Request: " + request_options.url);
    let response = await request(request_options);

    request_options.url = base_url + "/account/sign-in/2fa-pin"
    request_options.data = {
        "type": "sms",
        "authorization_token": authorizationToken,
        "second_factor": smsToken,
        "op_token": opToken
    }
    console.log("Request: " + request_options.url);
    response = await request(request_options);
    response = await request.get(response.data.redirect_uri);

    // Parse Home page
    const html = response.data,
        query = response.request.url.query; //FIXME

    const params = query.split('&')
        .map((q) => {
            const key_val = q.split('=');
            return {
                key: key_val[0],
                val: key_val[1]
            }
        }),
        sessionParam = params.find((p) => p.key == "ses");

    const token_regex = /var token[ ]+= '([^']+)'/,
        token_re = html.match(token_regex);

    if(!token_re) {
        throw new Error("Token not found in home page!");
    }
    if(!sessionParam) {
        throw new Error("Session not found in home page!");
    }

    const tokens = {
        token: token_re[1],
        session: sessionParam.val
    };
   return { tokens };
}


export {
    loginFirstStep,
    loginSecondStep
};
