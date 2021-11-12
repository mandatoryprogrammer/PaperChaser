const _request = require('request-promise-native');

const general = require('./general.js');
const parser = require('./parsing.js');

/*
	We patch all HTTP requests to check the response
	for errors like "access token expired". If we get
	an error like this we'll automagically handle it.

	Note that this basic patch means that all options
	must be passed in as a single object {} argument.
	This is cleaner in any case.
*/
async function request(options) {
	const response = await _request(options);

	// Check response for invalid access token error
	const access_token_expired = is_invalid_access_token_response(response);

	if(access_token_expired) {
		console.error(`[ERROR] Access token is invalid, quitting out...`);
		process.exit(-1);
	}

	return response;
}

function get_base_request_options(config) {
	return {
		'proxy': config.proxy,
		'strictSSL': false,
		'simple': false,
		'resolveWithFullResponse': true,
	}
}

function get_base_headers(config) {
	return {
		'user-agent': 'paperchaser',
		'Authorization': `Bearer ${config.access_token}`
	}
}

/*
	Check HTTP response to see if we've received an error indicating
	that our access_token has expired and that we need to renew it.

	Example:

	HTTP/1.1 401 Unauthorized
	WWW-Authenticate: Bearer realm="https://accounts.google.com/", error="invalid_token"
	Vary: X-Origin
	Vary: Referer
	Content-Type: application/json; charset=UTF-8
	Date: Sun, 25 Jul 2021 22:18:09 GMT
	Server: ESF
	Cache-Control: private
	X-XSS-Protection: 0
	X-Frame-Options: SAMEORIGIN
	X-Content-Type-Options: nosniff
	Alt-Svc: h3=":443"; ma=2592000,h3-29=":443"; ma=2592000,h3-T051=":443"; ma=2592000,h3-Q050=":443"; ma=2592000,h3-Q046=":443"; ma=2592000,h3-Q043=":443"; ma=2592000,quic=":443"; ma=2592000; v="46,43"
	Accept-Ranges: none
	Vary: Origin,Accept-Encoding
	Connection: close
	Content-Length: 297

	{
	  "error": {
	    "code": 401,
	    "message": "Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project.",
	    "status": "UNAUTHENTICATED"
	  }
	}

*/
function is_invalid_access_token_response(response) {
	// Ensure status code is 401
	if(response.statusCode !== 401) {
		return false;
	}

	// Check for invalid access token header
	const wwwauthenticate_header_value = response.caseless.get('www-authenticate');
	if(wwwauthenticate_header_value && wwwauthenticate_header_value.includes('invalid_token')) {
		return true;
	}

	// Check response for error message
	// Get parsed response body in parsed-JSON form.
	var body_data = {};
	try {
		body_data = typeof(response.body) === 'string' ? JSON.parse(response.body) : response.body;
	} catch(e) {
		console.error(e);
		// If this happens it's likely because the
		// response wasn't JSON. If so, then we stop here.
		body_data = false;
	}

	// Error occurred while parsing response, default
	// to marking the response as not an invalid access
	// token error message.
	if(!body_data) {
		return false;
	}

	// Ensure the response body format is what we expect
	if(!("error") in body_data) {
		return false;
	}

	if(typeof(body_data.error) !== 'object' || body_data.error === null) {
		return false;
	}

	// If the code or message match what we're looking for
	// then we can flag this response as an access_token
	// expiration error.
	const error_code_id = body_data.error.status;
	const error_message = body_data.error.message;

	if(error_code_id === 'UNAUTHENTICATED') {
		return true;
	}

	if(typeof(error_message) === 'string' && error_message.startsWith('Request had invalid authentication credentials.')) {
		return true;
	}

	// If we had no luck matching any of the previous cases
	// then we'll default to assuming it's not the response
	// that we were looking for.
	return false;
}

/*
	Retrieves the structure of a Google Doc
	https://developers.google.com/docs/api/reference/rest/v1/documents/get
*/
async function get_google_doc(document_id, config) {
	const response = await request({
		...get_base_request_options(config),
		...{
			'url': `https://docs.googleapis.com/v1/documents/${document_id}`,
			'json': true,
			'headers': get_base_headers(config),
		}
	});
	return response.body;
}

/*
	Retrieves the structure of a Google Sheet
	https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/get
*/
async function get_google_sheet(sheet_id, config) {
	const response = await request({
		...get_base_request_options(config),
		...{
			'url': `https://sheets.googleapis.com/v4/spreadsheets/${sheet_id}?includeGridData=true`,
			'json': true,
			'headers': get_base_headers(config),
		}
	});
	return response.body;
}

/*
	Retrieves the structure of a Google Slide
	https://developers.google.com/slides/api/reference/rest/v1/presentations/get
*/
async function get_google_slides(slides_id, config) {
	const response = await request({
		...get_base_request_options(config),
		...{
			'url': `https://slides.googleapis.com/v1/presentations/${slides_id}`,
			'json': true,
			'headers': get_base_headers(config),
		}
	});
	return response.body;
}

/*
	Retrieves the metadata for a given Google Drive file
	https://developers.google.com/drive/api/v2/reference/files/get
*/
async function get_drive_file_metadata(drive_id, config) {
	const response = await request({
		...get_base_request_options(config),
		...{
			'url': `https://www.googleapis.com/drive/v2/files/${drive_id}`,
			'json': true,
			'headers': get_base_headers(config),
		}
	});
	return response.body;
}

/*
	Gets all result pages for the children of a given Google Drive folder.
*/
async function get_folder_children(folder_id, config) {
	var children = [];
	var next_page_token = null;

	// Initial list request
	const folder_children_response = await _get_folder_children(
		folder_id,
		false,
		config
	);

	children = folder_children_response.items;
	next_page_token = folder_children_response.nextPageToken;

	while(next_page_token) {
		const new_folder_children_response = await _get_folder_children(
			folder_id,
			next_page_token,
			config
		);
		children = children.concat(new_folder_children_response.items);

		// Reset next page token to be null
		next_page_token = null;

		// If there's another page token for the next page, set it.
		if('nextPageToken' in new_folder_children_response) {
			next_page_token = new_folder_children_response.nextPageToken;
		}
	}

	return children;
}

/*
	Gets the children of a given Google Drive folder
	https://developers.google.com/drive/api/v2/reference/children/list
*/
async function _get_folder_children(folder_id, page_token, config) {
	var query_params = {
		'maxResults': 1000,
		'orderBy': ['folder', 'modifiedDate', 'createdDate'].join(','),
	};

	// If there's a page token to continue from, use it.
	if(page_token) {
		query_params.pageToken = page_token;
	}

	const response = await request({
		...get_base_request_options(config),
		...{
			'url': `https://www.googleapis.com/drive/v2/files/${folder_id}/children`,
			'json': true,
			'headers': get_base_headers(config),
			'qs': query_params,
		}
	});
	return response.body;
}

/*
	Takes an object with the "metadata" key set to the Drive File metadata
	structure and adds the relevant Doc/Sheet/Slide data to the "file_data" property.
*/
async function add_drive_file_data(return_data, drive_id, config) {
	if(!return_data.metadata || !return_data.metadata.mimeType) {
		return return_data;
	}

	// Depending on the MIME type returned, issue appropriate API request.
	switch(return_data.metadata.mimeType) {
		// Google Docs
		case 'application/vnd.google-apps.document':
			return_data.body = await get_google_doc(
				drive_id,
				config
			);
			return_data.links = parser.get_all_drive_file_links(
				return_data.body,
				["['link']['url']"],
				[
					"['textRun']['content']", // Text element content
				]
			);
			break;
		// Google Sheets
		case 'application/vnd.google-apps.spreadsheet':
			return_data.body = await get_google_sheet(
				drive_id,
				config
			);
			return_data.links = parser.get_all_drive_file_links(
				return_data.body,
				["['link']['uri']"],
				[
					"['userEnteredValue']['stringValue']", // String values of cells.
					"['note']", // Notes on cells which can contain arbitrary text.
					"['spec']['altText']", // Alt text description for a chart
				]
			);
			break;
		// Google Slides
		case 'application/vnd.google-apps.presentation':
			return_data.body = await get_google_slides(
				drive_id,
				config
			);
			return_data.links = parser.get_all_drive_file_links(
				return_data.body,
				["['link']['url']"],
				[
					"['textRun']['content']", // Text element content
					"['description']", // Alt-text descriptions
					"['title']", // Title of an embedded chart
					"['wordArt']['renderedText']", // Word Art Text
				]
			);
			break;
		case 'application/vnd.google-apps.folder':
			return_data.body = await get_folder_children(
				drive_id,
				config
			);

			// Pull out sub-folder item link(s)
			return_data.links = return_data.body.map(item_in_folder => {
				return `https://drive.google.com/open?id=${item_in_folder.id}`;
			});

			break;
	}

	return return_data;
}

/*
	This does two requests, starting with a metadata request to the following endpoint:
	https://developers.google.com/drive/api/v2/reference/files/get

	The response data will indicate what type of file the ID is for (e.g. Google Doc/
	Slide/Sheet, generic file, etc). Depending on the type of file, a second request
	will be made to get the data structure for the file.

	Some examples of the second request:
	* Slide: get_google_slides(slides_id, config)
	* Sheet: get_google_sheet(sheet_id, config)
	* Doc: get_google_doc(document_id, config)
	* Folder: {{TODO}}

	Return format:

	{
		"metadata": {...metadata API request response data...},
		"body": {...file structure for doc/sheet/slide request...}
	}
*/
async function get_drive_file_data(drive_id, config) {
	// Return data
	var return_data = {
		'id': drive_id,
		'metadata': null,
		'body': null,
		'links': [],
	}

	// Get metadata for Drive file
	return_data.metadata = await get_drive_file_metadata(drive_id, config);

	// If there is a retrievable data structure for the Drive File
	// (e.g. Google Docs/Sheets/Slides), then pull that data as well.
	return_data = await add_drive_file_data(
		return_data,
		drive_id,
		config
	);

	return return_data;
}

module.exports = {
	get_google_doc,
	get_google_sheet,
	get_google_slides,
	get_drive_file_metadata,
	get_drive_file_data,
}