const base_url = 'https://admin.booking.com';

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
    return await request(request_options);
}

export { searchReservations };
