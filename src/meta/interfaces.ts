export interface IAsyncPool<T> {
  agentCnt: number;
  idleCnt: number;

  [ Symbol.asyncIterator ](): AsyncIterator<T>;

  getNext(): Promise<T>;

  add( agent: T | null ): void;

  remove( agent: T | null ): void;
}


