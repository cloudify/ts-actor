//
// ACTOR SYSTEM
//

abstract class Actor {
  private inbox: unknown[] = [];

  public push(message: unknown): void {
    this.inbox.push(message);
    process.nextTick(() => this.processOne());
  }

  private processOne(): void {
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

const Message = t.type({
  sender: t.any,
});

class Actor1 extends Actor {
  public onReceive(message: unknown): void {
    either.map(Message.decode(message), ({ sender }) => {
      console.log("A1:PING");
      sender.push(Message.encode({ sender: this }));
    });
  }
}

class Actor2 extends Actor {
  public onReceive(message: unknown): void {
    either.map(Message.decode(message), ({ sender }) => {
      console.log("A2:PONG");
      sender.push(Message.encode({ sender: this }));
    });
  }
}

const a1 = new Actor1();
const a2 = new Actor2();

// send Message to a1, from a2
a1.push(Message.encode({ sender: a2 }));
