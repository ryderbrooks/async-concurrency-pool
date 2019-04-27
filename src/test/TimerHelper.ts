interface IAA<T> {
  agentCnt: number;

  [ Symbol.asyncIterator ](): AsyncIterator<T>;
}



interface ITimings {
  loopTime: number;
  elapseTime: number;
  resolutionTime: number;
}



type sStatResult<R> =
  ITimings
  & R;


export namespace TestHelperTypes {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type sTestResponse = {agentID: number; message: any};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type sTestArgs = {path: TEST_PATHS; delay: number; message?: any};



  export const enum TEST_PATHS {
    RESOLVE = 'resolve',
    REJECT  = 'reject'
  }



  export interface ILoopStats<R> {
    totalLoopTime: number;
    testIterations: number;
    totalDelay: number;
    maxAllocAgents: number;
    results: {
      raw: sStatResult<R>[];
      minLoopTime: number;
      maxLoopTime: number;
      minResTime: number;
      maxResTime: number;
    };
    sortedBy: {
      loopTime: sStatResult<R>[];
      elapsedTime: sStatResult<R>[];
      resolutionTime: sStatResult<R>[];
    };
  }

}



export class LoopStats<T, P extends IAA<T>, A extends TestHelperTypes.sTestArgs, R extends TestHelperTypes.sTestResponse> {
  public static hrtToMS( hrtTime: [ number, number ] ): number {
    const x: number = (hrtTime[ 0 ] * 1e9) + hrtTime[ 1 ];
    return x / 1e6;
  }


  public constructor( maxAgents: number,
                      testConditions: A[],
                      poolFactory: ( agentConstructor: () => Promise<T>,
                                     maxAgents: number ) => P ) {
    this.testConditions = testConditions;
    this.agentPool      = poolFactory(this._agentConstructor(), maxAgents);
  }


  private readonly testConditions: A[];
  protected readonly agentPool: P;
  private totalDelay: number           = 0;
  private agentID: number              = 0;
  private timings: ITimings[]          = [];
  private _resolved: sStatResult<R> [] = [];
  private _maxAllocAgents: number      = 0;
  protected _startTime: [ number, number ] | undefined;


  private get startTime(): [ number, number ] {
    if( !this._startTime ) {
      this._startTime = process.hrtime();
    }
    return this._startTime;
  }


  private set resolved( v: R[] ) {
    this._resolved = v.map(( d, i ): sStatResult<R> => {
      return { ...this.timings[ i ], ...d };
    });
  }


  private set maxAllocAgents( n: number ) {
    if( n > this._maxAllocAgents ) {
      this._maxAllocAgents = n;
    }
  }


  private async looper(): Promise<number> {
    const results: Promise<R>[] = [];

    let tNow = this.startTime;
    let cnt  = 0;

    for await ( const agent of this.agentPool ) {
      this.maxAllocAgents = this.agentPool.agentCnt;
      if( cnt >= this.testIterations ) {
        break;
      }

      results.push(this._doWork(agent, this.testConditions[ cnt ])
                       .then(( v ): R & {resolutionTime: number} => {
                         return {
                           ...v,
                           resolutionTime : LoopStats.hrtToMS(process.hrtime(this.startTime)),
                         };
                       })
                       .catch(( v ): R & {resolutionTime: number} => {
                         return {
                           ...v,
                           resolutionTime : LoopStats.hrtToMS(process.hrtime(this.startTime)),
                         };
                       }),
      );

      this.timings.push({
                          loopTime       : LoopStats.hrtToMS(process.hrtime(tNow)),
                          elapseTime     : LoopStats.hrtToMS(process.hrtime(this.startTime)),
                          resolutionTime : 0,
                        });
      cnt += 1;
      tNow = process.hrtime();
    }
    const exeTime = LoopStats.hrtToMS(process.hrtime(this.startTime));
    this.resolved = await Promise.all(results);
    return exeTime;
  }


  private _agentConstructor(): () => Promise<T> {
    return (): Promise<T> => {
      this.agentID += 1;
      return this.agentConstructor(this.agentID);
    };
  }


  private _doWork( agent: T,
                   testCondition: A ): Promise<R> {
    this.totalDelay += testCondition.delay;
    return this.doWork(agent, testCondition);
  }


  //@ts-ignore
  protected agentConstructor( agentID: number ): Promise<T> {/* eslint-disable-line @typescript-eslint/no-unused-vars */
    //eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    return new Promise<T>(() => {
      throw new Error('agentConstructor not implemented');
    });
  }


  // @ts-ignore
  protected doWork( agent: T, testCondition: A ): Promise<R> {/* eslint-disable-line @typescript-eslint/no-unused-vars */
    throw new Error('doWork not implemented');
  }


  protected basic( args: A, agentID: number ): Promise<R> {
    return new Promise<R>(( res, rej ): void => {

      setTimeout((): void => {
        switch ( args.path ) {
          case TestHelperTypes.TEST_PATHS.REJECT:
            rej({
                  agentID : agentID,
                  message : args.message,
                  error   : new Error('basic rejection'),
                });
            break;
          case TestHelperTypes.TEST_PATHS.RESOLVE:
            res({ agentID : agentID, message : args.message } as R);
            break;
          default:
            throw new Error('no path');
        }
      }, args.delay);
    });
  }


  public get testIterations(): number {
    return this.testConditions.length;
  }


  public async run(): Promise<TestHelperTypes.ILoopStats<R>> {
    const totalLoopTime: number = await this.looper();

    const sortedByLoopTime    = this._resolved
                                    .slice()
                                    .sort(( a, b ): number => {
                                      if( !a.loopTime || !b.loopTime ) {
                                        throw new Error('bad loop time');
                                      }
                                      return a.loopTime - b.loopTime;
                                    });
    const sortedByElapsedTime = this._resolved
                                    .slice()
                                    .sort(( a, b ): number => {
                                      if( !a.elapseTime || !b.elapseTime ) {
                                        throw new Error('bad elapse time');
                                      }
                                      return a.elapseTime - b.elapseTime;
                                    });

    const sortedByResolutionTime = this._resolved
                                       .slice()
                                       .sort(( a, b ): number => {
                                         if( !a.resolutionTime || !b.resolutionTime ) {
                                           throw new Error('bad elapse time');
                                         }
                                         return a.resolutionTime - b.resolutionTime;
                                       });

    return {
      totalDelay     : this.totalDelay,
      testIterations : this.testIterations,
      maxAllocAgents : this._maxAllocAgents,
      totalLoopTime,
      results        : {
        raw         : this._resolved,
        minLoopTime : sortedByLoopTime[ 1 ].loopTime,
        maxLoopTime : sortedByLoopTime[ sortedByLoopTime.length - 1 ].loopTime,
        minResTime  : sortedByResolutionTime[ 1 ].elapseTime,
        maxResTime  : sortedByResolutionTime[ sortedByResolutionTime.length
                                              - 1 ].elapseTime,
      },
      sortedBy       : {
        loopTime       : sortedByLoopTime.slice(),
        elapsedTime    : sortedByElapsedTime.slice(),
        resolutionTime : sortedByResolutionTime.slice(),
      },
    };
  }
}
