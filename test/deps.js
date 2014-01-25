var test = require('tape');
var factor = require('../');
var mdeps = require('module-deps');
var through = require('through');
var path = require('path');
var fs = require('fs');
var pack = require('browser-pack');
var concat = require('concat-stream');
var vm = require('vm');

var files = [ 'x.js', 'y.js' ].map(function (file) {
    return path.join(__dirname, '../example', file);
});
var expected = {
    common: [ read('z.js') ],
    'x.js': [
        read('x.js', {
            entry: true,
            deps: { './z.js': norm('z.js'), './w.js': norm('w.js') }
        }),
        read('w.js')
    ],
    'y.js': [
        read('y.js', {
           entry: true,
           deps: { './z.js': norm('z.js') }
        })
    ]
};

test('trust but verify', function (t) {
    t.plan(3);
    var packs = {
        common: pack({ raw: true }),
        'x.js': pack({ raw: true }),
        'y.js': pack({ raw: true })
    };
    
    var pending = 3;
    
    var sources = {};
    packs.common.pipe(concat(function (src) {
        sources.common = src;
        done();
    }));
    packs['x.js'].pipe(concat(function (src) {
        sources['x.js'] = src;
        done();
    }));
    packs['y.js'].pipe(concat(function (src) {
        sources['y.js'] = src;
        done();
    }));
    
    function done () {
        if (--pending !== 0) return;
        console.log(sources);
    }
    
    var rows = [];
    var fr = factor(files, { objectMode: true, raw: true });
    fr.on('stream', function (bundle) {
        var name = path.basename(bundle.file);
        bundle.pipe(rowsOf(function (rows) {
            t.deepEqual(rows, expected[name]);
        }));
        bundle.pipe(packs[name]);
    });
    mdeps(files).pipe(fr)
    fr.pipe(rowsOf(function (rows) {
        t.deepEqual(rows, expected.common);
    }));
    fr.pipe(packs.common);
});

function rowsOf (cb) {
    var rows = [];
    return through(write, end);
    
    function write (row) { rows.push(row) }
    function end () { cb(rows) }
}

function read (name, ref) {
    if (!ref) ref = {};
    var file = norm(name);
    ref.id = file;
    ref.source = fs.readFileSync(file, 'utf8');
    if (!ref.deps) ref.deps = {};
    return ref;
}

function norm (file) {
    return path.normalize(__dirname + '/../example/' + file);
}
