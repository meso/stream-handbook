<!--
# introduction
-->
# イントロダクション

<!--
This document covers the basics of how to write [node.js](http://nodejs.org/)
programs with [streams](http://nodejs.org/docs/latest/api/stream.html).
-->
このドキュメントは[ストリーム](http://nodejs.org/docs/latest/api/stream.html)を用いた[node.js](http://nodejs.org/)プログラムの基本的な書き方について説明します。

<!--
```
"We should have some ways of connecting programs like garden hose--screw in
another segment when it becomes necessary to massage data in
another way. This is the way of IO also."
```
-->
>プログラム同士をガーデニング用のホースのようにつなぎ合わせる仕組み、すなわち、データを何か別の方法で操作する必要が出てきたときに、他の部分にねじ込めるような仕組みがあるべきではないか。IOについても同じことが言える。（[ダグラス・マッキルロイ 1964年10月11日](http://cm.bell-labs.com/who/dmr/mdmpipe.html)）

![doug mcilroy](http://substack.net/images/mcilroy.png)

***

<!--
Streams come to us from the
[earliest days of unix](http://www.youtube.com/watch?v=tc4ROCJYbm0)
and have proven themselves over the decades as a dependable way to compose large
systems out of small components that
[do one thing well](http://www.faqs.org/docs/artu/ch01s06.html).
In unix, streams are implemented by the shell with `|` pipes.
In node, the built-in
[stream module](http://nodejs.org/docs/latest/api/stream.html)
is used by the core libraries and can also be used by user-space modules.
Similar to unix, the node stream module's primary composition operator is called
`.pipe()` and you get a backpressure mechanism for free to throttle writes for
slow consumers.
-->
[Unixの草創期](http://www.youtube.com/watch?v=tc4ROCJYbm0)に登場したストリームは、[1つのことをうまくやる](http://www.faqs.org/docs/artu/ch01s06.html)小さなコンポーネントを組み合わせて巨大なシステムを作り上げる際の信頼できる手法であることを、数十年に渡って証明してきました。Unixにおいては、ストリームはpipe`|`としてシェルに実装されています。Nodeではビルトインの[ストリームモジュール](http://nodejs.org/docs/latest/api/stream.html)はコアライブラリで利用されているほか、ユーザ領域のモジュールでも使用できます。Unixと同様に、Nodeのストリームモジュールの基礎となる合成演算子は ``.pipe()`` と呼ばれ、遅い消費者への書き込み速度を自由に調整するための背圧メカニズムも備わっています。

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
ストリームは、実装の表面を[再利用](http://www.faqs.org/docs/artu/ch01s06.html#id2877537)しやすい一貫性したインタフェースとして限定することで、[関心の分離](http://www.c2.com/cgi/wiki?SeparationOfConcerns)を促進します。だからこそ、1つのストリームの出力を他のストリームの入力へと繋ぐことができるのです。また、抽象的にストリームを操作する[ライブラリを用いる](http://npmjs.org)ことで、高レベルなフローコントロールを導入することもできます。

<!--
Streams are an important component of
[small-program design](https://michaelochurch.wordpress.com/2012/08/15/what-is-spaghetti-code/)
and [unix philosophy](http://www.faqs.org/docs/artu/ch01s06.html)
but there are many other important abstractions worth considering.
Just remember that [technical debt](http://c2.com/cgi/wiki?TechnicalDebt)
is the enemy and to seek the best abstractions for the problem at hand.
-->
ストリームは、[小さなコード設計](https://michaelochurch.wordpress.com/2012/08/15/what-is-spaghetti-code/)や[Unix哲学](http://www.faqs.org/docs/artu/ch01s06.html)において重要なコンポーネントです。しかし、他にも考慮すべき抽象的概念はたくさんあります。[技術的負債](http://c2.com/cgi/wiki?TechnicalDebt)は敵であることと、目の前にある問題に対する最適な抽象的概念を探し求めることを忘れないでください。

![brian kernighan](http://substack.net/images/kernighan.png)

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
NodeのI/Oは非同期なので、ハードディスクやネットワークとやり取りする際には、関数にコールバックを渡す必要があります。ファイルを配信するサーバーを以下のように書きたい衝動に駆られるでしょう。

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
このコードは動きはしますが、長ったらしい上に、毎回のリクエストごとに`data.txt`ファイルの全体をバッファをメモリに書き込み、その後でクライアントに結果を返します。もし、`data.txt`が非常に大きい場合は、このプログラムはユーザー数と同じだけの大量のメモリを消費しはじめるでしょう。また、ユーザーがコンテンツを受け取る前には、ファイルの全てが読み込まれるのを待たなければならず、レイテンシは非常に高いものになるでしょう。

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
この`.pipe()`は`fs.createReadStream()`から発生した`'data'`と`'end'`イベントの面倒を見てくれます。このコードはクリーンなだけではなく、いまや`data.txt`ファイルがハードディスクから読み込まれれば即時に、クライアントに1つのチャンクとして書き込まれるようになりました。

<!--
Using `.pipe()` has other benefits too, like handling backpressure automatically
so that node won't buffer chunks into memory needlessly when the remote client
is on a really slow or high-latency connection.
-->
`.pipe()`のメリットは他にもあります。自動的に背圧の制御をしてくれるので、リモートクライアントが非常に遅い時や、高レイテンシで接続している時などに、Nodeが必要もないのにチャンクをバッファとしてメモリに書き込んだりしなくても良いという点です。

<!--
But this example, while much better than the first one, is still rather verbose.
The biggest benefit of streams is their versatility. We can
[use a module](https://npmjs.org/) that operates on streams to make that example
even simpler:
-->
このサンプルは最初のものよりもずっと良いのですが、まだ冗長です。Streamの一番大きい利点は、Streamが何にでも融通をきかせられる点です。Streamを扱う[モジュール](https://npmjs.org/)を使ってもっとシンプルなサンプルを作ってみましょう。

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
圧縮がしたいですか？　それもストリームモジュールにあります！

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
一度ストリームAPIを使いこなせるようになれば、レゴブロックやガーデニング用のホースのように、ストリームのモジュールをピタっと合わせていくだけで良いのです。ふぞろいな非ストリームAPIを使って、データをどんな風にプッシュするかを覚えておく必要もなくなります。

<!--
Streams make programming in node simple, elegant, and composable.
-->
ストリームはNodeをシンプル・エレガントに、そして分割性を与えてくれます。

<!--
# basics
-->
# 基本

<!--
Streams are just
[EventEmitters](http://nodejs.org/docs/latest/api/events.html#events_class_events_eventemitter)
that have a
[.pipe()](http://nodejs.org/docs/latest/api/stream.html#stream_stream_pipe_destination_options)
function and expected to act in a certain way depending if the stream is
readable, writable, or both (duplex).
-->
ストリームは単なる[EventEmitter](http://nodejs.org/docs/latest/api/events.html#events_class_events_eventemitter)に[.pipe()](http://nodejs.org/docs/latest/api/stream.html#stream_stream_pipe_destination_options)メソッドをつけたもので、readableか、writableか、それともその両方か(duplex)に応じて、決められたふるまいが求められます。

<!--
To create a new stream, just do:
-->
新しいストリームを作成するには以下のようにするだけです。

``` js
var Stream = require('stream');
var s = new Stream;
```

<!--
This new stream doesn't yet do anything because it is neither readable nor
writable.
-->
新しいストリームは何もしません。というのも、readableでもwritableでもないからです。

<!--
## readable
-->
## readable

<!--
To make that stream `s` into a readable stream, all we need to do is set the
`readable` property to true:
-->
このストリーム`s`をreadableなものにするには、単に`reaaable`プロパティをtrueにすればそれでおしまいです。

``` js
s.readable = true
```

<!--
Readable streams emit many `'data'` events and a single `'end'` event.
Your stream shouldn't emit any more `'data'` events after it emits the `'end'`
event.
-->
readableなストリームは`data`イベントを何回も発行し、`end`イベントを1回だけ発行します。`end`イベントを発行したら、それ以上`data`イベントを発行すべきではありません。

<!--
This simple readable stream emits one `'data'` event per second for 5 seconds,
then it ends. The data is piped to stdout so we can watch the results as they
-->
この単純なreadableストリームは1秒に1回`data`イベントを発行するのを5秒間繰り返した後、終了します。データは標準出力にパイプされているので、そのふるまいを見てとることができます。

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

<!--
In this example the `'data'` events have a string payload as the first argument.
Buffers and strings are the most common types of data to stream but it's
sometimes useful to emit other types of objects.
-->
この例では`data`イベントは第1引数に文字列を格納しています。ストリームで扱うデータはバッファや文字列が最も一般的ですが、他のオブジェクトをemitとするのが有効な場合もあるでしょう。

<!--
Just make sure that the types you're emitting as data is compatible with the
types that the writable stream you're piping into expects.
Otherwise you can pipe into an intermediary conversion or parsing stream before
piping to your intended destination.
-->
emitしようとしているデータが、パイプしようとしているwritableストリームが期待するデータと互換性があるかどうかには注意してください。
そうでない場合は、もともと想定している相手にパイプする前に、中継・変換用、パース用のストリームをパイプすることもできます。

<!--
## writable
-->
## writable

<!--
Writable streams are streams that can accept input. To create a writable stream,
set the `writable` attribute to `true` and define `write()`, `end()`, and
`destroy()`.
-->
writableストリームとは、入力を受け取れるストリームのことです。writableストリームを作るには、`writable`プロパティを真にして、`write()`と`end()`、そして`destroy()`を定義します。

<!--
This writable stream will count all the bytes from an input stream and print the
result on a clean `end()`. If the stream is destroyed it will do nothing.
-->
以下のwritableストリームは、受け取ったストリームからバイト数を数えて、結果をシンプルな`end()`でプリントします。もしストリームが破棄(destroy)された場合には何もしません。

``` js
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
```

<!--
If we pipe a file to this writable stream:
-->

このwritableストリームにファイルをパイプしてみます。

``` js
var fs = require('fs');
fs.createReadStream('/etc/passwd').pipe(s);
```

```
$ node writable.js
2447 bytes written
```

<!--
One thing to watch out for is the convention in node to treat `end(buf)` as a
`write(buf)` then an `end()`. If you skip this it could lead to confusion
because people expect end to behave the way it does in core.
-->
ここで注意すべきなのは、`end(buf)`を`write(buf)`と`end()`の組み合わせとして扱うNodeの慣習です。他の人はendがコアモジュールで用いられているものと同様にふるまうことを期待するので、これを省略するのは混乱の原因となります。

<!--
## backpressure
-->
## 背圧

<!--
Backpressure is the mechanism that streams use to make sure that readable
streams don't emit data faster than writable streams can consume data.
-->
背圧は、writableストリームがデータを消費するよりも速いスピードで、readableストリームからのデータがemitされないようにするための仕組みです。

<!--
Note: the API for handling backpressure is changing substantially in future
versions of node (> 0.8). `pause()`, `resume()`, and `emit('drain')` are
scheduled for demolition. The notice has been on display in the local planning
office for months.
-->
背圧を管理するAPIは、Nodeのバージョン0.8以降で大幅な変更が加えられつつあります。`pause()`や`resume()`、`emit('drain')`は廃止される予定です。

<!--
In order to do backpressure correctly readable streams should
implement `pause()` and `resume()`. Writable streams return `false` in
`.write()` when they want the readable streams piped into them to slow down and
emit `'drain'` when they're ready for more data again.
-->
背圧を正しく実行するには、readableストリームが`pause()`と`resume()`を実装している必要があります。パイプされているreadableストリームのペースを緩めてほしい場合に、writableストリームの`.write()`はfalseを返します。そして再びデータを受け取る準備ができたときに`'drain'`を発行します。

<!--
### writable stream backpressure
-->
### wriableストリームの背圧

<!--
When a writable stream wants a readable stream to slow down it should return
`false` in its `.write()` function. This causes the `pause()` to be called on
each readable stream source.
-->
readableストリームの流れを緩やかにしたいときには、writableストリームの`.write()`メソッドはfalseを返すようにするべきです。こうすることで、readableストリームにおいて`pause()`が呼ばれます。

<!--
When the writable stream is ready to start receiving data again, it should emit
the `'drain'` event. Emitting `'drain'` causes the `resume()` function to be
called on each readable stream source.
-->
writableストリームがデータを受け取る準備ができたときには、`'drain'`イベントを発行すべきです。`'drain'`イベントが発行されることで、readableストリームにおいて`resume()`が呼ばれます。

<!--
### readable stream backpressure
-->
### readableストリームの背圧

<!--
When `pause()` is called on a readable stream, it means that a downstream
writable stream wants the upstream to slow down. The readable stream that
`pause()` was called on should stop emitting data but that isn't always
possible.
-->
readableストリームの`pause()`が呼ばれたということは、下流にあるwritableストリームが上流のreadableストリームの速さを緩やかにするよう望んでいることを意味します。`pause()`が呼ばれたら、readableストリームはデータのemitを止めるべきです。ただ、これは必ず可能なわけではありません。

<!--
When the downstream is ready for more data, the readable stream's `resume()`
function will be called.
-->
下流のストリームがデータを受け入れる準備ができたら、readableストリームの`resume()`が呼ばれます。

<!--
## pipe
-->
## パイプ

<!---
`.pipe()` is the glue that shuffles data from readable streams into writable
streams and handles backpressure. The pipe api is just:
-->
`.pipe()`は、readaleストリームのデータをwritableストリームに混ぜ込む糊の役割を果たします。また、背圧の管理も行います。パイプのAPIは単に以下のようにするだけです。

```
src.pipe(dst)
```

<!--
for a readable stream `src` and a writable stream `dst`. `.pipe()` returns the
`dst` so if `dst` is also a readable stream, you can chain `.pipe()` calls
together like:
-->
readableストリームである`src`と、writableストリームの`dst`に対して、`.pipe()`は`dst`を返します。なので、この`dst`はreadableストリームでもあるときには、以下のように`.pipe()`をつなぎ合わせることができます、

``` js
a.pipe(b).pipe(c).pipe(d)
```

<!--
which resembles what you might do in the shell with the `|` operator:
-->
これはシェルで`|`演算子を使うのと似ています。

```
a | b | c | d
```

<!--
The `a.pipe(b).pipe(c).pipe(d)` usage is the same as:
-->
`a.pipe(b).pipe(c).pipe(d)`という使い方は、以下と同等です。

```
a.pipe(b);
b.pipe(c);
c.pipe(d);
```

<!--
The stream implementation in core is just an event emitter with a pipe function.
`pipe()` is pretty short. You should read
[the source code](https://github.com/joyent/node/blob/master/lib/stream.js).
-->
コアモジュールでのストリームの実装は、単なるパイプ関数つきのEventEmitterです。`pipe()`の[ソースコード](https://github.com/joyent/node/blob/master/lib/stream.js)はごく短いので、目を通しておくべきでしょう。

<!--
## terms
-->
## 用語

<!--
These terms are useful for talking about streams.
-->
以下の用語はストリームについて語る上で便利です。

<!--
### through
-->
### through

<!--
Through streams are simple readable/writable filters that transform input and
produce output.
-->
throughストリームは入力を変換して出力する、簡単なreadableかつwritableなフィルタを指します。

<!--
### duplex
-->
### duplex

<!--
Duplex streams are readable/writable and both ends of the stream engage
in a two-way interaction, sending back and forth messages like a telephone. An
rpc exchange is a good example of a duplex stream. Any time you see something
like:
-->
duplexストリームはreadableかつwritabeで、たとえば電話でメッセージが行ったり来たりするように、お互いのストリームの端が双方向のインタラクションを受け持ちます。rpcのやり取りはduplexなストリームの好例と言えます。以下のようなコードを見かけたら、おそらくそれはduplexストリームを扱ったものでしょう。

``` js
a.pipe(b).pipe(a)
```

<!--
you're probably dealing with a duplex stream.
-->

<!--
## read more
-->
## さらなる読み物として

* [コアモジュールの公式ドキュメント](http://nodejs.org/docs/latest/api/stream.html#stream_stream)
* [ストリームに関する覚え書き（原題：notes on the stream api）](http://maxogden.com/node-streams)
* [ストリームがすごい理由（原題：why streams are awesome）](http://blog.dump.ly/post/19819897856/why-node-js-streams-are-awesome)
* [event-streamに関する覚え書き（原題：notes on event-stream）](http://thlorenz.com/#/blog/post/event-stream)

<!--
## the future
-->
## ストリームの将来

<!--
A big upgrade is planned for the stream api in node 0.9.
The basic apis with `.pipe()` will be the same, only the internals are going to
be different. The new api will also be backwards compatible with the existing
api documented here for a long time.
-->
バージョン0.9にて大幅なアップグレードが予定されています。ただ、`.pipe()`による基本的なAPIはそのままで、内部の実装に変更がある見込みです。新しいAPIとここに書かれた既存のAPIとの互換性は、当分の間、維持される予定です。

<!--
You can check the
[readable-stream](https://github.com/isaacs/readable-stream) repo to see what
these future streams will look like.
-->
将来、ストリームがどうなるのかは[readable-stream](https://github.com/isaacs/readable-stream)のリポジトリから見ることができます。

***

<!--
# built-in streams
-->
# 組み込みのストリーム

<!--
These streams are built into node itself.
-->
以下のストリームはNode自体に組み込まれています。

## process

### [process.stdin](http://nodejs.org/docs/latest/api/process.html#process_process_stdin)

<!--
This readable stream contains the standard system input stream for your program.
-->
このreadableストリームにはプログラムの標準入力が含まれています。

<!--
It is paused by default but the first time you refer to it `.resume()` will be
called implicitly on the
[next tick](http://nodejs.org/docs/latest/api/process.html#process_process_nexttick_callback).
-->
このストリームは初期状態では停止していますが、初めて参照したときに[next tick](http://nodejs.org/docs/latest/api/process.html#process_process_nexttick_callback)として`.resume()`が暗黙の内に実行されます。

<!--
If process.stdin is a tty (check with
[`tty.isatty()`](http://nodejs.org/docs/latest/api/tty.html#tty_tty_isatty_fd))
then input events will be line-buffered. You can turn off line-buffering by
calling `process.stdin.setRawMode(true)` BUT the default handlers for key
combinations such as `^C` and `^D` will be removed.
-->
標準入力がtty（[`tty.isatty()`](http://nodejs.org/docs/latest/api/tty.html#tty_tty_isatty_fd)を参照のこと）の場合、入力のイベントにはラインバッファが用いられます。`process.stdin.setRawMode(true)`を呼び出すことで、ラインバッファを無効化することができます。__けれども__`^C`や`^D`といったキーの組み合わせに対応するハンドラは削除されてしまいます。

### [process.stdout](http://nodejs.org/api/process.html#process_process_stdout)

<!--
This writable stream contains the standard system output stream for your program.
-->
このwritableストリームにはプログラムの標準出力が含まれています。

<!--
`write` to it if you want send data to stdout
-->
標準出力にデータを送りたいときには、ここに`write`してください。

### [process.stderr](http://nodejs.org/api/process.html#process_process_stderr)

<!--
This writable stream contains the standard system error stream for your program.
-->
このwritableストリームにはプログラムの標準エラー出力が含まれています。

<!--
`write` to it if you want send data to stderr
-->
標準エラー出力にデータを送りたいときには、ここに`write`してください。

## child_process.spawn()

## fs

### fs.createReadStream()

### fs.createWriteStream()

## net

### [net.connect()](http://nodejs.org/docs/latest/api/net.html#net_net_connect_options_connectionlistener)

<!--
This function returns a [duplex stream] that connects over tcp to a remote
host.
-->
この関数はtcpによるリモートホストへ接続する[duplexストリーム]を返します。

<!--
You can start writing to the stream right away and the writes will be buffered
until the `'connect'` event fires.
-->
ストリームへの書き込みはすぐに行なうことができて、`connect`イベントが発行されるまでバッファされます。

### net.createServer()

## http

### http.request()

### http.createServer()

## zlib

### zlib.createGzip()

### zlib.createGunzip()

### zlib.createDeflate()

### zlib.createInflate()

***

<!--
# control streams
-->
# ストリームの制御

## [through](https://github.com/dominictarr/through)

## [from](https://github.com/dominictarr/from)

## [pause-stream](https://github.com/dominictarr/pause-stream)

## [concat-stream](https://github.com/maxogden/node-concat-stream)

## [duplex](https://github.com/dominictarr/duplex)

## [duplexer](https://github.com/Raynos/duplexer)

## [emit-stream](https://github.com/substack/emit-stream)

## [invert-stream](https://github.com/dominictarr/invert-stream)

## [map-stream](https://github.com/dominictarr/map-stream)

## [remote-events](https://github.com/dominictarr/remote-events)

## [buffer-stream](https://github.com/Raynos/buffer-stream)

## [event-stream](https://github.com/dominictarr/event-stream)

## [auth-stream](https://github.com/Raynos/auth-stream)

***

<!--
# meta streams
-->
# メタストリーム

## [mux-demux](https://github.com/dominictarr/mux-demux)

## [stream-router](https://github.com/Raynos/stream-router)

## [multi-channel-mdm](https://github.com/Raynos/multi-channel-mdm)

***

<!--
# state streams
-->
# 状態ストリーム

## [crdt](https://github.com/dominictarr/crdt)

## [delta-stream](https://github.com/Raynos/delta-stream)

## [scuttlebutt](https://github.com/dominictarr/scuttlebutt)

<!--
[scuttlebutt](https://github.com/dominictarr/scuttlebutt) can be used for
peer-to-peer state synchronization with a mesh topology where nodes might only
be connected through intermediaries and there is no node with an authoritative
version of all the data.
-->
[scuttlebutt](https://github.com/dominictarr/scuttlebutt)はP2Pによる状態の同期にも利用できます。このメッシュ状のトポロジーにおいては、ノードは仲介者を通じて連結されているだけで、全てのデータのバージョンを管理するような特権的なノードは存在しません。

<!--
The kind of distributed peer-to-peer network that
[scuttlebutt](https://github.com/dominictarr/scuttlebutt) provides is especially
useful when nodes on different sides of network barriers need to share and
update the same state. An example of this kind of network might be browser
clients that send messages through an http server to each other and backend
processes that the browsers can't directly connect to. Another use-case might be
systems that span internal networks since IPv4 addresses are scarce.
-->
[scuttlebutt](https://github.com/dominictarr/scuttlebutt)が提供するような分散P2Pのネットワークは、異なるネットワーク上にあるノード同士が、同一の状態を共有・更新しなければならないときに特に効果を発揮します。この手のネットワークの1つの例が、クライアントがhttpサーバを経由して、直接には接続できないバックエンドのプロセスにメッセージを送る場合です。他のユースケースとしては、IPv4の不足を解消するために、内部ネットワーク同士を橋渡しするようなシステムなどがありそうです。

<!--
[scuttlebutt](https://github.com/dominictarr/scuttlebutt) uses a
[gossip protocol](https://en.wikipedia.org/wiki/Gossip_protocol)
to pass messages between connected nodes so that state across all the nodes will
[eventually converge](https://en.wikipedia.org/wiki/Eventual_consistency)
on the same value everywhere.
[scuttlebutt](https://github.com/dominictarr/scuttlebutt)においては、連結したノード同士が[結果整合性](https://en.wikipedia.org/wiki/Eventual_consistency)を保ちながら同じ値を共有する手段として、メッセージの受け渡しに[Gossipプロトコル](https://en.wikipedia.org/wiki/Gossip_protocol)という手段を用いています。

<!--
Using the `scuttlebutt/model` interface, we can create some nodes and pipe them
to each other to create whichever sort of network we want:
-->
`scuttlebutt/model`インターフェースを利用してノードを作成し、それらをパイプでつなぎあわせることで、どんなネットワークでも思いのままに作ることができます。

``` js
var Model = require('scuttlebutt/model');
var am = new Model;
var as = am.createStream();

var bm = new Model;
var bs = bm.createStream();

var cm = new Model;
var cs = cm.createStream();

var dm = new Model;
var ds = dm.createStream();

var em = new Model;
var es = em.createStream();

as.pipe(bs).pipe(as);
bs.pipe(cs).pipe(bs);
bs.pipe(ds).pipe(bs);
ds.pipe(es).pipe(ds);

em.on('update', function (key, value, source) {
    console.log(key + ' => ' + value + ' from ' + source);
});

am.set('x', 555);
```

<!--
The network we've created is an undirected graph that looks like:
-->
ここで作成したネットワークは以下のような無向グラフです。

```
a <-> b <-> c
      ^
      |
      v
      d <-> e
```

<!--
Note that nodes `a` and `e` aren't directly connected, but when we run this
script:
-->
ノード`a`と`e`は直接には連結していせん。しかしこのスクリプトを実行すると……

```
$ node model.js
x => 555 from 1347857300518
```

<!--
the value that node `a` set finds its way to node `e` by way of nodes `b` and
`d`. Here all the nodes are in the same process but because
[scuttlebutt](https://github.com/dominictarr/scuttlebutt) uses a
simple streaming interface, the nodes can be placed on any process or server and
connected with any streaming transport that can handle string data.
-->
ノード`a`にセットされた値はノード`b`と`d`を経由して`e`への道筋を見いだします。この例では全てのノードが同じプロセス上にありますが、[scuttlebutt](https://github.com/dominictarr/scuttlebutt)はシンプルなストリーミングのインターフェースを利用しているので、ノードはどのプロセスに、どのサーバに置かれていても、また文字列を扱うことができさえすれば、どんなストリーミングのトランスポートであっても大丈夫です。

<!--
Next we can make a more realistic example that connects over the network and
increments a counter variable.
-->
次に、ネットワーク越しにカウンタ変数をインクリメントするような、より現実的な例を作ってみます。

<!--
Here's the server which will set the initial `count` value to 0 and `count ++`
every 320 milliseconds, printing all updates to count:
-->
この例では、サーバは`count`の初期値を0にセットし、320ミリ秒ごとに`count ++`を実行、countの更新があるたびにプリントします。

``` js
var Model = require('scuttlebutt/model');
var net = require('net');

var m = new Model;
m.set('count', '0');
m.on('update', function (key, value) {
    console.log(key + ' = ' + m.get('count'));
});

var server = net.createServer(function (stream) {
    stream.pipe(m.createStream()).pipe(stream);
});
server.listen(8888);

setInterval(function () {
    m.set('count', Number(m.get('count')) + 1);
}, 320);
```

<!--
Now we can make a client that connects to this server, updates the count on an
interval, and prints all the updates it receives:
-->
さて、このサーバに接続して、countの値を一定時間ごとに更新、受け取った更新をプリントするクライアントを作ることができます。

``` js
var Model = require('scuttlebutt/model');
var net = require('net');

var m = new Model;
var s = m.createStream();

s.pipe(net.connect(8888, 'localhost')).pipe(s);

m.on('update', function cb (key) {
    // wait until we've gotten at least one count value from the network
    if (key !== 'count') return;
    m.removeListener('update', cb);
    
    setInterval(function () {
        m.set('count', Number(m.get('count')) + 1);
    }, 100);
});

m.on('update', function (key, value) {
    console.log(key + ' = ' + value);
});
```

<!--
The client is slightly trickier since it should wait until it has an update from
somebody else to start updating the counter itself or else its counter would be
zeroed.
-->
クライアントは少しだけ奇妙な書き方をしています。誰かから更新を受けとるまで、自身によるカウンタの更新を待たなければならないからです。そうしないとカウンタは0になってしまう可能性があります。

<!--
Once we get the server and some clients running we should see a sequence like this:
-->
サーバの立ち上げに成功し、いくつかのクライアントが実行されると、以下のような出力列が見られます。

```
count = 183
count = 184
count = 185
count = 186
count = 187
count = 188
count = 189
```

<!--
Occasionally on some of the nodes we might see a sequence with repeated values like:
-->
時折、一部のノードでは出力列に同じ値の繰り返しが見られる場合があります。

```
count = 147
count = 148
count = 149
count = 149
count = 150
count = 151
```

<!--
These values are due to
[scuttlebutt's](https://github.com/dominictarr/scuttlebutt)
history-based conflict resolution algorithm which is hard at work ensuring that the state of the system across all nodes is eventually consistent.
-->
このような値をとるのは、[scuttlebutt's](https://github.com/dominictarr/scuttlebutt)の履歴ベースの衝突解消アルゴリズムが、全てのノードの状態の最終的に一貫したものにするために作動しているからです。

<!--
Note that the server in this example is just another node with the same
privledges as the clients connected to it. The terms "client" and "server" here
don't affect how the state synchronization proceeds, just who initiates the
connection. Protocols with this property are often called symmetric protocols.
See [dnode](https://github.com/substack/dnode) for another example of a
symmetric protocol.
-->
ここで取り上げた例において、サーバとは、接続してくるクライアントと同等の権限しか持たないノードの1つに過ぎません。「クライアント」と「サーバ」という用法は、単に誰がコネクションの口火を切るのかに関連しているだけで、状態の同期がどのような手順に従うかとは無関係です。このような性質を備えたプロトコルはしばしばシンメトリック・プロトコルと呼ばれています。シンメトリック・プロトコルに関する別の例として[dnode](https://github.com/substack/dnode)もご覧ください。

***
<!--
# http streams
-->
# httpストリーム

## [request](https://github.com/mikeal/request)

## [filed](https://github.com/mikeal/filed)

## [oppressor](https://github.com/substack/oppressor)

## [response-stream](https://github.com/substack/response-stream)

***

<!--
#io streams
-->
# IOストリーム

## [reconnect](https://github.com/dominictarr/reconnect)

## [kv](https://github.com/dominictarr/kv)

## [discovery-network](https://github.com/Raynos/discovery-network)

***
<!--
# parser streams
-->
# パーサストリーム
## [tar](https://github.com/creationix/node-tar)

## [trumpet](https://github.com/substack/node-trumpet)

## [JSONStream](https://github.com/dominictarr/JSONStream)

<!--
Use this module to parse and stringify json data from streams.
-->
json形式のデータをパースしたり、文字列に変換するのに用います。

<!--
If you need to pass a large json collection through a slow connection or you
have a json object that will populate slowly this module will let you parse data
incrementally as it arrives.
-->
遅いコネクション越しにサイズの大きいjsonを渡す必要があるときや、少しずつしかやってこないjsonオブジェクトを扱うときにこのモジュールを使えば、データの到着と同時に少しずつパースすることができます。

## [json-scrape](https://github.com/substack/json-scrape)

## [stream-serializer](https://github.com/dominictarr/stream-serializer)

***

# ブラウザストリーム

## [shoe](https://github.com/substack/shoe)

## [domnode](https://github.com/maxogden/domnode)

## [sorta](https://github.com/substack/sorta)

## [graph-stream](https://github.com/substack/graph-stream)

## [arrow-keys](https://github.com/Raynos/arrow-keys)

## [attribute](https://github.com/Raynos/attribute)

## [data-bind](https://github.com/travis4all/data-bind)

***

<!--
# audio streams
-->
# オーディオストリーム

## [baudio](https://github.com/substack/baudio)

<!--
# rpc streams
-->
# rpcストリーム

## [dnode](https://github.com/substack/dnode)

<!--
[dnode](https://github.com/substack/dnode) lets you call remote functions
through any kind of stream.
-->
[dnode](https://github.com/substack/dnode)を使えば、どんなストリームを介しても、リモートの関数を呼び出せるようになります。

<!--
Here's a basic dnode server:
-->
以下は基本的なdnoneサーバの例です。

``` js
var dnode = require('dnode');
var net = require('net');

var server = net.createServer(function (c) {
    var d = dnode({
        transform : function (s, cb) {
            cb(s.replace(/[aeiou]{2,}/, 'oo').toUpperCase())
        }
    });
    c.pipe(d).pipe(c);
});

server.listen(5004);
```

<!--
then you can hack up a simple client that calls the server's `.transform()`
function:
-->
さて、サーバの`.transform()`を呼び出すシンプルなクライアントにかかりましょう。

``` js
var dnode = require('dnode');
var net = require('net');

var d = dnode();
d.on('remote', function (remote) {
    remote.transform('beep', function (s) {
        console.log('beep => ' + s);
        d.end();
    });
});

var c = net.connect(5004);
c.pipe(d).pipe(c);
```

<!--
Fire up the server, then when you run the client you should see:
-->
サーバを立ち上げて、クライアントを実行すると、以下のように表示されるはずです。

```
$ node client.js
beep => BOOP
```

<!--
The client sent `'beep'` to the server's `transform()` function and the server
called the client's callback with the result, neat!
-->
クライアントがサーバの`transform()`関数に`'beep'`を送ると、サーバはその結果と共にクライアントのコールバックを実行します。すごい！

<!--
The streaming interface that dnode provides here is a duplex stream since both
the client and server are piped to each other (`c.pipe(d).pipe(c)`) with
requests and responses coming from both sides.
-->
ここでdnodeが提供するストリームのインターフェースはduplexストリームだと言えます。というのも、クライアントとサーバの双方がパイプでつながれていて`c.pipe(d).pipe(c)`、リクエストとレスポンスが両サイドからやってくるからです。

<!--
The craziness of dnode begins when you start to pass function arguments to
stubbed callbacks. Here's an updated version of the previous server with a
multi-stage callback passing dance:
-->
dnodeのやばいところは、スタブとして利用するコールバックの引数に関数を渡すことができる点です。以下が先ほどのサーバを書き換えたもので、多段式のコールバックがあっちこっちで受け渡されるバージョンです。

``` js
var dnode = require('dnode');
var net = require('net');

var server = net.createServer(function (c) {
    var d = dnode({
        transform : function (s, cb) {
            cb(function (n, fn) {
                var oo = Array(n+1).join('o');
                fn(s.replace(/[aeiou]{2,}/, oo).toUpperCase());
            });
        }
    });
    c.pipe(d).pipe(c);
});

server.listen(5004);
```

<!--
Here's the updated client:
-->
クライアント側も書き換えたのが以下です。

``` js
var dnode = require('dnode');
var net = require('net');

var d = dnode();
d.on('remote', function (remote) {
    remote.transform('beep', function (cb) {
        cb(10, function (s) {
            console.log('beep:10 => ' + s);
            d.end();
        });
    });
});

var c = net.connect(5004);
c.pipe(d).pipe(c);
```

<!--
After we spin up the server, when we run the client now we get:
-->
サーバを立ち上げて、クライアントを実行すると、以下のように表示されます。

```
$ node client.js
beep:10 => BOOOOOOOOOOP
```

<!--
It just works!™
-->
ちゃんと動く！™

<!--
The basic idea is that you just put functions in objects and you call them from
the other side of a stream and the functions will be stubbed out on the other
end to do a round-trip back to the side that had the original function in the
first place. The best thing is that when you pass functions to a stubbed
function as arguments, those functions get stubbed out on the *other* side!
-->
オブジェクトにしまっておいた関数はストリームの反対側から呼び出された後、スタブとして利用され、ぐるっと回って元々の関数があった最初の場所に戻ってきます。これが基本的な考えです。すばらしいのは、スタブ関数の引数として渡された関数が、__反対側__でスタブとして利用される点です。

<!--
This approach of stubbing function arguments recursively shall henceforth be
known as the "turtles all the way down" gambit. The return values of any of your
functions will be ignored and only enumerable properties on objects will be
sent, json-style.
-->
このように関数の引数を再帰的にスタブとして利用するアプローチを、今後は「どこまで行っても亀がいる」戦略と呼びたいと思います。関数の返り値は全て無視され、オブジェクトの列挙可能なプロパティのみがjson形式で送られます。

<!--
It's turtles all the way down!
-->
どこまで行っても、亀！

![どこまで行っても、亀！](http://substack.net/images/all_the_way_down.png)

<!--
Since dnode works in node or on the browser over any stream it's easy to call
functions defined anywhere and especially useful when paired up with
[mux-demux](https://github.com/dominictarr/mux-demux) to multiplex an rpc stream
for control alongside some bulk data streams.
-->
dnodeはどんなストリームでも、Node側でもブラウザ側でも動作するので、関数がどこで定義されていようと呼び出せます。とりわけ[mux-demux](https://github.com/dominictarr/mux-demux)とあわせてrpcストリームを多重化し、巨大なデータストリームを並列でコントロールする際には特に役に立ちます。

## [rpc-stream](https://github.com/dominictarr/rpc-stream)

***

<!--
# test streams
-->
# ストリームのテスト

## [tap](https://github.com/isaacs/node-tap)

## [stream-spec](https://github.com/dominictarr/stream-spec)

***

<!--
# power combos
-->
# 強力なコンボ

<!--
## roll your own socket.io
-->
## socket.ioをくるむ

<!--
We can build a socket.io-style event emitter api over streams using some of the
libraries mentioned earlier in this document.
-->
先に述べたライブラリを活用することで、ストリーム上にsocket.io風のEventEmitter型APIを構築することができます。

<!--
First  we can use [shoe](http://github.com/substack/shoe)
to create a new websocket handler server-side and
[emit-stream](https://github.com/substack/emit-stream)
to turn an event emitter into a stream that emits objects.
The object stream can then be fed into
[JSONStream](https://github.com/dominictarr/JSONStream)
to serialize the objects and from there the serialized stream can be piped into
the remote browser.
-->
まず、サーバサイドのwebsocketハンドラとして[shoe](http://github.com/substack/shoe)が使えます。EventEmiterを、オブジェクトをemit可能なストリームに変換するには[emit-stream](https://github.com/substack/emit-stream)が利用できます。オブジェクトのストリームは[JSONStream](https://github.com/dominictarr/JSONStream)によってシリアライズされ、シリアライズされたストリームはリモートのブラウザにパイプできます。

``` js
var EventEmitter = require('events').EventEmitter;
var shoe = require('shoe');
var emitStream = require('emit-stream');
var JSONStream = require('JSONStream');

var sock = shoe(function (stream) {
    var ev = new EventEmitter;
    emitStream(ev)
        .pipe(JSONStream.stringify())
        .pipe(stream)
    ;
    ...
});
```

<!--
Inside the shoe callback we can emit events to the `ev` function.  Here we'll
just emit different kinds of events on intervals:
-->
shoeのコールバックの中で、`ev`に登録された関数にイベントを発行することができます。以下では一定時間ごとに異なるイベントを発行しています。

``` js
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
```

<!--
Finally the shoe instance just needs to be bound to an http server:
-->
最後に、shoeのインスタンスをhttpサーバにバインドしてやる必要があります。

``` js
var http = require('http');
var server = http.createServer(require('ecstatic')(__dirname));
server.listen(8080);

sock.install(server, '/sock');
```

<!--
Meanwhile on the browser side of things just parse the json shoe stream and pass
the resulting object stream to `eventStream()`. `eventStream()` just returns an
event emitter that emits the server-side events:
-->
ブラウザ側では、json形式のshoeストリームをパースして、結果のオブジェクトストリームを`eventStram()`に渡します。`eventStream()`はサーバサイドのイベントをemitするEventEmitterを返します。

``` js
var shoe = require('shoe');
var emitStream = require('emit-stream');
var JSONStream = require('JSONStream');

var parser = JSONStream.parse([true]);
var stream = parser.pipe(shoe('/sock')).pipe(parser);
var ev = emitStream(stream);

ev.on('lower', function (msg) {
    var div = document.createElement('div');
    div.textContent = msg.toLowerCase();
    document.body.appendChild(div);
});

ev.on('upper', function (msg) {
    var div = document.createElement('div');
    div.textContent = msg.toUpperCase();
    document.body.appendChild(div);
});
```

<!--
Use [browserify](https://github.com/substack/node-browserify) to build this
browser source code so that you can `require()` all these nifty modules
browser-side:
-->
ブラウザ側のソースコードをビルドするのに[browserify](https://github.com/substack/node-browserify)を使えば、これらの便利なモジュールをブラウザ側で`require()`することができます。

```
$ browserify main.js -o bundle.js
```

<!--
Then drop a `<script src="/bundle.js"></script>` into some html and open it up
in a browser to see server-side events streamed through to the browser side of
things.
-->
あとは適当なhtmlに`<script src="/bundle.js"></script>`と貼りつけてブラウザで開くと、サーバサイドのイベントがブラウザにストリームされてくるのがわかります。

<!--
With this streaming approach you can rely more on tiny reusable components that
only need to know how to talk streams. Instead of routing messages through a
global event system socket.io-style, you can focus more on breaking up your
application into tinier units of functionality that can do exactly one thing
well.
-->
このようなストリーム的なアプローチを活用することで、ストリームと対話する方法のみを知っているような、コンパクトで再利用可能な部品を当てにすることができます。メッセージのルーティングをsocket.io型のグローバルなイベント機構によって行う代わりに、アプリケーションを、たった1つのことをうまくやるだけの小さな機能のかたまりに分けることだけに頭を使えばよくなります。

<!--
For instance you can trivially swap out JSONStream in this example for
[stream-serializer](https://github.com/dominictarr/stream-serializer)
to get a different take on serialization with a different set of tradeoffs.
You could bolt layers over top of shoe to handle
[reconnections](https://github.com/dominictarr/reconnect) or heartbeats
using simple streaming interfaces.
You could even add a stream into the chain to use namespaced events with
[eventemitter2](https://npmjs.org/package/eventemitter2) instead of the
EventEmitter in core.
-->
ちょっとした例を挙げましょう。様々な条件を考慮して別の方法でシリアライズをしようと考えた場合には、上のサンプルで用いたJSONStreamを[stream-serializer](https://github.com/dominictarr/stream-serializer)に交換できます。ストリームのシンプルなインターフェースを利用することで、[reconnections](https://github.com/dominictarr/reconnect)やheartbeatsを管理するレイヤーをshoeに取り付けることもできます。コアモジュールのEventEmitterの代わりに、[eventemitter2](https://npmjs.org/package/eventemitter2)による名前空間つきイベントを利用する場合でさえも、ストリームを組み込むことができます。

<--
If you want some different streams that act in different ways it would likewise
be pretty simple to run the shoe stream in this example through mux-demux to
create separate channels for each different kind of stream that you need.
-->
もし異なるふるまいを見せる別々のストリームを扱いたいのであれば、この例で挙げたshoeのストリームをmux-demuxの上で流れるようにすればよさそうです。こうすれば、必要なストリームの種類に応じて別々のチャネルを作り出すことができます。これも同じようにごくシンプルにできます。

<!--
As the requirements of your system evolve over time, you can swap out each of
these streaming pieces as necessary without as many of the all-or-nothing risks
that more opinionated framework approaches necessarily entail.
-->
システムの要件が複雑になるにつれて、より硬直的なフレームワークによるアプローチには付き物の一か八かのリスクを冒すことなしに、ストリームのピースを必要に応じて取り換えることができます。
