#!/usr/bin/env node

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var swig = require('swig');

var redis = require('redis');
var client = redis.createClient();

var user = require('./user.json');

// redis names
var dataset = 'datapoints';
var latest_key = 'LATEST';

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.set('view cache', false);

app.use(bodyParser.urlencoded({ extended: true }));

// Serve the static files
app.use(express.static(__dirname + '/site'));

app.get('/data', function(req,res) {
  res.setHeader('Content-Type', 'application/json');
  var items = ['wc_book', 'wc_date', 'wc_count', 'wc_hours', 'wc_role'];
  client.sort(dataset, 'GET', '*->wc_book', 'GET', '*->wc_date', 'GET', '*->wc_count', 'GET', '*->wc_hours', 'GET', '*->wc_role', function(err, reply) {
    var data = [];
    if (reply != null) {
      for (var i=0; i<reply.length/items.length; i++) {
        var point = {};
        for (var j=0; j<items.length; j++) {
          point[items[j]] = reply[(i*items.length)+j];
        }
        if (filterResults(point)) {
          point = mapResults(point);
          data.push(point);
        }
      }
    }
    res.send(data);
  });
});

function filterResults(value) {
  var vd = new Date(value.wc_date);
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  if (vd < cutoff) {
    // remove this from redis?
    return false;
  }
  return true;
}

function mapResults(value) {
  value.wc_count = +(value.wc_count);
  value.wc_hours = +(value.wc_hours);
  return value;
}

app.get('/update', function(req, res) {
  var previous = {wc_book: "", wc_count: 0, username: ""}; // default previous
  client.get(latest_key, function(err, latest) {
    if (latest == null) {
      send_update_form(res, previous);
    } else {
      client.hgetall(latest, function (err, reply) {
        if (reply != null) {
          send_update_form(res, reply);
        } else {
          send_update_from(res, previous);
        }
      });
    }
  });
});

function send_update_form(res, previous) {
  var d = new Date();
  res.render('update', {today: d.toISOString().substring(0,10), previous: previous});
}

app.post('/update', function(req,res) {
  reply = req.body;
  if (reply.username != user.user || reply.passwrd != user.password) {
    res.send("Incorrect Username/Password");
    return;
  }
  client.hmset(reply.wc_date, reply, function(err, rep) {
    if (rep !== null) {
      res.redirect('/');
      // Add this to the dataset
      client.sadd(dataset, reply.wc_date, function (err, res) {});
      // Make this the latest update
      client.set(latest_key, reply.wc_date, function (err, res) {});
    } else {
      res.send("There was an error, please try again");
    }
  });
});

app.listen(3030, function () {
  console.log('Listening on port 3030!');
});
