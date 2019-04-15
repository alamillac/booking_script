var request = require('request-promise');

request = request.defaults({jar: true});

const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
});

const login_url = "https://admin.booking.com",
    base_url = "https://account.booking.com",
    json_headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:60.0) Gecko/20100101 Firefox/60.0",
        "Accept": "*/*",
        "content-type": "application/json",
        "x-requested-with": "XMLHttpRequest",
        "origin": "https://account.booking.com"
    },
    json_options = {
        headers: json_headers,
        json: true,
        method: "POST"
    };


function login(credentials) {
    const username = credentials.username,
        password = credentials.password,
        partial_phone = credentials.partial_phone;

    const get_token = (html) => {
        console.log("Getting token");
        return new Promise((resolve, reject) => {
            const token_regex = /\"op_token\":\"([^"]+)\"/,
                token_re = html.match(token_regex),
                client_id_regex = /\"client_id\":\"([^"]+)\"/,
                client_id_re = html.match(client_id_regex);

            if(!token_re) {
                reject("Token not found!");
                return;
            }

            if(!client_id_re) {
                reject("Client_id not found!");
                return;
            }

            const op_token = token_re[1],
                client_id = client_id_re[1];
            console.log("Token found " + op_token);
            console.log("Client_id found " + client_id);
            resolve({op_token: op_token, client_id: client_id});
        });
    };


    const do_login = (login_params) => {
        console.log("Init login");
        // login first step
        const request_options = Object.assign({}, json_options, {
            uri: base_url + "/account/sign-in/login_name",
            body: {
                "login_name": username,
                "op_token": login_params.op_token
            },
        });

        console.log("Request: " + request_options.uri);
        return request(request_options)
            .then((response) => {
                // login second step
                request_options.uri = base_url + "/account/sign-in/password";
                request_options.body = {
                    "login_name": username,
                    "password": password,
                    "client_id": login_params.client_id,
                    "state": "",
                    "code_challenge": "",
                    "code_challenge_method": "",
                    "op_token": login_params.op_token
                };
                console.log("Request: " + request_options.uri);
                return request(request_options);
            })
            .then((response) => Promise.resolve({response: response, op_token: login_params.op_token}));
    };


    const get_sms_second_factor = () => {
        return new Promise((resolve, reject) => {
            readline.question(`Escriba el sms de booking obtenido:`, resolve);  // TODO obtener de esendex o similar
        });
    };


    const sms_verification = (login_response) => {
        console.log("Init sms verification");
        const verification_required = true;  //TODO revisar en la respuesta si es necesaria la verificación

        if(!verification_required) {
            debugger; // c -> repl
            return Promise.resolve(login_response); // TODO redirigir a la home
        }

        const authorization_token = login_response.response.authorization_token,
            op_token = login_response.op_token,
            phones = login_response.response.phones_info.sms;

        const phone_info = phones.find((phone) => phone.masked.indexOf(partial_phone) != -1);

        const request_options = Object.assign({}, json_options, {
            uri: base_url + "/account/send/2fa-pin",
            body: {
                "type": "sms",
                "authorization_token": authorization_token,
                "phone_id": phone_info.hash,
                "op_token": op_token
            }
        });

        console.log("Request: " + request_options.uri);
        return request(request_options)
            .then(get_sms_second_factor)
            .then((second_factor) => {
                request_options.uri = base_url + "/account/sign-in/2fa-pin"
                request_options.body = {
                    "type": "sms",
                    "authorization_token": authorization_token,
                    "second_factor": second_factor,
                    "op_token": op_token
                }
                console.log("Request: " + request_options.uri);
                return request(request_options);
            })
            .then((response) => request.get({uri: response.redirect_uri, resolveWithFullResponse: true}));
    };


    const parse_home_page = (response) => {
        const html = response.body,
            query = response.request.uri.query;

        const params = query.split('&')
            .map((q) => {
                const key_val = q.split('=');
                return {
                    key: key_val[0],
                    val: key_val[1]
                }
            }),
            session_param = params.find((p) => p.key == "ses");

        const token_regex = /var token[ ]+= '([^']+)'/,
            token_re = html.match(re_token);

        return new Promise((resolve, reject) => {
            if(!token_re) {
                reject("Token not found in home page!");
                return;
            }
            if(!session_param) {
                reject("Session not found in home page!");
                return;
            }

            resolve({
                token: token_re[1],
                session: session_param.val
            });
        });
    };

    return request.get(login_url)
        .then(get_token)
        .then(do_login)
        .then(sms_verification)
        .then(parse_home_page);
}


module.exports = (credentials) => {
    var authorization = null;  //token & session
    return {
        login: () => login(credentials).then((a) => authorization = a)
    }
};
