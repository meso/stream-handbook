<!--
# introduction
-->
# イントロダクション

<!--
This document covers the basics of how to write [node.js](http://nodejs.org/)
programs with [streams](http://nodejs.org/docs/latest/api/stream.html).
-->
このドキュメントは[ストリーム](http://nodejs.org/docs/latest/api/stream.html)を用いた[node.js](http://nodejs.org/)プログラムの基本的な書き方について説明します。

```
"We should have some ways of connecting programs like garden hose--screw in
another segment when it becomes necessary to massage data in
another way. This is the way of IO also."
```

[Doug McIlroy. October 11, 1964](http://cm.bell-labs.com/who/dmr/mdmpipe.html)

***

<!--
Streams come to us from the earliest days of unix and have proven themselves
over the decades as a dependable way to compose large systems out of small
components that
[do one thing well](http://www.faqs.org/docs/artu/ch01s06.html).
In unix, streams are implemented by the shell with `|` pipes.
In node, the built-in
[stream module](http://nodejs.org/docs/latest/api/stream.html)
is used by the core libraries and can also be used by user-space modules.
Similar to unix, the node stream module's primary composition operator is called
`.pipe()` and you get a backpressure mechanism for free to throttle writes for
slow consumers.
-->
ストリームはUnixの初期段階から登場し、[1つのことをキチンとやりきる](http://www.faqs.org/docs/artu/ch01s06.html)小さなコンポーネントを組み合わせて巨大なシステムを作り上げる信頼できる手法であることを、数十年に渡って証明してきました。Unixでは、ビルトイン[ストリームモジュール](http://nodejs.org/docs/latest/api/stream.html)がコアライブラリやユーザ領域のモジュールによって用いられています。Unixと同様に、Nodeのストリームモジュールの基礎となる合成演算子は ``.pipe()`` と呼ばれ、遅い消費者への書き出しを自由に調整するための背圧メカニズムも備わっています。

<!--
Streams can help to
[separate your concerns](http://www.c2.com/cgi/wiki?SeparationOfConcerns)
because they restrict the implementation surface area into a consistent
interface that can be
[reused](http://www.faqs.org/docs/artu/ch01s06.html#id2877537).
You can then plug the output of one stream to the input of another and
[use libraries](http://npmjs.org) that operate abstractly on streams to
institute higher-level flow control.
-->
ストリームは、実装の表層部を[再利用](http://www.faqs.org/docs/artu/ch01s06.html#id2877537)されやすい一貫性のあるインタフェースに限定することによって、[関心の分離](http://www.c2.com/cgi/wiki?SeparationOfConcerns)を促進します。そのため、1つのストリームの出力を他のストリームの入力へと繋ぐことができるのです。また、抽象的にストリームを操作する[ライブラリを用いる](http://npmjs.org)ことで、高レベルなフローコントロールを導入することもできます。

<!--
Streams are an important component of
[small-program design](https://michaelochurch.wordpress.com/2012/08/15/what-is-spaghetti-code/)
and [unix philosophy](http://www.faqs.org/docs/artu/ch01s06.html)
but there are many other important abstractions worth considering.
Just remember that [technical debt](http://c2.com/cgi/wiki?TechnicalDebt)
is the enemy and to seek the best abstractions for the problem at hand.
-->
ストリームは、[小さなコード設計](https://michaelochurch.wordpress.com/2012/08/15/what-is-spaghetti-code/)や[Unix哲学](http://www.faqs.org/docs/artu/ch01s06.html)において重要なコンポーネントです。しかし、他にも考慮すべき抽象的概念はたくさんあります。[技術的負債](http://c2.com/cgi/wiki?TechnicalDebt)は敵であることと、目の前にある問題に対する最適な抽象的概念を探し求めることを忘れないでください。

***

<!--
# why you should use streams
-->
# なぜストリームを使うべきなのか

<!--
I/O in node is asynchronous, so interacting with the disk and network involves
passing callbacks to functions. You might be tempted to write code that serves
up a file from disk like this:
-->
NodeのI/Oは非同期なので、ハードディスクやネットワークに対して対話的に関数のコールバックを通じてやり取りします。ファイルをアップするサーバーを以下のように書きたい衝動に駆られるでしょう。

``` js
var http = require('http');
var fs = require('fs');

var server = http.createServer(function (req, res) {
    fs.readFile(__dirname + '/data.txt', function (err, data) {
        if (err) {
            res.statusCode = 500;
            res.end(String(err));
        }
        else res.end(data);
    });
});
server.listen(8000);
```

<!--
This code works but it's bulky and buffers up the entire `data.txt` file into
memory for every request before writing the result back to clients. If
`data.txt` is very large, your program could start eating a lot of memory as it
serves lots of users concurrently. The latency will also be high as users will
need to wait for the entire file to be read before they start receiving the
contents.
-->
このコードは動きはしますが、扱いにくく`data.txt`ファイルを全てのリクエストがクライアントに結果として返す前にメモリにバッファとして書き込んでしまいます。もし、`data.txt`が非常に大きい場合は、このプログラムはユーザー数と同じだけの大量のメモリを消費しはじめるでしょう。また、ユーザーがコンテンツを受け始める前に、ファイル全てを読み込まれるので待たされる上、レイテンシは非常に高いものになるでしょう。

<!--
Luckily both of the `(req, res)` arguments are streams, which means we can write
this in a much better way using `fs.createReadStream()` instead of
`fs.readFile()`:
-->
ラッキーなことに`(req, res)`の両方の引数はStreamです。これはファイルの書き込みに`fs.readFile()`よりも良い方法である`fs.createReadStream()`を使えるという事です。

``` js
var http = require('http');
var fs = require('fs');

var server = http.createServer(function (req, res) {
    var stream = fs.createReadStream(__dirname + '/data.txt');
    stream.on('error', function (err) {
        res.statusCode = 500;
        res.end(String(err));
    });
    stream.pipe(res);
});
server.listen(8000);
```

<!--
Here `.pipe()` takes care of listening for `'data'` and `'end'` events from the
`fs.createReadStream()`. This code is not only cleaner, but now the `data.txt`
file will be written to clients one chunk at a time immediately as they are
received from the disk.
-->
この`.pipe()`は`fs.createReadStream()`から`'data'`と`'end'`イベントを待ち受けています。このコードはキレイなだけではなく、いまや`data.txt`ファイルがハードディスクから読み込まれれば即時に、クライアントに1つのチャンクとして書き込まれるようになりました。

<!--
Using `.pipe()` has other benefits too, like handling backpressure automatically
so that node won't buffer chunks into memory needlessly when the remote client
is on a really slow or high-latency connection.
-->
`.pipe()`の使用は他にも利点があります。それは、自動的に背圧制御できるのでリモートクライアントが非常に遅い時や、高レイテンシで接続している時などにNodeが必要もないのにチャンクをバッファとしてメモリに書き込んだりしなくても良いという点です。

<!--
But this example, while much better than the first one, is still rather verbose.
The biggest benefit of streams is their versatility. We can
[use a module](https://npmjs.org/) that operates on streams to make that example
even simpler:
-->
しかし、このサンプルは最初のものよりもずっと良いのですが、まだ冗長です。Streamの一番大きい利点は、Streamが多機能であるという点です。Streamを扱う[モジュール](https://npmjs.org/)を使ってもっとシンプルなサンプルを作ってみましょう。

``` js
var http = require('http');
var filed = require('filed');

var server = http.createServer(function (req, res) {
    filed(__dirname + '/data.txt').pipe(res);
});
server.listen(8000);
```

<!--
With the [filed module](http://github.com/mikeal/filed) we get mime types, etag
caching, and error handling for free in addition to a nice streaming API.
-->
[filedモジュール](http://github.com/mikeal/filed)を使うと、mimeタイプ・etagキャシュや例外処理などの素晴しいStream APIを苦労無く使うことができます。

<!--
Want compression? There are streaming modules for that too!
-->
圧縮がしたいですか？それもStreamモジュールにあります！

``` js
var http = require('http');
var filed = require('filed');
var oppressor = require('oppressor');

var server = http.createServer(function (req, res) {
    filed(__dirname + '/data.txt')
        .pipe(oppressor(req))
        .pipe(res)
    ;
});
server.listen(8000);
```

<!--
Now our file is compressed for browsers that support gzip or deflate! We can
just let [oppressor](https://github.com/substack/oppressor) handle all that
content-encoding stuff.
-->
これでgzipかdeflateがサポートされているブラウザ用にファイルを圧縮することができました！ただ[oppressor](https://github.com/substack/oppressor)でコンテンツのエンコードを全て扱わせただけです。

<!--
Once you learn the stream api, you can just snap together these streaming
modules like lego bricks or garden hoses instead of having to remember how to push
data through wonky non-streaming custom APIs.
-->
一度Stream APIを勉強すると、あてにならない非Stream用APIを使ってデータをどんな風にプッシュするかを思い出す代わりに、レゴブロックやガーデンホースのようにStreamモジュール郡をピタっと合わせていくだけで良いのです。

<!--
Streams make programming in node simple, elegant, and composable.
-->
StreamはNodeをシンプル・エレガントに、そして分割性を与えてくれます。

# basics

Streams are just
[EventEmitters](http://nodejs.org/docs/latest/api/events.html#events_class_events_eventemitter)
that have a
[.pipe()](http://nodejs.org/docs/latest/api/stream.html#stream_stream_pipe_destination_options)
function and expected to act in a certain way depending if the stream is
readable, writable, or both (duplex).

To create a new stream, just do:

``` js
var Stream = require('stream');
var s = new Stream;
```

This new stream doesn't yet do anything because it is neither readable nor
writable.

## readable

To make that stream `s` into a readable stream, all we need to do is set the
`readable` property to true:

``` js
s.readable = true
```

Readable streams emit many `'data'` events and a single `'end'` event.
Your stream shouldn't emit any more `'data'` events after it emits the `'end'`
event.

This simple readable stream emits one `'data'` event per second for 5 seconds,
then it ends. The data is piped to stdout so we can watch the results as they

``` js
var Stream = require('stream');

function createStream () {
    var s = new Stream;
    s.readable = true

    var times = 0;
    var iv = setInterval(function () {
        s.emit('data', times + '\n');
        if (++times === 5) {
            s.emit('end');
            clearInterval(iv);
        }
    }, 1000);
    
    return s;
}

createStream().pipe(process.stdout);
```

```
substack : ~ $ node rs.js
0
1
2
3
4
substack : ~ $ 
```

In this example the `'data'` events have a string payload as the first argument.
Buffers and strings are the most common types of data to stream but it's
sometimes useful to emit other types of objects.

Just make sure that the types you're emitting as data is compatible with the
types that the writable stream you're piping into expects.
Otherwise you can pipe into an intermediary conversion or parsing stream before
piping to your intended destination.

## writable

Writable streams

## duplex

Duplex streams are just streams that are both readable and writable.

## pipe

`.pipe()` is the only member function of the built-in `Stream` prototype.

`.pipe(target)` returns the destination stream, `target`.
This means you can chain `.pipe()` calls together like in the shell with `|`.

### pause / resume / drain

## backpressure

## destroy

## stream-spec

## read more

* [core stream documentation](http://nodejs.org/docs/latest/api/stream.html#stream_stream)
* [notes on the stream api](http://maxogden.com/node-streams)
* [why streams are awesome](http://blog.dump.ly/post/19819897856/why-node-js-streams-are-awesome)

## the future

A big upgrade is planned for the stream api in node 0.9.
The basic apis with `.pipe()` will be the same, only the internals are going to
be different. The new api will also be backwards compatible with the existing
api documented here for a long time.

You can check the
[readable-stream](https://github.com/isaacs/readable-stream) repo to see what
these future streams will look like.

***

<!--
# built-in streams
-->
# ビルトインストリーム

These streams are built into node itself.

## [process.stdin](http://nodejs.org/docs/latest/api/process.html#process_process_stdin)

This readable stream contains the standard system input stream for your program.

It is paused by default but the first time you refer to it `.resume()` will be
called implicitly on the
[next tick](http://nodejs.org/docs/latest/api/process.html#process_process_nexttick_callback).

If process.stdin is a tty (check with
[`tty.isatty()`](http://nodejs.org/docs/latest/api/tty.html#tty_tty_isatty_fd))
then input events will be line-buffered. You can turn off line-buffering by
calling `process.stdin.setRawMode(true)` BUT the default handlers for key
combinations such as `^C` and `^D` will be removed.

## process.stdout

## process.stderr

## child_process.spawn()

## fs.createReadStream()

## fs.createWriteStream()

## [net.connect()](http://nodejs.org/docs/latest/api/net.html#net_net_connect_options_connectionlistener)

This function returns a [duplex stream] that connects over tcp to a remote
host.

You can start writing to the stream right away and the writes will be buffered
until the `'connect'` event fires.

## net.createServer()

## http.request()

## http.createServer()

## zlib.createGzip()

## zlib.createGunzip()

***

# control streams

## through

## from

## pause-stream

## concat-stream

## duplex

## duplexer

## emit-stream

## invert-stream

## map-stream

## remote-events

## buffer-stream

## event-stream

## auth-stream

***

# meta streams

## mux-demux

## stream-router

## multi-channel-mdm

***

# state streams

## cdrt

## delta-stream

***

# http streams

## request

## filed

## oppressor

## response-stream

***

# io streams

## reconnect

## kv

## discovery-network

***

# parser streams

## tar

## trumpet

## [JSONStream](https://github.com/dominictarr/JSONStream)

Use this module to parse and stringify json data from streams.

If you need to pass a large json collection through a slow connection or you
have a json object that will populate slowly this module will let you parse data
incrementally as it arrives.

## json-scrape

## stream-serializer

***

# browser streams

## shoe

## domnode

## sorta

## graph-stream

## arrow-keys

## attribute

## data-bind

***

# rpc streams

## dnode

## rpc-stream

***

# test streams

## tap

## stream-spec
