function makeGraph(json_data) {
  // Set our canvas size
  var width = 900
  var height = 270
  var margins = width * 0.06;

  // Get our Data
  var value_item = "wc_delta";
  var data = [];
  var data_max = 4;
  var previous_words = 0;
  for (var i=0; i<364; i++) {
    // get this cells date
    var d = new Date();
    // getDate - 363 goes back to a year ago
    // + i offsets our cell
    // + (6 - d.getDay) makes us line up on Sunday
    d.setDate((d.getDate() - 363) + i + (6 - d.getDay()));
    var cell_data = {};
    // See if there is a json_data entry for this date
    for (var j=0; j<json_data.length; j++) {
      if (json_data[j].wc_date == d.toISOString().substring(0,10)) {
        // add it to the collection and remove it from our json_data
        cell_data = json_data.splice(j,1)[0];
        cell_data.wc_date = d;
        cell_data.wc_delta = cell_data.wc_count - previous_words;
        previous_words = cell_data.wc_count;
        cell_data.getValue = function () {
          return this[value_item];
        };

        data_max = (Math.abs(cell_data.getValue()) > data_max) ? Math.abs(cell_data.getValue()) : data_max;
        break;
      }
    }
    if (cell_data.wc_date === undefined) {
      cell_data.wc_date = d;
      cell_data.getValue = function() { return 0;};
    }
    data.push(cell_data);
  }

  // Make the Model and add our objects
  var model = seen.Models["default"]();

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
  for (var i=0; i<data.length; i++) {
    var mat = new seen.Material();
    mat.specularExponent = 9;
    mat.shader = seen.Flat
    if (data[i].getValue() > 0) {
      mat.color = seen.Colors.hsl(slide(data[i].getValue()/data_max,low_hue,high_hue),slide(data[i].getValue()/data_max,low_sat,high_sat),slide(data[i].getValue()/data_max,low_lum,high_lum));
    } else if (data[i].getValue() < 0) {
      mat.color = seen.Colors.hsl(slide(Math.abs(data[i].getValue())/data_max,neg_low_hue,neg_high_hue),slide(Math.abs(data[i].getValue())/data_max,low_sat,high_sat),slide(Math.abs(data[i].getValue())/data_max,low_lum,high_lum));
    } else {
      mat.color = seen.Colors.rgb(238,238,238);
    }
    var box = seen.Shapes.unitcube()
        .scale(box_size * box_pad, box_size * box_pad, (box_highest * (data[i].getValue() / data_max)) + 1)
        .translate(Math.floor(i/7) * (box_size), (i%7) * (-box_size), 0)
        .fill(mat);
    box.base_color = mat;
    box.color_changed = false;
    model.add(box);
  }

  // Words
  // Days of the Week
  var days = ["M","W","F"];
  for (var i=0; i<days.length; i++) {
    model.add(seen.Shapes.text(days[i],{anchor:'center', font:'bold 14px arial'})
        .translate(-box_size,-i * box_size * 2 - box_size,0)
        .fill("#000000")    
    );
  }

  // Create the scene, and position the model
  model.translate((-1) * (box_size + box_pad) * (data.length / (2 * 7)), (box_size + box_pad) * (7/2), 0);

  var cam = new seen.Camera({
    projection: seen.Projections.ortho()
  });

  var scene = new seen.Scene({
      model: model,
      viewport: seen.Viewports.center(width, height),
      camera: cam,
  });

  // Bake it
  model.bake();

  // Render it
  var context = seen.Context('seen-canvas', scene).render();

  // Set up interaction

  var pos = [
    {x:0, y:0, z:0},
    {x:-0.63, y:-0.3, z:-0.1}
  ]
  var total_rot = {x:0, y:0, z:0};
  var total_t = 1000;
  var mode = 1; // the pos to go toward
  var t_jump = -1;

  var animator = context.animate();
  var prev = {x: pos[0].x, y: pos[0].y, z: pos[0].z};
  animator.onBefore(function (t,dt) {
    model.reset().rotx(prev.x).roty(prev.y).rotz(prev.z);
    var p = pos[mode];
    if (t_jump < 0) {
      t_jump = t;
    }
    if (t - t_jump < total_t) {
      var newx = slide((t-t_jump) / total_t, prev.x, p.x); 
      var newy = slide((t-t_jump) / total_t, prev.y, p.y); 
      var newz = slide((t-t_jump) / total_t, prev.z, p.z); 
      model.reset().rotx(newx).roty(newy).rotz(newz);
    } else {
      model.reset().rotx(p.x).roty(p.y).rotz(p.z);
      prev = {x: p.x, y: p.y, z: p.z};
      mode = (mode + 1) % pos.length;
      animator.stop();
    }
  });

  document.getElementById("transition_button").addEventListener("click", function() {
    t_jump = -1;
    animator.start();
    document.getElementById("transition_button").innerHTML = (mode == 0) ? "View 3D" : "View 2D";
  });

  // Mouseover stuff
  var can = document.getElementById('seen-canvas');
  can.addEventListener('mousemove', function(evt) {
    var rect = can.getBoundingClientRect();
    var mp = {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
    for (var i=0; i<model.children.length; i++) {
      var min = {};
      var max = {};
      for (var j=0; j<model.children[i].surfaces.length; j++) {
        var proj = scene._renderModelCache[model.children[i].surfaces[j].id].projected.bounds;
        min.x = (min.x == undefined || min.x > proj.min.x) ? proj.min.x : min.x;
        min.y = (min.y == undefined || min.y > proj.min.y) ? proj.min.y : min.y;
        max.x = (max.x == undefined || max.x < proj.max.x) ? proj.max.x : max.x;
        max.y = (max.y == undefined || max.y < proj.max.y) ? proj.max.y : max.y;
      }
      if (mp.x < max.x && mp.y < max.y && mp.x > min.x && mp.y > min.y) {
        for (var j=0; j<model.children[i].surfaces.length; j++) {
          model.children[i].surfaces[j].fill("#FF0000");
        }
        model.children[i].color_changed = true;
      } else {
        if (model.children[i].color_changed) { 
          for (var j=0; j<model.children[i].surfaces.length; j++) {
            model.children[i].surfaces[j].fill(model.children[i].base_color);
          }
        }
      }
    }
    context.render();
  }, false);

  var dragger = new seen.Drag('seen-canvas', {inertia : false});
  dragger.on('drag.rotate', function(e) {
    //var ref = seen.Quaternion;
    //var xform = ref.xyToTransform.apply(ref, e.offsetRelative);
    //model.transform(xform);
    var newx = e.offsetRelative[1] * 1e-2;
    var newy = e.offsetRelative[0] * 1e-2;
    prev.x += newx;
    prev.y += newy;
    model.reset().rotx(prev.x).roty(prev.y);
    mode = 0;
    document.getElementById("transition_button").innerHTML = "View 2D";
    return context.render();
  });
}

function slide(percent, low, high) {
  return low + ((high - low) * (percent));
}

function main() {
  var xmlhttp = new XMLHttpRequest();
  var url = "testdata.json";

  xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
      var data = JSON.parse(xmlhttp.responseText);
      makeGraph(data);
    }
  };
  xmlhttp.open("GET", url, true);
  xmlhttp.send();
}
main();
