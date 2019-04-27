import { IAsyncPool }        from '../meta/interfaces';
import { tAgentConstructor } from '../meta/types';
import { IPopSet, PopSet }   from 'pop-set';



/**
 * The purpose of this class is to create a finite pool of agents that run async
 * tasks in parallel. The goal being to keep the number of parallel tasks running at
 * any time as close to the `maxAgents` parameter as possible.
 *
 * @param agentConstructor a function that is responsible for creating the object that
 * will be used by the consumer of this class to do async work
 * @param maxAgents the maximum number of tasks that can be run in parallel.
 *
 */
export class AsyncPool<T> implements IAsyncPool<T> {
  public get agentCnt(): number {
    return this.agents.size;
  }


  /**
   * difference between the maximum number of tasks that can be run in parallel and
   * the number that currently are being run in parallel
   */
  public get idleCnt(): number {
    return this.idle.size;
  }


  /**
   * Returns a Promise that will resolve with an agent when the number of parallel
   * tasks is below `maxAgents`.
   *
   * It is important to note that the promises returned from this function are meant
   * to be handled is series. Meaning as soon as `maxAgents` has been reached no more
   * calls to this function should be made until the call that triggered `maxAgents` to
   * be hit resolves. Failure to do this will result in an error being thrown
   */
  public async getNext(): Promise<T> {
    switch ( true ) {
      case this.agentCnt < this.maxAgents:
        // we are below the maxAgent limit
        // create a new agent and fallthrough
        await this.createAgent();
      case this.idle.size > 0:
        // we have an idle agent that can be used
        return this.idle.pop();
      case this.pendingRes !== undefined:
        // we have max agents
        // we have no idle agents that can be used
        // and we already have a pending response
        // this happens because a promise was not respected
        throw new Error('can only have 1 pending res');

      default:
        return new Promise<T>(( res ): void => {

          this.pendingRes = (): void => {
            this.pendingRes = undefined;
            res(this.getNext()
                    .then(( agent: T ): T => {
                      return agent;
                    }),
            );
          };

        });
    }
  }


  /**
   * Adds an already created agent to the idle pool and calls this.release()
   */
  public add( agent: T | null ): void {
    if( !agent ) {
      throw new TypeError('bad agent');
    }
    this.idle.add(agent);
    this.release();
  }


  /**
   * Removes the agent and calls this.release()
   *
   * @param agent object responsible for doing async work
   */
  public remove( agent: T | null ): void {
    if( !agent ) {
      throw new Error('bad agent');
    }
    this.idle.delete(agent);
    if( this.agents.has(agent) ) {
      this.agents.delete(agent);
    }
    this.release();
  }


  public constructor( agentConstructor: tAgentConstructor<T>, maxAgents: number ) {
    this.maxAgents        = maxAgents;
    this.agentConstructor = agentConstructor;
  }


  private readonly agentConstructor: tAgentConstructor<T>;
  private readonly maxAgents: number;
  private idle: IPopSet<T> = new PopSet();
  private agents: Set<T>   = new Set();
  private pendingRes: Function | undefined;


  /**
   * If a consumer of this class has asked for the next available agent but
   * `maxAgents` has already been hit calling this function will resolve the promise
   * returned to the consumer
   */
  private release(): void {
    if( typeof this.pendingRes === 'function' ) {
      this.pendingRes();
    }
  }


  private async createAgent(): Promise<T> {
    const agent: T = await this.agentConstructor();
    if( !agent ) {
      throw new Error('agent creation failed');
    }

    this.agents.add(agent);
    this.add(agent);
    return agent;
  }


  public [ Symbol.asyncIterator ](): AsyncIterator<T> {
    return {
      next : async (): Promise<IteratorResult<T>> => {
        const agent: T = await this.getNext();
        return { value : agent, done : false };
      },
    };
  }
}

