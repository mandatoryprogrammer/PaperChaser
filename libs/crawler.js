const api = require('./api.js');
const parser = require('./parsing.js');

const { Parser } = require('json2csv');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const RESULTS_CSV_FIELDS = [
	"id",
    "title",
    "mime",
    "created",
    "modified",
    "version",
    "parent_folders",
    "permissions",
    "owners",
    "can_edit",
    "trashed"
];

const json2csvParser = new Parser({
	fields: RESULTS_CSV_FIELDS,
	header: false,
});

async function crawl(seed_ids, config, initial_ids_to_crawl_queue, initial_already_crawled_ids) {
	// Use the same UUID suffix per execution
	const execution_id = uuidv4();
	// File name to append results to
	const results_spreadsheet = `enumerated-google-drive-files-${execution_id}.csv`;

	console.log(`[NOTICE] Appending all crawled Drive files to ${results_spreadsheet}`);

	// ID(s) that still need to be crawled.
	var ids_to_crawl_queue = [];

	// Already crawled ID(s)
	var already_crawled_ids = new Set();

	process.on('SIGINT', function() {
		console.log(`[NOTICE] Interrupt detected, flushing queue and results before quitting out...`);
		flush_results_to_disk(
			execution_id,
			already_crawled_ids,
			ids_to_crawl_queue
		);
		process.exit();
	});

	// Append starting ID(s) to the queue
	ids_to_crawl_queue = parser.unique(ids_to_crawl_queue.concat(seed_ids));

	while(ids_to_crawl_queue.length > 0) {
		// Pop off a new drive file to crawl
		const crawl_canidate_id = ids_to_crawl_queue.pop();

		console.log(`[STATUS] Crawling Drive file ${crawl_canidate_id}, to-crawl queue has ${ids_to_crawl_queue.length} file(s) with ${already_crawled_ids.size} already crawled.`)

		// Extract data for the Drive file
		const drive_file_data = await api.get_drive_file_data(
			crawl_canidate_id,
			config
		);

		if(drive_file_data === null) {
			already_crawled_ids.add(crawl_canidate_id);
			continue
		}

		const drive_file_links = drive_file_data.links;

		// Append new data to CSV spreadsheet
		const csv_object = get_csv_row_object_from_metadata(
			drive_file_data.metadata
		);
		const new_csv_row = json2csvParser.parse(csv_object) + `\n`;
		fs.appendFileSync(
			results_spreadsheet,
			new_csv_row
		);

		// Mark ID as crawled
		already_crawled_ids.add(crawl_canidate_id);

		// Extract Google Drive ID(s) from links extracted from file
		const new_drive_ids = parser.get_ids_from_urls(drive_file_links);

		// Add newly-enumerated ID(s) to the crawl queue
		new_drive_ids.map(drive_id => {
			if(!ids_to_crawl_queue.includes(drive_id) && !already_crawled_ids.has(drive_id)) {
				ids_to_crawl_queue.unshift(drive_id);
			}
		});
	}

	console.log(`[SUCCESS] Crawl exhausted all items in the queue! Quitting out now...`);
	console.log(`[NOTICE] Check results spreadsheet at ${results_spreadsheet} for the data!`);
	flush_results_to_disk(
		execution_id,
		already_crawled_ids,
		ids_to_crawl_queue
	);
	process.exit();
}

function get_csv_row_object_from_metadata(input_metadata) {
	const parent_folders = input_metadata.parents.map(parent_metadata => {
		return `https://drive.google.com/drive/folders/${parent_metadata.id}`;
	}).join(" ");

	const permissions = `${input_metadata.userPermission.id}:${input_metadata.userPermission.role}`;

	const owners = input_metadata.owners.map(owner_metadata => {
		const owner_email = owner_metadata.emailAddress ? owner_metadata.emailAddress : '';
		const owner_name = owner_metadata.displayName ? `(${owner_metadata.displayName})` : '';
		return `${owner_email} ${owner_name}`;
	}).join("; ");

	return {
		title: input_metadata.title,
		id: input_metadata.id,
		mime: input_metadata.mimeType,
		created: input_metadata.createdDate,
		modified: input_metadata.modifiedDate,
		version: input_metadata.version,
		created: input_metadata.createdDate,
		parent_folders: parent_folders,
		permissions: permissions,
		owners: owners,
		can_edit: input_metadata.capabilities.canEdit,
		trashed: input_metadata.explicitlyTrashed,
	}
}

function flush_results_to_disk(execution_id, already_crawled_ids, ids_to_crawl_queue) {
	const already_crawled_filename = `crawled-ids-${execution_id}.json`;
	const remaining_queue_filename = `crawl_remaining_queue-${execution_id}.json`;

	if(already_crawled_ids.size > 0) {
		fs.writeFileSync(
			already_crawled_filename,
			JSON.stringify(
				Array.from(already_crawled_ids)
			)
		);
		console.log(`[NOTICE] Flushed already-crawled ID(s) to file ${already_crawled_filename}`);
	}

	if(ids_to_crawl_queue.length > 0) {
		fs.writeFileSync(
			remaining_queue_filename,
			JSON.stringify(
				Array.from(ids_to_crawl_queue)
			)
		);
		console.log(`[NOTICE] Flushed ID(s) remaining in the queue to file ${remaining_queue_filename}`);
	}
}

module.exports = {
	crawl,
}