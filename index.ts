// TODO:
// [ ] detect exceptions/terminations of actors
// [ ] actor supervision (i.e. restart policy)

//
// ACTOR SYSTEM
//

type ActorRef = string;

interface ChildActorState extends ActorState {
  // children always have a parent
  parent: ActorRef;
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
    this.rootActorRef = this.spawn(RootActor);
  }

  public spawn(c: new (_: ActorSystem, __: ActorRef) => Actor): ActorRef {
    const ref: ActorRef = `ACTOR-${this.nextActorId}`;
    this.nextActorId += 1;
    const actor = new c(this, ref);
    this.actors[ref] = { actor, mailbox: [], parent: this.rootActorRef };
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
      if (message !== undefined) {
        actorState.actor.onReceive(message);
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
}

//
// EXAMPLE ACTORS
//

import * as t from "io-ts";
import { either } from "fp-ts/lib/Either";

const system = new ActorSystem();

const Message = t.type({
  sender: t.string,
});

class Actor1 extends Actor {
  public onReceive(message: unknown): void {
    either.map(Message.decode(message), ({ sender }) => {
      console.log(`${this.ref()}:PING`);
      this.system().send(sender, Message.encode({ sender: this.ref() }));
    });
  }
}

class Actor2 extends Actor {
  public onReceive(message: unknown): void {
    either.map(Message.decode(message), ({ sender }) => {
      console.log(`${this.ref()}:PONG`);
      this.system().send(sender, Message.encode({ sender: this.ref() }));
    });
  }
}

const a1 = system.spawn(Actor1);
const a2 = system.spawn(Actor2);

// send Message to a1, from a2
system.send(a1, Message.encode({ sender: a2 }));
