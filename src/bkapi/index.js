import { loginFirstStep, loginSecondStep } from './login';
import { searchReservations } from './reservations';
import axios from 'axios';

import axiosCookieJarSupport from 'axios-cookiejar-support';
import tough from 'tough-cookie';

axiosCookieJarSupport(axios);
const cookieJar = new tough.CookieJar();

function Booking(credentials) {
    const state = {
            tokens: {}
        },
        client = axios.create({
            jar: cookieJar,
            withCredentials: true,
            timeout: 2000,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (X11; Linux x86_64; rv:60.0) Gecko/20100101 Firefox/60.0',
                Accept: '*/*',
                'content-type': 'application/json',
                'x-requested-with': 'XMLHttpRequest',
                origin: 'https://account.booking.com'
            }
        });

    return {
        login: async ({ smsToken = null }) => {
            if (smsToken) {
                const completeOptions = Object.assign(
                    {},
                    options,
                    state.tokens
                );
                const { tokens } = await loginSecondStep(
                    completeOptions,
                    client
                );
                state.tokens = tokens;
                return { smsRequired: false };
            }
            const { smsRequired, tokens } = await loginFirstStep(
                credentials,
                client
            );
            state.tokens = tokens;
            return { smsRequired };
        },
        searchReservations: async options => {
            if (!state.tokens.session) {
                throw new Error('Login required');
            }
            return searchReservations(
                options,
                state.tokens.session,
                client
            );
        }
    };
}

export { Booking };
