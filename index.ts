// TODO:
// [ ] make ActorSystem create Actor objects
// [ ] detect exceptions/terminations of actors
// [ ] actor supervision (i.e. restart policy)

//
// ACTOR SYSTEM
//

interface ActorState {
  actor: Actor;
  mailbox: unknown[];
}

type ActorRef = string;

class ActorSystem {
  private actors: { [key: string]: ActorState } = {};
  private nextActorId = 0;

  public add(actor: Actor): void {
    const ref: ActorRef = `ACTOR-${this.nextActorId}`;
    this.nextActorId += 1;
    this.actors[ref] = { actor, mailbox: [] };
    actor.init(this, ref);
  }

  public schedule(ref: ActorRef): void {
    process.nextTick(() => {
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

  public send(ref: string, message: unknown): void {
    const actorState = this.actors[ref];
    if (actorState === undefined) {
      // send dead-letter to root actor
      throw Error(`Sending to unknown actor [${ref}]`);
    }
    actorState.mailbox.push(message);
    this.schedule(ref);
  }
}

abstract class Actor {
  private _isInitialized = false;
  private _ref!: string;
  private _system!: ActorSystem;

  public ref(): ActorRef {
    if (!this._isInitialized) {
      throw Error("Actor not initialized");
    }
    return this._ref;
  }

  protected system(): ActorSystem {
    return this._system;
  }

  public init(system: ActorSystem, ref: ActorRef): void {
    if (this._isInitialized) {
      throw Error("Actor already initialized");
    }
    this._system = system;
    this._ref = ref;
    this._isInitialized = true;
  }

  public abstract onReceive(message: unknown): void;
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

const a1 = new Actor1();
const a2 = new Actor2();

system.add(a1);
system.add(a2);

// send Message to a1, from a2
system.send(a1.ref(), Message.encode({ sender: a2.ref() }));
