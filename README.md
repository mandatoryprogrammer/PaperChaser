# PaperChaser
## A Google Drive/Docs/Sheets/Slides Enumeration Spider

## Description

This tool allows you to enumerate Google Docs/Sheets/Slides and files which are shared with your Google user "by link". This is an common overshared setting that is applied in Drive but can be challenging to exploit since you have to actually possess the links to the files.

This tool takes seed links to Docs/Sheets/Slides/etc and parses them to find links to other Drive files and recursively parses the results as well. The result is a spreadsheet of enumerated Google Drive files and their metadata.

## Setup

### Install Packages

```
cd paperchaser/
npm install
```

### Add Access Token

Make a copy of this Apps Script project (or just recreate the three lines of code and enabled service(s) on your own Apps Script project): [https://script.google.com/d/1TLhjRGlpDgZ2BxFtQuUMmr6mP_8iegscDX1nNWOXnxXDBdDNC38CG9EQ/edit?usp=sharing](https://script.google.com/d/1TLhjRGlpDgZ2BxFtQuUMmr6mP_8iegscDX1nNWOXnxXDBdDNC38CG9EQ/edit?usp=sharing)

This will print out an `access_token` which you need to put in `config.json`.

(I plan on improving this process later, sorry!)

## Usage

```
$ node paperchaser.js crawl example-seed-file.txt
[NOTICE] Appending all crawled Drive files to enumerated-google-drive-files-2d9c12fb-ec42-4598-97cc-55463cbb51a1.csv
[STATUS] Crawling Drive file 1Ij_5fdBUkZ40uz78VHucPFz5RifqgUukCY6Zmferz7o, to-crawl queue has 2 file(s) with 0 already crawled.
[STATUS] Crawling Drive file 1iExAnuy6Bfs82dyWdcoMsWRwfRdlGFTBB9XXiT_9cmQ, to-crawl queue has 1 file(s) with 1 already crawled.
[STATUS] Crawling Drive file 18F8Z6ZbG6JsagvCh3Hq8unCph-y-3e1pWGbVaqaJ8Ek, to-crawl queue has 1 file(s) with 2 already crawled.
[STATUS] Crawling Drive file 1RtwgOtzZmkmdOwL8UZlIIC-AlusYfTOkE8Tktq8aaA4, to-crawl queue has 1 file(s) with 3 already crawled.
[STATUS] Crawling Drive file 1zMMyR2oBcjgK2PlTMIDn4996JjY5II5UpbD3p1q3cVU, to-crawl queue has 0 file(s) with 4 already crawled.
[SUCCESS] Crawl exhausted all items in the queue! Quitting out now...
[NOTICE] Check results spreadsheet at enumerated-google-drive-files-2d9c12fb-ec42-4598-97cc-55463cbb51a1.csv for the data!
[NOTICE] Flushed already-crawled ID(s) to file crawled-ids-2d9c12fb-ec42-4598-97cc-55463cbb51a1.json
```