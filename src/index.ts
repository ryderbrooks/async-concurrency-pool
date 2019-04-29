import { IAsyncPool }        from './meta/interfaces';
import { tAgentConstructor } from './meta/types';
import { AsyncPool }         from './lib/AsyncPool';


export { AsyncPool } from './lib/AsyncPool';
export { IAsyncPool } from './meta/interfaces';
export { tAgentConstructor } from './meta/types';

export function createAsyncPool<T>( agentConstructor: tAgentConstructor<T>,
                                    maxAgents: number ): IAsyncPool<T> {
  return new AsyncPool(agentConstructor, maxAgents);
}

export { TestHelperTypes, LoopStats } from './__tests__/TimerHelper';
