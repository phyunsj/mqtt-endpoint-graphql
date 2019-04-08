# MQTT endpoint with Query Support (GraphQL)


MQTT broker is a central place of distributing published messages to subscribers. Sometimes, it makes sense to store all messages for the later use (analytics, re-distribution, etc).


## MQTT endpoint(sink)

As usual, my first choice of PoC development environment is `Node-RED`.

```
7 Apr 13:40:53 - [info] Node-RED version: v0.18.7
7 Apr 13:40:53 - [info] Node.js  version: v8.9.1
7 Apr 13:40:53 - [info] Darwin 18.2.0 x64 LE
```

Create `subscriber` with  topic `#` to listen and store all messages.

<p align="center">
<img src="https://github.com/phyunsj/mqtt-endpoint-graphql/blob/master/images/mqtt-endpoint-graphql.png" width="700px"/>
</p>

## GraphQL Server on http node

We are updating `http in` node directly instead of creating a custom node. 

The following packages are required. Install under `node-red` folder. (`express` is pre-installed with `Node-RED`)

```
$ npm install graphql express-graphql deasync nedb
```

Source :[21-httpin.html](https://github.com/phyunsj/mqtt-endpoint-graphql/blob/master/core/io/21-httpin.html)

```
   <div class="form-row">
        <label for="node-input-method"><i class="fa fa-tasks"></i> 
            <span data-i18n="httpin.label.method"></span></label>
        <select type="text" id="node-input-method" style="width:70%;">
        <option value="get">GET</option>
        <option value="post">POST</option>
        <option value="put">PUT</option>
        <option value="delete">DELETE</option>
        <option value="patch">PATCH</option>
        <option value="all">ALL</option>
+       <option value="graphql">GraphQL</option>
        </select>
   </div>
```

<p align="center">
<img src="https://github.com/phyunsj/mqtt-endpoint-graphql/blob/master/images/graphql-node.png" width="500px"/>
</p>

#### Schema

GraphQL Schema is made up of types as well as operations (query, mutation and subscription). 

>We are focusing on queries (fetching data) in this example so that we can analyze messages and react on them. (We are not mutating any data)

Source :[21-httpin.js](https://github.com/phyunsj/mqtt-endpoint-graphql/blob/master/core/io/21-httpin.js)

```
    var express_graphql = require('express-graphql'); 
    var { buildSchema } = require('graphql'); 

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
       eventQuery ( eventTopic: String, eventType: EventType = all, 
                    eventOrder: EventSort = NEWEST_FIRST, eventLimit : Int = 5 ): [Event]
       temperatureQuery ( num: Int = 50,  eventOp: Operator = LESS_THAN,  
                    eventOrder: EventSort = NEWEST_FIRST): [Event]
       temperatureAvg ( eventTopic: String ): String
       node(_id: ID!): Node
    }
    `);
```

#### Resolver

Resolvers are the implementation of schema (query) API. 

```
    var root = {
        ...
        ,
        overHeated: (args, context) => { 
           ...
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
              //db.find({ eventType: args.eventType }).sort( sortOrder )
              //  .limit(eventLimit).exec(function (err, result) {
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
           ... 
        }
    };
```
Mount express-graphql as a route handler for `/graphql`

```
    if (this.method == "graphql") {
                RED.httpNode.use( '/graphql', express_graphql({
                    schema: schema,  // schema object out of GraphQL schema language
                    rootValue: root, // resolver
                    graphiql: true,
                    context: { db }  
                }));
    }
```

## Accessing GraphQL API

<p align="center">
<img src="https://github.com/phyunsj/mqtt-endpoint-graphql/blob/master/images/accessing-graphql-api.gif" width="700px"/>
</p>

### Related Posts

- [express-graphql](https://github.com/graphql/express-graphql)
- [GraphQL Server Basics](https://www.prisma.io/blog/graphql-server-basics-the-schema-ac5e2950214e)
- [Building a GraphQL Server with Node.js and Express](https://itnext.io/building-a-graphql-server-with-node-js-and-express-f8ea78e831f9)
- [Creating A GraphQL Server With Node.js And Express](https://medium.com/codingthesmartway-com-blog/creating-a-graphql-server-with-node-js-and-express-f6dddc5320e1)
- [How to set up a GraphQL Server using Node.js, Express & MongoDB](https://medium.freecodecamp.org/how-to-set-up-a-graphql-server-using-node-js-express-mongodb-52421b73f474)
- [GraphQL Resolvers: Best Practices](https://medium.com/paypal-engineering/graphql-resolvers-best-practices-cd36fdbcef55)
