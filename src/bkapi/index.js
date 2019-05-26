import { loginFirstStep, loginSecondStep } from './login';
import request from 'request-promise';


function Booking(credentials) {
    let state = {
            tokens: {}
        },
        client = request.defaults({jar: true});

    return {
        login: async (options) => {
            if(options && options.smsToken) {
                const completeOptions = Object.assign({}, options, state.tokens);
                const {tokens} = await loginSecondStep(completeOptions, client);
                state.tokens = tokens;
                return {smsRequired: false}
            }
            const { smsRequired, tokens } = await loginFirstStep(credentials, client);
            state.tokens = tokens;
            return {smsRequired}
        }
    }
}


export {
    Booking
};
