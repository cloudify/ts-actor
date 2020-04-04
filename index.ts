//
// ACTOR SYSTEM
//

class ActorSystem {
  private actors: { [key: string]: Actor } = {};
  private nextActorId = 0;

  public add(actor: Actor): void {
    const ref = `ACTOR-${this.nextActorId}`;
    this.nextActorId += 1;
    this.actors[ref] = actor;
    actor.init(this, ref);
  }

  public schedule(actor: Actor): void {
    process.nextTick(() => actor.runOnce());
  }

  public send(ref: string, message: unknown): void {
    const actor = this.actors[ref];
    if (actor === undefined) {
      // send dead-letter to root actor
      throw Error(`Sending to unknown actor [${ref}]`);
    }
    actor.push(message);
    this.schedule(actor);
  }
}

abstract class Actor {
  private _isInitialized = false;
  private _ref!: string;
  private _system!: ActorSystem;

  private inbox: unknown[] = [];

  public ref(): string {
    if (!this._isInitialized) {
      throw Error("Actor not initialized");
    }
    return this._ref;
  }

  protected system(): ActorSystem {
    return this._system;
  }

  public init(system: ActorSystem, ref: string): void {
    if (this._isInitialized) {
      throw Error("Actor already initialized");
    }
    this._system = system;
    this._ref = ref;
    this._isInitialized = true;
  }

  public push(message: unknown): void {
    this.inbox.push(message);
  }

  public runOnce(): void {
    const message = this.inbox.shift();
    if (message !== undefined) {
      this.onReceive(message);
    }
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
      console.log("A1:PING");
      this.system().send(sender, Message.encode({ sender: this.ref() }));
    });
  }
}

class Actor2 extends Actor {
  public onReceive(message: unknown): void {
    either.map(Message.decode(message), ({ sender }) => {
      console.log("A2:PONG");
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
