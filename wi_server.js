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

// Get all the data for the past year
app.get('/data', function(req,res) {
  res.setHeader('Content-Type', 'application/json');
  var items = ['wc_book', 'wc_date', 'wc_count', 'wc_hours', 'wc_role', 'wc_total'];
  client.sort(dataset, 'GET', '*->wc_book', 'GET', '*->wc_date', 'GET', '*->wc_count', 'GET', '*->wc_hours', 'GET', '*->wc_role', 'GET', '*->wc_total', function(err, reply) {
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
  // Make these values numbers
  value.wc_count = +(value.wc_count);
  value.wc_hours = +(value.wc_hours);
  value.wc_total = +(value.wc_total);
  return value;
}

// Get the update form
app.get('/update', function(req, res) {
  var previous = {wc_book: "", wc_count: 0, wc_total: 0, username: ""}; // default previous
  client.get(latest_key, function(err, latest) {
    if (latest == null) {
      send_update_form(res, previous);
    } else {
      client.hgetall(latest, function (err, reply) {
        if (reply != null) {
          send_update_form(res, reply);
        } else {
          send_update_form(res, previous);
        }
      });
    }
  });
});

function send_update_form(res, previous) {
  var d = new Date();
  res.render('update', {today: d.toISOString().substring(0,10), previous: previous});
}

// Post from the update form
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
      // Make this the latest update if it is
      client.get(latest_key, function (err, latest) {
        if (latest == null) {
          client.set(latest_key, reply.wc_date, function (err, res) {});
        } else {
          var old_l = new Date(latest);
          var new_l = new Date(reply.wc_date);
          if (old_l < new_l) {
            client.set(latest_key, reply.wc_date, function (err, res) {});
          }
        }
      });
    } else {
      res.send("There was an error, please try again");
    }
  });
});

// Get the widget
app.use('/widget', function(req, res, next) {
  // Get the latest data
  client.get(latest_key, function (err, latest) {
    if (latest == null) {
      res.send("");
    } else {
      client.hgetall(latest, function (err, reply) {
        if (reply == null) {
          res.send("");
        } else {
          // make the widget
          var current = reply.wc_count;
          var total = reply.wc_total;
          var in_color = "57a3e8";
          var in_size = [200,21];
          var args = req.path.split('/');
          for (var i=1; i<args.length; i++) {
            if (args[i].indexOf('x') == -1 && args[i].length == 6) {
              in_color = args[i];
            } else if (args[i].indexOf('x') > 0) {
              in_size = args[i].split('x');
            }
          }
          var in_w = in_size[0];
          var in_h = in_size[1];

          var book = {title: reply.wc_book, count: current.toString() + " words"};
          var size = {width: in_w, height: in_h, backheight: in_h-6, frontwidth: (current / total) * (in_w - 8), frontheight: in_h - 12, ywordspad: (1.2 * in_h / 2), wordsize: (in_h < 45) ? 14 * (in_h / 20) : 32};
          var color = {back: "b3b3b3", front: in_color};
          res.render('widget', {book: book, size: size, color: color});
        }
      });
    }
  });
});

// Do it!
app.listen(3030, function () {
  console.log('Listening on port 3030!');
});
