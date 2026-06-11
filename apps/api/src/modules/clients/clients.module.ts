import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'emails' }),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
