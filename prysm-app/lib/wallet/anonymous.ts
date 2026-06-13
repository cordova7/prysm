import { Actor, ActorSubclass, HttpAgent } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';

const IC_HOST = process.env.NEXT_PUBLIC_IC_HOST || 'https://icp0.io';

let anonymousAgent: HttpAgent | null = null;
const actorCacheByIdl = new WeakMap<IDL.InterfaceFactory, Map<string, ActorSubclass<any>>>();

function getAnonymousAgent(): HttpAgent {
  if (!anonymousAgent) {
    anonymousAgent = new HttpAgent({ host: IC_HOST });
  }
  return anonymousAgent;
}

export function getAnonymousActor<T>(
  canisterId: string,
  idlFactory: IDL.InterfaceFactory
): ActorSubclass<T> {
  let actorCache = actorCacheByIdl.get(idlFactory);
  if (!actorCache) {
    actorCache = new Map<string, ActorSubclass<any>>();
    actorCacheByIdl.set(idlFactory, actorCache);
  }

  const cacheKey = `${canisterId}`;
  const cached = actorCache.get(cacheKey);
  if (cached) return cached as ActorSubclass<T>;

  const agent = getAnonymousAgent();
  const actor = Actor.createActor<T>(idlFactory, { agent, canisterId });
  actorCache.set(cacheKey, actor);
  return actor;
}
