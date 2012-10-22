var Stream = require('stream');
var s = new Stream;
s.writable = true;

var bytes = 0;

s.write = function (buf) {
    bytes += buf.length;
};

s.end = function (buf) {
    if (arguments.length) s.write(buf);
    
    s.writable = false;
    console.log(bytes + ' bytes written');
};

s.destroy = function () {
    s.writable = false;
};

var fs = require('fs');
fs.createReadStream('/etc/passwd').pipe(s);
