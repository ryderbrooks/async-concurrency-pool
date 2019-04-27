## Async-Concurrency-Pool

>Node.js pool for limiting the number of asynchronous tasks that run concurrently. 


---

[![Build Status](https://travis-ci.org/ryderbrooks/async-concurrency-pool.svg?branch=master)](https://travis-ci.org/ryderbrooks/agent-pool)
[![Coverage Status](https://coveralls.io/repos/github/ryderbrooks/async-concurrency-pool/badge.svg?branch=master)](https://coveralls.io/github/ryderbrooks/async-concurrency-pool?branch=master)
[![npm](https://img.shields.io/npm/v/ragent-pool.svg)](https://www.npmjs.com/package/async-concurrency-pool)
[![Greenkeeper badge](https://badges.greenkeeper.io/ryderbrooks/async-concurrency-pool.svg)](https://greenkeeper.io/)

---



## Install
```npm install async-concurrency-pool```

## Why?

Because I needed a simple mechanism to run an arbitrary number of tasks concurrently 
and didn't want to install a library with a bunch of features I don't need. It's 
written in typescript and the NPM package installs with the declaration files. It is 
intended to be used in node.js and uses native promises.
 

# Usage
I mostly use this as a base class and as a result it is intentionally bare bones. 
A factory function `createAsyncPool`, the class itself `AsyncPool` and a helper class I
 use for testing `LoopStats` is exposed. [ragent-pool](https://github.com/ryderbrooks/ragent-pool.git) is an example of a module that extends `AsyncPool` and includes implementation specific logic for how/when to return the agent to the pool. 

```javascript
import { createAsyncPool } from 'async-concurrency-pool';


class FooAgent {
  doSomethingAsync(n) {
        return new Promise((res)=>{
          setTimeout(()=>{
            res(n);
          }, 200);
        });
      }     
}
// this will be called with no arguments when a new instance of your agent is needed 
function agentFactory(){
  return new FooAgent();
}


async function doSomethingWithAgentPool() {
  const maxAgents = 2;
  const agentPool = createAsyncPool(agentFactory, maxAgents);
  
  let cnt = 0;
  
  
  /**
  *  The following loop will execute .doSomethingAsync in parallel UNTIL `maxAgents`
  *  has been reached. At that point all future calls to .doSomethingAsync will
  *  essentially execute in series moving to the next iteration when the fastest pending async
  *  task in the pool completes
  **/
  
  for await(const agent of agentPool){
    
    // it is necessary to implement your own logic for breaking from the loop
    // as the pool will loop indefinitely
    cnt += 1;
    if (cnt > 10){
      break;
    }
    
    // when the agent has completed the task you must manually call either
    // agentPool.add(agent) OR agentPool.remove(agent)
    // failure to do so will result in the loop pausing indefinitely once maxAgents has
    // been reached as the pool is intentionally ignorant about when your agent has completed it's  work.
    agent.doSomethingAsync(cnt)
    .then((n)=>{
      // return the agent to the pool to be reused later
      agentPool.add(agent);
      return n;
    })
    .catch((err)=>{
      // remove the agent from the pool so it will not be used 
      agentPool.remove(agent);
      return err;
    })

    // NOTE: using .then .catch .finally on the agent allows tasks to be run in parallel
    // using await agent.doSomethingAsync(cnt) would result in everything being run in 
    // series    
  }
}
```

##Tests
```npm run test```
