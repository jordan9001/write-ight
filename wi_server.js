#!/usr/bin/env node

var async = require('async');

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var swig = require('swig');

var redis = require('redis');
var client = redis.createClient();

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.set('view cache', false);

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('site'));

app.get('/data', function(req,res) {
  res.setHeader('Content-Type', 'application/json');
  client.keys('*', function(err, reply) {
    if (reply !== null) {
      async.map(reply, getitem, function(err, results) {
        var data = results.filter(filterResults).map(mapResults);
        res.send(data);
      });
    } else {
      res.send('[]');
    }
  });
});

function getitem(item, callback) {
  client.hgetall(item, function(err, reply) {
    if (reply !== null) {
      callback(null, reply);
    } else {
      callback(err, item);
    }
  });
}

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
  var d = new Date();
  var previous = {book: "Your Book", count: 0};
  res.render('update', {today: d.toISOString().substring(0,10), previous: previous});
});

app.post('/update', function(req,res) {
  reply = req.body;
  client.hmset(reply.wc_date, reply, function(err, reply) {
    if (reply !== null) {
      res.send(reply);
    } else {
      res.send("Error");
    }
  });
});

app.listen(3030, function () {
  console.log('Listening on port 3030!');
});
