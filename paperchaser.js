#!/usr/bin/env node
const { program } = require('commander');
const util = require('util');
const fs = require('fs');

const config = require('./config.json');
const api = require('./libs/api.js');
const parser = require('./libs/parsing.js');
const crawler = require('./libs/crawler.js');

/*
	TODO:
	* Check comments left in Doc/Sheet/Slide for links as well.
		* https://developers.google.com/drive/api/v2/reference/comments/list
	* Add support for pulling embedded documents inside of one-another. We should
	be extracting the ID(s) of these Drive items as well.
		* Sheet chart in Slides
		* Sheet chart in docs
*/

(async () => {
	// TODO add sanity check for access_token here

	program.version('0.0.1');
	program
	.command('extract <drive_id>')
	.description('Extract all Google Drive/Doc/Sheet/Slide ID(s) from a given Drive file.')
	.action(async (drive_id) => {
		const drive_file_data = await api.get_drive_file_data(
			drive_id,
			config
		);

		console.log(drive_file_data.links.join("\n"));
	});

	program
	.command('crawl <seed_drive_urls_file>')
	//.option('-cids, --crawled-ids', 'Already-crawled Drive file ID list from a previous run')
	//.option('-sq, --starting-queue', 'Drive file ID(s) to load the queue with from a previous run')
	.description('Using a set of Google Drive URL(s) as starting seeds, recursively crawl and enumerate Drive files shared to the authenticated user by link.')
	.action(async (seed_drive_urls_file) => {
		var drive_urls_file_data = false;
		try {
			drive_urls_file_data = fs.readFileSync(seed_drive_urls_file);
		} catch (e) {
			console.error(`Error occurred while reading file of seed Drive URL(s). Does the file exist?`);
			process.exit(-1);
		}

		// Convert into lines of Drive URL(s)
		const input_drive_ids = parser.get_ids_from_urls(drive_urls_file_data.toString().split("\n"));

		if(input_drive_ids.length == 0) {
			console.error(`No valid Drive ID(s) could be parsed from the file you provided!`);
			process.exit(-1);
		}

		await crawler.crawl(
			input_drive_ids,
			config,
			[],
			[]
		);
	});

	program.parse(process.argv);
	const options = program.opts();
})();
