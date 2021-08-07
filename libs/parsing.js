/*
    Some constant values useful for parsing.
*/
const URL_REGEX = '(https?|ftp):\\/\\/(\\S+(:\\S*)?@)?(([1-9]|[1-9]\\d|1\\d\\d|2[0-1]\\d|22[0-3])(\\.([0-9]|[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-5])){2}(\\.([1-9]|[1-9]\\d|1\\d\\d|2[0-4]\\d|25[0-4]))|(([a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(\\.([a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(\\.([a-z\\u00a1-\\uffff]{2,})))(:\\d{2,5})?(\\/[^\\s]*)?';
const DRIVE_ID_REGEX = '.*[^-\\w]([-\\w]{25,})[^-\\w]?.*';
const VALID_DRIVE_ORIGINS = [
    'https://drive.google.com',
    'https://docs.google.com',
    'https://sheets.google.com',
];

// From: 
// https://gist.github.com/sphvn/dcdf9d683458f879f593
// https://gist.github.com/sphvn/dcdf9d683458f879f593#gistcomment-3223840
// Credit to https://gist.github.com/sphvn and https://gist.github.com/rmkane
const traverse = function(o, fn, scope = []) {
    for (let i in o) {
        fn.apply(this, [i, o[i], scope]);
        if (o[i] !== null && typeof o[i] === "object") {
            traverse(o[i], fn, scope.concat(i));
        }
    }
}

/*
	Specify a JSON path partial and if it ends with it, it'll be appended as a match:

	['test']
	['test']['nest']
	['test']['get']
	['test']['get']['me']
*/
function get_object_nested_values(key_id, input_object) {
	var matches = [];
    traverse(input_object, (key, value, scope) => {
    	const current_key = `[${scope.concat(key).map(k => isNaN(k) ? `'${k}'` : k).join('][')}]`;
    	if(current_key.endsWith(key_id)) {
            matches.push(value);
    	}
    });

    return matches;
}

/*
    Extract all URL(s) in a string.
*/
function get_urls_in_string(input_string) {
    const find_urls_regex = new RegExp(URL_REGEX, 'ig');
    var matches = [];
    let m;
    while ((m = find_urls_regex.exec(input_string)) !== null) {
        if (m.index === find_urls_regex.lastIndex) {
            find_urls_regex.lastIndex++;
        }

        matches.push(m[0]);
    }
    return matches;
}

/*
    Extract all URL(s)/link(s) from the provided Drive file structure.

    For Google Docs/Sheets/etc.

    @drive_item_data: The full JavaScript object for the item being parsed.
    @native_link_selectors: Key(s) that the object attribute starts with
                            e.g.: ['link']['url'], ['link']['uri']
    @text_element_selectors: Key(s) that the object attribute starts with
                            e.g.: ['textRun']['content'], ['userEnteredValue']['stringValue']
*/
function get_all_drive_file_links(drive_item_data, native_link_selectors, text_element_selectors) {
    // First we'll extract all native links via the selectors provided
    var native_links = [];
    native_link_selectors.map(native_link_selector => {
        const extracted_links = get_object_nested_values(
            native_link_selector,
            drive_item_data
        );

        // Append to our master list of extracted native links
        native_links = native_links.concat(extracted_links);
    });

    // Now we extract all text elements via the provided selectors
    // and then use a regular expression to extract links from them.
    var extracted_text_links = [];
    text_element_selectors.map(text_element_selector => {
        // Extract text elements using the current selector
        const extracted_text_elements = get_object_nested_values(
            text_element_selector,
            drive_item_data
        );

        // Check all text elements for URL(s) we can extract
        extracted_text_elements.map(extracted_text_element => {
            if(typeof(extracted_text_element) !== 'string') {
                return;
            }

            // Save ourselves some time, must have http:// or https:// somewhere
            // in the text, otherwise it's not worth even running the regex.
            if(!(extracted_text_element.includes('https://') || extracted_text_element.includes('http://'))) {
                return
            }

            const new_links = get_urls_in_string(extracted_text_element);

            extracted_text_links = extracted_text_links.concat(new_links);
        });
    });

    // Combine all of the extracted links into a final array of URL(s)
    return unique(
        extracted_text_links.concat(native_links)
    );
}

/*
    Takes a list of URL(s) and returns a list of unique Google Drive/Docs/Sheets/Slides ID(s).
*/
function get_ids_from_urls(input_url_array) {
    var drive_ids = input_url_array.map(url => {
        if(typeof(url) !== 'string') {
            return null;
        }

        // On the off chance it's an http:// URL, change it to https://
        if(url.startsWith('http://')) {
            url = url.replace('http://', 'https://');
        }

        // Ensure it's a Google Drive related URL
        const url_object = new URL(url);

        // If it's not one of the valid Google Drive origins we
        // can throw it out.
        if(!VALID_DRIVE_ORIGINS.includes(url_object.origin)) {
            return null;
        }

        // Now that we're fairly sure it can be valid, let's extract
        // that Drive ID from the URL.
        const driveid_regex = new RegExp(DRIVE_ID_REGEX);
        const matches = url.match(driveid_regex);

        // No matches.
        if(!matches || matches.length < 2) {
            return null;
        }

        return matches[1];
    }).filter(drive_id => {
        return drive_id !== null;
    });

    // Make the results unique and return the extracted ID(s)
    return unique(drive_ids);
}

/*
    Make an array unique
*/
function unique(input_array) {
    return [... new Set(input_array)];
}

module.exports = {
    get_object_nested_values,
    get_ids_from_urls,
    get_all_drive_file_links,
    unique,
}