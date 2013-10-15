file-geocoder
==============

Geocodes a file (JSON or CSV). Talks to a Google-style geocoder.

## Examples

#### Geocode a JSON file, hit http://localhost:8080 ([how to setup a local geocoder](http://www.datasciencetoolkit.org/ "Data Science Tookit")):
```sh
file-geocoder \
	-f data.json \
	-a Address,City,State,Zip # list of fields containing the address, in order
```		
		

#### Geocode a CSV file, hit Google, throttle geocoding requests to 1 per second ([read up on their usage limits](https://developers.google.com/maps/documentation/geocoding/#Limits "usage limits")):
```sh
file-geocoder \
	-f data.csv \
	-t csv \ # file type - specify if not json
	-a Address,City,State,Zip \ # list of fields containing the address, in order
	-h maps.googleapis.com \ # geocoding host
	-p 80 \ # geocoding port
	-s 1 # time (in seconds) to throttle the geocoding requests
```


#### Your laptop battery died before the geocoder finished. No problem. file-geocoder stores its work on a .db file. Let's resume the geocoding: 
```sh
file-geocoder \
	-d data.db \ # database
	-a Address,City,State,Zip # list of fields containing the address, in order
```

## install

	npm install file-geocoder -g
	
