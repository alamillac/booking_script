const base_url = 'https://admin.booking.com';

async function listProperties({ hotelAccountId }, session, request) {
    const request_options = {
        url: `${base_url}/fresa/extranet/group/home/list_properties?lang=xu&ses=${session}`,
        method: 'POST',
        headers: {
            Accept: 'application/json, text/plain, */*',
            'content-type': 'application/json'
        },
        data: {
            filters: '{"search_term":"","show_closed":1}',
            hotel_account_id: hotelAccountId,
            limit: 30,
            offset: 0,
            sort_by: '{"field_name":"property_id","ascending":false}'
        }
    };
    console.log('Request: ' + request_options.url);
    const response = await request(request_options);
    return response.data;
}

export { listProperties };
