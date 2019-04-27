import { expect }                     from 'chai';
import { IAsyncPool }                 from '../meta/interfaces';
import { LoopStats, TestHelperTypes } from './TimerHelper';
import { IRequestable }               from '@ragent/cross-types';
import { createAsyncPool }            from '../index';
import sTestResponse = TestHelperTypes.sTestResponse;
import sTestArgs = TestHelperTypes.sTestArgs;
import TEST_PATHS = TestHelperTypes.TEST_PATHS;


describe('AsyncPool', () => {

  context('consumed as iterator', () => {

    class LStats extends LoopStats<IRequestable<sTestArgs, sTestResponse>,
      IAsyncPool<IRequestable<sTestArgs, sTestResponse>>,
      sTestArgs,
      sTestResponse> {


      protected agentConstructor( agentID: number ): Promise<IRequestable<sTestArgs, sTestResponse>> {
        return new Promise<IRequestable<sTestArgs, sTestResponse>>(( res ): void => {
          res({
                request : ( args: sTestArgs ): Promise<sTestResponse> => {
                  return this.basic(args, agentID);
                },
              });
        });
      }


      protected doWork( agent: IRequestable<sTestArgs, sTestResponse>,
                        testCondition: sTestArgs ): Promise<sTestResponse> {
        return agent.request(testCondition)
                    .then(( payload: sTestResponse ) => {
                      this.agentPool.add(agent);
                      return payload;
                    })
                    .catch(( err: any ) => {
                      this.agentPool.remove(agent);
                      return err;
                    });
      }
    }



    describe('below maxAgents limit', () => {
      it('executes all tasks in parallel without waiting for resolution', async () => {
        const maxAgents                   = 3;
        const testConditions: sTestArgs[] = [
          { path : TEST_PATHS.RESOLVE, delay : 100, message : '1' },
          { path : TEST_PATHS.RESOLVE, delay : 100, message : '2' },
        ];

        const results = await new LStats(
          maxAgents,
          testConditions,
          createAsyncPool).run();

        expect(results.totalLoopTime).to.be.below(100);
      });

      it('tasks resolve in the expected order', async () => {
        const maxAgents                                      = 3;
        const testConditions: sTestArgs[]                    = [
          { path : TEST_PATHS.RESOLVE, delay : 200, message : '2' },
          { path : TEST_PATHS.RESOLVE, delay : 100, message : '1' },
        ];
        const expected: {message: string; agentID: number}[] = [
          { message : '1', agentID : 2 },
          { message : '2', agentID : 1 },
        ];

        const result = await new LStats(maxAgents,
                                        testConditions,
                                        createAsyncPool).run();

        expected.map(( d, i ) => expect(result.sortedBy.resolutionTime[ i ])
          .to
          .deep
          .include(d));
      });
    });


    describe('above maxAgents limit', () => {
      it('does not exceed the maxAgents parameter', async () => {
        const maxAgents                   = 2;
        const testConditions: sTestArgs[] = [
          { path : TEST_PATHS.RESOLVE, delay : 100, message : '1' },
          { path : TEST_PATHS.RESOLVE, delay : 100, message : '2' },
          { path : TEST_PATHS.RESOLVE, delay : 100, message : '3' },
          { path : TEST_PATHS.RESOLVE, delay : 100, message : '4' },
        ];
        const result                      = await new LStats(maxAgents,
                                                             testConditions,
                                                             createAsyncPool).run();
        expect(result.maxAllocAgents).to.equal(maxAgents);
      });
      it('pauses loop until a task resolves', async () => {
        const maxAgents                   = 2;
        const testConditions: sTestArgs[] = [
          { path : TEST_PATHS.RESOLVE, delay : 450, message : '3' },
          { path : TEST_PATHS.RESOLVE, delay : 50, message : '1' },
          { path : TEST_PATHS.RESOLVE, delay : 200, message : '2' },
        ];

        const result = await new LStats(maxAgents,
                                        testConditions,
                                        createAsyncPool).run();
        expect(result.totalLoopTime).to.be.be.within(250, 300);
      });

      it('resolves tasks in the expected order', async () => {
        const maxAgents                                      = 2;
        const testConditions: sTestArgs[]                    = [
          { path : TEST_PATHS.RESOLVE, delay : 450, message : '3' },
          { path : TEST_PATHS.REJECT, delay : 50, message : '1' },
          { path : TEST_PATHS.RESOLVE, delay : 200, message : '2' },
        ];
        const expected: {message: string; agentID: number}[] = [
          { message : '1', agentID : 2 },
          { message : '2', agentID : 3 },
          { message : '3', agentID : 1 },
        ];

        const result = await new LStats(maxAgents,
                                        testConditions,
                                        createAsyncPool).run();
        expected.map(( d, i ) => {
          expect(result.sortedBy.resolutionTime[ i ]).to.deep.include(d);
        });
      });
    });
  });
});