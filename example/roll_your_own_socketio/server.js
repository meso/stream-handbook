var http = require('http');
var EventEmitter = require('events').EventEmitter;

var server = http.createServer(require('ecstatic')(__dirname));
server.listen(8080);

var shoe = require('shoe');
var emitStream = require('emit-stream');
var JSONStream = require('JSONStream');

var sock = shoe(function (stream) {
    var ev = new EventEmitter;
    emitStream(ev)
        .pipe(JSONStream.stringify())
        .pipe(stream)
    ;
    
    var intervals = [];
    
    intervals.push(setInterval(function () {
        ev.emit('upper', 'abc');
    }, 500));
    
    intervals.push(setInterval(function () {
        ev.emit('lower', 'def');
    }, 300));
    
    stream.on('end', function () {
        intervals.forEach(clearInterval);
    });
    
});
sock.install(server, '/sock');
