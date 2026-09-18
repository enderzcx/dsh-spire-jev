import {defineTool} from '@deepseek-ai/dsh-tools';
import Schema from '@deepseek-ai/schemastery';
import {createController} from 'spire-jev';
import {join} from 'node:path';
import {homedir} from 'node:os';

export const name='spire-jev';
export const inject=['tools'];
export const Config=Schema.object({
  endpoint:Schema.string().default('http://127.0.0.1:15526/api/v1/singleplayer').description('Local Slay the Spire 2 bridge'),
  apiKeyEnv:Schema.string().role('credential-ref').default('TYPESAFE_API_KEY').description('TypeSafe credential reference; never put the key itself here'),
  runtimeDir:Schema.string().description('Optional private gameplay log directory')
});

const guidance=`Spire Jev controls the user's running single-player Slay the Spire 2 via its local mod. Read spire_state first. Use spire_act with the exact state_id and advertised option id. Use spire_battle for routine Jev play until it returns control, and spire_plan for a deterministic multi-card prefix with predicted outcomes. Main-model decisions own deck building, route, potions, new mechanics and low-confidence choices. Unexpected state, draws or random effects require replanning. Never retry an uncertain mutation or operate concurrently with another player. Honor the user's stopping boundary. Installing this plugin does not install the game mod; the core README documents setup.`;

export function toolDefinitions(controllerForCall){
  const definitions=[];
  function add(name,description,parameters,run,timeoutMs=30000){
    definitions.push(defineTool({name,description,parameters,timeoutMs,
      output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},
      async execute(args,exec){
        exec.signal?.throwIfAborted();
        const controller=await controllerForCall(name);
        const value=await run(controller,args,{signal:exec.signal});
        // DSH requires canonical lossless JSON, including nested optional fields.
        return JSON.parse(JSON.stringify(value));
      }
    }));
  }
  const str=description=>({type:'string',required:true,description});
  add('spire_state','Read live game state, legal options and round planning projection. Does not play a card.',{},(c,_a,o)=>c.state(o));
  add('spire_act','Execute one advertised action against the exact observed state. Never repeat after uncertain failure.',{
    state_id:str('Exact identifier from latest spire_state or action result'),option_id:str('One advertised option id')},(c,a,o)=>c.act(a.state_id,a.option_id,o));
  add('spire_battle','Let Jev play the current fight, returning on a strategic handoff, boundary or error. Requires TypeSafe key.',{
    max_steps:{type:'integer',description:'1..100 steps; default 60'}},(c,a,o)=>c.battle(a.max_steps??60,o),300000);
  add('spire_plan','Execute a predicted multi-card prefix without model calls between cards. Requires the queue-aware game bridge. Stop before unknown draws or random effects.',{
    plan:{type:'object',required:true,additionalProperties:false,properties:{
      state_id:str('Initial state identifier'),steps:{type:'array',required:true,items:{type:'object',additionalProperties:false,properties:{
        card_index:{type:'integer',required:true,description:'Index in the original hand, not the shifting current index'},
        target_combat_id:{type:'integer',description:'Observed stable enemy combat id for targeted attacks'},
        expect:{type:'object',required:true,additionalProperties:true,description:'Patch to planning_state after this card; unspecified fields stay unchanged. Hand removal and discard +1 are automatic.'}
      }}}
    }}},(c,a,o)=>c.plan(a.plan,o),120000);
  add('spire_clear_halt','Only after inspecting uncertain action results: clear the shared stop against an exact fresh state. Does not replay the action.',{
    state_id:str('Exact state identifier after inspection')},(c,a,o)=>c.clearHalt(a.state_id,o));
  add('spire_help','Read the gameplay division of responsibility and setup requirements.',{},async()=>({guidance,core:'https://github.com/enderzcx/spire-jev'}));
  return definitions;
}

export function apply(ctx,config={}){
  const controllerForCall=async tool=>{
    const ref=config.apiKeyEnv??'TYPESAFE_API_KEY';
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref))throw Error('apiKeyEnv must be a credential reference name');
    let key;
    if(tool==='spire_battle'){
      const credentials=ctx.get?.('credentials');
      key=(await credentials?.resolve(ref))?.value??process.env[ref];
      if(typeof key!=='string'||!key.trim())throw Error(`Missing credential reference: ${ref}. No fallback account is used.`);
    }
    return createController({endpoint:config.endpoint,
      runtimeDir:config.runtimeDir??join(homedir(),'.local','state','dsh-spire-jev','logs'),apiKey:key});
  };
  for(const tool of toolDefinitions(controllerForCall))ctx.tools.register(tool);
  ctx.get?.('systemPrompt')?.section({name:'spire-jev',order:250,text:guidance});
}
