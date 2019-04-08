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



## GraphQL Server on http node

>We are focusing on queries (fetching data) in this example so that we can analyze messages and react on them. (We are not mutating any data)



Additional dependencies (`express` is pre-installed with `Node-RED`)

```
$ npm install graphql express-graphql deasync
```
We are updating `http in` node directly instead of creating a custom node. 


#### Schema

GraphQL Schema is comprised of types as well as operations (query, mutation and subscription). 



#### Resolver

Resolvers are functions returning objects or scalars : the implementation of schema (query) API. 



## Accessing GraphQL API

<p align="center">
<img src="https://github.com/phyunsj/mqtt-endpoint-graphql/blob/master/images/accessing-graphql-api.gif" width="700px"/>
</p>

### Related Posts

- [GraphQL Server Basics](https://www.prisma.io/blog/graphql-server-basics-the-schema-ac5e2950214e)
- [Building a GraphQL Server with Node.js and Express](https://itnext.io/building-a-graphql-server-with-node-js-and-express-f8ea78e831f9)
- [Creating A GraphQL Server With Node.js And Express](https://medium.com/codingthesmartway-com-blog/creating-a-graphql-server-with-node-js-and-express-f6dddc5320e1)
- [How to set up a GraphQL Server using Node.js, Express & MongoDB](https://medium.freecodecamp.org/how-to-set-up-a-graphql-server-using-node-js-express-mongodb-52421b73f474)
- [GraphQL Resolvers: Best Practices](https://medium.com/paypal-engineering/graphql-resolvers-best-practices-cd36fdbcef55)
