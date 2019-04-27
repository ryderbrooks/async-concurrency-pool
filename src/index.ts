import { IAsyncPool }        from './meta/interfaces';
import { tAgentConstructor } from './meta/types';
import { AsyncPool }         from './lib/AsyncPool';


export { AsyncPool } from './lib/AsyncPool';

export function createAsyncPool<T>( agentConstructor: tAgentConstructor<T>,
                                    maxAgents: number ): IAsyncPool<T> {
  return new AsyncPool(agentConstructor, maxAgents);
}

export { TestHelperTypes, LoopStats } from './test/TimerHelper';
