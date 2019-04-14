var request = require('request-promise');

request = request.defaults({jar: true});

const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
});

// Credenciales: TODO sacar de fichero config
const username = "test@test.com",
    password = "12341234",
    partial_phone = "2531";


const base_url = "https://account.booking.com",
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

const get_token = (html) => {
    console.log("Getting token");
    return new Promise((resolve, reject) => {
        const token_regex = /\"op_token\":(\w+),/,  //TODO probar con token != null => Ex: "TOKEN"
            token_re = html.match(token_regex);

        if(!token_re) {
            reject("Token not found!");
            return;
        }

        const token = token_re[1];
        if(token === "null") {
            console.log("Null token");
            resolve("");
            return;
        }
        console.log("Token found " + token);
        resolve(token);
    });
};


const do_login = (op_token) => {
    console.log("Init login");
    // login first step
    const request_options = Object.assign({}, json_options, {
        uri: base_url + "/account/sign-in/login_name",
        body: {
            "login_name": username,
            "op_token": op_token
        },
    });

    console.log("Request: " + request_options.uri);
    return request(request_options)
        .then((response) => {
            // login second step
            request_options["uri"] = base_url + "/account/sign-in/password";
            request_options["body"] = {
                "login_name": username,
                "password": password,
                "client_id": "", //TODO ver de donde sale esto
                "state": "",
                "code_challenge": "",
                "code_challenge_method": "",
                "op_token": op_token
            };
            console.log("Request: " + request_options.uri);
            return request(request_options);
        })
        .then((response) => Promise.resolve({response: response, op_token: op_token}));
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
        return Promise.resolve(login_response); // TODO redirigir a la home
    }

    const authorization_token = login_response["response"]["authorization_token"],
        op_token = login_response["op_token"],
        phones = login_response["response"]["phones_info"]["sms"];

    const phone_info = phones.find((phone) => phone["masked"].indexOf(partial_phone) != -1);

    const request_options = Object.assign({}, json_options, {
        uri: base_url + "/account/send/2fa-pin",
        body: {
            "type": "sms",
            "authorization_token": authorization_token,
            "phone_id": phone_info["hash"],
            "op_token": op_token
        }
    });

    console.log("Request: " + request_options.uri);
    return request(request_options)
        .then(get_sms_second_factor)
        .then((second_factor) => {
            request_options["uri"] = base_url + "/account/sign-in/2fa-pin"
            request_options["body"] = {
                "type": "sms",
                "authorization_token": authorization_token,
                "second_factor": second_factor,
                "op_token": op_token
            }
            console.log("Request: " + request_options.uri);
            return request(request_options);
        })
        .then((response) => request.get({uri: response["redirect_uri"], resolveWithFullResponse: true}));
};


const parse_home_page = (response) => {
    const html = response.body;
    // TODO get session from request url [ses param]

    return new Promise((resolve, reject) => {
        const token_regex = /var token[ ]+= '([^']+)'/,
            token_re = html.match(re_token);

        if(!token_re) {
            reject("Token not found in home page!");
            return;
        }
        resolve({
            token: token_re[1]
        });
    });
};

const get_card_list = () => {
    //TODO
};

console.log("Init script");
const home_url = base_url + "/";
console.log("Request: " + home_url);
request.get(home_url)
    .then(get_token)
    .then(do_login)
    .then(sms_verification)
    .then(parse_home_page)
    .then(get_card_list)
    .catch((err) => {
        console.log("Something was wrong!");
        console.log(err);
    });
