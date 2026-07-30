import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationService } from './notification.service';

/**
 * Global notification infrastructure — exposes NotificationService (backed by the
 * 'emails' queue) to every feature module without each re-registering the queue.
 */
@Global()
@Module({
  imports:   [BullModule.registerQueue({ name: 'emails' })],
  providers: [NotificationService],
  exports:   [NotificationService],
})
export class NotificationsModule {}
