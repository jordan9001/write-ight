// Set our canvas size
var width = 900
var height = 270

var margins = width * 0.06;

// Get our Data
// random data
var data = [];
var data_max = 0;
for (var i=0; i<364; i++) {
//  data[i] = Math.ceil(Math.random() * 30);
  data[i] = Math.random() * 70;
  if (i < 9) {
    data[i] = 70;
  }
  data_max = (data[i] > data_max) ? data[i] : data_max;
}

// Make the Model and add our objects
var model = seen.Models["default"]()

// Boxes
var box_pad = 0.7;
var box_size = Math.floor((width - margins - margins) / 52);
var low_hue = 0.18;
var high_hue = 0.33;
var low_sat = 0.66;
var high_sat = 0.54;
var low_lum = 0.72;
var high_lum = 0.24;
for (var i=0; i<data.length; i++) {
  var mat = new seen.Material();
  mat.specularExponent = 9;
  mat.shader = seen.Flat
  if (data[i] != 0) {
    mat.color = seen.Colors.hsl(slide(data[i]/90,low_hue,high_hue),slide(data[i]/90,low_sat,high_sat),slide(data[i]/90,low_lum,high_lum));
  } else {
    mat.color = seen.Colors.grey();
  }
  var box = seen.Shapes.unitcube()
      .scale(box_size * box_pad, box_size * box_pad, data[i])
      .translate(Math.floor(i/7) * (box_size), (i%7) * (-box_size), 0)
      .fill(mat);
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
var dragger = new seen.Drag('seen-canvas', {inertia : true});
dragger.on('drag.rotate', function(e) {
  var ref = seen.Quaternion;
  var xform = ref.xyToTransform.apply(ref, e.offsetRelative);
  model.transform(xform);
  return context.render();
});

var pos = [
  {x:0, y:0, z:0},
  {x:-0.63, y:-0.3, z:-0.1}
]
var total_rot = {x:0, y:0, z:0};
var total_t = 1000;
var mode = 1; // the pos to go toward
var t_jump = -1;

var animator = context.animate();
animator.onBefore(function (t,dt) {
  var prev = pos[(mode+pos.length-1)%pos.length];
  model.reset().rotx(prev.x).roty(prev.y).rotz(prev.z);
  var p = pos[mode];
  if (t_jump < 0) {
    t_jump = t;
  }
  if (t - t_jump < total_t) {
    model.reset().rotx(slide((t-t_jump) / total_t,prev.x,p.x)).roty(slide((t-t_jump) / total_t,prev.y,p.y)).rotz(slide((t-t_jump) / total_t, prev.z, p.z));
  } else {
    model.reset().rotx(p.x).roty(p.y).rotz(p.z);
    mode = (mode + 1) % pos.length;
    animator.stop();
  }
});

function slide(percent, low, high) {
  return low + ((high - low) * (percent));
}
document.getElementById("rotate").addEventListener("click", function() {
  t_jump = -1;
  animator.start();
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
    if (i == 0) {
      console.log("x:"+ min.x +"-"+ max.x +" y:"+ min.y +"-"+ max.y);
      console.log("mx:"+ mp.x + " my:"+ mp.y);
    }
    if (mp.x < max.x && mp.y < max.y && mp.x > min.x && mp.y > min.y) {
      for (var j=0; j<model.children[i].surfaces.length; j++) {
        model.children[i].surfaces[j].fill("#FF0000");
      }
    }
  }
  context.render();
}, false);
