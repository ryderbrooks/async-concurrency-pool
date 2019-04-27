# async-concurrency-pool
[![Build Status](https://travis-ci.org/ryderbrooks/async-concurrency-pool.svg?branch=master)](https://travis-ci.org/ryderbrooks/agent-pool)
[![Coverage Status](https://coveralls.io/repos/github/ryderbrooks/async-concurrency-pool/badge.svg?branch=master)](https://coveralls.io/github/ryderbrooks/async-concurrency-pool?branch=master)[![npm](https://img.shields.io/npm/v/ragent-pool.svg)](https://www.npmjs.com/package/async-concurrency-pool)[![Greenkeeper badge](https://badges.greenkeeper.io/ryderbrooks/async-concurrency-pool.svg)](https://greenkeeper.io/)



## Install
```npm install async-concurrency-pool```

# Usage
```ecmascript 6
import { createAsyncPool } from 'async-concurrency-pool';


class FooWorker {
  doSomethingAsync(n) {
        return new Promise((res)=>{
          setTimeout(()=>{
            res(n);
          }, 200);
        });
      }     
}

const maxAgents = 4;
const agentPool = createAsyncPool(()=>new FooWorker(), maxAgents);


async function doSomethingWithAgentPool() {
  let cnt = 0;
  // The following loop will execute .doSomethingAsync in parallel UNTIL `maxAgents` 
  // has been reached. At that point all future calls to .doSomethingAsync will 
  // essentially execute in series moving to the next iteration as soon as the next task
  // in the pool completes
   
  while(cnt < 10){
    cnt += 1;
   
    const agent = await agentPool.getNext();
    
    // When your agent has finished you must manually call either 
    // agentPool.add(agent) OR agentPool.remove(agent)
    // Failure to do so will result in 
    // our loop getting stuck at the above `await` statement
    
    agent.doSomethingAsync(cnt)
    // put the agent back if you want to use it again
    .then((n)=>  agentPool.add(agent))
    // Or remove it from the pool
    .catch(()=>agentPool.remove(agent));
    
    // NOTE: using .then .catch .finally on the agent allows tasks to be run in parallel
    // using await agent.doSomethingAsync(cnt) would result in everything being run in 
    // series
    
  }
}
```