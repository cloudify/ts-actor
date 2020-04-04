abstract class Actor {
  private inbox: { message: unknown; sender: Actor }[] = [];

  public push(message: unknown, sender: Actor): void {
    this.inbox.push({ message, sender });
    process.nextTick(() => this.processOne());
  }

  private processOne(): void {
    const head = this.inbox.shift();
    if (head !== undefined) {
      const { message, sender } = head;
      this.receive(message, sender);
    }
  }

  public abstract receive(message: unknown, sender: Actor): void;
}

class Actor1 extends Actor {
  public receive(message: unknown, sender: Actor): void {
    console.log(message);
    sender.push("PING", this);
  }
}

class Actor2 extends Actor {
  public receive(message: unknown, sender: Actor): void {
    console.log(message);
    sender.push("PONG", this);
  }
}

const a1 = new Actor1();
const a2 = new Actor2();
a1.push("PING", a2);
