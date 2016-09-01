
var data_colors = {
  wc_delta: "#0E3D59",
  wc_count: "#88A61B",
  wc_hours: "#F29F05",
};

var lineGraph = function() {
}

lineGraph.prototype.init = function (json_data, date_value, y_values) {
  var svg = d3.select("svg"),
      margin = {top: 20, right: 80, bottom: 30, left: 50},
      width = svg.attr("width") - margin.left - margin.right,
      height = svg.attr("height") - margin.top - margin.bottom,
      g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var x = d3.scaleTime().range([0, width]),
      z = d3.scaleOrdinal(d3.schemeCategory10);

  var max_date = json_data.data_max[date_value];
  var min_date = json_data.data_min[date_value];

  x.domain([min_date, max_date]);

  g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

  for (var val=0; val<y_values.length; val++) {
    var y = d3.scaleLinear().range([height, 0]);
    y.domain([json_data.data_min[y_values[val]], json_data.data_max[y_values[val]]]);
    
    var line = d3.line()
        .curve(d3.curveBasis)
        .x(function(d) { return x(d[date_value]); })
        .y(function(d) { return y(d[y_values[val]]); });

    svg.append("path")
        .datum(json_data.data)
        .attr("class", "line")
        .attr("d", function(d) { return line(json_data.data); })
        .style("stroke", function(d) { return data_colors[y_values[val]]; });
  }
}


var gitGraph = function() {
  this.model = seen.Models["default"]();
  this.scene = undefined;
  this.context = undefined;
  this.animator = undefined;
  this.mode = 0;
  this.t_jump = -1;

  this.select_callout = undefined;
}

gitGraph.prototype.init = function (json_data, data_value) {
  var that = this;
  var can = document.getElementById('seen-canvas');
  // Set our canvas size
  var width = 800;
  var height = 195;
  can.width = width;
  can.height = height;
  var margins = width * 0.03;

  var data = json_data.data;
  var data_max = json_data.data_max[data_value];
  var data_min = json_data.data_min[data_value];
  data_max = (Math.abs(data_min) > data_max) ? Math.abs(data_min) : data_max;

  // Make the Model and add our objects
  this.model = seen.Models["default"]();

  // Boxes
  var box_pad = 0.7;
  var box_size = Math.floor((width - margins - margins) / 52);
  var box_highest = box_size * 3.6;
  var low_hue = 0.18;
  var high_hue = 0.33;
  var neg_low_hue = 0.06;
  var neg_high_hue = 0;
  var low_sat = 0.66;
  var high_sat = 0.54;
  var low_lum = 0.72;
  var high_lum = 0.24;
  var selection_color = "#ee6e73";
  for (var i=0; i<data.length; i++) {
    var mat = new seen.Material();
    mat.specularExponent = 9;
    if (data[i][data_value] > 0) {
      mat.color = seen.Colors.hsl(slide(data[i][data_value]/data_max,low_hue,high_hue),slide(data[i][data_value]/data_max,low_sat,high_sat),slide(data[i][data_value]/data_max,low_lum,high_lum));
    } else if (data[i][data_value] < 0) {
      mat.color = seen.Colors.hsl(slide(Math.abs(data[i][data_value])/data_max,neg_low_hue,neg_high_hue),slide(Math.abs(data[i][data_value])/data_max,low_sat,high_sat),slide(Math.abs(data[i][data_value])/data_max,low_lum,high_lum));
    } else {
      mat.color = seen.Colors.rgb(240, 240, 256, 180);
    }
    var box = seen.Shapes.unitcube()
        .scale(box_size * box_pad, box_size * box_pad, (box_highest * (data[i][data_value] / data_max)))
        .translate(Math.floor(i/7) * (box_size), (i%7) * (-box_size), 0)
        .fill(mat);
    box.base_color = mat;
    box.color_changed = false;
    box.cell_data = data[i];
    this.model.add(box);
    
    // Add Month tag
    if (data[i].wc_date.getDate() == 1) {
      var month = data[i].wc_date.toDateString().substring(4,7);
      this.model.add(seen.Shapes.text(month,{anchor:'left', font:'bold 14px arial'})
        .translate(box_size, (Math.floor(i/7) + 0.65) * (-box_size), 0)
        .rotz(1.5708)
        .fill("#000000"));
    }
  }

  // Words
  // Days of the Week
  var days = ["M","W","F"];
  for (var i=0; i<days.length; i++) {
    this.model.add(seen.Shapes.text(days[i],{anchor:'center', font:'bold 14px arial'})
        .translate(-box_size,-i * box_size * 2 - box_size,0)
        .fill("#000000")    
    );
  }

  // Create the scene, and position the model
  this.model.translate((-1) * (box_size) * (52 / 2), (box_size) * (6/2), 0);

  var cam = new seen.Camera({
    projection: seen.Projections.ortho()
  });

  this.scene = new seen.Scene({
      model: this.model,
      viewport: seen.Viewports.center(width, height),
      camera: cam,
  });

  // Bake it
  this.model.bake();

  // Render it
  this.context = seen.Context('seen-canvas', this.scene).render();

  // Set up interaction
  var pos = [
    {x:0, y:0, z:0},
    {x:-0.63, y:-0.3, z:-0.1}
  ]
  var total_rot = {x:0, y:0, z:0};
  var total_t = 1000;
  this.mode = 1; // the pos to go toward
  this.t_jump = -1;

  this.animator = this.context.animate();
  var prev = {x: pos[0].x, y: pos[0].y, z: pos[0].z};
  this.animator.onBefore(function (t,dt) {
    that.model.reset().rotx(prev.x).roty(prev.y).rotz(prev.z);
    var p = pos[that.mode];
    if (that.t_jump < 0) {
      that.t_jump = t;
    }
    if (t - that.t_jump < total_t) {
      var newx = slide((t-that.t_jump) / total_t, prev.x, p.x); 
      var newy = slide((t-that.t_jump) / total_t, prev.y, p.y); 
      var newz = slide((t-that.t_jump) / total_t, prev.z, p.z); 
      that.model.reset().rotx(newx).roty(newy).rotz(newz);
    } else {
      that.model.reset().rotx(p.x).roty(p.y).rotz(p.z);
      prev = {x: p.x, y: p.y, z: p.z};
      that.mode = (that.mode + 1) % pos.length;
      that.animator.stop();
    }
  });

  document.getElementById("transition_button").addEventListener("click", function() {
    that.t_jump = -1;
    that.animator.start();
    document.getElementById("transition_button").innerHTML = (that.mode == 0) ? "View 3D" : "View 2D";
  });

  var prev_selected = undefined;
  // Mouseover stuff
  can.addEventListener('mousemove', function(evt) {
    var rect = can.getBoundingClientRect();
    var mp = {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
    // the mouse could be on more than one, so we need to find the closest one
    var mouse_on = [];
    for (var i=0; i<that.model.children.length; i++) {
      if (that.model.children[i].base_color === undefined) {
        continue;
      }
      var min = {};
      var max = {};
      var zlevels = [];
      for (var j=0; j<that.model.children[i].surfaces.length; j++) {
        var proj = that.scene._renderModelCache[that.model.children[i].surfaces[j].id].projected;
        min.x = (min.x == undefined || min.x > proj.bounds.min.x) ? proj.bounds.min.x : min.x;
        min.y = (min.y == undefined || min.y > proj.bounds.min.y) ? proj.bounds.min.y : min.y;
        max.x = (max.x == undefined || max.x < proj.bounds.max.x) ? proj.bounds.max.x : max.x;
        max.y = (max.y == undefined || max.y < proj.bounds.max.y) ? proj.bounds.max.y : max.y;
        zlevels.push(proj.barycenter.z);
      }
      if (mp.x < max.x && mp.y < max.y && mp.x > min.x && mp.y > min.y) {
        mouse_on.push({box: that.model.children[i], zlevels: zlevels});
      } else if (that.model.children[i] == prev_selected) { 
        prev_selected = undefined;
      }
      if (that.model.children[i].color_changed && that.model.children[i] != prev_selected) { 
        for (var j=0; j<that.model.children[i].surfaces.length; j++) {
          that.model.children[i].surfaces[j].fill(that.model.children[i].base_color);
          color_changed = false;
        }
      }
    }
    // find the closest
    if (mouse_on.length > 0) {
      var closest = undefined;
      var closest_z = undefined;
      for (var i=0; i<mouse_on.length; i++) {
        var avg = 0;
        for (var j=0; j<mouse_on[i].zlevels.length; j++) {
          avg += mouse_on[i].zlevels[j];
        }
        avg = avg / mouse_on[i].zlevels.length;
        if (closest_z === undefined || avg < closest_z) {
          closest = mouse_on[i].box;
          closest_z = avg;
        }
      }

      if (prev_selected === undefined || closest != prev_selected) {
        for (var i=0; i<closest.surfaces.length; i++) {
          closest.surfaces[i].fill(selection_color);
        }
        closest.color_changed = true;
        that.select_callout(closest.cell_data);
        prev_selected = closest;
      }
    }
    that.context.render();
  }, false);

  var dragger = new seen.Drag('seen-canvas', {inertia : false});
  dragger.on('drag.rotate', function(e) {
    var newx = e.offsetRelative[1] * 1e-2;
    var newy = e.offsetRelative[0] * 1e-2;
    prev.x += newx;
    prev.y += newy;
    that.model.reset().rotx(prev.x).roty(prev.y).rotz(prev.z);
    that.mode = 0;
    document.getElementById("transition_button").innerHTML = "View 2D";
    return that.context.render();
  });
};

function slide(percent, low, high) {
  return low + ((high - low) * (percent));
}

function processData(json_data) {
  var data = []; 

  var data_max = {wc_delta:300, wc_hours:1, wc_count:500}; // default max
  var data_min = {wc_delta:0, wc_hours:0, wc_count:0}; // default min

  var previous_words = 0;
  for (var i=0; i<364; i++) {
    // get this cells date
    var d = new Date();
    // getDate - 363 goes back to a year ago
    // + i offsets our cell
    // + (6 - d.getDay) makes us line up on Sunday
    d.setDate((d.getDate() - 363) + i + (6 - d.getDay()));
    if (i == 363) {
      data_max.wc_date = d;
    } else if (i == 0) {
      data_min.wc_date = d;
    }
    var cell_data = {};
    // See if there is a json_data entry for this date
    for (var j=0; j<json_data.length; j++) {
      if (json_data[j].wc_date == d.toISOString().substring(0,10)) {
        // add it to the collection and remove it from our json_data
        cell_data = json_data.splice(j,1)[0];
        cell_data.wc_date = d;
        cell_data.wc_delta = cell_data.wc_count - previous_words;
        previous_words = cell_data.wc_count;
        cell_data.generated = false;
        break;
      }
    }
    if (cell_data.wc_date === undefined) {
      cell_data.wc_date = d;
      cell_data.wc_delta = 0;
      cell_data.wc_hours = 0;
      cell_data.wc_count = previous_words;
      cell_data.generated = true;
    }
    data.push(cell_data);
  }


  // Find max and min, without outliers
  var min_max = [];
  min_max = stat_minmax(data.filter(function (x) {return x.generated == false}).map(function (x) {return x.wc_delta}));
  data_max.wc_delta = (data_max.wc_delta > min_max[1]) ? data_max.wc_delta : min_max[1];
  data_min.wc_delta = (data_min.wc_delta < min_max[0]) ? data_min.wc_delta : min_max[0];
  
  min_max = stat_minmax(data.filter(function (x) {return x.generated == false}).map(function (x) {return x.wc_hours}));
  data_max.wc_hours = (data_max.wc_hours > min_max[1]) ? data_max.wc_hours : min_max[1];
  data_min.wc_hours = (data_min.wc_hours < min_max[0]) ? data_min.wc_hours : min_max[0];
 
  min_max = stat_minmax(data.filter(function (x) {return x.generated == false}).map(function (x) {return x.wc_count}));
  data_max.wc_count = (data_max.wc_count > min_max[1]) ? data_max.wc_count : min_max[1];
  data_min.wc_count = (data_min.wc_count < min_max[0]) ? data_min.wc_count : min_max[0];
  
  return {data: data, data_max: data_max, data_min: data_min};
}

function stat_minmax(in_arr) {
  in_arr.sort(function (a,b) {return a-b});
  // Unless we have 6 items, we wont bother looking for outlires
  if (in_arr.length < 6) {
    return [in_arr[0], in_arr[in_arr.length - 1]];
  }
  var i1, i2, i3;
  i2 = Math.floor(in_arr.length / 2);
  i1 = Math.floor(i2 / 2);
  i3 = i2 + i1;

  var iqr = in_arr[i3] - in_arr[i1];
  var min = in_arr[i1] - (1.5 * iqr);
  var max = in_arr[i3] + (1.5 * iqr);

  min = (min < in_arr[0]) ? in_arr[0] : min;
  max = (max > in_arr[in_arr.length - 1]) ? in_arr[in_arr.length - 1] : max;
  
  return [min, max];
}

var gGraph = new gitGraph();
var lGraph = new lineGraph();


function writeInfo(cell_data) {
  var info_area = document.getElementById("selection_info");
  var output = '<div class="col s12"></div>';
  output += '<div class="chip">Date : '+ cell_data.wc_date.toDateString().substring(4,10) +'</div>';
  output += '<div class="chip" style="background-color: '+ data_colors.wc_count +'">Word Count : '+ cell_data.wc_count.toString() +'</div>';
  output += '<div class="chip" style="background-color: '+ data_colors.wc_delta +'">Words Added : '+ cell_data.wc_delta.toString() +'</div>';
  output += '<div class="chip" style="background-color: '+ data_colors.wc_hours +'">Hours : '+ cell_data.wc_hours.toString() +'</div>';
  output += '<div class="chip">Book : '+ ((cell_data.wc_book != undefined) ? cell_data.wc_book : '') +'</div>';
  info_area.innerHTML = output;
}

function main() {
  var xmlhttp = new XMLHttpRequest();
  var url = "data";

  xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
      var data = processData(JSON.parse(xmlhttp.responseText));
      gGraph.init(data, 'wc_delta');
      gGraph.select_callout = function (cell_data) {
        // set the text panel
        writeInfo(cell_data);
        // set the selection on the line graph
      };
      lGraph.init(data, 'wc_date', ['wc_delta', 'wc_count', 'wc_hours']);

      var today = new Date();
      for (var i=data.data.length - 1; i >= 0; i--) {
        if (today.toDateString() == data.data[i].wc_date.toDateString()) {
          writeInfo(data.data[i]);
          break;
        }
      }
    }
  };
  xmlhttp.open("GET", url, true);
  xmlhttp.send();
}
main();
