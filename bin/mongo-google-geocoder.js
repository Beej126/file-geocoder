var fs = require('fs');
var optimist = require('optimist');
var NeDB = require('nedb');
var d3 = require('d3');
var _ = require('lodash');
var async = require('async');
var geocoder = require('geocoder');
var sleep = require('sleep');
var util = require('util');

var argv = optimist
	.usage('Geocode a file (JSON or CSV). Talks to a Google-style geocoder.\nUsage: $0')
	.options('f', {
		demand: true,
		alias: 'file',
		describe: 'JSON or CSV file to be geocoded'
	})
	.options('a', {
		demand: true,
		alias: 'fields',
		describe: 'comma-separated list of address fields, in order'
	})
	.options('t', {
		demand: false,
		alias: 'type',
		'default': 'json',
		describe: 'whether the file is JSON or CSV'
	})
	.options('d', {
		demand: false,
		alias: 'database',
		describe: 'database containing records. If specified, will ignore file input.',
		'default': null
	})
	.options('h', {
		demand: false,
		alias: 'host',
		describe: 'geocoder host',
		'default': 'localhost'
	})
	.options('p', {
		demand: false,
		alias: 'port',
		describe: 'geocoder port',
		'default': 8080
	})
	.options('s', {
		demand: false,
		alias: 'throttle',
		describe: 'time (in seconds) to throttle the geocoding requests',
		'default': 0
	})
	.argv;

var count;
var db;
var filename = argv.file.split('.')[0];
if (argv.database) {

	// connect to db
	db = new NeDB({
		filename: argv.database,
		autoload: true // automatic loading
	});

} else {

	// parse file
	var file = fs.readFileSync(argv.file, 'utf8');

	var json = argv.type.toLowerCase() === 'json'
		? JSON.parse(file)
		: d3.csv.parse(file);

	// connect to db
	db = new NeDB({
		filename: filename,
		autoload: true // automatic loading
	});
	
	// clear db
	db.remove({}, { multi: true});
	
	// insert all records
	async.each(json,
		function (doc, callback) {
			db.insert(doc, function (err, newDoc) {
				callback(err);
			});
		},
		function (err) {
			if (!err) {
				console.log('Imported ' + json.length + ' records.');
			}
		});

}

var summary = [];
var counter = 0;

// get all the records with no geocode status
db.find({GeocodeStatus: {$exists: false}}, function(err, docs) {

	// tell pace how many elements we're going to process
	var pace = require('pace')({
		total: docs.length,
		itemType: 'records'
	});

	// iterate over each record
	async.each(docs,
		function(doc, callback) {

			// create the address
			var address = argv.fields.split(',').map(function(value) {
				return doc[value];
			}).join(', ');

			// geocode
			geocoder.geocode(address, function (err, data) {
	
				var status = data.status;
				var updates = {};
				var locality = '';
				var administrative_area_level_1 = '';
				var country = '';

				try {

					if (status === 'ZERO_RESULTS') {
					} else {

						status = data.results[0].geometry.location_type;
						var coords = data.results[0].geometry.location;
						updates = {GeocodeLat: coords.lat, GeocodeLng: coords.lng};

						// find the locality
						locality = _(data.results[0].address_components)
							.filter(function(v) {
								return _.contains(v.types, 'locality');
							})
							.first(1)
							.pluck('long_name')
							.value()[0];

						// find the administrative_area_level_1
						administrative_area_level_1 = _(data.results[0].address_components)
							.filter(function(v) {
								return _.contains(v.types, 'administrative_area_level_1');
							})
							.first(1)
							.pluck('long_name')
							.value()[0];

						// find the country
						country = _(data.results[0].address_components)
							.filter(function(v) {
								return _.contains(v.types, 'country');
							})
							.first(1)
							.pluck('long_name')
							.value()[0];
					}
				} catch(e) {
					console.log(JSON.stringify(data, null, 4));
					throw e;
				}

				summary.push(status);
				updates.GeocodeStatus = status;
				updates.GeocodeLocality = locality;
				updates.GeocodeAdminAreaLevel1 = administrative_area_level_1;
				updates.GeocodeCountry = country;
				updates.FullAddress = address;

				db.update({_id:doc._id}, {$set:updates}, function(err, inserted) {

					counter++;

					pace.op(counter);
					sleep.sleep(argv.throttle);

					// call async with callback
					callback(err);

				});

			}, {}, argv.host, argv.port);

		},
		function(err) {

			console.log("Summary:");
			console.log(JSON.stringify(_.countBy(summary, function(v) { return v; }), null, 2));

			// export records
			db.find({}, function(err, docs) {

				// no need for _id on output
				docs.forEach(function(doc) {
					delete doc._id;
				});

				if (argv.type === 'csv') {
					var output = d3.csv.format(docs);
					util.print('Writing to ' + filename + '-output.csv...');
					fs.writeFileSync(filename + '-output.csv', output);
					util.print(' done.\n');
				} else {
					util.print('Writing to ' + filename + '-output.json...');
					fs.writeFileSync(filename + '-output.json', JSON.stringify(docs, null, 4));
					util.print(' done.\n');
				}

			});

		});

});
