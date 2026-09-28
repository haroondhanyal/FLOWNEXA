import { Global, Module } from "@nestjs/common";
import { EventsGateway } from "./events.gateway";

// Export one authenticated event gateway for task, comment, and review modules.
@Global()
@Module({ providers: [EventsGateway], exports: [EventsGateway] })
export class EventsModule {}
