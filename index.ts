// TODO:
// [ ] detect exceptions/terminations of actors
// [ ] actor supervision (i.e. restart policy)

import * as t from "io-ts";

//
// ACTOR SYSTEM
//

type ActorRef = string;

const Terminated = t.interface({
  type: t.literal("TERMINATED"),
  ref: t.string,
});

interface ChildActorState extends ActorState {
  // children always have a parent
  parent: ActorRef;
  // actors that must be informed of this actor lifecycle
  watchers: Set<ActorRef>;
}

abstract class Actor {
  public constructor(
    private readonly _system: ActorSystem,
    private readonly _ref: ActorRef
  ) {}

  public ref(): ActorRef {
    return this._ref;
  }

  protected system(): ActorSystem {
    return this._system;
  }

  protected watch(ref: ActorRef): void {
    this.system().watch(this.ref(), ref);
  }

  public abstract onReceive(message: unknown): void;
}

class RootActor extends Actor {
  public onReceive(message: unknown): void {
    console.log(`RootActor received ${message}`);
  }
}

interface ActorState {
  actor: Actor;
  mailbox: unknown[];
}

class ActorSystem {
  private rootActorRef!: ActorRef;
  private actors: { [key: string]: ChildActorState } = {};
  private nextActorId = 0;

  constructor() {
    this.rootActorRef = this.actorOf(RootActor);
  }

  public actorOf(c: new (_: ActorSystem, __: ActorRef) => Actor): ActorRef {
    const ref: ActorRef = `ACTOR-${this.nextActorId}`;
    this.nextActorId += 1;
    const actor = new c(this, ref);
    this.actors[ref] = {
      actor,
      mailbox: [],
      parent: this.rootActorRef,
      watchers: new Set(),
    };
    return ref;
  }

  public schedule(ref: ActorRef): void {
    setImmediate(() => {
      const actorState = this.actors[ref];
      if (actorState === undefined) {
        // send error event to root actor
        return;
      }
      const message = actorState.mailbox.shift();
      if (message === undefined) {
        return;
      }
      try {
        actorState.actor.onReceive(message);
      } catch (e) {
        // onReceive failed
        const terminated = Terminated.encode({ type: "TERMINATED", ref });
        actorState.watchers.forEach((watcher) => {
          this.send(watcher as ActorRef, terminated);
        });
        delete this.actors[ref];
      }
    });
  }

  public send(ref: ActorRef, message: unknown): void {
    const actorState = this.actors[ref];
    if (actorState === undefined) {
      // send dead-letter to root actor
      throw Error(`Sending to unknown actor [${ref}]`);
    }
    actorState.mailbox.push(message);
    this.schedule(ref);
  }

  public watch(watcherRef: ActorRef, watchedRef: ActorRef): void {
    const watchedActor = this.actors[watchedRef];
    if (watchedActor === undefined) {
      throw Error(`Watch failed, actor not found [${watchedRef}]`);
    }
    watchedActor.watchers.add(watcherRef);
  }
}

//
// EXAMPLE ACTORS
//

import { either } from "fp-ts/lib/Either";

const system = new ActorSystem();

const Message = t.type({
  replyTo: t.string,
});

class Actor1 extends Actor {
  public onReceive(message: unknown): void {
    if (Message.is(message)) {
      console.log(`${this.ref()}:PING`);
      this.system().send(
        message.replyTo,
        Message.encode({ replyTo: this.ref() })
      );
    } else if (Terminated.is(message)) {
      console.log(`Child terminated ${message.ref}`);
    }
  }
}

class Actor2 extends Actor {
  private counter: number = 0;

  public onReceive(message: unknown): void {
    if (Message.is(message)) {
      console.log(`${this.ref()}:PONG:${this.counter}`);
      if (this.counter >= 10) {
        throw Error("FAILURE");
      }
      this.counter += 1;
      this.system().send(
        message.replyTo,
        Message.encode({ replyTo: this.ref() })
      );
    }
  }
}

const a1 = system.actorOf(Actor1);
const a2 = system.actorOf(Actor2);
system.watch(a1, a2);

// send Message to a1, from a2
system.send(a1, Message.encode({ replyTo: a2 }));
