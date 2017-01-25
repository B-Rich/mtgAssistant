var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var DocumentDBClient = require('documentdb').DocumentClient;
var config = require('./config');
var url = require('url');

var app = express();

var client = new DocumentDBClient(config.endpoint, { "masterKey": config.primaryKey });
var HttpStatusCodes = { NOTFOUND: 404 };
var databaseUrl = 'dbs/${config.database.id}';
var collectionUrl = `${databaseUrl}/colls/${config.collection.id}`;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.route('/sets')
    .get(function(req,res){
        GetSets(function(d){
            console.log(d);
            res.send(d)
        });
        
    })
    .post(function(req,res){
        let auth = req.body.auth;
        if(auth === '000123'){
            let setCollection = [];
            CreateDbAndCollection(function(){
                GetMtgContent('https://api.magicthegathering.io/v1/sets',function(d){
                let sets = JSON.parse(d);
                let count = sets.sets.length;
                sets.sets.map(function(set, index){
                    var obj = {
                        "name": set.name,
                        "code": set.code,
                        "releaseDate": set.releaseDate,
                        "iconClass": "ss ss-" + set.code.toLowerCase()
                    };
                    AddDocument(obj);
                });
                res.send(setCollection); 
                })
            })
        } else {
            res.send('Authorization Code Incorrect.');
        }
    })

app.listen(3000, function() {
    console.log("Shh...I'm listening on port 3000")
})

var GetMtgContent = function(url, callback){
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            if(callback){
                callback(body); // Show the HTML for the Google homepage. 
            }
        }
    });
}

var CreateDbAndCollection = function(callback){
    getDatabase()
    .then(() => getCollection())
    .then(() => { callback(); })
    .catch((error) => { exit('Completed with error ${JSON.stringify(error)}') });
}

function getDatabase() {
    console.log(`Getting database:\n${config.database.id}\n`);
    return new Promise((resolve, reject) => {
        client.readDatabase(databaseUrl, (err, result) => {
            if (err) {
                if (err.code == HttpStatusCodes.NOTFOUND) {
                    client.createDatabase(config.database, (err, created) => {
                        if (err) reject(err)
                        else resolve(created);
                    });
                } else {
                    reject(err);
                }
            } else {
                resolve(result);
            }
        });
    });
}

function getCollection() {
    console.log(`Getting collection:\n${config.collection.id}\n`);
    return new Promise((resolve, reject) => {
        client.readCollection(collectionUrl, (err, result) => {
            if (err) {
                if (err.code == HttpStatusCodes.NOTFOUND) {
                    client.createCollection(databaseUrl, config.collection, { offerThroughput: 400 }, (err, created) => {
                        if (err) reject(err)
                        else resolve(created);
                    });
                } else {
                    reject(err);
                }
            } else {
                resolve(result);
            }
        });
    });
}

function AddDocument(document){
    let documentUrl = `${collectionUrl}/docs/${document.id}`;
    client.createDocument(collectionUrl, document, function (err, document) {
        if (err) {
            console.log(err);
        } else {
            console.log('created ' + document.id);
        }
    });
}

function GetSets(callback){
    client.queryDocuments(collectionUrl, 'SELECT * FROM Sets f').toArray(function (err, results) {
        if (err) {
            handleError(err);

        } else if (results.length == 0) {
            throw ("No documents found matching");

        }  else { 
            if(callback){
                callback(results);
            }
        }
    });
}

function exit(message) {
    console.log(message);
    console.log('Press any key to exit');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', process.exit.bind(process, 0));
}