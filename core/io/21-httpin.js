/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var bodyParser = require("body-parser");
    var multer = require("multer");
    var cookieParser = require("cookie-parser");
    var getBody = require('raw-body');
    var cors = require('cors');
    var jsonParser = bodyParser.json();
    var urlencParser = bodyParser.urlencoded({extended:true});
    var onHeaders = require('on-headers');
    var typer = require('media-typer');
    var isUtf8 = require('is-utf8');
    var hashSum = require("hash-sum");

     /// GraphQL  BEGIN 
    var express_graphql = require('express-graphql'); 
    var { buildSchema } = require('graphql'); 
    var deasync = require('deasync'); // to manage callback

    const homeDir = require('os').homedir();
    var Datastore = require('nedb');
    var db = new Datastore(homeDir+'/mqtt_event.db');
    db.loadDatabase();
    
    // GraphQL schema

    var schema = buildSchema(`
    interface Node {
        _id: ID!
    }

    enum EventType {
        normal
        overheated
        reboot
        all
    }

    enum EventSort {
        NEWEST_FIRST
        OLDEST_FIRST
    }

    enum Operator {
        LESS_THAN
        GREATER_THAN
    }

    type Event implements Node {
        _id: ID!
        temperature: Int!
        created: String!
        packetId: String!
        topic: String!
        eventType: String!
        location: String!
    }

    type Query {
       timeNow: String
       overHeated ( eventOrder: EventSort = NEWEST_FIRST ): [Event]
       eventQuery ( eventTopic: String, eventType: EventType = all, eventOrder: EventSort = NEWEST_FIRST, eventLimit : Int = 5 ): [Event]
       temperatureQuery ( num: Int = 50,  eventOp: Operator = LESS_THAN,  eventOrder: EventSort = NEWEST_FIRST): [Event]
       temperatureAvg ( eventTopic: String ): String
       node(_id: ID!): Node
    }
    `);

    // GraphQL Root Resolver

    var root = {
        timeNow: () => Date().toString()
        ,
        overHeated: (args, context) => { 
              // Query Example  
              //{
              //  overHeated (eventOrder : OLDEST_FIRST) {
              //        _id
              //        created
              //    }
              //} 
              var done = false;
              var docs;     
              context.db.find({ eventType: 'overheated' }, function (err, result) {
                 //console.log(docs);
                 docs = result;
                 done = true;
              });
              deasync.loopWhile( function() { return !done;});
    
              var newDocs = JSON.parse(JSON.stringify(docs));
      
              if ( args.eventOrder == 'NEWEST_FIRST')
                newDocs.sort(function(x, y){
                  return y.timestamp - x.timestamp;
                });
              else
                newDocs.sort(function(y, x){
                  return y.timestamp - x.timestamp;
                });
    
              //console.log(newDocs);
              return newDocs;
    
        }
        ,
        eventQuery: (args, context) => { 
              // Query Example  
              //{
              //  eventList ( eventType : overheated, eventOrder : OLDEST_FIRST, eventLimit : 4) {
              //    _id
              //    created
              //  }
              //}      
              var done = false;
              var docs;  
             
              // => neDB supports sort & limit. If you wish to use it.
              //
              //var sortOrder = { temperature : 1 }
              //if ( args.eventOrder == 'OLDEST_FIRST') 
              //  sortOrder = { temperature : -1 }
              //db.find({ eventType: args.eventType }).sort( sortOrder ).limit(eventLimit).exec(function (err, result) {
              //  docs = result;
              // done = true;
              //});

              var queryString = {}
              if ( args.eventType != 'all' )
                  queryString['eventType'] = args.eventType;
              if ( args.eventTopic != undefined )
                  queryString['topic'] = new RegExp(args.eventTopic);
              //db.find({ eventType: args.eventType }, function (err, result) {
              context.db.find( queryString, function (err, result) {
                 docs = result;
                 done = true;
              });
              deasync.loopWhile( function() { return !done;});
    
              var newDocs = JSON.parse(JSON.stringify(docs));
              if ( args.eventOrder == 'NEWEST_FIRST')
                newDocs.sort(function(x, y){
                  return y.timestamp - x.timestamp;
                });
              else
                newDocs.sort(function(y, x){
                  return y.timestamp - x.timestamp;
                });
              //console.log(newDocs);
              return newDocs.slice(0, Math.min( args.eventLimit, newDocs.length ));
  
        }
        ,
        temperatureQuery: (args, context ) => { 
              // Conditional Query Example  
              //{
              //  temperatureSurvey (num : 99, tempOp : GREATER_THAN ) {
              //    _id
              //    created
              //    temperature
              //  }
              //}    
              var done = false;
              var docs;  
              var OP = {}
              switch ( args.eventOp) {
              case 'LESS_THAN': OP = { $lte: args.num }; break;
              case 'GREATER_THAN': OP = { $gte: args.num }; break;
              }
              context.db.find({ "temperature": OP }, function (err, result) {
                 docs = result;
                 done = true;
              });
              deasync.loopWhile( function() { return !done;});
    
              var newDocs = JSON.parse(JSON.stringify(docs));
              
              if ( args.eventOrder == 'NEWEST_FIRST')
                newDocs.sort(function(x, y){
                  return y.timestamp - x.timestamp;
                });
              else
                newDocs.sort(function(y, x){
                  return y.timestamp - x.timestamp;
                });
             
              //console.log(newDocs);
              return newDocs;
  
        }    
        ,
        temperatureAvg: (args, context ) => { 
              // Query Example  
              //{
              //  temperatureAvg ( building : "building12" ) 
              //  }
              //}    
              var done = false;
              var docs;  

              var re = new RegExp(args.eventTopic);
              // search building && temperature != 0.  "reboot" has { temperatuure : 0} 
              context.db.find({ "topic": re, "temperature": { $ne: 0 } }, function (err, result) {
                 docs = result;
                 done = true;
              });
              deasync.loopWhile( function() { return !done;});
    
              if (!docs.length) return 0;
              
              // .reduce() ? but I'd like to avoid callback here. 
              var averageTemp  = 0;
              for (var i = 0; i  < docs.length ; i++) {
                averageTemp += docs[i].temperature; 
              }
              
              //console.log(docs);
              return averageTemp/docs.length;
  
        }    
        
    };
    //// GraphQL END

    function rawBodyParser(req, res, next) {
        if (req.skipRawBodyParser) { next(); } // don't parse this if told to skip
        if (req._body) { return next(); }
        req.body = "";
        req._body = true;

        var isText = true;
        var checkUTF = false;

        if (req.headers['content-type']) {
            var parsedType = typer.parse(req.headers['content-type'])
            if (parsedType.type === "text") {
                isText = true;
            } else if (parsedType.subtype === "xml" || parsedType.suffix === "xml") {
                isText = true;
            } else if (parsedType.type !== "application") {
                isText = false;
            } else if (parsedType.subtype !== "octet-stream") {
                checkUTF = true;
            } else {
                // applicatino/octet-stream
                isText = false;
            }
        }

        getBody(req, {
            length: req.headers['content-length'],
            encoding: isText ? "utf8" : null
        }, function (err, buf) {
            if (err) { return next(err); }
            if (!isText && checkUTF && isUtf8(buf)) {
                buf = buf.toString()
            }
            req.body = buf;
            next();
        });
    }

    var corsSetup = false;

    function createRequestWrapper(node,req) {
        // This misses a bunch of properties (eg headers). Before we use this function
        // need to ensure it captures everything documented by Express and HTTP modules.
        var wrapper = {
            _req: req
        };
        var toWrap = [
            "param",
            "get",
            "is",
            "acceptsCharset",
            "acceptsLanguage",
            "app",
            "baseUrl",
            "body",
            "cookies",
            "fresh",
            "hostname",
            "ip",
            "ips",
            "originalUrl",
            "params",
            "path",
            "protocol",
            "query",
            "route",
            "secure",
            "signedCookies",
            "stale",
            "subdomains",
            "xhr",
            "socket" // TODO: tidy this up
        ];
        toWrap.forEach(function(f) {
            if (typeof req[f] === "function") {
                wrapper[f] = function() {
                    node.warn(RED._("httpin.errors.deprecated-call",{method:"msg.req."+f}));
                    var result = req[f].apply(req,arguments);
                    if (result === req) {
                        return wrapper;
                    } else {
                        return result;
                    }
                }
            } else {
                wrapper[f] = req[f];
            }
        });


        return wrapper;
    }
    function createResponseWrapper(node,res) {
        var wrapper = {
            _res: res
        };
        var toWrap = [
            "append",
            "attachment",
            "cookie",
            "clearCookie",
            "download",
            "end",
            "format",
            "get",
            "json",
            "jsonp",
            "links",
            "location",
            "redirect",
            "render",
            "send",
            "sendfile",
            "sendFile",
            "sendStatus",
            "set",
            "status",
            "type",
            "vary"
        ];
        toWrap.forEach(function(f) {
            wrapper[f] = function() {
                node.warn(RED._("httpin.errors.deprecated-call",{method:"msg.res."+f}));
                var result = res[f].apply(res,arguments);
                if (result === res) {
                    return wrapper;
                } else {
                    return result;
                }
            }
        });
        return wrapper;
    }

    var corsHandler = function(req,res,next) { next(); }

    if (RED.settings.httpNodeCors) {
        corsHandler = cors(RED.settings.httpNodeCors);
        RED.httpNode.options("*",corsHandler);
    }

    function HTTPIn(n) {
        RED.nodes.createNode(this,n);
        if (RED.settings.httpNodeRoot !== false) {

            if (!n.url) {
                this.warn(RED._("httpin.errors.missing-path"));
                return;
            }
            this.url = n.url;
            if (this.url[0] !== '/') {
                this.url = '/'+this.url;
            }
            this.method = n.method;
            this.upload = n.upload;
            this.swaggerDoc = n.swaggerDoc;

            var node = this;

            this.errorHandler = function(err,req,res,next) {
                node.warn(err);
                res.sendStatus(500);
            };

            this.callback = function(req,res) {

                var msgid = RED.util.generateId();
                res._msgid = msgid;
                if (node.method.match(/^(post|delete|put|options|patch)$/)) {
                    node.send({_msgid:msgid,req:req,res:createResponseWrapper(node,res),payload:req.body});
                } else if (node.method == "get") {
                    node.send({_msgid:msgid,req:req,res:createResponseWrapper(node,res),payload:req.query});
                } else if (node.method == "all")  {

                    if ( req.method.match(/^(POST|DELETE|PUT|OPTIONS|PATCH)$/)) {
                        node.send({_msgid:msgid,req:req,res:createResponseWrapper(node,res),payload:req.body});
                    } else if (req.method == "GET") {
                        node.send({_msgid:msgid,req:req,res:createResponseWrapper(node,res),payload:req.query});
                    }
                } else { 
                       node.send({_msgid:msgid,req:req,res:createResponseWrapper(node,res)});
                }
            };

            var httpMiddleware = function(req,res,next) { next(); }

            if (RED.settings.httpNodeMiddleware) {
                if (typeof RED.settings.httpNodeMiddleware === "function") {
                    httpMiddleware = RED.settings.httpNodeMiddleware;
                }
            }

            var metricsHandler = function(req,res,next) { next(); }
            if (this.metric()) {
                metricsHandler = function(req, res, next) {
                    var startAt = process.hrtime();
                    onHeaders(res, function() {
                        if (res._msgid) {
                            var diff = process.hrtime(startAt);
                            var ms = diff[0] * 1e3 + diff[1] * 1e-6;
                            var metricResponseTime = ms.toFixed(3);
                            var metricContentLength = res._headers["content-length"];
                            //assuming that _id has been set for res._metrics in HttpOut node!
                            node.metric("response.time.millis", {_msgid:res._msgid} , metricResponseTime);
                            node.metric("response.content-length.bytes", {_msgid:res._msgid} , metricContentLength);
                        }
                    });
                    next();
                };
            }

            var multipartParser = function(req,res,next) { next(); }
            if (this.upload) {
                var mp = multer({ storage: multer.memoryStorage() }).any();
                multipartParser = function(req,res,next) {
                    mp(req,res,function(err) {
                        req._body = true;
                        next(err);
                    })
                };
            }

            if (this.method == "get") {
                RED.httpNode.get(this.url,cookieParser(),httpMiddleware,corsHandler,metricsHandler,this.callback,this.errorHandler);
            } else if (this.method == "post") {
                RED.httpNode.post(this.url,cookieParser(),httpMiddleware,corsHandler,metricsHandler,jsonParser,urlencParser,multipartParser,rawBodyParser,this.callback,this.errorHandler);
            } else if (this.method == "put") {
                RED.httpNode.put(this.url,cookieParser(),httpMiddleware,corsHandler,metricsHandler,jsonParser,urlencParser,rawBodyParser,this.callback,this.errorHandler);
            } else if (this.method == "patch") {
                RED.httpNode.patch(this.url,cookieParser(),httpMiddleware,corsHandler,metricsHandler,jsonParser,urlencParser,rawBodyParser,this.callback,this.errorHandler);
            } else if (this.method == "delete") {
                RED.httpNode.delete(this.url,cookieParser(),httpMiddleware,corsHandler,metricsHandler,jsonParser,urlencParser,rawBodyParser,this.callback,this.errorHandler);
            } else if (this.method == "all") {
                RED.httpNode.all(this.url,cookieParser(),httpMiddleware,corsHandler,metricsHandler,jsonParser,urlencParser,multipartParser,rawBodyParser,this.callback,this.errorHandler);
            } else if (this.method == "graphql") {

                RED.httpNode.use( '/graphql', express_graphql({
                    schema: schema,
                    rootValue: root,
                    graphiql: true,
                    context: { db }
                }));

            }

            this.on("close",function() {
                var node = this;
                RED.httpNode._router.stack.forEach(function(route,i,routes) {
                    if (route.route && route.route.path === node.url && route.route.methods[node.method]) {
                        routes.splice(i,1);
                    }
                });
            });
        } else {
            this.warn(RED._("httpin.errors.not-created"));
        }
    }
    RED.nodes.registerType("http in",HTTPIn);


    function HTTPOut(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        this.headers = n.headers||{};
        this.statusCode = n.statusCode;
        this.on("input",function(msg) {
            if (msg.res) {
                var headers = RED.util.cloneMessage(node.headers);
                if (msg.headers) {
                    if (msg.headers.hasOwnProperty('x-node-red-request-node')) {
                        var headerHash = msg.headers['x-node-red-request-node'];
                        delete msg.headers['x-node-red-request-node'];
                        var hash = hashSum(msg.headers);
                        if (hash === headerHash) {
                            delete msg.headers;
                        }
                    }
                    if (msg.headers) {
                        for (var h in msg.headers) {
                            if (msg.headers.hasOwnProperty(h) && !headers.hasOwnProperty(h)) {
                                headers[h] = msg.headers[h];
                            }
                        }
                    }
                }
                if (Object.keys(headers).length > 0) {
                    msg.res._res.set(headers);
                }
                if (msg.cookies) {
                    for (var name in msg.cookies) {
                        if (msg.cookies.hasOwnProperty(name)) {
                            if (msg.cookies[name] === null || msg.cookies[name].value === null) {
                                if (msg.cookies[name]!==null) {
                                    msg.res._res.clearCookie(name,msg.cookies[name]);
                                } else {
                                    msg.res._res.clearCookie(name);
                                }
                            } else if (typeof msg.cookies[name] === 'object') {
                                msg.res._res.cookie(name,msg.cookies[name].value,msg.cookies[name]);
                            } else {
                                msg.res._res.cookie(name,msg.cookies[name]);
                            }
                        }
                    }
                }
                var statusCode = node.statusCode || msg.statusCode || 200;
                if (typeof msg.payload == "object" && !Buffer.isBuffer(msg.payload)) {
                    msg.res._res.status(statusCode).jsonp(msg.payload);
                } else {
                    if (msg.res._res.get('content-length') == null) {
                        var len;
                        if (msg.payload == null) {
                            len = 0;
                        } else if (Buffer.isBuffer(msg.payload)) {
                            len = msg.payload.length;
                        } else if (typeof msg.payload == "number") {
                            len = Buffer.byteLength(""+msg.payload);
                        } else {
                            len = Buffer.byteLength(msg.payload);
                        }
                        msg.res._res.set('content-length', len);
                    }

                    if (typeof msg.payload === "number") {
                        msg.payload = ""+msg.payload;
                    }
                    msg.res._res.status(statusCode).send(msg.payload);
                }
            } else {
                node.warn(RED._("httpin.errors.no-response"));
            }
        });
    }
    RED.nodes.registerType("http response",HTTPOut);
}
