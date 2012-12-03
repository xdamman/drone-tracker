// Run this to receive a png image stream from your drone.

var arDrone = require('ar-drone');
var cv = require('opencv');
var http    = require('http');
var fs = require('fs');

console.log('Connecting png stream ...');

var pngStream = arDrone.createPngStream();
//var stream  = arDrone.createUdpNavdataStream();
var client = arDrone.createClient("192.168.1.2");

// require('ar-drone-png-stream')(client, {port:8000});

var processingImage = false;
var lastPng, lastDetectedFace = { x: 0, y: 0 };
var face_cascade = new cv.CascadeClassifier('node_modules/opencv/data/haarcascade_frontalface_alt2.xml');
var navData;
var flying = false;
var startTime = new Date().getTime();
var log = function(s){
var time = ( ( new Date().getTime() - startTime ) / 1000 ).toFixed(2);

  console.log(time+" \t"+s);
}

pngStream
  .on('error', console.log)
  .on('data', function(pngBuffer) {
    //console.log("got image");
    lastPng = pngBuffer;
  });
     
  var detectFaces = function(){ 
      if( ! flying ) return;
      if( ( ! processingImage ) && lastPng )
      {
        processingImage = true;
        cv.readImage( lastPng, function(err, im) {
          var opts = {};
          face_cascade.detectMultiScale(im, function(err, faces) {

            var face;
            var biggestFace;
            var smallestDistance = 10000000;

            for(var k = 0; k < faces.length; k++) {

              face = faces[k];

              if(faces.length == 1) {
                lastDetectedFace = face;
              } else {
                var distX = face.x - lastDetectedFace.x
                  , distY = face.y - lastDetectedFace.y;

                var distance = Math.abs(Math.sqrt(distX*distX+distY*distY));

                console.log("Face "+k+ " distance: ", distance.toFixed(4));

                if(distance < smallestDistance) { 
                  smallestDistance = distance;
                  biggestFace = face;
                }
              }

            }

            if( biggestFace ){
              lastDetectedFace = face;
              face = biggestFace;
              im.rectangle([face.x, face.y], [face.x + face.width, face.y + face.height], [0, 255, 0], 2);
              var time = ( ( new Date().getTime() - startTime ) / 1000 ).toFixed(2) * 100;
              im.save('./imglog/'+time+'.jpg');
              // console.log( face.x, face.y, face.width, face.height, im.width(), im.height() );

              var faceSize = face.width * face.height;

              console.log("Face size: ("+face.width+"x"+face.height+")", faceSize);
              if(faceSize > 7000) {
                console.log("Face is big, backing up", faceSize);
                client.animateLeds('blinkRed',2,2);
                client.back(1);
                setTimeout(function() {
                  client.back(0);
                }, 250);
              }

              if(faceSize < 6000) {
                console.log("Face is small, getting closer", faceSize);
                client.animateLeds('blinkGreen',2,2);
                client.front(1);
                setTimeout(function() {
                  client.front(0);
                }, 250);

              }

              face.centerX = face.x + face.width * 0.5;
              face.centerY = face.y + face.height * 0.5;

              var centerX = im.width() * 0.5;
              var centerY = im.height() * 0.5;

              var heightAmount = -( face.centerY - centerY ) / centerY;
              var turnAmount = -( face.centerX - centerX ) / centerX;

              turnAmount = Math.min( 1, turnAmount );
              turnAmount = Math.max( -1, turnAmount );

              // log( turnAmount + " " + heightAmount );

              //heightAmount = Math.min( 1, heightAmount );
              //heightAmount = Math.max( -1, heightAmount );
              heightAmount = 0;

              if( Math.abs( turnAmount ) > Math.abs( heightAmount ) ){
                //log( "turning "+turnAmount );
                if( turnAmount < 0 ) client.clockwise( Math.abs( turnAmount ) );
                else client.counterClockwise( turnAmount );
                setTimeout(function(){
                    // log("stopping turn");
                    client.clockwise(0);
                    //this.stop();
                },100);
              }
              else {
                //log( "going vertical "+heightAmount );
                /*
                if(  heightAmount < 0 ) client.down( heightAmount );
                else client.up( heightAmount );
                setTimeout(function(){
                  // log("stopping altitude change");
                  
                  client.up(0);

                },50);
                */
              }

            }

          processingImage = false;
          //im.save('/tmp/salida.png');

        }, opts.scale, opts.neighbors
          , opts.min && opts.min[0], opts.min && opts.min
[1]);
        
      });
    };
  };

var faceInterval = setInterval( detectFaces, 150);

client.takeoff();
client.after(5000,function(){ 
  log("going up");
  this.up(1);
}).after(1200,function(){ 
  log("stopping");
  this.stop(); 
  flying = true;
});


client.after(10000, function() {
    flying = false;
    this.stop();
    this.land();
  });

client.on('navdata', function(navdata) {
  navData = navdata;
})


var server = http.createServer(function(req, res) {
  if (!lastPng) {
    res.writeHead(503);
    res.end('Did not receive any png data yet.');
    return;
  }

  res.writeHead(200, {'Content-Type': 'image/png'});
  res.end(lastPng);
});

server.listen(8080, function() {
  console.log('Serving latest png on port 8080 ...');
});
