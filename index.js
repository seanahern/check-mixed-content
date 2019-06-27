#!/usr/bin/env node
'use strict';
const Crawler = require('easycrawler')
const cheerio = require('whacko')
const colors = require('colors');
const argv = require('yargs').argv
const ora = require('ora')
const rp = require('request-promise')

let attributeTypes = ['src','srcset','href']
let goodCount = 0, badCount = 0

//These are the elements to check for mixed content
let elementsToCheck = ['img','iframe','script','object','form','embed','video','audio','source','param','link']

let processURL = (url) => {
	return new Promise((resolve, reject) => {
		let bad = false

		var options = {
			uri: url,
			transform: function(body) {
				return cheerio.load(body)
			}
		}

		return rp(options).then(function($) {

			let currAttr;

			for (let element of elementsToCheck) {
					$(element).each((index, item) => {
							for(let attribute of attributeTypes) {
									currAttr = $(item).attr(attribute);
									if(currAttr && currAttr.indexOf('http:') > -1) {
											bad = true;
									}
							}
					})
			}

			if (bad) {
					console.log(colors.red(`===> ${url} has active mixed content!`))
					badCount++
			} else {
					console.log(colors.green(`${url} is OK!`))
					goodCount++
			}

			resolve();

		})
	});
}

let initCrawler = function(urlToCrawl, threads) {
	let url = argv.url || urlToCrawl;
	let thread = argv.thread || threads || 1
	let depth = argv.depth || 3
	let debug = argv.debug

	if (url.indexOf('https:') == -1) url = 'https://' + url
	let urlList = [];
	//Check these attributes for mixed content
	const starting = ora().start();
	starting.text = "Building list of pages to check..."
	let crawler = new Crawler({
			thread: thread,
			logs: debug,
			depth: depth,
			headers: {'user-agent': 'foobar'},
			onlyCrawl: [url], //will only crawl urls containing these strings
			//reject : ['rutube'], //will reject links containing rutube
			onSuccess: function (data) {
					urlList.push(data.url)
			},
			onError: function (data) {
					console.log(data.url)
					console.log(data.status)
			},
			onFinished: async function (urls) {
					starting.succeed(`Found ${urlList.length} pages`);
					let processingPromises = urlList.map(function(url) {
						return processURL(url);
					});

					await Promise.all(processingPromises).then(function(results) {
						console.log(`\nCrawled ${urls.crawled.length} pages`)
						console.log(`${goodCount} pages are good`)
						console.log(`${badCount} pages have mixed HTTP/HTTPS content`)
						 if (debug) {
								console.log(urls.discovered)
								console.log(urls.crawled)
						}
						if (badCount) {
								process.exitCode = 1
						}
						console.log("Ok done!")
					});

			}
	})
	crawler.crawl(url)
}

module.exports = initCrawler
