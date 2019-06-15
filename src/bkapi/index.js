import { login } from './login';
import {
    searchReservations,
    getCardFromReservation
} from './reservations';
import { listProperties } from './properties';
import axios from 'axios';

import axiosCookieJarSupport from 'axios-cookiejar-support';
import tough from 'tough-cookie';

axiosCookieJarSupport(axios);
const cookieJar = new tough.CookieJar();

function Booking(credentials, getSmsfn) {
    const state = {
            session: null
        },
        client = axios.create({
            jar: cookieJar,
            withCredentials: true,
            timeout: 10000,
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
        login: async () => {
            const { session } = await login(
                credentials,
                getSmsfn,
                client
            );
            state.session = session;
            return session;
        },
        searchReservations: async options => {
            if (!state.session) {
                throw new Error('Login required');
            }
            return searchReservations(options, state.session, client);
        },
        listProperties: async options => {
            if (!state.session) {
                throw new Error('Login required');
            }
            return listProperties(options, state.session, client);
        },
        getCardsFromReservations: async optionsList => {
            if (!state.session) {
                throw new Error('Login required');
            }
            if (optionsList.length == 0) {
                return [];
            }
            const response = [];
            for (let options of optionsList) {
                // We can't do this on parallel
                const cardResponse = await getCardFromReservation(
                    options,
                    credentials,
                    state.session,
                    getSmsfn,
                    client
                );
                response.push(cardResponse);
            }
            return response;
        }
    };
}

export { Booking };
